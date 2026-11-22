/**
 * Local Resume Version Storage Service
 * -------------------------------------
 * Manages named resume versions in browser localStorage.
 *
 * Privacy Guarantees:
 * - Stored ONLY in browser localStorage under 'careerpilot_resume_versions'.
 * - NEVER sent to any backend, server, or cloud service.
 * - Completely separate from comparison history and the Job Tracker.
 * - Saving is strictly an explicit user action; NEVER auto-saved.
 *
 * Safety & Error Handling:
 * - Detects corrupted or invalid JSON safely without crashing.
 * - Validates required fields (name, resumeText).
 * - Confirms storage availability and handles quota failures.
 */

export const STORAGE_KEY = 'careerpilot_resume_versions';

/**
 * Calculates word count from text string.
 * @param {string} text
 * @returns {number}
 */
export function calculateWordCount(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Retrieves all saved resume versions from localStorage.
 *
 * @param {Storage} [customStorage] - Optional storage interface for testing.
 * @returns {{ success: boolean, data?: Array, error?: string, message?: string }}
 */
export function getResumeVersions(customStorage = null) {
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
        message: 'Saved resume versions data is invalid or damaged.',
      };
    }

    return { success: true, data: parsed };
  } catch (err) {
    return {
      success: false,
      error: 'CORRUPTED_DATA',
      message: `Failed to read resume versions: ${err.message}.`,
    };
  }
}

/**
 * Explicitly saves current resume text as a named version.
 *
 * @param {Object} params
 * @param {string} params.name - User-specified version name (e.g. "DevOps Focus v1").
 * @param {string} params.resumeText - Full text of the resume version.
 * @param {Storage} [params.customStorage] - Optional storage interface for testing.
 * @returns {{ success: boolean, record?: Object, error?: string, message?: string }}
 */
export function saveResumeVersion({ name, resumeText, customStorage = null }) {
  if (!name || !name.trim()) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'A version name is required to save.',
    };
  }

  if (!resumeText || !resumeText.trim()) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Resume text is empty and cannot be saved as a version.',
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

  const current = getResumeVersions(storage);
  if (!current.success) {
    return current; // Protect corrupted storage
  }

  const now = new Date();
  const trimmedText = resumeText.trim();

  const newRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: name.trim(),
    resume_text: trimmedText,
    char_count: trimmedText.length,
    word_count: calculateWordCount(trimmedText),
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  try {
    const updated = [newRecord, ...current.data];
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true, record: newRecord };
  } catch (err) {
    return {
      success: false,
      error: 'STORAGE_WRITE_FAILED',
      message: `Failed to save resume version: ${err.message}. Storage quota may be full.`,
    };
  }
}

/**
 * Renames an existing resume version by ID.
 *
 * @param {string} id - Version ID.
 * @param {string} newName - New name for the version.
 * @param {Storage} [customStorage] - Optional storage interface.
 * @returns {{ success: boolean, record?: Object, error?: string, message?: string }}
 */
export function renameResumeVersion(id, newName, customStorage = null) {
  if (!id) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Version ID is required to rename.',
    };
  }

  if (!newName || !newName.trim()) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'New version name cannot be empty.',
    };
  }

  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return { success: false, error: 'STORAGE_UNAVAILABLE' };
  }

  const current = getResumeVersions(storage);
  if (!current.success) {
    return current;
  }

  const index = current.data.findIndex((v) => v.id === id);
  if (index === -1) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: `Resume version with ID "${id}" was not found.`,
    };
  }

  const existing = current.data[index];
  const updatedRecord = {
    ...existing,
    name: newName.trim(),
    updated_at: new Date().toISOString(),
  };

  try {
    const updatedList = [...current.data];
    updatedList[index] = updatedRecord;
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    return { success: true, record: updatedRecord };
  } catch (err) {
    return {
      success: false,
      error: 'STORAGE_WRITE_FAILED',
      message: `Failed to rename version: ${err.message}.`,
    };
  }
}

/**
 * Deletes a single resume version by ID.
 *
 * @param {string} id - Version ID to delete.
 * @param {Storage} [customStorage] - Optional storage interface.
 * @returns {{ success: boolean, error?: string, message?: string }}
 */
export function deleteResumeVersion(id, customStorage = null) {
  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return { success: false, error: 'STORAGE_UNAVAILABLE' };
  }

  const current = getResumeVersions(storage);
  if (!current.success) {
    return current;
  }

  try {
    const updated = current.data.filter((v) => v.id !== id);
    storage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true };
  } catch (err) {
    return { success: false, error: 'STORAGE_WRITE_FAILED', message: err.message };
  }
}

/**
 * Clears all saved resume versions from localStorage.
 *
 * @param {Storage} [customStorage] - Optional storage interface.
 * @returns {{ success: boolean, error?: string, message?: string }}
 */
export function clearResumeVersions(customStorage = null) {
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
