# =============================================================================
# lambda_function.py - Order Service for Quick Commerce Application
# =============================================================================

# =============================================================================
# IMPORTS
# =============================================================================
import json
import uuid
import boto3
import urllib.request
import urllib.error
import time
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
import jwt
import os

JWT_SECRET = os.environ.get("JWT_SECRET", "mySuperSecretKey123!")

# =============================================================================
# JWT HELPERS
# =============================================================================
def verify_token(event):
    headers = event.get("headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization")

    if not auth_header:
        return None, "Missing token"

    try:
        token = auth_header.split(" ")[1]
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return decoded, None
    except Exception:
        return None, "Invalid token"


def get_service_token():
    """Generate an internal service-to-service JWT token."""
    payload = {
        "user_id": "service-account",
        "role":    "admin",
        "exp":     int(time.time()) + 60
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


# =============================================================================
# DYNAMODB SETUP
# =============================================================================
dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-1")
order_table = dynamodb.Table("dev-flashmart-orders")

# =============================================================================
# CONSTANTS
# =============================================================================
VALID_STATUSES = ["PLACED", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]

ALLOWED_TRANSITIONS = {
    "PLACED":    ["CONFIRMED", "CANCELLED"],
    "CONFIRMED": ["SHIPPED",   "CANCELLED"],
    "SHIPPED":   ["DELIVERED"],
    "DELIVERED": [],
    "CANCELLED": []
}

NON_CANCELLABLE_STATUSES = ["SHIPPED", "DELIVERED", "CANCELLED"]

STAGE_PREFIXES = ["/dev", "/prod", "/staging", "/v1", "/v2"]

# =============================================================================
# SERVICE URLs
# =============================================================================
CART_SERVICE_URL    = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com"
PRODUCT_SERVICE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com"

# =============================================================================
# LAMBDA HANDLER (ROUTING)
# =============================================================================
def lambda_handler(event, context):
    """Main Lambda handler — supports both REST API and HTTP API."""

    if "requestContext" in event and "http" in event.get("requestContext", {}):
        http_method = event["requestContext"]["http"]["method"].upper()
        path = event.get("rawPath", "")
    else:
        http_method = event.get("httpMethod", "").upper()
        path = event.get("path", "")

    for prefix in STAGE_PREFIXES:
        if path.startswith(prefix):
            path = path[len(prefix):]
            break

    path = path.rstrip("/")
    path_parts = [p for p in path.split("/") if p]

    # ✅ OPTIONS must be FIRST — before JWT check
    if http_method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            },
            "body": ""
        }

    # ✅ JWT verification
    user, error = verify_token(event)
    if error:
        return response(401, {"error": error})

    try:
        # POST /orders/place
        if http_method == "POST" and path_parts == ["orders", "place"]:
            body = parse_body(event)
            return place_order(body)

        # POST /orders/{order_id}/cancel
        if (http_method == "POST"
                and len(path_parts) == 3
                and path_parts[0] == "orders"
                and path_parts[2] == "cancel"):
            return cancel_order(path_parts[1])

        # ✅ GET /orders/{user_id} — regular users can access their own orders
        if (http_method == "GET"
                and len(path_parts) == 2
                and path_parts[0] == "orders"):
            return get_orders_by_user(path_parts[1])

        # ✅ Admin-only routes below
        if user["role"] != "admin":
            return response(403, {"error": "Admin access required"})

        # PUT /orders/{order_id}/status
        if (http_method == "PUT"
                and len(path_parts) == 3
                and path_parts[0] == "orders"
                and path_parts[2] == "status"):
            body = parse_body(event)
            return update_order_status(path_parts[1], body)

        # GET /orders/details/{order_id}
        if (http_method == "GET"
                and len(path_parts) == 3
                and path_parts[:2] == ["orders", "details"]):
            return get_order_by_id(path_parts[2])

        # GET /orders/{order_id}/summary
        if (http_method == "GET"
                and len(path_parts) == 3
                and path_parts[0] == "orders"
                and path_parts[2] == "summary"):
            return get_order_summary(path_parts[1])

        return response(404, {"error": "Route not found", "path": path, "method": http_method})

    except Exception as e:
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# ORDER OPERATIONS
# =============================================================================

def place_order(body):
    """POST /orders/place - Create a new order from user's cart."""
    if "user_id" not in body or not body["user_id"]:
        return response(400, {"error": "Missing required field: user_id"})

    user_id = str(body["user_id"]).strip()
    if not user_id:
        return response(400, {"error": "user_id must be a non-empty string"})

    cart = get_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})

    cart_items = cart.get("items", [])
    if not cart_items:
        return response(400, {"error": "Cannot place order — cart is empty", "user_id": user_id})

    order_items = []
    for item in cart_items:
        order_items.append({
            "product_id":  str(item["product_id"]),
            "name":        str(item["name"]),
            "price":       Decimal(str(round(float(item["unit_price"]), 2))),
            "quantity":    int(item["quantity"]),
            "total_price": Decimal(str(round(float(item["total_price"]), 2)))
        })

    total_amount = compute_order_total(order_items)
    now          = utc_now()
    order_id     = str(uuid.uuid4())

    order = {
        "order_id":     order_id,
        "user_id":      user_id,
        "items":        order_items,
        "total_amount": Decimal(str(total_amount)),
        "status":       "PLACED",
        "created_at":   now,
        "updated_at":   now
    }

    order_table.put_item(Item=order)

    deduction_errors = []
    for item in order_items:
        success = deduct_product_stock(item["product_id"], int(item["quantity"]))
        if not success:
            deduction_errors.append(item["product_id"])

    clear_cart(user_id)

    result = {
        "message": "Order placed successfully",
        "order":   deserialize_order(order)
    }

    if deduction_errors:
        result["stock_deduction_warnings"] = {
            "message":     "Order placed but stock deduction failed for some products",
            "product_ids": deduction_errors
        }

    return response(201, result)


def get_orders_by_user(user_id):
    """GET /orders/{user_id} - Return all orders for a user."""
    result = order_table.scan(
        FilterExpression=Attr("user_id").eq(user_id)
    )
    orders = [deserialize_order(o) for o in result.get("Items", [])]
    orders.sort(key=lambda o: o["created_at"], reverse=True)

    return response(200, {
        "user_id": user_id,
        "count":   len(orders),
        "orders":  orders
    })


def get_order_by_id(order_id):
    """GET /orders/details/{order_id} - Return a single order."""
    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found", "order_id": order_id})
    return response(200, {"order": order})


def update_order_status(order_id, body):
    """PUT /orders/{order_id}/status - Update order status."""
    if "status" not in body or not body["status"]:
        return response(400, {"error": "Missing required field: status"})

    new_status = str(body["status"]).strip().upper()

    if new_status not in VALID_STATUSES:
        return response(400, {
            "error":            "Invalid status",
            "provided":         new_status,
            "allowed_statuses": VALID_STATUSES
        })

    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found", "order_id": order_id})

    current_status = order["status"]

    if new_status not in ALLOWED_TRANSITIONS.get(current_status, []):
        return response(409, {
            "error":            "Invalid status transition",
            "current_status":   current_status,
            "requested_status": new_status,
            "allowed_next":     ALLOWED_TRANSITIONS.get(current_status, [])
        })

    now = utc_now()
    order_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression="SET #status = :status, #updated_at = :updated_at",
        ExpressionAttributeValues={
            ":status":     new_status,
            ":updated_at": now
        },
        ExpressionAttributeNames={
            "#status":     "status",
            "#updated_at": "updated_at"
        }
    )

    updated_order = find_order(order_id)
    return response(200, {
        "message": "Order status updated successfully",
        "order":   updated_order
    })


def cancel_order(order_id):
    """POST /orders/{order_id}/cancel - Cancel an order."""
    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found", "order_id": order_id})

    current_status = order["status"]

    if current_status in NON_CANCELLABLE_STATUSES:
        return response(409, {
            "error":          "Order cannot be cancelled",
            "current_status": current_status,
            "reason":         f"Orders with status '{current_status}' cannot be cancelled"
        })

    now = utc_now()
    order_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression="SET #status = :status, #updated_at = :updated_at",
        ExpressionAttributeValues={
            ":status":     "CANCELLED",
            ":updated_at": now
        },
        ExpressionAttributeNames={
            "#status":     "status",
            "#updated_at": "updated_at"
        }
    )

    restock_errors = []
    for item in order.get("items", []):
        success = restock_product_stock(item["product_id"], int(item["quantity"]))
        if not success:
            restock_errors.append(item["product_id"])

    result = {
        "message":         "Order cancelled successfully",
        "order_id":        order_id,
        "previous_status": current_status,
        "current_status":  "CANCELLED"
    }

    if restock_errors:
        result["restock_warnings"] = {
            "message":     "Order cancelled but restock failed for some products",
            "product_ids": restock_errors
        }

    return response(200, result)


def get_order_summary(order_id):
    """GET /orders/{order_id}/summary - Return order summary stats."""
    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found", "order_id": order_id})

    items          = order.get("items", [])
    total_items    = len(items)
    total_quantity = sum(int(item["quantity"]) for item in items)
    total_amount   = float(order["total_amount"])

    return response(200, {
        "order_id": order_id,
        "user_id":  order["user_id"],
        "status":   order["status"],
        "summary": {
            "total_items":    total_items,
            "total_quantity": total_quantity,
            "total_amount":   total_amount
        }
    })


# =============================================================================
# CART SERVICE INTEGRATION
# =============================================================================

def get_cart(user_id):
    """Fetch real cart from Cart Service API with service token."""
    try:
        url = f"{CART_SERVICE_URL}/cart/{user_id}"
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {get_service_token()}")
        res = urllib.request.urlopen(req, timeout=5)
        data = json.loads(res.read().decode())
        return data.get("cart")
    except urllib.error.HTTPError as e:
        print(f"[WARN] Cart fetch failed: {e.code} {e.reason}")
        return None
    except Exception as e:
        print(f"[WARN] Cart fetch failed: {str(e)}")
        return None


def clear_cart(user_id):
    """Clear cart via Cart Service API after order is placed."""
    try:
        url = f"{CART_SERVICE_URL}/cart/clear/{user_id}"
        req = urllib.request.Request(url, method="DELETE")
        req.add_header("Authorization", f"Bearer {get_service_token()}")
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        print(f"[WARN] Cart clear failed: {str(e)}")
        pass


# =============================================================================
# PRODUCT SERVICE INTEGRATION
# =============================================================================

def deduct_product_stock(product_id, quantity):
    """Call Product Service to deduct stock after order is placed."""
    try:
        url     = f"{PRODUCT_SERVICE_URL}/products/{product_id}/deduct"
        payload = json.dumps({"quantity": quantity}).encode("utf-8")
        req     = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception as e:
        print(f"[WARN] Stock deduction failed for {product_id}: {str(e)}")
        return False


def restock_product_stock(product_id, quantity):
    """Call Product Service to restock when order is cancelled."""
    try:
        url     = f"{PRODUCT_SERVICE_URL}/products/{product_id}/restock"
        payload = json.dumps({"quantity": quantity}).encode("utf-8")
        req     = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={"Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception as e:
        print(f"[WARN] Restock failed for {product_id}: {str(e)}")
        return False


def get_product(product_id):
    """Fetch real product from Product Service API."""
    try:
        url = f"{PRODUCT_SERVICE_URL}/products/{product_id}"
        req = urllib.request.urlopen(url, timeout=5)
        data = json.loads(req.read().decode())
        return data.get("product")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        return None
    except Exception:
        return None


# =============================================================================
# PRICING & CALCULATION FUNCTIONS
# =============================================================================

def compute_order_total(items):
    """Calculate total amount from all order items."""
    return round(sum(float(item["total_price"]) for item in items), 2)


# =============================================================================
# UTILITY / HELPER FUNCTIONS
# =============================================================================

def find_order(order_id):
    """Fetch a single order from DynamoDB by order_id."""
    result = order_table.get_item(Key={"order_id": order_id})
    item = result.get("Item")
    if not item:
        return None
    return deserialize_order(item)


def deserialize_order(item):
    """Convert DynamoDB order item to clean API-friendly dict."""
    return {
        "order_id":     item["order_id"],
        "user_id":      item["user_id"],
        "items": [
            {
                "product_id":  i["product_id"],
                "name":        i["name"],
                "price":       float(i["price"]),
                "quantity":    int(i["quantity"]),
                "total_price": float(i["total_price"])
            }
            for i in item.get("items", [])
        ],
        "total_amount": float(item["total_amount"]),
        "status":       item["status"],
        "created_at":   item["created_at"],
        "updated_at":   item["updated_at"]
    }


def response(status_code, body):
    """Standard API Gateway-compatible response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": json.dumps(body, default=str)
    }


def parse_body(event):
    """Safely parse JSON body from Lambda event."""
    try:
        raw_body = event.get("body") or "{}"
        if isinstance(raw_body, dict):
            return raw_body
        return json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return {}


def utc_now():
    """Return current UTC timestamp as ISO 8601 string."""
    return datetime.now(timezone.utc).isoformat()