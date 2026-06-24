"""
Tests for hybrid ATS scoring: SBERT + TF-IDF + Boolean.

Run: pytest tests/test_matching.py -v
"""

import sys
import os
from unittest.mock import MagicMock

# Mock heavy dependencies before importing scorer
sys.modules['chromadb'] = MagicMock()
sys.modules['sentence_transformers'] = MagicMock()
sys.modules['services.vector_store'] = MagicMock()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from services.scorer import boolean_score, tfidf_score, find_missing_skills


# ─── Boolean Score Tests ──────────────────────────────────────────────────────

class TestBooleanScore:

    def test_exact_skill_match(self):
        skills = ["Python", "FastAPI"]
        resume = "Experience with Python and FastAPI development."
        score = boolean_score(skills, resume)
        assert score == 1.0, "All exact skills should score 1.0"

    def test_partial_skill_match(self):
        skills = ["Python", "FastAPI", "Docker"]
        resume = "Experience with Python and FastAPI development."
        score = boolean_score(skills, resume)
        assert 0.6 <= score <= 0.7, "2 of 3 skills found → ~0.67"

    def test_no_skill_match(self):
        skills = ["Kubernetes", "Terraform", "Rust"]
        resume = "Experience with Python and JavaScript."
        score = boolean_score(skills, resume)
        assert score == 0.0, "No matching skills should score 0.0"

    def test_multiword_skill_match(self):
        """Token-based matching: 'Selenium WebDriver' should match resume with 'selenium' and 'webdriver'."""
        skills = ["Selenium WebDriver"]
        resume = "Proficient in selenium and webdriver automation."
        score = boolean_score(skills, resume)
        assert score == 1.0, "Multi-word skill should match via token-based search"

    def test_compound_skill_with_ampersand(self):
        """'SQL & database validation' should match if 'sql' and 'database' are in resume."""
        skills = ["SQL & database validation"]
        resume = "Strong SQL and database experience."
        score = boolean_score(skills, resume)
        assert score == 1.0, "Compound skill with & should match on key tokens"

    def test_empty_skills_list(self):
        score = boolean_score([], "some resume text")
        assert score == 0.0, "Empty skills list should return 0.0"

    def test_case_insensitive(self):
        skills = ["JAVA", "SELENIUM"]
        resume = "java developer with selenium experience"
        score = boolean_score(skills, resume)
        assert score == 1.0, "Matching should be case-insensitive"


# ─── TF-IDF Score Tests ───────────────────────────────────────────────────────

class TestTfidfScore:

    def test_identical_texts_score_high(self):
        text = "Python FastAPI developer with REST API experience and SQL database skills"
        score = tfidf_score(text, text)
        assert score >= 0.99, "Identical texts should score ~1.0"

    def test_completely_different_texts_score_low(self):
        jd = "Python machine learning data science neural networks"
        resume = "Carpentry woodworking furniture making construction"
        score = tfidf_score(jd, resume)
        assert score < 0.1, "Completely unrelated texts should score near 0"

    def test_partial_overlap_scores_between(self):
        jd = "Python FastAPI Selenium testing automation"
        resume = "Python developer with Django experience and some testing"
        score = tfidf_score(jd, resume)
        assert 0.1 < score < 0.9, "Partial overlap should score between 0 and 1"

    def test_returns_float(self):
        score = tfidf_score("python developer", "python programmer")
        assert isinstance(score, float)
        assert 0.0 <= score <= 1.0


# ─── Missing Skills Tests ─────────────────────────────────────────────────────

class TestFindMissingSkills:

    def test_all_skills_present(self):
        skills = ["Python", "FastAPI"]
        resume = "Python and FastAPI developer."
        missing = find_missing_skills(skills, resume)
        assert missing == [], "No skills should be missing"

    def test_some_skills_missing(self):
        skills = ["Python", "FastAPI", "Docker", "Kubernetes"]
        resume = "Python and FastAPI developer."
        missing = find_missing_skills(skills, resume)
        assert "Docker" in missing
        assert "Kubernetes" in missing
        assert "Python" not in missing

    def test_all_skills_missing(self):
        skills = ["Rust", "Go", "Erlang"]
        resume = "Python JavaScript developer."
        missing = find_missing_skills(skills, resume)
        assert set(missing) == {"Rust", "Go", "Erlang"}

    def test_empty_skills_list(self):
        missing = find_missing_skills([], "some resume text")
        assert missing == []
