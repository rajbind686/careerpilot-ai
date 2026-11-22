/**
 * Local Job Tracker Storage Service
 * -----------------------------------
 * Manages tracked job applications in browser localStorage.
 *
 * Privacy Guarantees:
 * - Stores ONLY: unique ID, company, role, optional job URL, date applied,
 *   status, created_at, and updated_at.
 * - NEVER sends data to any server, backend, or cloud API.
 * - Completely isolated from resume comparison history.
 *
 * Safety & Error Handling:
 * - Safe validation for required fields (company, role, status).
 * - Detects corrupted or invalid JSON without crashing or silently overwriting.
 * - Supports custom storage interface for unit testing in Node.js.
 */

export const STORAGE_KEY = 'careerpilot_tracked_jobs';

export const JOB_STATUSES = [
  'Interested',
  'Applied',
  'Interviewing',
  'Offer',
  'Rejected',
];

/**
 * Validates if the given status is one of the supported job statuses.
 * @param {string} status
 * @returns {boolean}
 */
export function isValidStatus(status) {
  return JOB_STATUSES.includes(status);
}

/**
 * Retrieves all tracked jobs from localStorage.
 *
 * @param {Storage} [customStorage] - Optional storage interface for testing.
 * @returns {{ success: boolean, data?: Array, error?: string, message?: string }}
 */
export function getJobs(customStorage = null) {
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
        message: 'Saved job tracker format is invalid. Data may have been modified or corrupted.',
      };
    }

    return { success: true, data: parsed };
  } catch (err) {
    return {
      success: false,
      error: 'CORRUPTED_DATA',
      message: `Failed to read job tracker data: ${err.message}. Data may be damaged.`,
    };
  }
}

/**
 * Adds a new job application entry to localStorage.
 *
 * @param {Object} params
 * @param {string} params.company - Company name (required).
 * @param {string} params.role - Job role / title (required).
 * @param {string} [params.jobUrl] - Optional URL to the job posting.
 * @param {string} [params.dateApplied] - Date applied (YYYY-MM-DD or ISO string, defaults to today).
 * @param {string} [params.status] - Status (Interested, Applied, Interviewing, Offer, Rejected; defaults to 'Applied').
 * @param {Storage} [params.customStorage] - Optional storage interface for testing.
 * @returns {{ success: boolean, record?: Object, error?: string, message?: string }}
 */
export function addJob({
  company,
  role,
  jobUrl = '',
  dateApplied = '',
  status = 'Applied',
  customStorage = null,
}) {
  if (!company || !company.trim()) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Company name is required.',
    };
  }

  if (!role || !role.trim()) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Job role is required.',
    };
  }

  const trimmedStatus = (status || '').trim();
  if (!isValidStatus(trimmedStatus)) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: `Invalid status "${status}". Allowed values: ${JOB_STATUSES.join(', ')}.`,
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

  // Check current data health
  const current = getJobs(storage);
  if (!current.success) {
    return current; // Avoid overwriting corrupted storage
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const resolvedDate = dateApplied && dateApplied.trim() ? dateApplied.trim() : todayStr;

  const newRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    company: company.trim(),
    role: role.trim(),
    job_url: (jobUrl || '').trim(),
    date_applied: resolvedDate,
    status: trimmedStatus,
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
      message: `Failed to save job to local storage: ${err.message}. Storage quota may be full.`,
    };
  }
}

/**
 * Updates an existing job entry by ID.
 *
 * @param {string} id - Job ID to update.
 * @param {Object} updates - Fields to update.
 * @param {string} [updates.company] - Updated company name.
 * @param {string} [updates.role] - Updated job role.
 * @param {string} [updates.jobUrl] - Updated job posting URL.
 * @param {string} [updates.dateApplied] - Updated date applied.
 * @param {string} [updates.status] - Updated status.
 * @param {Storage} [customStorage] - Optional storage interface for testing.
 * @returns {{ success: boolean, record?: Object, error?: string, message?: string }}
 */
export function updateJob(id, updates = {}, customStorage = null) {
  if (!id) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Job ID is required to update.',
    };
  }

  if (updates.company !== undefined && (!updates.company || !updates.company.trim())) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Company name cannot be empty.',
    };
  }

  if (updates.role !== undefined && (!updates.role || !updates.role.trim())) {
    return {
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'Job role cannot be empty.',
    };
  }

  if (updates.status !== undefined) {
    const trimmedStatus = updates.status.trim();
    if (!isValidStatus(trimmedStatus)) {
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: `Invalid status "${updates.status}". Allowed values: ${JOB_STATUSES.join(', ')}.`,
      };
    }
  }

  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return {
      success: false,
      error: 'STORAGE_UNAVAILABLE',
      message: 'Browser local storage is not available.',
    };
  }

  const current = getJobs(storage);
  if (!current.success) {
    return current;
  }

  const existingIdx = current.data.findIndex((item) => item.id === id);
  if (existingIdx === -1) {
    return {
      success: false,
      error: 'NOT_FOUND',
      message: `No job entry found with ID "${id}".`,
    };
  }

  const existing = current.data[existingIdx];
  const updatedRecord = {
    ...existing,
    company: updates.company !== undefined ? updates.company.trim() : existing.company,
    role: updates.role !== undefined ? updates.role.trim() : existing.role,
    job_url: updates.jobUrl !== undefined ? (updates.jobUrl || '').trim() : existing.job_url,
    date_applied: updates.dateApplied !== undefined ? (updates.dateApplied || '').trim() : existing.date_applied,
    status: updates.status !== undefined ? updates.status.trim() : existing.status,
    updated_at: new Date().toISOString(),
  };

  try {
    const updatedList = [...current.data];
    updatedList[existingIdx] = updatedRecord;
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    return { success: true, record: updatedRecord };
  } catch (err) {
    return {
      success: false,
      error: 'STORAGE_WRITE_FAILED',
      message: `Failed to update job in local storage: ${err.message}.`,
    };
  }
}

/**
 * Deletes a single job application by ID.
 *
 * @param {string} id - Job ID.
 * @param {Storage} [customStorage] - Optional storage interface.
 * @returns {{ success: boolean, error?: string, message?: string }}
 */
export function deleteJob(id, customStorage = null) {
  const storage = customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!storage) {
    return { success: false, error: 'STORAGE_UNAVAILABLE' };
  }

  const current = getJobs(storage);
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
 * Clears all job tracker records from storage.
 *
 * @param {Storage} [customStorage] - Optional storage interface.
 * @returns {{ success: boolean, error?: string, message?: string }}
 */
export function clearJobs(customStorage = null) {
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

/**
 * Pure helper function to filter and search jobs.
 *
 * @param {Array} jobs - List of job records.
 * @param {Object} options
 * @param {string} [options.statusFilter='All'] - Status to filter by, or 'All'.
 * @param {string} [options.searchQuery=''] - Case-insensitive query matching company or role.
 * @returns {Array} Filtered jobs list.
 */
export function filterAndSearchJobs(jobs = [], { statusFilter = 'All', searchQuery = '' } = {}) {
  if (!Array.isArray(jobs)) return [];

  const query = (searchQuery || '').trim().toLowerCase();
  const filter = (statusFilter || 'All').trim();

  return jobs.filter((job) => {
    // Status check
    if (filter !== 'All' && job.status !== filter) {
      return false;
    }

    // Search query check (matches company or role)
    if (query) {
      const matchCompany = (job.company || '').toLowerCase().includes(query);
      const matchRole = (job.role || '').toLowerCase().includes(query);
      if (!matchCompany && !matchRole) {
        return false;
      }
    }

    return true;
  });
}
