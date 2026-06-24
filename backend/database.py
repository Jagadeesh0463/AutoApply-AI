import sqlite3
import os
from config import DB_PATH, DATA_DIR


def get_connection() -> sqlite3.Connection:
    """
    Returns a SQLite connection with:
    - WAL journal mode (allows concurrent reads + writes without locking)
    - Foreign key enforcement
    - Row factory for dict-style access
    - 30s timeout so background tasks don't immediately collide
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def init_db() -> None:
    """
    Creates all tables if they don't exist.
    Safe to call on every startup — uses IF NOT EXISTS throughout.
    """
    conn = get_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Profile items: projects, certs, education, skills, experience
        -- Each row is one discrete chunk stored in ChromaDB too
        CREATE TABLE IF NOT EXISTS profile_items (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER REFERENCES users(id),
            type       TEXT CHECK(type IN ('project','cert','education','skill','experience')),
            content    TEXT NOT NULL,
            tags       TEXT,           -- comma-separated keywords for quick search
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- One row per job posting processed
        CREATE TABLE IF NOT EXISTS jobs (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id               INTEGER REFERENCES users(id),
            company_name          TEXT,
            job_title             TEXT,
            extracted_skills_json TEXT,   -- JSON array of required skills
            match_score           REAL,
            status                TEXT DEFAULT 'pending'
                                    CHECK(status IN ('pending','reviewed','sent','rejected')),
            created_at            TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- One row per generated resume (linked to a job)
        CREATE TABLE IF NOT EXISTS tailored_resumes (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id                INTEGER REFERENCES jobs(id),
            resume_html           TEXT,
            pdf_path              TEXT,
            match_score_breakdown TEXT    -- JSON: {sbert, tfidf, boolean, total}
        );

        -- One row per email draft (linked to a job)
        CREATE TABLE IF NOT EXISTS email_drafts (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id           INTEGER REFERENCES jobs(id),
            recipient_email  TEXT,
            subject          TEXT,
            body             TEXT,
            send_status      TEXT DEFAULT 'draft'
                               CHECK(send_status IN ('draft','sent','failed')),
            sent_at          TEXT
        );
    """)
    conn.commit()

    # Seed default user (id=1) for single-user MVP
    conn.execute(
        "INSERT OR IGNORE INTO users (id, email) VALUES (1, 'default@autoapply.local')"
    )
    conn.commit()
    conn.close()
    print(f"[DB] Initialized at {DB_PATH}")
