"""
Wraps the trained scikit-learn model (risk_model.joblib) and the training
table (reference.csv). This is the ONLY place that touches the ML model.
It never writes text and never judges whether a value is "good" — the
Knowledge + Labeling agents do that from the guidelines instead.

Reads risk_model.joblib and reference.csv directly from ../training/outputs/
(no need to copy them). Override with the MODEL_DIR env var if your
training folder lives somewhere else.
"""
import os
import joblib
import pandas as pd
from scipy.stats import percentileofscore
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

# ai_backend/model/risk.py -> ai_backend/ -> MedTwin/ -> MedTwin/training/outputs
_DEFAULT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "training", "outputs")
_MODEL_DIR = os.getenv("MODEL_DIR", _DEFAULT_DIR)

_model = joblib.load(os.path.join(_MODEL_DIR, "risk_model.joblib"))
_reference = pd.read_csv(os.path.join(_MODEL_DIR, "reference.csv"))

# Must match the exact order/names used when the model was trained.
# NHANES codes -> friendly names used in the twin.
FEATURE_MAP = {
    "age": "RIDAGEYR",
    "sex": "RIAGENDR",
    "bmi": "BMXBMI",
    "sbp": "BPXOSY1",
    "dbp": "BPXODI1",
    "total_chol": "LBXTC",
    "hdl": "LBDHDD",
    "creatinine": "LBXSCR",
    "insulin": "DIQ050",
}
FEATURES = list(FEATURE_MAP.values())


def _to_row(values: dict) -> pd.DataFrame:
    """Turns the twin's friendly-named values into the raw feature row the model expects."""
    row = {FEATURE_MAP[k]: values.get(k) for k in FEATURE_MAP}
    return pd.DataFrame([row], columns=FEATURES)


def predict_risk(values: dict) -> float | None:
    """Chance (0-1) this patient's HbA1c is above the 7% target. None if inputs are missing."""
    row = _to_row(values)
    if row.isnull().any(axis=None):
        return None  # not enough data to score — be honest instead of guessing
    return float(_model.predict_proba(row)[0][1])


def percentiles(values: dict) -> dict:
    """For each value present, how it compares to the training population (0-100)."""
    out = {}
    for friendly, raw_col in FEATURE_MAP.items():
        v = values.get(friendly)
        if v is not None and raw_col in _reference.columns:
            out[friendly] = round(percentileofscore(_reference[raw_col].dropna(), v), 1)
    return out