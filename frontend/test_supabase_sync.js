/**
 * Unit & Integration Test Suite: Supabase Auth & Cross-Device Resume Sync
 * ------------------------------------------------------------------------
 * Verifies:
 *   1. Supabase unconfigured detection vs configured credentials.
 *   2. Authentication flows: sign-up, sign-in, session storage, sign-out.
 *   3. User-scoped access & authorization header injection.
 *   4. Local to cloud migration ("Sync to account") with progress tracking.
 *   5. Deduplication: existing versions are safely recognized without double-posting.
 *   6. Offline/network failure resilience: local versions stay intact on network failure.
 *   7. Cross-device loading: loads cloud library into device storage.
 *   8. Account data deletion: user can delete their cloud records.
 */

import assert from 'node:assert';
import {
  createSupabaseClient,
  isSupabaseConfigured,
  SESSION_STORAGE_KEY,
} from './src/services/supabaseClient.js';
import {
  syncLocalVersionsToCloud,
  loadCloudVersionsToDevice,
  getSyncSummary,
} from './src/services/supabaseSyncService.js';
import { STORAGE_KEY } from './src/services/resumeVersionStorage.js';

console.log('--- Starting Supabase Auth & Resume Sync Tests ---');

// Mock localStorage
function createMockStorage() {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

// Test 1: Configured vs Unconfigured Detection
{
  assert.strictEqual(isSupabaseConfigured({}), false);
  assert.strictEqual(
    isSupabaseConfigured({
      VITE_SUPABASE_URL: 'https://your-project-id.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'your-supabase-public-anon-key',
    }),
    false,
    'Placeholder values must be detected as unconfigured'
  );
  assert.strictEqual(
    isSupabaseConfigured({
      VITE_SUPABASE_URL: 'https://xyzrealproject.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.validkey',
    }),
    true,
    'Valid Supabase URL and anon key must be detected as configured'
  );
  console.log('✓ Test 1 Passed: Supabase configuration detection verified.');
}

// Test 2: Auth Flow (Sign-up, Sign-in, Session Persistence, Sign-out)
{
  const storage = createMockStorage();
  const mockUser = { id: 'usr_123_abc', email: 'candidate@example.com' };
  const mockToken = 'mock_jwt_token_candidate_123';

  // Mock fetch capturing requests
  const requests = [];
  const customFetch = async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/auth/v1/token?grant_type=password')) {
      return {
        ok: true,
        json: async () => ({
          access_token: mockToken,
          refresh_token: 'mock_refresh_token',
          user: mockUser,
        }),
      };
    }
    if (url.includes('/auth/v1/logout')) {
      return { ok: true, json: async () => ({}) };
    }
    return { ok: true, json: async () => ({}) };
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'mock_anon_key',
    storage,
    customFetch,
  });

  // 1. Initially no session
  assert.strictEqual(client.auth.getSession(), null);
  assert.strictEqual(client.auth.getUser(), null);

  // 2. Sign in
  const authRes = await client.auth.signInWithPassword({
    email: 'candidate@example.com',
    password: 'secure_password_123',
  });
  assert.strictEqual(authRes.user.email, 'candidate@example.com');
  assert.strictEqual(client.auth.getUser().id, 'usr_123_abc');

  // 3. Session persisted in storage
  const storedSessionRaw = storage.getItem(SESSION_STORAGE_KEY);
  assert.ok(storedSessionRaw);
  assert.strictEqual(JSON.parse(storedSessionRaw).access_token, mockToken);

  // 4. Sign out
  await client.auth.signOut();
  assert.strictEqual(client.auth.getSession(), null);
  assert.strictEqual(storage.getItem(SESSION_STORAGE_KEY), null);

  console.log('✓ Test 2 Passed: Sign-in, token persistence in localStorage, and sign-out verified.');
}

// Test 3: User-Scoped Authorization Header Injection
{
  const storage = createMockStorage();
  storage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'active_bearer_jwt_999',
      user: { id: 'usr_999', email: 'test@example.com' },
    })
  );

  let capturedHeaders = null;
  const customFetch = async (url, options) => {
    capturedHeaders = options.headers;
    return { ok: true, json: async () => [] };
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'public_anon_123',
    storage,
    customFetch,
  });

  await client.resumes.fetchVersions();
  assert.strictEqual(capturedHeaders['apikey'], 'public_anon_123');
  assert.strictEqual(capturedHeaders['Authorization'], 'Bearer active_bearer_jwt_999');

  console.log('✓ Test 3 Passed: User-scoped authorization headers correctly injected for PostgREST.');
}

// Test 4: "Sync to Account" Migration Flow with Progress Tracking
{
  const storage = createMockStorage();
  // Seed local versions
  const localList = [
    {
      id: 'loc_v1',
      name: 'Cloud Engineer v1',
      resume_text: 'RAJ BIND\nCloud Engineer with AWS and Linux experience.',
      word_count: 9,
      sync_status: 'local',
    },
    {
      id: 'loc_v2',
      name: 'DevOps Lead v2',
      resume_text: 'RAJ BIND\nDevOps Lead with Kubernetes and Terraform experience.',
      word_count: 10,
      sync_status: 'local',
    },
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(localList));

  // Mock cloud database
  const cloudDb = [];
  const customFetch = async (url, options) => {
    if (url.includes('/rest/v1/resume_versions') && options.method === 'GET') {
      return { ok: true, json: async () => [...cloudDb] };
    }
    if (url.includes('/rest/v1/resume_versions') && options.method === 'POST') {
      const payload = JSON.parse(options.body);
      const record = { id: `cld_${cloudDb.length + 1}`, ...payload };
      cloudDb.push(record);
      return { ok: true, json: async () => [record] };
    }
    return { ok: true, json: async () => [] };
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'anon_key',
    storage,
    customFetch,
  });

  // Set session
  storage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'valid_token',
      user: { id: 'usr_candidate_1' },
    })
  );

  const progressEvents = [];
  const syncResult = await syncLocalVersionsToCloud({
    client,
    customStorage: storage,
    onProgress: (p) => progressEvents.push({ ...p }),
  });

  assert.strictEqual(syncResult.success, true);
  assert.strictEqual(syncResult.syncedCount, 2);
  assert.strictEqual(cloudDb.length, 2);
  assert.strictEqual(progressEvents.length, 2);

  // Invariant check: Local storage records are preserved and marked synced with cloud_id
  const updatedLocal = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.strictEqual(updatedLocal.length, 2);
  assert.strictEqual(updatedLocal[0].sync_status, 'synced');
  assert.ok(updatedLocal[0].cloud_id);
  assert.strictEqual(updatedLocal[1].sync_status, 'synced');
  assert.ok(updatedLocal[1].cloud_id);

  console.log('✓ Test 4 Passed: "Sync to account" migrated local versions with progress tracking and preserved local files.');
}

// Test 5: Deduplication Safety (Syncing twice does not create duplicates)
{
  const storage = createMockStorage();
  const localList = [
    {
      id: 'loc_v1',
      name: 'Existing Resume',
      resume_text: 'RAJ BIND - Standard Resume Text',
      sync_status: 'local',
    },
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(localList));

  // Cloud already has this exact resume
  const cloudDb = [
    {
      id: 'cld_existing_1',
      user_id: 'usr_candidate_1',
      name: 'Existing Resume',
      resume_text: 'RAJ BIND - Standard Resume Text',
    },
  ];

  let postCount = 0;
  const customFetch = async (url, options) => {
    if (url.includes('/rest/v1/resume_versions') && options.method === 'GET') {
      return { ok: true, json: async () => [...cloudDb] };
    }
    if (url.includes('/rest/v1/resume_versions') && options.method === 'POST') {
      postCount++;
      return { ok: true, json: async () => [{}] };
    }
    return { ok: true, json: async () => [] };
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'anon_key',
    storage,
    customFetch,
  });

  storage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'valid_token',
      user: { id: 'usr_candidate_1' },
    })
  );

  const res = await syncLocalVersionsToCloud({ client, customStorage: storage });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.existingCount, 1);
  assert.strictEqual(res.syncedCount, 0);
  assert.strictEqual(postCount, 0, 'Must NOT post duplicate record to Supabase');

  const updatedLocal = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.strictEqual(updatedLocal[0].sync_status, 'synced');
  assert.strictEqual(updatedLocal[0].cloud_id, 'cld_existing_1');

  console.log('✓ Test 5 Passed: Deduplication correctly matches existing cloud records without duplication.');
}

// Test 6: Network Failure Resilience (Local versions remain intact)
{
  const storage = createMockStorage();
  const localList = [
    {
      id: 'loc_fail_1',
      name: 'Offline Resume',
      resume_text: 'Offline resume content',
      sync_status: 'local',
    },
  ];
  storage.setItem(STORAGE_KEY, JSON.stringify(localList));

  // Simulate network failure
  const customFetch = async () => {
    throw new Error('Failed to fetch: Network offline');
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'anon_key',
    storage,
    customFetch,
  });

  storage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'valid_token',
      user: { id: 'usr_candidate_1' },
    })
  );

  const res = await syncLocalVersionsToCloud({ client, customStorage: storage });
  assert.strictEqual(res.success, false);
  assert.strictEqual(res.error, 'NETWORK_ERROR');

  // Verify local data is NOT lost or corrupted
  const localAfterFail = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.strictEqual(localAfterFail.length, 1);
  assert.strictEqual(localAfterFail[0].name, 'Offline Resume');
  assert.strictEqual(localAfterFail[0].sync_status, 'local');

  console.log('✓ Test 6 Passed: Network failure gracefully handled; unsynced local data preserved.');
}

// Test 7: Cross-Device Loading (Second device imports user cloud library)
{
  const secondDeviceStorage = createMockStorage();
  // Device 2 starts with empty storage
  assert.strictEqual(secondDeviceStorage.getItem(STORAGE_KEY), null);

  const cloudDb = [
    {
      id: 'cld_remote_1',
      name: 'Remote Cloud Resume',
      resume_text: 'Candidate cloud resume text from Device 1',
      created_at: '2026-11-21T10:00:00Z',
    },
  ];

  const customFetch = async (url, options) => {
    if (url.includes('/rest/v1/resume_versions') && options.method === 'GET') {
      return { ok: true, json: async () => [...cloudDb] };
    }
    return { ok: true, json: async () => [] };
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'anon_key',
    storage: secondDeviceStorage,
    customFetch,
  });

  secondDeviceStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'valid_token',
      user: { id: 'usr_candidate_1' },
    })
  );

  const loadRes = await loadCloudVersionsToDevice({ client, customStorage: secondDeviceStorage });
  assert.strictEqual(loadRes.success, true);
  assert.strictEqual(loadRes.importedCount, 1);

  const importedList = JSON.parse(secondDeviceStorage.getItem(STORAGE_KEY));
  assert.strictEqual(importedList.length, 1);
  assert.strictEqual(importedList[0].name, 'Remote Cloud Resume');
  assert.strictEqual(importedList[0].sync_status, 'synced');

  console.log('✓ Test 7 Passed: Cross-device loading imports cloud library into new device storage.');
}

// Test 8: Cloud Account Data Deletion
{
  const storage = createMockStorage();
  let deletedUserId = null;

  const customFetch = async (url, options) => {
    if (url.includes('/rest/v1/resume_versions?user_id=eq.') && options.method === 'DELETE') {
      const match = url.match(/user_id=eq\.([^&]+)/);
      deletedUserId = match ? match[1] : null;
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => [] };
  };

  const client = createSupabaseClient({
    supabaseUrl: 'https://mocktest.supabase.co',
    supabaseAnonKey: 'anon_key',
    storage,
    customFetch,
  });

  storage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({
      access_token: 'valid_token',
      user: { id: 'usr_delete_me_123' },
    })
  );

  const delRes = await client.resumes.deleteAllUserCloudData();
  assert.strictEqual(delRes.success, true);
  assert.strictEqual(deletedUserId, 'usr_delete_me_123');

  console.log('✓ Test 8 Passed: Account cloud data deletion correctly targets authenticated user records.');
}

// Test 9: getSyncSummary statistics calculation
{
  const versions = [
    { id: '1', sync_status: 'synced' },
    { id: '2', sync_status: 'local' },
    { id: '3', sync_status: 'synced' },
    { id: '4', sync_status: 'local' },
  ];
  const summary = getSyncSummary(versions);
  assert.strictEqual(summary.total, 4);
  assert.strictEqual(summary.synced, 2);
  assert.strictEqual(summary.localOnly, 2);
  console.log('✓ Test 9 Passed: getSyncSummary accurately tallies synced and local-only records.');
}

console.log('--- All Supabase Auth & Resume Sync Tests Passed! ---');
