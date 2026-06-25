import json
import os
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import get_connection
from schemas import JobDescription, ProfileItem, EmailDraftResponse
from services.email_writer import draft_cold_email
from services.gmail_sender import send_email_with_attachment, is_gmail_authorized

router = APIRouter()


class EmailDraftRequest(BaseModel):
    job_id: int
    recipient_email: str


def fetch_all_profile_items() -> list[ProfileItem]:
    """Fetch all profile items from SQLite for email drafting."""
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


def fetch_job(job_id: int) -> dict:
    """Fetch job details from SQLite by job_id."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM jobs WHERE id=?", (job_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


@router.post("/draft", response_model=EmailDraftResponse)
def create_email_draft(request: EmailDraftRequest):
    """
    Draft a personalized cold email for a job.
    Auto-fetches job details and full profile from DB.
    Saves draft to email_drafts table.
    """
    # Fetch job from DB
    job = fetch_job(request.job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail=f"Job #{request.job_id} not found. Run /extract or /generate-resume first."
        )

    # Fetch full profile
    profile_items = fetch_all_profile_items()
    if not profile_items:
        raise HTTPException(
            status_code=400,
            detail="No profile found. Please upload your resume via POST /profile/upload-resume."
        )

    # Reconstruct JD from stored data
    skills = json.loads(job["extracted_skills_json"]) if job.get("extracted_skills_json") else []
    jd = JobDescription(
        job_title=job["job_title"],
        company_name=job["company_name"],
        core_responsibilities=[],   # not stored separately — email prompt uses skills + title
        required_skills=skills,
        preferred_certifications=[],
    )

    print(f"[Email] Drafting cold email for {jd.job_title} @ {jd.company_name}")

    try:
        result = draft_cold_email(jd, profile_items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Email drafting failed: {str(e)}")

    # Save draft to DB
    conn = get_connection()
    cursor = conn.execute(
        """INSERT INTO email_drafts (job_id, recipient_email, subject, body, send_status)
           VALUES (?, ?, ?, ?, 'draft')""",
        (request.job_id, request.recipient_email, result["subject"], result["body"])
    )
    draft_id = cursor.lastrowid
    conn.commit()
    conn.close()

    print(f"[Email] Draft #{draft_id} saved.")

    return EmailDraftResponse(
        draft_id=draft_id,
        subject=result["subject"],
        body=result["body"]
    )


@router.get("/drafts")
def list_drafts():
    """List all saved email drafts."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT d.id, d.job_id, j.job_title, j.company_name,
                  d.recipient_email, d.subject, d.send_status, d.sent_at
           FROM email_drafts d
           JOIN jobs j ON d.job_id = j.id
           ORDER BY d.id DESC"""
    ).fetchall()
    conn.close()
    return {"drafts": [dict(r) for r in rows]}


@router.get("/draft/{draft_id}")
def get_draft(draft_id: int):
    """Get a specific email draft by ID."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM email_drafts WHERE id=?", (draft_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail=f"Draft #{draft_id} not found.")
    return dict(row)


class EmailEditRequest(BaseModel):
    subject: str | None = None
    body: str | None = None


@router.post("/send/{draft_id}")
def send_draft(draft_id: int, edits: EmailEditRequest | None = None):
    """
    Send a saved email draft via Gmail with the tailored resume PDF attached.
    Requires Gmail to be authorized first via GET /auth/gmail.
    """
    # Check Gmail is authorized
    if not is_gmail_authorized():
        raise HTTPException(
            status_code=403,
            detail="Gmail not authorized. Visit http://localhost:8000/auth/gmail to connect Gmail first."
        )

    # Fetch draft
    conn = get_connection()
    draft = conn.execute(
        "SELECT * FROM email_drafts WHERE id=?", (draft_id,)
    ).fetchone()
    conn.close()

    if not draft:
        raise HTTPException(status_code=404, detail=f"Draft #{draft_id} not found.")

    draft = dict(draft)

    # Apply any user edits (subject/body) before sending
    if edits:
        if edits.subject:
            draft["subject"] = edits.subject
        if edits.body:
            draft["body"] = edits.body
        if edits.subject or edits.body:
            conn = get_connection()
            conn.execute(
                "UPDATE email_drafts SET subject=?, body=? WHERE id=?",
                (draft["subject"], draft["body"], draft_id)
            )
            conn.commit()
            conn.close()

    if draft["send_status"] == "sent":
        raise HTTPException(status_code=400, detail="This draft has already been sent.")

    # Fetch PDF path from tailored_resumes for this job
    conn = get_connection()
    resume_row = conn.execute(
        "SELECT pdf_path FROM tailored_resumes WHERE job_id=? ORDER BY id DESC LIMIT 1",
        (draft["job_id"],)
    ).fetchone()
    conn.close()

    pdf_path = resume_row["pdf_path"] if resume_row else None

    # Fetch job title for PDF filename
    conn = get_connection()
    job_row = conn.execute(
        "SELECT job_title, company_name FROM jobs WHERE id=?", (draft["job_id"],)
    ).fetchone()
    conn.close()

    job_title = job_row["job_title"] if job_row else "Resume"
    company = job_row["company_name"] if job_row else ""
    pdf_filename = f"Jagadeesh_Resume_{job_title.replace(' ', '_')}_{company.replace(' ', '_')}.pdf"

    print(f"[Email] Sending draft #{draft_id} to {draft['recipient_email']} "
          f"| PDF: {pdf_path}")

    try:
        message_id = send_email_with_attachment(
            to=draft["recipient_email"],
            subject=draft["subject"],
            body=draft["body"],
            pdf_path=pdf_path,
            pdf_filename=pdf_filename,
        )
    except Exception as e:
        # Mark as failed in DB
        conn = get_connection()
        conn.execute(
            "UPDATE email_drafts SET send_status='failed' WHERE id=?", (draft_id,)
        )
        conn.commit()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Send failed: {str(e)}")

    # Mark as sent
    conn = get_connection()
    conn.execute(
        "UPDATE email_drafts SET send_status='sent', sent_at=? WHERE id=?",
        (datetime.utcnow().isoformat(), draft_id)
    )
    conn.commit()
    conn.close()

    print(f"[Email] ✅ Sent! Gmail message ID: {message_id}")

    return {
        "success": True,
        "draft_id": draft_id,
        "gmail_message_id": message_id,
        "sent_to": draft["recipient_email"],
        "subject": draft["subject"],
        "pdf_attached": pdf_path is not None and os.path.exists(pdf_path) if pdf_path else False,
    }
