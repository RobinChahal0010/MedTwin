"""
Speech-to-speech wrapping: audio in -> text (via /chat) -> audio out.
Supports Indian regional languages, WebM Opus, OGG, and WAV formats.
"""
import io
import json
import logging
import asyncio
from fastapi import APIRouter, UploadFile, Form, HTTPException
from fastapi.responses import Response
import httpx
import azure.cognitiveservices.speech as sdk
import config

logger = logging.getLogger(__name__)
router = APIRouter()

SUPPORTED_LANGUAGES = [
    {"code": "en-IN", "label": "English (India)"},
    {"code": "hi-IN", "label": "हिन्दी (Hindi)"},
    {"code": "bn-IN", "label": "বাংলা (Bengali)"},
    {"code": "ta-IN", "label": "தமிழ் (Tamil)"},
    {"code": "te-IN", "label": "తెలుగు (Telugu)"},
    {"code": "mr-IN", "label": "मराठी (Marathi)"},
    {"code": "en-US", "label": "English (US)"},
]

VOICE_MAP = {
    "en-IN": "en-IN-NeerjaNeural",
    "hi-IN": "hi-IN-SwaraNeural",
    "bn-IN": "bn-IN-TanishaaNeural",
    "ta-IN": "ta-IN-PallaviNeural",
    "te-IN": "te-IN-ShrutiNeural",
    "mr-IN": "mr-IN-AarohiNeural",
    "en-US": "en-US-JennyNeural",
}

# Minimum audio size: 16 kHz mono 16-bit WAV for ~1 second = 32000 bytes,
# but WebM containers have overhead; use 2 KB as a lower bound (short fragments).
MIN_AUDIO_BYTES = 2000


def _detect_audio_content_type(audio_bytes: bytes, filename: str = "", hint: str = "") -> str:
    """Detect audio MIME type from magic bytes, filename, and content-type hint."""
    if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        return "audio/wav"
    if audio_bytes[:4] == b"\x1a\x45\xdf\xa3" or audio_bytes[:3] == b"\x1a\x45\xdf":
        return "audio/webm; codecs=opus"
    if audio_bytes[:4] == b"OggS":
        return "audio/ogg; codecs=opus"
    if "webm" in hint.lower() or filename.lower().endswith(".webm"):
        return "audio/webm; codecs=opus"
    if "ogg" in hint.lower() or filename.lower().endswith(".ogg"):
        return "audio/ogg; codecs=opus"
    if "wav" in hint.lower() or filename.lower().endswith(".wav"):
        return "audio/wav"
    # Default to WAV for unknown (frontend sends converted WAV)
    return "audio/wav"


def _format_hex(data: bytes) -> str:
    return " ".join(f"{b:02x}" for b in data[:16])


def _rest_content_type_for_azure(detected: str) -> str:
    """Map detected MIME to the Content-Type Azure Speech REST expects."""
    if "webm" in detected:
        return "audio/webm; codecs=opus"
    if "ogg" in detected:
        return "audio/ogg; codecs=opus"
    # WAV: Azure expects the exact format. For converted 16kHz 16-bit mono WAV:
    return "audio/wav; codecs=audio/pcm; samplerate=16000"


@router.get("/languages")
def get_languages():
    return {"languages": SUPPORTED_LANGUAGES}


@router.post("/speech/transcribe")
async def transcribe(file: UploadFile, lang: str = Form("en-IN")):
    lang = (lang or "en-IN").strip()
    audio_bytes = await file.read()
    filename = (file.filename or "").lower()
    content_type_hint = file.content_type or ""

    # ── Diagnostics: always log so we can see what arrives ──────────────────
    detected_type = _detect_audio_content_type(audio_bytes, filename, content_type_hint)
    logger.info(
        "TRANSCRIBE REQUEST | lang=%s | size=%d bytes | content_type_hint=%r "
        "| filename=%r | detected_type=%s | first_16_bytes=%s",
        lang, len(audio_bytes), content_type_hint, filename, detected_type,
        _format_hex(audio_bytes),
    )

    # ── Guards ───────────────────────────────────────────────────────────────
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Empty audio file received — nothing to transcribe.")

    if len(audio_bytes) < MIN_AUDIO_BYTES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Recording is too short ({len(audio_bytes)} bytes). "
                "Please speak for at least 1 second before stopping."
            )
        )

    # ── Azure Speech REST API ────────────────────────────────────────────────
    rest_ct = _rest_content_type_for_azure(detected_type)
    stt_url = (
        f"https://{config.SPEECH_REGION}.stt.speech.microsoft.com/"
        f"speech/recognition/conversation/cognitiveservices/v1?language={lang}"
    )
    headers = {
        "Ocp-Apim-Subscription-Key": config.SPEECH_KEY,
        "Content-Type": rest_ct,
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(stt_url, headers=headers, content=audio_bytes)

        logger.info(
            "AZURE SPEECH REST response | HTTP %d | body=%s",
            resp.status_code, resp.text[:300],
        )

        if resp.status_code == 200:
            data = resp.json()
            status = data.get("RecognitionStatus", "Unknown")
            logger.info("AZURE SPEECH STATUS: %s", status)

            if status == "Success":
                return {"text": data.get("DisplayText", "")}

            # Any non-Success result is an error, not silent empty text
            if status == "NoMatch":
                raise HTTPException(
                    status_code=422,
                    detail="No speech detected in audio. Please speak clearly and try again."
                )
            if status in ("InitialSilenceTimeout", "EndSilenceTimeout"):
                raise HTTPException(
                    status_code=422,
                    detail="Recording contains only silence. Please speak louder or closer to the mic."
                )
            if status == "Canceled":
                cancel_reason = data.get("CancellationReason", "Unknown")
                error_code = data.get("CancellationErrorCode", "")
                logger.error("AZURE SPEECH CANCELED | reason=%s | code=%s", cancel_reason, error_code)
                raise HTTPException(
                    status_code=502,
                    detail=f"Azure Speech recognition was canceled: {cancel_reason} (code: {error_code})"
                )
            raise HTTPException(
                status_code=502,
                detail=f"Azure Speech returned unexpected status: {status}"
            )

        # HTTP error from Azure
        logger.error(
            "AZURE SPEECH REST HTTP error | %d | %s",
            resp.status_code, resp.text[:300]
        )
        raise HTTPException(
            status_code=502,
            detail=f"Azure Speech REST API returned HTTP {resp.status_code}: {resp.text[:200]}"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Azure Speech REST API request failed: %s", str(e)[:300])

    # ── SDK fallback (WAV only; WebM may still fail without GStreamer) ───────
    if "wav" not in detected_type:
        raise HTTPException(
            status_code=422,
            detail=(
                "Speech REST API failed and SDK fallback requires WAV format. "
                "Please re-record or check your Azure Speech key/region."
            )
        )

    def _sdk_transcribe():
        import tempfile
        import os
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            speech_config = sdk.SpeechConfig(
                subscription=config.SPEECH_KEY,
                region=config.SPEECH_REGION,
            )
            speech_config.speech_recognition_language = lang
            audio_config = sdk.audio.AudioConfig(filename=tmp_path)
            recognizer = sdk.SpeechRecognizer(
                speech_config=speech_config, audio_config=audio_config
            )
            result = recognizer.recognize_once()
            del recognizer
            del audio_config

            logger.info(
                "SDK fallback result | reason=%s | text=%r",
                result.reason, getattr(result, "text", "")
            )

            if result.reason == sdk.ResultReason.RecognizedSpeech:
                return {"text": result.text}

            if result.reason == sdk.ResultReason.NoMatch:
                detail = f"No speech detected by SDK (NoMatch: {result.no_match_details})"
                logger.warning("SDK NoMatch: %s", detail)
                raise HTTPException(
                    status_code=422,
                    detail="No speech detected. Please speak clearly and try again."
                )

            if result.reason == sdk.ResultReason.Canceled:
                cancellation = sdk.CancellationDetails(result)
                logger.error(
                    "SDK Canceled | reason=%s | error_code=%s | message=%s",
                    cancellation.reason, cancellation.error_code, cancellation.error_details
                )
                raise HTTPException(
                    status_code=502,
                    detail=(
                        f"Speech recognition canceled: {cancellation.reason}. "
                        f"Error: {cancellation.error_details}"
                    )
                )

            raise HTTPException(
                status_code=502,
                detail=f"Unexpected SDK result reason: {result.reason}"
            )
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    return await asyncio.to_thread(_sdk_transcribe)


MAX_SYNTH_CHARS = 1500


@router.post("/speech/synthesize")
async def synthesize(payload: dict):
    """
    Synthesize text to speech.
    Input:  {"text": str, "lang": str (optional, default en-IN)}
    Output: audio/wav binary
    """
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required for speech synthesis")

    if len(text) > MAX_SYNTH_CHARS:
        text = text[:MAX_SYNTH_CHARS]
        logger.info("SYNTH: text truncated to %d chars", MAX_SYNTH_CHARS)

    lang = (payload.get("lang") or "en-IN").strip()
    voice_name = VOICE_MAP.get(lang, VOICE_MAP["en-IN"])
    logger.info("SYNTH request | lang=%s | voice=%s | chars=%d", lang, voice_name, len(text))

    def _synthesize():
        speech_config = sdk.SpeechConfig(
            subscription=config.SPEECH_KEY,
            region=config.SPEECH_REGION,
        )
        speech_config.speech_synthesis_voice_name = voice_name
        synthesizer = sdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        return synthesizer.speak_text_async(text).get()

    try:
        result = await asyncio.to_thread(_synthesize)
        if result.reason == sdk.ResultReason.SynthesizingAudioCompleted:
            logger.info("SYNTH success | bytes=%d", len(result.audio_data))
            return Response(content=result.audio_data, media_type="audio/wav")

        cancellation = sdk.CancellationDetails(result)
        logger.error(
            "SYNTH failed | reason=%s | error_code=%s | details=%s",
            cancellation.reason, cancellation.error_code, cancellation.error_details,
        )
        raise HTTPException(
            status_code=502,
            detail=f"Speech synthesis failed: {cancellation.reason} — {cancellation.error_details}",
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("SYNTH exception: %s", exc)
        raise HTTPException(status_code=500, detail=f"Speech synthesis error: {str(exc)}")


@router.post("/speech/speak")
async def speak(payload: dict):
    """Alias for /speech/synthesize (backward compatibility)."""
    return await synthesize(payload)
