# InventAI — Smart Inventory Management System

**InventAI** is a web-based inventory management system that combines day-to-day inventory operations with machine-learning-powered demand forecasting and stock insights. The project includes a React frontend, a Node.js/Express API, and a Python FastAPI analytics service, with Supabase used for data storage.

## Features

- **Inventory and product management:** Manage products, stock levels, inventory movements, and product records.
- **Sales tracking:** Record and review sales data.
- **Demand forecasting:** Generate product-level demand predictions using an XGBoost-based ML pipeline.
- **Stock recommendations:** Calculate suggested stock quantities from forecast demand and product thresholds.
- **AI analytics:** Review insights such as potentially dead stock, trending products, safety thresholds, and recommendations.
- **Alerts:** Manage stock alerts, rules, and notifications.
- **Suppliers and procurement:** Manage suppliers, purchase orders, and receiving workflows.
- **Warehouse management:** Manage warehouse records and stock operations.
- **Barcode support:** Generate and use product barcodes for inventory workflows.
- **Staff management:** Manage employee details, attendance, work logs, and related records.
- **Reporting and data import:** Access reports and bulk-data workflows.
- **Authentication and activity logs:** User login and audit-related functionality.
- **Live updates:** Backend WebSocket support for real-time updates.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, JavaScript, React Router, Axios, Chart.js |
| Backend | Node.js, Express, WebSockets, JWT |
| ML / Analytics | Python, FastAPI, Pandas, NumPy, scikit-learn, XGBoost |
| Database | Supabase (PostgreSQL) |

## Project Structure

```text
FinalProject/
├── frontend/               # React + Vite application
│   ├── public/
│   └── src/
│       ├── components/
│       └── pages/
├── backend/                # Express API and WebSocket server
│   ├── config/
│   ├── routes/
│   ├── services/
│   └── scripts/            # Database setup and migration scripts
├── ml-service/             # FastAPI demand forecasting service
│   ├── main.py
│   ├── model.py
│   └── requirements.txt
└── .gitignore
```

## Prerequisites

- Node.js and npm (a recent version compatible with the project's Vite version)
- Python and pip
- A configured Supabase project and the required database tables
- Git (optional, for cloning the repository)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Project-CMPN-VESIT/2026-27-BE-023.git
cd 2026-27-BE-023
```

> If the application files are stored inside a `FinalProject` folder, enter it before running the commands below.

### 2. Configure environment variables

Create a `backend/.env` file:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_api_key
JWT_SECRET=replace_with_a_long_random_secret
PORT=5000
```

Create an `ml-service/.env` file:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_api_key
```

Certain database setup scripts also require `DB_PASSWORD` in `backend/.env` when used. **Never commit `.env` files or real credentials to GitHub.**

### 3. Run the backend

```bash
cd backend
npm install
node server.js
```

By default, the backend runs at `http://localhost:5000` and exposes routes under `/api`.

### 4. Run the ML service

Open a **new terminal**:

```bash
cd ml-service
python -m venv .venv
```

Activate the environment:

**Windows (PowerShell):**

```powershell
.venv\Scripts\Activate.ps1
```

**macOS / Linux:**

```bash
source .venv/bin/activate
```

Then install dependencies and start the service:

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

The ML service runs at `http://localhost:8001`. Its endpoints include `POST /predict` and `GET /analytics-insights`.

### 5. Run the frontend

Open **another terminal**:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

> The current frontend uses `http://localhost:5000/api` for backend requests, and the backend calls the ML service at `http://localhost:8001`. If you change ports or deploy the services, update these URLs accordingly.

## How the Forecasting Workflow Works

1. Sales records are retrieved from Supabase for the selected brand.
2. The ML service prepares date- and product-based features from historical sales.
3. An XGBoost-based model estimates product demand.
4. Recommended stock is calculated using predicted demand and the product's configured threshold.
5. Predictions are saved to Supabase and made available through the application.

The prediction endpoint requires sufficient sales history; when fewer than five sales records are available for the selected brand, it returns a message rather than generating predictions.

## Notes

- Supabase tables and database permissions must be configured before all features will work. Refer to the backend setup scripts under `backend/scripts/` and review them before execution.
- The repository's frontend includes a separate Vite starter `README.md`; this root README describes the full project.
- The application is configured for local development. Production deployment requires additional configuration and security review.
- Set a strong `JWT_SECRET` in the backend environment; do not rely on the fallback value present in the source code.

## Project Information

**Project:** InventAI — Smart Inventory Management System  
**Repository:** [Project-CMPN-VESIT / 2026-27-BE-023](https://github.com/Project-CMPN-VESIT/2026-27-BE-023)  
**Type:** Computer Engineering Capstone Project
