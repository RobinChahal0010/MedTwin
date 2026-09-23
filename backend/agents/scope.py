"""
Agent 1: Scope guard. First stop for every chat message.
Job: decide yes/no — is this about Type 2 Diabetes?
Lenient: anything mentioning diabetes, blood sugar, HbA1c, glucose,
insulin, medication, diet, or symptoms is on-topic.
Greetings get a friendly response, not a hard rejection.
"""
import re
from fastapi import APIRouter

from llm import ask_llm
from .twin import run_twin

router = APIRouter()

# Keywords that immediately mark a question as on-topic — no LLM call needed
_ON_TOPIC_KEYWORDS = re.compile(
    r"\b(diabet|blood\s*sugar|hba1c|haemoglobin\s*a1c|hemoglobin\s*a1c|"
    r"glucose|insulin|metformin|glipizide|gliclazide|medication|medicine|"
    r"diet|carb|cholesterol|blood\s*pressure|hypertension|kidney|retina|"
    r"neuropathy|hypoglycemi|hyperglycemi|a1c|fasting|post.?prandial|"
    r"bdose|basal|bolus|meal|exercise|weight|bmi|hba|sugar)\b",
    re.IGNORECASE,
)

# Patterns that look like a greeting / small-talk (not a medical question)
_GREETING_PATTERN = re.compile(
    r"^\s*(hi|hello|hey|howdy|good\s+(morning|afternoon|evening|night)|"
    r"what('s| is) up|how are you|namaste|hola|bonjour|thanks|thank you|ok|okay|"
    r"bye|goodbye|ciao)\W*$",
    re.IGNORECASE,
)


def run_scope(state: dict):
    question = state.get("question", "").strip()

    # 1. Greetings → friendly prompt, not a rejection
    if _GREETING_PATTERN.match(question):
        return {
            "answer": (
                "Hello! I'm MedTwin AI, your diabetes care assistant. "
                "Feel free to ask me anything about Type 2 Diabetes — "
                "blood sugar targets, medications, diet, HbA1c, or your digital twin report."
            ),
            "sources": [],
            "confidence": None,
        }

    # 2. Keyword fast-path — skip LLM call if clearly on-topic
    if _ON_TOPIC_KEYWORDS.search(question):
        state["on_topic"] = True
        return run_twin(state)

    # 3. LLM judgement for everything else — lenient prompt
    llm_answer = ask_llm(
        "Answer only 'yes' or 'no'. "
        "Is the following question related to Type 2 Diabetes, blood sugar, "
        "HbA1c, glucose, insulin, diabetes medications, diabetic diet, "
        "diabetic symptoms, or diabetes complications? "
        "When in doubt, answer 'yes'.",
        question,
    ).strip().lower()

    state["on_topic"] = llm_answer.startswith("y")
    if not state["on_topic"]:
        return {
            "answer": (
                "I specialise in Type 2 Diabetes questions. "
                "Please ask me about blood sugar, HbA1c, medications, diet, "
                "or your digital twin health report and I'll be happy to help!"
            ),
            "sources": [],
            "confidence": None,
        }

    return run_twin(state)


@router.post("/agents/scope")
def scope(state: dict):
    return run_scope(state)
