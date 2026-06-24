import json
import os
from groq import Groq
from config import GROQ_API_KEY, GROQ_TEXT_MODEL, PROMPTS_DIR
from schemas import JobDescription, ProfileItem
from services.tailoring import CANDIDATE

client = Groq(api_key=GROQ_API_KEY)

# Load email prompt once
with open(os.path.join(PROMPTS_DIR, "email.txt"), "r") as f:
    EMAIL_PROMPT = f.read().strip()


def draft_cold_email(jd: JobDescription, profile_items: list[ProfileItem]) -> dict:
    """
    Generate a personalized cold email using Groq.
    Uses only real profile data — no fabrication.
    Returns dict with 'subject' and 'body'.
    """
    # Build profile summary — prioritize experience, projects, certs over raw skills
    priority_types = ["experience", "project", "cert", "education"]
    ordered = sorted(
        profile_items,
        key=lambda x: priority_types.index(x.type) if x.type in priority_types else 99
    )

    profile_text = "\n\n".join(
        f"[{item.type.upper()}]\n{item.content}"
        for item in ordered
    )

    prompt = f"""{EMAIL_PROMPT}

Candidate:
Name: {CANDIDATE['name']}
Email: {CANDIDATE['email']}
Phone: {CANDIDATE['phone']}
LinkedIn: {CANDIDATE['linkedin']}

Job Details:
Role: {jd.job_title}
Company: {jd.company_name}
Required Skills: {', '.join(jd.required_skills)}
Responsibilities: {chr(10).join(jd.core_responsibilities)}

Candidate Profile (use ONLY this — no fabrication):
{profile_text}
"""

    response = client.chat.completions.create(
        model=GROQ_TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content
    if not raw:
        raise ValueError("Groq returned empty response for email draft.")
    raw = raw.strip()

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Groq returned invalid JSON: {e}\nRaw: {raw[:300]}")

    if "subject" not in result or "body" not in result:
        raise ValueError(f"Missing subject or body in Groq response: {result}")

    return result
