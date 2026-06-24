import os
from dotenv import load_dotenv

load_dotenv()

# --- Groq ---
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

# Groq model for vision (screenshot extraction)
GROQ_VISION_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"

# Groq model for text tasks (tailoring, email, profile parsing)
GROQ_TEXT_MODEL: str = "llama-3.3-70b-versatile"

# --- Paths ---
BASE_DIR: str = os.path.dirname(os.path.abspath(__file__))
DATA_DIR: str = os.path.join(BASE_DIR, "data")
UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR: str = os.path.join(BASE_DIR, "outputs")
CHROMA_DIR: str = os.path.join(DATA_DIR, "chroma")
DB_PATH: str = os.path.join(DATA_DIR, "autoapply.db")
TEMPLATES_DIR: str = os.path.join(BASE_DIR, "templates")
PROMPTS_DIR: str = os.path.join(BASE_DIR, "prompts")

# --- App settings ---
DAILY_SEND_CAP: int = int(os.getenv("DAILY_SEND_CAP", "10"))
ENV: str = os.getenv("ENV", "development")

# --- Gmail ---
GMAIL_CREDENTIALS_PATH: str = os.path.join(BASE_DIR, "credentials.json")
GMAIL_TOKEN_PATH: str = os.path.join(BASE_DIR, "token.json")
GMAIL_SCOPES: list[str] = ["https://www.googleapis.com/auth/gmail.send"]

# --- Sentence transformer model (local, no API cost) ---
EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

# --- ChromaDB collection name ---
CHROMA_COLLECTION: str = "profile"

# --- Scoring weights ---
# Boolean (keyword presence) is the most ATS-relevant signal — weighted highest
SBERT_WEIGHT: float = 0.30
TFIDF_WEIGHT: float = 0.30
BOOLEAN_WEIGHT: float = 0.40

# --- Tailoring ---
TOP_K_CHUNKS: int = 15         # top chunks for matching/scoring (semantic search)
TOP_K_RESUME: int = 30         # more chunks for resume generation (cover more profile)
MIN_MATCH_SCORE: float = 0.55  # threshold calibrated to our hybrid scoring scale

# --- Image preprocessing ---
MAX_IMAGE_SIZE: tuple[int, int] = (1000, 1000)
IMAGE_QUALITY: int = 85
