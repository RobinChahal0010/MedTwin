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
SPEECH_REGION = os.getenv("SPEECH_REGION")

MONGODB_URI = os.getenv("DB_CONNECTION_STRING")

SELF_BASE_URL = os.getenv("SELF_BASE_URL", "http://localhost:8000")

REQUIRED = {
    "AZURE_OPENAI_ENDPOINT": AZURE_OPENAI_ENDPOINT,
    "AZURE_OPENAI_KEY": AZURE_OPENAI_KEY,
    "CHAT_DEPLOYMENT": CHAT_DEPLOYMENT,
    "MONGODB_URI": MONGODB_URI,
}


def check_config():
    """Call this once at startup so missing .env values fail loudly, not silently."""
    missing = [k for k, v in REQUIRED.items() if not v]
    if missing:
        raise RuntimeError(f"Missing required .env values: {missing}")