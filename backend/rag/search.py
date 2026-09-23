"""
The Knowledge agent's tool: looks up passages from the ADA/NICE guideline
index in Azure AI Search. This is the ONLY place medical facts may come
from — nothing here is invented.
"""
import logging
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizableTextQuery
import config

logger = logging.getLogger(__name__)

_client = SearchClient(
    config.SEARCH_ENDPOINT, config.SEARCH_INDEX,
    AzureKeyCredential(config.SEARCH_QUERY_KEY),
)


def search_guidelines(query: str, top: int = 4) -> list[dict]:
    """Return the best-matching guideline passages for a question or value name."""
    try:
        vq = VectorizableTextQuery(text=query, k_nearest_neighbors=top, fields="text_vector")
        rows = list(_client.search(search_text=query, vector_queries=[vq], top=top))
    except Exception as e:
        logger.warning("Vector search failed, falling back to keyword search: %s", str(e)[:150])
        rows = list(_client.search(search_text=query, top=top))

    return [
        {"text": r["chunk"], "source": r["title"], "score": r.get("@search.score", 0)}
        for r in rows
    ]


def format_passages(passages: list[dict]) -> str:
    """Turns passages into a numbered block ready to paste into an LLM prompt."""
    if not passages:
        return "(no relevant guideline passages found)"
    return "\n\n".join(
        f"[{i+1}] Source: {p['source']}\n{p['text']}" for i, p in enumerate(passages)
    )
