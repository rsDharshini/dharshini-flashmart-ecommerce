# Flashmart — Serverless Grocery App 🛒

A complete serverless microservices application built on AWS.

## Architecture
React Frontend (S3 + CloudFront)
│
▼
API Gateway (HTTP API)
│
┌────┼────┐
▼    ▼    ▼
Product Cart Order
Lambda Lambda Lambda
│    │    │
▼    ▼    ▼
DynamoDB

## Services

| Service | Description |
|---------|-------------|
| Product Service | Manage products, stock, discounts |
| Cart Service | Add/remove items, manage cart |
| Order Service | Place orders, track status |

## Tech Stack

- **Frontend:** React + Vite
- **Backend:** AWS Lambda (Python 3.12)
- **API:** AWS API Gateway (HTTP API)
- **Database:** AWS DynamoDB
- **Storage:** AWS S3
- **CDN:** AWS CloudFront
- **IaC:** Terraform

## Project Structure
flashmart-terraform/
├── main.tf              # Provider config
├── dynamodb.tf          # DynamoDB tables
├── iam.tf               # IAM roles
├── lambda.tf            # Lambda functions
├── apigateway.tf        # API Gateway
├── s3.tf                # S3 frontend bucket
├── cloudfront.tf        # CloudFront CDN
├── variables.tf         # Variable definitions
├── outputs.tf           # Output values
├── lambda_code/         # Python Lambda code
│   ├── product_service/
│   ├── cart_service/
│   └── order_service/
└── flashmart-frontend/  # React frontend
├── src/
└── public/


## Setup Instructions

### Prerequisites
- Terraform >= 1.0.0
- AWS CLI configured
- Node.js >= 18

### Deploy Infrastructure

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/flashmart-terraform.git
cd flashmart-terraform

# 2. Copy and fill terraform vars
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 3. Initialize Terraform
terraform init

# 4. Deploy
terraform plan
terraform apply

# 5. Build and deploy frontend
cd flashmart-frontend
npm install
npm run build
cd ..
aws s3 sync flashmart-frontend/dist/ s3://dev-flashmart-frontend --delete
```

### API Endpoints





GET    /products              # Get all products
POST   /products              # Create product
GET    /products/{id}         # Get product by ID
POST   /cart/add              # Add to cart
GET    /cart/{user_id}        # Get cart
POST   /orders/place          # Place order
GET    /orders/{user_id}      # Get orders

## Live Demo

- **Frontend:** https://YOUR_CLOUDFRONT_URL.cloudfront.net
- **API:** https://YOUR_API_GATEWAY_URL.execute-api.ap-southeast-1.amazonaws.com

# Make sure you're in flashmart-terraform folder
cd flashmart-terraform

# Initialize git
git init

# Check what files will be tracked
git status