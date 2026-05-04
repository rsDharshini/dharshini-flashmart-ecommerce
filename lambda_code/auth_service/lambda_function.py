# =============================================================================
# lambda_function.py - Auth Service (Register + Login + Admin: List Users)
# =============================================================================

import json
import boto3
import hashlib
import uuid
import os
import jwt
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Attr

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-1")
auth_table = dynamodb.Table(os.environ["DYNAMODB_TABLE"])

STAGE_PREFIXES = ["/dev", "/prod", "/staging", "/v1", "/v2"]

def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    if method == "OPTIONS":
        return cors_response()

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

    try:
        # POST /auth/register
        if http_method == "POST" and path_parts == ["auth", "register"]:
            return register(parse_body(event))

        # POST /auth/login
        if http_method == "POST" and path_parts == ["auth", "login"]:
            return login(parse_body(event))

        # GET /auth/users — admin only
        if http_method == "GET" and path_parts == ["auth", "users"]:
            user, error = verify_token(event)
            if error:
                return response(401, {"error": error})
            if user.get("role") != "admin":
                return response(403, {"error": "Admin access required"})
            return get_all_users()

        return response(404, {"error": "Route not found", "path": path, "method": http_method})

    except Exception as e:
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# HANDLERS
# =============================================================================

def register(body):
    email = body.get("email")
    password = body.get("password")
    role = body.get("role", "user")

    if not email or not password:
        return response(400, {"error": "Email and password required"})

    user_id = str(uuid.uuid4())
    auth_table.put_item(Item={
        "userId": user_id,
        "email": email,
        "password": hash_password(password),
        "role": role,
        "addresses": [],
        "createdAt": utc_now()
    })

    return response(201, {"message": "User registered successfully", "userId": user_id})


def login(body):
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        return response(400, {"error": "Email and password required"})

    result = auth_table.scan(FilterExpression=Attr("email").eq(email))
    users = result.get("Items", [])
    user = users[0] if users else None

    if not user or user["password"] != hash_password(password):
        return response(401, {"error": "Invalid credentials"})

    token = jwt.encode({
        "userId": user["userId"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(hours=2)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return response(200, {
        "message": "Login successful",
        "token": token,
        "role": user["role"]
    })


def get_all_users():
    """GET /auth/users - Return all users (admin only), strips passwords."""
    result = auth_table.scan()
    users = []
    for u in result.get("Items", []):
        users.append({
            "userId": u["userId"],
            "email": u["email"],
            "role": u.get("role", "user"),
            "createdAt": u.get("createdAt", "")
        })
    users.sort(key=lambda u: u["createdAt"], reverse=True)
    return response(200, {"users": users, "count": len(users)})


# =============================================================================
# HELPERS
# =============================================================================

def verify_token(event):
    headers = event.get("headers", {})
    auth_header = headers.get("Authorization") or headers.get("authorization")
    if not auth_header:
        return None, "Missing token"
    try:
        token = auth_header.split(" ")[1]
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return decoded, None
    except Exception:
        return None, "Invalid token"


def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def parse_body(event):
    try:
        body = event.get("body") or "{}"
        return json.loads(body) if isinstance(body, str) else body
    except:
        return {}


def cors_response():
    return {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": ""
    }


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": json.dumps(body)
    }


def utc_now():
    return datetime.now(timezone.utc).isoformat()