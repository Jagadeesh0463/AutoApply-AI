import os
import json
import shutil
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi import Form
from typing import Optional
from groq import Groq
from database import get_connection
from services.ocr import extract_jd_from_image, EXTRACTION_PROMPT, _parse_json_response
from schemas import JobDescription, JobDescriptionResponse
from config import UPLOAD_DIR, GROQ_API_KEY, GROQ_TEXT_MODEL

router = APIRouter()
client = Groq(api_key=GROQ_API_KEY)


def _save_job(jd: JobDescription) -> int:
    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO jobs (user_id, company_name, job_title, extracted_skills_json, status)
           VALUES (?, ?, ?, ?, 'pending')""",
        (1, jd.company_name, jd.job_title, json.dumps(jd.required_skills))
    )
    conn.commit()
    conn.close()
    return cursor.lastrowid


@router.post("/from-image", response_model=JobDescriptionResponse)
async def extract_from_image(file: UploadFile = File(...)):
    """Upload a screenshot (JPG/PNG/WEBP) → returns structured JD JSON with job_id."""
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        raise HTTPException(status_code=400, detail=f"Only JPG/PNG/WEBP supported. Got: {ext}")

    raw_path = os.path.join(UPLOAD_DIR, f"raw_{file.filename}")
    processed_path = os.path.join(UPLOAD_DIR, f"processed_{file.filename}.jpg")

    with open(raw_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        jd = extract_jd_from_image(raw_path, processed_path)
        job_id = _save_job(jd)
        print(f"[Extract] Saved job #{job_id}: {jd.job_title} @ {jd.company_name}")
        return JobDescriptionResponse(job_id=job_id, **jd.model_dump())
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        for path in [raw_path, processed_path]:
            if os.path.exists(path):
                os.remove(path)


@router.post("/from-text", response_model=JobDescriptionResponse)
async def extract_from_text(jd_text: str = Form(...)):
    """
    Paste raw job description text → returns structured JD JSON.
    Use this when you have the JD text copied from a job board.
    """
    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="jd_text cannot be empty.")

    response = client.chat.completions.create(
        model=GROQ_TEXT_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"{EXTRACTION_PROMPT}\n\nJob posting text:\n{jd_text}"
            }
        ],
        temperature=0.1,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()
    try:
        data = _parse_json_response(raw)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse JD: {e}")

    jd = JobDescription(
        company_name=data.get("company_name", "Unknown"),
        job_title=data.get("job_title", "Unknown"),
        core_responsibilities=data.get("core_responsibilities", []),
        required_skills=data.get("required_skills", []),
        preferred_certifications=data.get("preferred_certifications", []),
        minimum_years_experience=data.get("minimum_years_experience"),
    )
    job_id = _save_job(jd)
    print(f"[Extract] Saved job #{job_id}: {jd.job_title} @ {jd.company_name}")
    return JobDescriptionResponse(job_id=job_id, **jd.model_dump())
