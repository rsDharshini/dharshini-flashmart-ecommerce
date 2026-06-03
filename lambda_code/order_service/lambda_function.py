# =============================================================================
# lambda_function.py - Order Service (+ Admin: GET /orders/all)
# =============================================================================

import json
import uuid
import boto3
import urllib.request
import urllib.error
import logging
import time
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr
import jwt
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)

JWT_SECRET = os.environ.get("JWT_SECRET", "mySuperSecretKey123!")

dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-1")
order_table = dynamodb.Table("dev-flashmart-orders")

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
CART_SERVICE_URL    = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com/v1"
PRODUCT_SERVICE_URL = "https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com/v1"


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
    payload = {"user_id": "service-account", "role": "admin", "exp": int(time.time()) + 60}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def lambda_handler(event, context):
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
    if path.startswith("/v1"):
        path = path[3:]
    path_parts = [p for p in path.split("/") if p]

    if http_method == "OPTIONS":
        return cors_response()

    user, error = verify_token(event)
    if error:
        return response(401, {"error": error})

    try:
        if http_method == "POST" and path_parts == ["orders", "place"]:
            return place_order(parse_body(event))

        if http_method == "POST" and len(path_parts) == 3 and path_parts[0] == "orders" and path_parts[2] == "cancel":
            return cancel_order(path_parts[1])

        if http_method == "GET" and len(path_parts) == 2 and path_parts[0] == "orders":
            return get_orders_by_user(path_parts[1])

        if user.get("role") != "admin":
            return response(403, {"error": "Admin access required"})

        if http_method == "GET" and path_parts == ["orders"]:
            return get_all_orders()

        if http_method == "PUT" and len(path_parts) == 3 and path_parts[0] == "orders" and path_parts[2] == "status":
            return update_order_status(path_parts[1], parse_body(event))

        if http_method == "GET" and len(path_parts) == 3 and path_parts[:2] == ["orders", "details"]:
            return get_order_by_id(path_parts[2])

        if http_method == "GET" and len(path_parts) == 3 and path_parts[0] == "orders" and path_parts[2] == "summary":
            return get_order_summary(path_parts[1])

        return response(404, {"error": "Route not found", "path": path, "method": http_method})

    except Exception as e:
        logger.error(json.dumps({"event": "unhandled_exception", "error": str(e)}))
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# ORDER OPERATIONS
# =============================================================================

def get_all_orders():
    result = order_table.scan()
    orders = [deserialize_order(o) for o in result.get("Items", [])]
    orders.sort(key=lambda o: o["created_at"], reverse=True)
    logger.info(json.dumps({"event": "list_all_orders", "count": len(orders)}))
    return response(200, {"orders": orders, "count": len(orders)})


def place_order(body):
    if "user_id" not in body or not body["user_id"]:
        return response(400, {"error": "Missing required field: user_id"})

    user_id = str(body["user_id"]).strip()
    cart = get_cart(user_id)
    if not cart:
        return response(404, {"error": "Cart not found", "user_id": user_id})

    cart_items = cart.get("items", [])
    if not cart_items:
        return response(400, {"error": "Cannot place order — cart is empty"})

    order_items = [{
        "product_id":  str(item["product_id"]),
        "name":        str(item["name"]),
        "price":       Decimal(str(round(float(item["unit_price"]), 2))),
        "quantity":    int(item["quantity"]),
        "total_price": Decimal(str(round(float(item["total_price"]), 2)))
    } for item in cart_items]

    total_amount = round(sum(float(i["total_price"]) for i in order_items), 2)
    now = utc_now()
    order_id = str(uuid.uuid4())

    order = {
        "order_id": order_id, "user_id": user_id,
        "items": order_items, "total_amount": Decimal(str(total_amount)),
        "status": "PLACED", "created_at": now, "updated_at": now
    }
    order_table.put_item(Item=order)
    logger.info(json.dumps({"event": "order_placed", "orderId": order_id, "userId": user_id, "totalAmount": total_amount, "itemCount": len(order_items)}))

    deduction_errors = []
    for item in order_items:
        if not deduct_product_stock(item["product_id"], int(item["quantity"])):
            deduction_errors.append(item["product_id"])
    clear_cart(user_id)

    result = {"message": "Order placed successfully", "order": deserialize_order(order)}
    if deduction_errors:
        result["stock_deduction_warnings"] = {"product_ids": deduction_errors}
    return response(201, result)


def get_orders_by_user(user_id):
    result = order_table.scan(FilterExpression=Attr("user_id").eq(user_id))
    orders = [deserialize_order(o) for o in result.get("Items", [])]
    orders.sort(key=lambda o: o["created_at"], reverse=True)
    logger.info(json.dumps({"event": "list_user_orders", "userId": user_id, "count": len(orders)}))
    return response(200, {"user_id": user_id, "count": len(orders), "orders": orders})


def get_order_by_id(order_id):
    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found"})
    logger.info(json.dumps({"event": "order_fetched", "orderId": order_id}))
    return response(200, {"order": order})


def update_order_status(order_id, body):
    new_status = str(body.get("status", "")).strip().upper()
    if new_status not in VALID_STATUSES:
        return response(400, {"error": "Invalid status", "allowed_statuses": VALID_STATUSES})

    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found"})

    current_status = order["status"]
    if new_status not in ALLOWED_TRANSITIONS.get(current_status, []):
        return response(409, {"error": "Invalid status transition", "current": current_status, "allowed_next": ALLOWED_TRANSITIONS.get(current_status, [])})

    now = utc_now()
    order_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression="SET #status = :status, #updated_at = :updated_at",
        ExpressionAttributeValues={":status": new_status, ":updated_at": now},
        ExpressionAttributeNames={"#status": "status", "#updated_at": "updated_at"}
    )
    logger.info(json.dumps({"event": "order_status_updated", "orderId": order_id, "from": current_status, "to": new_status}))
    return response(200, {"message": "Order status updated", "order": find_order(order_id)})


def cancel_order(order_id):
    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found"})

    if order["status"] in NON_CANCELLABLE_STATUSES:
        return response(409, {"error": f"Cannot cancel order with status '{order['status']}'"})

    now = utc_now()
    order_table.update_item(
        Key={"order_id": order_id},
        UpdateExpression="SET #status = :status, #updated_at = :updated_at",
        ExpressionAttributeValues={":status": "CANCELLED", ":updated_at": now},
        ExpressionAttributeNames={"#status": "status", "#updated_at": "updated_at"}
    )
    logger.info(json.dumps({"event": "order_cancelled", "orderId": order_id, "previousStatus": order["status"]}))

    for item in order.get("items", []):
        restock_product_stock(item["product_id"], int(item["quantity"]))

    return response(200, {"message": "Order cancelled", "order_id": order_id})


def get_order_summary(order_id):
    order = find_order(order_id)
    if not order:
        return response(404, {"error": "Order not found"})
    items = order.get("items", [])
    logger.info(json.dumps({"event": "order_summary_fetched", "orderId": order_id}))
    return response(200, {"order_id": order_id, "status": order["status"], "summary": {
        "total_items":    len(items),
        "total_quantity": sum(int(i["quantity"]) for i in items),
        "total_amount":   float(order["total_amount"])
    }})


# =============================================================================
# INTEGRATIONS
# =============================================================================

def get_cart(user_id):
    try:
        url = f"{CART_SERVICE_URL}/cart/{user_id}"
        req = urllib.request.Request(url)
        req.add_header("Authorization", f"Bearer {get_service_token()}")
        res = urllib.request.urlopen(req, timeout=5)
        return json.loads(res.read().decode()).get("cart")
    except Exception as e:
        logger.warning(json.dumps({"event": "cart_fetch_failed", "userId": user_id, "error": str(e)}))
        return None


def clear_cart(user_id):
    try:
        url = f"{CART_SERVICE_URL}/cart/clear/{user_id}"
        req = urllib.request.Request(url, method="DELETE")
        req.add_header("Authorization", f"Bearer {get_service_token()}")
        urllib.request.urlopen(req, timeout=5)
    except Exception as e:
        logger.warning(json.dumps({"event": "cart_clear_failed", "userId": user_id, "error": str(e)}))


def deduct_product_stock(product_id, quantity):
    try:
        url = f"{PRODUCT_SERVICE_URL}/products/{product_id}/deduct"
        req = urllib.request.Request(url, data=json.dumps({"quantity": quantity}).encode(), method="POST", headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception as e:
        logger.warning(json.dumps({"event": "stock_deduction_failed", "productId": product_id, "error": str(e)}))
        return False


def restock_product_stock(product_id, quantity):
    try:
        url = f"{PRODUCT_SERVICE_URL}/products/{product_id}/restock"
        req = urllib.request.Request(url, data=json.dumps({"quantity": quantity}).encode(), method="POST", headers={"Content-Type": "application/json"})
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception as e:
        logger.warning(json.dumps({"event": "restock_failed", "productId": product_id, "error": str(e)}))
        return False


# =============================================================================
# HELPERS
# =============================================================================

def find_order(order_id):
    result = order_table.get_item(Key={"order_id": order_id})
    item = result.get("Item")
    return deserialize_order(item) if item else None


def deserialize_order(item):
    return {
        "order_id": item["order_id"], "user_id": item["user_id"],
        "items": [{"product_id": i["product_id"], "name": i["name"], "price": float(i["price"]), "quantity": int(i["quantity"]), "total_price": float(i["total_price"])} for i in item.get("items", [])],
        "total_amount": float(item["total_amount"]),
        "status": item["status"], "created_at": item["created_at"], "updated_at": item["updated_at"]
    }


def cors_response():
    return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"}, "body": ""}


def response(status_code, body):
    return {"statusCode": status_code, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"}, "body": json.dumps(body, default=str)}


def parse_body(event):
    try:
        body = event.get("body") or "{}"
        return json.loads(body) if isinstance(body, str) else body
    except:
        return {}


def utc_now():
    return datetime.now(timezone.utc).isoformat()