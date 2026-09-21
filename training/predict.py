import pandas as pd
import joblib


MODEL_PATH = "outputs/risk_model.joblib"
REFERENCE_PATH = "outputs/reference.csv"

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


# ============================================================
# LOAD
# ============================================================

model = joblib.load(MODEL_PATH)
reference = pd.read_csv(REFERENCE_PATH)

print("MedTwin Calibrated Logistic Regression model loaded.")
print("Reference population loaded.")


# ============================================================
# FUNCTIONS
# ============================================================

def calculate_probability(patient):

    data = pd.DataFrame(
        [patient],
        columns=FEATURES
    )

    return model.predict_proba(data)[0][1]


def calculate_percentile(probability):

    reference_probabilities = model.predict_proba(
        reference[FEATURES]
    )[:, 1]

    percentile = (
        (reference_probabilities < probability).mean()
        * 100
    )

    if percentile >= 99.5:
        return ">99"

    return f"{percentile:.1f}"


# ============================================================
# INPUT
# ============================================================

print("\n========================================")
print("          MEDTWIN RISK PREDICTION")
print("========================================")

age = int(input("Age: "))
sex = int(input("Sex (1=Male, 2=Female): "))
bmi = float(input("BMI: "))
sbp = float(input("Systolic BP: "))
dbp = float(input("Diastolic BP: "))
cholesterol = float(input("Total Cholesterol: "))
hdl = float(input("HDL Cholesterol: "))
creatinine = float(input("Creatinine: "))
insulin = int(input("Insulin use (0=No, 1=Yes): "))


patient = {
    "RIDAGEYR": age,
    "RIAGENDR": sex,
    "BMXBMI": bmi,
    "BPXOSY1": sbp,
    "BPXODI1": dbp,
    "LBXTC": cholesterol,
    "LBDHDD": hdl,
    "LBXSCR": creatinine,
    "DIQ050": insulin
}


# ============================================================
# PREDICTION
# ============================================================

probability = calculate_probability(patient)
percentile = calculate_percentile(probability)


# ============================================================
# RESULT
# ============================================================

print("\n========================================")
print("             MEDTWIN RESULT")
print("========================================")

print(
    f"Estimated probability of HbA1c >= 7%: "
    f"{probability * 100:.2f}%"
)

print(
    f"Reference population percentile: "
    f"{percentile}th"
)

print("\nNote:")
print(
    "This is an educational estimate based on "
    "population patterns. It is not a medical "
    "diagnosis or personal medical forecast."
)

print("========================================")