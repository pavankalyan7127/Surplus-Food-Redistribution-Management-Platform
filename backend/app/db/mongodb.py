import logging
from typing import Optional
from pymongo import ASCENDING, MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, PyMongoError

from app.core.config import settings

logger = logging.getLogger("app.db.mongodb")


class MongoDB:
    client: Optional[MongoClient] = None
    db: Optional[Database] = None

    @classmethod
    def connect(cls) -> None:
        """Initialize MongoDB client and ensure indexes."""
        try:
            # Ensure reliable DNS resolution for mongodb+srv on Windows
            try:
                import dns.resolver
                sys_res = dns.resolver.Resolver()
                ns_candidates = []
                for ip in list(sys_res.nameservers) + ['8.8.8.8', '1.1.1.1']:
                    if ip not in ns_candidates:
                        ns_candidates.append(ip)
                res = dns.resolver.Resolver(configure=False)
                res.nameservers = ns_candidates
                res.timeout = 2.0
                res.lifetime = 4.0
                dns.resolver.default_resolver = res
            except Exception:
                pass

            logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URI.split("@")[-1])
            cls.client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=20000,
                connectTimeoutMS=20000,
            )
            # Verify connectivity
            cls.client.admin.command("ping")
            cls.db = cls.client[settings.MONGODB_DATABASE]
            logger.info("Connected to database: %s", settings.MONGODB_DATABASE)

            # Ensure unique index on normalized email in users collection
            cls._init_indexes()
        except ConnectionFailure as exc:
            logger.error("Failed to connect to MongoDB: %s", exc)
            cls.db = None
            raise exc
        except Exception as exc:
            logger.error("Unexpected error initializing MongoDB: %s", exc)
            cls.db = None
            raise exc

    @classmethod
    def _init_indexes(cls) -> None:
        """Create required indexes."""
        if cls.db is not None:
            try:
                # Unique index on normalized email
                cls.db.users.create_index(
                    [("email", ASCENDING)],
                    unique=True,
                    name="unique_user_email"
                )
                logger.info("Ensured unique index on users.email")

                # Indexes on incoming_donations
                cls.db.incoming_donations.create_index([("hubId", ASCENDING), ("status", ASCENDING)])
                cls.db.incoming_donations.create_index([("providerId", ASCENDING)])
                cls.db.incoming_donations.create_index([("pickupRunId", ASCENDING)])

                # Indexes on vehicles
                cls.db.vehicles.create_index([("owned_by_hub_ID", ASCENDING), ("isFree", ASCENDING)])

                # Indexes on pickup_runs
                cls.db.pickup_runs.create_index([("hub_id", ASCENDING), ("simulation_status", ASCENDING)])

                # Indexes on inventory (with unique constraint on original_donation_id)
                cls.db.inventory.create_index(
                    [("original_donation_id", ASCENDING)],
                    unique=True,
                    name="unique_original_donation_id"
                )
                cls.db.inventory.create_index([("hub_id", ASCENDING), ("status", ASCENDING)])
                cls.db.inventory.create_index([("provider_id", ASCENDING)])
                cls.db.inventory.create_index([("created_at", ASCENDING)])
            except Exception as e:
                logger.warning("Could not create indexes on database collections: %s", e)

    @classmethod
    def close(cls) -> None:
        """Close MongoDB connection."""
        if cls.client:
            logger.info("Closing MongoDB connection.")
            cls.client.close()
            cls.client = None
            cls.db = None

    @classmethod
    def ping(cls) -> bool:
        """Health check ping."""
        if not cls.client:
            return False
        try:
            cls.client.admin.command("ping")
            return True
        except PyMongoError:
            return False


def get_db() -> Database:
    """Dependency that returns the database instance."""
    if MongoDB.db is None:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection is not available"
        )
    return MongoDB.db
