"""
Backend API Endpoint Unit Tests
-------------------------------
Tests FastAPI endpoint functions and request validation directly without external dependencies.
"""

import sys
import os
import unittest
from fastapi import HTTPException

# Add backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import health_check, compare_texts, coach_status, coach_feedback, CompareRequest, CoachRequest


class TestBackendAPIEndpoints(unittest.TestCase):

    def test_health_check_endpoint(self):
        """Verify GET /health response structure and values."""
        res = health_check()
        self.assertEqual(res["status"], "healthy")
        self.assertEqual(res["app_name"], "CareerPilot AI Backend")
        self.assertEqual(res["version"], "0.3.0")
        print("✓ API Endpoint Test 1 Passed: GET /health returns expected status and metadata.")

    def test_compare_endpoint_valid_payload(self):
        """Verify POST /api/compare with valid resume and job description."""
        req = CompareRequest(
            resume_text="Senior DevOps Engineer experienced in AWS, Docker, and Kubernetes.",
            job_description="Seeking a DevOps Engineer with AWS, Docker, Kubernetes, and Azure experience.",
        )
        res = compare_texts(req)
        self.assertEqual(res["status"], "success")
        self.assertIn("summary", res)
        self.assertIn("matched_terms", res)
        self.assertIn("missing_terms", res)
        self.assertGreaterEqual(res["summary"]["overlap_percentage"], 50)

        matched_names = [m["term"] for m in res["matched_terms"]]
        self.assertIn("AWS", matched_names)
        self.assertIn("Docker", matched_names)
        self.assertIn("Kubernetes", matched_names)

        missing_names = [m["term"] for m in res["missing_terms"]]
        self.assertIn("Azure", missing_names)
        print("✓ API Endpoint Test 2 Passed: POST /api/compare accurately identifies matched and missing terms.")

    def test_compare_endpoint_empty_inputs(self):
        """Verify POST /api/compare rejects empty inputs with HTTP 400."""
        # Empty resume
        with self.assertRaises(HTTPException) as ctx1:
            compare_texts(CompareRequest(resume_text="   ", job_description="AWS Docker"))
        self.assertEqual(ctx1.exception.status_code, 400)

        # Empty job description
        with self.assertRaises(HTTPException) as ctx2:
            compare_texts(CompareRequest(resume_text="AWS Docker", job_description="   "))
        self.assertEqual(ctx2.exception.status_code, 400)
        print("✓ API Endpoint Test 3 Passed: POST /api/compare validates and rejects empty inputs with HTTP 400.")

    def test_coach_status_endpoint(self):
        """Verify GET /api/coach/status returns configuration status and supported presets."""
        old_gemini = os.environ.pop("GEMINI_API_KEY", None)
        old_openai = os.environ.pop("OPENAI_API_KEY", None)
        try:
            res = coach_status()
            self.assertIn("configured", res)
            self.assertIn("supported_presets", res)
            self.assertEqual(res["configured"], False)
            print("✓ API Endpoint Test 4 Passed: GET /api/coach/status returns unconfigured status.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            if old_openai:
                os.environ["OPENAI_API_KEY"] = old_openai

    def test_coach_feedback_endpoint_unconfigured(self):
        """Verify POST /api/coach/feedback raises HTTP 503 when AI provider is unconfigured."""
        old_gemini = os.environ.pop("GEMINI_API_KEY", None)
        old_openai = os.environ.pop("OPENAI_API_KEY", None)
        try:
            req = CoachRequest(
                resume_text="Senior DevOps Engineer with Python and Docker experience.",
                preset="general",
            )
            with self.assertRaises(HTTPException) as ctx:
                coach_feedback(req)
            self.assertEqual(ctx.exception.status_code, 503)
            self.assertIn("GEMINI_API_KEY", str(ctx.exception.detail))
            print("✓ API Endpoint Test 5 Passed: POST /api/coach/feedback raises HTTP 503 with setup details.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            if old_openai:
                os.environ["OPENAI_API_KEY"] = old_openai

    def test_coach_feedback_endpoint_empty_resume(self):
        """Verify POST /api/coach/feedback rejects empty resume text with HTTP 400."""
        req = CoachRequest(
            resume_text="   ",
            preset="general",
        )
        with self.assertRaises(HTTPException) as ctx:
            coach_feedback(req)
        self.assertEqual(ctx.exception.status_code, 400)
        print("✓ API Endpoint Test 6 Passed: POST /api/coach/feedback rejects empty resume with HTTP 400.")


if __name__ == "__main__":
    unittest.main()
