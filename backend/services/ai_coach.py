"""
AI Resume Coach Service
-----------------------
Provides structured, section-specific resume feedback and rewriting suggestions.

Privacy & Safety Guarantees:
- Server-side credentials only (via environment variables).
- NEVER invents skills, metrics, certifications, dates, or employers.
- Missing context is flagged as a question for the user rather than guessed.
- Purely on-demand: NO text is transmitted until user explicitly requests it.
- Honest unconfigured state: If GEMINI_API_KEY is not set, reports unconfigured
  status without faking AI responses.
- Supports platform presets (General ATS, Naukri, LinkedIn).
"""

import json
import os
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional

def load_env_file(env_path: Optional[str] = None) -> None:
    """
    Securely loads environment variables from a .env file into os.environ.
    - Zero external dependencies (uses Python standard library only).
    - Prioritizes backend/.env, then .env in current directory.
    - Does NOT override variables already set in os.environ.
    - Strips surrounding quotes and ignores comments.
    - Never logs, prints, or exposes variable values.
    """
    if env_path is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend dir
        candidates = [
            os.path.join(base_dir, ".env"),
            os.path.abspath(".env"),
            os.path.join(os.path.dirname(base_dir), ".env"),
        ]
        for c in candidates:
            if os.path.isfile(c):
                env_path = c
                break

    if not env_path or not os.path.isfile(env_path):
        return

    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if line.startswith("export "):
                    line = line[7:].strip()
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip()
                    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                        val = val[1:-1]
                    if key and key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass


# Attempt to load backend/.env if present
load_env_file()

DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite"
GEMINI_FALLBACK_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
]

def get_gemini_model() -> str:
    """
    Returns the configured Gemini model name from GEMINI_MODEL env var,
    falling back to DEFAULT_GEMINI_MODEL.
    """
    return os.environ.get("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL

ALLOWED_SECTIONS = ["headline", "summary", "skills", "experience", "projects"]
ALLOWED_ACTIONS = ["add", "remove", "clarify", "rewrite"]

COACH_PRESETS: Dict[str, Dict[str, Any]] = {
    "general": {
        "id": "general",
        "name": "General Resume (ATS Standard)",
        "target_platform": "ATS & Direct Applications",
        "recommended_sections": ["headline", "summary", "skills", "experience", "projects"],
        "description": "ATS-focused structure emphasizing standard section headers, action verbs, categorized skills, and quantified results.",
        "section_guidance": {
            "headline": "Standard target job title matching industry norms for high ATS parser accuracy.",
            "summary": "Concise 3-4 sentence professional summary highlighting verified years of experience, core technical stack, and career scope.",
            "skills": "Categorized technical competencies (e.g. Cloud, Containers, Languages) using recognized industry terms without keyword stuffing.",
            "experience": "Reverse-chronological bullet points using strong action verbs and quantified impact (using placeholders and questions when metrics are unevidenced).",
            "projects": "Key technical projects showcasing practical application of core tools matching target role requirements.",
        },
    },
    "naukri": {
        "id": "naukri",
        "name": "Naukri Profile",
        "target_platform": "Naukri.com",
        "recommended_sections": ["headline", "summary", "skills", "experience"],
        "description": "Optimized for recruiter search indexing: concise role headline, functional profile summary, and key skills clustering.",
        "section_guidance": {
            "headline": "Clear, concise resume headline highlighting current functional role, primary technical stack, and total experience for recruiter search listings.",
            "summary": "Profile Summary focusing on overall career scope, core domain expertise, and demonstrable technical capabilities.",
            "skills": "Key Skills aligned with recruiter search keywords, prioritizing skills directly evidenced in past projects and roles.",
            "experience": "Clear designation titles, organizational context, key deliverables, and hands-on tools utilized in client or product projects.",
        },
    },
    "linkedin": {
        "id": "linkedin",
        "name": "LinkedIn Profile",
        "target_platform": "LinkedIn",
        "recommended_sections": ["headline", "summary", "skills", "experience"],
        "description": "Optimized for member discoverability and networking: value-proposition headline, first-person narrative About section, and core skills.",
        "section_guidance": {
            "headline": "Engaging professional headline highlighting role identity, core specialization, and value proposition.",
            "summary": "First-person narrative About section ('I am...', 'I specialize in...') articulating career journey, problem-solving passion, key strengths, and collaboration style.",
            "skills": "Featured core skills and recognized industry competencies for recruiter search discoverability and skill validation.",
            "experience": "Impact-oriented role overviews focusing on ownership, cross-functional collaboration, technical execution, and business outcomes.",
        },
    },
}


class CoachError(Exception):
    """Base exception for AI coach errors."""
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class ProviderNotConfiguredError(CoachError):
    def __init__(self, message: Optional[str] = None):
        super().__init__(
            message or "AI Coach is not configured. Set the GEMINI_API_KEY environment variable on the backend to enable live AI feedback.",
            status_code=503,
        )


class InvalidInputError(CoachError):
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


def get_coach_status() -> Dict[str, Any]:
    """
    Checks if a generative AI provider is configured on the backend server.
    Returns status metadata and configuration instructions.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if gemini_key:
        return {
            "configured": True,
            "provider": "google_gemini",
            "model": get_gemini_model(),
            "message": "AI Coach is ready with Google Gemini provider.",
            "supported_presets": list(COACH_PRESETS.values()),
        }
    elif openai_key:
        return {
            "configured": True,
            "provider": "openai",
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "message": "AI Coach is ready with OpenAI provider.",
            "supported_presets": list(COACH_PRESETS.values()),
        }
    else:
        return {
            "configured": False,
            "provider": None,
            "model": None,
            "message": "No AI provider configured. Set GEMINI_API_KEY on the server to enable live coaching.",
            "missing_env_var": "GEMINI_API_KEY",
            "setup_instructions": [
                "1. Get an API key from Google AI Studio (https://aistudio.google.com/) or OpenAI.",
                "2. Set the environment variable: export GEMINI_API_KEY='your_api_key'",
                "3. Restart the backend server (uvicorn main:app --reload).",
            ],
            "supported_presets": list(COACH_PRESETS.values()),
        }


def validate_suggestion_item(item: Dict[str, Any], index: int) -> Dict[str, Any]:
    """
    Validates a single suggestion dictionary against strict safety and schema rules.
    """
    if not isinstance(item, dict):
        raise CoachError(f"Suggestion {index} is not a valid object.")

    section = (item.get("section") or "summary").lower().strip()
    if section not in ALLOWED_SECTIONS:
        section = "summary"

    action = (item.get("action") or "rewrite").lower().strip()
    if action not in ALLOWED_ACTIONS:
        action = "rewrite"

    reason = str(item.get("reason") or "").strip()
    if not reason:
        reason = "Improves clarity and alignment."

    suggested_text = str(item.get("suggested_text") or "").strip()
    if not suggested_text:
        raise CoachError(f"Suggestion {index} is missing suggested_text.")

    original_text = str(item.get("original_text") or "").strip()
    question = str(item.get("question") or item.get("question_for_user") or "").strip()

    return {
        "id": f"sug_{index + 1}_{section}",
        "section": section,
        "action": action,
        "reason": reason,
        "original_text": original_text,
        "suggested_text": suggested_text,
        "question": question or None,
        "question_for_user": question or None,
    }


def build_coach_prompt(resume_text: str, job_description: Optional[str] = None, preset: str = "general") -> str:
    """
    Builds structured, platform-specific prompting instructions for the generative model.
    Enforces strict evidence-only rules and missing-evidence questioning.
    """
    preset_meta = COACH_PRESETS.get(preset, COACH_PRESETS["general"])
    guidance = preset_meta.get("section_guidance", {})
    sections = preset_meta.get("recommended_sections", ALLOWED_SECTIONS)

    prompt = f"""You are CareerPilot AI's professional Resume and Profile Coach.
Target Profile Preset: {preset_meta['name']} ({preset_meta['target_platform']})
Platform Objective: {preset_meta['description']}
Applicable Sections: {', '.join(sections)}

PLATFORM-SPECIFIC SECTION GUIDANCE:
- Headline: {guidance.get('headline', 'Standard professional title')}
- Summary / About: {guidance.get('summary', 'Professional executive summary')}
- Skills: {guidance.get('skills', 'Core relevant competencies')}
- Experience: {guidance.get('experience', 'Accomplishments and responsibilities')}
"""
    if "projects" in sections:
        prompt += f"- Projects: {guidance.get('projects', 'Key technical projects implementing core tools')}\n"

    prompt += f"""
STRICT EVIDENCE & FACTUAL INTEGRITY RULES:
1. EVIDENCE-ONLY: NEVER invent, assume, or hallucinate skills, certifications, tools, responsibilities, metrics, dates, companies, or degrees.
   - Every skill, tool, and achievement recommended for inclusion MUST be directly supported by evidence already present in the user's resume.
2. MISSING EVIDENCE IN JOB DESCRIPTION:
   - When a target job description mentions skills, tools, or requirements that are NOT evidenced in the user's resume:
     * DO NOT add them directly as facts to the resume.
     * Instead, create a suggestion with action="clarify" explaining that the job description requests this skill/requirement.
     * Set the "question" field asking the user to confirm whether they possess this experience and in what context: e.g. "The job requires Kubernetes. If you have worked with Kubernetes, confirm your role and project context before adding it."
3. UNQUANTIFIED ACHIEVEMENTS & METRICS:
   - If an achievement or bullet point would be improved with a metric or quantifiable outcome, NEVER invent a number (e.g. do not invent 'reduced latency by 45%' or '$200k savings').
   - Use a placeholder in suggested_text (e.g. '[X]%' or '[number]') and provide a specific question in the "question" field asking the user for their real metric.
4. NO UNVERIFIED HARDCODED LIMITS:
   - Do not claim or enforce arbitrary character limits unless officially designated. Provide concise, impactful wording tailored to {preset_meta['target_platform']}.
5. SUGGESTION SCHEMA:
   Every item in "suggestions" MUST strictly provide:
   - "section": one of {json.dumps(sections)}
   - "action": one of ["add", "remove", "clarify", "rewrite"]
   - "reason": concise explanation citing platform relevance or job description alignment
   - "original_text": the exact excerpt from the resume being modified (or empty string if proposed addition)
   - "suggested_text": the improved, active-voice text tailored to {preset_meta['target_platform']}
   - "question": a specific question for the user if metrics or evidence confirmation is required, otherwise null.

RESUME CONTENT TO REVIEW:
\"\"\"
{resume_text}
\"\"\"
"""
    if job_description and job_description.strip():
        prompt += f"""
TARGET JOB DESCRIPTION (PRIORITIZE RELEVANT EVIDENCED SKILLS & TERMINOLOGY):
\"\"\"
{job_description.strip()}
\"\"\"
JOB ALIGNMENT INSTRUCTIONS:
- Identify key terminology and requirements in the job description that match evidence in the resume, and suggest prioritizing them in the {preset_meta['name']}.
- For required job skills not evidenced in the resume, flag them with action="clarify" and formulate a verification question for the user. Do not fabricate experience.
"""

    prompt += f"""
RESPONSE FORMAT:
Respond ONLY with a JSON object matching this structure:
{{
  "overall_critique": "A concise 2-4 sentence assessment of profile strengths and tailored optimization opportunities for {preset_meta['name']}.",
  "preset": "{preset}",
  "suggestions": [
    {{
      "section": "headline | summary | skills | experience" + (" | projects" if "projects" in sections else ""),
      "action": "add | remove | clarify | rewrite",
      "reason": "Clear rationale tailored to {preset_meta['name']}",
      "original_text": "Exact text from resume, or empty string if new addition",
      "suggested_text": "Refined text matching platform guidelines",
      "question": "Clarifying question for missing metric or unevidenced skill, or null"
    }}
  ]
}}
"""
    return prompt


def generate_resume_coaching(
    resume_text: str,
    job_description: Optional[str] = None,
    preset: str = "general",
) -> Dict[str, Any]:
    """
    Generates structured resume coaching feedback using the configured AI provider.
    Raises ProviderNotConfiguredError if no API key is set.
    """
    if not resume_text or not resume_text.strip():
        raise InvalidInputError("Resume text cannot be empty.")

    if preset not in COACH_PRESETS:
        preset = "general"

    status_info = get_coach_status()
    if not status_info["configured"]:
        raise ProviderNotConfiguredError(status_info["message"])

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    prompt = build_coach_prompt(resume_text, job_description, preset)

    if gemini_key:
        configured_model = get_gemini_model()
        models_to_try = [configured_model]
        # If user did not manually specify GEMINI_MODEL in environment, allow verified fallbacks
        if not os.environ.get("GEMINI_MODEL", "").strip():
            for fallback in GEMINI_FALLBACK_MODELS:
                if fallback not in models_to_try:
                    models_to_try.append(fallback)

        last_error = None
        parsed = None
        used_model = configured_model

        for model in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            }

            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    text_out = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(text_out)
                    used_model = model
                    break
            except urllib.error.HTTPError as e:
                err_body = e.read().decode("utf-8", errors="ignore")
                clean_msg = f"Gemini API returned error {e.code}"
                try:
                    err_json = json.loads(err_body)
                    if "error" in err_json and "message" in err_json["error"]:
                        clean_msg = f"{err_json['error']['message']}"
                except Exception:
                    clean_msg = f"Gemini API returned error {e.code}: {err_body[:200]}"

                last_error = CoachError(clean_msg, status_code=502 if e.code != 404 else 404)
                if e.code in (404, 503) and len(models_to_try) > 1:
                    continue
                raise last_error
            except Exception as e:
                last_error = CoachError(f"Failed to generate coaching suggestions: {str(e)}", status_code=500)
                if len(models_to_try) > 1:
                    continue
                raise last_error

        if parsed is None:
            raise last_error or CoachError("Failed to generate coaching suggestions.", status_code=500)

    elif openai_key:
        model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        url = "https://api.openai.com/v1/chat/completions"
        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {openai_key}",
            },
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text_out = data["choices"][0]["message"]["content"]
                parsed = json.loads(text_out)
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise CoachError(f"OpenAI API returned error {e.code}: {err_body}", status_code=502)
        except Exception as e:
            raise CoachError(f"Failed to generate coaching suggestions: {str(e)}", status_code=500)
    else:
        raise ProviderNotConfiguredError()

    raw_suggestions = parsed.get("suggestions", [])
    validated_suggestions = [
        validate_suggestion_item(item, idx) for idx, item in enumerate(raw_suggestions)
    ]

    return {
        "status": "success",
        "provider": status_info["provider"],
        "model": used_model if gemini_key else os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
        "preset": preset,
        "overall_critique": parsed.get("overall_critique", "Coaching review completed."),
        "total_suggestions": len(validated_suggestions),
        "suggestions": validated_suggestions,
    }
