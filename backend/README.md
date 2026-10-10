# Surplus Food Platform - Backend

FastAPI backend providing MongoDB persistence, Argon2 password hashing, JWT authentication, role-based access control, and modular routes for the HackFest team.

## Tech Stack
- Python 3.12+
- FastAPI
- PyMongo
- Pydantic v2 & Pydantic Settings
- PyJWT
- pwdlib / argon2-cffi

## Quickstart

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Set up `.env` from `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Provision the Hub Admin user:
   ```bash
   python create_hub_admin.py --email hub.admin@surplusfood.org --password HubAdmin@2026
   ```
4. Run tests:
   ```bash
   python test_api.py
   ```
5. Start dev server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
6. Open Swagger API documentation:
   [http://localhost:8000/docs](http://localhost:8000/docs)
