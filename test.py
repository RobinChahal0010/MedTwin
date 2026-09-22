# import os
# from dotenv import load_dotenv
# load_dotenv()

# def check(name, fn):
#     try:
#         print(f"PASS  {name}: {fn()}")
#     except Exception as e:
#         print(f"FAIL  {name}: {type(e).__name__}: {str(e)[:300]}")

# def oai():
#     from openai import OpenAI
#     return OpenAI(base_url=os.getenv("AZURE_OPENAI_ENDPOINT").rstrip("/") + "/",
#                   api_key=os.getenv("AZURE_OPENAI_KEY"))

# def test_chat():
#     r = oai().chat.completions.create(model=os.getenv("CHAT_DEPLOYMENT"),
#         messages=[{"role": "user", "content": "Reply with the single word: ready"}])
#     return r.choices[0].message.content

# def test_embed():
#     r = oai().embeddings.create(model=os.getenv("EMBED_DEPLOYMENT"), input="HbA1c goal")
#     return f"vector length {len(r.data[0].embedding)}"   # expect 1536 for text-embedding-3-small

# def test_search():
#     from azure.search.documents import SearchClient
#     from azure.core.credentials import AzureKeyCredential
#     s = SearchClient(os.getenv("SEARCH_ENDPOINT").strip(), os.getenv("SEARCH_INDEX"),
#                      AzureKeyCredential(os.getenv("SEARCH_QUERY_KEY")))
#     hits = list(s.search(search_text="HbA1c goal", top=3))
#     if not hits:
#         return "connected, but 0 results (index empty or still building)"
#     fields = [k for k in hits[0] if not k.startswith("@")]
#     return f"{len(hits)} hits; fields={fields}; first title={hits[0].get('title')}"

# def test_blob():
#     from azure.storage.blob import BlobServiceClient
#     b = BlobServiceClient.from_connection_string(os.getenv("STORAGE_CONNECTION_STRING"))
#     containers = [c.name for c in b.list_containers()]
#     files = [x.name for x in b.get_container_client("guidelines").list_blobs()]
#     return f"containers={containers}; guidelines files={files}"

# def test_speech():
#     import azure.cognitiveservices.speech as sdk
#     cfg = sdk.SpeechConfig(subscription=os.getenv("SPEECH_KEY"), region=os.getenv("SPEECH_REGION"))
#     synth = sdk.SpeechSynthesizer(speech_config=cfg,
#         audio_config=sdk.audio.AudioOutputConfig(filename="speech_test.wav"))
#     res = synth.speak_text_async("Your hemoglobin A one C goal is below seven percent.").get()
#     del synth  # releases the wav file
#     if res.reason != sdk.ResultReason.SynthesizingAudioCompleted:
#         raise RuntimeError(f"text-to-speech failed: {res.reason}")
#     rec = sdk.SpeechRecognizer(speech_config=cfg,
#         audio_config=sdk.audio.AudioConfig(filename="speech_test.wav"))
#     return f"TTS ok; STT heard: {rec.recognize_once().text!r}"

# check("Chat model", test_chat)
# check("Embedding model", test_embed)
# check("AI Search index", test_search)
# check("Blob storage", test_blob)
# check("Speech (TTS + STT)", test_speech)


from pymongo import MongoClient
c = MongoClient("mongodb+srv://dbuser3snrln:<password>@docdb-cluster-20260922-0616.global.mongocluster.cosmos.azure.com/?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false&maxIdleTimeMS=120000")
print(c.list_database_names())  # should return without erroring