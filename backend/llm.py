"""
Every call to the deployed chat model goes through ask_llm(), so there is
one place that knows how to talk to Azure OpenAI.
"""
import json
from openai import OpenAI
import config

_client = OpenAI(
    base_url=config.AZURE_OPENAI_ENDPOINT.rstrip("/") + "/",
    api_key=config.AZURE_OPENAI_KEY,
)


def ask_llm(instructions: str, message: str, json_mode: bool = False):
    """
    instructions: the system prompt (the agent's job description).
    message: the user-turn content (the actual question/data).
    json_mode=True: asks the model to return ONLY a JSON object and parses it.
    Returns a str normally, or a dict when json_mode is True.
    """
    if json_mode:
        instructions += "\nRespond with ONLY a valid JSON object. No prose, no markdown fences."

    response = _client.chat.completions.create(
        model=config.CHAT_DEPLOYMENT,
        messages=[
            {"role": "system", "content": instructions},
            {"role": "user", "content": message},
        ],
        temperature=0,
    )
    text = response.choices[0].message.content.strip()

    if not json_mode:
        return text

    # Some models wrap JSON in ```json fences even when told not to — strip them.
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0]
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM did not return valid JSON: {text[:300]}") from e
