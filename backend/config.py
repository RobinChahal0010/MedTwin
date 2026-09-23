"""
Loads every setting from .env in one place, so nothing else in the app
calls os.getenv() directly. Import what you need from here.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# .env lives at the project root (MedTwin/.env), one level above this folder
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY")
CHAT_DEPLOYMENT = os.getenv("CHAT_DEPLOYMENT")
EMBED_DEPLOYMENT = os.getenv("EMBED_DEPLOYMENT")

SEARCH_ENDPOINT = os.getenv("SEARCH_ENDPOINT", "").strip()
SEARCH_INDEX = os.getenv("SEARCH_INDEX", "guidelines-index")
SEARCH_QUERY_KEY = os.getenv("SEARCH_QUERY_KEY")

STORAGE_CONNECTION_STRING = os.getenv("STORAGE_CONNECTION_STRING")

DOC_INTEL_ENDPOINT = os.getenv("DOC_INTEL_ENDPOINT")
DOC_INTEL_KEY = os.getenv("DOC_INTEL_KEY")

SPEECH_KEY = os.getenv("SPEECH_KEY")
# Strip whitespace — .env value was "  " (two spaces) which broke the SDK
SPEECH_REGION = (os.getenv("SPEECH_REGION") or "").strip()

MONGODB_URI = os.getenv("DB_CONNECTION_STRING")

# DEV_MODE: set to "true" in local development to allow localhost CORS origins.
DEV_MODE = os.getenv("DEV_MODE", "false").lower() in ("1", "true", "yes")

# All values that must be present for the app to function.
# check_config() is called at startup BEFORE importing any route module that
# does module-level client initialization (e.g. BlobServiceClient, DocumentIntelligenceClient).
REQUIRED = {
    "AZURE_OPENAI_ENDPOINT": AZURE_OPENAI_ENDPOINT,
    "AZURE_OPENAI_KEY": AZURE_OPENAI_KEY,
    "CHAT_DEPLOYMENT": CHAT_DEPLOYMENT,
    "MONGODB_URI": MONGODB_URI,
    "STORAGE_CONNECTION_STRING": STORAGE_CONNECTION_STRING,
    "DOC_INTEL_ENDPOINT": DOC_INTEL_ENDPOINT,
    "DOC_INTEL_KEY": DOC_INTEL_KEY,
    "SPEECH_KEY": SPEECH_KEY,
    "SPEECH_REGION": SPEECH_REGION,
    "SEARCH_QUERY_KEY": SEARCH_QUERY_KEY,
}


def check_config():
    """Call this once at startup so missing .env values fail loudly, not silently."""
    missing = [k for k, v in REQUIRED.items() if not v]
    if missing:
        raise RuntimeError(f"Missing required .env values: {missing}")