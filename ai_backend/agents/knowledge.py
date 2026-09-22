"""
Agent 3: Knowledge / RAG. Job: search the ADA/NICE guideline index for
passages relevant to the patient's question, and attach them to the state.
This is the ONLY source of medical facts in the whole chain.
"""
import httpx
from fastapi import APIRouter
import config
from rag.search import search_guidelines

router = APIRouter()


@router.post("/agents/knowledge")
def knowledge(state: dict):
    state["sources"] = search_guidelines(state["question"], top=4)

    resp = httpx.post(f"{config.SELF_BASE_URL}/agents/simulate", json=state, timeout=60)
    return resp.json()
