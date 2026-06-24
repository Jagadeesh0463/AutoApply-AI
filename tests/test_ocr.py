"""
Tests for OCR extraction pipeline: image preprocessing and JSON parsing.

Run: pytest tests/test_ocr.py -v
"""

import sys
import os
import json
import tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.ocr import _parse_json_response, preprocess_image


# ─── JSON Parser Tests ────────────────────────────────────────────────────────

class TestParseJsonResponse:

    def test_plain_json(self):
        raw = '{"company_name": "Google", "job_title": "SWE"}'
        result = _parse_json_response(raw)
        assert result["company_name"] == "Google"
        assert result["job_title"] == "SWE"

    def test_json_with_markdown_fences(self):
        raw = '```json\n{"company_name": "Google", "job_title": "SWE"}\n```'
        result = _parse_json_response(raw)
        assert result["company_name"] == "Google"

    def test_json_with_plain_fences(self):
        raw = '```\n{"company_name": "Infosys", "job_title": "SDET"}\n```'
        result = _parse_json_response(raw)
        assert result["company_name"] == "Infosys"

    def test_full_jd_schema(self):
        data = {
            "company_name": "TCS",
            "job_title": "QA Automation Engineer",
            "core_responsibilities": ["Write test cases", "Automate regression"],
            "required_skills": ["Selenium", "Java", "TestNG"],
            "preferred_certifications": ["ISTQB"],
            "minimum_years_experience": 2
        }
        raw = json.dumps(data)
        result = _parse_json_response(raw)
        assert result["required_skills"] == ["Selenium", "Java", "TestNG"]
        assert result["minimum_years_experience"] == 2

    def test_invalid_json_raises(self):
        import pytest
        with pytest.raises(json.JSONDecodeError):
            _parse_json_response("not valid json at all")


# ─── Image Preprocessing Tests ───────────────────────────────────────────────

class TestPreprocessImage:

    def test_creates_output_file(self):
        """Preprocessing should produce a JPEG file at the output path."""
        from PIL import Image
        # Create a dummy test image
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
            img = Image.new("RGB", (2000, 3000), color=(200, 200, 200))
            img.save(tmp_in.name)
            input_path = tmp_in.name

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_out:
            output_path = tmp_out.name

        try:
            result = preprocess_image(input_path, output_path)
            assert os.path.exists(result)
            assert result == output_path

            # Verify it's a valid image and was resized
            out_img = Image.open(output_path)
            assert max(out_img.size) <= 1000, "Image should be resized to max 1000px"
        finally:
            os.unlink(input_path)
            if os.path.exists(output_path):
                os.unlink(output_path)

    def test_rgba_converted_to_rgb(self):
        """RGBA images (PNG with transparency) should be converted to RGB for JPEG."""
        from PIL import Image
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_in:
            img = Image.new("RGBA", (500, 500), color=(200, 200, 200, 128))
            img.save(tmp_in.name)
            input_path = tmp_in.name

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp_out:
            output_path = tmp_out.name

        try:
            preprocess_image(input_path, output_path)
            out_img = Image.open(output_path)
            assert out_img.mode == "RGB", "RGBA should be converted to RGB"
        finally:
            os.unlink(input_path)
            if os.path.exists(output_path):
                os.unlink(output_path)
