/**
 * AI Resume Coach Helper Service
 * -------------------------------
 * Manages suggestions, user approval state transitions, and applying
 * accepted or edited suggestions to the working resume text.
 *
 * Safety Invariants:
 * - NEVER alters resume text automatically.
 * - Modifications happen ONLY when the user explicitly clicks 'Accept' or 'Apply Edit'.
 * - Preserves unmodified sections of the resume.
 */

export const COACH_PRESETS = [
  {
    id: 'general',
    name: 'General Resume (ATS Standard)',
    platform: 'ATS & Direct Applications',
    description: 'ATS-focused structure emphasizing standard section headers, action verbs, categorized skills, and quantified results.',
    sections: ['headline', 'summary', 'skills', 'experience', 'projects'],
    sectionGuidance: {
      headline: 'Standard target job title matching industry norms for high ATS parser accuracy.',
      summary: 'Concise 3-4 sentence professional summary highlighting verified years of experience, core technical stack, and career scope.',
      skills: 'Categorized technical competencies (e.g. Cloud, Containers, Languages) using recognized industry terms without keyword stuffing.',
      experience: 'Reverse-chronological bullet points using strong action verbs and quantified impact (using placeholders and questions when metrics are unevidenced).',
      projects: 'Key technical projects showcasing practical application of core tools matching target role requirements.',
    },
  },
  {
    id: 'naukri',
    name: 'Naukri Profile',
    platform: 'Naukri.com',
    description: 'Optimized for recruiter search indexing: concise role headline, functional profile summary, and key skills clustering.',
    sections: ['headline', 'summary', 'skills', 'experience'],
    sectionGuidance: {
      headline: 'Clear, concise resume headline highlighting current functional role, primary technical stack, and total experience for recruiter search listings.',
      summary: 'Profile Summary focusing on overall career scope, core domain expertise, and demonstrable technical capabilities.',
      skills: 'Key Skills aligned with recruiter search keywords, prioritizing skills directly evidenced in past projects and roles.',
      experience: 'Clear designation titles, organizational context, key deliverables, and hands-on tools utilized in client or product projects.',
    },
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Profile',
    platform: 'LinkedIn',
    description: 'Optimized for member discoverability and networking: value-proposition headline, first-person narrative About section, and core skills.',
    sections: ['headline', 'summary', 'skills', 'experience'],
    sectionGuidance: {
      headline: 'Engaging professional headline highlighting role identity, core specialization, and value proposition.',
      summary: 'First-person narrative About section ("I am...", "I specialize in...") articulating career journey, problem-solving passion, key strengths, and collaboration style.',
      skills: 'Featured core skills and recognized industry competencies for recruiter search discoverability and skill validation.',
      experience: 'Impact-oriented role overviews focusing on ownership, cross-functional collaboration, technical execution, and business outcomes.',
    },
  },
];

/**
 * Applies an accepted suggestion to the working resume text.
 * 
 * @param {string} currentText - Current working resume text.
 * @param {Object} suggestion - Suggestion object.
 * @param {string} [customText] - Optional customized text if edited by the user.
 * @returns {{ success: boolean, updatedText: string, applied: boolean, reason?: string }}
 */
export function applySuggestionToText(currentText, suggestion, customText = null) {
  if (!currentText) {
    return { success: false, updatedText: '', applied: false, reason: 'Resume text is empty.' };
  }

  if (!suggestion) {
    return { success: false, updatedText: currentText, applied: false, reason: 'Invalid suggestion.' };
  }

  const textToApply = (customText !== null && customText !== undefined ? customText : suggestion.suggested_text).trim();

  if (!textToApply) {
    return { success: false, updatedText: currentText, applied: false, reason: 'Cannot apply empty suggestion text.' };
  }

  const originalSnippet = (suggestion.original_text || '').trim();

  // Case 1: Exact or trimmed snippet match in resume text
  if (originalSnippet && currentText.includes(originalSnippet)) {
    const updated = currentText.replace(originalSnippet, textToApply);
    return { success: true, updatedText: updated, applied: true };
  }

  // Case 2: Snippet without trailing punctuation match
  if (originalSnippet) {
    const stripped = originalSnippet.replace(/[.,:;]+$/, '').trim();
    if (stripped && currentText.includes(stripped)) {
      const updated = currentText.replace(stripped, textToApply);
      return { success: true, updatedText: updated, applied: true };
    }
  }

  // Case 3: Adding new section or text not directly found -> append appropriately
  const sectionHeaderRegex = new RegExp(`(^|\\n)(${suggestion.section.toUpperCase()}|${suggestion.section})[:\\s]*`, 'i');
  const match = currentText.match(sectionHeaderRegex);

  if (match && match.index !== undefined) {
    // Insert under existing section header
    const insertPos = match.index + match[0].length;
    const before = currentText.slice(0, insertPos);
    const after = currentText.slice(insertPos);
    const updated = `${before}\n${textToApply}${after.startsWith('\n') ? '' : '\n'}${after}`;
    return { success: true, updatedText: updated, applied: true };
  }

  // Fallback: Append cleanly at the end
  const updated = `${currentText.trim()}\n\n${textToApply}`;
  return { success: true, updatedText: updated, applied: true };
}
