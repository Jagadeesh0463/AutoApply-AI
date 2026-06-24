"""
Phase 8 — Automated test runner.
Sends all 5 job screenshots through the full pipeline and records metrics.

Run (with backend running on port 8000):
    python run_phase8_tests.py

Output:
    test_results/phase8_metrics.csv   — raw numbers
    test_results/phase8_report.txt    — human-readable summary
"""
import os
import csv
import time
import json
import requests

BASE = "http://localhost:8000"
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "test_screenshots")
RESULTS_DIR = os.path.join(os.path.dirname(__file__), "test_results")
os.makedirs(RESULTS_DIR, exist_ok=True)

JOBS = [
    "job1_tcs_qa_automation.png",
    "job2_infosys_sdet.png",
    "job3_wipro_software_tester.png",
    "job4_capgemini_qa_lead.png",
    "job5_accenture_automation_engineer.png",
]

CSV_PATH = os.path.join(RESULTS_DIR, "phase8_metrics.csv")
REPORT_PATH = os.path.join(RESULTS_DIR, "phase8_report.txt")


def run_pipeline(screenshot_filename: str) -> dict:
    """Run one screenshot through the full pipeline and return metrics."""
    path = os.path.join(SCREENSHOTS_DIR, screenshot_filename)
    result = {
        "screenshot": screenshot_filename,
        "company": "",
        "job_title": "",
        "job_id": None,
        "skills_extracted": 0,
        "match_score": 0.0,
        "sbert_score": 0.0,
        "tfidf_score": 0.0,
        "boolean_score": 0.0,
        "missing_skills": 0,
        "resume_match_score": 0.0,
        "email_subject": "",
        "email_word_count": 0,
        "extract_time_s": 0.0,
        "match_time_s": 0.0,
        "resume_time_s": 0.0,
        "email_time_s": 0.0,
        "total_time_s": 0.0,
        "status": "ok",
        "error": "",
    }

    total_start = time.time()

    # ── Step 1: Extract JD ────────────────────────────────────────────────────
    print(f"\n  [1/4] Extracting JD from {screenshot_filename}...")
    t0 = time.time()
    try:
        with open(path, "rb") as f:
            resp = requests.post(
                f"{BASE}/extract/from-image",
                files={"file": (screenshot_filename, f, "image/png")},
                timeout=60,
            )
        resp.raise_for_status()
        jd = resp.json()
        result["extract_time_s"] = round(time.time() - t0, 2)
        result["company"] = jd.get("company_name", "")
        result["job_title"] = jd.get("job_title", "")
        result["job_id"] = jd.get("job_id")
        result["skills_extracted"] = len(jd.get("required_skills", []))
        print(f"      → {result['job_title']} @ {result['company']} | "
              f"{result['skills_extracted']} skills | {result['extract_time_s']}s")
    except Exception as e:
        result["status"] = "failed"
        result["error"] = f"extract: {e}"
        return result

    # Strip job_id before sending to /match and /generate-resume
    job_id = jd.pop("job_id", None)
    result["job_id"] = job_id

    # ── Step 2: Match Profile ─────────────────────────────────────────────────
    print(f"  [2/4] Matching profile...")
    t0 = time.time()
    try:
        resp = requests.post(
            f"{BASE}/match",
            json=jd,
            timeout=30,
        )
        resp.raise_for_status()
        match = resp.json()
        result["match_time_s"] = round(time.time() - t0, 2)
        bd = match.get("breakdown", {})
        result["match_score"] = round(match.get("match_score", 0) * 100, 1)
        result["sbert_score"] = round(bd.get("sbert", 0) * 100, 1)
        result["tfidf_score"] = round(bd.get("tfidf", 0) * 100, 1)
        result["boolean_score"] = round(bd.get("boolean", 0) * 100, 1)
        result["missing_skills"] = len(match.get("missing_skills", []))
        print(f"      → Score: {result['match_score']}% "
              f"(SBERT={result['sbert_score']}%, "
              f"TF-IDF={result['tfidf_score']}%, "
              f"Skills={result['boolean_score']}%) | "
              f"Missing: {result['missing_skills']} | {result['match_time_s']}s")
    except Exception as e:
        result["status"] = "failed"
        result["error"] = f"match: {e}"
        return result

    # ── Step 3: Generate Resume ───────────────────────────────────────────────
    print(f"  [3/4] Generating resume...")
    t0 = time.time()
    try:
        resp = requests.post(
            f"{BASE}/generate-resume",
            json={"job_id": job_id, "job_description": jd},
            timeout=60,
        )
        resp.raise_for_status()
        resume = resp.json()
        result["resume_time_s"] = round(time.time() - t0, 2)
        result["resume_match_score"] = round(resume.get("match_score", 0) * 100, 1)
        print(f"      → ATS Score: {result['resume_match_score']}% | {result['resume_time_s']}s")
    except Exception as e:
        result["status"] = "failed"
        result["error"] = f"resume: {e}"
        return result

    # ── Step 4: Draft Email ───────────────────────────────────────────────────
    print(f"  [4/4] Drafting cold email...")
    t0 = time.time()
    try:
        resp = requests.post(
            f"{BASE}/email/draft",
            json={"job_id": job_id, "recipient_email": "test@autoapply.ai"},
            timeout=30,
        )
        resp.raise_for_status()
        email = resp.json()
        result["email_time_s"] = round(time.time() - t0, 2)
        result["email_subject"] = email.get("subject", "")
        result["email_word_count"] = len(email.get("body", "").split())
        print(f"      → Subject: '{result['email_subject']}' | "
              f"Words: {result['email_word_count']} | {result['email_time_s']}s")
    except Exception as e:
        result["status"] = "failed"
        result["error"] = f"email: {e}"
        return result

    result["total_time_s"] = round(time.time() - total_start, 2)
    print(f"  ✅ Done in {result['total_time_s']}s")
    return result


def save_csv(results: list[dict]):
    if not results:
        return
    with open(CSV_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=results[0].keys())
        writer.writeheader()
        writer.writerows(results)
    print(f"\nCSV saved: {CSV_PATH}")


def save_report(results: list[dict]):
    ok = [r for r in results if r["status"] == "ok"]
    lines = [
        "=" * 60,
        "AUTOAPPLY AI — PHASE 8 TEST REPORT",
        "=" * 60,
        f"Total jobs tested : {len(results)}",
        f"Successful        : {len(ok)}",
        f"Failed            : {len(results) - len(ok)}",
        "",
    ]

    if ok:
        avg_match  = sum(r["match_score"] for r in ok) / len(ok)
        avg_ats    = sum(r["resume_match_score"] for r in ok) / len(ok)
        avg_total  = sum(r["total_time_s"] for r in ok) / len(ok)
        avg_words  = sum(r["email_word_count"] for r in ok) / len(ok)

        lines += [
            f"Avg Match Score   : {avg_match:.1f}%",
            f"Avg ATS Score     : {avg_ats:.1f}%",
            f"Avg Pipeline Time : {avg_total:.1f}s",
            f"Avg Email Length  : {avg_words:.0f} words",
            "",
            "-" * 60,
            "Per-Job Results:",
            "-" * 60,
        ]

        for i, r in enumerate(results, 1):
            lines.append(f"\nJob {i}: {r['job_title']} @ {r['company']}")
            lines.append(f"  Status          : {r['status']}")
            if r["status"] == "ok":
                lines.append(f"  Skills Extracted: {r['skills_extracted']}")
                lines.append(f"  Match Score     : {r['match_score']}%")
                lines.append(f"    SBERT         : {r['sbert_score']}%")
                lines.append(f"    TF-IDF        : {r['tfidf_score']}%")
                lines.append(f"    Skills (Bool) : {r['boolean_score']}%")
                lines.append(f"  Missing Skills  : {r['missing_skills']}")
                lines.append(f"  ATS Score       : {r['resume_match_score']}%")
                lines.append(f"  Email Words     : {r['email_word_count']}")
                lines.append(f"  Total Time      : {r['total_time_s']}s")
            else:
                lines.append(f"  Error: {r['error']}")

    lines += ["", "=" * 60]
    report = "\n".join(lines)

    with open(REPORT_PATH, "w") as f:
        f.write(report)

    print(report)
    print(f"\nReport saved: {REPORT_PATH}")


if __name__ == "__main__":
    print("=" * 60)
    print("AutoApply AI — Phase 8 Automated Test Run")
    print("=" * 60)
    print(f"Testing {len(JOBS)} job screenshots...\n")

    # Check backend is running
    try:
        requests.get(f"{BASE}/health", timeout=5)
    except Exception:
        print("❌ Backend not running! Start it with:")
        print("   cd backend && source venv/bin/activate && uvicorn main:app --reload")
        exit(1)

    results = []
    for filename in JOBS:
        print(f"\n{'─' * 60}")
        print(f"Testing: {filename}")
        print("─" * 60)
        r = run_pipeline(filename)
        results.append(r)
        # Small pause between jobs to avoid rate limits
        if filename != JOBS[-1]:
            print("  (Waiting 3s before next job...)")
            time.sleep(3)

    save_csv(results)
    save_report(results)
