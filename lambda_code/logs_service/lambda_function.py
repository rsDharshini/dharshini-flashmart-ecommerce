# =============================================================================
# lambda_function.py - Logs Service
# Receives frontend logs and stores them in DynamoDB
# =============================================================================

import json
import boto3
import os
from datetime import datetime, timezone, timedelta

# =============================================================================
# AWS SETUP
# =============================================================================
dynamodb   = boto3.resource("dynamodb", region_name="ap-southeast-1")
logs_table = dynamodb.Table(os.environ.get("LOGS_TABLE_NAME", "dev-flashmart-logs"))

# =============================================================================
# LAMBDA HANDLER
# =============================================================================
def lambda_handler(event, context):
    if "requestContext" in event and "http" in event.get("requestContext", {}):
        http_method = event["requestContext"]["http"]["method"].upper()
        path        = event.get("rawPath", "")
    else:
        http_method = event.get("httpMethod", "").upper()
        path        = event.get("path", "")

    if http_method == "OPTIONS":
        return response(200, {})

    path = path.rstrip("/")
    if path.startswith("/v1"):
        path = path[3:]
    path_parts = [p for p in path.split("/") if p]

    try:
        # POST /v1/logs        → ingest single or batch logs
        # GET  /v1/logs        → fetch all logs (admin)
        # GET  /v1/logs/stats  → summary stats (admin)
        # DELETE /v1/logs      → clear old logs (admin)

        if path_parts == ["logs"]:
            if http_method == "POST":
                return ingest_logs(event)
            elif http_method == "GET":
                return get_logs(event)
            elif http_method == "DELETE":
                return clear_old_logs(event)

        if path_parts == ["logs", "stats"]:
            if http_method == "GET":
                return get_stats(event)

        return response(404, {"error": "Route not found"})

    except Exception as e:
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# INGEST LOGS — POST /v1/logs
# Accepts a single log entry or a batch array
# =============================================================================
def ingest_logs(event):
    body = parse_body(event)

    # Support both single entry and batch: { logs: [...] } or single log object
    entries = body.get("logs") if isinstance(body.get("logs"), list) else [body]

    if not entries:
        return response(400, {"error": "No log entries provided"})

    if len(entries) > 100:
        return response(400, {"error": "Max 100 log entries per request"})

    saved = 0
    for entry in entries:
        if not entry.get("id") or not entry.get("level") or not entry.get("message"):
            continue  # skip malformed entries silently

        item = {
            "id":         entry["id"],
            "timestamp":  entry.get("timestamp", utc_now()),
            "level":      entry["level"],
            "category":   entry.get("category", "UNKNOWN"),
            "message":    entry["message"],
            "user":       entry.get("user", "anonymous"),
            "sessionId":  entry.get("sessionId", "unknown"),
            "ingested_at": utc_now(),
            # TTL: auto-delete logs after 30 days
            "ttl":        int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
        }

        # Store any extra meta fields (duration, status, error, etc.)
        skip_keys = {"id", "timestamp", "level", "category", "message", "user", "sessionId"}
        for k, v in entry.items():
            if k not in skip_keys:
                item[k] = v

        logs_table.put_item(Item=item)
        saved += 1

    return response(200, {"saved": saved})


# =============================================================================
# GET LOGS — GET /v1/logs?level=ERROR&user=x&limit=100&category=CART
# =============================================================================
def get_logs(event):
    query_params = event.get("queryStringParameters") or {}

    level    = query_params.get("level")
    user     = query_params.get("user")
    category = query_params.get("category")
    limit    = min(int(query_params.get("limit", 200)), 500)

    result = logs_table.scan()
    items  = result.get("Items", [])

    # Handle DynamoDB pagination
    while "LastEvaluatedKey" in result and len(items) < limit:
        result = logs_table.scan(ExclusiveStartKey=result["LastEvaluatedKey"])
        items.extend(result.get("Items", []))

    # Filter
    if level:
        items = [i for i in items if i.get("level") == level.upper()]
    if user:
        items = [i for i in items if user.lower() in i.get("user", "").lower()]
    if category:
        items = [i for i in items if i.get("category") == category.upper()]

    # Sort newest first
    items.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    items = items[:limit]

    return response(200, {"count": len(items), "logs": items})


# =============================================================================
# STATS — GET /v1/logs/stats
# =============================================================================
def get_stats(event):
    result = logs_table.scan()
    items  = result.get("Items", [])

    while "LastEvaluatedKey" in result:
        result = logs_table.scan(ExclusiveStartKey=result["LastEvaluatedKey"])
        items.extend(result.get("Items", []))

    stats = {
        "total": len(items),
        "by_level": {},
        "by_category": {},
        "by_user": {},
        "errors": []
    }

    for item in items:
        lvl = item.get("level", "UNKNOWN")
        cat = item.get("category", "UNKNOWN")
        usr = item.get("user", "anonymous")

        stats["by_level"][lvl]     = stats["by_level"].get(lvl, 0) + 1
        stats["by_category"][cat]  = stats["by_category"].get(cat, 0) + 1
        stats["by_user"][usr]      = stats["by_user"].get(usr, 0) + 1

        if lvl == "ERROR":
            stats["errors"].append({
                "timestamp": item.get("timestamp"),
                "category":  cat,
                "message":   item.get("message"),
                "user":      usr,
            })

    # Show only latest 50 errors
    stats["errors"] = sorted(stats["errors"], key=lambda x: x.get("timestamp", ""), reverse=True)[:50]

    return response(200, stats)


# =============================================================================
# CLEAR OLD LOGS — DELETE /v1/logs?days=7
# Deletes logs older than N days
# =============================================================================
def clear_old_logs(event):
    query_params = event.get("queryStringParameters") or {}
    days         = int(query_params.get("days", 7))
    cutoff       = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result  = logs_table.scan()
    items   = result.get("Items", [])
    deleted = 0

    for item in items:
        if item.get("timestamp", "") < cutoff:
            logs_table.delete_item(Key={"id": item["id"]})
            deleted += 1

    return response(200, {"deleted": deleted, "cutoff": cutoff})


# =============================================================================
# HELPERS
# =============================================================================
def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type":                 "application/json",
            "Access-Control-Allow-Origin":  "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        },
        "body": json.dumps(body, default=str)
    }

def parse_body(event):
    try:
        raw = event.get("body") or "{}"
        if isinstance(raw, dict):
            return raw
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}

def utc_now():
    return datetime.now(timezone.utc).isoformat()