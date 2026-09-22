"""
Speech-to-speech wrapping: audio in -> text (via /chat) -> audio out.
"""
import io
from fastapi import APIRouter, UploadFile
from fastapi.responses import Response
import azure.cognitiveservices.speech as sdk
import config

router = APIRouter()


@router.post("/speech/transcribe")
async def transcribe(file: UploadFile):
    audio_bytes = await file.read()
    speech_config = sdk.SpeechConfig(subscription=config.SPEECH_KEY, region=config.SPEECH_REGION)

    stream = sdk.audio.PushAudioInputStream()
    stream.write(audio_bytes)
    stream.close()
    audio_config = sdk.audio.AudioConfig(stream=stream)

    recognizer = sdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
    result = recognizer.recognize_once()

    if result.reason != sdk.ResultReason.RecognizedSpeech:
        return {"text": "", "error": str(result.reason)}
    return {"text": result.text}


@router.post("/speech/speak")
def speak(payload: dict):
    speech_config = sdk.SpeechConfig(subscription=config.SPEECH_KEY, region=config.SPEECH_REGION)
    # No audio_config passed in -> synthesizes to an in-memory result instead of a file/speaker.
    synthesizer = sdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_text_async(payload["text"]).get()

    if result.reason != sdk.ResultReason.SynthesizingAudioCompleted:
        return Response(content=b"", status_code=500)
    return Response(content=result.audio_data, media_type="audio/wav")
