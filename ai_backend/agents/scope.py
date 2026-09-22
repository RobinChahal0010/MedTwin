"""
Agent 1: Scope guard. First stop for every chat message.
Job: decide yes/no — is this about Type 2 Diabetes? If not, refuse politely
and stop the chain right here (never call the next agent).
"""
import httpx
from fastapi import APIRouter
import config
from llm import ask_llm

router = APIRouter()


@router.post("/agents/scope")
def scope(state: dict):
    answer = ask_llm(
        "Answer only 'yes' or 'no'. Is the following question about Type 2 "
        "Diabetes, its management, symptoms, or care? A general symptom "
        "unrelated to diabetes (e.g. 'I have a cough') is 'no'.",
        state["question"],
    ).strip().lower()

    state["on_topic"] = answer.startswith("y")
    if not state["on_topic"]:
        return {"answer": "I only handle Type 2 Diabetes questions.",
                "sources": [], "confidence": None}

    resp = httpx.post(f"{config.SELF_BASE_URL}/agents/twin", json=state, timeout=60)
    return resp.json()
