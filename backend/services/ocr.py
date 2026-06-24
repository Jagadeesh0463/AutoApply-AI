import base64
import json
import os
from PIL import Image
from groq import Groq
from config import (
    GROQ_API_KEY, GROQ_VISION_MODEL, GROQ_TEXT_MODEL,
    PROMPTS_DIR, MAX_IMAGE_SIZE, IMAGE_QUALITY
)
from schemas import JobDescription

client = Groq(api_key=GROQ_API_KEY)

# Load extraction prompt once
with open(os.path.join(PROMPTS_DIR, "extraction.txt"), "r") as f:
    EXTRACTION_PROMPT = f.read().strip()


# ─── Step 1: Preprocess image ────────────────────────────────────────────────

def preprocess_image(input_path: str, output_path: str) -> str:
    """
    Resize and compress screenshot to stay within Groq Vision free-tier limits.
    Max 1000x1000px, JPEG quality 85.
    """
    img = Image.open(input_path)

    # Convert RGBA/palette to RGB (JPEG doesn't support transparency)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    img.thumbnail(MAX_IMAGE_SIZE)
    img.save(output_path, "JPEG", quality=IMAGE_QUALITY)
    print(f"[OCR] Preprocessed: {img.size} → saved to {output_path}")
    return output_path


# ─── Step 2a: Extract via Groq Vision ────────────────────────────────────────

def extract_with_groq_vision(image_path: str) -> dict:
    """Send preprocessed image to Groq Vision and get structured JD JSON."""
    with open(image_path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    response = client.chat.completions.create(
        model=GROQ_VISION_MODEL,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": EXTRACTION_PROMPT
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_data}"
                        }
                    }
                ]
            }
        ],
        temperature=0.1,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()
    return _parse_json_response(raw)


# ─── Step 2b: Fallback — EasyOCR + Groq text ─────────────────────────────────

def extract_with_easyocr_fallback(image_path: str) -> dict:
    """
    Run EasyOCR locally to get raw text, then send to Groq text model
    to structure it into JD JSON. No API dependency for OCR step.
    """
    print("[OCR] Groq Vision failed — falling back to EasyOCR")
    import easyocr
    reader = easyocr.Reader(["en"], gpu=False)
    results = reader.readtext(image_path, detail=0)
    raw_text = "\n".join(results)
    print(f"[OCR] EasyOCR extracted {len(raw_text)} characters")

    response = client.chat.completions.create(
        model=GROQ_TEXT_MODEL,
        messages=[
            {
                "role": "user",
                "content": f"{EXTRACTION_PROMPT}\n\nJob posting text:\n{raw_text}"
            }
        ],
        temperature=0.1,
        max_tokens=1024,
    )

    raw = response.choices[0].message.content.strip()
    return _parse_json_response(raw)


# ─── JSON parser (shared) ─────────────────────────────────────────────────────

def _parse_json_response(raw: str) -> dict:
    """Strip markdown fences if present, then parse JSON."""
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)


# ─── Main entry point ─────────────────────────────────────────────────────────

def extract_jd_from_image(image_path: str, processed_path: str) -> JobDescription:
    """
    Full pipeline:
    1. Preprocess image (resize + compress)
    2. Try Groq Vision
    3. Fall back to EasyOCR + Groq text if Vision fails
    4. Return validated JobDescription
    """
    preprocess_image(image_path, processed_path)

    try:
        data = extract_with_groq_vision(processed_path)
        print("[OCR] Groq Vision extraction succeeded")
    except Exception as e:
        print(f"[OCR] Groq Vision failed: {e}")
        try:
            data = extract_with_easyocr_fallback(processed_path)
            print("[OCR] EasyOCR fallback succeeded")
        except Exception as e2:
            print(f"[OCR] EasyOCR fallback also failed: {e2}")
            raise RuntimeError(
                "Both Groq Vision and EasyOCR extraction failed. "
                "Please try a clearer screenshot or paste the JD text directly."
            )

    # Validate and return
    return JobDescription(
        company_name=data.get("company_name", "Unknown"),
        job_title=data.get("job_title", "Unknown"),
        core_responsibilities=data.get("core_responsibilities", []),
        required_skills=data.get("required_skills", []),
        preferred_certifications=data.get("preferred_certifications", []),
        minimum_years_experience=data.get("minimum_years_experience"),
    )
