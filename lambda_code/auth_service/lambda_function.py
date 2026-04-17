# =============================================================================
# lambda_function.py - Auth Service (Register + Login)
# =============================================================================

# =============================================================================
# IMPORTS
# =============================================================================
import json
import boto3
import hashlib
import uuid
import os
import jwt
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Attr

# =============================================================================
# CONFIG
# =============================================================================
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

# =============================================================================
# DYNAMODB SETUP
# =============================================================================
dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-1")
auth_table = dynamodb.Table(os.environ["DYNAMODB_TABLE"])

# =============================================================================
# STAGE PREFIXES
# =============================================================================
STAGE_PREFIXES = ["/dev", "/prod", "/staging", "/v1", "/v2"]

# =============================================================================
# LAMBDA HANDLER (ROUTING)
# =============================================================================
def lambda_handler(event, context):

    # ── CORS Preflight ────────────────────────────────────────────────────────
    method = event.get("requestContext", {}).get("http", {}).get("method", "")

    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization"
            },
            "body": ""
        }

    # ── Detect API type & extract method/path ─────────────────────────────────
    if "requestContext" in event and "http" in event.get("requestContext", {}):
        http_method = event["requestContext"]["http"]["method"].upper()
        path = event.get("rawPath", "")
    else:
        http_method = event.get("httpMethod", "").upper()
        path = event.get("path", "")

    # Strip stage prefix
    for prefix in STAGE_PREFIXES:
        if path.startswith(prefix):
            path = path[len(prefix):]
            break

    # Normalize path
    path = path.rstrip("/")
    path_parts = [p for p in path.split("/") if p]

    try:
        # ── REGISTER ──────────────────────────────────────────────────────────
        if http_method == "POST" and path_parts == ["auth", "register"]:
            return register(parse_body(event))

        # ── LOGIN ─────────────────────────────────────────────────────────────
        if http_method == "POST" and path_parts == ["auth", "login"]:
            return login(parse_body(event))

        return response(404, {
            "error": "Route not found",
            "path": path,
            "method": http_method
        })

    except Exception as e:
        return response(500, {
            "error": "Internal server error",
            "message": str(e)
        })


# =============================================================================
# AUTH FUNCTIONS
# =============================================================================

def register(body):
    email = body.get("email")
    password = body.get("password")
    role = body.get("role", "user")

    if not email or not password:
        return response(400, {"error": "Email and password required"})

    user_id = str(uuid.uuid4())

    auth_table.put_item(
        Item={
            "userId": user_id,
            "email": email,
            "password": hash_password(password),
            "role": role,
            "addresses": [],
            "createdAt": utc_now()
        }
    )

    print(f"[INFO] Register success: user_id={user_id}, email={email}")

    return response(201, {
        "message": "User registered successfully",
        "userId": user_id
    })


def login(body):
    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        return response(400, {"error": "Email and password required"})

    # ── Scan with correct boto3 condition syntax ───────────────────────────────
    response_db = auth_table.scan(
        FilterExpression=Attr("email").eq(email)
    )

    users = response_db.get("Items", [])
    user = users[0] if users else None

    if not user:
        print(f"[WARN] Login failed: email={email}, reason=user_not_found")
        return response(401, {"error": "Invalid credentials"})

    if user["password"] != hash_password(password):
        print(f"[WARN] Login failed: email={email}, reason=invalid_password")
        return response(401, {"error": "Invalid credentials"})

    # ── JWT TOKEN ──────────────────────────────────────────────────────────────
    token = jwt.encode({
        "userId": user["userId"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(hours=2)
    }, JWT_SECRET, algorithm=JWT_ALGORITHM)

    print(f"[INFO] Login success: user_id={user['userId']}, email={email}")

    return response(200, {
        "message": "Login successful",
        "token": token,
        "role": user["role"]
    })


# =============================================================================
# HELPERS
# =============================================================================

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()


def parse_body(event):
    try:
        body = event.get("body") or "{}"
        return json.loads(body) if isinstance(body, str) else body
    except:
        return {}


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