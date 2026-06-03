# =============================================================================
# lambda_function.py - Payment Service
# =============================================================================

import json
import uuid
import boto3
import hmac
import hashlib
import urllib.request
import urllib.error
import base64
import logging
import os
from decimal import Decimal
from datetime import datetime, timezone
import jwt
import time

logger = logging.getLogger()
logger.setLevel(logging.INFO)

JWT_SECRET          = os.environ.get("JWT_SECRET", "mySuperSecretKey123!")
RAZORPAY_KEY_ID     = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")
PAYMENT_TABLE_NAME  = os.environ.get("PAYMENT_TABLE_NAME", "dev-flashmart-payments")

dynamodb      = boto3.resource("dynamodb", region_name="ap-southeast-1")
payment_table = dynamodb.Table(PAYMENT_TABLE_NAME)

STAGE_PREFIXES   = ["/dev", "/prod", "/staging", "/v1", "/v2"]
RAZORPAY_API_URL = "https://api.razorpay.com/v1"


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
        if http_method == "POST" and path_parts == ["payments", "initiate"]:
            return initiate_payment(parse_body(event), user)

        if http_method == "POST" and path_parts == ["payments", "verify"]:
            return verify_payment(parse_body(event), user)

        if http_method == "GET" and len(path_parts) == 3 and path_parts[:2] == ["payments", "status"]:
            return get_payment_status(path_parts[2], user)

        if http_method == "GET" and len(path_parts) == 3 and path_parts[:2] == ["payments", "user"]:
            return get_payments_by_user(path_parts[2], user)

        if http_method == "GET" and len(path_parts) == 3 and path_parts[:2] == ["payments", "order"]:
            return get_payment_by_order(path_parts[2], user)

        return response(404, {"error": "Route not found"})

    except Exception as e:
        logger.error(json.dumps({"event": "unhandled_exception", "error": str(e)}))
        return response(500, {"error": str(e)})


def initiate_payment(body, user):
    if "order_id" not in body or body.get("amount") is None:
        return response(400, {"error": "Missing fields"})

    amount = float(body["amount"])
    if amount <= 0:
        return response(400, {"error": "Amount must be greater than 0"})

    order_id     = str(body["order_id"])
    currency     = body.get("currency", "INR")
    user_id      = user.get("userId")
    amount_paise = int(amount * 100)

    razorpay_order, error = create_razorpay_order(amount_paise, currency, order_id)
    if error:
        logger.error(json.dumps({"event": "payment_initiate_failed", "orderId": order_id, "error": error}))
        return response(500, {"error": error})

    payment_id = str(uuid.uuid4())
    now = utc_now()

    payment_table.put_item(Item={
        "payment_id":        payment_id,
        "order_id":          order_id,
        "user_id":           user_id,
        "razorpay_order_id": razorpay_order["id"],
        "amount":            Decimal(str(amount)),
        "amount_paise":      amount_paise,
        "currency":          currency,
        "status":            "CREATED",
        "created_at":        now,
        "updated_at":        now
    })

    logger.info(json.dumps({"event": "payment_initiated", "paymentId": payment_id, "orderId": order_id, "userId": user_id, "amount": amount}))
    return response(201, {
        "payment_id":        payment_id,
        "razorpay_order_id": razorpay_order["id"],
        "razorpay_key_id":   RAZORPAY_KEY_ID,
        "amount_paise":      amount_paise,
        "currency":          currency
    })


def verify_payment(body, user):
    payment_id = body["payment_id"]
    result     = payment_table.get_item(Key={"payment_id": payment_id})
    payment    = result.get("Item")

    if not payment:
        return response(404, {"error": "Not found"})

    valid = verify_razorpay_signature(
        body["razorpay_order_id"],
        body["razorpay_payment_id"],
        body["razorpay_signature"]
    )

    if not valid:
        logger.warning(json.dumps({"event": "payment_failed", "paymentId": payment_id, "reason": "signature_mismatch"}))
        return response(400, {"error": "Invalid signature"})

    payment_table.update_item(
        Key={"payment_id": payment_id},
        UpdateExpression="SET #s=:s, updated_at=:u",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "PAID", ":u": utc_now()}
    )

    logger.info(json.dumps({"event": "payment_verified", "paymentId": payment_id, "orderId": payment.get("order_id"), "userId": payment.get("user_id")}))
    return response(200, {"message": "Payment success"})


def verify_razorpay_signature(order_id, payment_id, signature):
    message = f"{order_id}|{payment_id}"
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        msg=message.encode(),
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def get_payment_status(payment_id, user):
    result  = payment_table.get_item(Key={"payment_id": payment_id})
    payment = result.get("Item")
    if not payment:
        return response(404, {})
    if user.get("role") != "admin" and payment.get("user_id") != user.get("userId"):
        return response(403, {"error": "Access denied"})
    logger.info(json.dumps({"event": "payment_status_fetched", "paymentId": payment_id}))
    return response(200, payment)


def get_payment_by_order(order_id, user):
    result = payment_table.query(
        IndexName="order_id-index",
        KeyConditionExpression=boto3.dynamodb.conditions.Key("order_id").eq(order_id)
    )
    items = result.get("Items", [])
    if not items:
        return response(404, {})
    payment = items[0]
    if user.get("role") != "admin" and payment.get("user_id") != user.get("userId"):
        return response(403, {"error": "Access denied"})
    return response(200, payment)


def get_payments_by_user(user_id, user):
    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})
    result = payment_table.query(
        IndexName="user_id-index",
        KeyConditionExpression=boto3.dynamodb.conditions.Key("user_id").eq(user_id)
    )
    return response(200, result.get("Items", []))


def create_razorpay_order(amount, currency, receipt):
    credentials = base64.b64encode(f"{RAZORPAY_KEY_ID}:{RAZORPAY_KEY_SECRET}".encode()).decode()
    payload = json.dumps({"amount": amount, "currency": currency, "receipt": receipt}).encode()
    req = urllib.request.Request(
        f"{RAZORPAY_API_URL}/orders",
        data=payload,
        headers={"Authorization": f"Basic {credentials}", "Content-Type": "application/json"}
    )
    try:
        res = urllib.request.urlopen(req)
        return json.loads(res.read()), None
    except urllib.error.HTTPError as e:
        return None, f"Razorpay error {e.code}: {e.read().decode()}"
    except Exception as e:
        return None, str(e)


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def parse_body(event):
    return json.loads(event.get("body", "{}"))


def cors_response():
    return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization"}, "body": ""}


def response(code, body):
    return {"statusCode": code, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,Authorization"}, "body": json.dumps(body, default=str)}