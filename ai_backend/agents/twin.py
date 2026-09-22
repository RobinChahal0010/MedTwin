"""
Agent 2: Twin loader. Job: fetch this patient's saved profile (values,
guideline labels, risk score, percentiles) from MongoDB and attach it
to the state so every later agent can see it.
"""
import httpx
from fastapi import APIRouter
import config
from db import get_twin

router = APIRouter()


@router.post("/agents/twin")
def twin(state: dict):
    patient_twin = get_twin(state["user_id"])
    if patient_twin is None:
        return {"answer": "I don't have any health data for you yet — please upload a report first.",
                "sources": [], "confidence": None}

    state["twin"] = patient_twin
    resp = httpx.post(f"{config.SELF_BASE_URL}/agents/knowledge", json=state, timeout=60)
    return resp.json()
