# =============================================================================
# lambda_function.py - Product Service with S3 Image Upload
# =============================================================================

import json
import uuid
import boto3
import base64
import logging
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb      = boto3.resource("dynamodb", region_name="ap-southeast-1")
product_table = dynamodb.Table("dev-flashmart-products")
s3_client     = boto3.client("s3", region_name="ap-southeast-1")

S3_BUCKET_NAME = "flashmart-product-images"
S3_BASE_URL    = f"https://{S3_BUCKET_NAME}.s3.ap-southeast-1.amazonaws.com"


def lambda_handler(event, context):
    if "requestContext" in event and "http" in event.get("requestContext", {}):
        http_method = event["requestContext"]["http"]["method"].upper()
        path        = event.get("rawPath", "")
    else:
        http_method = event.get("httpMethod", "").upper()
        path        = event.get("path", "")

    if http_method == "OPTIONS":
        return response(200, {})

    query_params = event.get("queryStringParameters") or {}
    path = path.rstrip("/")
    if path.startswith("/v1"):
        path = path[3:]
    path_parts = [p for p in path.split("/") if p]

    try:
        if http_method == "GET" and path_parts == ["products", "low-stock"]:
            return get_low_stock_products()

        if len(path_parts) == 1 and path_parts[0] == "products":
            if http_method == "GET":
                return get_all_products(query_params)
            elif http_method == "POST":
                return add_product(event)

        if len(path_parts) >= 2 and path_parts[0] == "products":
            product_id = path_parts[1]

            if len(path_parts) == 2:
                if http_method == "GET":
                    return get_product_by_id(product_id)
                elif http_method == "PUT":
                    return update_product(product_id, event)
                elif http_method == "DELETE":
                    return delete_product(product_id)

            if len(path_parts) == 3:
                action = path_parts[2]
                if http_method == "GET"  and action == "availability":   return check_availability(product_id)
                if http_method == "POST" and action == "deduct":         return deduct_stock(product_id, parse_body(event))
                if http_method == "POST" and action == "restock":        return restock_product(product_id, parse_body(event))
                if http_method == "POST" and action == "discount":       return apply_discount(product_id, parse_body(event))
                if http_method == "POST" and action == "upload-image":   return upload_product_image(product_id, event)

        return response(404, {"error": "Route not found", "path": path, "method": http_method})

    except Exception as e:
        logger.error(json.dumps({"event": "unhandled_exception", "error": str(e)}))
        return response(500, {"error": "Internal server error", "message": str(e)})


# =============================================================================
# PRODUCT OPERATIONS
# =============================================================================

def add_product(event):
    body = parse_body(event)
    required_fields = ["name", "description", "category", "brand", "price", "stock", "unit"]
    missing = [f for f in required_fields if f not in body or body[f] is None]
    if missing:
        return response(400, {"error": "Missing required fields", "fields": missing})

    try:
        price = float(body["price"]); stock = int(body["stock"])
    except (ValueError, TypeError):
        return response(400, {"error": "price must be numeric, stock must be integer"})

    if price < 0: return response(400, {"error": "Price cannot be negative"})
    if stock < 0: return response(400, {"error": "Stock cannot be negative"})

    for field in ["name", "description", "category", "brand", "unit"]:
        if not isinstance(body[field], str) or not body[field].strip():
            return response(400, {"error": f"Field '{field}' must be a non-empty string"})

    now = utc_now(); product_id = str(uuid.uuid4())
    image_url = body.get("image_url", "").strip()

    if "image" in body and body["image"]:
        uploaded_url = upload_image_to_s3(body["image"], product_id, body.get("image_content_type", "image/jpeg"))
        if uploaded_url:
            image_url = uploaded_url
        else:
            return response(500, {"error": "Image upload to S3 failed"})

    product = {
        "id": product_id, "name": body["name"].strip(), "description": body["description"].strip(),
        "category": body["category"].strip(), "brand": body["brand"].strip(),
        "price": str(round(price, 2)), "discount_percentage": "0.0",
        "final_price": str(round(price, 2)), "stock": stock,
        "unit": body["unit"].strip(), "image_url": image_url or "",
        "is_active": True, "created_at": now, "updated_at": now
    }
    product_table.put_item(Item=product)
    logger.info(json.dumps({"event": "product_created", "productId": product_id, "name": product["name"]}))
    return response(201, {"message": "Product created successfully", "product": deserialize_product(product)})


def upload_product_image(product_id, event):
    product = find_product(product_id)
    if not product:
        return response(404, {"error": "Product not found", "id": product_id})

    body = parse_body(event)
    if "image" not in body or not body["image"]:
        return response(400, {"error": "Missing required field: image (base64 encoded)"})

    image_url = upload_image_to_s3(body["image"], product_id, body.get("image_content_type", "image/jpeg"))
    if not image_url:
        return response(500, {"error": "Image upload to S3 failed"})

    product_table.update_item(
        Key={"id": product_id},
        UpdateExpression="SET #image_url = :image_url, #updated_at = :updated_at",
        ExpressionAttributeValues={":image_url": image_url, ":updated_at": utc_now()},
        ExpressionAttributeNames={"#image_url": "image_url", "#updated_at": "updated_at"}
    )
    logger.info(json.dumps({"event": "product_image_uploaded", "productId": product_id}))
    return response(200, {"message": "Image uploaded successfully", "product_id": product_id, "image_url": image_url})


def get_all_products(query_params):
    result   = product_table.scan(FilterExpression=Attr("is_active").eq(True))
    products = [deserialize_product(p) for p in result.get("Items", [])]

    if category := query_params.get("category"):
        products = [p for p in products if p["category"].lower() == category.lower()]

    if min_price := query_params.get("min_price"):
        try: products = [p for p in products if p["final_price"] >= float(min_price)]
        except ValueError: return response(400, {"error": "Invalid min_price value"})

    if max_price := query_params.get("max_price"):
        try: products = [p for p in products if p["final_price"] <= float(max_price)]
        except ValueError: return response(400, {"error": "Invalid max_price value"})

    return response(200, {"count": len(products), "products": products})


def get_product_by_id(product_id):
    product = find_product(product_id)
    if not product:
        return response(404, {"error": "Product not found", "id": product_id})
    return response(200, {"product": product})


def update_product(product_id, event):
    body    = parse_body(event)
    product = find_product(product_id)
    if not product:
        return response(404, {"error": "Product not found", "id": product_id})

    update_expr_parts = []; expr_attr_values = {}; expr_attr_names = {}
    price_changed = False

    for field in ["name", "description", "category", "brand"]:
        if field in body:
            if not isinstance(body[field], str) or not body[field].strip():
                return response(400, {"error": f"Field '{field}' must be a non-empty string"})
            update_expr_parts.append(f"#{field} = :{field}")
            expr_attr_values[f":{field}"] = body[field].strip()
            expr_attr_names[f"#{field}"]  = field

    if "price" in body:
        try: price = float(body["price"])
        except (ValueError, TypeError): return response(400, {"error": "Invalid price value"})
        if price < 0: return response(400, {"error": "Price cannot be negative"})
        update_expr_parts.append("#price = :price")
        expr_attr_values[":price"] = str(round(price, 2))
        expr_attr_names["#price"]  = "price"
        price_changed = True

    if "stock" in body:
        try: stock = int(body["stock"])
        except (ValueError, TypeError): return response(400, {"error": "Invalid stock value"})
        if stock < 0: return response(400, {"error": "Stock cannot be negative"})
        update_expr_parts.append("#stock = :stock")
        expr_attr_values[":stock"] = stock
        expr_attr_names["#stock"]  = "stock"

    if "is_active" in body:
        if not isinstance(body["is_active"], bool):
            return response(400, {"error": "is_active must be a boolean"})
        update_expr_parts.append("#is_active = :is_active")
        expr_attr_values[":is_active"] = body["is_active"]
        expr_attr_names["#is_active"]  = "is_active"

    if "image" in body and body["image"]:
        new_image_url = upload_image_to_s3(body["image"], product_id, body.get("image_content_type", "image/jpeg"))
        if new_image_url:
            update_expr_parts.append("#image_url = :image_url")
            expr_attr_values[":image_url"] = new_image_url
            expr_attr_names["#image_url"]  = "image_url"

    if price_changed:
        new_final = compute_final_price(expr_attr_values[":price"], float(product["discount_percentage"]))
        update_expr_parts.append("#final_price = :final_price")
        expr_attr_values[":final_price"] = str(new_final)
        expr_attr_names["#final_price"]  = "final_price"

    update_expr_parts.append("#updated_at = :updated_at")
    expr_attr_values[":updated_at"] = utc_now()
    expr_attr_names["#updated_at"]  = "updated_at"

    product_table.update_item(
        Key={"id": product_id},
        UpdateExpression="SET " + ", ".join(update_expr_parts),
        ExpressionAttributeValues=expr_attr_values,
        ExpressionAttributeNames=expr_attr_names
    )
    logger.info(json.dumps({"event": "product_updated", "productId": product_id}))
    return response(200, {"message": "Product updated successfully", "product": find_product(product_id)})


def delete_product(product_id):
    product = find_product(product_id)
    if not product:
        return response(404, {"error": "Product not found", "id": product_id})
    if not product["is_active"]:
        return response(409, {"error": "Product is already inactive", "id": product_id})

    product_table.update_item(
        Key={"id": product_id},
        UpdateExpression="SET #is_active = :is_active, #updated_at = :updated_at",
        ExpressionAttributeValues={":is_active": False, ":updated_at": utc_now()},
        ExpressionAttributeNames={"#is_active": "is_active", "#updated_at": "updated_at"}
    )
    logger.info(json.dumps({"event": "product_deleted", "productId": product_id}))
    return response(200, {"message": "Product deactivated successfully", "id": product_id})


def deduct_stock(product_id, body):
    product = find_product(product_id)
    if not product: return response(404, {"error": "Product not found", "id": product_id})
    if not product["is_active"]: return response(409, {"error": "Product is not active", "id": product_id})
    if "quantity" not in body: return response(400, {"error": "Missing required field: quantity"})

    try: quantity = int(body["quantity"])
    except (ValueError, TypeError): return response(400, {"error": "quantity must be a positive integer"})

    if quantity <= 0: return response(400, {"error": "quantity must be greater than 0"})
    if product["stock"] < quantity:
        return response(409, {"error": "Insufficient stock", "available_stock": product["stock"], "requested_quantity": quantity})

    new_stock = product["stock"] - quantity
    product_table.update_item(
        Key={"id": product_id},
        UpdateExpression="SET #stock = :stock, #updated_at = :updated_at",
        ExpressionAttributeValues={":stock": new_stock, ":updated_at": utc_now()},
        ExpressionAttributeNames={"#stock": "stock", "#updated_at": "updated_at"}
    )
    logger.info(json.dumps({"event": "stock_deducted", "productId": product_id, "quantity": quantity, "remainingStock": new_stock}))
    return response(200, {"message": "Stock deducted successfully", "product_id": product_id, "deducted": quantity, "remaining_stock": new_stock})


def restock_product(product_id, body):
    product = find_product(product_id)
    if not product: return response(404, {"error": "Product not found", "id": product_id})
    if "quantity" not in body: return response(400, {"error": "Missing required field: quantity"})

    try: quantity = int(body["quantity"])
    except (ValueError, TypeError): return response(400, {"error": "quantity must be a positive integer"})

    if quantity <= 0: return response(400, {"error": "quantity must be greater than 0"})

    new_stock = product["stock"] + quantity
    product_table.update_item(
        Key={"id": product_id},
        UpdateExpression="SET #stock = :stock, #updated_at = :updated_at",
        ExpressionAttributeValues={":stock": new_stock, ":updated_at": utc_now()},
        ExpressionAttributeNames={"#stock": "stock", "#updated_at": "updated_at"}
    )
    logger.info(json.dumps({"event": "stock_restocked", "productId": product_id, "quantity": quantity, "currentStock": new_stock}))
    return response(200, {"message": "Product restocked successfully", "product_id": product_id, "added": quantity, "current_stock": new_stock})


def apply_discount(product_id, body):
    product = find_product(product_id)
    if not product: return response(404, {"error": "Product not found", "id": product_id})
    if not product["is_active"]: return response(409, {"error": "Cannot apply discount to an inactive product"})
    if "discount_percentage" not in body: return response(400, {"error": "Missing required field: discount_percentage"})

    try: discount = float(body["discount_percentage"])
    except (ValueError, TypeError): return response(400, {"error": "discount_percentage must be a numeric value"})

    if discount < 0 or discount > 100:
        return response(400, {"error": "discount_percentage must be between 0 and 100"})

    final_price = compute_final_price(product["price"], discount)
    product_table.update_item(
        Key={"id": product_id},
        UpdateExpression="SET #dp = :dp, #fp = :fp, #ua = :ua",
        ExpressionAttributeValues={":dp": str(round(discount, 2)), ":fp": str(final_price), ":ua": utc_now()},
        ExpressionAttributeNames={"#dp": "discount_percentage", "#fp": "final_price", "#ua": "updated_at"}
    )
    logger.info(json.dumps({"event": "discount_applied", "productId": product_id, "discount": discount, "finalPrice": final_price}))
    return response(200, {"message": "Discount applied successfully", "product_id": product_id, "original_price": product["price"], "discount_percentage": round(discount, 2), "final_price": final_price})


def check_availability(product_id):
    product = find_product(product_id)
    if not product:
        return response(404, {"error": "Product not found", "id": product_id})
    available = product["is_active"] and product["stock"] > 0
    return response(200, {"product_id": product_id, "available": available, "stock": product["stock"], "is_active": product["is_active"]})


def get_low_stock_products():
    LOW_STOCK_THRESHOLD = 5
    result   = product_table.scan(FilterExpression=Attr("is_active").eq(True) & Attr("stock").lt(LOW_STOCK_THRESHOLD))
    products = [deserialize_product(p) for p in result.get("Items", [])]
    logger.info(json.dumps({"event": "low_stock_checked", "count": len(products)}))
    return response(200, {"threshold": LOW_STOCK_THRESHOLD, "count": len(products), "products": products})


# =============================================================================
# S3 IMAGE UPLOAD
# =============================================================================

def upload_image_to_s3(image_data, product_id, content_type="image/jpeg"):
    try:
        if "," in image_data:
            image_data = image_data.split(",")[1]
        image_bytes = base64.b64decode(image_data)
        extension   = {"image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}.get(content_type.lower(), ".jpg")
        file_name   = f"products/{product_id}/{uuid.uuid4()}{extension}"
        s3_client.put_object(Bucket=S3_BUCKET_NAME, Key=file_name, Body=image_bytes, ContentType=content_type)
        return f"{S3_BASE_URL}/{file_name}"
    except Exception as e:
        logger.error(json.dumps({"event": "s3_upload_failed", "productId": product_id, "error": str(e)}))
        return None


# =============================================================================
# HELPERS
# =============================================================================

def find_product(product_id):
    result = product_table.get_item(Key={"id": product_id})
    item   = result.get("Item")
    return deserialize_product(item) if item else None


def deserialize_product(item):
    return {
        "id": item["id"], "name": item["name"], "description": item["description"],
        "category": item["category"], "brand": item["brand"],
        "price": float(item["price"]), "discount_percentage": float(item["discount_percentage"]),
        "final_price": float(item["final_price"]), "stock": int(item["stock"]),
        "unit": item["unit"], "image_url": item.get("image_url", ""),
        "is_active": bool(item["is_active"]), "created_at": item["created_at"], "updated_at": item["updated_at"]
    }


def compute_final_price(price, discount_percentage):
    return round(float(price) - float(price) * (float(discount_percentage) / 100), 2)


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization"},
        "body": json.dumps(body, default=str)
    }


def parse_body(event):
    try:
        raw_body = event.get("body") or "{}"
        return raw_body if isinstance(raw_body, dict) else json.loads(raw_body)
    except (json.JSONDecodeError, TypeError):
        return {}


def utc_now():
    return datetime.now(timezone.utc).isoformat()