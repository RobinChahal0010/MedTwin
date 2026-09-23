"""
Test the /speech/transcribe endpoint with speech_test.wav.
Run from MedTwin root: python scripts/test_speech.py
"""
import sys
import requests
from pathlib import Path

BASE = "http://127.0.0.1:8000"
WAV_PATH = Path(__file__).parent.parent / "speech_test.wav"

def main():
    print(f"Testing speech_test.wav -> {BASE}/speech/transcribe")
    if not WAV_PATH.exists():
        print(f"❌ {WAV_PATH} not found")
        sys.exit(1)

    audio_bytes = WAV_PATH.read_bytes()
    print(f"  File size: {len(audio_bytes):,} bytes")
    print(f"  First 16 bytes: {' '.join(f'{b:02x}' for b in audio_bytes[:16])}")

    resp = requests.post(
        f"{BASE}/speech/transcribe",
        files={"file": ("speech_test.wav", audio_bytes, "audio/wav")},
        data={"lang": "en-US"},
        timeout=40,
    )
    print(f"  HTTP {resp.status_code}")
    print(f"  Response: {resp.json()}")
    if resp.status_code == 200 and resp.json().get("text"):
        print("[PASS] Transcription returned text")
    else:
        print("[FAIL] No text returned -- check uvicorn logs for AZURE SPEECH STATUS")
    return resp.status_code == 200

if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
