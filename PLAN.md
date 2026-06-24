# AutoApply AI — Build Plan

**Stack:** FastAPI · Next.js (TS + Tailwind) · Groq API · ChromaDB · sentence-transformers · WeasyPrint · SQLite · Gmail API  
**Profile input:** Upload existing resume (PDF/DOCX) to auto-populate profile store  
**Extraction:** Groq Vision (primary) → PaddleOCR (fallback)  
**Constraint:** 100% free / free-tier only

---

## Project Folder Structure

```
autoapply-ai/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # env vars, constants
│   ├── database.py              # SQLite connection + WAL setup
│   ├── models.py                # SQLAlchemy / raw SQLite table definitions
│   ├── schemas.py               # Pydantic request/response models
│   │
│   ├── routers/
│   │   ├── profile.py           # POST /profile/upload-resume, GET /profile
│   │   ├── extract.py           # POST /extract  (screenshot → JD JSON)
│   │   ├── match.py             # POST /match    (JD JSON → scored profile chunks)
│   │   ├── resume.py            # POST /generate-resume  → PDF
│   │   └── email.py             # POST /draft-email, POST /send-email
│   │
│   ├── services/
│   │   ├── ocr.py               # Groq Vision call + PaddleOCR fallback
│   │   ├── profile_parser.py    # PDF/DOCX resume → profile_items rows
│   │   ├── vector_store.py      # ChromaDB init, embed, retrieve
│   │   ├── scorer.py            # Hybrid SBERT + TF-IDF + Boolean score
│   │   ├── tailoring.py         # Groq LLM tailoring prompt + retry loop
│   │   ├── resume_renderer.py   # Jinja2 → HTML → WeasyPrint PDF
│   │   └── gmail.py             # OAuth 2.0 token management + send
│   │
│   ├── templates/
│   │   └── resume.html          # Jinja2 ATS-safe single-column template
│   │
│   ├── prompts/
│   │   ├── extraction.txt       # System prompt for JD extraction
│   │   └── tailoring.txt        # System prompt for resume tailoring
│   │
│   ├── data/
│   │   └── autoapply.db         # SQLite file (gitignored)
│   │
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx         # Single-page review flow
│   │   ├── components/
│   │   │   ├── UploadZone.tsx   # Screenshot drag-and-drop upload
│   │   │   ├── JDPreview.tsx    # Extracted JD JSON display
│   │   │   ├── ResumePreview.tsx# PDF preview + match score
│   │   │   ├── EmailEditor.tsx  # Draft email with inline edit
│   │   │   └── SendButton.tsx   # Approve + send with cap warning
│   │   └── lib/
│   │       └── api.ts           # Typed fetch wrappers for all FastAPI routes
│   ├── package.json
│   └── next.config.js
│
├── .env                         # GROQ_API_KEY, GMAIL credentials (gitignored)
├── .gitignore
└── README.md
```

---

## Phase 0 — Project Setup (Do this first, before any code)

**Goal:** Working skeleton with all dependencies installed and the database ready.

### 0.1 Repo & environment
```bash
mkdir autoapply-ai && cd autoapply-ai
python -m venv venv && source venv/bin/activate
git init
```

### 0.2 Backend dependencies
```
fastapi
uvicorn[standard]
python-multipart          # file uploads
pydantic
groq                      # Groq SDK
paddleocr                 # local OCR fallback
Pillow                    # screenshot preprocessing
chromadb                  # local vector store
sentence-transformers     # local embeddings (all-MiniLM-L6-v2)
scikit-learn              # TF-IDF scoring
WeasyPrint                # HTML → PDF
Jinja2
PyMuPDF                   # fitz — PDF text extraction for profile parser
python-docx               # DOCX text extraction for profile parser
google-api-python-client  # Gmail API
google-auth-oauthlib      # OAuth 2.0 flow
langchain                 # orchestration
langchain-groq            # Groq LangChain integration
python-dotenv
```

### 0.3 SQLite + WAL — set up FIRST
```python
# database.py
import sqlite3

def get_connection():
    conn = sqlite3.connect("data/autoapply.db", timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

def init_db():
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS profile_items (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            type TEXT CHECK(type IN ('project','cert','education','skill','experience')),
            content TEXT NOT NULL,
            tags TEXT,           -- comma-separated keywords
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            company_name TEXT,
            job_title TEXT,
            extracted_skills_json TEXT,
            match_score REAL,
            status TEXT DEFAULT 'pending',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS tailored_resumes (
            id INTEGER PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id),
            resume_html TEXT,
            pdf_path TEXT,
            match_score_breakdown TEXT   -- JSON: {sbert, tfidf, boolean}
        );
        CREATE TABLE IF NOT EXISTS email_drafts (
            id INTEGER PRIMARY KEY,
            job_id INTEGER REFERENCES jobs(id),
            recipient_email TEXT,
            subject TEXT,
            body TEXT,
            send_status TEXT DEFAULT 'draft',
            sent_at TEXT
        );
    """)
    conn.commit()
    conn.close()
```

### 0.4 Frontend scaffold
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app
```

### 0.5 .env file
```
GROQ_API_KEY=your_key_here
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:8000/auth/callback
```

**Phase 0 is done when:** `uvicorn backend.main:app --reload` starts with no errors and `/docs` loads.

---

## Phase 1 — Profile Store (Resume Upload → profile_items)

**Goal:** User uploads their existing resume PDF or DOCX → app parses it → stores structured chunks in SQLite + ChromaDB.

### API endpoint
```
POST /profile/upload-resume
  Body: multipart/form-data { file: PDF or DOCX }
  Response: { items_created: int, preview: [{ type, content }] }

GET /profile
  Response: { items: [{ id, type, content, tags }] }
```

### Parsing logic (`services/profile_parser.py`)
1. Detect file type (PDF → PyMuPDF, DOCX → python-docx)
2. Extract raw text per section
3. Call Groq (text model) with this prompt:
   > "Parse this resume text and return a JSON array. Each element has: type (one of: project, cert, education, skill, experience), content (the full bullet/description as written), tags (comma-separated keywords). Extract every distinct item — do not summarize or combine."
4. Validate response against Pydantic schema
5. Insert each item into `profile_items` table
6. Embed each item via sentence-transformers and upsert into ChromaDB collection `profile`

### ChromaDB setup (`services/vector_store.py`)
```python
import chromadb
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
client = chromadb.PersistentClient(path="data/chroma")   # MUST be Persistent, not in-memory
collection = client.get_or_create_collection("profile")

def embed_and_store(item_id, content, metadata):
    embedding = model.encode(content).tolist()
    collection.upsert(
        ids=[str(item_id)],
        embeddings=[embedding],
        documents=[content],
        metadatas=[metadata]
    )

def retrieve_top_k(query_text, k=8):
    query_embedding = model.encode(query_text).tolist()
    return collection.query(query_embeddings=[query_embedding], n_results=k)
```

**Phase 1 is done when:** Upload your own resume and GET /profile returns recognizable items matching what's in your resume.

---

## Phase 2 — Extraction (Screenshot → Structured JD JSON)

**Goal:** User uploads a mobile screenshot of a job posting → returns validated JSON.

### API endpoint
```
POST /extract
  Body: multipart/form-data { file: image (JPG/PNG) }
  Response: JobDescription JSON (see schema below)
```

### JD schema (Pydantic)
```python
class JobDescription(BaseModel):
    company_name: str
    job_title: str
    core_responsibilities: list[str]
    required_skills: list[str]
    preferred_certifications: list[str]
    minimum_years_experience: int | None
```

### Extraction pipeline (`services/ocr.py`)
```python
# Step 1: Preprocess
from PIL import Image

def preprocess(input_path, output_path):
    img = Image.open(input_path)
    img.thumbnail((1000, 1000))          # max 1000px — keeps within Groq free tier
    img.save(output_path, "JPEG", quality=85)

# Step 2: Try Groq Vision
def extract_with_groq_vision(image_path) -> dict:
    # encode image to base64
    # call groq.chat.completions.create with model="meta-llama/llama-4-scout-17b-16e-instruct"
    # system prompt from prompts/extraction.txt
    # return parsed JSON

# Step 3: Fallback — PaddleOCR + Groq text
def extract_with_paddleocr_fallback(image_path) -> dict:
    # run PaddleOCR on image → raw text
    # call Groq text model to structure raw text → same JSON schema
    # return parsed JSON

def extract(image_path) -> JobDescription:
    try:
        result = extract_with_groq_vision(image_path)
        return JobDescription(**result)
    except Exception:
        result = extract_with_paddleocr_fallback(image_path)
        return JobDescription(**result)
```

### Extraction system prompt (`prompts/extraction.txt`)
```
Extract only what is explicitly stated in the job posting image.
Return valid JSON matching this exact schema:
{ company_name, job_title, core_responsibilities[], required_skills[],
  preferred_certifications[], minimum_years_experience }
Do not infer, add, or guess any field not visibly present in the source image.
If a field is not present, use null or an empty array.
```

**Phase 2 is done when:** Upload 3–5 real screenshots and get correct JSON back for each.

---

## Phase 3 — Matching & Scoring

**Goal:** Given a JD JSON, retrieve the most relevant profile chunks and compute a hybrid match score.

### API endpoint
```
POST /match
  Body: { job_description: JobDescription }
  Response: {
    top_chunks: [{ id, type, content }],
    match_score: float,       # 0.0–1.0
    breakdown: { sbert: float, tfidf: float, boolean: float },
    missing_skills: [str]     # required skills not found in profile
  }
```

### Scoring logic (`services/scorer.py`)
```python
# SBERT component
def sbert_score(jd_text, resume_text) -> float:
    jd_emb = model.encode(jd_text)
    res_emb = model.encode(resume_text)
    return float(cosine_similarity([jd_emb], [res_emb])[0][0])

# TF-IDF component
def tfidf_score(jd_text, resume_text) -> float:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    vect = TfidfVectorizer()
    tfidf = vect.fit_transform([jd_text, resume_text])
    return float(cosine_similarity(tfidf[0], tfidf[1])[0][0])

# Boolean component
def boolean_score(required_skills, resume_text) -> float:
    hits = sum(1 for s in required_skills if s.lower() in resume_text.lower())
    return hits / len(required_skills) if required_skills else 0.0

# Hybrid
def hybrid_score(jd_text, resume_text, required_skills) -> dict:
    s = sbert_score(jd_text, resume_text)
    t = tfidf_score(jd_text, resume_text)
    b = boolean_score(required_skills, resume_text)
    total = (0.50 * s) + (0.30 * t) + (0.20 * b)
    return {"sbert": s, "tfidf": t, "boolean": b, "total": total}
```

**Phase 3 is done when:** Match score on a real JD plausibly reflects how relevant your actual profile is.

---

## Phase 4 — Resume Generation (Tailoring → PDF)

**Goal:** Retrieved profile chunks + JD → tailored resume PDF, ATS-safe.

### API endpoint
```
POST /generate-resume
  Body: { job_id: int, job_description: JobDescription, top_chunks: [...] }
  Response: { resume_html: str, pdf_path: str, match_score: float }
```

### Tailoring prompt (`prompts/tailoring.txt`)
```
You are an ATS resume writer. Using ONLY the candidate profile data provided below,
select and rephrase the most relevant projects, certifications, education, and skills
for the given job description.

Rules:
- Do not invent, exaggerate, or imply any skill, title, or experience not present
  in the provided profile data.
- Mirror the job description's terminology for skills the candidate genuinely has.
- If the candidate has under 2 years of professional experience, place Projects &
  Certifications BEFORE Professional Experience.
- Return structured JSON: { summary, skills[], certifications[], projects[], 
  experience[], education[] }

Candidate profile data:
{profile_chunks}

Job description:
{job_description}
```

### Resume template structure (`templates/resume.html`)
Sections in order:
1. Header (name, email, phone, LinkedIn, GitHub)
2. Professional Summary (2–3 sentences, role-tailored)
3. Technical Skills & Certifications
4. Projects & Portfolios ← above Experience for students/early-career
5. Professional Experience
6. Education

Key CSS rules (ATS-safe):
```css
* { font-family: Arial, sans-serif; }
body { font-size: 11pt; }
.entry { page-break-inside: avoid; }
h2 { page-break-after: avoid; }
table, img, svg { display: none; }   /* no tables/graphics — breaks ATS parsers */
@page { size: letter; margin: 0.8in 0.75in; }
```

### Rendering (`services/resume_renderer.py`)
```python
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

def render_pdf(resume_data: dict, output_path: str) -> str:
    env = Environment(loader=FileSystemLoader("templates"))
    template = env.get_template("resume.html")
    html_content = template.render(**resume_data)
    HTML(string=html_content).write_pdf(output_path)
    return output_path
```

> **WeasyPrint system deps** — install BEFORE writing this code:
> - macOS: `brew install pango cairo libffi`
> - Ubuntu: `apt-get install libpango-1.0-0 libpangocairo-1.0-0 libcairo2`

**Phase 4 is done when:** You get a clean, readable, single-column PDF that opens without errors and contains only real content from your profile.

---

## Phase 5 — Email Drafting

**Goal:** Generate a short, personalized cold email + enforce daily send cap.

### API endpoint
```
POST /draft-email
  Body: { job_id: int, job_description: JobDescription, top_chunks: [...], recipient_email: str }
  Response: { subject: str, body: str, draft_id: int }
```

### Email prompt
```
Write a short, professional cold email (under 150 words) applying for the role of
{job_title} at {company_name}. 

Reference these 2–3 specific qualifications from the candidate's profile:
{top_qualifications}

Rules:
- Sound like a real person, not a template
- No generic phrases like "I am writing to express my interest"
- Specific subject line that includes the role title
- End with a clear, single call to action
- Do NOT fabricate any qualification not listed above
```

### Daily send cap (enforced in code)
```python
DAILY_SEND_CAP = 10   # configurable in config.py

def check_daily_cap(user_id: int) -> bool:
    conn = get_connection()
    today = date.today().isoformat()
    count = conn.execute(
        "SELECT COUNT(*) FROM email_drafts WHERE send_status='sent' AND DATE(sent_at)=?",
        (today,)
    ).fetchone()[0]
    return count < DAILY_SEND_CAP
```

**Phase 5 is done when:** Draft reads like a real person wrote it, and the daily cap correctly blocks sends over the limit.

---

## Phase 6 — Next.js Review UI

**Goal:** Single-page flow: upload → review → edit → approve → send.

### Page flow (single `app/page.tsx`)
```
State machine:
  idle → uploading → extracted → matched → generating → reviewing → sending → done
```

### Components
| Component | What it does |
|---|---|
| `UploadZone.tsx` | Drag-and-drop or click-to-upload screenshot. Shows preview thumbnail. |
| `JDPreview.tsx` | Displays extracted JD JSON (company, title, skills) in readable card format. Edit button for manual correction. |
| `ResumePreview.tsx` | Shows PDF in an iframe + match score bar (color-coded: green ≥80, yellow 60–79, red <60) + score breakdown. |
| `EmailEditor.tsx` | Textarea pre-filled with draft. Recipient email field. Character counter (target <150 words). |
| `SendButton.tsx` | "Approve & Send" — disabled until both resume and email are reviewed. Shows daily cap remaining. |

### CORS config (FastAPI)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### API client (`lib/api.ts`)
```typescript
const API = "http://localhost:8000"

export const extractJD = (file: File) => {
  const form = new FormData()
  form.append("file", file)
  return fetch(`${API}/extract`, { method: "POST", body: form }).then(r => r.json())
}
// same pattern for /match, /generate-resume, /draft-email, /send-email
```

**Phase 6 is done when:** Full flow works in browser from screenshot upload to an editable draft — no terminal interaction needed.

---

## Phase 7 — Gmail Send

**Goal:** Send resume + email via user's own Gmail account using OAuth 2.0.

### Setup (do this as a standalone spike, not tied to Phase 6)
1. Go to Google Cloud Console → New Project → Enable Gmail API
2. OAuth consent screen → External → add your email as a test user
3. Create credentials → OAuth 2.0 Client ID → Desktop app → download `credentials.json`
4. Put `credentials.json` in `backend/` (gitignore it)

### Send logic (`services/gmail.py`)
```python
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
import base64, os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

SCOPES = ["https://www.googleapis.com/auth/gmail.send"]

def get_gmail_service():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
        creds = flow.run_local_server(port=0)
        with open("token.json", "w") as f:
            f.write(creds.to_json())
    return build("gmail", "v1", credentials=creds)

def send_email(to: str, subject: str, body: str, pdf_path: str):
    service = get_gmail_service()
    msg = MIMEMultipart()
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    
    with open(pdf_path, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", f"attachment; filename=resume.pdf")
        msg.attach(part)
    
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
```

### API endpoint
```
POST /send-email
  Body: { draft_id: int }
  Response: { status: "sent", sent_at: str }
```

**Phase 7 is done when:** You send yourself one real email with a PDF attached, end-to-end through the app.

---

## Phase 8 — Real Test Run

Run the full pipeline on **5–10 genuinely different real job screenshots** (different roles, companies, layouts).

For each run, record:
- OCR field accuracy (compare extracted JSON vs. what you actually see in screenshot)
- Match score (does it feel right for your profile?)
- Resume quality (would you actually send this?)
- Time from screenshot upload to send-ready (target: <10 min)

This is what turns the Section 11 metrics from estimates into real numbers.

---

## Phase 9 — Wrap-up

- Update PLAN.md / README with actual measured metrics from Phase 8
- Add one honest paragraph on what didn't work as expected (instructors notice when a project's outcome matches its proposal too cleanly)
- Final git push

---

## API Contract Summary

| Endpoint | Method | Input | Output |
|---|---|---|---|
| `/profile/upload-resume` | POST | PDF or DOCX file | `{ items_created, preview }` |
| `/profile` | GET | — | `{ items[] }` |
| `/extract` | POST | Image file | `JobDescription JSON` |
| `/match` | POST | `JobDescription` | `{ top_chunks, match_score, breakdown, missing_skills }` |
| `/generate-resume` | POST | `job_id, JobDescription, top_chunks` | `{ resume_html, pdf_path, match_score }` |
| `/draft-email` | POST | `job_id, JobDescription, top_chunks, recipient_email` | `{ subject, body, draft_id }` |
| `/send-email` | POST | `{ draft_id }` | `{ status, sent_at }` |

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Groq Vision rate limit hit during testing | Preprocess images (Phase 0.2 Pillow step) + PaddleOCR fallback ready |
| WeasyPrint system deps missing | Install brew/apt deps before writing Phase 4 — test render early |
| ChromaDB data lost between runs | Use `PersistentClient` with explicit path, not default in-memory |
| Gmail OAuth loop takes too long | Do as standalone spike in Phase 7, not tied to frontend work |
| SQLite write lock under concurrent requests | WAL mode + timeout set in Phase 0 before any other code |
| LLM hallucination in resume | RAG-grounded prompt + mandatory human review gate |

---

## Build Order (strict — each phase depends on the previous)

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9
Setup    Profile   Extract   Match     Resume    Email     UI        Gmail     Test      Docs
```

Do not skip ahead. The frontend (Phase 6) should only be built after Phases 2–5 are individually testable via `curl` or FastAPI `/docs`.
