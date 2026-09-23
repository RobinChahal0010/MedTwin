"""
Speech-to-speech wrapping: audio in -> text (via /chat) -> audio out.
"""
import io
import tempfile
import os
from fastapi import APIRouter, UploadFile, Form
from fastapi.responses import Response
import azure.cognitiveservices.speech as sdk
import config

router = APIRouter()

SUPPORTED_LANGUAGES = [
    {"code": "en-US", "label": "English"},
    {"code": "hi-IN", "label": "हिन्दी"},
]

VOICE_MAP = {
    "en-US": "en-US-JennyNeural",
    "hi-IN": "hi-IN-SwaraNeural",
}


@router.get("/languages")
def get_languages():
    return {"languages": SUPPORTED_LANGUAGES}


@router.post("/speech/transcribe")
async def transcribe(file: UploadFile, lang: str = Form("en-US")):
    lang = lang or "en-US"
    audio_bytes = await file.read()

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    speech_config = sdk.SpeechConfig(subscription=config.SPEECH_KEY, region=config.SPEECH_REGION)
    speech_config.speech_recognition_language = lang
    audio_config = sdk.audio.AudioConfig(filename=tmp_path)
    recognizer = sdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
    result = recognizer.recognize_once()

    # Windows locks the file while the SDK holds it open — drop our
    # references first so the handle is released before we try to delete.
    del recognizer
    del audio_config

    try:
        os.remove(tmp_path)
    except PermissionError:
        pass  # harmless — leftover temp file, OS cleans its temp folder periodically

    if result.reason != sdk.ResultReason.RecognizedSpeech:
        return {"text": "", "error": str(result.reason)}
    return {"text": result.text}


@router.post("/speech/speak")
def speak(payload: dict):
    lang = payload.get("lang", "en-US")
    speech_config = sdk.SpeechConfig(subscription=config.SPEECH_KEY, region=config.SPEECH_REGION)
    speech_config.speech_synthesis_voice_name = VOICE_MAP.get(lang, "en-US-JennyNeural")
    # No audio_config passed in -> synthesizes to an in-memory result instead of a file/speaker.
    synthesizer = sdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_text_async(payload["text"]).get()

    if result.reason != sdk.ResultReason.SynthesizingAudioCompleted:
        return Response(content=b"", status_code=500)
    return Response(content=result.audio_data, media_type="audio/wav")
