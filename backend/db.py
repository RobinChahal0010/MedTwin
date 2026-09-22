"""
One MongoDB connection, shared by the whole app. The Node.js auth service
uses the SAME MongoDB (same MONGODB_URI), so user_id values line up
between the two services without them ever calling each other.
"""
from pymongo import MongoClient
import config

_client = MongoClient(config.MONGODB_URI)
db = _client["medtwin"]

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
