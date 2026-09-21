import pandas as pd
import numpy as np
import joblib

from sklearn.model_selection import train_test_split, cross_val_predict, StratifiedKFold
from sklearn.metrics import (
    roc_auc_score,
    brier_score_loss,
    accuracy_score
)
from sklearn.calibration import calibration_curve


# ============================================================
# CONFIG
# ============================================================

DATA_DIR = "data"
OUTPUT_DIR = "outputs"

FEATURES = [
    "RIDAGEYR",
    "RIAGENDR",
    "BMXBMI",
    "BPXOSY1",
    "BPXODI1",
    "LBXTC",
    "LBDHDD",
    "LBXSCR",
    "DIQ050"
]

TARGET = "target"


# ============================================================
# LOAD DATA
# ============================================================

def load_data():

    demo = pd.read_sas(f"{DATA_DIR}/P_DEMO.xpt")
    ghb = pd.read_sas(f"{DATA_DIR}/P_GHB.xpt")
    bpxo = pd.read_sas(f"{DATA_DIR}/P_BPXO.xpt")
    bmx = pd.read_sas(f"{DATA_DIR}/P_BMX.xpt")
    tchol = pd.read_sas(f"{DATA_DIR}/P_TCHOL.xpt")
    hdl = pd.read_sas(f"{DATA_DIR}/P_HDL.xpt")
    biopro = pd.read_sas(f"{DATA_DIR}/P_BIOPRO.xpt")
    diq = pd.read_sas(f"{DATA_DIR}/P_DIQ.xpt")

    demo = demo[["SEQN", "RIDAGEYR", "RIAGENDR"]]
    ghb = ghb[["SEQN", "LBXGH"]]
    bpxo = bpxo[["SEQN", "BPXOSY1", "BPXODI1"]]
    bmx = bmx[["SEQN", "BMXBMI"]]
    tchol = tchol[["SEQN", "LBXTC"]]
    hdl = hdl[["SEQN", "LBDHDD"]]
    biopro = biopro[["SEQN", "LBXSCR"]]
    diq = diq[["SEQN", "DIQ010", "DID040", "DIQ050"]]

    df = demo.merge(ghb, on="SEQN")
    df = df.merge(bpxo, on="SEQN")
    df = df.merge(bmx, on="SEQN")
    df = df.merge(tchol, on="SEQN")
    df = df.merge(hdl, on="SEQN")
    df = df.merge(biopro, on="SEQN")
    df = df.merge(diq, on="SEQN")

    # Diagnosed diabetes
    df = df[df["DIQ010"] == 1]

    # Diagnosed at age 30+
    df = df[df["DID040"] >= 30]

    # Complete rows only
    df = df.dropna(subset=FEATURES + ["LBXGH"])

    # Target: HbA1c >= 7%
    df[TARGET] = (df["LBXGH"] >= 7.0).astype(int)

    return df


# ============================================================
# MAIN
# ============================================================

print("\n==============================================")
print("       MEDTWIN CALIBRATION ANALYSIS")
print("==============================================")

df = load_data()

X = df[FEATURES]
y = df[TARGET]

print(f"\nTotal samples: {len(df)}")
print(f"Positive cases: {y.sum()}")
print(f"Negative cases: {(y == 0).sum()}")


# ============================================================
# SAME 80/20 SPLIT AS TRAINING
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print(f"\nTraining samples: {len(X_train)}")
print(f"Test samples: {len(X_test)}")


# ============================================================
# LOAD CURRENT MODEL
# ============================================================

model = joblib.load(
    f"{OUTPUT_DIR}/risk_model.joblib"
)


# ============================================================
# TEST SET PROBABILITIES
# ============================================================

test_probabilities = model.predict_proba(X_test)[:, 1]

test_auc = roc_auc_score(
    y_test,
    test_probabilities
)

test_brier = brier_score_loss(
    y_test,
    test_probabilities
)


print("\n----------------------------------------------")
print("HELD-OUT TEST SET")
print("----------------------------------------------")

print(f"ROC-AUC       : {test_auc:.4f}")
print(f"Brier Score   : {test_brier:.4f}")


# ============================================================
# OUT-OF-FOLD CALIBRATION
# ============================================================
#
# Important:
# We generate predictions using only training data.
# The model never sees the validation fold while predicting it.
#

cv = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=42
)

oof_probabilities = cross_val_predict(
    model,
    X_train,
    y_train,
    cv=cv,
    method="predict_proba"
)[:, 1]

oof_auc = roc_auc_score(
    y_train,
    oof_probabilities
)

oof_brier = brier_score_loss(
    y_train,
    oof_probabilities
)


print("\n----------------------------------------------")
print("5-FOLD OUT-OF-FOLD CALIBRATION")
print("----------------------------------------------")

print(f"OOF ROC-AUC   : {oof_auc:.4f}")
print(f"OOF Brier     : {oof_brier:.4f}")


# ============================================================
# CALIBRATION BINS
# ============================================================

fraction_positive, mean_predicted = calibration_curve(
    y_train,
    oof_probabilities,
    n_bins=10,
    strategy="uniform"
)

print("\n----------------------------------------------")
print("CALIBRATION BINS")
print("----------------------------------------------")

print(
    f"{'Predicted':>12} | "
    f"{'Observed':>12} | "
    f"{'Difference':>12}"
)

print("-" * 43)

calibration_rows = []

for predicted, observed in zip(
    mean_predicted,
    fraction_positive
):

    difference = observed - predicted

    print(
        f"{predicted:12.4f} | "
        f"{observed:12.4f} | "
        f"{difference:12.4f}"
    )

    calibration_rows.append({
        "mean_predicted_probability": predicted,
        "observed_fraction_positive": observed,
        "difference": difference
    })


# ============================================================
# SAVE RESULTS
# ============================================================

calibration_df = pd.DataFrame(calibration_rows)

calibration_df.to_csv(
    f"{OUTPUT_DIR}/calibration_results.csv",
    index=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n----------------------------------------------")
print("INTERPRETATION")
print("----------------------------------------------")

print(
    "\nBrier Score measures how close predicted "
    "probabilities are to actual outcomes."
)

print(
    "Lower Brier Score = better probability accuracy."
)

print(
    "\nCalibration bins compare:"
)

print(
    "Predicted probability  vs  actual positive rate"
)

print(
    "\nIf predicted and observed values are close, "
    "the model is better calibrated."
)

print(
    "\nCalibration analysis complete."
)