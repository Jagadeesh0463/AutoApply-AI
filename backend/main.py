import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from config import UPLOAD_DIR, OUTPUT_DIR

# --- Create required directories ---
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- Initialize database on startup ---
init_db()

# --- App ---
app = FastAPI(
    title="AutoApply AI",
    description="Intelligent cold email job applier with ATS resume tailoring",
    version="0.1.0",
)

# --- CORS: allow Next.js dev server (port 3000) to call this API (port 8000) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Health check ---
@app.get("/health")
def health():
    return {"status": "ok", "service": "AutoApply AI"}

# --- Routers ---
from routers import profile
app.include_router(profile.router, prefix="/profile", tags=["Profile"])

from routers import extract
app.include_router(extract.router, prefix="/extract", tags=["Extraction"])

from routers import match
app.include_router(match.router, prefix="/match", tags=["Matching"])

from routers import resume
app.include_router(resume.router, prefix="/generate-resume", tags=["Resume"])

from routers import email
app.include_router(email.router, prefix="/email", tags=["Email"])

from routers import auth
app.include_router(auth.router, prefix="/auth", tags=["Auth"])
