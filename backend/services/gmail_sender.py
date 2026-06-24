"""
Gmail OAuth sender.

First-time setup:
  1. Download credentials.json from Google Cloud Console → OAuth 2.0 Client IDs
  2. Call GET /auth/gmail in the browser — it will redirect to Google consent page
  3. After approval, token.json is saved automatically
  4. All future sends use the saved token (auto-refreshed)

Scopes: https://www.googleapis.com/auth/gmail.send
"""
import base64
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from config import GMAIL_CREDENTIALS_PATH, GMAIL_TOKEN_PATH, GMAIL_SCOPES


def get_gmail_service():
    """
    Returns an authenticated Gmail API service.
    Raises FileNotFoundError if credentials.json is missing.
    Raises RuntimeError if not yet authorized (token.json missing).
    """
    if not os.path.exists(GMAIL_CREDENTIALS_PATH):
        raise FileNotFoundError(
            "credentials.json not found. "
            "Download it from Google Cloud Console → APIs & Services → Credentials."
        )

    creds = None

    # Load saved token if it exists
    if os.path.exists(GMAIL_TOKEN_PATH):
        creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_PATH, GMAIL_SCOPES)

    # Refresh expired token
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save_token(creds)

    if not creds or not creds.valid:
        raise RuntimeError(
            "Gmail not authorized. Visit GET /auth/gmail to complete OAuth setup."
        )

    return build("gmail", "v1", credentials=creds)


def _save_token(creds: Credentials) -> None:
    """Persist refreshed credentials to disk."""
    with open(GMAIL_TOKEN_PATH, "w") as f:
        f.write(creds.to_json())


def get_oauth_flow() -> Flow:
    """Creates the OAuth flow for the initial authorization."""
    flow = Flow.from_client_secrets_file(
        GMAIL_CREDENTIALS_PATH,
        scopes=GMAIL_SCOPES,
        redirect_uri="http://localhost:8000/auth/gmail/callback"
    )
    # Disable PKCE — not needed for local server flow and causes
    # "Missing code verifier" errors with some Google OAuth configurations
    flow.code_verifier = None
    return flow


def send_email_with_attachment(
    to: str,
    subject: str,
    body: str,
    pdf_path: str | None = None,
    pdf_filename: str = "resume.pdf",
    from_email: str = "me",
) -> str:
    """
    Send an email via Gmail API with optional PDF attachment.

    Returns the Gmail message ID on success.
    """
    service = get_gmail_service()

    # Build MIME message
    msg = MIMEMultipart()
    msg["to"] = to
    msg["subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    # Attach PDF if path provided and file exists
    if pdf_path and os.path.exists(pdf_path):
        with open(pdf_path, "rb") as f:
            part = MIMEBase("application", "pdf")
            part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{pdf_filename}"',
            )
            msg.attach(part)

    # Encode and send
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode("utf-8")
    sent = service.users().messages().send(
        userId="me", body={"raw": raw}
    ).execute()

    return sent.get("id", "")


def is_gmail_authorized() -> bool:
    """Check if Gmail OAuth is set up and token is valid."""
    if not os.path.exists(GMAIL_CREDENTIALS_PATH):
        return False
    if not os.path.exists(GMAIL_TOKEN_PATH):
        return False
    try:
        creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_PATH, GMAIL_SCOPES)
        if creds and creds.valid:
            return True
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
            _save_token(creds)
            return True
    except Exception:
        pass
    return False
