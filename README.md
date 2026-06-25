<div align="center">

# 🤖 AutoApply AI

### Intelligent Job Application Assistant — Screenshot to Sent Email in 30 Seconds

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org)
[![Groq](https://img.shields.io/badge/Groq-Free_Tier-F55036?style=flat)](https://console.groq.com)
[![CI](https://github.com/Jagadeesh0463/AutoApply-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Jagadeesh0463/AutoApply-AI/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Capstone](https://img.shields.io/badge/FLM-AI_Mastery_Capstone-blueviolet)](CAPSTONE_REPORT.md)

**Upload a job screenshot → get a tailored ATS resume + personalized cold email → sent via your Gmail**

[Features](#-features) • [Architecture](#-architecture) • [Tech Stack](#-tech-stack) • [Installation](#-installation) • [API Docs](#-api-endpoints) • [Roadmap](ROADMAP.md) • [Contributing](CONTRIBUTING.md) • [Capstone Report](CAPSTONE_REPORT.md)

</div>

---

## 🎯 What is AutoApply AI?

AutoApply AI is a full-stack AI application built as a capstone project for the **FLM AI Mastery Program**. It solves a real problem: job seekers spend hours manually tailoring resumes and writing cold emails for every application.

**The workflow:**

```
📱 Mobile Screenshot of Job Posting
            ↓
🔍 Groq Vision extracts structured JD (title, company, skills)
            ↓
🧠 Hybrid ATS scoring: SBERT + TF-IDF + Boolean keyword match
            ↓
📄 Tailored, ATS-safe resume PDF (WeasyPrint + Jinja2)
            ↓
✉️  Personalized cold email draft (Groq LLaMA)
            ↓
👀 Human review & edit step (mandatory)
            ↓
📤 Sent via your own Gmail (OAuth 2.0)
```

**Core design principle: "Emphasize, never fabricate."** Every word in the generated resume comes directly from your real uploaded profile — the AI only re-orders and re-phrases.

---

## ⚡ Quick Start

```bash
git clone https://github.com/Jagadeesh0463/AutoApply-AI.git
cd AutoApply-AI

# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add your GROQ_API_KEY
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend && npm install && npm run dev
```

Open `http://localhost:3000` — full setup guide below.

---

## ✨ Features

- **📸 Screenshot-first input** — No scraping, no browser extensions. Just take a photo of any job posting on your phone. Works on LinkedIn, Naukri, Indeed, and any job board.
- **🔍 Vision AI extraction** — Groq Vision (LLaMA 4 Scout) reads the screenshot and returns structured JSON: title, company, required skills, responsibilities.
- **🎯 Hybrid ATS scoring** — Three-component match score: semantic similarity (SBERT), keyword overlap (TF-IDF), and skill presence (Boolean). Transparent breakdown shown to user.
- **📄 ATS-safe PDF resume** — Single-column, no tables/graphics, Arial font, standard headers. WeasyPrint renders HTML → PDF locally.
- **✉️ Personalized cold email** — Under 180 words, opens with a company-specific hook, references 2–3 real achievements. Never generic.
- **✏️ Mandatory human review** — You always see and can edit both the resume and email before anything is sent.
- **📤 Real Gmail send** — OAuth 2.0 (not SMTP passwords). Resume PDF attached automatically.
- **📊 Application tracking** — SQLite logs every application: job, match score, send status, timestamp.
- **💰 100% free stack** — No paid APIs, no paid hosting, no credit card required.

---

## 🏗️ Architecture

Next.js frontend → FastAPI backend → Groq API (vision + text) → local ChromaDB + SQLite → Gmail API.

```
Screenshot → Groq Vision (JD extraction) → SBERT+TF-IDF+Boolean scoring
          → Groq LLM (resume tailor + email draft) → WeasyPrint PDF → Gmail send
```

**ATS Scoring:**
```
Match Score = (0.40 × Boolean skill presence) + (0.30 × SBERT) + (0.30 × TF-IDF)
```

Full diagrams (sequence, ER, scoring rationale): [docs/architecture.md](docs/architecture.md)

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Backend | **FastAPI** (Python 3.11+) | Async, typed, auto OpenAPI docs |
| Frontend | **Next.js 16** + TypeScript + Tailwind | Production-grade, type-safe |
| Vision AI | **Groq** (llama-4-scout-17b) | Free tier, fast, accurate on screenshots |
| Text LLM | **Groq** (llama-3.3-70b-versatile) | Free tier, strong instruction following |
| OCR Fallback | **EasyOCR** (local) | Zero cost, works offline, no rate limits |
| Embeddings | **sentence-transformers** (all-MiniLM-L6-v2) | Local, no API cost |
| Vector Store | **ChromaDB** PersistentClient | Local, cosine similarity, survives restarts |
| Lexical Score | **scikit-learn** TF-IDF | Classic keyword overlap |
| Resume PDF | **WeasyPrint** + **Jinja2** | HTML→PDF, ATS-safe single column |
| Database | **SQLite** (WAL mode) | Zero config, concurrent reads, persistent |
| Email Send | **Gmail API** (OAuth 2.0) | Real delivery, free, no SMTP passwords |
| Image Prep | **Pillow** | Resize/compress before Vision API |
| Resume Parse | **PyMuPDF** + **python-docx** | Handles PDF and DOCX uploads |

**Total API cost: $0.00** — All LLM calls use Groq's free tier. All embeddings, PDF, vector store run locally.

---

## 📸 Screenshots

> Screenshots coming — run the app and drop images into `docs/screenshots/`.

<!-- Uncomment when screenshots are added:
![Upload](docs/screenshots/01_upload.png)
![JD Review](docs/screenshots/02_jd_review.png)
![ATS Score](docs/screenshots/03_match_score.png)
![Resume](docs/screenshots/04_resume.png)
![Email](docs/screenshots/05_email.png)
-->

---

## 📁 Project Structure

```
AutoApply-AI/
├── backend/          # FastAPI — routers, services, prompts, templates
├── frontend/         # Next.js — app router, components, API client
├── docs/             # api.md · architecture.md · deployment.md
├── tests/            # 38 pytest tests (scoring, OCR, resume, email)
├── sample_data/      # sample_profile.json · sample_jd.json
├── .github/          # CI workflow · issue templates · dependabot
├── Makefile          # make install · test · lint · run-backend/frontend
└── .env.example
```

---

## 🚀 Installation

### Prerequisites

- Python 3.11+
- Node.js 18+
- `brew install pango` (macOS) — required by WeasyPrint for PDF rendering
- [Groq API key](https://console.groq.com) — free, no credit card
- Google Cloud project with Gmail API enabled + OAuth 2.0 credentials

### 1. Clone

```bash
git clone https://github.com/Jagadeesh0463/AutoApply-AI.git
cd AutoApply-AI
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create your `.env` file:

```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App available at: `http://localhost:3000`

### 4. Gmail OAuth Setup (one-time)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable Gmail API
3. Create OAuth 2.0 Web Client credentials
4. Add `http://localhost:8000/auth/gmail/callback` as redirect URI
5. Download `credentials.json` → place in `backend/`
6. Visit `http://localhost:8000/auth/gmail` in your browser
7. Approve Gmail access — `token.json` saved automatically

### 5. Upload Your Profile (one-time)

Go to `http://localhost:3000/profile` and upload your resume PDF or DOCX. AutoApply AI parses it into structured profile items stored in SQLite + ChromaDB.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/profile/upload-resume` | Upload resume PDF/DOCX → parse into profile |
| `POST` | `/extract/from-image` | Screenshot → structured JD JSON |
| `POST` | `/match` | Profile vs JD → hybrid ATS score + missing skills |
| `POST` | `/generate-resume` | Tailored resume → ATS-safe PDF |
| `POST` | `/email/draft` | Generate personalized cold email |
| `POST` | `/email/send/{draft_id}` | Send via Gmail with PDF attached |
| `GET` | `/auth/gmail` | Start Gmail OAuth flow |

Full endpoint reference with request/response examples: [docs/api.md](docs/api.md)

---

## 🔒 Security & Privacy

- **OAuth 2.0 only** — No SMTP passwords or app passwords stored anywhere. Gmail access uses Google's secure OAuth flow with a `gmail.send`-only scope.
- **Local-first data** — Your profile, resumes, and screenshots never leave your machine. Everything is stored in local SQLite and ChromaDB files.
- **Screenshot deletion** — Uploaded screenshots are deleted from disk immediately after extraction completes. They are never persisted.
- **No scraping** — The screenshot-only input method means AutoApply AI never scrapes LinkedIn, Indeed, or any job board — fully ToS-compliant.
- **Secrets in `.env`** — API keys and OAuth credentials are never hardcoded. `credentials.json` and `token.json` are gitignored.

---

## 🔮 Roadmap

Near-term: resume version history, follow-up scheduler, cover letter generation.

Agentic (v2.0): LangGraph multi-agent pipeline — `JDParserAgent` → `ATSValidationAgent` → `ResumeTailoringAgent` → `EmailDraftAgent` with an iterative loop until ATS score ≥ 85%.

Full roadmap: [ROADMAP.md](ROADMAP.md)

---

## 📊 Results (Phase 8 Real Testing)

Tested against 5 realistic QA/SDET job postings:

| Metric | Result |
|--------|--------|
| Pipeline success rate | **100%** (5/5 jobs) |
| Avg skills extracted per job | **10.2** |
| Avg ATS score | **71.5%** |
| Best ATS score | **78.2%** (TCS QA Automation) |
| Avg email word count | **107 words** (target: < 180) |
| Avg pipeline time | **18.1 seconds** |

Full metrics and analysis: [CAPSTONE_REPORT.md](CAPSTONE_REPORT.md)

---

## 👤 Author

**S Jagadeesh**
- 🐙 [github.com/Jagadeesh0463](https://github.com/Jagadeesh0463)
- 🎓 FLM AI Mastery Program — Capstone Project (2026)

---

## 📄 License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ❤️ as a capstone for the FLM AI Mastery Program
</div>
