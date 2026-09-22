# MedTwin — AI backend (FastAPI)

This is a **separate service** from your Node.js login/signup app. Both
read and write the **same MongoDB** (same `MONGODB_URI`), so `user_id`
values line up between them without the two servers ever calling
each other directly.

## Where this folder goes
Do NOT put this inside your existing `backend/` folder (that one is the
Node/Express app — `app.js`, `package.json`, `routes/`, etc.). Create a
new top-level folder next to it, e.g.:

```
MedTwin/
  backend/        <- existing Node.js auth app (unchanged)
  ai_backend/      <- this folder
  frontend/
  training/
```

## One-time setup
```bash
cd ai_backend
python -m venv venv
venv\Scripts\activate        # Windows PowerShell: venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env       # then fill in every value (ask teammates for the
                              # MongoDB URI, Azure keys, etc. — never commit .env)
```

Copy your trained model files into `model/`:
```bash
copy ..\training\outputs\risk_model.joblib model\
copy ..\training\outputs\reference.csv model\
```

**Important:** open `model/risk.py` and check that `FEATURE_MAP` matches
the exact column names your model was trained on (from `predict.py`).
If your training script used different NHANES codes, edit that dict.

## Run it
```bash
uvicorn main:app --reload
```
- http://127.0.0.1:8000/docs — try every endpoint from the browser
- http://127.0.0.1:8000/health — should return {"status": "ok"}

## Test everything at once
In a second terminal, with the server still running:
```bash
python test_all.py
```
This uploads a fake CSV, builds a twin, and asks three questions
(including one off-topic one that should be refused).

## File map
| File | Job |
|---|---|
| `config.py` | loads every `.env` value in one place |
| `db.py` | MongoDB connection + twin/file/chat helpers |
| `llm.py` | `ask_llm()` — the only place that calls Azure OpenAI chat |
| `extract.py` | OCR (Document Intelligence) + LLM extraction from a report |
| `rag/search.py` | `search_guidelines()` — the only source of medical facts |
| `model/risk.py` | loads `risk_model.joblib`, gives risk score + percentiles |
| `twin_routes.py` | `/twin/upload`, `/twin/{user_id}` |
| `speech_routes.py` | `/speech/transcribe`, `/speech/speak` |
| `agents/scope.py` | Agent 1 — is this about Type 2 Diabetes? |
| `agents/twin.py` | Agent 2 — loads the patient's saved twin |
| `agents/knowledge.py` | Agent 3 — RAG search for the question |
| `agents/simulate.py` | Agent 4 — what-if projections via the ML model |
| `agents/answer.py` | Agent 5 — writes the grounded answer |
| `agents/verify.py` | Agent 6 — fact-checks the draft, adds confidence |
| `main.py` | wires everything together; `/chat` is the entry point |

## The chain, in one line
`/chat` → `/agents/scope` → `/agents/twin` → `/agents/knowledge` →
`/agents/simulate` → `/agents/answer` → `/agents/verify` → answer returned.
Each agent forwards to the next with `httpx.post(...)`.

## Known things to double-check before the demo
- `rag/search.py` expects index fields `chunk`, `title`, `text_vector` —
  confirm these match your actual index (from your earlier test output).
- `extract.py`'s `TWIN_FIELDS` and `model/risk.py`'s `FEATURE_MAP` must
  stay consistent with each other and with your training script.
- CORS is wide open (`allow_origins=["*"]`) for development — fine for a
  class demo, not for anything public.
