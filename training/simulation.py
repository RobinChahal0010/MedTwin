import json
import pandas as pd
import joblib


# ============================================================
# CONFIG
# ============================================================

MODEL_PATH = "outputs/risk_model.joblib"
REFERENCE_PATH = "outputs/reference.csv"
OUTPUT_PATH = "outputs/simulation_result.json"

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
# LOAD MODEL
# ============================================================

model = joblib.load(MODEL_PATH)
reference = pd.read_csv(REFERENCE_PATH)

print("\nMedTwin Digital Twin loaded.")
print("Calibrated population-pattern model loaded.")


# ============================================================
# MODEL FUNCTIONS
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
# INPUT HELPER
# ============================================================

def ask_value(label, current, converter):

    value = input(
        f"{label} [{current}]: "
    ).strip()

    if value == "":
        return current

    return converter(value)


# ============================================================
# PRINT STATE
# ============================================================

def print_state(title, patient, probability, percentile):

    print("\n========================================")
    print(f"          {title}")
    print("========================================")

    print(f"Age                : {patient['RIDAGEYR']}")
    print(f"Sex                : {patient['RIAGENDR']}")
    print(f"BMI                : {patient['BMXBMI']}")
    print(f"Systolic BP        : {patient['BPXOSY1']}")
    print(f"Diastolic BP       : {patient['BPXODI1']}")
    print(f"Total Cholesterol  : {patient['LBXTC']}")
    print(f"HDL                : {patient['LBDHDD']}")
    print(f"Creatinine         : {patient['LBXSCR']}")
    print(f"Insulin use        : {patient['DIQ050']}")

    print("----------------------------------------")

    print(
        f"Estimated HbA1c >=7% : "
        f"{probability * 100:.2f}%"
    )

    print(
        f"Reference percentile : "
        f"{percentile}th"
    )


# ============================================================
# PERSON INPUT
# ============================================================

print("\n========================================")
print("       MEDTWIN DIGITAL TWIN")
print("========================================")

print("\nEnter the person's current details.")

age = int(input("Age: "))
sex = int(input("Sex (1=Male, 2=Female): "))
bmi = float(input("BMI: "))
sbp = float(input("Systolic BP: "))
dbp = float(input("Diastolic BP: "))
cholesterol = float(input("Total Cholesterol: "))
hdl = float(input("HDL Cholesterol: "))
creatinine = float(input("Creatinine: "))
insulin = int(input("Insulin use (0=No, 1=Yes): "))


baseline = {
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
# BASELINE
# ============================================================

baseline_probability = calculate_probability(
    baseline
)

baseline_percentile = calculate_percentile(
    baseline_probability
)


print_state(
    "BASELINE STATE",
    baseline,
    baseline_probability,
    baseline_percentile
)


# ============================================================
# SCENARIO LOOP
# ============================================================

scenarios = []

scenario_number = 1


while True:

    print("\n========================================")
    print(f"          WHAT-IF SCENARIO {scenario_number}")
    print("========================================")

    print(
        "\nPress ENTER to keep the current value."
    )

    simulated = baseline.copy()


    # --------------------------------------------------------
    # MODIFY ONLY SELECTABLE VARIABLES
    # --------------------------------------------------------

    simulated["BMXBMI"] = ask_value(
        "BMI",
        baseline["BMXBMI"],
        float
    )

    simulated["BPXOSY1"] = ask_value(
        "Systolic BP",
        baseline["BPXOSY1"],
        float
    )

    simulated["BPXODI1"] = ask_value(
        "Diastolic BP",
        baseline["BPXODI1"],
        float
    )

    simulated["LBXTC"] = ask_value(
        "Total Cholesterol",
        baseline["LBXTC"],
        float
    )

    simulated["LBDHDD"] = ask_value(
        "HDL Cholesterol",
        baseline["LBDHDD"],
        float
    )

    simulated["LBXSCR"] = ask_value(
        "Creatinine",
        baseline["LBXSCR"],
        float
    )

    simulated["DIQ050"] = ask_value(
        "Insulin use (0/1)",
        baseline["DIQ050"],
        int
    )


    # --------------------------------------------------------
    # SIMULATION
    # --------------------------------------------------------

    simulated_probability = calculate_probability(
        simulated
    )

    simulated_percentile = calculate_percentile(
        simulated_probability
    )


    change = (
        simulated_probability
        - baseline_probability
    )

    percentage_point_change = change * 100


    # --------------------------------------------------------
    # CHANGED VARIABLES
    # --------------------------------------------------------

    changed_variables = {}

    for feature in FEATURES:

        old_value = baseline[feature]
        new_value = simulated[feature]

        if old_value != new_value:

            changed_variables[feature] = {
                "from": old_value,
                "to": new_value
            }


    # --------------------------------------------------------
    # SCENARIO NAME
    # --------------------------------------------------------

    name = input(
        "\nScenario name "
        f"(e.g. Lower BMI) [Scenario {scenario_number}]: "
    ).strip()

    if name == "":
        name = f"Scenario {scenario_number}"


    # --------------------------------------------------------
    # RESULT
    # --------------------------------------------------------

    print("\n----------------------------------------")
    print(f"             {name}")
    print("----------------------------------------")

    print(
        f"Baseline estimate : "
        f"{baseline_probability * 100:.2f}%"
    )

    print(
        f"Scenario estimate : "
        f"{simulated_probability * 100:.2f}%"
    )

    print(
        f"Model-estimated change : "
        f"{percentage_point_change:+.2f} percentage points"
    )

    print(
        f"Scenario percentile : "
        f"{simulated_percentile}th"
    )

    print("\nChanged variables:")

    if changed_variables:

        for feature, values in changed_variables.items():

            print(
                f"{feature}: "
                f"{values['from']} -> {values['to']}"
            )

    else:

        print("No values changed.")


    # --------------------------------------------------------
    # STORE SCENARIO
    # --------------------------------------------------------

    scenarios.append({
        "name": name,

        "inputs": simulated,

        "probability": round(
            simulated_probability,
            6
        ),

        "percentile": simulated_percentile,

        "change_percentage_points": round(
            percentage_point_change,
            4
        ),

        "changed_variables": changed_variables
    })


    # --------------------------------------------------------
    # MORE SCENARIOS?
    # --------------------------------------------------------

    another = input(
        "\nCreate another scenario? (y/n): "
    ).strip().lower()

    if another != "y":
        break

    scenario_number += 1


# ============================================================
# SAVE JSON
# ============================================================

result = {

    "baseline": {

        "inputs": baseline,

        "probability": round(
            baseline_probability,
            6
        ),

        "percentile": baseline_percentile
    },

    "scenarios": scenarios,

    "disclaimer": (
        "These are model-based population-pattern "
        "estimates from modified input values. "
        "They are not medical diagnoses or personal "
        "medical forecasts."
    )
}


with open(
    OUTPUT_PATH,
    "w",
    encoding="utf-8"
) as file:

    json.dump(
        result,
        file,
        indent=4
    )


# ============================================================
# SUMMARY
# ============================================================

print("\n========================================")
print("       SIMULATION COMPLETE")
print("========================================")

print(
    f"Scenarios created: {len(scenarios)}"
)

print(
    f"Saved to: {OUTPUT_PATH}"
)

print(
    "\nThese simulations represent model-estimated "
    "changes from the same person's baseline."
)

print(
    "They are not personal medical forecasts."
)

print("========================================")