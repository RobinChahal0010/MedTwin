"""
The one-time (or repeated) upload flow: report in, digital twin out.
Steps: save file -> OCR -> LLM extraction -> validate -> guideline labels (RAG)
-> ML risk score + percentiles -> save as the twin.
"""
import uuid
from fastapi import APIRouter, UploadFile
from azure.storage.blob import BlobServiceClient
import config
from extract import ocr_report, extract_from_csv, extract_values, validate_values
from rag.search import search_guidelines
from model.risk import predict_risk, percentiles
from db import save_twin, save_file_record, get_twin

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


def label_value(field: str, value):
    """Agent 6 (labeling): compares one value to its guideline target via RAG."""
    if value is None or field not in TOPIC_QUERY:
        return {"status": "unknown", "note": "No guideline lookup for this field.", "source": None}

    passages = search_guidelines(TOPIC_QUERY[field], top=2)
    if not passages:
        return {"status": "unknown", "note": "I can't find this in the guidelines.", "source": None}

    from llm import ask_llm
    text = "\n\n".join(f"({p['source']}) {p['text']}" for p in passages)
    result = ask_llm(
        "Given a patient's value and a guideline passage, reply with ONLY a "
        "JSON object: {\"status\": \"at_goal\"|\"needs_attention\", \"note\": "
        "\"<one short sentence citing the passage>\"}",
        f"Field: {field}\nPatient value: {value}\nGuideline passage:\n{text}",
        json_mode=True,
    )
    result["source"] = passages[0]["source"]
    return result


@router.post("/twin/upload")
async def upload_twin(user_id: str, file: UploadFile):
    file_bytes = await file.read()

    # 1. Save the original file to Blob (kept for the record; never searched/RAG'd)
    blob_name = f"{user_id}/{uuid.uuid4()}_{file.filename}"
    _blob.get_container_client("uploads").upload_blob(blob_name, file_bytes, overwrite=True)
    save_file_record(user_id, file.filename, blob_name)

    # 2 + 3. OCR then LLM extraction (CSV skips straight to structured parsing)
    if file.filename.lower().endswith(".csv"):
        values = extract_from_csv(file_bytes)
    else:
        text = ocr_report(file_bytes)
        values = extract_values(text)

    # 4. Validate units/ranges (plain code, no medical judgment)
    values = validate_values(values)

    # 5+6. Label each value against the guidelines (RAG)
    labels = {field: label_value(field, val) for field, val in values.items()}

    # 7. ML risk score + percentiles
    risk = predict_risk(values)
    pct = percentiles(values)

    twin = {"values": values, "labels": labels, "risk_poor_control": risk, "percentiles": pct}
    save_twin(user_id, twin)
    return twin


@router.get("/twin/{user_id}")
def get_twin_route(user_id: str):
    twin = get_twin(user_id)
    return twin or {"error": "No twin found for this user. Upload a report first."}
