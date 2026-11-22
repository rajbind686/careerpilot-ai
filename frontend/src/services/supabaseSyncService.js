/**
 * Supabase Cross-Device Sync Service
 * -----------------------------------
 * Manages two-way sync, deduplication, progress reporting, and offline resilience
 * between browser localStorage and the user's private Supabase Postgres library.
 *
 * Safety & Privacy Rules:
 * - Local-first guarantee: Versions are ALWAYS saved locally first; network failure never drops data.
 * - Non-destructive sync: Syncing to cloud NEVER deletes local versions without user consent.
 * - Deduplication: Prevents duplicate records by matching checksum / normalized text and names.
 * - Clear Sync Status: Tracks whether a record is 'synced', 'local', or 'syncing'.
 */

import { supabase } from './supabaseClient.js';
import {
  STORAGE_KEY,
  getResumeVersions,
  calculateWordCount,
} from './resumeVersionStorage.js';

/**
 * Normalizes text for reliable deduplication comparison.
 */
function normalizeResumeComparisonText(text) {
  if (!text) return '';
  return text.trim().replace(/\r\n/g, '\n').replace(/\s+/g, ' ');
}

/**
 * Syncs all local resume versions to the signed-in user's Supabase cloud library.
 *
 * @param {Object} [options]
 * @param {Function} [options.onProgress] - Callback: ({ current, total, versionName, status }) => void
 * @param {Storage} [options.customStorage] - Optional storage mock for testing.
 * @param {Object} [options.client] - Optional Supabase client instance.
 * @returns {Promise<{ success: boolean, syncedCount: number, existingCount: number, failedCount: number, errors: Array }>}
 */
export async function syncLocalVersionsToCloud(options = {}) {
  const client = options.client || supabase;
  const storage = options.customStorage || (typeof window !== 'undefined' ? window.localStorage : null);
  const onProgress = options.onProgress || (() => {});

  if (!client.isConfigured()) {
    return {
      success: false,
      error: 'UNCONFIGURED',
      message: 'Supabase cloud sync is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cross-device sync.',
      syncedCount: 0,
      existingCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  const session = client.auth.getSession();
  if (!session?.access_token || !session.user?.id) {
    return {
      success: false,
      error: 'UNAUTHENTICATED',
      message: 'You must be signed in to sync resume versions to your cloud account.',
      syncedCount: 0,
      existingCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  const localRes = getResumeVersions(storage);
  if (!localRes.success) {
    return {
      success: false,
      error: localRes.error,
      message: localRes.message,
      syncedCount: 0,
      existingCount: 0,
      failedCount: 0,
      errors: [localRes.message],
    };
  }

  const localVersions = localRes.data || [];
  if (localVersions.length === 0) {
    return {
      success: true,
      message: 'No local versions found to sync.',
      syncedCount: 0,
      existingCount: 0,
      failedCount: 0,
      errors: [],
    };
  }

  // 1. Fetch existing cloud versions to prevent duplicates
  let cloudVersions = [];
  try {
    cloudVersions = await client.resumes.fetchVersions();
  } catch (err) {
    return {
      success: false,
      error: 'NETWORK_ERROR',
      message: `Failed to connect to cloud library: ${err.message}`,
      syncedCount: 0,
      existingCount: 0,
      failedCount: 0,
      errors: [err.message],
    };
  }

  // Build index of existing cloud versions by normalized text and name
  const cloudTextIndex = new Set();
  const cloudIdIndex = new Set();
  cloudVersions.forEach((cv) => {
    cloudIdIndex.add(cv.id);
    if (cv.resume_text) {
      cloudTextIndex.add(normalizeResumeComparisonText(cv.resume_text));
    }
  });

  let syncedCount = 0;
  let existingCount = 0;
  let failedCount = 0;
  const errors = [];
  const updatedLocalVersions = [...localVersions];

  // 2. Iterate through local versions and migrate new ones
  const total = localVersions.length;

  for (let i = 0; i < total; i++) {
    const local = updatedLocalVersions[i];
    onProgress({
      current: i + 1,
      total,
      versionName: local.name,
      status: 'syncing',
    });

    const normalizedLocalText = normalizeResumeComparisonText(local.resume_text);

    // Duplicate check: already exists in cloud?
    const alreadyInCloud =
      (local.cloud_id && cloudIdIndex.has(local.cloud_id)) ||
      cloudTextIndex.has(normalizedLocalText);

    if (alreadyInCloud) {
      existingCount++;
      // Mark local as synced
      local.sync_status = 'synced';
      const match = cloudVersions.find(
        (cv) => cv.id === local.cloud_id || normalizeResumeComparisonText(cv.resume_text) === normalizedLocalText
      );
      if (match) {
        local.cloud_id = match.id;
      }
      continue;
    }

    // New version -> upload to Supabase PostgREST
    try {
      const created = await client.resumes.createVersion({
        name: local.name,
        resume_text: local.resume_text,
        word_count: local.word_count || calculateWordCount(local.resume_text),
        char_count: local.char_count || local.resume_text.length,
        source_version_id: local.source_version_id || null,
        target_platform: local.target_platform || 'general',
        target_role: local.target_role || null,
      });

      local.cloud_id = created.id;
      local.sync_status = 'synced';
      cloudIdIndex.add(created.id);
      cloudTextIndex.add(normalizedLocalText);
      syncedCount++;
    } catch (err) {
      failedCount++;
      errors.push(`Failed to sync "${local.name}": ${err.message}`);
      local.sync_status = 'local';
    }
  }

  // 3. Persist sync flags back to localStorage safely
  try {
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(updatedLocalVersions));
    }
  } catch (err) {
    console.warn('Could not update localStorage after sync:', err);
  }

  return {
    success: failedCount === 0,
    syncedCount,
    existingCount,
    failedCount,
    errors,
  };
}

/**
 * Loads cloud versions from Supabase and merges them into this device's storage.
 * Enables seamless access on another device after signing in.
 *
 * @param {Object} [options]
 * @param {Storage} [options.customStorage]
 * @param {Object} [options.client]
 * @returns {Promise<{ success: boolean, importedCount: number, totalCount: number, error?: string }>}
 */
export async function loadCloudVersionsToDevice(options = {}) {
  const client = options.client || supabase;
  const storage = options.customStorage || (typeof window !== 'undefined' ? window.localStorage : null);

  if (!client.isConfigured() || !client.auth.getSession()) {
    return { success: false, error: 'NOT_READY', importedCount: 0, totalCount: 0 };
  }

  try {
    const cloudVersions = await client.resumes.fetchVersions();
    const localRes = getResumeVersions(storage);
    const localVersions = localRes.success ? localRes.data : [];

    const localTextSet = new Set(localVersions.map((lv) => normalizeResumeComparisonText(lv.resume_text)));
    const localCloudIdSet = new Set(localVersions.map((lv) => lv.cloud_id).filter(Boolean));

    let importedCount = 0;
    const merged = [...localVersions];

    cloudVersions.forEach((cv) => {
      const normalized = normalizeResumeComparisonText(cv.resume_text);
      if (!localCloudIdSet.has(cv.id) && !localTextSet.has(normalized)) {
        merged.push({
          id: cv.id,
          cloud_id: cv.id,
          name: cv.name,
          resume_text: cv.resume_text,
          word_count: cv.word_count || calculateWordCount(cv.resume_text),
          char_count: cv.char_count || cv.resume_text.length,
          source_version_id: cv.source_version_id || null,
          target_platform: cv.target_platform || 'general',
          target_role: cv.target_role || null,
          sync_status: 'synced',
          created_at: cv.created_at,
          updated_at: cv.updated_at,
        });
        localTextSet.add(normalized);
        localCloudIdSet.add(cv.id);
        importedCount++;
      }
    });

    if (importedCount > 0 && storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }

    return {
      success: true,
      importedCount,
      totalCount: merged.length,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      importedCount: 0,
      totalCount: 0,
    };
  }
}

/**
 * Computes sync statistics across a list of versions.
 *
 * @param {Array} versions
 * @returns {{ total: number, synced: number, localOnly: number }}
 */
export function getSyncSummary(versions = []) {
  let synced = 0;
  let localOnly = 0;

  versions.forEach((v) => {
    if (v.sync_status === 'synced' || v.cloud_id) {
      synced++;
    } else {
      localOnly++;
    }
  });

  return {
    total: versions.length,
    synced,
    localOnly,
  };
}
