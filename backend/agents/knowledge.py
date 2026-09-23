"""
Agent 3: Knowledge / RAG. Job: search the ADA/NICE guideline index for
passages relevant to the patient's question, and attach them to the state.
This is the ONLY source of medical facts in the whole chain.
"""
from fastapi import APIRouter

from rag.search import search_guidelines
from .simulate import run_simulate

router = APIRouter()


def run_knowledge(state: dict):
    state["sources"] = search_guidelines(state["question"], top=4)
    return run_simulate(state)


@router.post("/agents/knowledge")
def knowledge(state: dict):
    return run_knowledge(state)
