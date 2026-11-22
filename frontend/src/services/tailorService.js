/**
 * Resume Tailoring Helper Service
 * --------------------------------
 * Manages client-side validation, version naming, and stat calculations
 * for the "Tailor Resume to Job" workflow.
 *
 * Safety Invariants:
 * - NEVER modifies active resume text or localStorage automatically.
 * - Saves strictly on explicit user action ("Accept & Save as New Version").
 * - Preserves user inputs on failure or discard.
 */

import { COACH_PRESETS } from './coachService.js';
import { calculateWordCount } from './resumeVersionStorage.js';

export const TAILOR_PRESETS = COACH_PRESETS;

/**
 * Validates inputs prior to dispatching an AI tailoring request.
 * 
 * @param {string} resumeText - Working resume text.
 * @param {string} jobDescription - Target job description.
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTailorInputs(resumeText, jobDescription) {
  if (!resumeText || !resumeText.trim()) {
    return {
      valid: false,
      error: 'An active resume is required to generate a tailored draft. Please upload or load a resume first.',
    };
  }

  if (!jobDescription || !jobDescription.trim()) {
    return {
      valid: false,
      error: 'A target job description is required so the AI can align your evidenced experience with the role.',
    };
  }

  return { valid: true };
}

/**
 * Generates a descriptive default version name for saving the tailored draft.
 * 
 * @param {string} [preset='general'] - Platform preset ID.
 * @param {string} [jobDescription=''] - Job description to extract role/company keywords.
 * @param {Date} [date=new Date()] - Current date.
 * @returns {string}
 */
export function formatDefaultTailoredVersionName(preset = 'general', jobDescription = '', date = new Date()) {
  const presetLabelMap = {
    general: 'General ATS',
    naukri: 'Naukri',
    linkedin: 'LinkedIn',
  };
  const platformLabel = presetLabelMap[preset] || 'Tailored';

  const dateStr = date.toISOString().split('T')[0];

  // Attempt to extract role/title from first non-empty lines of job description
  let roleSnippet = '';
  if (jobDescription && jobDescription.trim()) {
    const lines = jobDescription
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const candidate = lines[0].replace(/[^a-zA-Z0-9\s-]/g, '').trim();
      if (candidate.length >= 3 && candidate.length <= 30) {
        roleSnippet = ` - ${candidate}`;
      }
    }
  }

  return `Tailored (${platformLabel})${roleSnippet} [${dateStr}]`;
}

/**
 * Computes comparative stats between the original resume and the tailored draft.
 * 
 * @param {string} originalText
 * @param {string} tailoredText
 * @returns {{ originalWords: number, tailoredWords: number, wordDiff: number }}
 */
export function computeComparisonStats(originalText, tailoredText) {
  const originalWords = calculateWordCount(originalText || '');
  const tailoredWords = calculateWordCount(tailoredText || '');
  return {
    originalWords,
    tailoredWords,
    wordDiff: tailoredWords - originalWords,
  };
}
