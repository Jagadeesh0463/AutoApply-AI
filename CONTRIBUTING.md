# Contributing to AutoApply AI

Thank you for your interest in contributing. This is a personal capstone project, but pull requests for bug fixes and improvements are welcome.

---

## Getting Started

1. Fork the repository
2. Clone your fork and follow the [installation guide](README.md#-installation)
3. Create a branch for your change (see naming convention below)
4. Make your change, add or update tests, and verify everything passes
5. Open a pull request against `main`

---

## Branch Naming

```
feature/short-description     # new functionality
fix/short-description         # bug fixes
docs/short-description        # documentation only
chore/short-description       # tooling, deps, CI
```

Examples:
- `feature/multi-user-auth`
- `fix/weasyprint-page-break`
- `docs/add-screenshots`

---

## Commit Style

Use conventional commits:

```
feat: add iterative resume tailoring loop
fix: handle empty skills list in boolean_score
docs: add architecture diagram to README
chore: upgrade sentence-transformers to 3.x
test: add edge cases for tfidf_score
```

Keep the subject line under 72 characters. Add a body if the change needs explanation.

---

## Pull Request Process

1. Keep PRs focused — one concern per PR
2. Reference any related issue in the PR description (`Closes #12`)
3. All CI checks must pass (pytest + TypeScript check + Next.js build)
4. Update `CHANGELOG.md` under `[Unreleased]` with a short entry
5. The PR will be reviewed and merged by the maintainer

---

## Running Tests Locally

```bash
# Backend tests (from repo root)
cd backend
python -m pytest ../tests/ -v

# Frontend type check
cd frontend
npx tsc --noEmit
npm run build
```

All 38 tests must pass before opening a PR. If your change adds new behaviour, add tests for it.

---

## Coding Standards

**Backend (Python)**
- Follow PEP 8
- Use type hints on all function signatures
- Keep each router file focused on one resource (`/email`, `/match`, `/profile`, etc.)
- Use `get_connection()` for all SQLite access — do not open raw connections

**Frontend (TypeScript)**
- Strict TypeScript — no `any` unless unavoidable
- All API calls go through `frontend/lib/api.ts`
- Keep components in `frontend/components/`, pages in `frontend/app/`

**General**
- "Emphasize, never fabricate" — the AI must never invent profile content
- No new paid APIs — the project must remain 100% free-tier
- Secrets stay in `.env` — never hardcode API keys

---

## Reporting Bugs

Open a GitHub issue using the bug report template. Include:
- What you expected to happen
- What actually happened
- Your OS, Python version, and Node version
- Any error messages or stack traces

---

## Questions

Open a GitHub Discussion or email bhagyat463@gmail.com.
