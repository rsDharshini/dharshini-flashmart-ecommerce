# 🛒 Flashmart — 15-Minute Grocery Delivery App

A full-stack serverless e-commerce platform for ultra-fast grocery delivery, built with React and AWS.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-green?style=for-the-badge)](https://d3kb5156to7tlk.cloudfront.net/)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange?style=for-the-badge&logo=amazonaws)](https://aws.amazon.com/)
[![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![Terraform](https://img.shields.io/badge/IaC-Terraform-purple?style=for-the-badge&logo=terraform)](https://www.terraform.io/)

---

## 🌐 Live Demo

**URL:** https://d3kb5156to7tlk.cloudfront.net/

### Test Credentials

| Role  | Email           | Password |
|-------|-----------------|----------|
| User  | test@gmail.com  | 123456   |
| Admin | admin@gmail.com | admin    |

### Test Payment (Razorpay Test Mode)

Select **Net Banking → Bank of Baroda Retail** at checkout. No real money is charged.

---

## ✨ Features

- ⚡ 15-minute delivery promise with live order tracking
- 🔐 JWT-based authentication (login & register)
- 🛍️ Product catalog with category filters, search, and out-of-stock handling
- 🛒 Cart with free delivery progress bar and real-time order summary
- 💳 Multiple payment options — Razorpay (online), Cash on Delivery, POS on Delivery
- 📦 Order tracking — Placed → Confirmed → Shipped → Delivered
- 👤 Admin panel for product and order management
- 📍 Save and manage delivery addresses

---

## 🏗️ Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              User Browser                    │
                        └─────────────────┬───────────────────────────┘
                                          │ HTTPS
                        ┌─────────────────▼───────────────────────────┐
                        │         AWS CloudFront (CDN)                 │
                        │     https://d3kb5156to7tlk.cloudfront.net   │
                        └────────┬────────────────────┬───────────────┘
                                 │                    │
               ┌─────────────────▼──┐      ┌──────────▼─────────────────┐
               │   S3 Bucket        │      │   API Gateway (HTTP API)    │
               │ React + Vite SPA   │      │  ap-southeast-1             │
               │ dev-flashmart-     │      │  /products /cart /orders    │
               │ frontend           │      │  /payments /auth /address   │
               └────────────────────┘      └──────────┬─────────────────┘
                                                      │
                    ┌─────────────────────────────────┼──────────────────────────┐
                    │                    AWS Lambda (Python 3.12)                 │
                    │  256MB memory / 30s timeout                                 │
                    │                                                             │
                    │  ┌─────────────────┐   ┌─────────────────┐                │
                    │  │  auth_service   │   │ product_service  │                │
                    │  │  JWT login /    │   │ CRUD, categories │                │
                    │  │  register       │   │ stock management │                │
                    │  └────────┬────────┘   └────────┬────────┘                │
                    │           │                     │                          │
                    │  ┌────────▼────────┐   ┌────────▼────────┐                │
                    │  │  cart_service   │   │  order_service  │                │
                    │  │  add / remove / │   │  place / track  │                │
                    │  │  update qty     │   │  cancel orders  │                │
                    │  └────────┬────────┘   └────────┬────────┘                │
                    │           │                     │                          │
                    │  ┌────────▼────────┐   ┌────────▼────────┐                │
                    │  │payment_service  │   │ address_service │                │
                    │  │ Razorpay API    │   │ save / manage   │                │
                    │  │ integration     │   │ addresses       │                │
                    │  └─────────────────┘   └─────────────────┘                │
                    └─────────────────────────────────┬──────────────────────────┘
                                                      │
                    ┌─────────────────────────────────▼──────────────────────────┐
                    │                     AWS DynamoDB                            │
                    │                                                             │
                    │  dev-flashmart-products  │  dev-flashmart-cart              │
                    │  dev-flashmart-orders    │  dev-flashmart-payments          │
                    └─────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────────────────┐
                    │  IAM (least-privilege roles)        
                    └─────────────────────────────────────────────────────────────┘
```

---

## 🧰 Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI Framework |
| Vite | 5.4.10 | Build tool & dev server |
| Vitest | 4.1.4 | Unit testing |
| ESLint | 9.13.0 | Code linting |

### Backend
| Technology | Purpose |
|-----------|---------|
| AWS Lambda (Python 3.12) | Serverless microservices |
| AWS API Gateway (HTTP API) | REST API routing |
| AWS DynamoDB | NoSQL database |
| PyJWT | JWT authentication |
| Razorpay API | Payment gateway (test mode) |

### Infrastructure (Terraform)
| Resource | Name |
|----------|------|
| Region | ap-southeast-1 (Singapore) |
| S3 Bucket | dev-flashmart-frontend |
| DynamoDB Tables | dev-flashmart-products, cart, orders, payments |
| Lambda Functions | dev-flashmart-product/cart/order/payment-service |
| API Gateway | Single HTTP API for all services |
| CloudFront | CDN with HTTPS |

---

## 📁 Project Structure

```
flashmart-terraform/
├── flashmart-frontend/           # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── ProductList.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   ├── ProductDetail.jsx
│   │   │   ├── Cart.jsx
│   │   │   ├── Checkout.jsx
│   │   │   ├── Orders.jsx
│   │   │   ├── Address.jsx
│   │   │   ├── Admin.jsx
│   │   │   └── Toast.jsx
│   │   ├── api/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── dist/                     # Production build → deployed to S3
│
├── lambda_code/                  # Python Lambda functions
│   ├── auth_service/
│   ├── product_service/
│   ├── cart_service/
│   ├── order_service/
│   ├── payment_service/
│   └── address_service/
│
├── main.tf
├── variables.tf
├── outputs.tf
├── lambda.tf
├── apigateway.tf
├── dynamodb.tf
├── s3.tf
├── cloudfront.tf
├── iam.tf
├── cloudwatch.tf
└── terraform.tfvars.example
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Python 3.12+
- Terraform 1.5+
- AWS CLI configured (`aws configure`)
- Razorpay account (test keys)

### 1. Clone the repository

```bash
git clone https://github.com/rsDharshini/dharshini-flashmart-ecommerce.git
cd dharshini-flashmart-ecommerce
```

### 2. Set up Terraform variables

```bash
cp terraform.tfvars.example terraform.tfvars
# Fill in your values — see terraform.tfvars.example for all required fields
```

### 3. Deploy AWS infrastructure

```bash
terraform init
terraform plan
terraform apply
```

### 4. Build and deploy frontend

```bash
cd flashmart-frontend
npm install
npm run build
aws s3 sync dist/ s3://dev-flashmart-frontend --delete
```

### 5. Invalidate CloudFront cache

```bash
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_id) \
  --paths "/*"
```

---

## 🧪 Running Tests

### Frontend

```bash
cd flashmart-frontend
npm run test
```

### Backend (Lambda)

```bash
cd lambda_code/order_service
python -m pytest test_order.py -v

cd lambda_code/payment_service
python -m pytest test_payment.py -v
```

---

## 🔑 Environment Variables

Copy `terraform.tfvars.example` and fill in your values:

```hcl
aws_region            = "ap-southeast-1"
environment           = "dev"
project_name          = "flashmart"
lambda_runtime        = "python3.12"
lambda_timeout        = 30
lambda_memory         = 256
jwt_secret            = "your_jwt_secret"
razorpay_key_id       = "rzp_test_XXXXXXXXXX"
razorpay_key_secret   = "your_razorpay_secret"
```

> ⚠️ Never commit your real `terraform.tfvars` to version control. It's already in `.gitignore`.

---

## 📡 API Endpoints

Base URL: `https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com`

| Method | Endpoint | Service |
|--------|----------|---------|
| POST | /auth/login | auth_service |
| POST | /auth/register | auth_service |
| GET | /products | product_service |
| GET | /products/{id} | product_service |
| GET/POST | /cart | cart_service |
| GET/POST | /orders | order_service |
| PATCH | /orders/{id} | order_service |
| POST | /payments | payment_service |
| GET/POST | /address | address_service |

---

## 🔒 Security

- JWT tokens for stateless, secure authentication
- IAM roles with least-privilege access per Lambda function
- HTTPS enforced end-to-end via CloudFront
- All secrets managed via `terraform.tfvars` (never hardcoded)
- DynamoDB access restricted to Lambda IAM roles only

---

## 👩‍💻 Author

**Dharshini RS**
- GitHub: [@rsDharshini](https://github.com/rsDharshini)

---

> Built with React 18, Python 3.12, and AWS Serverless — deployed via Terraform
