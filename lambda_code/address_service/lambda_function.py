# =============================================================================
# lambda_function.py - Address Service
# =============================================================================

import json
import uuid
import boto3
import os
import jwt
import logging
from datetime import datetime, timezone

logger = logging.getLogger()
logger.setLevel(logging.INFO)

JWT_SECRET       = os.environ.get("JWT_SECRET", "mySuperSecretKey123!")
USERS_TABLE_NAME = os.environ.get("USERS_TABLE_NAME", "dev-flashmart_users")

dynamodb    = boto3.resource("dynamodb", region_name="ap-southeast-1")
users_table = dynamodb.Table(USERS_TABLE_NAME)

STAGE_PREFIXES = ["/dev", "/prod", "/staging", "/v1", "/v2"]
MAX_ADDRESSES  = 5


def verify_token(event):
    headers     = event.get("headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if not auth_header:
        return None, "Missing token"
    try:
        token   = auth_header.split(" ")[1]
        decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return decoded, None
    except Exception:
        return None, "Invalid token"


def lambda_handler(event, context):
    if "requestContext" in event and "http" in event.get("requestContext", {}):
        http_method = event["requestContext"]["http"]["method"].upper()
        path        = event.get("rawPath", "")
    else:
        http_method = event.get("httpMethod", "").upper()
        path        = event.get("path", "")

    for prefix in STAGE_PREFIXES:
        if path.startswith(prefix):
            path = path[len(prefix):]
            break

    path       = path.rstrip("/")
    path_parts = [p for p in path.split("/") if p]

    if http_method == "OPTIONS":
        return cors_response()

    user, error = verify_token(event)
    if error:
        return response(401, {"error": error})

    try:
        if http_method == "GET" and len(path_parts) == 2 and path_parts[0] == "addresses":
            return get_addresses(path_parts[1], user)

        if http_method == "POST" and len(path_parts) == 2 and path_parts[0] == "addresses":
            return add_address(path_parts[1], parse_body(event), user)

        if http_method == "PUT" and len(path_parts) == 3 and path_parts[0] == "addresses":
            return update_address(path_parts[1], path_parts[2], parse_body(event), user)

        if http_method == "DELETE" and len(path_parts) == 3 and path_parts[0] == "addresses":
            return delete_address(path_parts[1], path_parts[2], user)

        if http_method == "PUT" and len(path_parts) == 4 and path_parts[0] == "addresses" and path_parts[3] == "default":
            return set_default_address(path_parts[1], path_parts[2], user)

        return response(404, {"error": "Route not found", "path": path})

    except Exception as e:
        logger.error(json.dumps({"event": "unhandled_exception", "error": str(e)}))
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# ADDRESS OPERATIONS
# =============================================================================

def get_addresses(user_id, user):
    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")
    if not item:
        return response(404, {"error": "User not found", "user_id": user_id})

    addresses = item.get("addresses", [])
    logger.info(json.dumps({"event": "addresses_fetched", "userId": user_id, "count": len(addresses)}))
    return response(200, {"user_id": user_id, "count": len(addresses), "addresses": addresses})


def add_address(user_id, body, user):
    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    for field in ["name", "phone", "line1", "city", "state", "pincode"]:
        if not body.get(field):
            return response(400, {"error": f"Missing required field: {field}"})

    phone = str(body["phone"]).strip()
    if not phone.lstrip("+").isdigit() or len(phone.lstrip("+")) < 10:
        return response(400, {"error": "Invalid phone number"})

    pincode = str(body["pincode"]).strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return response(400, {"error": "Pincode must be 6 digits"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")
    if not item:
        return response(404, {"error": "User not found"})

    existing = list(item.get("addresses", []))
    if len(existing) >= MAX_ADDRESSES:
        return response(400, {"error": f"Maximum {MAX_ADDRESSES} addresses allowed per user"})

    is_first   = len(existing) == 0
    address_id = str(uuid.uuid4())
    new_address = {
        "address_id": address_id,
        "name":       str(body["name"]).strip(),
        "phone":      phone,
        "line1":      str(body["line1"]).strip(),
        "line2":      str(body.get("line2", "")).strip(),
        "city":       str(body["city"]).strip(),
        "state":      str(body["state"]).strip(),
        "pincode":    pincode,
        "is_default": body.get("is_default", is_first),
        "created_at": utc_now()
    }

    if new_address["is_default"]:
        for addr in existing:
            addr["is_default"] = False

    existing.append(new_address)
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": existing}
    )
    logger.info(json.dumps({"event": "address_added", "userId": user_id, "addressId": address_id}))
    return response(201, {"message": "Address added successfully", "address_id": address_id, "address": new_address})


def update_address(user_id, address_id, body, user):
    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")
    if not item:
        return response(404, {"error": "User not found"})

    addresses    = list(item.get("addresses", []))
    target_index = next((i for i, a in enumerate(addresses) if a["address_id"] == address_id), None)
    if target_index is None:
        return response(404, {"error": "Address not found", "address_id": address_id})

    for field in ["name", "phone", "line1", "line2", "city", "state", "pincode"]:
        if field in body and body[field] is not None:
            addresses[target_index][field] = str(body[field]).strip()

    addresses[target_index]["updated_at"] = utc_now()
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": addresses}
    )
    logger.info(json.dumps({"event": "address_updated", "userId": user_id, "addressId": address_id}))
    return response(200, {"message": "Address updated successfully", "address": addresses[target_index]})


def delete_address(user_id, address_id, user):
    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")
    if not item:
        return response(404, {"error": "User not found"})

    addresses     = list(item.get("addresses", []))
    was_default   = False
    new_addresses = []

    for addr in addresses:
        if addr["address_id"] == address_id:
            was_default = addr.get("is_default", False)
        else:
            new_addresses.append(addr)

    if len(new_addresses) == len(addresses):
        return response(404, {"error": "Address not found", "address_id": address_id})

    if was_default and new_addresses:
        new_addresses[0]["is_default"] = True

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": new_addresses}
    )
    logger.info(json.dumps({"event": "address_deleted", "userId": user_id, "addressId": address_id}))
    return response(200, {"message": "Address deleted successfully", "address_id": address_id})


def set_default_address(user_id, address_id, user):
    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")
    if not item:
        return response(404, {"error": "User not found"})

    addresses = list(item.get("addresses", []))
    found     = False

    for addr in addresses:
        if addr["address_id"] == address_id:
            addr["is_default"] = True
            found = True
        else:
            addr["is_default"] = False

    if not found:
        return response(404, {"error": "Address not found", "address_id": address_id})

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": addresses}
    )
    logger.info(json.dumps({"event": "default_address_set", "userId": user_id, "addressId": address_id}))
    return response(200, {"message": "Default address updated", "address_id": address_id})


# =============================================================================
# HELPERS
# =============================================================================

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def parse_body(event):
    try:
        raw_body = event.get("body") or "{}"
        return raw_body if isinstance(raw_body, dict) else json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return {}

def cors_response():
    return {"statusCode": 200, "headers": {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"}, "body": ""}

def response(status_code, body):
    return {"statusCode": status_code, "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"}, "body": json.dumps(body, default=str)}