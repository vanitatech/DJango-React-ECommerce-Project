# VanitaCart

A polished full-stack e-commerce storefront built with Django REST Framework and React. This project is designed to showcase real-world product browsing, authentication, cart flows, and checkout logic in a portfolio-ready application.

## Why this project matters for a portfolio

This app demonstrates:

- Full-stack architecture across Django and React
- Secure JWT-based authentication flow
- Protected API endpoints and cart logic
- Product catalog UX with search, filtering, and sorting
- Cart state management and checkout workflow
- Modern frontend styling with Tailwind
- A deployable backend/frontend structure suitable for a job portfolio

## Tech stack

### Frontend
- React
- Vite
- React Router
- Tailwind CSS

### Backend
- Python
- Django
- Django REST Framework
- Django REST Framework Simple JWT

### Data and tooling
- SQLite for local development fallback
- PostgreSQL-ready configuration for production
- CORS configuration
- Environment variable support

## Features

- User signup and login
- JWT access and refresh token flow
- Product list with shareable search, category, stock, and review filters
- Quick add-to-cart actions on catalog cards with stock-aware feedback
- Product detail page
- Product image gallery with staff-managed image ordering
- Customer reviews with one review per account and aggregate ratings
- Cart with quantity updates, per-item totals, stock validation, and visible action errors
- Persistent guest cart and guest checkout with order confirmation and optional account creation
- Product-page quantity selection with stock-validated cart updates
- Stock-aware inventory and checkout validation
- Checkout with saved delivery-detail autofill for members and an order summary
- Stripe-hosted card checkout restricted to test-mode keys, with verified webhooks
- Order creation with validation and order history
- Customer profile management and processing-order cancellation
- Account wishlist with saved products across sessions
- Django admin inventory and order-status management
- Demo catalog seeding with distinct product imagery
- Responsive storefront UI for mobile and desktop

## Project structure

```text
DJango-React-ECommerce-Project/
├── backend/
│   ├── backend/
│   ├── store/
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── README.md
└── .gitignore
```

## Local development

Requirements: Python 3.10+ and Node.js 22.12+.

### 1) Backend

```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_store
python manage.py runserver
```

### Optional Stripe test checkout

Card checkout stays disabled unless both Stripe test-mode credentials are
configured. Add your `sk_test_...` key and the webhook signing secret to
`backend/.env`; never use a live key for local testing:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
FRONTEND_URL=http://localhost:5173
```

Install and authenticate the [Stripe CLI](https://docs.stripe.com/stripe-cli),
then forward test events to the local webhook:

```bash
stripe login
stripe listen --forward-to localhost:8000/api/payments/stripe/webhook/
```

Copy the `whsec_...` value printed by `stripe listen` into
`STRIPE_WEBHOOK_SECRET`, then restart Django. Use Stripe's documented test card
numbers in the hosted checkout; no live payment can be created by this app.
Stripe Checkout sessions reserve stock for 31 minutes. Verified completion
events mark orders paid; expiration releases the reserved stock.
Paid card orders cannot be cancelled through the standard cancellation endpoint
because a refund must be issued first.

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

The frontend expects a backend URL in `frontend/.env` (a template is provided at `frontend/.env.example`):

```env
VITE_DJANGO_BASE_URL=http://localhost:8000
```

## API overview

```text
/api/register/
/api/token/
/api/token/refresh/
/api/products/
/api/categories/
/api/cart/
/api/cart/add/
/api/cart/remove/
/api/cart/update/
/api/orders/create/
/api/orders/
/api/orders/payment-status/?session_id=<stripe-session-id>
/api/orders/<id>/cancel/
/api/payments/config/
/api/payments/stripe/webhook/
/api/profile/
/api/wishlist/
/api/wishlist/<product_id>/
/api/products/<id>/reviews/
# GET/POST/PATCH: public reviews, create a review, or edit your own review
```

## What I improved in this version

- Fixed broken JWT auth header handling in the frontend
- Hardened cart and order backend logic with validation
- Added better product filters and storefront polish
- Improved responsive product browsing experience
- Added SQLite fallback so local development works without a Postgres instance
- Added stock tracking, order history, and product reviews
- Added account contact details and safe order cancellation with inventory restoration
- Added a private, persistent wishlist for each customer account
- Strengthened the project story for portfolio and recruiter review

## Remaining roadmap

Multi-image product galleries and guest checkout are complete. Continue the
remaining customer-facing and quality phases before beginning admin order
management and content management:

1. **Continue storefront improvements** with customer-facing shopping and account
   flows.
2. **Implemented: Stripe Checkout in test mode** with signed webhook
   verification and inventory release on session expiry. A sandbox smoke test
   still requires the developer's own Stripe test credentials and Stripe CLI;
   live keys are explicitly rejected.
3. **Expand automated coverage** for authentication, APIs, and end-to-end
   customer journeys.
4. **Revisit deployment and CI** (Docker or a cloud deployment). This phase is
   deferred while the focus remains on improving the software itself.
5. **Complete: support multiple product images** with a browsable product
   gallery and manageable image ordering, while preserving each product’s
   existing primary image.
6. **Complete: add guest checkout** so customers can place orders without
   creating an account, with a persistent guest cart, clear order confirmation,
   and an optional account-creation path.
7. **Add admin order management and fulfilment tools** after the preceding
   planned phases. Scope includes a searchable order work queue, clear status
   transitions, fulfilment and tracking details, and visibility into order
   history.
8. **Add CMS capabilities** after the preceding planned phases, so authorized
   staff can manage pages and reusable content such as banners and page sections
   without editing frontend code. Define publishing and content-safety
   requirements as part of that phase.

## License

This project is intended for learning and portfolio use.
