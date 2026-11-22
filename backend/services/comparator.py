"""
Resume & Job Description Comparison Service (Milestone 3)
--------------------------------------------------------
Compares extracted resume text against a pasted job description using
a curated, deterministic dictionary of technical terms and tools.

Guarantees:
- Pure rule-based comparison (no LLMs, no external AI calls).
- Handles punctuation-heavy terms (.NET, C++, C#, Node.js, React.js).
- Prevents substring false positives (e.g. Java in JavaScript, Go in Django).
- Groups aliases to canonical terms to prevent double-counting.
- Preserves user text (read-only analysis; no rewriting).
"""

import re
from typing import Dict, List, Any, Optional

MAX_INPUT_LENGTH = 50_000


class ComparisonError(Exception):
    """Base exception for comparison errors."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InputEmptyError(ComparisonError):
    def __init__(self, field_name: str):
        super().__init__(f"{field_name} cannot be empty.", status_code=400)


class InputSizeExceededError(ComparisonError):
    def __init__(self, field_name: str):
        super().__init__(f"{field_name} exceeds the 50,000-character limit.", status_code=413)


# Curated Dictionary of Supported Software Engineering Terms & Aliases
# Each entry defines:
#   - canonical: Clean standardized display name.
#   - patterns: Regular expressions with strict boundaries to avoid false positives.
CURATED_DICTIONARY: List[Dict[str, Any]] = [
    # Languages
    {
        "canonical": "Python",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])python(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "JavaScript",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])javascript(?![a-zA-Z0-9])", re.IGNORECASE),
            # Notice: (?<![a-zA-Z0-9.]) prevents matching the '.js' extension in 'React.js' or 'Node.js'
            re.compile(r"(?<![a-zA-Z0-9.])js(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "TypeScript",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])typescript(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9.])ts(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Java",
        # Notice: Negative lookahead (?![a-zA-Z0-9]) prevents matching "JavaScript" or "JavaDoc"
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])java(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "C++",
        # Punctuation: must not be preceded by alphanumeric, must not be followed by +, #, or alphanumeric
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])c\+\+(?![a-zA-Z0-9+#])", re.IGNORECASE)],
    },
    {
        "canonical": "C#",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])c#(?![a-zA-Z0-9#])", re.IGNORECASE)],
    },
    {
        "canonical": "Go",
        # Negative lookbehind & lookahead prevents matching "Django", "Google", "good", "going"
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])go(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])golang(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Rust",
        # Prevents matching "Trust" or "Frustrated"
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])rust(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "Ruby",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])ruby(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "PHP",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])php(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "SQL",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])sql(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "HTML",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])html5?(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "CSS",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])css3?(?![a-zA-Z0-9])", re.IGNORECASE)],
    },

    # Frameworks & Runtimes (with Aliasing)
    {
        "canonical": "React",
        # Aliases: React, React.js, ReactJS all map to canonical "React"
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])react(\.js)?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])reactjs(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Node.js",
        # Aliases: Node.js, NodeJS, Node JS all map to canonical "Node.js"
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])node\.js(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])nodejs(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])node\s+js(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": ".NET",
        # Matches: .NET, .NET Core, ASP.NET, ASP.NET Core, dotnet
        # Does NOT match: "network"
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])\.net(\s*core)?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])asp\.net(\s*core)?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])dotnet(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "FastAPI",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])fastapi(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "Django",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])django(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "Flask",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])flask(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "Express",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])express(\.js)?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])expressjs(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Vue",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])vue(\.js)?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])vuejs(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Angular",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])angular(\.js)?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])angularjs(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Spring Boot",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])spring\s+boot(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])spring\s+framework(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },

    # Databases & Storage
    {
        "canonical": "PostgreSQL",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])postgresql(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])postgres(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "MySQL",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])mysql(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "MongoDB",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])mongodb(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])mongo(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Redis",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])redis(?![a-zA-Z0-9])", re.IGNORECASE)],
    },

    # Cloud, DevOps & Tools
    {
        "canonical": "Git",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])git(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])github(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])gitlab(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Docker",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])docker(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "Kubernetes",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])kubernetes(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])k8s(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "AWS",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])aws(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])amazon\s+web\s+services(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Azure",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])azure(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])microsoft\s+azure(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "GCP",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])gcp(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])google\s+cloud(\s+platform)?(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Linux",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])linux(?![a-zA-Z0-9])", re.IGNORECASE)],
    },

    # Architecture & Practices
    {
        "canonical": "REST API",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])rest(ful)?(\s+apis?)?(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "GraphQL",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])graphql(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "CI/CD",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])ci[\s/]+cd(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])continuous\s+integration(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Unit Testing",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])unit\s+testing(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])unit\s+tests?(?![a-zA-Z0-9])", re.IGNORECASE),
            re.compile(r"(?<![a-zA-Z0-9])pytest(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Microservices",
        "patterns": [
            re.compile(r"(?<![a-zA-Z0-9])microservices?(?![a-zA-Z0-9])", re.IGNORECASE),
        ],
    },
    {
        "canonical": "Agile",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])agile(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
    {
        "canonical": "Scrum",
        "patterns": [re.compile(r"(?<![a-zA-Z0-9])scrum(?![a-zA-Z0-9])", re.IGNORECASE)],
    },
]


def count_matches(text: str, patterns: List[re.Pattern]) -> int:
    """Returns the total number of matches across all regex patterns for a term."""
    total = 0
    for pattern in patterns:
        total += len(pattern.findall(text))
    return total


def compare_resume_to_job(resume_text: str, job_description: str) -> Dict[str, Any]:
    """
    Compares resume text to a job description against the curated dictionary.

    Returns:
        Structured dictionary with matched_terms, missing_terms, summary, and disclaimers.
    """
    # 1. Input Validation
    if not resume_text or not resume_text.strip():
        raise InputEmptyError("Resume text")

    if not job_description or not job_description.strip():
        raise InputEmptyError("Job description")

    if len(resume_text) > MAX_INPUT_LENGTH:
        raise InputSizeExceededError("Resume text")

    if len(job_description) > MAX_INPUT_LENGTH:
        raise InputSizeExceededError("Job description")

    clean_resume = resume_text.strip()
    clean_job = job_description.strip()

    matched_terms = []
    missing_terms = []

    # 2. Check each canonical term against the job description
    for item in CURATED_DICTIONARY:
        canonical_name = item["canonical"]
        patterns = item["patterns"]

        job_match_count = count_matches(clean_job, patterns)

        # If the term appears at least once in the job description:
        if job_match_count > 0:
            resume_match_count = count_matches(clean_resume, patterns)

            if resume_match_count > 0:
                matched_terms.append({
                    "term": canonical_name,
                    "occurrences_in_resume": resume_match_count,
                    "occurrences_in_job": job_match_count,
                })
            else:
                missing_terms.append({
                    "term": canonical_name,
                    "occurrences_in_job": job_match_count,
                    "guidance": (
                        f"'{canonical_name}' appears in the job description but was not detected in your resume text. "
                        "If you have genuine hands-on experience with this, consider adding it truthfully."
                    ),
                })

    # Sort terms alphabetically for clean display
    matched_terms.sort(key=lambda x: x["term"].lower())
    missing_terms.sort(key=lambda x: x["term"].lower())

    found_count = len(matched_terms)
    missing_count = len(missing_terms)
    total_job_terms = found_count + missing_count

    overlap_percentage = round((found_count / total_job_terms) * 100) if total_job_terms > 0 else 0

    return {
        "status": "success",
        "dictionary_size": len(CURATED_DICTIONARY),
        "summary": {
            "supported_terms_found_count": found_count,
            "supported_terms_missing_count": missing_count,
            "total_supported_job_terms": total_job_terms,
            "overlap_percentage": overlap_percentage,
            "calculation_explanation": (
                f"{found_count} of {total_job_terms} supported dictionary terms were detected in your resume text ({overlap_percentage}%)."
                if total_job_terms > 0
                else "No supported dictionary terms were detected in the job description."
            ),
            "disclaimer": (
                "This metric is solely an informational count of supported technical terms detected. "
                "It is NOT an ATS score, qualification rating, or predictor of interviews. "
                "A missing term does not prove you lack the skill."
            ),
        },
        "matched_terms": matched_terms,
        "missing_terms": missing_terms,
        "coverage_notice": (
            f"Comparison is limited to CareerPilot's curated dictionary of {len(CURATED_DICTIONARY)} "
            "common software engineering skills and tools. Terms outside this dictionary are not evaluated."
        ),
    }
