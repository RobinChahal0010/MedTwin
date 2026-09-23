"""
One MongoDB connection, shared by the whole app. The Node.js auth service
uses the SAME MongoDB (same MONGODB_URI), so user_id values line up
between the two services without them ever calling each other.
"""
import logging

from pymongo import MongoClient
import config

logger = logging.getLogger(__name__)


def _build_mongo_uri() -> str:
    raw_uri = (config.MONGODB_URI or "").strip()
    if not raw_uri:
        raise RuntimeError(
            "DB_CONNECTION_STRING is missing or empty. Set it in Azure App Service Configuration > Environment variables before starting the backend."
        )

    lowered = raw_uri.lower()
    if "cosmos" in lowered and "retrywrites=false" not in lowered:
        separator = "&" if "?" in raw_uri else "?"
        raw_uri = f"{raw_uri}{separator}retrywrites=false"
        logger.warning("Cosmos DB connection string did not include retrywrites=false; appended it automatically.")

    return raw_uri


try:
    _mongo_uri = _build_mongo_uri()
    _client = MongoClient(_mongo_uri, serverSelectionTimeoutMS=20000)
    db = _client["medtwin"]
except RuntimeError:
    raise
except Exception:
    logger.exception("MongoDB connection initialization failed using DB_CONNECTION_STRING")
    raise

# Collections
users = db.users            # managed by the Node auth service, read-only here
twins = db.twins            # this service owns this collection
files = db.files
chat_history = db.chat_history


def save_twin(user_id: str, twin: dict) -> None:
    """Create or overwrite this patient's digital twin."""
    twins.replace_one({"user_id": user_id}, {"user_id": user_id, **twin}, upsert=True)


def get_twin(user_id: str) -> dict | None:
    """Return the patient's twin, or None if they haven't uploaded anything yet."""
    return twins.find_one({"user_id": user_id}, {"_id": 0})


def save_file_record(user_id: str, filename: str, blob_name: str) -> None:
    files.insert_one({"user_id": user_id, "filename": filename, "blob_name": blob_name})


def log_chat(user_id: str, question: str, answer: str, confidence: float | None) -> None:
    chat_history.insert_one({
        "user_id": user_id, "question": question,
        "answer": answer, "confidence": confidence,
    })
