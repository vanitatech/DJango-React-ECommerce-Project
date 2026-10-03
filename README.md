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
- Product list with search, filtering, and sorting
- Product detail page
- Customer reviews with one review per account and aggregate ratings
- Cart with quantity updates and removal
- Stock-aware inventory and checkout validation
- Protected checkout flow
- Order creation with validation and order history
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
/api/products/<id>/reviews/
```

## What I improved in this version

- Fixed broken JWT auth header handling in the frontend
- Hardened cart and order backend logic with validation
- Added better product filters and storefront polish
- Improved responsive product browsing experience
- Added SQLite fallback so local development works without a Postgres instance
- Added stock tracking, order history, and product reviews
- Strengthened the project story for portfolio and recruiter review

## Recommended next enhancements

- Add a customer profile page and order cancellation workflow
- Add payment integration
- Expand test coverage for authentication and frontend user journeys
- Add deployment config for Docker or AWS

## License

This project is intended for learning and portfolio use.
