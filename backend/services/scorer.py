import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from services.vector_store import get_embedding, retrieve_top_k
from schemas import JobDescription, ProfileItem, MatchResponse, ScoreBreakdown
from config import SBERT_WEIGHT, TFIDF_WEIGHT, BOOLEAN_WEIGHT, TOP_K_CHUNKS


# ─── Individual scoring components ───────────────────────────────────────────

def sbert_score(jd_text: str, resume_text: str) -> float:
    """Semantic similarity using sentence-transformers embeddings."""
    jd_emb = np.array(get_embedding(jd_text)).reshape(1, -1)
    res_emb = np.array(get_embedding(resume_text)).reshape(1, -1)
    score = cosine_similarity(jd_emb, res_emb)[0][0]
    return float(round(score, 4))


def tfidf_score(jd_text: str, resume_text: str) -> float:
    """Lexical keyword overlap using TF-IDF cosine similarity."""
    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf_matrix = vectorizer.fit_transform([jd_text, resume_text])
        score = cosine_similarity(tfidf_matrix[0], tfidf_matrix[1])[0][0]
        return float(round(score, 4))
    except Exception:
        return 0.0


def boolean_score(required_skills: list[str], resume_text: str) -> float:
    """
    Checks what fraction of required skills appear in the resume.
    Handles multi-word skills by checking if ANY key token from the skill is present.
    e.g. "SQL & database validation basics" → checks "sql", "database", "validation"
    """
    if not required_skills:
        return 0.0
    resume_lower = resume_text.lower()

    # Stop words to ignore when splitting multi-word skills
    stop = {"and", "&", "the", "a", "an", "of", "for", "in", "with", "basics", "based"}

    def skill_found(skill: str) -> bool:
        skill_lower = skill.lower()
        # First try exact match
        if skill_lower in resume_lower:
            return True
        # Then try matching key tokens (ignore stop words)
        tokens = [t for t in skill_lower.replace("&", " ").split() if t not in stop and len(t) > 2]
        if not tokens:
            return False
        # Skill is found if majority of key tokens are present
        hits = sum(1 for t in tokens if t in resume_lower)
        return hits >= max(1, len(tokens) // 2)

    hits = sum(1 for skill in required_skills if skill_found(skill))
    return float(round(hits / len(required_skills), 4))


def hybrid_score(jd_text: str, resume_text: str, required_skills: list[str]) -> ScoreBreakdown:
    """Weighted combination of SBERT + TF-IDF + Boolean scores."""
    s = sbert_score(jd_text, resume_text)
    t = tfidf_score(jd_text, resume_text)
    b = boolean_score(required_skills, resume_text)
    total = round((SBERT_WEIGHT * s) + (TFIDF_WEIGHT * t) + (BOOLEAN_WEIGHT * b), 4)
    return ScoreBreakdown(sbert=s, tfidf=t, boolean=b, total=total)


# ─── Missing skills detection ─────────────────────────────────────────────────

def find_missing_skills(required_skills: list[str], resume_text: str) -> list[str]:
    """Return required skills not found anywhere in the resume text."""
    resume_lower = resume_text.lower()
    return [s for s in required_skills if s.lower() not in resume_lower]


# ─── Main match function ──────────────────────────────────────────────────────

def match_profile_to_jd(job_id: int, jd: JobDescription) -> MatchResponse:
    """
    1. Build JD text from structured fields
    2. Retrieve top-k relevant profile chunks from ChromaDB
    3. Combine chunks into a resume text block
    4. Compute hybrid match score
    5. Identify missing required skills
    """
    # Build a single JD text for embedding/scoring
    jd_text = f"""
    Job Title: {jd.job_title}
    Company: {jd.company_name}
    Responsibilities: {' '.join(jd.core_responsibilities)}
    Required Skills: {' '.join(jd.required_skills)}
    Preferred Certifications: {' '.join(jd.preferred_certifications)}
    """.strip()

    # Retrieve top-k most relevant profile chunks (returns ProfileItem objects)
    top_chunks = retrieve_top_k(jd_text, k=TOP_K_CHUNKS)

    if not top_chunks:
        return MatchResponse(
            job_id=job_id,
            top_chunks=[],
            match_score=0.0,
            breakdown=ScoreBreakdown(sbert=0.0, tfidf=0.0, boolean=0.0, total=0.0),
            missing_skills=jd.required_skills
        )

    # Combine all chunks into one resume text for scoring
    resume_text = "\n".join(chunk.content for chunk in top_chunks)

    # Compute scores
    breakdown = hybrid_score(jd_text, resume_text, jd.required_skills)
    missing = find_missing_skills(jd.required_skills, resume_text)

    print(f"[Scorer] Job #{job_id} | Score: {breakdown.total:.2f} "
          f"(SBERT={breakdown.sbert:.2f}, TF-IDF={breakdown.tfidf:.2f}, "
          f"Boolean={breakdown.boolean:.2f}) | Missing: {missing}")

    return MatchResponse(
        job_id=job_id,
        top_chunks=top_chunks,
        match_score=breakdown.total,
        breakdown=breakdown,
        missing_skills=missing
    )
