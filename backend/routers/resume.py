import json
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from database import get_connection
from services.tailoring import generate_resume
from services.vector_store import retrieve_top_k
from schemas import JobDescription, ProfileItem, ResumeResponse
from config import TOP_K_CHUNKS


def strip_html(html: str) -> str:
    """Strip HTML tags to get plain resume text for ATS scoring."""
    text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def fetch_all_profile_items() -> list[ProfileItem]:
    """
    Fetch every profile item from SQLite for resume generation.
    Education, experience, certs, projects must ALWAYS appear in the resume
    regardless of semantic similarity to the JD — so we use the DB, not ChromaDB.
    """
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, user_id, type, content, tags FROM profile_items WHERE user_id=1 ORDER BY type, id"
    ).fetchall()
    conn.close()
    return [
        ProfileItem(
            id=row["id"],
            user_id=row["user_id"],
            type=row["type"],
            content=row["content"],
            tags=row["tags"] or ""
        )
        for row in rows
    ]


router = APIRouter()


class GenerateResumeRequest(BaseModel):
    job_id: int
    job_description: JobDescription
    top_chunks: Optional[list[ProfileItem]] = None  # ignored — full profile always used


@router.post("", response_model=ResumeResponse)
def generate_resume_endpoint(request: GenerateResumeRequest):
    """
    Generate a tailored, ATS-safe resume PDF.
    Always uses the full profile from SQLite so education/experience are never missed.
    Saves HTML + PDF path to SQLite. Returns HTML preview + PDF path + ATS score.
    """
    # Always use full profile from DB — semantic search would miss education
    # (e.g. Food Technology degree has low similarity to QA Engineer JD)
    all_chunks = fetch_all_profile_items()
    if not all_chunks:
        raise HTTPException(
            status_code=400,
            detail="No profile found. Please upload your resume via POST /profile/upload-resume."
        )
    print(f"[Resume] Using all {len(all_chunks)} profile items for tailoring")

    try:
        html_content, pdf_path = generate_resume(
            job_id=request.job_id,
            jd=request.job_description,
            top_chunks=all_chunks
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Resume generation failed: {str(e)}")

    # Score the ACTUAL generated resume text against the full JD
    from services.scorer import hybrid_score
    jd = request.job_description
    resume_text = strip_html(html_content)
    jd_text = (
        f"{jd.job_title} {jd.company_name} "
        f"{' '.join(jd.required_skills)} "
        f"{' '.join(jd.core_responsibilities)} "
        f"{' '.join(jd.preferred_certifications)}"
    )
    breakdown = hybrid_score(jd_text, resume_text, jd.required_skills)

    print(f"[Resume] ATS Score: {breakdown.total:.4f} "
          f"(SBERT={breakdown.sbert:.2f}, TF-IDF={breakdown.tfidf:.2f}, "
          f"Boolean={breakdown.boolean:.2f})")

    # Save to DB — upsert job row first to satisfy foreign key constraint
    conn = get_connection()
    import json as _json
    conn.execute(
        """INSERT OR IGNORE INTO jobs
           (id, user_id, job_title, company_name, extracted_skills_json, status)
           VALUES (?, 1, ?, ?, ?, 'reviewed')""",
        (request.job_id, jd.job_title, jd.company_name, _json.dumps(jd.required_skills))
    )
    conn.execute(
        """INSERT INTO tailored_resumes (job_id, resume_html, pdf_path, match_score_breakdown)
           VALUES (?, ?, ?, ?)""",
        (request.job_id, html_content, pdf_path, json.dumps(breakdown.model_dump()))
    )
    conn.execute(
        "UPDATE jobs SET match_score=?, status='reviewed' WHERE id=?",
        (breakdown.total, request.job_id)
    )
    conn.commit()
    conn.close()

    return ResumeResponse(
        job_id=request.job_id,
        resume_html=html_content,
        pdf_path=pdf_path,
        match_score=breakdown.total
    )


@router.get("/download/{job_id}")
def download_resume(job_id: int):
    """Download the generated PDF resume for a job."""
    conn = get_connection()
    row = conn.execute(
        "SELECT pdf_path FROM tailored_resumes WHERE job_id=? ORDER BY id DESC LIMIT 1",
        (job_id,)
    ).fetchone()
    conn.close()

    if not row or not row["pdf_path"]:
        raise HTTPException(status_code=404, detail="No resume found for this job_id.")

    return FileResponse(
        path=row["pdf_path"],
        media_type="application/pdf",
        filename=f"resume_job_{job_id}.pdf"
    )
