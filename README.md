# Flashmart — 15-Minute Grocery Delivery App

A full-stack serverless e-commerce platform built with React and AWS — provisioned entirely via Terraform, featuring role-based access, 6 independent microservices, a feature-rich admin dashboard, structured observability, and automated tests.

🌐 **Live Demo:** https://d3kb5156to7tlk.cloudfront.net/

| Role  | Email           | Password |
|-------|-----------------|----------|
| User  | test@gmail.com  | 123456   |
| Admin | admin@gmail.com | admin    |

**Test Payment:** Select Net Banking → Bank of Baroda Retail at checkout. No real money is charged.

---

## ✨ Feature Overview

| Area | What's Built |
|------|-------------|
| 🔐 Auth | JWT login + registration, role-based routing (user / admin) |
| 🛍️ Shopping | Product catalog, category filters, search, out-of-stock handling |
| 🛒 Cart | Add / remove / update qty, free delivery progress bar, live order summary |
| 💳 Payments | Razorpay online, Cash on Delivery, POS on Delivery |
| 📦 Orders | Full lifecycle tracking, stock rollback on failed checkout |
| 👤 Profile | Order stats, address management, member card |
| ⚙️ Admin | 9-tab dashboard — products, orders, users, bulk add, image manager, logs |
| 📊 Observability | Structured logs, correlation IDs, CloudWatch metrics, alarms, dashboard |
| 🧪 Tests | pytest + moto unit tests, >80% coverage on payment & order services |
| 🏗️ IaC | Full AWS infrastructure managed via Terraform |

---

## 🔐 Authentication & Role-Based Access

Flashmart has a **single login page** that routes users into two completely different experiences based on their JWT role claim — no separate URLs, no separate apps.

```
         ┌─────────────────────────────┐
         │         Login Page          │
         │  email + password → JWT     │
         └──────────────┬──────────────┘
                        │  role decoded from token
          ┌─────────────┴──────────────┐
          │                            │
 ┌────────▼────────┐          ┌────────▼────────┐
 │   👤  USER      │          │   ⚙️  ADMIN     │
 │                 │          │                 │
 │ Product catalog │          │ Admin Dashboard │
 │ Search & filter │          │ Product CRUD    │
 │ Shopping cart   │          │ Bulk add (JSON) │
 │ Checkout        │          │ Image manager   │
 │ Order tracking  │          │ Order management│
 │ Address mgmt    │          │ User directory  │
 │ Profile page    │          │ Category mgmt   │
 │                 │          │ Live log viewer │
 └─────────────────┘          └─────────────────┘
```

**How it works:**
- On login, `auth_service` verifies credentials, signs a JWT containing `userId` and `role`, and returns it
- The frontend stores the token in `localStorage` and decodes the role to decide which page to render
- Every Lambda function calls `verify_token()` on each request — invalid or missing tokens return `401`
- Admin-only operations return `403` if the token role is not `admin`
- Registration always creates a `user` role — admin accounts are provisioned separately

---

## 🛍️ Shopping Experience

### Product Catalog
- Grid layout with product cards showing name, brand, price, unit, and stock status
- Category sidebar filter — tap a category to instantly narrow results
- Search bar filters by product name in real time
- Out-of-stock products show a disabled "Out of Stock" badge instead of Add to Cart
- Product detail page with full description, pricing, and quantity selector

### Cart
- Add items from any product card or detail page
- Quantity controls (+ / −) with live total recalculation
- Free delivery progress bar — shows how much more to spend to unlock free delivery
- Real-time order summary: subtotal, delivery fee, discount, final total
- Cart persists per user in DynamoDB — survives page refresh and re-login

### Checkout Flow
```
Cart → Select Address → Choose Payment Method → Confirm Order → Payment → Order Created
```
- Users must have at least one saved address to proceed
- Three payment options: Razorpay (online), Cash on Delivery, POS on Delivery
- On successful payment, order is created and cart is cleared
- On payment failure, stock is automatically rolled back

---

## 💳 Payment Service

Integrated with **Razorpay** in test mode.

**Flow:**
1. Frontend calls `POST /payments` → `payment_service` creates a Razorpay order and returns `razorpay_order_id`
2. Razorpay checkout modal opens in the browser
3. On payment success, frontend sends `razorpay_payment_id` + `razorpay_signature` to `POST /payments/verify`
4. `payment_service` verifies the HMAC signature — if valid, marks payment as `verified` and triggers order confirmation
5. If signature is invalid or payment fails, returns `400` and order_service rolls back stock

**Test Cases covered:**
- `test_initiate_payment_success` — valid order + amount → 201 with razorpay_order_id
- `test_initiate_payment_missing_fields` — missing body → 400
- `test_initiate_payment_zero_amount` — amount = 0 → 400
- `test_verify_payment_success` — valid signature → 200
- `test_verify_payment_invalid_signature` — bad sig → 400
- `test_get_payment_status_success` — owned payment → 200
- `test_get_payment_status_not_found` — unknown id → 404
- `test_get_payment_status_forbidden` — other user's payment → 403

---

## 📦 Order Management

### User-side
- Place orders from checkout
- Track order status in real time: **Placed → Confirmed → Shipped → Delivered**
- Cancel orders (only if still in Placed status)
- Full order history in the Orders page and summarised in the Profile page

### Order Resilience
Stock is decremented optimistically when an order is placed. If the payment step fails for any reason, `order_service` automatically issues a stock rollback — no manual intervention, no phantom inventory loss.

### Admin-side order control
Admins can advance any order through its lifecycle from the Orders tab. The status dropdown only shows **valid next states** — no accidental backwards transitions:

| Current Status | Can Transition To |
|---------------|-------------------|
| Placed | Confirmed, Cancelled |
| Confirmed | Shipped, Cancelled |
| Shipped | Delivered |
| Delivered | — |
| Cancelled | — |

---

## 👤 Profile Page

Accessible after login with three tabs in a sidebar layout:

**My Profile tab**
- Avatar (email initial), verified badge, member-since date
- Order stats grid — Total, Delivered, Processing, Placed, Cancelled (live from API)
- ⭐ Flashmart Member card
- Quick links to Profile Information and Manage Addresses

**Addresses tab**
- List all saved delivery addresses (name, phone, line1, city, state, pincode)
- Add new address form — validated and saved to DynamoDB via `address_service`

**My Orders tab**
- One-tap redirect to the full Orders page

Sidebar also includes logout button (clears localStorage and redirects to login) and a referral invite card.

---

## ⚙️ Admin Dashboard

Full control center with **9 tabs** — accessible only to admin role tokens.

### 📊 Overview Tab
The landing view gives a complete platform health snapshot at a glance:
- **5 stat cards** — Products, Users, Orders, Pending orders, Revenue (delivered orders only)
- **Low stock alert table** — products with stock ≤ 10, colour-coded (red = 0, amber = low)
- **Recent orders** — last 8 orders with status badges
- **Order status breakdown** — animated progress bars for all 5 statuses
- **Products by category** — count per category

### 📦 Products Tab
- Full paginated product table with inline editing
- **Search** by name or brand; **filter** by category or stock level (all / low ≤ 10 / out of stock)
- **Inline edit** — click Edit on any row to modify name, category, brand, price, stock in-place; Save or Cancel without leaving the tab
- **Activate / Deactivate** toggle — deactivated products are hidden from the customer catalog
- Stock value colour-coded: green (healthy), amber (≤ 10), red (0)

### 🧾 Orders Tab
- All orders across all users in a single table
- Admin updates order status via a **context-aware dropdown** — only valid next transitions are shown per order
- Colour-coded status badges

### 👥 Users Tab
- Full user directory — User ID, email, role badge (admin = amber, user = blue), join date

### ➕ Add Product Tab
- Single-product form: name, brand, price, stock, category (dropdown), unit (kg/g/L/ml/piece/pack/dozen/box), description, optional image URL

### 📋 Bulk Add Tab
- Paste a **JSON array** to add multiple products in one go
- Client-side validation checks all required fields before any API calls
- Per-row error reporting — `Row 3: missing price, unit`
- Shows detected product count live as you type
- Partial success reporting: `Added 18 products, 2 failed`
- Collapsible example JSON snippet

### 🖼️ Image Manager Tab
- Product list on the left with green/amber dots indicating image status
- Three ways to set an image:
  - **File upload** — drag or click, max 5MB, stored as base64
  - **Paste URL** — direct image URL
  - **Unsplash search** — type a query or use category-specific quick-pick tags (e.g. "fresh milk", "basmati rice")
- Live preview before saving

### 🏷️ Categories Tab
- All categories with product count
- Add new category inline (persists once a product is saved with it)
- Remove unused categories

### 🖥️ Logs Tab
- **Terminal-style dark UI** log viewer connected to `logs_service`
- Filter by level: INFO / WARN / ERROR / DEBUG
- Filter by service category
- Free-text search across message and user fields
- **Level counters** in filter bar (e.g. ERROR: 3, WARN: 12)
- Paginated — 50 logs per page with first / prev / next / last controls
- **Export** as `.log` (plain text), `.json`, or `.xlsx` (CSV with BOM for Excel)
- Refresh button to pull latest logs without reloading the page

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      User Browser                        │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼────────────────────────────────────┐
│               AWS CloudFront (CDN)                       │
│          https://d3kb5156to7tlk.cloudfront.net           │
└──────────┬───────────────────────────┬───────────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼──────────────────┐
│     S3 Bucket       │   │    API Gateway (HTTP API)      │
│  React + Vite SPA   │   │   /products  /cart  /orders   │
│  dev-flashmart-     │   │   /payments  /auth  /address  │
│  frontend           │   └────────────┬──────────────────┘
└─────────────────────┘                │
     ┌─────────────────────────────────┼────────────────────────┐
     │                  AWS Lambda (Python 3.12)                 │
     │  256MB · 30s timeout · structured JSON logs              │
     │  correlation IDs · role-based authorization              │
     │                                                          │
     │  auth_service    product_service    cart_service         │
     │  order_service   payment_service    address_service      │
     └─────────────────────────────────┬────────────────────────┘
                                       │
     ┌─────────────────────────────────▼────────────────────────┐
     │                    AWS DynamoDB                           │
     │  dev-flashmart-products  │  dev-flashmart-cart           │
     │  dev-flashmart-orders    │  dev-flashmart-payments       │
     └──────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────┐
     │  CloudWatch — log groups · metric filters · alarms       │
     │               · dashboard (8 rows)                       │
     │  IAM         — least-privilege per Lambda role           │
     └──────────────────────────────────────────────────────────┘
```

---

## 🧰 Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.1 | UI Framework |
| Vite | 5.4.10 | Build tool & dev server |
| Vitest | 4.1.4 | Unit testing |
| ESLint | 9.13.0 | Code linting |

### Backend
| Technology | Purpose |
|------------|---------|
| AWS Lambda (Python 3.12) | Serverless microservices |
| AWS API Gateway (HTTP API) | REST API routing |
| AWS DynamoDB | NoSQL database |
| PyJWT | JWT token signing & verification |
| Razorpay API | Payment gateway (test mode) |
| moto | DynamoDB mocking for unit tests |

### Infrastructure (Terraform)
| Resource | Detail |
|----------|--------|
| Region | ap-southeast-1 (Singapore) |
| S3 | dev-flashmart-frontend |
| DynamoDB | products, cart, orders, payments |
| Lambda | auth, product, cart, order, payment, address |
| API Gateway | Single HTTP API |
| CloudFront | CDN + HTTPS |
| CloudWatch | Dashboards, alarms, log groups, metric filters |

---

## 📊 Observability

All Lambda handlers emit structured JSON logs with a `correlation_id` per request, enabling full cross-service tracing in CloudWatch Logs Insights.

**Custom business metrics emitted from handlers:**

| Namespace | Metric | Trigger |
|-----------|--------|---------|
| FlashMart/Auth | LoginSuccess | `event = login_success` |
| FlashMart/Auth | LoginFailed | `event = login_failed` |
| FlashMart/Payments | PaymentSuccess | `event = payment_verified` |
| FlashMart/Payments | PaymentFailed | `event = payment_failed` |
| FlashMart/Orders | OrderPlaced | `event = order_placed` |

**Alarms:**

| Alarm | Threshold | Why |
|-------|-----------|-----|
| Lambda errors (all) | ≥ 3 / min | Core service health |
| Payment failures | ≥ 5 / 5 min | Business critical |
| Payment Lambda duration | avg > 10s | Perf SLA |
| Login failures | ≥ 10 / 5 min | Brute force detection |
| DynamoDB system errors | ≥ 1 / min per table | Infra failure |
| CloudFront 5xx rate | ≥ 5% | Frontend availability |

**Dashboard** — `dev-flashmart-dashboard` has 8 rows covering Lambda errors + duration, invocations + throttles, business metrics (payments / auth / orders), API Gateway requests + latency + errors, CloudFront requests + error rates + cache hit + origin latency, DynamoDB capacity + throttles + p99 latency, S3 request volume + errors, and a final alarm status panel.

---

## 🧪 Testing

Unit tests use **pytest + moto** — DynamoDB is fully mocked, no AWS credentials needed.

```bash
cd lambda_code/payment_service && python -m pytest test_payment.py -v
cd lambda_code/order_service   && python -m pytest test_order.py -v
```

**Payment service test coverage:**
- Token validation — missing token, invalid token
- `initiate_payment` — success (201), missing fields (400), zero amount (400)
- `verify_payment` — valid signature (200), invalid signature (400)
- `get_payment_status` — found + owned (200), not found (404), other user's record (403)

**Frontend:**
```bash
cd flashmart-frontend && npm run test
```

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, Python 3.12+, Terraform 1.5+, AWS CLI configured, Razorpay account

```bash
# 1. Clone
git clone https://github.com/rsDharshini/dharshini-flashmart-ecommerce.git
cd dharshini-flashmart-ecommerce

# 2. Configure
cp terraform.tfvars.example terraform.tfvars

# 3. Deploy infra
terraform init && terraform plan && terraform apply

# 4. Deploy frontend
cd flashmart-frontend && npm install && npm run build
aws s3 sync dist/ s3://dev-flashmart-frontend --delete

# 5. Invalidate CDN cache
aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_id) \
  --paths "/*"
```

---

## 🔑 Environment Variables

```hcl
aws_region          = "ap-southeast-1"
environment         = "dev"
project_name        = "flashmart"
lambda_runtime      = "python3.12"
lambda_timeout      = 30
lambda_memory       = 256
jwt_secret          = "your_jwt_secret"
razorpay_key_id     = "rzp_test_XXXXXXXXXX"
razorpay_key_secret = "your_razorpay_secret"
```

> ⚠️ Never commit `terraform.tfvars` — it's in `.gitignore`.

---

## 📡 API Endpoints

Base URL: `https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com`

| Method | Endpoint | Service | Auth |
|--------|----------|---------|------|
| POST | /auth/login | auth_service | None |
| POST | /auth/register | auth_service | None |
| GET | /products | product_service | User/Admin |
| GET | /products/{id} | product_service | User/Admin |
| POST | /products | product_service | Admin only |
| PUT | /products/{id} | product_service | Admin only |
| DELETE | /products/{id} | product_service | Admin only |
| GET/POST | /cart | cart_service | User |
| GET/POST | /orders | order_service | User/Admin |
| PATCH | /orders/{id} | order_service | Admin only |
| POST | /payments | payment_service | User |
| GET/POST | /address | address_service | User |

---

## 📁 Project Structure

```
flashmart-terraform/
├── flashmart-frontend/
│   └── src/
│       ├── components/
│       │   ├── Login.jsx · Register.jsx · Navbar.jsx
│       │   ├── ProductList.jsx · ProductCard.jsx · ProductDetail.jsx
│       │   ├── Cart.jsx · Checkout.jsx · Orders.jsx
│       │   └── Address.jsx · Profile.jsx · Admin.jsx · Toast.jsx
│       ├── api/          ← API call abstractions per service
│       └── utils/        ← auth helpers (getUserFromToken, etc.)
│
├── lambda_code/
│   ├── auth_service/     ← login, register, JWT issue
│   ├── product_service/  ← CRUD, stock management
│   ├── cart_service/     ← add/remove/update cart
│   ├── order_service/    ← place, track, cancel, stock rollback
│   ├── payment_service/  ← Razorpay integration, signature verify
│   └── address_service/  ← save/list delivery addresses
│
├── main.tf · variables.tf · outputs.tf
├── lambda.tf · apigateway.tf · dynamodb.tf
├── s3.tf · cloudfront.tf · iam.tf · cloudwatch.tf
└── terraform.tfvars.example
```

---

## 🔒 Security

- JWT tokens for stateless auth — role decoded server-side on every request
- Admin endpoints return `403` for non-admin tokens
- IAM least-privilege roles scoped per Lambda function
- HTTPS enforced end-to-end via CloudFront
- All secrets in `terraform.tfvars` — never hardcoded in source
- DynamoDB access restricted to Lambda IAM roles only

---

## 👩‍💻 Author

**Dharshini RS** · [@rsDharshini](https://github.com/rsDharshini)

Built with React 18, Python 3.12, and AWS Serverless — deployed via Terraform
