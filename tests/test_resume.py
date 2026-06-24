"""
Tests for resume HTML template rendering.

Run: pytest tests/test_resume.py -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from jinja2 import Environment, FileSystemLoader

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), '..', 'backend', 'templates')

SAMPLE_CANDIDATE = {
    "name": "Test Candidate",
    "email": "test@example.com",
    "phone": "+91-9999999999",
    "location": "Bengaluru, India",
    "linkedin": "linkedin.com/in/test",
    "github": "",
}

SAMPLE_RESUME = {
    "summary": "QA Automation Engineer with 2 years of experience in Selenium and Java.",
    "skills": ["Java", "Selenium WebDriver", "TestNG", "REST Assured", "SQL", "Git"],
    "certifications": ["ISTQB Foundation Level"],
    "projects": [
        {
            "name": "E-commerce Test Automation Framework",
            "tech_stack": "Java | Selenium | TestNG | Maven",
            "bullets": [
                "Built a Page Object Model framework reducing test maintenance by 40%",
                "Automated 200+ regression test cases with 95% pass rate"
            ]
        }
    ],
    "experience": [
        {
            "company": "Tech Solutions Pvt Ltd",
            "title": "QA Engineer",
            "duration": "Jan 2023 – Present",
            "location": "Bengaluru",
            "bullets": [
                "Developed Selenium automation scripts for web application testing",
                "Reduced manual testing effort by 60% through automation"
            ]
        }
    ],
    "education": [
        {
            "degree": "B.Tech in Computer Science",
            "institution": "Example University",
            "duration": "2019 – 2023"
        }
    ]
}


class TestResumeTemplate:

    def setup_method(self):
        self.env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
        self.template = self.env.get_template("resume.html")

    def render(self, candidate=None, resume=None):
        return self.template.render(
            candidate=candidate or SAMPLE_CANDIDATE,
            resume=resume or SAMPLE_RESUME
        )

    def test_renders_without_error(self):
        html = self.render()
        assert html is not None
        assert len(html) > 100

    def test_candidate_name_present(self):
        html = self.render()
        assert "Test Candidate" in html

    def test_candidate_email_present(self):
        html = self.render()
        assert "test@example.com" in html

    def test_skills_rendered(self):
        html = self.render()
        assert "Selenium WebDriver" in html
        assert "TestNG" in html

    def test_project_name_present(self):
        html = self.render()
        assert "E-commerce Test Automation Framework" in html

    def test_experience_company_present(self):
        html = self.render()
        assert "Tech Solutions Pvt Ltd" in html

    def test_education_present(self):
        html = self.render()
        assert "B.Tech in Computer Science" in html
        assert "Example University" in html

    def test_no_ul_li_tags(self):
        """ATS safety: no <ul> or <li> tags — must use div.bullet."""
        html = self.render()
        assert "<ul" not in html, "Should not use <ul> tags (WeasyPrint bullet bug)"
        assert "<li" not in html, "Should not use <li> tags (WeasyPrint bullet bug)"

    def test_single_column_no_table(self):
        """ATS safety: no table layout."""
        html = self.render()
        assert "<table" not in html, "ATS-safe resumes should not use tables"

    def test_ats_css_rules_present(self):
        """Required CSS for ATS-safe PDF rendering."""
        html = self.render()
        assert "page-break-inside: avoid" in html
        assert "page-break-after: avoid" in html
        assert "size: letter" in html
        assert "Arial" in html

    def test_summary_rendered(self):
        html = self.render()
        assert "QA Automation Engineer with 2 years" in html

    def test_empty_github_not_rendered(self):
        """Empty github field should not appear as empty span."""
        candidate = {**SAMPLE_CANDIDATE, "github": ""}
        html = self.render(candidate=candidate)
        # The github conditional block should not render anything visible
        assert "github.com" not in html

    def test_certifications_rendered(self):
        html = self.render()
        assert "ISTQB Foundation Level" in html
