import os
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import get_connection
from services.profile_parser import parse_resume
from services.vector_store import embed_and_store
from schemas import ProfileItem, ProfileUploadResponse, ProfileListResponse
from config import UPLOAD_DIR

router = APIRouter()


@router.post("/upload-resume", response_model=ProfileUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """
    Upload a PDF or DOCX resume.
    Parses it into structured profile items, stores in SQLite + ChromaDB.
    """
    # Validate file type
    allowed = {".pdf", ".docx"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Only PDF and DOCX files are supported. Got: {ext}")

    # Save uploaded file temporarily
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        # Parse resume → profile items
        items = parse_resume(save_path)

        if not items:
            raise HTTPException(status_code=422, detail="No profile items could be extracted from the file.")

        # Store in SQLite + ChromaDB
        conn = get_connection()
        stored_items = []

        for item in items:
            cursor = conn.execute(
                "INSERT INTO profile_items (user_id, type, content, tags) VALUES (?, ?, ?, ?)",
                (1, item.type, item.content, item.tags)   # user_id=1 for single-user MVP
            )
            item_id = cursor.lastrowid

            # Embed and store in ChromaDB
            embed_and_store(
                item_id=item_id,
                content=item.content,
                metadata={"type": item.type, "tags": item.tags or ""}
            )

            stored_items.append(ProfileItem(
                id=item_id,
                user_id=1,
                type=item.type,
                content=item.content,
                tags=item.tags
            ))

        conn.commit()
        conn.close()

    finally:
        # Delete uploaded file after processing (privacy by design)
        if os.path.exists(save_path):
            os.remove(save_path)

    return ProfileUploadResponse(
        items_created=len(stored_items),
        preview=stored_items[:5]    # return first 5 as a preview
    )


@router.get("", response_model=ProfileListResponse)
def get_profile():
    """Return all stored profile items."""
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, user_id, type, content, tags FROM profile_items WHERE user_id = 1 ORDER BY type, id"
    ).fetchall()
    conn.close()

    items = [
        ProfileItem(
            id=row["id"],
            user_id=row["user_id"],
            type=row["type"],
            content=row["content"],
            tags=row["tags"]
        )
        for row in rows
    ]
    return ProfileListResponse(items=items)


@router.delete("/clear")
def clear_profile():
    """
    Delete all profile items (SQLite + ChromaDB).
    Useful for re-uploading a fresh resume.
    """
    conn = get_connection()
    conn.execute("DELETE FROM profile_items WHERE user_id = 1")
    conn.commit()
    conn.close()

    # Also clear ChromaDB collection — recreate with cosine similarity metadata
    from services.vector_store import _client
    from config import CHROMA_COLLECTION
    _client.delete_collection(CHROMA_COLLECTION)
    _client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"}
    )

    return {"status": "cleared"}
