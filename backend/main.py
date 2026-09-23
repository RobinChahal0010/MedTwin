"""
Entry point. Run with:  uvicorn main:app --reload
Docs page (test every endpoint from the browser):  http://127.0.0.1:8000/docs
"""
import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
config.check_config()  # fail fast if .env is incomplete

from auth_routes import router as auth_router
from twin_routes import router as twin_router
from speech_routes import router as speech_router
from agents.scope import router as scope_router
from agents.twin import router as twin_agent_router
from agents.knowledge import router as knowledge_router
from agents.simulate import router as simulate_router
from agents.answer import router as answer_router
from agents.verify import router as verify_router


app = FastAPI(title="MedTwin AI backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gentle-tree-0d75a2100.1.azurestaticapps.net"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth_router, twin_router, speech_router, scope_router, twin_agent_router,
          knowledge_router, simulate_router, answer_router, verify_router):
    app.include_router(r)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/chat")
def chat(payload: dict):
    """
    Entry point for the whole agent chain.
    payload: {"user_id": str, "question": str, "mode": "patient"|"clinician"}
    """
    state = {
        "user_id": payload["user_id"],
        "question": payload["question"],
        "mode": payload.get("mode", "patient"),
    }
    resp = httpx.post(f"{config.SELF_BASE_URL}/agents/scope", json=state, timeout=90)
    return resp.json()