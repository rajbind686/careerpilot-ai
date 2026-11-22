"""
Unit Tests for AI Resume Coach Service
--------------------------------------
Verifies:
  1. Provider status reporting (configured vs unconfigured).
  2. Safe error raising when provider is unconfigured (HTTP 503).
  3. Input validation (rejects empty resume).
  4. Platform presets structure (General, Naukri, LinkedIn).
  5. Suggestion schema validation (sections, actions, required fields).
  6. Anti-hallucination prompt constraints.
"""

import sys
import os
import unittest

# Add backend directory to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.ai_coach import (
    load_env_file,
    get_coach_status,
    generate_resume_coaching,
    build_coach_prompt,
    validate_suggestion_item,
    get_gemini_model,
    DEFAULT_GEMINI_MODEL,
    ProviderNotConfiguredError,
    InvalidInputError,
    CoachError,
    COACH_PRESETS,
)


class TestAICoach(unittest.TestCase):

    def test_1_status_unconfigured(self):
        """When GEMINI_API_KEY is not set, status must honestly report configured=False."""
        old_gemini = os.environ.pop("GEMINI_API_KEY", None)
        old_openai = os.environ.pop("OPENAI_API_KEY", None)
        try:
            status = get_coach_status()
            self.assertEqual(status["configured"], False)
            self.assertIsNone(status["provider"])
            self.assertEqual(status["missing_env_var"], "GEMINI_API_KEY")
            self.assertTrue(len(status["setup_instructions"]) > 0)
            self.assertIn("general", [p["id"] for p in status["supported_presets"]])
            self.assertIn("naukri", [p["id"] for p in status["supported_presets"]])
            self.assertIn("linkedin", [p["id"] for p in status["supported_presets"]])
            print("✓ Test 1 Passed: Unconfigured provider reported honestly with setup instructions.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            if old_openai:
                os.environ["OPENAI_API_KEY"] = old_openai

    def test_2_status_configured(self):
        """When GEMINI_API_KEY is set, status reports configured=True."""
        old_gemini = os.environ.get("GEMINI_API_KEY")
        os.environ["GEMINI_API_KEY"] = "mock_test_key_xyz123"
        try:
            status = get_coach_status()
            self.assertEqual(status["configured"], True)
            self.assertEqual(status["provider"], "google_gemini")
            self.assertIn("ready", status["message"].lower())
            print("✓ Test 2 Passed: Configured provider status detected accurately.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            else:
                os.environ.pop("GEMINI_API_KEY", None)

    def test_3_generate_unconfigured_raises_503(self):
        """Calling generate without configured key raises ProviderNotConfiguredError (503)."""
        old_gemini = os.environ.pop("GEMINI_API_KEY", None)
        old_openai = os.environ.pop("OPENAI_API_KEY", None)
        try:
            with self.assertRaises(ProviderNotConfiguredError) as ctx:
                generate_resume_coaching("Sample resume text here.")
            self.assertEqual(ctx.exception.status_code, 503)
            self.assertIn("GEMINI_API_KEY", ctx.exception.message)
            print("✓ Test 3 Passed: Unconfigured provider raises HTTP 503 without fake AI responses.")
        finally:
            if old_gemini:
                os.environ["GEMINI_API_KEY"] = old_gemini
            if old_openai:
                os.environ["OPENAI_API_KEY"] = old_openai

    def test_4_empty_resume_rejected(self):
        """Empty resume text raises InvalidInputError with HTTP 400."""
        with self.assertRaises(InvalidInputError) as ctx:
            generate_resume_coaching("   ")
        self.assertEqual(ctx.exception.status_code, 400)
        print("✓ Test 4 Passed: Empty resume input rejected with HTTP 400.")

    def test_5_suggestion_item_validation(self):
        """Validates that suggestions must conform to section, action, and required text fields."""
        valid_raw = {
            "section": "experience",
            "action": "rewrite",
            "reason": "Uses stronger action verb and highlights impact.",
            "original_text": "Worked on Docker containers.",
            "suggested_text": "Containerized multi-service microservices using Docker and Docker Compose.",
            "question": "What containerization scale or deployment targets were achieved?",
        }
        res = validate_suggestion_item(valid_raw, 0)
        self.assertEqual(res["section"], "experience")
        self.assertEqual(res["action"], "rewrite")
        self.assertEqual(res["original_text"], valid_raw["original_text"])
        self.assertEqual(res["suggested_text"], valid_raw["suggested_text"])
        self.assertEqual(res["question"], valid_raw["question"])

        # Missing suggested_text should fail
        invalid_raw = {"section": "summary", "action": "add"}
        with self.assertRaises(CoachError):
            validate_suggestion_item(invalid_raw, 1)

        print("✓ Test 5 Passed: Suggestion schema and section/action validation verified.")

    def test_6_platform_presets(self):
        """Checks platform preset definitions for General ATS, Naukri, and LinkedIn."""
        self.assertIn("general", COACH_PRESETS)
        self.assertIn("naukri", COACH_PRESETS)
        self.assertIn("linkedin", COACH_PRESETS)

        general = COACH_PRESETS["general"]
        self.assertIn("section_guidance", general)
        self.assertIn("headline", general["section_guidance"])
        self.assertIn("summary", general["section_guidance"])
        self.assertIn("skills", general["section_guidance"])
        self.assertIn("experience", general["section_guidance"])
        self.assertIn("projects", general["section_guidance"])

        naukri = COACH_PRESETS["naukri"]
        self.assertIn("headline", naukri["recommended_sections"])
        self.assertIn("skills", naukri["recommended_sections"])
        self.assertIn("recruiter search", naukri["description"].lower())
        self.assertIn("section_guidance", naukri)
        self.assertIn("headline", naukri["section_guidance"])
        self.assertIn("summary", naukri["section_guidance"])

        linkedin = COACH_PRESETS["linkedin"]
        self.assertIn("headline", linkedin["recommended_sections"])
        self.assertIn("summary", linkedin["recommended_sections"])
        self.assertIn("section_guidance", linkedin)
        self.assertIn("headline", linkedin["section_guidance"])
        self.assertIn("summary", linkedin["section_guidance"])
        print("✓ Test 6 Passed: Platform presets (General, Naukri, LinkedIn) properly defined.")

    def test_7_prompt_contains_anti_hallucination_rules(self):
        """Prompt MUST explicitly forbid inventing metrics or facts and instruct questioning."""
        prompt = build_coach_prompt("Jane Doe Engineer", "DevOps Role", preset="naukri")
        self.assertIn("NEVER invent, assume, or hallucinate", prompt)
        self.assertIn("metrics", prompt.lower())
        self.assertIn("placeholder", prompt.lower())
        self.assertIn("question", prompt.lower())
        self.assertIn("Naukri", prompt)
        print("✓ Test 7 Passed: Ethical prompt enforces anti-hallucination and metric questioning.")

    def test_8_load_env_file_security_and_parsing(self):
        """load_env_file safely parses comments, quotes, export syntax, and ignores bad files."""
        import tempfile
        with tempfile.NamedTemporaryFile("w+", suffix=".env", delete=False) as tf:
            tf.write("# Comment line\n")
            tf.write("\n")
            tf.write("MOCK_TEST_PARSED_A=\"hello_world\"\n")
            tf.write("export MOCK_TEST_PARSED_B='single_quoted'\n")
            tf.write("MOCK_TEST_PARSED_C=unquoted_value\n")
            tf.flush()
            temp_path = tf.name

        try:
            # Clean up before test
            os.environ.pop("MOCK_TEST_PARSED_A", None)
            os.environ.pop("MOCK_TEST_PARSED_B", None)
            os.environ.pop("MOCK_TEST_PARSED_C", None)

            load_env_file(temp_path)
            self.assertEqual(os.environ.get("MOCK_TEST_PARSED_A"), "hello_world")
            self.assertEqual(os.environ.get("MOCK_TEST_PARSED_B"), "single_quoted")
            self.assertEqual(os.environ.get("MOCK_TEST_PARSED_C"), "unquoted_value")

            # Non-existent file does not crash
            load_env_file("/path/to/nonexistent/.env")
            print("✓ Test 8 Passed: load_env_file parsed quotes, exports, and comments safely.")
        finally:
            os.environ.pop("MOCK_TEST_PARSED_A", None)
            os.environ.pop("MOCK_TEST_PARSED_B", None)
            os.environ.pop("MOCK_TEST_PARSED_C", None)
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_9_load_env_file_does_not_override_existing(self):
        """load_env_file preserves variables already defined in the shell environment."""
        import tempfile
        os.environ["MOCK_EXISTING_VAR"] = "original_shell_value"
        with tempfile.NamedTemporaryFile("w+", suffix=".env", delete=False) as tf:
            tf.write("MOCK_EXISTING_VAR=overwritten_value\n")
            tf.flush()
            temp_path = tf.name

        try:
            load_env_file(temp_path)
            self.assertEqual(os.environ.get("MOCK_EXISTING_VAR"), "original_shell_value")
            print("✓ Test 9 Passed: load_env_file does not override pre-existing shell environment variables.")
        finally:
            os.environ.pop("MOCK_EXISTING_VAR", None)
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_10_gemini_model_configuration(self):
        """get_gemini_model defaults to DEFAULT_GEMINI_MODEL and honors GEMINI_MODEL env var."""
        old_model = os.environ.pop("GEMINI_MODEL", None)
        old_gemini_key = os.environ.get("GEMINI_API_KEY")
        os.environ["GEMINI_API_KEY"] = "mock_key_test"
        try:
            # Default model
            self.assertEqual(get_gemini_model(), DEFAULT_GEMINI_MODEL)
            status = get_coach_status()
            self.assertEqual(status["model"], DEFAULT_GEMINI_MODEL)

            # Custom model via environment variable
            os.environ["GEMINI_MODEL"] = "gemini-custom-model-test"
            self.assertEqual(get_gemini_model(), "gemini-custom-model-test")
            status_custom = get_coach_status()
            self.assertEqual(status_custom["model"], "gemini-custom-model-test")

            print("✓ Test 10 Passed: get_gemini_model centralizes and customizes model selection via GEMINI_MODEL.")
        finally:
            if old_model:
                os.environ["GEMINI_MODEL"] = old_model
            else:
                os.environ.pop("GEMINI_MODEL", None)
            if old_gemini_key:
                os.environ["GEMINI_API_KEY"] = old_gemini_key
            else:
                os.environ.pop("GEMINI_API_KEY", None)

    def test_11_preset_differentiation(self):
        """Each preset must produce distinct, platform-tailored prompts."""
        prompt_general = build_coach_prompt("Engineer Resume Text", preset="general")
        prompt_naukri = build_coach_prompt("Engineer Resume Text", preset="naukri")
        prompt_linkedin = build_coach_prompt("Engineer Resume Text", preset="linkedin")

        # General ATS instructions
        self.assertIn("ATS & Direct Applications", prompt_general)
        self.assertIn("ATS parser accuracy", prompt_general)
        self.assertIn("Categorized technical competencies", prompt_general)

        # Naukri instructions
        self.assertIn("Naukri.com", prompt_naukri)
        self.assertIn("recruiter search", prompt_naukri.lower())
        self.assertIn("functional role", prompt_naukri.lower())

        # LinkedIn instructions
        self.assertIn("LinkedIn", prompt_linkedin)
        self.assertIn("First-person narrative", prompt_linkedin)
        self.assertIn("value-proposition", prompt_linkedin.lower())

        # All 3 prompts must be meaningfully distinct
        self.assertNotEqual(prompt_general, prompt_naukri)
        self.assertNotEqual(prompt_naukri, prompt_linkedin)
        self.assertNotEqual(prompt_general, prompt_linkedin)
        print("✓ Test 11 Passed: Presets produce distinct, platform-tailored guidance.")

    def test_12_job_description_evidence_and_missing_handling(self):
        """Prompt instructs prioritizing matching evidenced skills and questioning unevidenced requirements."""
        resume = "DevOps Engineer with Linux and AWS experience."
        jd = "Looking for Senior Site Reliability Engineer with Kubernetes and Terraform experience."

        prompt = build_coach_prompt(resume, jd, preset="general")
        self.assertIn("TARGET JOB DESCRIPTION", prompt)
        self.assertIn("Looking for Senior Site Reliability Engineer", prompt)
        self.assertIn("DO NOT add them directly as facts to the resume", prompt)
        self.assertIn('action="clarify"', prompt)
        self.assertIn("verification question", prompt)
        print("✓ Test 12 Passed: Job description evidence handling and missing skill questioning enforced.")

    def test_13_no_unsupported_character_limits(self):
        """Presets and prompts must not contain unverified hardcoded character limits."""
        for pid, preset in COACH_PRESETS.items():
            self.assertNotIn("80-character", preset.get("description", ""))
            for section, text in preset.get("section_guidance", {}).items():
                self.assertNotIn("80-character", text)
                self.assertNotIn("100-character", text)
                self.assertNotIn("exact limit", text.lower())

        prompt = build_coach_prompt("Sample Resume", preset="naukri")
        self.assertIn("NO UNVERIFIED HARDCODED LIMITS", prompt)
        self.assertNotIn("80-character", prompt)
        print("✓ Test 13 Passed: No unsupported character limits in presets or prompt instructions.")


if __name__ == "__main__":
    unittest.main()
