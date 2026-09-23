"""
Agent 5: Answer writer. Job: write the reply using ONLY the twin, the
retrieved guideline passages, and the (optional) simulation — nothing
made up. Adjusts language for patient vs clinician mode.
"""
import json
from fastapi import APIRouter

from llm import ask_llm
from rag.search import format_passages
from .verify import run_verify

router = APIRouter()


def run_answer(state: dict):
    mode = state.get("mode", "patient")
    style = ("Explain in simple, everyday language, no jargon."
             if mode == "patient" else
             "Use precise clinical language and cite guideline recommendation numbers where visible.")

    prompt = f"""Question: {state['question']}

Patient's current values and guideline labels:
{json.dumps(state['twin'], indent=2)}

What-if projection (if any):
{json.dumps(state.get('projection'), indent=2)}

Guideline passages (the ONLY source of medical facts — cite the source name for each fact used):
{format_passages(state['sources'])}

Rules:
- Only state a medical fact if it is supported by a passage above. Cite the source file name.
- If the passages don't cover something needed to answer, say so plainly.
- {style}
"""
    state["draft"] = ask_llm(
        "You are a careful diabetes education assistant. Never state a "
        "medical fact that isn't in the supplied passages.", prompt,
    )

    return run_verify(state)


@router.post("/agents/answer")
def answer(state: dict):
    return run_answer(state)
