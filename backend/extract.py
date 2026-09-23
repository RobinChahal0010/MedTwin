"""
Turns an uploaded report into structured values.
Step 1 (OCR, no AI): Azure Document Intelligence reads the file into plain text.
Step 2 (LLM, text only): the model fills a fixed JSON schema from that text.
The LLM never sees the original file — only the OCR'd text.
"""
import json
import pandas as pd
from io import BytesIO
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
import config
from llm import ask_llm

import logging

logger = logging.getLogger(__name__)

_doc_client = DocumentIntelligenceClient(
    config.DOC_INTEL_ENDPOINT, AzureKeyCredential(config.DOC_INTEL_KEY)
)

TWIN_FIELDS = ["age", "sex", "bmi", "sbp", "dbp", "total_chol", "hdl",
               "creatinine", "hba1c", "insulin"]


def _detect_content_type(file_bytes: bytes, fallback: str = "application/pdf") -> str:
    """Infer MIME type from magic bytes if possible."""
    if file_bytes.startswith(b"%PDF"):
        return "application/pdf"
    elif file_bytes.startswith(b"\x89PNG"):
        return "image/png"
    elif file_bytes.startswith(b"\xff\xd8"):
        return "image/jpeg"
    elif file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP":
        return "image/webp"
    elif file_bytes.startswith(b"II*\x00") or file_bytes.startswith(b"MM\x00*"):
        return "image/tiff"
    return fallback or "application/pdf"


def ocr_report(file_bytes: bytes, content_type: str | None = None) -> str:
    """OCR only — returns the plain text/tables found in a PDF or image. No AI judgment."""
    resolved_type = _detect_content_type(file_bytes, fallback=content_type or "application/pdf")
    poller = _doc_client.begin_analyze_document(
        "prebuilt-layout", body=file_bytes, content_type=resolved_type
    )
    text = poller.result().content
    logger.debug("OCR extracted %d characters from document", len(text))
    return text


def extract_from_csv(file_bytes: bytes) -> dict:
    """CSV is already structured — skip OCR and the LLM entirely."""
    df = pd.read_csv(BytesIO(file_bytes))
    row = df.iloc[0].to_dict()
    return {field: row.get(field) for field in TWIN_FIELDS}


def extract_values(report_text: str) -> dict:
    """LLM turns OCR'd text into strict JSON. Never guesses a missing value."""
    prompt = (
        f"Extract these EXACT field names as a JSON object: {TWIN_FIELDS}\n"
        f"Use these exact lowercase keys, nothing else. Use null for anything "
        f"not present in the text. sex should be 1 for male, 2 for female. "
        f"Do not guess or invent numbers. Only use what is explicitly stated.\n\n"
        f"Report text:\n---\n{report_text}\n---"
    )
    result = ask_llm(
        "You extract medical values from text into JSON using EXACTLY the "
        "field names given. You never invent numbers.",
        prompt, json_mode=True,
    )
    logger.debug("Structured extraction completed")

    # Normalize keys (lowercase, strip spaces) in case the model varies casing
    normalized = {str(k).strip().lower(): v for k, v in result.items()}
    return {field: normalized.get(field) for field in TWIN_FIELDS}


def validate_values(values: dict) -> dict:
    """Plain-code sanity checks — no medical judgment, just unit/range fixes."""
    v = dict(values)

    # LLMs sometimes return numbers as strings (e.g. "148" instead of 148).
    # Coerce every numeric field so comparisons below don't crash.
    for field in TWIN_FIELDS:
        val = v.get(field)
        if val is not None and not isinstance(val, (int, float)):
            try:
                v[field] = float(val)
            except (TypeError, ValueError):
                v[field] = None  # couldn't parse it — treat as missing, don't guess

    # Example: convert HbA1c given as a fraction (0.084) rather than a percent (8.4)
    if v.get("hba1c") is not None and v["hba1c"] < 3:
        v["hba1c"] = v["hba1c"] * 100
    # Reject obviously impossible readings rather than silently keeping them
    ranges = {"sbp": (60, 260), "dbp": (30, 160), "bmi": (10, 80),
              "hba1c": (3, 20), "age": (0, 120)}
    for field, (lo, hi) in ranges.items():
        val = v.get(field)
        if val is not None and not (lo <= val <= hi):
            v[field] = None
    return v