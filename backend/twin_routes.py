"""
The one-time (or repeated) upload flow: report in, digital twin out.
Steps: save file -> OCR -> LLM extraction -> validate -> guideline labels (RAG)
-> ML risk score + percentiles -> save as the twin.
"""
import uuid
import logging
import asyncio
from fastapi import APIRouter, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from azure.storage.blob import BlobServiceClient
import config
from extract import ocr_report, extract_from_csv, extract_values, validate_values
from rag.search import search_guidelines
from model.risk import predict_risk, percentiles
from db import save_twin, save_file_record, get_twin

logger = logging.getLogger(__name__)
router = APIRouter()

_blob = BlobServiceClient.from_connection_string(config.STORAGE_CONNECTION_STRING)

# Which guideline topic to search for, per value
TOPIC_QUERY = {
    "hba1c": "HbA1c glycemic goal target",
    "sbp": "blood pressure target for diabetes",
    "dbp": "blood pressure target for diabetes",
    "total_chol": "cholesterol LDL target with diabetes",
    "hdl": "cholesterol LDL target with diabetes",
    "bmi": "healthy weight BMI recommendation diabetes",
    "creatinine": "chronic kidney disease screening diabetes",
}


def _ensure_uploads_container():
    """Ensure the uploads container exists in Azure Blob Storage."""
    try:
        container_client = _blob.get_container_client("uploads")
        if not container_client.exists():
            container_client.create_container()
            logger.info("Created 'uploads' blob container")
    except Exception as e:
        logger.warning("Could not auto-create 'uploads' blob container: %s", e)


def label_value(field: str, value):
    """Agent 6 (labeling): compares one value to its guideline target via RAG."""
    if value is None or field not in TOPIC_QUERY:
        return {"status": "unknown", "note": "No guideline lookup for this field.", "source": None}

    passages = search_guidelines(TOPIC_QUERY[field], top=2)
    if not passages:
        return {"status": "unknown", "note": "I can't find this in the guidelines.", "source": None}

    from llm import ask_llm
    text = "\n\n".join(f"({p['source']}) {p['text']}" for p in passages)
    try:
        result = ask_llm(
            "Given a patient's value and a guideline passage, reply with ONLY a "
            "JSON object: {\"status\": \"at_goal\"|\"needs_attention\", \"note\": "
            "\"<one short sentence citing the passage>\"}",
            f"Field: {field}\nPatient value: {value}\nGuideline passage:\n{text}",
            json_mode=True,
        )
        if isinstance(result, dict):
            result["source"] = passages[0]["source"]
            return result
    except Exception as e:
        logger.warning("label_value failed for field %s: %s", field, e)

    return {"status": "unknown", "note": "Guideline evaluation unavailable.", "source": passages[0]["source"]}


@router.post("/twin/upload")
async def upload_twin(user_id: str, file: UploadFile):
    if not user_id or not user_id.strip():
        raise HTTPException(status_code=400, detail="user_id query parameter is required")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 15MB")

    # 1. Save original file to Azure Blob Storage asynchronously
    def _save_blob():
        _ensure_uploads_container()
        blob_name = f"{user_id}/{uuid.uuid4()}_{file.filename}"
        container = _blob.get_container_client("uploads")
        container.upload_blob(blob_name, file_bytes, overwrite=True)
        return blob_name

    try:
        blob_name = await asyncio.to_thread(_save_blob)
        save_file_record(user_id, file.filename, blob_name)
    except Exception as e:
        logger.exception("Failed to store uploaded blob in Azure Storage: %s", e)
        # Continue with processing even if blob archiving fails, or log warning

    # 2 + 3. OCR then LLM extraction
    filename = (file.filename or "").lower()
    try:
        if filename.endswith(".csv"):
            values = await asyncio.to_thread(extract_from_csv, file_bytes)
        else:
            text = await asyncio.to_thread(ocr_report, file_bytes, file.content_type)
            values = await asyncio.to_thread(extract_values, text)
    except Exception as e:
        logger.exception("Failed during document OCR/extraction: %s", e)
        raise HTTPException(
            status_code=422,
            detail=f"Could not extract clinical biomarkers from this document: {str(e)}"
        )

    # 4. Validate units/ranges (plain code, no medical judgment)
    values = validate_values(values)

    # 5+6. Label each value against the guidelines (RAG)
    def _compute_labels():
        return {field: label_value(field, val) for field, val in values.items()}

    labels = await asyncio.to_thread(_compute_labels)

    # 7. ML risk score + percentiles
    try:
        risk = await asyncio.to_thread(predict_risk, values)
        pct = await asyncio.to_thread(percentiles, values)
    except Exception as e:
        logger.warning("Risk calculation fallback: %s", e)
        risk = 0.5
        pct = {}

    twin = {
        "values": values,
        "labels": labels,
        "risk_poor_control": risk if risk is not None else 0.5,
        "percentiles": pct or {}
    }

    try:
        save_twin(user_id, twin)
    except Exception as e:
        logger.exception("Failed to persist twin to MongoDB: %s", e)
        raise HTTPException(status_code=500, detail="Database write error saving digital twin")

    return twin


@router.get("/twin/{user_id}")
def get_twin_route(user_id: str):
    twin = get_twin(user_id)
    if not twin:
        return JSONResponse(
            status_code=404,
            content={"error": "No twin found for this user. Upload a report first."}
        )
    return twin
