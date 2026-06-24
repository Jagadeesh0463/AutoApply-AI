import json
import fitz          # PyMuPDF
import docx
from groq import Groq
from config import GROQ_API_KEY, GROQ_TEXT_MODEL
from schemas import ProfileItem

client = Groq(api_key=GROQ_API_KEY)

PARSE_PROMPT = """
You are a resume parser. Extract every distinct item from the resume text below.

Return a JSON array. Each element must have exactly these fields:
- "type": one of "project", "cert", "education", "skill", "experience"
- "content": the full text of that item as written in the resume (do not summarize)
- "tags": a comma-separated string of 3-6 relevant keywords for that item

Rules:
- Split skills into individual items (one skill per entry)
- Each project, certification, education, and work experience is a separate item
- Do not combine items; do not skip any item
- Return ONLY the JSON array, no other text

Resume text:
{resume_text}
"""


def extract_text_from_pdf(file_path: str) -> str:
    """Extract raw text from a PDF using PyMuPDF."""
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def extract_text_from_docx(file_path: str) -> str:
    """Extract raw text from a DOCX file."""
    doc = docx.Document(file_path)
    return "\n".join(para.text for para in doc.paragraphs if para.text.strip())


def extract_text(file_path: str) -> str:
    """Auto-detect file type and extract text."""
    if file_path.lower().endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    elif file_path.lower().endswith(".docx"):
        return extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_path}")


def parse_resume_with_groq(resume_text: str) -> list[ProfileItem]:
    """
    Send resume text to Groq and get back structured profile items.
    Falls back to a single raw item if parsing fails.
    """
    prompt = PARSE_PROMPT.format(resume_text=resume_text)

    response = client.chat.completions.create(
        model=GROQ_TEXT_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,       # low temp for consistent structured output
        max_tokens=8192,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if Groq wraps the JSON
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        items_data = json.loads(raw)
        items = []
        for item in items_data:
            items.append(ProfileItem(
                type=item.get("type", "skill"),
                content=item.get("content", ""),
                tags=item.get("tags", "")
            ))
        return items
    except json.JSONDecodeError as e:
        print(f"[ProfileParser] JSON parse failed: {e}")
        print(f"[ProfileParser] Raw response: {raw[:500]}")
        # Fallback: return the whole resume as one item
        return [ProfileItem(type="experience", content=resume_text[:2000], tags="resume")]


def parse_resume(file_path: str) -> list[ProfileItem]:
    """Full pipeline: file → text → structured profile items."""
    print(f"[ProfileParser] Extracting text from {file_path}")
    text = extract_text(file_path)

    if not text.strip():
        raise ValueError("Could not extract any text from the uploaded file.")

    print(f"[ProfileParser] Extracted {len(text)} characters. Sending to Groq...")
    items = parse_resume_with_groq(text)
    print(f"[ProfileParser] Got {len(items)} profile items from Groq.")
    return items
