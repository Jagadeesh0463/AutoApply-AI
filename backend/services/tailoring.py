import json
import os
from groq import Groq
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML as WeasyHTML
from config import GROQ_API_KEY, GROQ_TEXT_MODEL, PROMPTS_DIR, TEMPLATES_DIR, OUTPUT_DIR
from schemas import JobDescription, ProfileItem

client = Groq(api_key=GROQ_API_KEY)

# Load tailoring prompt once
with open(os.path.join(PROMPTS_DIR, "tailoring.txt"), "r") as f:
    TAILORING_PROMPT = f.read().strip()

# Jinja2 environment
jinja_env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))


# ─── Candidate header info (hardcoded for single-user MVP) ───────────────────
# In a multi-user app this would come from the DB. For now, edit these values.
CANDIDATE = {
    "name": "Thallapalem Naga Bhagyasri",
    "email": "bhagyat463@gmail.com",
    "phone": "+91-9642765225",        # ← update with real number
    "location": "Bengaluru, India",
    "linkedin": "linkedin.com/in/bhagyasri",   # ← update or leave blank
    "github": "",
}


# ─── Tailoring ───────────────────────────────────────────────────────────────

def tailor_resume(jd: JobDescription, top_chunks: list[ProfileItem]) -> dict:
    """
    Send JD + top profile chunks to Groq and get back structured resume content.
    Uses only real profile data — no fabrication allowed by prompt design.
    """
    profile_text = "\n\n".join(
        f"[{chunk.type.upper()}]\n{chunk.content}"
        for chunk in top_chunks
    )

    prompt = f"""{TAILORING_PROMPT}

Job Description:
Title: {jd.job_title}
Company: {jd.company_name}
Responsibilities: {chr(10).join(jd.core_responsibilities)}
Required Skills: {', '.join(jd.required_skills)}
Preferred Certifications: {', '.join(jd.preferred_certifications)}
Min Experience: {jd.minimum_years_experience} years

Candidate Profile Data (use ONLY this):
{profile_text}
"""

    response = client.chat.completions.create(
        model=GROQ_TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content
    if not raw:
        raise ValueError("Groq returned an empty response. Profile data may be empty.")
    raw = raw.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Groq returned invalid JSON: {e}\nRaw: {raw[:300]}")


# ─── Rendering ───────────────────────────────────────────────────────────────

def render_resume_html(resume_data: dict) -> str:
    """Render Jinja2 template with resume data → HTML string."""
    template = jinja_env.get_template("resume.html")
    return template.render(candidate=CANDIDATE, resume=resume_data)


def render_resume_pdf(html_content: str, output_filename: str) -> str:
    """Convert HTML string → PDF file via WeasyPrint."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    pdf_path = os.path.join(OUTPUT_DIR, output_filename)
    WeasyHTML(string=html_content).write_pdf(pdf_path)
    print(f"[Tailoring] PDF saved to {pdf_path}")
    return pdf_path


# ─── Full pipeline ────────────────────────────────────────────────────────────

def generate_resume(
    job_id: int,
    jd: JobDescription,
    top_chunks: list[ProfileItem]
) -> tuple[str, str]:
    """
    Full pipeline: JD + profile chunks → tailored HTML + PDF.
    Returns (html_content, pdf_path).
    """
    print(f"[Tailoring] Generating resume for job #{job_id}: {jd.job_title} @ {jd.company_name}")

    resume_data = tailor_resume(jd, top_chunks)
    html_content = render_resume_html(resume_data)

    filename = f"resume_job_{job_id}.pdf"
    pdf_path = render_resume_pdf(html_content, filename)

    return html_content, pdf_path
