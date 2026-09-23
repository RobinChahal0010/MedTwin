"""
Entry point for MedTwin AI backend.
FastAPI with 6-agent clinical reasoning chain, SSE streaming chat,
biomarker digital twin processing, and speech recognition/synthesis.
"""
import json
import logging
import asyncio
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import config
from agents.scope import run_scope, router as scope_router
from agents.twin import router as twin_agent_router
from agents.knowledge import router as knowledge_router
from agents.simulate import router as simulate_router
from agents.answer import router as answer_router
from agents.verify import router as verify_router
from auth_routes import router as auth_router, user_router
from speech_routes import router as speech_router
from twin_routes import router as twin_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("medtwin")

config.check_config()  # fail fast if .env is incomplete

app = FastAPI(title="MedTwin AI backend")

allowed_origins = [
    "https://gentle-tree-0d75a2100.1.azurestaticapps.net",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://gentle-tree-0d75a2100.*\.azurestaticapps\.net",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth_router, user_router, twin_router, speech_router, scope_router, twin_agent_router,
          knowledge_router, simulate_router, answer_router, verify_router):
    app.include_router(r)


@app.get("/health")
def health():
    return {"status": "ok"}


async def chat_stream_generator(state: dict):
    """
    Executes the 6-agent pipeline asynchronously and yields SSE events.
    Compatible with both frontend/src/api.ts and frontend/src/pages/chat.ts.
    """
    try:
        # Step 1: Scope (lenient — keyword fast-path + greeting handler)
        yield f"data: {json.dumps({'type': 'start', 'agent': 'scope', 'action': 'Checking medical scope'})}\n\n"
        from agents.scope import _ON_TOPIC_KEYWORDS, _GREETING_PATTERN, ask_llm
        question = state["question"]

        if _GREETING_PATTERN.match(question):
            # Greeting → friendly prompt, not a rejection
            yield f"data: {json.dumps({'type': 'done', 'agent': 'scope', 'exit_early': True, 'on_topic': False})}\n\n"
            out = {
                "type": "result",
                "answer": (
                    "Hello! I'm MedTwin AI, your diabetes care assistant. "
                    "Feel free to ask me anything about Type 2 Diabetes — "
                    "blood sugar targets, medications, diet, HbA1c, or your digital twin report."
                ),
                "sources": [],
                "confidence": None,
            }
            yield f"data: {json.dumps(out)}\n\n"
            yield "data: [DONE]\n\n"
            return

        if _ON_TOPIC_KEYWORDS.search(question):
            on_topic = True
        else:
            scope_resp = await asyncio.to_thread(
                ask_llm,
                "Answer only 'yes' or 'no'. "
                "Is the following question related to Type 2 Diabetes, blood sugar, "
                "HbA1c, glucose, insulin, diabetes medications, diabetic diet, "
                "diabetic symptoms, or diabetes complications? "
                "When in doubt, answer 'yes'.",
                question,
            )
            on_topic = scope_resp.strip().lower().startswith("y")

        state["on_topic"] = on_topic
        if not on_topic:
            yield f"data: {json.dumps({'type': 'done', 'agent': 'scope', 'exit_early': True, 'on_topic': False})}\n\n"
            out = {
                "type": "result",
                "answer": (
                    "I specialise in Type 2 Diabetes questions. "
                    "Please ask me about blood sugar, HbA1c, medications, diet, "
                    "or your digital twin health report and I'll be happy to help!"
                ),
                "sources": [],
                "confidence": None,
            }
            yield f"data: {json.dumps(out)}\n\n"
            yield "data: [DONE]\n\n"
            return

        yield f"data: {json.dumps({'type': 'done', 'agent': 'scope', 'on_topic': True})}\n\n"

        # Step 2: Twin
        yield f"data: {json.dumps({'type': 'start', 'agent': 'twin', 'action': 'Loading digital twin profile'})}\n\n"
        from db import get_twin
        patient_twin = await asyncio.to_thread(get_twin, state["user_id"])
        if patient_twin is None:
            yield f"data: {json.dumps({'type': 'done', 'agent': 'twin', 'exit_early': True, 'found': False})}\n\n"
            out = {
                "type": "result",
                "answer": "I don't have any health data for you yet — please upload a report first.",
                "sources": [],
                "confidence": None,
            }
            yield f"data: {json.dumps(out)}\n\n"
            yield "data: [DONE]\n\n"
            return

        state["twin"] = patient_twin
        risk_val = patient_twin.get("risk_poor_control")
        yield f"data: {json.dumps({'type': 'done', 'agent': 'twin', 'found': True, 'risk': risk_val})}\n\n"

        # Step 3: Knowledge
        yield f"data: {json.dumps({'type': 'start', 'agent': 'knowledge', 'action': 'Searching clinical guidelines'})}\n\n"
        from rag.search import search_guidelines
        sources = await asyncio.to_thread(search_guidelines, state["question"], 4)
        state["sources"] = sources
        titles = [s.get("source") for s in sources if s.get("source")]
        yield f"data: {json.dumps({'type': 'done', 'agent': 'knowledge', 'passages': len(sources), 'titles': titles})}\n\n"

        # Step 4: Simulate
        yield f"data: {json.dumps({'type': 'start', 'agent': 'simulate', 'action': 'Evaluating physiological projections'})}\n\n"
        q_lower = state["question"].lower()
        is_whatif = "what if" in q_lower or "what-if" in q_lower
        ran_sim = False
        if is_whatif:
            from model.risk import predict_risk
            plan = await asyncio.to_thread(
                ask_llm,
                "The user asked a what-if question about their diabetes values. "
                "Reply with ONLY a JSON object naming which of these fields change "
                "and their new numeric value: age, bmi, sbp, dbp, total_chol, hdl, "
                "creatinine, insulin. If the question doesn't map to any of these "
                "fields, return an empty object {}.",
                state["question"],
                True,
            )
            if plan and isinstance(plan, dict):
                ran_sim = True
                before = state["twin"].get("values", {})
                after = {**before, **plan}
                risk_before = await asyncio.to_thread(predict_risk, before)
                risk_after = await asyncio.to_thread(predict_risk, after)
                state["projection"] = {
                    "changed": plan,
                    "risk_before": risk_before,
                    "risk_after": risk_after,
                    "note": "Estimate based on population patterns in the training data and guideline targets — not a medical forecast.",
                }
        yield f"data: {json.dumps({'type': 'done', 'agent': 'simulate', 'ran': ran_sim})}\n\n"

        # Step 5: Answer
        yield f"data: {json.dumps({'type': 'start', 'agent': 'answer', 'action': 'Synthesizing clinical response'})}\n\n"
        from rag.search import format_passages
        mode = state.get("mode", "patient")
        style = (
            "Explain in simple, everyday language, no jargon."
            if mode == "patient"
            else "Use precise clinical language and cite guideline recommendation numbers where visible."
        )
        ans_prompt = f"""Question: {state['question']}

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
- Reply in the same language as the question. The user's selected language code is "{state.get('lang', 'en-IN')}". If it is a non-English locale (e.g. hi-IN, ta-IN) write the entire answer in that language. If it is en-IN or en-US, reply in English.
"""
        draft = await asyncio.to_thread(
            ask_llm,
            "You are a careful diabetes education assistant. Never state a medical fact that isn't in the supplied passages.",
            ans_prompt,
        )
        state["draft"] = draft
        yield f"data: {json.dumps({'type': 'done', 'agent': 'answer'})}\n\n"

        # Step 6: Verify
        yield f"data: {json.dumps({'type': 'start', 'agent': 'verify', 'action': 'Fact-checking draft and scoring confidence'})}\n\n"
        from agents.verify import run_verify
        result = await asyncio.to_thread(run_verify, state)
        yield f"data: {json.dumps({'type': 'done', 'agent': 'verify'})}\n\n"

        # Final Result payload
        out = {
            "type": "result",
            "answer": result["answer"],
            "sources": result["sources"],
            "confidence": result["confidence"],
        }
        yield f"data: {json.dumps(out)}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.exception("Chat pipeline exception: %s", e)
        err_out = {
            "type": "result",
            "answer": "We encountered an unexpected error while evaluating your query. Please try again.",
            "sources": [],
            "confidence": 0.0,
            "error": str(e),
        }
        yield f"data: {json.dumps(err_out)}\n\n"
        yield "data: [DONE]\n\n"


@app.post("/chat")
async def chat(payload: dict, request: Request):
    """
    Entry point for the 6-agent clinical reasoning chain.
    Streams SSE events by default for rich UI feedback, or returns JSON if requested.
    """
    user_id = str(payload.get("user_id", "")).strip()
    question = str(payload.get("question", "")).strip()

    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required")
    if not question:
        raise HTTPException(status_code=400, detail="question is required")
    if len(question) > 3000:
        question = question[:3000]

    state = {
        "user_id": user_id,
        "question": question,
        "mode": payload.get("mode", "patient"),
        "lang": payload.get("lang", "en-IN"),
    }

    accept_header = request.headers.get("accept", "")
    wants_plain_json = accept_header == "application/json" and "text/event-stream" not in accept_header

    if wants_plain_json:
        result = await asyncio.to_thread(run_scope, state)
        return result

    return StreamingResponse(
        chat_stream_generator(state),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )