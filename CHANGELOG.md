# Changelog

All notable changes to AutoApply AI are documented here.

---

## [v1.0.0] — 2026-06-25

### 🎉 Initial Release — Full End-to-End Pipeline

#### Phase 0 — Project Setup
- FastAPI app with CORS middleware (Next.js port 3000 → FastAPI port 8000)
- SQLite with WAL journal mode and foreign key enforcement
- 5 tables: `users`, `profile_items`, `jobs`, `tailored_resumes`, `email_drafts`
- ChromaDB PersistentClient at `backend/data/chroma/` (survives restarts)
- Environment: Python venv + Node.js, all dependencies in `requirements.txt`

#### Phase 1 — Profile Store
- Upload PDF or DOCX resume once
- PyMuPDF + python-docx extract raw text
- Groq LLaMA parses text into structured profile items (skill / project / cert / education / experience)
- Items stored in SQLite + embedded into ChromaDB with sentence-transformers

#### Phase 2 — JD Extraction
- Screenshot uploaded → Pillow resizes to max 1000×1000px, JPEG 85%
- Groq Vision (llama-4-scout-17b) reads image → structured JSON
- EasyOCR + Groq text model as local fallback (no API dependency)
- Extracted fields: company, title, responsibilities, skills, certifications, experience

#### Phase 3 — Hybrid ATS Scoring
- Three-component score: SBERT (30%) + TF-IDF (30%) + Boolean (40%)
- Token-based Boolean matching handles multi-word skill names
- ChromaDB retrieves top-15 most semantically relevant profile chunks
- Missing skills surfaced to user in the UI

#### Phase 4 — Resume Generation
- All 41 profile items fetched from SQLite (not ChromaDB — ensures education always included)
- Groq LLaMA tailors content to mirror JD terminology
- Jinja2 renders to ATS-safe HTML: single column, no tables, Arial 11pt, div bullets
- WeasyPrint converts HTML → PDF with `page-break-inside: avoid` on entries

#### Phase 5 — Email Drafting
- Groq generates cold email under 180 words
- Company-specific opening hook, 2–3 real achievements, one CTA
- Profile items sent in priority order: experience → projects → certs → skills

#### Phase 6 — Next.js Frontend
- 5-step wizard with progress bar and back navigation
- Score colour coding: green ≥75%, yellow ≥50%, red <50%
- Editable subject and body fields in Step 5 (mandatory human review)
- All API calls via `frontend/lib/api.ts` — no hardcoded URLs

#### Phase 7 — Gmail OAuth Send
- OAuth 2.0 Web application flow
- PKCE disabled (`flow.code_verifier = None`) to fix "Missing code verifier" error
- OAuth state persisted across HTTP requests in `.oauth_state.json` temp file
- Resume PDF attached as `Jagadeesh_Resume_{Role}_{Company}.pdf`
- Daily cap: 10 sends/day (configurable via `DAILY_SEND_CAP`)

#### Phase 8 — Real Testing
- 5 QA/SDET job postings tested end-to-end
- 100% pipeline reliability (5/5)
- Average ATS score: 71.5% | Best: 78.2%
- Average email: 107 words | Average time: 18.1s

#### Phase 9 — Capstone Report
- Full write-up with real Phase 8 metrics
- "What Did Not Work" section documenting 5 real bugs and fixes
- Scoring weight deviation from plan documented with justification

### 🐛 Bugs Fixed
- ChromaDB clear endpoint: recreate collection with cosine similarity metadata
- WeasyPrint bullet detachment: replaced `<ul><li>` with `<div class="bullet">`
- Gmail OAuth PKCE: disabled `code_verifier` for local server flow
- Resume generation: switched from ChromaDB top-k to full SQLite profile
- Boolean scoring: token-based matching for multi-word compound skills
- Email editing: Step 4 was read-only — made subject/body editable textareas

### 🔒 Security
- `credentials.json`, `token.json`, `.env`, SQLite DB, ChromaDB all gitignored
- Screenshots deleted immediately after extraction
- Stale SQLite WAL file removed from git history

---

## [Upcoming]

- Multi-user JWT authentication
- Iterative resume tailoring loop (score < 80% → second pass)
- LangGraph agentic pipeline
- Public deployment (Vercel + Render)
- GitHub Actions CI/CD
