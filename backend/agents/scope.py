"""
Agent 1: Scope guard. First stop for every chat message.
Job: decide yes/no — is this about Type 2 Diabetes? If not, refuse politely
and stop the chain right here (never call the next agent).
"""
from fastapi import APIRouter

from llm import ask_llm
from .twin import run_twin

router = APIRouter()


def run_scope(state: dict):
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

    return run_twin(state)


@router.post("/agents/scope")
def scope(state: dict):
    return run_scope(state)
