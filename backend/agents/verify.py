"""
Agent 6: Verifier. Job: check every claim in the draft answer against the
retrieved passages and the twin, drop anything unsupported, and compute
a confidence score. This is the LAST step — its output goes to the user.
"""
from fastapi import APIRouter

from llm import ask_llm
from rag.search import format_passages
from db import log_chat

router = APIRouter()


def run_verify(state: dict):
    prompt = f"""Draft answer:
{state['draft']}

Guideline passages available:
{format_passages(state['sources'])}

Task: Rewrite the draft, removing or softening any claim not supported by
the passages above or by the patient's own twin data. Then on a new final
line write: CONFIDENCE: <fraction of claims that were supported, 0.0 to 1.0>
"""
    checked = ask_llm(
        "You are a strict fact-checker. Be conservative — when in doubt, remove the claim.",
        prompt,
    )

    confidence = 0.5  # safe default if parsing fails
    final_answer = checked
    if "CONFIDENCE:" in checked:
        final_answer, conf_line = checked.rsplit("CONFIDENCE:", 1)
        try:
            confidence = float(conf_line.strip())
        except ValueError:
            pass

    sources_formatted = []
    for s in state.get("sources", []):
        if isinstance(s, dict):
            src_name = s.get("source") or s.get("title") or "Clinical source"
            sources_formatted.append({
                "doc": src_name,
                "source": src_name,
                "sec": s.get("sec", ""),
                "text": s.get("text", "")
            })
        elif isinstance(s, str):
            sources_formatted.append({
                "doc": s,
                "source": s,
                "sec": "",
                "text": ""
            })

    result = {
        "answer": final_answer.strip(),
        "sources": sources_formatted,
        "confidence": round(confidence, 2),
    }
    log_chat(state["user_id"], state["question"], result["answer"], result["confidence"])
    return result


@router.post("/agents/verify")
def verify(state: dict):
    return run_verify(state)
