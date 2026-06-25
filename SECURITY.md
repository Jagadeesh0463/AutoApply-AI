# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅ Yes     |
| < 1.0   | ❌ No      |

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately via GitHub: **[github.com/Jagadeesh0463](https://github.com/Jagadeesh0463)**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive an acknowledgement within 48 hours. If the issue is confirmed, a fix will be prioritised and a patched release published. You will be credited in the release notes unless you prefer to remain anonymous.

---

## Security Design Notes

AutoApply AI is a single-user local application. Key security properties:

- **No secrets in code** — Groq API key lives in `.env` (gitignored). Gmail credentials in `backend/credentials.json` (gitignored).
- **OAuth 2.0 only** — Gmail is accessed via Google's OAuth flow with `gmail.send` scope only. No SMTP passwords stored.
- **Local data** — Profile items, resume PDFs, and ChromaDB vectors are stored only on the user's machine.
- **Screenshot deletion** — Uploaded images are deleted from disk immediately after Groq Vision processing completes.
- **No external profile transmission** — Resume content is sent to Groq only during tailoring. It is not stored or logged by this application.

---

## Known Limitations

- `user_id=1` is hardcoded — this is a single-user MVP and should not be deployed as a multi-tenant service without adding proper authentication.
- Gmail `token.json` is stored unencrypted on disk. For shared machines, restrict file permissions (`chmod 600 backend/token.json`).
