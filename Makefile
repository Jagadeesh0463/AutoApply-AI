.PHONY: install run test lint clean help

# ── Setup ─────────────────────────────────────────────────────────────────────

install: install-backend install-frontend

install-backend:
	cd backend && python -m venv venv && \
	. venv/bin/activate && \
	pip install -r requirements.txt && \
	pip install pytest
	@echo "Backend dependencies installed ✅"

install-frontend:
	cd frontend && npm install
	@echo "Frontend dependencies installed ✅"

# ── Run ───────────────────────────────────────────────────────────────────────

run-backend:
	cd backend && . venv/bin/activate && uvicorn main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

# Run both in parallel (requires two terminals — use tmux or run separately)
run:
	@echo "Start backend:  make run-backend"
	@echo "Start frontend: make run-frontend"

# ── Test ──────────────────────────────────────────────────────────────────────

test:
	cd backend && . venv/bin/activate && \
	python -m pytest ../tests/ -v --tb=short
	@echo "All tests passed ✅"

test-frontend:
	cd frontend && npx tsc --noEmit
	@echo "TypeScript check passed ✅"

# ── Lint ──────────────────────────────────────────────────────────────────────

lint:
	cd backend && . venv/bin/activate && \
	python -m py_compile config.py database.py main.py schemas.py \
	  routers/auth.py routers/email.py routers/extract.py \
	  routers/match.py routers/profile.py routers/resume.py \
	  services/email_writer.py services/gmail_sender.py \
	  services/ocr.py services/profile_parser.py \
	  services/scorer.py services/tailoring.py services/vector_store.py
	@echo "Python syntax check passed ✅"

# ── Clean ─────────────────────────────────────────────────────────────────────

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -name "*.pyc" -delete 2>/dev/null || true
	find . -name ".DS_Store" -delete 2>/dev/null || true
	@echo "Cleaned ✅"

# ── Help ──────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "AutoApply AI — available commands:"
	@echo ""
	@echo "  make install          Install all backend + frontend dependencies"
	@echo "  make install-backend  Install Python dependencies only"
	@echo "  make install-frontend Install Node dependencies only"
	@echo ""
	@echo "  make run-backend      Start FastAPI on port 8000 (with reload)"
	@echo "  make run-frontend     Start Next.js on port 3000 (with HMR)"
	@echo ""
	@echo "  make test             Run all 38 backend pytest tests"
	@echo "  make test-frontend    TypeScript noEmit check"
	@echo "  make lint             Python syntax check all backend files"
	@echo ""
	@echo "  make clean            Remove __pycache__, .pyc, .DS_Store"
	@echo ""
