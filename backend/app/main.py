import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    donations,
    health,
    hubs,
    iot,
    ngos,
    providers,
    trips,
)
from app.core.config import settings
from app.db.mongodb import MongoDB

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing application resources...")
    try:
        MongoDB.connect()
        logger.info("Database connection successfully established.")
    except Exception as exc:
        logger.error("Could not connect to MongoDB during startup: %s", exc)
        # Note: We do not crash the app so health checks can still report DB status
    yield
    # Shutdown
    logger.info("Shutting down application resources...")
    MongoDB.close()


app = FastAPI(
    title="Surplus Food Redistribution & Smart Hub Management Platform",
    description="Full-stack API connecting surplus-food providers, collection hubs, and NGOs.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers under /api/v1
API_PREFIX = "/api/v1"
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(providers.router, prefix=API_PREFIX)
app.include_router(hubs.router, prefix=API_PREFIX)
app.include_router(ngos.router, prefix=API_PREFIX)
app.include_router(donations.router, prefix=API_PREFIX)
app.include_router(trips.router, prefix=API_PREFIX)
app.include_router(iot.router, prefix=API_PREFIX)


@app.get("/", tags=["Root"])
def root():
    return {
        "project": "Surplus Food Redistribution & Smart Hub Management Platform",
        "version": "1.0.0",
        "api_docs": "/docs",
        "api_prefix": API_PREFIX,
    }
