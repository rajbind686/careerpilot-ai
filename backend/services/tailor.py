"""
CareerPilot AI - Resume Tailoring Service
-------------------------------------------
Generates an evidence-based, job-tailored resume draft strictly based on facts
present in the user's source resume.

Privacy & Safety Guarantees:
- Server-side credentials only (via environment variables).
- 100% Evidence-Only: NEVER invents skills, tools, certifications, metrics,
  employers, titles, dates, or projects.
- Missing Evidence Isolation: Requirements from the job description that are NOT
  evidenced in the resume are NEVER added to the draft. They are output separately
  as "unsupported_requirements" with verification questions for the candidate.
- Purely on-demand: Sent only on explicit user request.
- Preserves candidate's real experience while improving relevance, wording,
  and formatting for the chosen platform preset (General ATS, Naukri, LinkedIn).
"""

import json
import os
import urllib.request
import urllib.error
from typing import Dict, List, Any, Optional

from services.ai_coach import (
    load_env_file,
    get_coach_status,
    get_gemini_model,
    GEMINI_FALLBACK_MODELS,
    COACH_PRESETS,
    CoachError,
    ProviderNotConfiguredError,
    InvalidInputError,
)

# Ensure environment variables are loaded
load_env_file()


def build_tailor_prompt(resume_text: str, job_description: str, preset: str = "general") -> str:
    """
    Constructs the prompt for tailoring a resume to a target job description.
    Enforces strict evidence-only constraints, missing-evidence isolation,
    and platform-specific formatting.
    """
    preset_meta = COACH_PRESETS.get(preset, COACH_PRESETS["general"])
    guidance = preset_meta.get("section_guidance", {})

    prompt = f"""You are CareerPilot AI's Expert Resume Tailoring Assistant.
Your objective is to tailor the candidate's existing resume for a specific target job posting while upholding 100% FACTUAL INTEGRITY.

TARGET PLATFORM: {preset_meta['name']} ({preset_meta['target_platform']})
PLATFORM FOCUS: {preset_meta['description']}

PLATFORM SECTION GUIDANCE:
- Headline: {guidance.get('headline', 'Standard target job title')}
- Summary: {guidance.get('summary', 'Focused professional summary')}
- Skills: {guidance.get('skills', 'Evidenced core competencies matching the role')}
- Experience: {guidance.get('experience', 'Accomplishment-oriented bullets emphasizing evidenced tools matching the job')}
"""
    if "projects" in preset_meta.get("recommended_sections", []):
        prompt += f"- Projects: {guidance.get('projects', 'Key technical projects implementing core tools')}\n"

    prompt += f"""
STRICT EVIDENCE & ZERO-HALLUCINATION RULES:
1. EVIDENCE-ONLY IN DRAFT:
   - You must ONLY use facts, tools, skills, technologies, job titles, companies, certifications, degrees, dates, and metrics explicitly stated in the SOURCE RESUME.
   - NEVER invent, hallucinate, assume, or extrapolate any tool, programming language, framework, metric, certification, or role responsibility.
   - Do NOT insert placeholder metrics (e.g. '[X]%') as facts. If a bullet lacks a metric, keep it honest and clear.

2. MISSING JOB REQUIREMENTS HANDLING ("Not Evidenced in Your Resume"):
   - If the TARGET JOB DESCRIPTION requires or emphasizes tools, qualifications, or skills that are NOT present or evidenced in the SOURCE RESUME:
     * DO NOT add them to the tailored resume draft.
     * DO NOT claim the candidate knows them.
     * List them in "unsupported_requirements" with a concise explanation and a direct question asking the candidate whether they possess this experience.

3. RELEVANCE & ACTIVE WORDING:
   - Reorder and emphasize evidenced experience, tools, and achievements that directly match the target role.
   - Use strong, active verbs (e.g., 'Engineered', 'Optimized', 'Containerized', 'Automated').
   - Tailor the professional summary and headline to align with the target role, while remaining 100% grounded in the candidate's real background.

4. SECTIONS CHANGED LOGGING:
   - For every section you modify, provide:
     * "section": name of the section (e.g. "headline", "summary", "skills", "experience", "projects")
     * "original_snippet": the original text segment from the source resume
     * "tailored_snippet": the revised text segment in the tailored draft
     * "explanation": a concise sentence explaining how this change highlights relevant evidenced experience for the target role without inventing anything.

SOURCE RESUME:
\"\"\"
{resume_text}
\"\"\"

TARGET JOB DESCRIPTION:
\"\"\"
{job_description}
\"\"\"

RESPONSE FORMAT:
Respond ONLY with a valid JSON object matching this schema:
{{
  "headline": "Proposed target headline tailored to the job and platform",
  "summary_critique": "A concise 2-3 sentence overview of how the resume was tailored for this target role.",
  "tailored_resume_text": "The complete, polished, full text of the tailored resume, ready for use.",
  "sections_changed": [
    {{
      "section": "headline | summary | skills | experience | projects",
      "original_snippet": "Original excerpt from source resume",
      "tailored_snippet": "Revised excerpt in tailored draft",
      "explanation": "Why this change improves alignment with the target role"
    }}
  ],
  "unsupported_requirements": [
    {{
      "requirement": "Required tool / skill / qualification from job description",
      "explanation": "Why this requirement was flagged as missing from the resume",
      "question_to_confirm": "Direct question asking the candidate to confirm their experience before adding it"
    }}
  ]
}}
"""
    return prompt


def validate_tailored_response(parsed: Dict[str, Any], preset: str) -> Dict[str, Any]:
    """
    Validates and sanitizes the parsed AI output against the required schema.
    Raises CoachError if the response is corrupted or missing critical keys.
    """
    if not isinstance(parsed, dict):
        raise CoachError("AI response was not a valid JSON object.", status_code=502)

    tailored_text = parsed.get("tailored_resume_text")
    if not tailored_text or not isinstance(tailored_text, str) or not tailored_text.strip():
        raise CoachError("AI response missing 'tailored_resume_text'.", status_code=502)

    raw_sections = parsed.get("sections_changed", [])
    validated_sections: List[Dict[str, str]] = []
    if isinstance(raw_sections, list):
        for item in raw_sections:
            if isinstance(item, dict):
                sec = str(item.get("section", "general")).strip().lower()
                orig = str(item.get("original_snippet", "")).strip()
                tailored = str(item.get("tailored_snippet", "")).strip()
                expl = str(item.get("explanation", "")).strip()
                if tailored or expl:
                    validated_sections.append({
                        "section": sec,
                        "original_snippet": orig,
                        "tailored_snippet": tailored,
                        "explanation": expl or "Tailored to align with target role requirements.",
                    })

    raw_unsupported = parsed.get("unsupported_requirements", [])
    validated_unsupported: List[Dict[str, str]] = []
    if isinstance(raw_unsupported, list):
        for item in raw_unsupported:
            if isinstance(item, dict):
                req = str(item.get("requirement", "")).strip()
                expl = str(item.get("explanation", "")).strip()
                q = str(item.get("question_to_confirm", "")).strip()
                if req:
                    validated_unsupported.append({
                        "requirement": req,
                        "explanation": expl or f"Mentioned in job description but not evidenced in resume.",
                        "question_to_confirm": q or f"Do you have practical experience with {req}? If so, confirm your context before adding it.",
                    })

    return {
        "headline": str(parsed.get("headline", "")).strip(),
        "summary_critique": str(parsed.get("summary_critique", "Resume draft tailored to target job posting.")).strip(),
        "tailored_resume_text": tailored_text.strip(),
        "sections_changed": validated_sections,
        "unsupported_requirements": validated_unsupported,
        "preset": preset,
    }


def generate_tailored_resume(
    resume_text: str,
    job_description: str,
    preset: str = "general",
) -> Dict[str, Any]:
    """
    Generates a tailored resume draft using the configured AI provider.
    Enforces evidence-only rules and validates required inputs.
    """
    if not resume_text or not resume_text.strip():
        raise InvalidInputError("Resume text cannot be empty.")

    if not job_description or not job_description.strip():
        raise InvalidInputError("A target job description is required to tailor your resume.")

    if preset not in COACH_PRESETS:
        preset = "general"

    status_info = get_coach_status()
    if not status_info["configured"]:
        raise ProviderNotConfiguredError(status_info["message"])

    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()

    prompt = build_tailor_prompt(resume_text, job_description, preset)

    parsed = None
    used_model = "unknown"

    if gemini_key:
        configured_model = get_gemini_model()
        models_to_try = [configured_model]
        if not os.environ.get("GEMINI_MODEL", "").strip():
            for fallback in GEMINI_FALLBACK_MODELS:
                if fallback not in models_to_try:
                    models_to_try.append(fallback)

        last_error = None
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
                with urllib.request.urlopen(req, timeout=45) as resp:
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
                last_error = CoachError(f"Failed to generate tailored resume: {str(e)}", status_code=500)
                if len(models_to_try) > 1:
                    continue
                raise last_error

        if parsed is None:
            raise last_error or CoachError("Failed to generate tailored resume.", status_code=500)

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
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                text_out = data["choices"][0]["message"]["content"]
                parsed = json.loads(text_out)
                used_model = model
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise CoachError(f"OpenAI API returned error {e.code}: {err_body}", status_code=502)
        except Exception as e:
            raise CoachError(f"Failed to generate tailored resume: {str(e)}", status_code=500)
    else:
        raise ProviderNotConfiguredError()

    validated = validate_tailored_response(parsed, preset)

    return {
        "status": "success",
        "provider": status_info["provider"],
        "model": used_model,
        "preset": preset,
        "headline": validated["headline"],
        "summary_critique": validated["summary_critique"],
        "tailored_resume_text": validated["tailored_resume_text"],
        "sections_changed": validated["sections_changed"],
        "unsupported_requirements": validated["unsupported_requirements"],
    }
