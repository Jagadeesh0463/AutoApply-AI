from fastapi import APIRouter, HTTPException
from services.scorer import match_profile_to_jd
from services.vector_store import collection_count
from schemas import JobDescription, MatchResponse
from database import get_connection

router = APIRouter()


@router.post("", response_model=MatchResponse)
def match(job_description: JobDescription):
    """
    Match the stored profile against a JD.
    Returns top-k relevant profile chunks + hybrid match score + missing skills.

    Requires: profile must be uploaded first via POST /profile/upload-resume
    """
    if collection_count() == 0:
        raise HTTPException(
            status_code=400,
            detail="No profile found. Please upload your resume first via POST /profile/upload-resume"
        )

    # Get the latest job_id for this JD (inserted during /extract step)
    conn = get_connection()
    row = conn.execute(
        "SELECT id FROM jobs WHERE job_title=? AND company_name=? ORDER BY id DESC LIMIT 1",
        (job_description.job_title, job_description.company_name)
    ).fetchone()

    if row:
        job_id = row["id"]
    else:
        # If called directly without /extract, create a job record now
        cursor = conn.execute(
            """INSERT INTO jobs (user_id, company_name, job_title, status)
               VALUES (1, ?, ?, 'pending')""",
            (job_description.company_name, job_description.job_title)
        )
        conn.commit()
        job_id = cursor.lastrowid

    conn.close()

    result = match_profile_to_jd(job_id, job_description)

    # Update match score in jobs table
    conn = get_connection()
    conn.execute(
        "UPDATE jobs SET match_score=? WHERE id=?",
        (result.match_score, job_id)
    )
    conn.commit()
    conn.close()

    return result
