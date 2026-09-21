import pandas as pd
from pathlib import Path

DATA_DIR = Path("data")

files = [
    "P_DEMO.xpt",
    "P_GHB.xpt",
    "P_BPXO.xpt",
    "P_BMX.xpt",
    "P_TCHOL.xpt",
    "P_HDL.xpt",
    "P_BIOPRO.xpt",
    "P_DIQ.xpt"
]

for file in files:
    path = DATA_DIR / file

    print("\n" + "=" * 70)
    print(file)
    print("=" * 70)

    df = pd.read_sas(path)

    print("Rows:", len(df))
    print("Columns:", len(df.columns))

    print("\nColumns:")
    print(df.columns.tolist())

    print("\nFirst 3 rows:")
    print(df.head(3))