"""Smoke-test POST /speech/synthesize locally."""
import sys
import requests

BASE = "http://127.0.0.1:8000"
TESTS = [
    ("en-IN", "Your HbA1c goal is below 7 percent. Consult your doctor regularly."),
    ("hi-IN", "आपका HbA1c लक्ष्य 7 प्रतिशत से कम है।"),
]

all_pass = True
for lang, text in TESTS:
    resp = requests.post(
        f"{BASE}/speech/synthesize",
        json={"text": text, "lang": lang},
        timeout=35,
    )
    ct = resp.headers.get("content-type", "")
    if resp.status_code == 200 and len(resp.content) > 1000 and "audio" in ct:
        print(f"[PASS] lang={lang} | HTTP {resp.status_code} | {len(resp.content):,} bytes audio")
    else:
        print(f"[FAIL] lang={lang} | HTTP {resp.status_code} | {resp.text[:200]}")
        all_pass = False

sys.exit(0 if all_pass else 1)
