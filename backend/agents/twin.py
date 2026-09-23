"""
Agent 2: Twin loader. Job: fetch this patient's saved profile (values,
guideline labels, risk score, percentiles) from MongoDB and attach it
to the state so every later agent can see it.
"""
from fastapi import APIRouter

from db import get_twin
from .knowledge import run_knowledge

router = APIRouter()


def run_twin(state: dict):
    patient_twin = get_twin(state["user_id"])
    if patient_twin is None:
        return {"answer": "I don't have any health data for you yet — please upload a report first.",
                "sources": [], "confidence": None}

    state["twin"] = patient_twin
    return run_knowledge(state)


@router.post("/agents/twin")
def twin(state: dict):
    return run_twin(state)
