# AutoApply AI — API Documentation

Base URL: `http://localhost:8000`
Interactive docs: `http://localhost:8000/docs`

---

## Profile

### Upload Resume
Parses a PDF or DOCX resume into structured profile items stored in SQLite + ChromaDB.

```http
POST /profile/upload-resume
Content-Type: multipart/form-data
```

**Request**
```
file: <PDF or DOCX file>
```

**Response**
```json
{
  "items_created": 41,
  "preview": [
    {
      "id": 1,
      "user_id": 1,
      "type": "skill",
      "content": "Selenium WebDriver — Java automation framework",
      "tags": "selenium, java, automation, testing"
    }
  ]
}
```

---

### Get Profile
```http
GET /profile
```

**Response**
```json
{
  "items": [
    {
      "id": 1,
      "user_id": 1,
      "type": "skill",
      "content": "Selenium WebDriver — Java automation framework",
      "tags": "selenium, java, automation"
    },
    {
      "id": 2,
      "user_id": 1,
      "type": "project",
      "content": "E-commerce Test Automation Framework using Selenium + TestNG",
      "tags": "selenium, testng, automation, java"
    }
  ]
}
```

---

### Clear Profile
```http
DELETE /profile/clear
```

**Response**
```json
{ "status": "cleared" }
```

---

## Extraction

### Extract from Screenshot
Sends a job posting image to Groq Vision and returns structured JD JSON.

```http
POST /extract/from-image
Content-Type: multipart/form-data
```

**Request**
```
file: <PNG, JPG, or WEBP image>
```

**Response**
```json
{
  "job_id": 7,
  "company_name": "Infosys",
  "job_title": "SDET Engineer",
  "core_responsibilities": [
    "Design and implement automated test frameworks",
    "Write and maintain test scripts using Selenium and Java",
    "Collaborate with development teams on CI/CD integration"
  ],
  "required_skills": [
    "Java", "Selenium WebDriver", "TestNG", "REST Assured",
    "SQL", "Git", "Jenkins", "Cucumber BDD"
  ],
  "preferred_certifications": ["ISTQB"],
  "minimum_years_experience": 2
}
```

---

### Extract from Text
For when you have the JD text pasted directly.

```http
POST /extract/from-text
Content-Type: multipart/form-data
```

**Request**
```
jd_text: "We are looking for a SDET Engineer at Infosys..."
```

**Response** — same schema as `/extract/from-image`

---

## Matching

### Match Profile to JD
Retrieves the top-k relevant profile chunks from ChromaDB and computes a hybrid ATS score.

```http
POST /match
Content-Type: application/json
```

**Request**
```json
{
  "company_name": "Infosys",
  "job_title": "SDET Engineer",
  "core_responsibilities": ["Design test frameworks", "Write Selenium scripts"],
  "required_skills": ["Java", "Selenium WebDriver", "TestNG", "REST Assured"],
  "preferred_certifications": ["ISTQB"],
  "minimum_years_experience": 2
}
```

**Response**
```json
{
  "job_id": 7,
  "match_score": 0.661,
  "breakdown": {
    "sbert": 0.595,
    "tfidf": 0.291,
    "boolean": 0.875,
    "total": 0.661
  },
  "missing_skills": ["Jenkins"],
  "top_chunks": [
    {
      "id": 3,
      "type": "project",
      "content": "E-commerce Test Automation — Selenium + TestNG + Java",
      "tags": "selenium, testng, java"
    }
  ]
}
```

**Scoring formula:**
```
Total = (0.30 × SBERT) + (0.30 × TF-IDF) + (0.40 × Boolean)
```

---

## Resume Generation

### Generate Tailored Resume
Generates a tailored ATS-safe resume PDF using the full profile from SQLite.

```http
POST /generate-resume
Content-Type: application/json
```

**Request**
```json
{
  "job_id": 7,
  "job_description": {
    "company_name": "Infosys",
    "job_title": "SDET Engineer",
    "core_responsibilities": ["Design test frameworks"],
    "required_skills": ["Java", "Selenium WebDriver", "TestNG"],
    "preferred_certifications": ["ISTQB"],
    "minimum_years_experience": 2
  }
}
```

**Response**
```json
{
  "job_id": 7,
  "resume_html": "<html>...</html>",
  "pdf_path": "backend/outputs/resume_job_7.pdf",
  "match_score": 0.782
}
```

---

### Download Resume PDF
```http
GET /generate-resume/download/{job_id}
```

**Response:** PDF file download (`application/pdf`)

---

## Email

### Draft Cold Email
```http
POST /email/draft
Content-Type: application/json
```

**Request**
```json
{
  "job_id": 7,
  "recipient_email": "hiring@infosys.com"
}
```

**Response**
```json
{
  "draft_id": 3,
  "subject": "SDET Engineer Application — Selenium + Java Automation Specialist",
  "body": "Your automation testing initiatives at Infosys caught my attention...\n\n[full email body]"
}
```

---

### Send Email
Saves any user edits and sends via Gmail with PDF resume attached.

```http
POST /email/send/{draft_id}
Content-Type: application/json
```

**Request** (all fields optional — send only if user edited)
```json
{
  "subject": "SDET Engineer Application — Edited Subject",
  "body": "Updated email body after human review..."
}
```

**Response**
```json
{
  "success": true,
  "draft_id": 3,
  "gmail_message_id": "19efabf9b509af98",
  "sent_to": "hiring@infosys.com",
  "subject": "SDET Engineer Application — Edited Subject",
  "pdf_attached": true
}
```

---

### Get Single Draft
```http
GET /email/draft/{draft_id}
```

**Response**
```json
{
  "id": 3,
  "job_id": 7,
  "recipient_email": "hiring@infosys.com",
  "subject": "SDET Engineer Application",
  "body": "Your automation testing initiatives at Infosys...",
  "send_status": "pending",
  "sent_at": null
}
```

---

### List All Drafts
```http
GET /email/drafts
```

**Response**
```json
{
  "drafts": [
    {
      "id": 3,
      "job_id": 7,
      "job_title": "SDET Engineer",
      "company_name": "Infosys",
      "recipient_email": "hiring@infosys.com",
      "subject": "SDET Engineer Application",
      "send_status": "sent",
      "sent_at": "2026-06-25T10:30:00"
    }
  ]
}
```

---

## Gmail OAuth

### Start OAuth Flow
Redirects browser to Google consent screen.

```http
GET /auth/gmail
```

**Response:** `302 Redirect` → Google OAuth consent page

---

### OAuth Callback
Google redirects here after user approves. Saves `token.json` automatically.

```http
GET /auth/gmail/callback?code=...&state=...
```

**Response**
```json
{
  "success": true,
  "message": "Gmail authorized! You can now send emails via AutoApply AI.",
  "next_step": "Go back to the app and click 'Send Email'."
}
```

---

### Check Authorization Status
```http
GET /auth/gmail/status
```

**Response**
```json
{
  "authorized": true,
  "credentials_file_found": true,
  "message": "Gmail is authorized and ready to send."
}
```

---

## Error Responses

All endpoints return standard HTTP error codes:

```json
{ "detail": "No profile found. Please upload your resume first." }
```

| Code | Meaning |
|------|---------|
| `400` | Bad request (missing profile, empty input) |
| `403` | Gmail not authorized |
| `404` | Resource not found |
| `422` | Extraction/parsing failed |
| `500` | LLM or PDF generation error |
