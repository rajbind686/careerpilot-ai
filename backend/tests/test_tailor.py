"""
Unit Tests for AI Resume Tailoring Service & API Endpoint
----------------------------------------------------------
Verifies:
  1. Evidence-only prompt constraints and zero hallucination rules.
  2. Missing-evidence isolation: unevidenced requirements kept out of the draft
     and formatted with clarification questions.
  3. Preset differentiation (General ATS, Naukri, LinkedIn).
  4. Response schema validation (tailored text, sections changed, unsupported requirements).
  5. Input validation (empty resume text and empty job description rejected with 400).
  6. Unconfigured provider error handling (HTTP 503).
  7. API endpoint status codes and error responses.
"""

import sys
import os
import unittest
from fastapi import HTTPException

# Add backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app, tailor_resume_endpoint, TailorResumeRequest
from services.tailor import (
    build_tailor_prompt,
    validate_tailored_response,
    generate_tailored_resume,
)
from services.ai_coach import (
    ProviderNotConfiguredError,
    InvalidInputError,
    CoachError,
)


class TestResumeTailoring(unittest.TestCase):

    def test_1_build_tailor_prompt_contains_evidence_only_rules(self):
        """Prompt must strictly instruct the AI to only use evidenced facts."""
        prompt = build_tailor_prompt("Jane Doe Resume", "DevOps Job Description", preset="general")
        self.assertIn("EVIDENCE-ONLY", prompt)
        self.assertIn("NEVER invent, hallucinate, assume, or extrapolate", prompt)
        self.assertIn("Jane Doe Resume", prompt)
        self.assertIn("DevOps Job Description", prompt)
        print("✓ Test 1 Passed: Tailoring prompt enforces evidence-only and zero-hallucination rules.")

    def test_2_build_tailor_prompt_isolates_missing_requirements(self):
        """Prompt must instruct never adding unevidenced JD requirements to the draft."""
        prompt = build_tailor_prompt("DevOps Resume", "Requires Rust and Kubernetes", preset="general")
        self.assertIn("MISSING JOB REQUIREMENTS HANDLING", prompt)
        self.assertIn("DO NOT add them to the tailored resume draft", prompt)
        self.assertIn("unsupported_requirements", prompt)
        print("✓ Test 2 Passed: Prompt strictly isolates unevidenced requirements from draft.")

    def test_3_build_tailor_prompt_preset_differentiation(self):
        """Tailoring prompt must produce distinct guidance for General, Naukri, and LinkedIn."""
        prompt_gen = build_tailor_prompt("Resume", "Job", preset="general")
        prompt_naukri = build_tailor_prompt("Resume", "Job", preset="naukri")
        prompt_li = build_tailor_prompt("Resume", "Job", preset="linkedin")

        self.assertIn("ATS & Direct Applications", prompt_gen)
        self.assertIn("Naukri.com", prompt_naukri)
        self.assertIn("LinkedIn", prompt_li)

        self.assertNotEqual(prompt_gen, prompt_naukri)
        self.assertNotEqual(prompt_naukri, prompt_li)
        print("✓ Test 3 Passed: Preset differentiation verified across General ATS, Naukri, and LinkedIn.")

    def test_4_validate_tailored_response_success(self):
        """Valid response schema passes validation and sanitizes fields."""
        raw_ai_output = {
            "headline": "Cloud DevOps Engineer | AWS & Kubernetes",
            "summary_critique": "Tailored to emphasize evidenced Linux and AWS infrastructure skills.",
            "tailored_resume_text": "JANE DOE\nCloud DevOps Engineer\n\nSUMMARY\nExperienced in AWS...",
            "sections_changed": [
                {
                    "section": "summary",
                    "original_snippet": "Software developer with cloud interest.",
                    "tailored_snippet": "DevOps Engineer with hands-on AWS experience.",
                    "explanation": "Highlights evidenced AWS experience matching the DevOps posting.",
                }
            ],
            "unsupported_requirements": [
                {
                    "requirement": "Terraform",
                    "explanation": "The job specifies Terraform, but Terraform is not evidenced in the resume.",
                    "question_to_confirm": "Do you have practical Terraform experience? If so, confirm before adding.",
                }
            ],
        }

        validated = validate_tailored_response(raw_ai_output, "general")
        self.assertEqual(validated["headline"], raw_ai_output["headline"])
        self.assertEqual(validated["tailored_resume_text"], raw_ai_output["tailored_resume_text"])
        self.assertEqual(len(validated["sections_changed"]), 1)
        self.assertEqual(validated["sections_changed"][0]["section"], "summary")
        self.assertEqual(len(validated["unsupported_requirements"]), 1)
        self.assertEqual(validated["unsupported_requirements"][0]["requirement"], "Terraform")
        print("✓ Test 4 Passed: Schema validation preserves valid fields and structure.")

    def test_5_validate_tailored_response_rejects_missing_text(self):
        """Missing or empty tailored_resume_text raises CoachError with status 502."""
        raw_bad = {
            "headline": "Some Title",
            "sections_changed": [],
            # Missing tailored_resume_text
        }
        with self.assertRaises(CoachError) as ctx:
            validate_tailored_response(raw_bad, "general")
        self.assertEqual(ctx.exception.status_code, 502)

        raw_empty = {
            "tailored_resume_text": "   ",
        }
        with self.assertRaises(CoachError) as ctx:
            validate_tailored_response(raw_empty, "general")
        self.assertEqual(ctx.exception.status_code, 502)
        print("✓ Test 5 Passed: Invalid or missing tailored draft text raises 502 error.")

    def test_6_generate_tailored_resume_empty_inputs_raise_400(self):
        """Empty resume text or job description raises InvalidInputError with HTTP 400."""
        with self.assertRaises(InvalidInputError) as ctx1:
            generate_tailored_resume("", "Valid Job Description")
        self.assertEqual(ctx1.exception.status_code, 400)

        with self.assertRaises(InvalidInputError) as ctx2:
            generate_tailored_resume("Valid Resume Text", "")
        self.assertEqual(ctx2.exception.status_code, 400)
        print("✓ Test 6 Passed: Empty inputs properly rejected with HTTP 400.")

    def test_7_generate_tailored_resume_unconfigured_raises_503(self):
        """When no provider key is configured, raises ProviderNotConfiguredError (HTTP 503)."""
        old_gemini = os.environ.pop("GEMINI_API_KEY", None)
        old_openai = os.environ.pop("OPENAI_API_KEY", None)
        try:
            with self.assertRaises(ProviderNotConfiguredError) as ctx:
                generate_tailored_resume("Resume content", "Job Description")
            self.assertEqual(ctx.exception.status_code, 503)
            print("✓ Test 7 Passed: Unconfigured provider raises HTTP 503 without fake output.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            if old_openai:
                os.environ["OPENAI_API_KEY"] = old_openai

    def test_8_api_tailor_endpoint_validations(self):
        """FastAPI endpoint /api/tailor validates empty inputs and handles unconfigured provider."""
        # Empty resume
        with self.assertRaises(HTTPException) as ctx1:
            tailor_resume_endpoint(TailorResumeRequest(resume_text="", job_description="Valid JD"))
        self.assertEqual(ctx1.exception.status_code, 400)

        # Empty job description
        with self.assertRaises(HTTPException) as ctx2:
            tailor_resume_endpoint(TailorResumeRequest(resume_text="Valid Resume", job_description=""))
        self.assertEqual(ctx2.exception.status_code, 400)

        # Unconfigured provider returns 503
        old_gemini = os.environ.pop("GEMINI_API_KEY", None)
        old_openai = os.environ.pop("OPENAI_API_KEY", None)
        try:
            with self.assertRaises(HTTPException) as ctx3:
                tailor_resume_endpoint(TailorResumeRequest(resume_text="Valid Resume", job_description="Valid JD"))
            self.assertEqual(ctx3.exception.status_code, 503)
            print("✓ Test 8 Passed: POST /api/tailor validates inputs with 400 and reports 503 when unconfigured.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            if old_openai:
                os.environ["OPENAI_API_KEY"] = old_openai


if __name__ == "__main__":
    unittest.main()
