# Surplus Food Redistribution & Smart Hub Management Platform

An end-to-end full-stack web application designed for a 24-hour HackFest. The platform connects surplus food providers (restaurants, bakeries, hostel messes) with centralized collection hubs and verified NGOs using automated routing and IoT-enabled cold chain telemetry.

---

## 1. Project Overview & Architecture

### User Roles
1. **Food Provider**: Establishments (restaurants, bakeries, hostel messes) with edible surplus food ready for scheduled pickup.
2. **Hub Admin**: Regional collection hubs managing inbound collections, inventory staging, vehicle dispatches, and storage IoT conditions.
3. **NGO Partner**: Community relief organizations, shelters, and soup kitchens requesting food supplies from the hub.

### Core Logistics Workflows
- **Trip Type 1 (Inbound Collection)**: Food Provider &rarr; Smart Hub (aggregating surplus postings, route clustering).
- **Trip Type 2 (Outbound Distribution)**: Smart Hub &rarr; NGO Partner (inventory matching, scheduled dispatch, delivery confirmation).

```
 ┌────────────────────────┐
 │     Food Providers     │ (Restaurants, Bakeries, Messes)
 └───────────┬────────────┘
             │ Trip Type 1: Inbound Collection
             ▼
 ┌────────────────────────┐
 │   Central Smart Hub    │ (Cold Storage, IoT Telemetry, Inventory Staging)
 └───────────┬────────────┘
             │ Trip Type 2: Outbound Distribution
             ▼
 ┌────────────────────────┐
 │      NGO Partners      │ (Soup Kitchens, Shelters, Community Dining)
 └────────────────────────┘
```

---

## 2. Repository Structure

```text
surplus-food-platform/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts             # Axios client, baseURL, Bearer interceptors
│   │   │   └── auth.ts               # Typed auth & profile API calls
│   │   ├── components/
│   │   │   ├── common/               # Button, Input, Select, Card, Alert, Spinner, Badge
│   │   │   └── layout/
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx       # Auth state, login/logout, role checks
│   │   ├── layouts/
│   │   │   └── DashboardLayout.tsx   # Responsive portal layout with role indicators
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx       # Public landing page with 3 login cards
│   │   │   ├── auth/
│   │   │   │   ├── ProviderLoginPage.tsx
│   │   │   │   ├── ProviderSignupPage.tsx
│   │   │   │   ├── HubLoginPage.tsx
│   │   │   │   ├── NgoLoginPage.tsx
│   │   │   │   └── NgoSignupPage.tsx
│   │   │   ├── provider/
│   │   │   │   └── ProviderDashboard.tsx
│   │   │   ├── hub/
│   │   │   │   └── HubDashboard.tsx
│   │   │   ├── ngo/
│   │   │   │   └── NgoDashboard.tsx
│   │   │   ├── Unauthorized.tsx      # 403 Forbidden page
│   │   │   └── NotFound.tsx          # 404 Not Found page
│   │   ├── routes/
│   │   │   ├── AppRoutes.tsx         # Route registry
│   │   │   └── ProtectedRoute.tsx    # Role & token guard
│   │   ├── types/
│   │   │   └── auth.ts               # Shared TypeScript models
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                 # Tailwind CSS styles
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py               # get_db, get_current_user, require_role
│   │   │   └── routes/
│   │   │       ├── auth.py           # Provider/NGO signup, login, /me
│   │   │       ├── health.py         # App & DB health checks
│   │   │       ├── providers.py      # Provider profile endpoint
│   │   │       ├── hubs.py           # Hub admin profile endpoint
│   │   │       ├── ngos.py           # NGO profile endpoint
│   │   │       ├── donations.py      # Placeholder: Team Member 1 (Trip Type 1)
│   │   │       ├── trips.py          # Placeholder: Team Members 1 & 2
│   │   │       └── iot.py            # Placeholder: Team Member 3 (IoT ingestion)
│   │   ├── core/
│   │   │   ├── config.py             # Pydantic Settings
│   │   │   └── security.py           # Argon2 password hashing & JWT tokens
│   │   ├── db/
│   │   │   └── mongodb.py            # PyMongo lifespan manager & unique indexes
│   │   ├── models/
│   │   │   ├── user.py               # UserRole, ProviderType, UserInDB
│   │   │   └── common.py             # PyObjectId serialization
│   │   ├── schemas/
│   │   │   └── auth.py               # Request/response validation schemas
│   │   ├── services/
│   │   │   └── auth_service.py       # Auth logic & user provisioning
│   │   └── main.py                   # FastAPI app, CORS, lifespan, /api/v1 mounts
│   ├── create_hub_admin.py           # Secure CLI script to provision Hub Admin
│   ├── test_api.py                   # Automated API test suite
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
│
├── .gitignore
└── README.md
```

---

## 3. Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Axios, React Router DOM v6.
- **Backend**: Python 3.12, FastAPI, PyMongo, Pydantic v2, PyJWT, pwdlib (Argon2id password hashing).
- **Database**: MongoDB (Local or MongoDB Atlas).

---

## 4. Prerequisites

- **Node.js**: v18+ (tested on Node v22.13.0)
- **Python**: v3.10+ (tested on Python 3.12.4)
- **MongoDB**: Either local MongoDB server (`mongodb://localhost:27017`) or MongoDB Atlas URI (`mongodb+srv://...`).

---

## 5. Environment Configuration

### Backend Environment (`backend/.env`)
Copy the example file:
```bash
cp backend/.env.example backend/.env
```
Configuration variables:
```env
# MongoDB Connection (Local or Atlas)
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=surplus_food_platform

# JWT Configuration
JWT_SECRET_KEY=your_secure_random_jwt_secret_key_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Frontend CORS Origin
FRONTEND_ORIGIN=http://localhost:5173
```

### Frontend Environment (`frontend/.env`)
Copy the example file:
```bash
cp frontend/.env.example frontend/.env
```
Configuration variables:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

---

## 6. Backend Setup & Startup

1. Open a terminal in `backend/`:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Provision the initial **Hub Admin** account:
   ```bash
   python create_hub_admin.py --email hub.admin@surplusfood.org --password HubAdmin@2026
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Access interactive API documentation (Swagger UI):
   - Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 7. Frontend Setup & Startup

1. Open a terminal in `frontend/`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open the application: [http://localhost:5173](http://localhost:5173)

---

## 8. Authentication & Role-Based Access Control

### Role Entry Points & Dashboards
| Role | Login Route | Signup Route | Dashboard | Privileges |
| :--- | :--- | :--- | :--- | :--- |
| **Food Provider** | `/login/provider` | `/signup/provider` | `/provider/dashboard` | Post surplus listings, view collection status |
| **Hub Admin** | `/login/hub` | *CLI Only* | `/hub/dashboard` | Manage hub, view Trip 1 & 2, IoT telemetry |
| **NGO Partner** | `/login/ngo` | `/signup/ngo` | `/ngo/dashboard` | Browse hub inventory, request meals, track Trip 2 |

### Security Measures
- **Argon2 Password Hashing**: Passwords hashed with Argon2id; hashes never returned in API responses.
- **Account Enumeration Defense**: Login endpoint returns generic "Invalid email or password" error.
- **Strict Role Verification**: Login validates `expected_role` against the account's registered role in the database.
- **Backend RBAC Dependencies**: Role authorization enforced server-side via `require_role(role)` FastAPI dependencies.
- **Restricted Hub Provisioning**: Public signup endpoints cannot create `hub` accounts; provisioned only via `create_hub_admin.py`.

---

## 9. Team Module Ownership

This repository provides the foundational architecture for the 3 hackathon teammates:

- **Team Member 1 (Provider &rarr; Hub Collection Workflow)**:
  - Backend: `app/api/routes/donations.py` & collection clustering in `app/api/routes/trips.py`.
  - Frontend: Provider surplus listing form, collection schedule view on `/provider/dashboard`.
- **Team Member 2 (Hub &rarr; NGO Distribution Workflow)**:
  - Backend: Inventory staging in `app/api/routes/hubs.py`, meal requests in `app/api/routes/ngos.py`, dispatch trips in `app/api/routes/trips.py`.
  - Frontend: NGO inventory catalog, meal request workflow on `/ngo/dashboard`.
- **Team Member 3 (IoT Cold Chain & Monitoring)**:
  - Backend: IoT telemetry ingestion & time-series storage in `app/api/routes/iot.py`.
  - Frontend: Real-time sensor charts (temperature, humidity, spoilage gas) on `/hub/dashboard`.

---

## 10. Verification & Test Suite

Run the automated backend test suite:
```bash
python backend/test_api.py
```
This tests:
- Application and database health checks (`/health`, `/health/db`)
- Provider registration, Argon2 hashing, and login
- NGO registration and login
- Hub Admin login and profile access
- Role mismatch protection (401 and 403 Forbidden checks)
- Placeholder 501 Not Implemented responses for upcoming teammate modules
