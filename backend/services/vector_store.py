import chromadb
from sentence_transformers import SentenceTransformer
from config import CHROMA_DIR, CHROMA_COLLECTION, EMBEDDING_MODEL
from schemas import ProfileItem

# Load embedding model once at import time (runs locally, no API cost)
print(f"[VectorStore] Loading embedding model: {EMBEDDING_MODEL}")
_model = SentenceTransformer(EMBEDDING_MODEL)

# PersistentClient saves to disk — survives restarts
_client = chromadb.PersistentClient(path=CHROMA_DIR)
_collection = _client.get_or_create_collection(
    name=CHROMA_COLLECTION,
    metadata={"hnsw:space": "cosine"}   # cosine similarity
)
print(f"[VectorStore] ChromaDB ready at {CHROMA_DIR}")


def embed_and_store(item_id: int, content: str, metadata: dict) -> None:
    """Embed a profile item and upsert into ChromaDB."""
    embedding = _model.encode(content).tolist()
    _collection.upsert(
        ids=[str(item_id)],
        embeddings=[embedding],
        documents=[content],
        metadatas=[metadata]
    )


def retrieve_top_k(query_text: str, k: int = 8) -> list[ProfileItem]:
    """
    Retrieve the top-k most relevant profile chunks for a given query.
    Returns a list of ProfileItem objects.
    """
    if _collection.count() == 0:
        return []

    query_embedding = _model.encode(query_text).tolist()
    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=min(k, _collection.count())
    )

    chunks = []
    for i, doc_id in enumerate(results["ids"][0]):
        meta = results["metadatas"][0][i] if results["metadatas"] else {}
        chunks.append(ProfileItem(
            id=int(doc_id),
            content=results["documents"][0][i],
            type=meta.get("type", "info"),
            tags=meta.get("tags", ""),
        ))
    return chunks


def get_embedding(text: str) -> list[float]:
    """Return embedding vector for any text (used in scoring)."""
    return _model.encode(text).tolist()


def collection_count() -> int:
    return _collection.count()
