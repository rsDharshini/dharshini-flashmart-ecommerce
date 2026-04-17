# =============================================================================
# lambda_function.py - Address Service
# =============================================================================

import json
import uuid
import boto3
import os
import jwt
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

# =============================================================================
# ENVIRONMENT VARIABLES
# =============================================================================
JWT_SECRET       = os.environ.get("JWT_SECRET", "mySuperSecretKey123!")
USERS_TABLE_NAME = os.environ.get("USERS_TABLE_NAME", "dev-flashmart_users")

# =============================================================================
# DYNAMODB SETUP
# =============================================================================
dynamodb    = boto3.resource("dynamodb", region_name="ap-southeast-1")
users_table = dynamodb.Table(USERS_TABLE_NAME)

# =============================================================================
# CONSTANTS
# =============================================================================
STAGE_PREFIXES = ["/dev", "/prod", "/staging", "/v1", "/v2"]
MAX_ADDRESSES  = 5   # max addresses per user

# =============================================================================
# JWT HELPERS
# =============================================================================
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


# =============================================================================
# LAMBDA HANDLER (ROUTING)
# =============================================================================
def lambda_handler(event, context):

    # ── Normalize path & method ──────────────────────────────────────────────
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

    # ── CORS preflight ───────────────────────────────────────────────────────
    if http_method == "OPTIONS":
        return cors_response()

    # ── JWT verification ─────────────────────────────────────────────────────
    user, error = verify_token(event)
    if error:
        return response(401, {"error": error})

    try:
        # GET /addresses/{user_id}
        if (http_method == "GET"
                and len(path_parts) == 2
                and path_parts[0] == "addresses"):
            return get_addresses(path_parts[1], user)

        # POST /addresses/{user_id}
        if (http_method == "POST"
                and len(path_parts) == 2
                and path_parts[0] == "addresses"):
            body = parse_body(event)
            return add_address(path_parts[1], body, user)

        # PUT /addresses/{user_id}/{address_id}
        if (http_method == "PUT"
                and len(path_parts) == 3
                and path_parts[0] == "addresses"):
            body = parse_body(event)
            return update_address(path_parts[1], path_parts[2], body, user)

        # DELETE /addresses/{user_id}/{address_id}
        if (http_method == "DELETE"
                and len(path_parts) == 3
                and path_parts[0] == "addresses"):
            return delete_address(path_parts[1], path_parts[2], user)

        # PUT /addresses/{user_id}/{address_id}/default
        if (http_method == "PUT"
                and len(path_parts) == 4
                and path_parts[0] == "addresses"
                and path_parts[3] == "default"):
            return set_default_address(path_parts[1], path_parts[2], user)

        return response(404, {"error": "Route not found", "path": path})

    except Exception as e:
        print(f"[ERROR] Unhandled exception: {str(e)}")
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# ADDRESS OPERATIONS
# =============================================================================

def get_addresses(user_id, user):
    """GET /addresses/{user_id} — Return all addresses for a user."""

    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")

    if not item:
        return response(404, {"error": "User not found", "user_id": user_id})

    addresses = item.get("addresses", [])

    return response(200, {
        "user_id":   user_id,
        "count":     len(addresses),
        "addresses": addresses
    })


def add_address(user_id, body, user):
    """POST /addresses/{user_id} — Add a new address."""

    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    # ── Validate required fields ─────────────────────────────────────────────
    required = ["name", "phone", "line1", "city", "state", "pincode"]
    for field in required:
        if not body.get(field):
            return response(400, {"error": f"Missing required field: {field}"})

    # ── Validate phone ───────────────────────────────────────────────────────
    phone = str(body["phone"]).strip()
    if not phone.lstrip("+").isdigit() or len(phone.lstrip("+")) < 10:
        return response(400, {"error": "Invalid phone number"})

    # ── Validate pincode ─────────────────────────────────────────────────────
    pincode = str(body["pincode"]).strip()
    if not pincode.isdigit() or len(pincode) != 6:
        return response(400, {"error": "Pincode must be 6 digits"})

    # ── Fetch existing addresses ─────────────────────────────────────────────
    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")

    if not item:
        return response(404, {"error": "User not found"})

    existing_addresses = list(item.get("addresses", []))

    if len(existing_addresses) >= MAX_ADDRESSES:
        return response(400, {
            "error": f"Maximum {MAX_ADDRESSES} addresses allowed per user"
        })

    # ── Build new address ────────────────────────────────────────────────────
    is_first   = len(existing_addresses) == 0
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
        "is_default": body.get("is_default", is_first),  # first address = default
        "created_at": utc_now()
    }

    # ── If new address is default, unset others ──────────────────────────────
    if new_address["is_default"]:
        for addr in existing_addresses:
            addr["is_default"] = False

    existing_addresses.append(new_address)

    # ── Save back to DynamoDB ────────────────────────────────────────────────
    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": existing_addresses}
    )

    print(f"[INFO] Address added: user_id={user_id}, address_id={address_id}")

    return response(201, {
        "message":    "Address added successfully",
        "address_id": address_id,
        "address":    new_address
    })


def update_address(user_id, address_id, body, user):
    """PUT /addresses/{user_id}/{address_id} — Update an existing address."""

    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")

    if not item:
        return response(404, {"error": "User not found"})

    addresses = list(item.get("addresses", []))

    # ── Find the address ─────────────────────────────────────────────────────
    target_index = next(
        (i for i, a in enumerate(addresses) if a["address_id"] == address_id),
        None
    )

    if target_index is None:
        return response(404, {"error": "Address not found", "address_id": address_id})

    # ── Updatable fields ─────────────────────────────────────────────────────
    updatable = ["name", "phone", "line1", "line2", "city", "state", "pincode"]
    for field in updatable:
        if field in body and body[field] is not None:
            addresses[target_index][field] = str(body[field]).strip()

    addresses[target_index]["updated_at"] = utc_now()

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": addresses}
    )

    print(f"[INFO] Address updated: user_id={user_id}, address_id={address_id}")

    return response(200, {
        "message": "Address updated successfully",
        "address": addresses[target_index]
    })


def delete_address(user_id, address_id, user):
    """DELETE /addresses/{user_id}/{address_id} — Remove an address."""

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

    # ── If deleted address was default, assign default to first remaining ────
    if was_default and new_addresses:
        new_addresses[0]["is_default"] = True

    users_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET addresses = :addresses",
        ExpressionAttributeValues={":addresses": new_addresses}
    )

    print(f"[INFO] Address deleted: user_id={user_id}, address_id={address_id}")

    return response(200, {
        "message":    "Address deleted successfully",
        "address_id": address_id
    })


def set_default_address(user_id, address_id, user):
    """PUT /addresses/{user_id}/{address_id}/default — Set default address."""

    if user.get("role") != "admin" and user.get("userId") != user_id:
        return response(403, {"error": "Access denied"})

    result = users_table.get_item(Key={"userId": user_id})
    item   = result.get("Item")

    if not item:
        return response(404, {"error": "User not found"})

    addresses   = list(item.get("addresses", []))
    found       = False

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

    return response(200, {
        "message":    "Default address updated",
        "address_id": address_id
    })


# =============================================================================
# UTILITY HELPERS
# =============================================================================
def utc_now():
    return datetime.now(timezone.utc).isoformat()

def parse_body(event):
    try:
        raw_body = event.get("body") or "{}"
        if isinstance(raw_body, dict):
            return raw_body
        return json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return {}

def cors_response():
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": ""
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