from pydantic import BaseModel
from typing import Optional


# ─── Profile ────────────────────────────────────────────────────────────────

class ProfileItem(BaseModel):
    id: Optional[int] = None
    user_id: Optional[int] = None
    type: str          # project | cert | education | skill | experience
    content: str
    tags: Optional[str] = None   # comma-separated keywords


class ProfileUploadResponse(BaseModel):
    items_created: int
    preview: list[ProfileItem]


class ProfileListResponse(BaseModel):
    items: list[ProfileItem]


# ─── Job Description ─────────────────────────────────────────────────────────

class JobDescription(BaseModel):
    company_name: str
    job_title: str
    core_responsibilities: list[str]
    required_skills: list[str]
    preferred_certifications: list[str]
    minimum_years_experience: Optional[int] = None
    location: Optional[str] = None
    employment_type: Optional[str] = None


class JobDescriptionResponse(JobDescription):
    job_id: int


# ─── Match ───────────────────────────────────────────────────────────────────

class ScoreBreakdown(BaseModel):
    sbert: float
    tfidf: float
    boolean: float
    total: float


class MatchResponse(BaseModel):
    job_id: int
    top_chunks: list[ProfileItem]
    match_score: float
    breakdown: ScoreBreakdown
    missing_skills: list[str]


# ─── Resume ──────────────────────────────────────────────────────────────────

class ResumeResponse(BaseModel):
    job_id: int
    resume_html: str
    pdf_path: str
    match_score: float


# ─── Email ───────────────────────────────────────────────────────────────────

class EmailDraftResponse(BaseModel):
    draft_id: int
    subject: str
    body: str
