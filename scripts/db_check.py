"""
Database Connectivity Diagnostic Tool for MedTwin
Tests MongoDB / Cosmos DB connection using the app's configuration settings.
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
root_dir = Path(__file__).resolve().parent.parent
load_dotenv(root_dir / ".env")

import pymongo
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, OperationFailure

def main():
    print("=" * 60)
    print("MedTwin MongoDB / DocumentDB Connection Check")
    print("=" * 60)

    # 1. Environment Variable Check
    raw_uri = os.getenv("DB_CONNECTION_STRING")
    print(f"1. Checking environment variable DB_CONNECTION_STRING...")
    if not raw_uri:
        print("❌ FAIL: DB_CONNECTION_STRING is missing or empty in .env!")
        return False
    
    # Redact password for safe printing
    import re
    safe_uri = re.sub(r":([^@]+)@", ":****@", raw_uri)
    print(f"   Found URI: {safe_uri}")

    # Check query params
    print("\n2. Checking connection string parameters...")
    if "retrywrites=false" not in raw_uri.lower():
        print("   ⚠️ Note: retrywrites=false is recommended for Azure Cosmos DB.")
    else:
        print("   ✅ retrywrites=false present.")

    if "tls=true" in raw_uri.lower() or "ssl=true" in raw_uri.lower():
        print("   ✅ TLS/SSL enabled in URI.")
    else:
        print("   ⚠️ Note: TLS is not explicitly enabled in URI.")

    # 3. Connection and Ping Test
    print("\n3. Attempting connection to MongoDB server (timeout: 8s)...")
    try:
        # Standard client matching db.py
        client = MongoClient(raw_uri, serverSelectionTimeoutMS=8000)
        # Force a network roundtrip using 'ping' command
        result = client.admin.command("ping")
        print(f"   ✅ PASS: Database responded to ping: {result}")
        
        # Test database and collection access
        db = client["medtwin"]
        collections = db.list_collection_names()
        print(f"   ✅ PASS: Connected to database 'medtwin'. Found collections: {collections}")
        print("\n🎉 Overall Status: SUCCESS — Database connection is fully operational.")
        return True

    except ServerSelectionTimeoutError as e:
        print("\n❌ FAIL: ServerSelectionTimeoutError (Connection Timed Out)")
        print(f"   Exact Reason: {e}")
        print("\n🔎 Root Cause Diagnostics:")
        print("   This is almost always caused by the Azure Cosmos DB / DocumentDB Firewall.")
        print("   Your local public IP address is NOT in the Azure Firewall allowlist.")
        print("   To fix:")
        print("   1. Open Azure Portal -> Go to your Azure Cosmos DB / DocumentDB cluster.")
        print("   2. Go to 'Networking' or 'Firewall and virtual networks'.")
        print("   3. Click 'Add current client IP address' or enable 'Allow public access from any IP' (for testing).")
        print("   4. Save and wait 1-2 minutes for the firewall rule to update.")
        return False

    except OperationFailure as e:
        print("\n❌ FAIL: OperationFailure (Authentication / Authorization Failed)")
        print(f"   Exact Reason: {e}")
        print("\n🔎 Root Cause Diagnostics:")
        print("   The server was reached, but credentials were rejected.")
        print("   Please check username, password, authMechanism, or database permissions in DB_CONNECTION_STRING.")
        return False

    except ConnectionFailure as e:
        print("\n❌ FAIL: ConnectionFailure (TLS / Network Handshake Failed)")
        print(f"   Exact Reason: {e}")
        print("\n🔎 Root Cause Diagnostics:")
        print("   Could be TLS negotiation failure, invalid certificates, or network drops.")
        return False

    except Exception as e:
        print(f"\n❌ FAIL: Unexpected error {type(e).__name__}: {e}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
