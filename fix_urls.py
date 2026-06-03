import boto3

dynamodb = boto3.resource("dynamodb", region_name="ap-southeast-1")
table = dynamodb.Table("dev-flashmart-products")

OLD = "https://flashmart-product-images.s3.ap-southeast-1.amazonaws.com"
NEW = "https://d3kb5156to7tlk.cloudfront.net"

result = table.scan()
for item in result["Items"]:
    if item.get("image_url", "").startswith(OLD):
        new_url = item["image_url"].replace(OLD, NEW)
        table.update_item(
            Key={"id": item["id"]},
            UpdateExpression="SET image_url = :url",
            ExpressionAttributeValues={":url": new_url}
        )
        print(f"Updated: {item['id']}")

print("Done!")