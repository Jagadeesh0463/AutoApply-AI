"""
Gmail OAuth flow endpoints.

Usage:
  1. Visit http://localhost:8000/auth/gmail in your browser
  2. You will be redirected to Google's consent page
  3. After approving, Google redirects to /auth/gmail/callback
  4. token.json is saved — Gmail is now authorized for sending
"""
import os
import json
from fastapi import APIRouter
from fastapi.responses import RedirectResponse, JSONResponse
from config import GMAIL_CREDENTIALS_PATH, BASE_DIR
from services.gmail_sender import (
    get_oauth_flow,
    is_gmail_authorized,
    _save_token,
)

router = APIRouter()

# Temp file to store code_verifier between the two OAuth requests
_CODE_VERIFIER_PATH = os.path.join(BASE_DIR, ".oauth_state.json")


def _save_state(data: dict):
    with open(_CODE_VERIFIER_PATH, "w") as f:
        json.dump(data, f)


def _load_state() -> dict:
    if not os.path.exists(_CODE_VERIFIER_PATH):
        return {}
    with open(_CODE_VERIFIER_PATH) as f:
        return json.load(f)


def _clear_state():
    if os.path.exists(_CODE_VERIFIER_PATH):
        os.remove(_CODE_VERIFIER_PATH)


@router.get("/gmail/status")
def gmail_status():
    """Check if Gmail OAuth is set up."""
    authorized = is_gmail_authorized()
    has_credentials = os.path.exists(GMAIL_CREDENTIALS_PATH)
    return {
        "authorized": authorized,
        "credentials_file_found": has_credentials,
        "message": (
            "Gmail is authorized and ready to send."
            if authorized
            else "Not authorized. Visit GET /auth/gmail to connect Gmail."
        ),
    }


@router.get("/gmail")
def start_gmail_oauth():
    """
    Starts the Gmail OAuth flow.
    Opens Google's consent screen in the browser.
    """
    if not os.path.exists(GMAIL_CREDENTIALS_PATH):
        return JSONResponse(
            status_code=400,
            content={
                "error": "credentials.json not found",
                "instructions": [
                    "1. Go to https://console.cloud.google.com",
                    "2. Enable Gmail API",
                    "3. Create OAuth Web Client ID",
                    "4. Save as backend/credentials.json",
                ],
            },
        )

    flow = get_oauth_flow()
    auth_url, state = flow.authorization_url(
        access_type="offline",
        prompt="consent",   # Force refresh_token to be returned
    )

    # Save code_verifier so the callback can use it
    # (google-auth-oauthlib generates it internally; we extract it here)
    state_data = {"state": state}
    if hasattr(flow, "code_verifier") and flow.code_verifier:
        state_data["code_verifier"] = flow.code_verifier
    _save_state(state_data)

    return RedirectResponse(auth_url)


@router.get("/gmail/callback")
def gmail_oauth_callback(code: str, state: str = None, error: str = None):
    """
    Google redirects here after user approves.
    Exchanges the auth code for tokens and saves token.json.
    """
    if error:
        return JSONResponse(
            status_code=400,
            content={"error": f"OAuth denied: {error}"}
        )

    try:
        saved = _load_state()
        flow = get_oauth_flow()

        # Pass code_verifier if it was used during authorization
        fetch_kwargs = {"code": code}
        if saved.get("code_verifier"):
            fetch_kwargs["code_verifier"] = saved["code_verifier"]

        flow.fetch_token(**fetch_kwargs)
        _save_token(flow.credentials)
        _clear_state()

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"Token exchange failed: {str(e)}"}
        )

    return JSONResponse(content={
        "success": True,
        "message": "Gmail authorized! You can now send emails via AutoApply AI.",
        "next_step": "Go back to the app and click 'Send Email'.",
    })
