import pandas as pd
import joblib

from sklearn.model_selection import train_test_split, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import roc_auc_score, brier_score_loss


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
# LOAD NHANES DATA
# ============================================================

print("\n==============================================")
print("       MEDTWIN RISK MODEL TRAINING")
print("==============================================")

print("\nLoading NHANES datasets...")

demo = pd.read_sas(f"{DATA_DIR}/P_DEMO.xpt")
ghb = pd.read_sas(f"{DATA_DIR}/P_GHB.xpt")
bpxo = pd.read_sas(f"{DATA_DIR}/P_BPXO.xpt")
bmx = pd.read_sas(f"{DATA_DIR}/P_BMX.xpt")
tchol = pd.read_sas(f"{DATA_DIR}/P_TCHOL.xpt")
hdl = pd.read_sas(f"{DATA_DIR}/P_HDL.xpt")
biopro = pd.read_sas(f"{DATA_DIR}/P_BIOPRO.xpt")
diq = pd.read_sas(f"{DATA_DIR}/P_DIQ.xpt")


# ============================================================
# SELECT REQUIRED COLUMNS
# ============================================================

demo = demo[
    ["SEQN", "RIDAGEYR", "RIAGENDR"]
]

ghb = ghb[
    ["SEQN", "LBXGH"]
]

bpxo = bpxo[
    ["SEQN", "BPXOSY1", "BPXODI1"]
]

bmx = bmx[
    ["SEQN", "BMXBMI"]
]

tchol = tchol[
    ["SEQN", "LBXTC"]
]

hdl = hdl[
    ["SEQN", "LBDHDD"]
]

biopro = biopro[
    ["SEQN", "LBXSCR"]
]

diq = diq[
    ["SEQN", "DIQ010", "DID040", "DIQ050"]
]


# ============================================================
# MERGE DATASETS
# ============================================================

df = demo.merge(ghb, on="SEQN")
df = df.merge(bpxo, on="SEQN")
df = df.merge(bmx, on="SEQN")
df = df.merge(tchol, on="SEQN")
df = df.merge(hdl, on="SEQN")
df = df.merge(biopro, on="SEQN")
df = df.merge(diq, on="SEQN")

print(f"Merged rows: {len(df)}")


# ============================================================
# FILTER POPULATION
# ============================================================

# Diagnosed diabetes
df = df[df["DIQ010"] == 1]

# Diabetes diagnosed at age 30+
df = df[df["DID040"] >= 30]

print(f"After population filters: {len(df)}")


# ============================================================
# REMOVE MISSING VALUES
# ============================================================

df = df.dropna(
    subset=FEATURES + ["LBXGH"]
)

print(f"Complete rows: {len(df)}")


# ============================================================
# TARGET
# ============================================================

# HbA1c >= 7%
df[TARGET] = (
    df["LBXGH"] >= 7.0
).astype(int)


print("\nTarget distribution:")
print(df[TARGET].value_counts())


# ============================================================
# FEATURES / TARGET
# ============================================================

X = df[FEATURES]
y = df[TARGET]


# ============================================================
# TRAIN / TEST SPLIT
# ============================================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\n----------------------------------------------")
print("DATA SPLIT")
print("----------------------------------------------")

print(f"Training samples : {len(X_train)}")
print(f"Test samples     : {len(X_test)}")


# ============================================================
# BASE LOGISTIC REGRESSION PIPELINE
# ============================================================

base_model = Pipeline([
    (
        "scaler",
        StandardScaler()
    ),

    (
        "logistic",
        LogisticRegression(
            max_iter=1000,
            random_state=42
        )
    )
])


# ============================================================
# SIGMOID CALIBRATION
# ============================================================

print("\nTraining calibrated Logistic Regression...")

model = CalibratedClassifierCV(
    estimator=base_model,
    method="sigmoid",
    cv=5
)

model.fit(
    X_train,
    y_train
)


# ============================================================
# TEST PERFORMANCE
# ============================================================

test_probabilities = model.predict_proba(
    X_test
)[:, 1]

test_auc = roc_auc_score(
    y_test,
    test_probabilities
)

test_brier = brier_score_loss(
    y_test,
    test_probabilities
)


print("\n----------------------------------------------")
print("TEST PERFORMANCE")
print("----------------------------------------------")

print(f"ROC-AUC     : {test_auc:.4f}")
print(f"Brier Score : {test_brier:.4f}")


# ============================================================
# 5-FOLD CV
# ============================================================

print("\n----------------------------------------------")
print("5-FOLD CROSS VALIDATION")
print("----------------------------------------------")

cv = StratifiedKFold(
    n_splits=5,
    shuffle=True,
    random_state=42
)

cv_scores = []

for fold, (train_idx, val_idx) in enumerate(
    cv.split(X_train, y_train),
    start=1
):

    X_cv_train = X_train.iloc[train_idx]
    X_cv_val = X_train.iloc[val_idx]

    y_cv_train = y_train.iloc[train_idx]
    y_cv_val = y_train.iloc[val_idx]

    fold_model = CalibratedClassifierCV(
        estimator=Pipeline([
            (
                "scaler",
                StandardScaler()
            ),
            (
                "logistic",
                LogisticRegression(
                    max_iter=1000,
                    random_state=42
                )
            )
        ]),
        method="sigmoid",
        cv=5
    )

    fold_model.fit(
        X_cv_train,
        y_cv_train
    )

    fold_probabilities = fold_model.predict_proba(
        X_cv_val
    )[:, 1]

    fold_auc = roc_auc_score(
        y_cv_val,
        fold_probabilities
    )

    cv_scores.append(fold_auc)

    print(
        f"Fold {fold}: "
        f"ROC-AUC = {fold_auc:.4f}"
    )


print("\nCV Mean:")
print(f"{sum(cv_scores) / len(cv_scores):.4f}")

print("\nCV Std:")
print(
    f"{pd.Series(cv_scores).std():.4f}"
)


# ============================================================
# SAVE REFERENCE DATA
# ============================================================

reference = df[
    FEATURES + [TARGET]
].copy()

reference.to_csv(
    f"{OUTPUT_DIR}/reference.csv",
    index=False
)


# ============================================================
# SAVE TRAINING RESULTS
# ============================================================

results = pd.DataFrame({
    "metric": [
        "test_roc_auc",
        "test_brier_score",
        "cv_mean_roc_auc",
        "cv_std_roc_auc"
    ],

    "value": [
        test_auc,
        test_brier,
        sum(cv_scores) / len(cv_scores),
        pd.Series(cv_scores).std()
    ]
})

results.to_csv(
    f"{OUTPUT_DIR}/training_results.csv",
    index=False
)


# ============================================================
# SAVE MODEL
# ============================================================

joblib.dump(
    model,
    f"{OUTPUT_DIR}/risk_model.joblib"
)


# ============================================================
# FINAL OUTPUT
# ============================================================

print("\n----------------------------------------------")
print("MODEL SAVED")
print("----------------------------------------------")

print(
    "outputs/risk_model.joblib"
)

print(
    "outputs/reference.csv"
)

print(
    "outputs/training_results.csv"
)

print("\n==============================================")
print("       TRAINING COMPLETE")
print("==============================================")