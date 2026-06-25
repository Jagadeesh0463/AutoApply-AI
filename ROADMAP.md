# Roadmap — AutoApply AI

Current stable version: **v1.0.0** (June 2026)

---

## ✅ v1.0.0 — Released (June 2026)

Core MVP complete:

- Screenshot → Groq Vision JD extraction
- Hybrid ATS scoring (SBERT + TF-IDF + Boolean)
- Tailored ATS-safe resume PDF (WeasyPrint + Jinja2)
- Personalized cold email generation (Groq LLaMA)
- Mandatory human review/edit step
- Real Gmail send via OAuth 2.0
- SQLite application history
- 38 automated tests + GitHub Actions CI

---

## 🔜 v1.1.0 — Near-term Improvements

**Target:** Q3 2026

- [ ] **Resume version history** — store and compare multiple resume versions per job
- [ ] **Follow-up scheduler** — auto-draft a follow-up email 7 days after send if no reply
- [ ] **Cover letter generation** — full-page PDF cover letter alongside resume
- [ ] **Screenshot drag-and-drop** — replace file picker with drag-and-drop on the upload step
- [ ] **Dark mode** — Tailwind dark mode support in the frontend

---

## 🔮 v2.0.0 — Agentic Pipeline

**Target:** Q4 2026

Replace the linear 5-step wizard with a **LangGraph multi-agent pipeline**:

| Agent | Role |
|-------|------|
| `JDParserAgent` | Extract and validate JD, flag ambiguous requirements |
| `ATSValidationAgent` | Score draft resume, identify specific gaps |
| `ResumeTailoringAgent` | Iteratively improve resume until ATS score ≥ 85% |
| `EmailDraftAgent` | Generate and self-evaluate cold email quality |

The pipeline re-runs tailoring automatically if the ATS score is below threshold — removing the need for manual iteration.

---

## 🏗️ v2.1.0 — Multi-user & Infrastructure

- [ ] **JWT authentication** — replace `user_id=1` hardcode with real auth
- [ ] **PostgreSQL** — production-grade database for multi-user scale
- [ ] **Redis** — task queue for async PDF generation
- [ ] **Public deployment** — Vercel (frontend) + Render (backend) as a live demo

---

## 💡 Ideas Under Consideration

These are not scheduled but may be picked up:

- RAG over public job board APIs (instead of screenshot input)
- Browser extension to capture JD in one click
- Slack/WhatsApp bot interface for mobile users
- Feedback loop — track which email subjects get replies and fine-tune prompts

---

## Out of Scope (v1.x)

These features are explicitly excluded from the MVP:

- Automated job scraping (ToS risk)
- Mass application sending without human review
- Payment or subscription tiers
- Support for multiple users on a shared instance

---

*Last updated: June 2026*
