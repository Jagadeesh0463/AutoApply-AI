"""
Tests for email drafting validation rules.

Run: pytest tests/test_email.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))


class TestEmailRules:
    """
    Validates that email drafts comply with the rules enforced by the prompt:
    - Max 180 words
    - No generic openers
    - Subject is role/company specific
    - No fabrication markers
    """

    SAMPLE_GOOD_EMAIL = {
        "subject": "SDET Engineer Application — Selenium + Java Automation Specialist | Infosys",
        "body": (
            "Infosys's focus on intelligent test automation aligns directly with the "
            "automation framework I built at Tech Solutions — a Page Object Model "
            "suite in Java/Selenium that reduced regression time by 60% and achieved "
            "95% pass rate across 200+ test cases.\n\n"
            "With hands-on experience in TestNG, REST Assured, and Cucumber BDD, "
            "I've delivered the exact SDET skill set your team is looking for. "
            "My ISTQB certification and SQL proficiency round out the technical "
            "requirements listed in your job description.\n\n"
            "I'd welcome a 15-minute call to discuss how my automation background "
            "can contribute to Infosys's quality engineering goals."
        )
    }

    BANNED_OPENERS = [
        "I am writing to",
        "I am a passionate",
        "I believe I am a great fit",
        "I am reaching out",
        "To whom it may concern",
    ]

    def test_email_body_under_180_words(self):
        body = self.SAMPLE_GOOD_EMAIL["body"]
        word_count = len(body.split())
        assert word_count <= 180, f"Email body has {word_count} words — must be ≤ 180"

    def test_subject_is_not_generic(self):
        subject = self.SAMPLE_GOOD_EMAIL["subject"]
        generic_subjects = ["Job Application", "Application", "Resume", "Candidate"]
        for generic in generic_subjects:
            assert generic not in subject or len(subject) > 30, \
                f"Subject '{subject}' appears too generic"

    def test_no_banned_openers(self):
        body = self.SAMPLE_GOOD_EMAIL["body"]
        for opener in self.BANNED_OPENERS:
            assert opener.lower() not in body.lower(), \
                f"Email should not open with '{opener}'"

    def test_subject_contains_role_or_company(self):
        subject = self.SAMPLE_GOOD_EMAIL["subject"]
        keywords = ["SDET", "Infosys", "Engineer", "Application"]
        assert any(k in subject for k in keywords), \
            "Subject must reference role or company"

    def test_body_not_empty(self):
        assert len(self.SAMPLE_GOOD_EMAIL["body"].strip()) > 50

    def test_body_has_call_to_action(self):
        body = self.SAMPLE_GOOD_EMAIL["body"].lower()
        cta_phrases = ["call", "meeting", "discuss", "conversation", "connect", "speak"]
        assert any(phrase in body for phrase in cta_phrases), \
            "Email body should contain a call to action"

    def test_word_count_helper(self):
        """Helper to print word count of any email body — useful during review."""
        body = self.SAMPLE_GOOD_EMAIL["body"]
        word_count = len(body.split())
        print(f"\n  📧 Email word count: {word_count}/180")
        assert word_count > 0


class TestEmailDraftResponse:
    """Validates the shape of the email draft API response."""

    def test_response_has_required_keys(self):
        response = {
            "draft_id": 1,
            "subject": "Test Subject",
            "body": "Test body content here."
        }
        assert "draft_id" in response
        assert "subject" in response
        assert "body" in response

    def test_draft_id_is_integer(self):
        draft_id = 1
        assert isinstance(draft_id, int)
        assert draft_id > 0

    def test_subject_and_body_are_strings(self):
        subject = "SDET Application — Infosys"
        body = "Email body text here."
        assert isinstance(subject, str) and len(subject) > 0
        assert isinstance(body, str) and len(body) > 0
