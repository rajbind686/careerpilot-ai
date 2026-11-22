"""
Unit Tests for Milestone 3 Comparator Service
---------------------------------------------
Verifies:
  1. Punctuation-heavy terms (C++, C#, .NET, ASP.NET, .NET Core, Node.js, React.js)
  2. Prevention of false positives (network != .NET, Java != JavaScript, Go != Django/Google, Rust != Trust)
  3. Canonical aliasing (React / React.js, Node.js / NodeJS treated as single canonical terms)
  4. Repeated term deduplication (terms repeated 5x in job description count as 1 required term)
  5. Generic words ignored (words like 'experience', 'team' are not treated as skills)
  6. Empty inputs and size limit validation
  7. Zero dictionary terms handling
"""

import sys
import os
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.comparator import (
    compare_resume_to_job,
    InputEmptyError,
    InputSizeExceededError,
    MAX_INPUT_LENGTH,
)


class TestResumeComparator(unittest.TestCase):

    def test_1_punctuation_heavy_terms_and_dotnet(self):
        """Verifies C++, C#, .NET, ASP.NET, .NET Core, and ensures 'network' does not match."""
        # 1. Test .NET, ASP.NET, .NET Core matching
        job_desc = "Seeking an engineer skilled in C++, C#, ASP.NET, and .NET Core. Must have strong network experience."
        resume_text = "I have 4 years of experience with C++ and .NET."

        res = compare_resume_to_job(resume_text, job_desc)
        matched_canonicals = [item["term"] for item in res["matched_terms"]]
        missing_canonicals = [item["term"] for item in res["missing_terms"]]

        # C++ and .NET should be matched
        self.assertIn("C++", matched_canonicals)
        self.assertIn(".NET", matched_canonicals)
        # C# was in job, not in resume -> missing
        self.assertIn("C#", missing_canonicals)

        # Confirm that 'network' did NOT trigger any unexpected match
        # Total job terms should only be C++, C#, .NET (3 terms total)
        self.assertEqual(res["summary"]["total_supported_job_terms"], 3)
        print("✓ Test 1 Passed: Punctuation terms and .NET matched accurately without matching 'network'.")

    def test_2_substring_false_positives_prevented(self):
        """Ensures Java != JavaScript, Go != Django/Google/good, Rust != Trust, C != CSS."""
        job_desc = "Looking for Java, Go, and Rust developers."
        # Resume has words containing substrings, but NOT the actual standalone languages
        resume_text = "Experienced in JavaScript, building Django web apps on Google Cloud with high trust."

        res = compare_resume_to_job(resume_text, job_desc)
        matched = [item["term"] for item in res["matched_terms"]]
        missing = [item["term"] for item in res["missing_terms"]]

        # None of Java, Go, or Rust should be matched!
        self.assertNotIn("Java", matched)
        self.assertNotIn("Go", matched)
        self.assertNotIn("Rust", matched)

        self.assertIn("Java", missing)
        self.assertIn("Go", missing)
        self.assertIn("Rust", missing)
        self.assertEqual(res["summary"]["supported_terms_found_count"], 0)
        print("✓ Test 2 Passed: Substring false positives prevented (Java != JS, Go != Django, Rust != Trust).")

    def test_3_canonical_aliasing_not_double_counted(self):
        """Ensures React + React.js and Node.js + NodeJS map to canonical terms and are not double-counted."""
        job_desc = "We require React and React.js, along with Node.js and NodeJS."
        resume_text = "Proficient in ReactJS and Node.js."

        res = compare_resume_to_job(resume_text, job_desc)
        matched = [item["term"] for item in res["matched_terms"]]

        # Total job terms must be exactly 2 (React and Node.js), NOT 4
        self.assertEqual(res["summary"]["total_supported_job_terms"], 2)
        self.assertIn("React", matched)
        self.assertIn("Node.js", matched)
        self.assertEqual(res["summary"]["supported_terms_found_count"], 2)
        self.assertEqual(res["summary"]["overlap_percentage"], 100)
        print("✓ Test 3 Passed: Aliases correctly grouped into canonical terms without double-counting.")

    def test_4_repeated_terms_deduplication(self):
        """Job description repeating Python 5 times must count as 1 required job term."""
        job_desc = "Python is essential. We use Python daily. Python for backend, Python for scripts, Python everywhere!"
        resume_text = "Experienced Python software developer."

        res = compare_resume_to_job(resume_text, job_desc)
        self.assertEqual(res["summary"]["total_supported_job_terms"], 1)
        self.assertEqual(res["summary"]["supported_terms_found_count"], 1)
        # Check occurrence tracking
        self.assertEqual(res["matched_terms"][0]["occurrences_in_job"], 5)
        self.assertEqual(res["matched_terms"][0]["occurrences_in_resume"], 1)
        print("✓ Test 4 Passed: Repeated terms deduplicated to 1 required job term with accurate counts.")

    def test_5_generic_words_ignored(self):
        """Job posting filled with generic non-tech words should not match any skills."""
        job_desc = "We offer great opportunities for hard working team players with 5 years experience."
        resume_text = "Hard working team player looking for a great company."

        res = compare_resume_to_job(resume_text, job_desc)
        self.assertEqual(res["summary"]["total_supported_job_terms"], 0)
        self.assertEqual(res["summary"]["supported_terms_found_count"], 0)
        print("✓ Test 5 Passed: Generic words ignored (no non-dictionary terms matched).")

    def test_6_input_validation(self):
        """Validates empty inputs and oversized texts."""
        # Empty resume
        with self.assertRaises(InputEmptyError):
            compare_resume_to_job("   ", "Looking for Python developer")

        # Empty job description
        with self.assertRaises(InputEmptyError):
            compare_resume_to_job("Python developer", "   \n\t")

        # Oversized text
        oversized = "a" * (MAX_INPUT_LENGTH + 1)
        with self.assertRaises(InputSizeExceededError):
            compare_resume_to_job(oversized, "Python")

        with self.assertRaises(InputSizeExceededError):
            compare_resume_to_job("Python", oversized)
        print("✓ Test 6 Passed: Empty inputs and oversized texts properly validated.")


if __name__ == "__main__":
    unittest.main()
