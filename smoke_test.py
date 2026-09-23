"""
MedTwin Pre-Deployment Smoke Test Suite
Verifies all backend endpoints, SSE chat streaming, auth, language preference,
and error handling before deployment.
Usage:
    python smoke_test.py [--url http://127.0.0.1:8000]
"""
import sys
import json
import time
import argparse
import requests

def parse_sse_events(response_text: str):
    """Parses raw SSE body into list of decoded json payloads."""
    events = []
    chunks = response_text.split("\n\n")
    for chunk in chunks:
        lines = chunk.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line.startswith("data:"):
                payload = line[5:].strip()
                if payload == "[DONE]":
                    continue
                try:
                    events.append(json.loads(payload))
                except Exception:
                    pass
    return events


def run_smoke_tests(base_url: str):
    print("=" * 60)
    print(f"MedTwin Smoke Test Target: {base_url}")
    print("=" * 60)

    passed = 0
    failed = 0

    def test(name, fn):
        nonlocal passed, failed
        try:
            msg = fn()
            print(f"✅ PASS: {name} -> {msg}")
            passed += 1
        except Exception as e:
            print(f"❌ FAIL: {name} -> {type(e).__name__}: {str(e)[:250]}")
            failed += 1

    # 1. Health
    def test_health():
        r = requests.get(f"{base_url}/health", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        assert r.json().get("status") == "ok"
        return "Service healthy"
    test("GET /health", test_health)

    # 2. Languages
    def test_languages():
        r = requests.get(f"{base_url}/languages", timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        langs = r.json().get("languages", [])
        codes = [l["code"] for l in langs]
        assert "en-IN" in codes, "en-IN missing from languages"
        assert "hi-IN" in codes, "hi-IN missing from languages"
        return f"{len(langs)} regional languages supported (includes en-IN, hi-IN)"
    test("GET /languages", test_languages)

    # 3. Auth signup / login
    test_user_id = None
    auth_token = None
    email = f"smoketest_{int(time.time())}@medtwin.internal"
    def test_auth():
        nonlocal test_user_id, auth_token
        # Signup
        r = requests.post(f"{base_url}/api/auth/signup", json={
            "username": "smoketester",
            "emailId": email,
            "password": "Password123!"
        }, timeout=15)
        if r.status_code == 409:
            # Login if user already exists
            r = requests.post(f"{base_url}/api/auth/login", json={
                "emailId": email,
                "password": "Password123!"
            }, timeout=15)
        assert r.status_code in (200, 201), f"Auth failed with {r.status_code}: {r.text}"
        data = r.json()
        assert "token" in data, "No JWT token in auth response"
        assert "user" in data and "id" in data["user"], "No user id in auth response"
        test_user_id = data["user"]["id"]
        auth_token = data["token"]
        return f"User authenticated (ID: {test_user_id})"
    test("POST /api/auth/signup or login", test_auth)

    # 4. User language preference
    def test_user_lang():
        if not test_user_id:
            return "Skipped (no user ID)"
        r = requests.post(f"{base_url}/api/user/language", json={
            "userId": test_user_id,
            "language": "en-IN"
        }, timeout=10)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        return "Language set to en-IN"
    test("POST /api/user/language", test_user_lang)

    # 5. GET /twin/{user_id} before report upload (should return 404 cleanly)
    def test_twin_not_found():
        nonlocal test_user_id
        uid = test_user_id or "non_existent_uid_999"
        r = requests.get(f"{base_url}/twin/{uid}", timeout=10)
        assert r.status_code in (200, 404), f"Expected 200 or 404, got {r.status_code}"
        data = r.json()
        return f"Clean response (HTTP {r.status_code})"
    test("GET /twin/{user_id} (empty twin check)", test_twin_not_found)

    # 6. POST /chat with SSE streaming (The critical blank-bubble check!)
    def test_chat_sse():
        uid = test_user_id or "demo_user"
        r = requests.post(
            f"{base_url}/chat",
            headers={"Accept": "text/event-stream", "Content-Type": "application/json"},
            json={
                "user_id": uid,
                "question": "What is HbA1c and why does it matter for Type 2 Diabetes?",
                "mode": "patient",
                "lang": "en-IN"
            },
            timeout=60,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        events = parse_sse_events(r.text)
        assert len(events) > 0, "No SSE events received from /chat stream!"

        # Check for result event
        result_events = [e for e in events if e.get("type") == "result"]
        assert len(result_events) > 0, "Missing result event in SSE stream"
        res = result_events[0]
        assert "answer" in res and res["answer"], "Result answer is blank!"
        assert "sources" in res and isinstance(res["sources"], list), "Sources must be a list"
        return f"Received {len(events)} SSE events; Answer length: {len(res['answer'])} chars"
    test("POST /chat (SSE Streaming + Non-blank bubble check)", test_chat_sse)

    # 7. POST /chat with Accept: application/json
    def test_chat_json():
        uid = test_user_id or "demo_user"
        r = requests.post(
            f"{base_url}/chat",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json={
                "user_id": uid,
                "question": "I have an earache and headache.",  # Off-topic check
                "mode": "patient"
            },
            timeout=30,
        )
        assert r.status_code == 200, f"Expected 200, got {r.status_code}"
        data = r.json()
        assert "answer" in data, "No answer returned"
        assert "only handle" in data["answer"].lower() or "diabetes" in data["answer"].lower(), "Scope guard did not flag off-topic question"
        return f"Off-topic guard triggered correctly: {data['answer'][:50]}..."
    test("POST /chat (Scope guard off-topic refusal)", test_chat_json)

    # 8. CORS Preflight
    def test_cors():
        r = requests.options(
            f"{base_url}/chat",
            headers={
                "Origin": "https://gentle-tree-0d75a2100.1.azurestaticapps.net",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "Content-Type, Accept",
            },
            timeout=10,
        )
        assert r.status_code == 200, f"CORS preflight failed with {r.status_code}"
        allow_origin = r.headers.get("access-control-allow-origin")
        assert allow_origin == "https://gentle-tree-0d75a2100.1.azurestaticapps.net", f"Unexpected allow-origin: {allow_origin}"
        return "CORS preflight headers OK"
    test("OPTIONS /chat (CORS Preflight)", test_cors)

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Backend base URL")
    args = parser.parse_args()
    success = run_smoke_tests(args.url.rstrip("/"))
    sys.exit(0 if success else 1)
