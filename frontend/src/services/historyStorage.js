/**
 * Local History Storage Service (Milestone 4)
 * -------------------------------------------
 * Manages saved comparison records in browser localStorage.
 *
 * Privacy Guarantees:
 * - Stores ONLY: unique ID, job title, optional company, ISO timestamp,
 *   and comparison summary metrics (matched/missing term names).
 * - NEVER stores: original resume text, job description text, or uploaded document bytes.
 *
 * Safety & Error Handling:
 * - Uses crypto.randomUUID() for collision-free IDs.
 * - Detects corrupted/malformed JSON safely without silently overwriting user data.
 * - Handles unavailable or quota-exceeded localStorage without crashing.
 */

const STORAGE_KEY = 'careerpilot_comparison_history';

/**
 * Checks if localStorage is available and accessible.
 */
function isStorageAvailable() {
  try {
    const testKey = '__careerpilot_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves the saved comparison history from localStorage.
 *
 * @param {Storage} [customStorage] - Optional storage interface (useful for unit testing).
 * @returns {{ success: boolean, data?: Array, error?: string, message?: string }}
 */
export function getHistory(customStorage = null) {
  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);

  if (!storage) {
    return {
      success: false,
      error: 'STORAGE_UNAVAILABLE',
      message: 'Browser local storage is not available in this environment.',
    };
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return { success: true, data: [] };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return {
        success: false,
        error: 'CORRUPTED_DATA',
        message: 'Saved history format is invalid. Data may have been modified or corrupted.',
      };
    }

    return { success: true, data: parsed };
  } catch (err) {
    return {
      success: false,
      error: 'CORRUPTED_DATA',
      message: `Failed to read comparison history: ${err.message}. Data may be damaged.`,
    };
  }
}

/**
 * Saves a comparison result with job title and optional company name.
 *
 * @param {Object} params
 * @param {string} params.jobTitle - Job title (required).
 * @param {string} [params.companyName] - Company name (optional).
 * @param {Object} params.comparisonResult - Result object from /api/compare.
 * @param {Storage} [params.customStorage] - Optional storage mock for testing.
 * @returns {{ success: boolean, record?: Object, error?: string, message?: string }}
 */
export function saveComparison({ jobTitle, companyName = '', comparisonResult, customStorage = null }) {
  if (!jobTitle || !jobTitle.trim()) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Job Title is required to save a comparison.',
    };
  }

  if (!comparisonResult || !comparisonResult.summary) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'A valid comparison result is required.',
    };
  }

  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return {
      success: false,
      error: 'STORAGE_UNAVAILABLE',
      message: 'Browser local storage is not available.',
    };
  }

  // 1. Fetch current history to prevent overwriting corrupted data
  const current = getHistory(storage);
  if (!current.success) {
    return current; // Do not overwrite corrupted storage
  }

  // 2. Generate clean, privacy-safe record
  const newRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    job_title: jobTitle.trim(),
    company_name: (companyName || '').trim(),
    created_at: new Date().toISOString(),
    summary: {
      supported_terms_found_count: comparisonResult.summary.supported_terms_found_count || 0,
      supported_terms_missing_count: comparisonResult.summary.supported_terms_missing_count || 0,
      total_supported_job_terms: comparisonResult.summary.total_supported_job_terms || 0,
      overlap_percentage: comparisonResult.summary.overlap_percentage || 0,
    },
    matched_terms: (comparisonResult.matched_terms || []).map((t) => ({
      term: t.term,
      occurrences_in_resume: t.occurrences_in_resume,
    })),
    missing_terms: (comparisonResult.missing_terms || []).map((t) => ({
      term: t.term,
      occurrences_in_job: t.occurrences_in_job,
      guidance: t.guidance,
    })),
  };

  try {
    const updated = [newRecord, ...current.data];
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true, record: newRecord };
  } catch (err) {
    return {
      success: false,
      error: 'STORAGE_WRITE_FAILED',
      message: `Failed to save to local storage: ${err.message}. Storage quota may be full.`,
    };
  }
}

/**
 * Deletes a single comparison record by ID.
 *
 * @param {string} id - Record UUID.
 * @param {Storage} [customStorage] - Optional storage mock.
 */
export function deleteComparison(id, customStorage = null) {
  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return { success: false, error: 'STORAGE_UNAVAILABLE' };
  }

  const current = getHistory(storage);
  if (!current.success) {
    return current;
  }

  try {
    const updated = current.data.filter((item) => item.id !== id);
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true };
  } catch (err) {
    return { success: false, error: 'STORAGE_WRITE_FAILED', message: err.message };
  }
}

/**
 * Clears all comparison history, or resets corrupted storage.
 *
 * @param {Storage} [customStorage] - Optional storage mock.
 */
export function clearHistory(customStorage = null) {
  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return { success: false, error: 'STORAGE_UNAVAILABLE' };
  }

  try {
    storage.removeItem(STORAGE_KEY);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'STORAGE_WRITE_FAILED', message: err.message };
  }
}
