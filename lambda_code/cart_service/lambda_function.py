# =============================================================================
# lambda_function.py - Cart Service (DynamoDB Version)
# =============================================================================

import json
import boto3
import urllib.request
import urllib.error
import logging
from datetime import datetime, timezone
import jwt
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

JWT_SECRET = os.environ.get("JWT_SECRET", "mySuperSecretKey123!")

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

# =============================================================================
# DYNAMODB SETUP
# =============================================================================
dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-1")
cart_table = dynamodb.Table("dev-flashmart-cart")

PRODUCT_SERVICE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com"
STAGE_PREFIXES = ["/dev", "/prod", "/staging", "/v1", "/v2"]

# =============================================================================
# LAMBDA HANDLER (ROUTING)
# =============================================================================
def lambda_handler(event, context):
    if "requestContext" in event and "http" in event.get("requestContext", {}):
        http_method = event["requestContext"]["http"]["method"].upper()
        path = event.get("rawPath") or event.get("path", "")
    else:
        http_method = event.get("httpMethod", "").upper()
        path = event.get("path", "")

    for prefix in STAGE_PREFIXES:
        if path.startswith(prefix):
            path = path[len(prefix):]
            break

    path = path.rstrip("/")
    path_parts = [p for p in path.split("/") if p]

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

    if path.startswith("/cart"):
        user, error = verify_token(event)
        if error:
            return response(401, {"error": error})

    try:
        if http_method == "POST" and path_parts == ["cart", "add"]:
            return add_to_cart(parse_body(event))

        if http_method == "DELETE" and path_parts == ["cart", "remove"]:
            return remove_item(parse_body(event))

        if http_method == "PUT" and path_parts == ["cart", "update"]:
            return update_quantity(parse_body(event))

        if http_method == "DELETE" and len(path_parts) == 3 and path_parts[:2] == ["cart", "clear"]:
            return clear_cart(path_parts[2])

        if http_method == "GET" and len(path_parts) == 3 and path_parts[0] == "cart" and path_parts[2] == "summary":
            return get_cart_summary(path_parts[1])

        if http_method == "GET" and len(path_parts) == 2 and path_parts[0] == "cart":
            return get_cart(path_parts[1])

        return response(404, {"error": "Route not found", "path": path, "method": http_method})

    except Exception as e:
        logger.error(json.dumps({"event": "unhandled_exception", "error": str(e)}))
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# CART OPERATIONS
# =============================================================================

def add_to_cart(body):
    required_fields = ["user_id", "product_id", "quantity"]
    missing = [f for f in required_fields if f not in body or body[f] is None]
    if missing:
        return response(400, {"error": "Missing required fields", "fields": missing})

    user_id    = str(body["user_id"]).strip()
    product_id = str(body["product_id"]).strip()

    if not user_id:
        return response(400, {"error": "user_id must be a non-empty string"})

    try:
        quantity = int(body["quantity"])
    except (ValueError, TypeError):
        return response(400, {"error": "quantity must be a positive integer"})

    if quantity <= 0:
        return response(400, {"error": "quantity must be greater than 0"})

    product = get_product(product_id)
    if not product:
        return response(404, {"error": "Product not found", "product_id": product_id})
    if not product["is_active"]:
        return response(409, {"error": "Product is not available", "product_id": product_id})
    if product["stock"] < quantity:
        return response(409, {
            "error": "Insufficient stock",
            "available_stock": product["stock"],
            "requested_quantity": quantity
        })

    now  = utc_now()
    cart = find_cart(user_id)

    if not cart:
        cart = {
            "user_id": user_id,
            "items": {},
            "total_cart_value": "0.0",
            "created_at": now,
            "updated_at": now
        }

    items = cart.get("items", {})

    if product_id in items:
        existing     = items[product_id]
        new_quantity = int(existing["quantity"]) + quantity

        if product["stock"] < new_quantity:
            return response(409, {
                "error": "Insufficient stock for updated quantity",
                "available_stock": product["stock"],
                "current_cart_quantity": existing["quantity"],
                "requested_additional": quantity
            })

        items[product_id]["quantity"]    = new_quantity
        items[product_id]["total_price"] = str(compute_item_total(product["final_price"], new_quantity))
        items[product_id]["updated_at"]  = now
    else:
        items[product_id] = {
            "product_id":  product_id,
            "name":        product["name"],
            "unit_price":  str(product["final_price"]),
            "quantity":    quantity,
            "total_price": str(compute_item_total(product["final_price"], quantity)),
            "added_at":    now,
            "updated_at":  now
        }

    cart["items"]            = items
    cart["total_cart_value"] = str(compute_cart_total(items))
    cart["updated_at"]       = now

    cart_table.put_item(Item=cart)

    logger.info(json.dumps({"event": "cart_item_added", "userId": user_id, "productId": product_id, "quantity": quantity}))
    return response(200, {
        "message": "Item added to cart successfully",
        "user_id": user_id,
        "cart":    serialize_cart(cart)
    })


def get_cart(user_id):
    cart = find_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})
    logger.info(json.dumps({"event": "cart_fetched", "userId": user_id, "itemCount": len(cart["items"])}))
    if not cart["items"]:
        return response(200, {"message": "Cart is empty", "user_id": user_id, "cart": serialize_cart(cart)})
    return response(200, {"user_id": user_id, "cart": serialize_cart(cart)})


def remove_item(body):
    required_fields = ["user_id", "product_id"]
    missing = [f for f in required_fields if f not in body or body[f] is None]
    if missing:
        return response(400, {"error": "Missing required fields", "fields": missing})

    user_id    = str(body["user_id"]).strip()
    product_id = str(body["product_id"]).strip()

    cart = find_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})
    if product_id not in cart["items"]:
        return response(404, {"error": "Product not found in cart", "product_id": product_id})

    del cart["items"][product_id]
    cart["total_cart_value"] = str(compute_cart_total(cart["items"]))
    cart["updated_at"]       = utc_now()

    cart_table.put_item(Item=cart)
    logger.info(json.dumps({"event": "cart_item_removed", "userId": user_id, "productId": product_id}))
    return response(200, {"message": "Item removed successfully", "user_id": user_id, "cart": serialize_cart(cart)})


def clear_cart(user_id):
    cart = find_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})

    cart["items"]            = {}
    cart["total_cart_value"] = "0.0"
    cart["updated_at"]       = utc_now()

    cart_table.put_item(Item=cart)
    logger.info(json.dumps({"event": "cart_cleared", "userId": user_id}))
    return response(200, {"message": "Cart cleared successfully", "user_id": user_id})


def update_quantity(body):
    required_fields = ["user_id", "product_id", "quantity"]
    missing = [f for f in required_fields if f not in body or body[f] is None]
    if missing:
        return response(400, {"error": "Missing required fields", "fields": missing})

    user_id    = str(body["user_id"]).strip()
    product_id = str(body["product_id"]).strip()

    try:
        quantity = int(body["quantity"])
    except (ValueError, TypeError):
        return response(400, {"error": "quantity must be an integer"})

    if quantity < 0:
        return response(400, {"error": "quantity cannot be negative"})

    cart = find_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})
    if product_id not in cart["items"]:
        return response(404, {"error": "Product not found in cart", "product_id": product_id})

    now = utc_now()

    if quantity == 0:
        del cart["items"][product_id]
        cart["total_cart_value"] = str(compute_cart_total(cart["items"]))
        cart["updated_at"]       = now
        cart_table.put_item(Item=cart)
        logger.info(json.dumps({"event": "cart_item_removed", "userId": user_id, "productId": product_id, "reason": "quantity_zero"}))
        return response(200, {"message": "Item removed (quantity set to 0)", "user_id": user_id, "cart": serialize_cart(cart)})

    product = get_product(product_id)
    if not product:
        return response(404, {"error": "Product no longer exists", "product_id": product_id})
    if not product["is_active"]:
        return response(409, {"error": "Product is no longer active", "product_id": product_id})
    if product["stock"] < quantity:
        return response(409, {
            "error": "Insufficient stock",
            "available_stock": product["stock"],
            "requested_quantity": quantity
        })

    cart["items"][product_id]["quantity"]    = quantity
    cart["items"][product_id]["total_price"] = str(compute_item_total(product["final_price"], quantity))
    cart["items"][product_id]["updated_at"]  = now
    cart["total_cart_value"]                 = str(compute_cart_total(cart["items"]))
    cart["updated_at"]                       = now

    cart_table.put_item(Item=cart)
    logger.info(json.dumps({"event": "cart_quantity_updated", "userId": user_id, "productId": product_id, "quantity": quantity}))
    return response(200, {"message": "Cart updated successfully", "user_id": user_id, "cart": serialize_cart(cart)})


def get_cart_summary(user_id):
    cart = find_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})

    total_items    = len(cart["items"])
    total_quantity = sum(int(item["quantity"]) for item in cart["items"].values())

    logger.info(json.dumps({"event": "cart_summary_fetched", "userId": user_id, "totalItems": total_items}))
    return response(200, {
        "user_id": user_id,
        "summary": {
            "total_items":      total_items,
            "total_quantity":   total_quantity,
            "total_cart_value": float(cart["total_cart_value"])
        }
    })


# =============================================================================
# PRODUCT SERVICE INTEGRATION
# =============================================================================

def get_product(product_id):
    try:
        url = f"{PRODUCT_SERVICE_URL}/v1/products/{product_id}"
        req = urllib.request.urlopen(url, timeout=5)
        data = json.loads(req.read().decode())
        return data.get("product")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        return None
    except Exception as e:
        logger.warning(json.dumps({"event": "product_fetch_failed", "productId": product_id, "error": str(e)}))
        return None


# =============================================================================
# PRICING & CALCULATION FUNCTIONS
# =============================================================================

def compute_item_total(unit_price, quantity):
    return round(float(unit_price) * int(quantity), 2)


def compute_cart_total(items):
    return round(sum(float(item["total_price"]) for item in items.values()), 2)


# =============================================================================
# UTILITY / HELPER FUNCTIONS
# =============================================================================

def find_cart(user_id):
    result = cart_table.get_item(Key={"user_id": user_id})
    return result.get("Item")


def serialize_cart(cart):
    return {
        "user_id": cart["user_id"],
        "items": [
            {
                **item,
                "price":       float(item["unit_price"]),
                "unit_price":  float(item["unit_price"]),
                "total_price": float(item["total_price"]),
                "quantity":    int(item["quantity"])
            }
            for item in cart["items"].values()
        ],
        "total_cart_value": float(cart["total_cart_value"]),
        "created_at":       cart["created_at"],
        "updated_at":       cart["updated_at"]
    }


def response(status_code, body):
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
    try:
        raw_body = event.get("body") or "{}"
        if isinstance(raw_body, dict):
            return raw_body
        return json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return {}


def utc_now():
    return datetime.now(timezone.utc).isoformat()