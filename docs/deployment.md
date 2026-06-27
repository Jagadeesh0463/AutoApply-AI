# Deployment Guide

AutoApply AI runs entirely on free tiers. This guide covers local setup, and public deployment via Vercel (frontend) + Render (backend).

---

## Local Development

See [README.md](../README.md#-installation) for full local setup instructions.

Quick start:
```bash
# Backend
cd backend && uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend && npm run dev
```

---

## Public Deployment

### Frontend — Vercel (Free)

Vercel deploys Next.js apps for free with zero configuration.

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **Add New Project** → Import `AutoApply-AI`
3. Set **Root Directory** to `frontend`
4. Add environment variable:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend.onrender.com
   ```
5. Click **Deploy**

Your frontend will be live at `https://autoapply-ai.vercel.app` (or similar).

> **Note:** `frontend/lib/api.ts` already reads `NEXT_PUBLIC_API_URL` at runtime — no code change needed for production.

---

### Backend — Render (Free Tier)

Render hosts Python/FastAPI apps on a free tier (spins down after inactivity).

1. Go to [render.com](https://render.com) → Sign in with GitHub
2. Click **New** → **Web Service** → Connect `AutoApply-AI`
3. Configure:
   | Setting | Value |
   |---------|-------|
   | Root Directory | `backend` |
   | Runtime | `Python 3.11` |
   | Build Command | `pip install -r requirements.txt` |
   | Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

4. Add environment variables:
   ```
   GROQ_API_KEY=your_groq_api_key
   ENV=production
   DAILY_SEND_CAP=10
   ```

5. Click **Create Web Service**

> **Important:** Gmail OAuth requires `credentials.json` and `token.json` to be present on the server. For production deployment, store these as Render **secret files** (not environment variables) since they are JSON files.

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ Yes | Groq API key — get free at [console.groq.com](https://console.groq.com) |
| `DAILY_SEND_CAP` | No | Max emails per day (default: 10) |
| `ENV` | No | `development` or `production` |
| `NEXT_PUBLIC_API_URL` | Frontend only | Backend URL for production |

---

## CORS Configuration for Production

Update `backend/main.py` to allow your Vercel domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-app.vercel.app",   # ← add this
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Gmail OAuth in Production

Gmail OAuth requires the redirect URI to match exactly. For production:

1. Go to [Google Cloud Console](https://console.cloud.google.com) → OAuth credentials
2. Add your Render backend URL as an authorized redirect URI:
   ```
   https://your-backend.onrender.com/auth/gmail/callback
   ```
3. Update `backend/services/gmail_sender.py`:
   ```python
   redirect_uri = os.getenv(
       "GMAIL_REDIRECT_URI",
       "http://localhost:8000/auth/gmail/callback"
   )
   ```

---

## Free Tier Limitations

| Service | Free Tier Limit | Impact |
|---------|----------------|--------|
| Groq API | ~14,400 tokens/min | Rate limit during heavy use |
| Render | Spins down after 15 min inactivity | Cold start ~30s |
| Vercel | 100GB bandwidth/month | More than enough for personal use |
| Gmail API | 500 emails/day | Far above the 10/day cap |

All limits are well within bounds for a personal-use, single-user MVP.
