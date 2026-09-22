"""
Run this AFTER starting the server (uvicorn main:app --reload) in another
terminal. It hits every endpoint with hard-coded test data.
Usage: python test_all.py
"""
import requests

BASE = "http://127.0.0.1:8000"
USER_ID = "test-user-1"


def check(name, fn):
    try:
        print(f"PASS  {name}: {fn()}")
    except Exception as e:
        print(f"FAIL  {name}: {type(e).__name__}: {str(e)[:300]}")


check("health", lambda: requests.get(f"{BASE}/health").json())

check("rag search", lambda: requests.get(
    f"{BASE}/agents/knowledge"
).status_code if False else "skipped (internal agent, tested via /chat)")

# --- Upload a fake CSV report and build a twin -----------------------------
fake_csv = ("age,sex,bmi,sbp,dbp,total_chol,hdl,creatinine,hba1c,insulin\n"
            "58,2,31.2,148,92,210,41,1.1,8.4,0\n")
with open("fake_report.csv", "w") as f:
    f.write(fake_csv)

check("twin upload", lambda: requests.post(
    f"{BASE}/twin/upload", params={"user_id": USER_ID},
    files={"file": ("fake_report.csv", open("fake_report.csv", "rb"), "text/csv")},
).json())

check("get twin", lambda: requests.get(f"{BASE}/twin/{USER_ID}").json())

QUESTIONS = [
    ("What is my HbA1c goal and how do I compare?", "patient"),
    ("What if my HbA1c stayed high for 6 months?", "patient"),
    ("I have a cough, what do I do?", "patient"),  # should be refused
]
for q, mode in QUESTIONS:
    check(f"chat: {q!r}", lambda q=q, mode=mode: requests.post(
        f"{BASE}/chat", json={"user_id": USER_ID, "question": q, "mode": mode}
    ).json())
