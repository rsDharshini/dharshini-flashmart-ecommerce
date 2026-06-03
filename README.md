<div align="center">

# ⚡ Flashmart — 15-Minute Grocery Delivery

### *From Cart to Doorstep in 15 Minutes — A Cloud-Native Serverless E-Commerce Platform*

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-Visit%20Site-1a3c34?style=for-the-badge)](https://d3kb5156to7tlk.cloudfront.net/)
[![AWS](https://img.shields.io/badge/AWS-CloudFront%20%7C%20Lambda%20%7C%20DynamoDB-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![Terraform](https://img.shields.io/badge/Terraform-IaC-7B42BC?style=for-the-badge&logo=terraform&logoColor=white)](https://terraform.io/)
[![PyTest](https://img.shields.io/badge/PyTest-Tested-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org/)

---

**⚡ Built Fast. Deployed on AWS. Managed with Terraform. ⚡**

</div>

---

## 🌐 Live Demo

**URL:** https://d3kb5156to7tlk.cloudfront.net/

| Role  | Email           | Password |
|-------|-----------------|----------|
| User  | test@gmail.com  | 123456   |
| Admin | admin@gmail.com | admin    |

**Test Payment:** Select Net Banking → Bank of Baroda Retail. No real money charged.

---

## ✨ Features

| Area | What's Built |
|------|-------------|
| 🔐 Auth | JWT login + registration, role-based routing (user / admin) |
| 🛍️ Shopping | Product catalog, category filters, search, out-of-stock handling |
| 🛒 Cart | Add/remove/update qty, free delivery progress bar, live order summary |
| 💳 Payments | Razorpay online, Cash on Delivery, POS on Delivery |
| 📦 Orders | Placed → Confirmed → Shipped → Delivered, stock rollback on failure |
| 👤 Profile | Order stats, address management, member card |
| ⚙️ Admin | 9-tab dashboard — products, orders, users, bulk add, image manager, logs |
| 📊 Observability | Structured logs, correlation IDs, CloudWatch metrics + alarms + dashboard |
| 🧪 Tests | pytest + moto unit tests, >80% coverage |
| 🏗️ IaC | Full AWS infrastructure via Terraform |

---

## 🔐 Authentication & Role-Based Access

Single login page — routes into two completely different experiences based on the JWT role claim.

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

- JWT issued on login, stored in `localStorage`, role decoded client-side for routing
- Every Lambda verifies the token and `role` claim on each request
- Admin endpoints return `403` for user-role tokens
- Registration always creates `user` role — admin accounts provisioned separately

---

## 🛍️ Shopping

**Product Catalog**
- Grid of product cards with name, brand, price, unit, and stock status
- Category sidebar filter and real-time search bar
- Out-of-stock products show a disabled badge instead of Add to Cart
- Product detail page with full description, pricing, and quantity selector

**Cart**
- Add/remove items and adjust quantities with live total recalculation
- Free delivery progress bar showing how much more to unlock free delivery
- Real-time order summary — subtotal, delivery fee, discount, final total
- Cart persists per user in DynamoDB across page refreshes and re-logins

**Checkout**
`Cart → Select Address → Choose Payment → Confirm → Payment → Order Created`

On payment failure, stock is automatically rolled back.

---

## 💳 Payments

Integrated with **Razorpay** in test mode.

1. `POST /payments` → creates Razorpay order, returns `razorpay_order_id`
2. Razorpay modal opens in browser
3. On success, frontend sends `razorpay_payment_id` + `razorpay_signature` to verify
4. Lambda verifies HMAC signature — valid → order confirmed; invalid → stock rolled back

Three payment methods: **Razorpay online**, **Cash on Delivery**, **POS on Delivery**

---

## 📦 Orders

- Full lifecycle: **Placed → Confirmed → Shipped → Delivered**
- Cancel orders while still in Placed status
- Stock rolled back automatically on payment failure — no phantom inventory loss
- Full order history in Orders page and summarised in Profile

---

## 👤 Profile Page

Three-tab sidebar layout:

- **My Profile** — avatar, verified badge, member-since date, order stats grid (Total / Delivered / Processing / Placed / Cancelled), Flashmart Member card
- **Addresses** — view saved addresses, add new (name, phone, line1, city, state, pincode)
- **My Orders** — one-tap redirect to full Orders page

---

## ⚙️ Admin Dashboard

9-tab control center, admin-token only.

**📊 Overview** — stat cards (products, users, orders, pending, revenue), low stock alert table, recent orders, order status breakdown with progress bars, products by category count

**📦 Products** — full table with search + category + stock filters; inline edit (name, brand, price, stock, category in-row); activate/deactivate toggle

**🧾 Orders** — all orders across all users; context-aware status dropdown (only valid transitions shown)

| Current | Can Move To |
|---------|-------------|
| Placed | Confirmed, Cancelled |
| Confirmed | Shipped, Cancelled |
| Shipped | Delivered |
| Delivered / Cancelled | — |

**👥 Users** — full directory with ID, email, role badge, join date

**➕ Add Product** — single product form with all fields

**📋 Bulk Add** — paste a JSON array; validates all required fields, reports per-row errors, shows detected count before committing

**🖼️ Image Manager** — assign images via file upload (5MB), URL paste, or Unsplash search with category quick-pick tags; live preview before saving

**🏷️ Categories** — view with product counts, add inline, remove unused

**🖥️ Logs** — terminal-style dark UI; filter by level (INFO/WARN/ERROR/DEBUG), category, free-text; paginated (50/page); export as `.log`, `.json`, or `.xlsx`

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                      User Browser                        │
└─────────────────────┬────────────────────────────────────┘
                      │ HTTPS
┌─────────────────────▼────────────────────────────────────┐
│               AWS CloudFront (CDN)                       │
└──────────┬───────────────────────────┬───────────────────┘
           │                           │
┌──────────▼──────────┐   ┌────────────▼──────────────────┐
│  S3 — React SPA     │   │  API Gateway (HTTP API)        │
│  dev-flashmart-     │   │  /products /cart /orders       │
│  frontend           │   │  /payments /auth /address      │
└─────────────────────┘   └────────────┬──────────────────┘
                                       │
     ┌─────────────────────────────────┼────────────────────┐
     │              AWS Lambda (Python 3.12)                 │
     │  256MB · 30s · structured JSON logs · correlation IDs│
     │  auth · product · cart · order · payment · address   │
     └─────────────────────────────────┬────────────────────┘
                                       │
     ┌─────────────────────────────────▼────────────────────┐
     │                    AWS DynamoDB                       │
     │   products · cart · orders · payments                 │
     └──────────────────────────────────────────────────────┘
     ┌──────────────────────────────────────────────────────┐
     │  CloudWatch — logs · metric filters · alarms · dash  │
     │  IAM — least-privilege per Lambda                    │
     └──────────────────────────────────────────────────────┘
```

---

## 📊 Observability

All handlers emit structured JSON logs with a `correlation_id` per request.

**Custom CloudWatch metrics:**

| Namespace | Metric | Trigger |
|-----------|--------|---------|
| FlashMart/Auth | LoginSuccess / LoginFailed | login outcome |
| FlashMart/Payments | PaymentSuccess / PaymentFailed | payment outcome |
| FlashMart/Orders | OrderPlaced | order created |

**Alarms:**

| Alarm | Threshold |
|-------|-----------|
| Lambda errors (all) | ≥ 3 / min |
| Payment failures | ≥ 5 / 5 min |
| Payment Lambda duration | avg > 10s |
| Login failures | ≥ 10 / 5 min |
| DynamoDB system errors | ≥ 1 / min |
| CloudFront 5xx rate | ≥ 5% |

Dashboard (`dev-flashmart-dashboard`) — 8 rows: Lambda health, invocations + throttles, business metrics, API Gateway, CloudFront, DynamoDB, S3, alarm status panel.

---

## 🧪 Testing

pytest + moto — DynamoDB fully mocked, no AWS credentials needed.

```bash
cd lambda_code/payment_service && python -m pytest test_payment.py -v
cd lambda_code/order_service   && python -m pytest test_order.py -v
cd flashmart-frontend          && npm run test
```

Payment coverage: token validation, initiate (success/missing fields/zero amount), verify signature (valid/invalid), payment status (200/404/403).

---

## 🚀 Getting Started

```bash
git clone https://github.com/rsDharshini/dharshini-flashmart-ecommerce.git
cd dharshini-flashmart-ecommerce
cp terraform.tfvars.example terraform.tfvars        # fill in values

terraform init && terraform plan && terraform apply

cd flashmart-frontend && npm install && npm run build
aws s3 sync dist/ s3://dev-flashmart-frontend --delete

aws cloudfront create-invalidation \
  --distribution-id $(terraform output -raw cloudfront_id) --paths "/*"
```

---

## 🔑 Environment Variables

```hcl
aws_region = "ap-southeast-1"  environment = "dev"  project_name = "flashmart"
lambda_runtime = "python3.12"  lambda_timeout = 30  lambda_memory = 256
jwt_secret = "your_jwt_secret"
razorpay_key_id = "rzp_test_XXXXXXXXXX"  razorpay_key_secret = "your_secret"
```

> ⚠️ Never commit `terraform.tfvars` — already in `.gitignore`.

---

## 📡 API Endpoints

Base URL: `https://0nusevsdnb.execute-api.ap-southeast-1.amazonaws.com`

| Method | Endpoint | Auth |
|--------|----------|------|
| POST | /auth/login · /auth/register | None |
| GET | /products · /products/{id} | User/Admin |
| POST/PUT/DELETE | /products | Admin only |
| GET/POST | /cart · /orders · /address | User |
| PATCH | /orders/{id} | Admin only |
| POST | /payments | User |

---

## 📁 Project Structure

```
flashmart-terraform/
├── flashmart-frontend/src/
│   ├── components/   Login · Register · Navbar · ProductList · ProductCard
│   │                 ProductDetail · Cart · Checkout · Orders
│   │                 Address · Profile · Admin · Toast
│   ├── api/          API call abstractions per service
│   └── utils/        auth helpers (getUserFromToken etc.)
├── lambda_code/
│   ├── auth_service/      login, register, JWT
│   ├── product_service/   CRUD, stock management
│   ├── cart_service/      add/remove/update
│   ├── order_service/     place, track, cancel, rollback
│   ├── payment_service/   Razorpay, signature verify
│   └── address_service/   save/list addresses
├── main.tf · variables.tf · outputs.tf · lambda.tf
├── apigateway.tf · dynamodb.tf · s3.tf · cloudfront.tf
├── iam.tf · cloudwatch.tf · terraform.tfvars.example
```

---

## 🔒 Security

- JWT role decoded server-side on every request; admin endpoints reject user tokens with `403`
- IAM least-privilege per Lambda, HTTPS via CloudFront, secrets only in `terraform.tfvars`

---

## 👩‍💻 Author

**Dharshini RS** · [@rsDharshini](https://github.com/rsDharshini)

