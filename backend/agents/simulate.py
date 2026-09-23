"""
Agent 4: Simulation. Job: for "what if" questions, change one twin value
and re-run the ML model to compare before/after risk. Skipped for
ordinary questions. Always labeled an estimate, never a forecast.
"""
from fastapi import APIRouter

from llm import ask_llm
from model.risk import predict_risk
from .answer import run_answer

router = APIRouter()


def run_simulate(state: dict):
    question = state["question"].lower()
    is_whatif = "what if" in question or "what-if" in question

    if is_whatif:
        plan = ask_llm(
            "The user asked a what-if question about their diabetes values. "
            "Reply with ONLY a JSON object naming which of these fields change "
            "and their new numeric value: age, bmi, sbp, dbp, total_chol, hdl, "
            "creatinine, insulin. If the question doesn't map to any of these "
            "fields, return an empty object {}.",
            state["question"], json_mode=True,
        )
        if plan:
            before = state["twin"]["values"]
            after = {**before, **plan}
            state["projection"] = {
                "changed": plan,
                "risk_before": predict_risk(before),
                "risk_after": predict_risk(after),
                "note": "Estimate based on population patterns in the training "
                        "data and guideline targets — not a medical forecast.",
            }

    return run_answer(state)


@router.post("/agents/simulate")
def simulate(state: dict):
    return run_simulate(state)
