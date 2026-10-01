# Full-Stack E-Commerce Application

A full-stack e-commerce application built with **React, Django REST Framework and PostgreSQL**. The project demonstrates user authentication, product management, shopping cart functionality and order creation through a REST API.

## Technologies

### Frontend

* React
* React Router
* JavaScript
* Tailwind CSS
* Vite

### Backend

* Python
* Django
* Django REST Framework
* Simple JWT

### Database & Tools

* PostgreSQL
* Git & GitHub
* VS Code
* Thunder Client
* AWS

## Features

* User registration and login
* JWT authentication
* Product and category browsing
* Product detail pages
* Shopping cart
* Add, remove and update cart items
* Real-time cart quantities and totals
* Protected checkout route
* Order creation
* PostgreSQL database integration
* RESTful API
* Environment variable configuration
* CORS configuration

## Project Structure

```text
DJango-React-ECommerce-Project/
│
├── backend/
│   ├── manage.py
│   ├── store/
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── ...
│
└── README.md
```

## Authentication

Authentication is implemented using **JSON Web Tokens (JWT)**.

The application provides:

* User registration
* Login
* Access tokens
* Refresh tokens
* Protected routes
* Authenticated API requests

Access and refresh tokens are managed by the frontend to allow authenticated users to access protected functionality.

## E-Commerce Functionality

The application includes a shopping cart allowing users to:

1. Browse products
2. View individual products
3. Add products to their cart
4. Change quantities
5. Remove products
6. View their cart total
7. Proceed to checkout
8. Create an order

The backend manages products, cart items, orders and order items using Django models and PostgreSQL.

## API

The Django REST Framework backend provides API endpoints for functionality including:

```text
/api/products/
/api/categories/
/api/cart/
/api/cart/add/
/api/cart/remove/
/api/cart/update/
/api/orders/create/
/api/register/
/api/token/
/api/token/refresh/
```

The React frontend communicates with these endpoints using HTTP requests and JSON data.

## Database

The application uses **PostgreSQL** as its relational database.

The database contains models for areas including:

* Products
* Categories
* Users
* User profiles
* Cart items
* Orders
* Order items

Django migrations are used to manage database schema changes.

## Development & Testing

During development I used **Thunder Client** and VS Code to test API endpoints and debug frontend/backend communication.

Testing and debugging focused on areas including:

* Authentication
* API requests
* Cart operations
* Database interactions
* Order creation
* Error handling

## Deployment

The application was also used as a practical exercise in deploying a Django/React application to **AWS**.

Deployment work included:

* Linux server configuration
* Python virtual environment
* Django configuration
* PostgreSQL
* Frontend production build
* Environment variables
* Web server/application configuration

## What I Learned

This project helped me develop practical experience with:

* Full-stack application architecture
* REST API development
* Django RES
