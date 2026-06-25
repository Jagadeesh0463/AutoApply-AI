# Architecture — AutoApply AI

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                          │
│         TypeScript · Tailwind CSS · App Router               │
│   5-step wizard: Upload → JD → Match → Resume → Email       │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API (HTTP)
┌──────────────────────▼──────────────────────────────────────┐
│                   FastAPI Backend                            │
│                                                             │
│  /extract  ──►  /match  ──►  /generate-resume  ──►  /email │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Groq API   │  │  ChromaDB    │  │     SQLite        │   │
│  │ Vision+Text │  │ (local vec.) │  │   (WAL mode)      │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │    sentence-transformers (all-MiniLM-L6-v2)         │    │
│  │              Runs 100% locally                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         WeasyPrint + Jinja2 (local PDF)             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Gmail API (OAuth 2.0 send)                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Sequence Diagram

```
User          Frontend       FastAPI        Groq API      ChromaDB      Gmail API
 │               │              │               │              │              │
 │─ upload img ──►              │               │              │              │
 │               │─ POST /extract/from-image ──►│              │              │
 │               │              │─── vision ───►│              │              │
 │               │              │◄── JD JSON ───│              │              │
 │               │◄── JD JSON ──│               │              │              │
 │─ confirm JD ──►              │               │              │              │
 │               │─ POST /match ►              │              │              │
 │               │              │──── query ───────────────────►              │
 │               │              │◄─── chunks ──────────────────│              │
 │               │◄─ score ─────│               │              │              │
 │─ gen resume ──►              │               │              │              │
 │               │─ POST /generate-resume ──────►              │              │
 │               │              │─── tailor ───►│              │              │
 │               │              │◄── resume ────│              │              │
 │               │◄── PDF ──────│               │              │              │
 │─ draft email ──►             │               │              │              │
 │               │─ POST /email/draft ──────────►              │              │
 │               │◄── subject+body ─────────────│              │              │
 │─ edit & send ──►             │               │              │              │
 │               │─ POST /email/send ───────────────────────────────────────►│
 │               │◄── gmail_id ────────────────────────────────────────────── │
```

---

## Database ER Diagram

```
users
  └── id, email, created_at

profile_items  ──────── users.id
  └── id, user_id, type, content, tags, created_at

jobs  ───────────────── users.id
  └── id, user_id, company_name, job_title,
      extracted_skills_json, match_score, status, created_at

tailored_resumes ─────── jobs.id
  └── id, job_id, resume_html, pdf_path, match_score_breakdown

email_drafts ──────────── jobs.id
  └── id, job_id, recipient_email, subject, body,
      send_status, sent_at
```

---

## ATS Scoring Formula

```
Match Score = (0.30 × SBERT semantic similarity)
            + (0.30 × TF-IDF lexical similarity)
            + (0.40 × Boolean required-skill presence)
```

Boolean is weighted highest (40%) — it directly mirrors how ATS parsers check for required keywords.

**Why this weighting?**

| Component | Weight | Rationale |
|-----------|--------|-----------|
| Boolean | 40% | ATS systems gate on keyword presence above all else |
| SBERT | 30% | Captures semantic similarity — catches synonyms ATS misses |
| TF-IDF | 30% | Lexical overlap — complements SBERT for exact terminology |

---

## Key Design Decisions

### Screenshot-only input
No browser extensions, no scraping. The user photographs any job posting on their phone. This is fully ToS-compliant with every job board.

### Local-first AI
sentence-transformers, ChromaDB, WeasyPrint, and EasyOCR all run on the user's machine. Only resume tailoring, email generation, and JD extraction hit the Groq API.

### "Emphasize, never fabricate"
Resume generation pulls content exclusively from the user's stored profile items (SQLite). The LLM re-phrases and re-orders, but cannot invent skills or experiences.

### Mandatory human review
The 5-step wizard enforces a review gate before sending. The user sees and can edit both the resume PDF and email draft. Nothing is sent automatically.
