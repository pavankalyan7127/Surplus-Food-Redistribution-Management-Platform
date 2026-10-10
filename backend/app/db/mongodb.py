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
            logger.info("Connecting to MongoDB at %s...", settings.MONGODB_URI.split("@")[-1])
            cls.client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
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
            except Exception as e:
                logger.warning("Could not create indexes on users: %s", e)

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
