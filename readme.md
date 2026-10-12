# MedTwin

MedTwin is a diabetes digital-twin demo that combines a React-based frontend with a Python AI backend. It is not a Streamlit app, and it does not depend on a training pipeline being run during normal app usage.

The repository contains:
- a React + Vite frontend in `frontend/`
- a FastAPI backend in `backend/` for twin creation, chat, speech, and AI orchestration
- supporting model/risk scripts and outputs in `training/`

## Project overview

This app is designed to help a user:
- upload or review a lab report
- build a structured digital twin profile
- ask diabetes-related questions in natural language
- receive answers grounded in patient data, retrieved guideline information, and risk logic
- optionally explore projected changes in key values

It includes generative AI, guideline-based retrieval, and a risk model component, but the project is primarily a full-stack application demo rather than a model-training project.

## Architecture

```text
frontend/      React + Vite web app
backend/       FastAPI app and API routes
training/      risk-model scripts, analysis, and saved artifacts
```

## Frontend

The frontend is a React app, not Streamlit. It is built with Vite and runs in `frontend/`.

Typical setup:

```bash
cd frontend
npm install
npm run dev
```

## Backend

The backend is a Python FastAPI service in `backend/`.

Typical setup:

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

You will also need the required environment values in `.env` or app configuration before the app can run fully.

## Model / training notes

The repository includes a `training/` folder with scripts and output artifacts such as `risk_model.joblib`, calibration files, and analysis scripts. These artifacts are part of the project support code and may be used for experimentation and local validation.

However, the project should not be described as a model-training app or as a completed training initiative in the main project docs. The primary product here is the application experience and AI workflow itself.

## Core features

- digital twin creation from lab data
- diabetes-focused question answering
- guideline-grounded retrieval
- what-if scenario evaluation
- speech input/output support
- user authentication and profile flow

## Important note

This project is an educational/demo system and is not a clinical decision-support system for real-world medical use.

## Repository structure

```text
MedTwin/
├── backend/
├── frontend/
├── training/
├── readme.md
├── requirements.txt
├── MedTwin_Build_Guide.md
└── ...
```
