/**
 * API Service for CareerPilot AI
 * Connects the frontend to the FastAPI backend.
 */

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL !== undefined)
  ? import.meta.env.VITE_API_BASE_URL 
  : 'http://localhost:8000';

/**
 * Check if the backend server is reachable.
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed with status: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Unable to connect to backend server');
  }
}

/**
 * Sends a resume file to the backend to extract readable text in memory.
 * 
 * @param {File} resumeFile - Selected PDF or DOCX file.
 * @returns {Promise<{file_type: string, extracted_text: string, stats: {word_count: number, character_count: number}}>}
 */
export async function extractResumeText(resumeFile) {
  const formData = new FormData();
  formData.append('resume_file', resumeFile);

  const response = await fetch(`${API_BASE_URL}/api/extract-text`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.detail || data.message || 'Text extraction failed.';
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

/**
 * Compares the user's working resume text with a job description.
 * 
 * @param {string} resumeText - Working resume text.
 * @param {string} jobDescription - Target job posting text.
 */
export async function compareResumeWithJob(resumeText, jobDescription) {
  const response = await fetch(`${API_BASE_URL}/api/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resume_text: resumeText,
      job_description: jobDescription,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.detail || data.message || 'Comparison failed.';
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return data;
}

/**
 * Checks AI Coach configuration and available presets on the backend.
 */
export async function getCoachStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/coach/status`);
    if (!response.ok) {
      throw new Error(`Failed to check coach status: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    return {
      configured: false,
      message: err.message || 'Unable to connect to AI coach service.',
      missing_env_var: 'GEMINI_API_KEY',
    };
  }
}

/**
 * Sends explicit user request for AI resume coaching feedback.
 * 
 * @param {string} resumeText - Current working resume text.
 * @param {string} [jobDescription] - Optional target job description.
 * @param {string} [preset='general'] - Platform preset ('general', 'naukri', 'linkedin').
 */
export async function requestCoachFeedback(resumeText, jobDescription = '', preset = 'general') {
  const response = await fetch(`${API_BASE_URL}/api/coach/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resume_text: resumeText,
      job_description: jobDescription || undefined,
      preset,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.detail || data.message || 'AI Coach request failed.';
    const error = new Error(errorMessage);
    error.status = response.status;
    error.isUnconfigured = response.status === 503;
    throw error;
  }

  return data;
}

/**
 * Sends explicit user request to tailor a resume draft for a target job.
 * 
 * @param {string} resumeText - Active resume text.
 * @param {string} jobDescription - Target job posting text.
 * @param {string} [preset='general'] - Platform preset ('general', 'naukri', 'linkedin').
 */
export async function requestTailorResume(resumeText, jobDescription, preset = 'general') {
  const response = await fetch(`${API_BASE_URL}/api/tailor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resume_text: resumeText,
      job_description: jobDescription,
      preset,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.detail || data.message || 'Resume tailoring failed.';
    const error = new Error(errorMessage);
    error.status = response.status;
    error.isUnconfigured = response.status === 503;
    throw error;
  }

  return data;
}
