#!/usr/bin/env python3
"""
CLI utility to securely provision the initial Hub Admin account.
This avoids having any public signup endpoint that could grant hub privileges.
"""

import argparse
from pathlib import Path
import sys

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from pymongo import MongoClient

from app.core.config import settings
from app.services.auth_service import AuthService



def main():
    parser = argparse.ArgumentParser(
        description="Provision a Hub Admin account for Surplus Food Redistribution Platform"
    )
    parser.add_argument(
        "--email",
        default="hub.admin@surplusfood.org",
        help="Email address for the hub admin",
    )
    parser.add_argument(
        "--password",
        default="HubAdmin@2026",
        help="Password for the hub admin",
    )
    parser.add_argument(
        "--org",
        default="Central Metro Collection Hub",
        help="Organization name for the hub",
    )
    parser.add_argument(
        "--contact",
        default="Alex Morgan",
        help="Contact person name",
    )
    parser.add_argument(
        "--phone",
        default="+1-555-0199",
        help="Phone number",
    )
    parser.add_argument(
        "--address",
        default="100 Logistics Way, Hub District, City",
        help="Hub physical address",
    )

    args = parser.parse_args()

    print(f"Connecting to MongoDB at: {settings.MONGODB_URI.split('@')[-1]}")
    client = MongoClient(settings.MONGODB_URI, serverSelectionTimeoutMS=5000)
    db = client[settings.MONGODB_DATABASE]

    try:
        client.admin.command("ping")
        print("MongoDB connection verified successfully.")
    except Exception as exc:
        print(f"Error: Unable to connect to MongoDB: {exc}", file=sys.stderr)
        sys.exit(1)

    print(f"Provisioning Hub Admin account: {args.email} ...")
    user = AuthService.create_or_update_hub_admin(
        db=db,
        email=args.email,
        password=args.password,
        organization_name=args.org,
        contact_name=args.contact,
        phone=args.phone,
        address=args.address,
    )

    print("\n[SUCCESS] Hub Admin successfully provisioned:")
    print(f"   ID:           {user.id}")
    print(f"   Email:        {user.email}")
    print(f"   Role:         {user.role.value}")
    print(f"   Organization: {user.organization_name}")
    print(f"   Contact:      {user.contact_name}")
    print(f"   Password:     {args.password} (stored as secure Argon2 hash)")
    print("\nYou can now log in at /login/hub using these credentials.\n")


if __name__ == "__main__":
    main()
