/**
 * Zero-Dependency Supabase Client
 * --------------------------------
 * Provides high-performance, browser-native connectivity to Supabase Auth (GoTrue),
 * Postgres Database (PostgREST), and Private File Storage using the fetch API.
 *
 * Security & Privacy Guarantees:
 * - Uses strictly the public 'anon' key (VITE_SUPABASE_ANON_KEY).
 * - NEVER uses or exposes the service-role key.
 * - Stores session tokens securely in browser localStorage.
 * - Enforces user-scoped Row Level Security (RLS) on Postgres tables and storage buckets.
 * - Reports honest unconfigured state when credentials are not supplied.
 */

export const SESSION_STORAGE_KEY = 'careerpilot_supabase_session';

/**
 * Checks whether Supabase environment variables are configured.
 */
export function isSupabaseConfigured(customEnv = null) {
  const env = customEnv || (typeof import.meta !== 'undefined' ? import.meta.env : {});
  const url = env?.VITE_SUPABASE_URL || '';
  const key = env?.VITE_SUPABASE_ANON_KEY || '';

  if (!url || !key) return false;
  if (url.includes('your-project-id') || key.includes('your-supabase-public-anon-key')) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Creates a configured Supabase client instance.
 *
 * @param {Object} [config]
 * @param {string} [config.supabaseUrl]
 * @param {string} [config.supabaseAnonKey]
 * @param {Storage} [config.storage]
 * @param {Function} [config.customFetch]
 */
export function createSupabaseClient(config = {}) {
  const env = typeof import.meta !== 'undefined' ? import.meta.env : {};
  const supabaseUrl = (config.supabaseUrl || env?.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseAnonKey = config.supabaseAnonKey || env?.VITE_SUPABASE_ANON_KEY || '';
  const storage = config.storage || (typeof window !== 'undefined' ? window.localStorage : null);
  const fetchImpl = config.customFetch || (typeof fetch !== 'undefined' ? fetch : null);

  let sessionCache = null;
  const authListeners = new Set();

  function notifyAuthChange(event, session) {
    authListeners.forEach((fn) => {
      try {
        fn(event, session);
      } catch (err) {
        console.error('Auth state listener error:', err);
      }
    });
  }

  function getStoredSession() {
    if (sessionCache) return sessionCache;
    if (!storage) return null;
    try {
      const raw = storage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      sessionCache = parsed;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveStoredSession(session) {
    sessionCache = session;
    if (storage) {
      if (session) {
        storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        storage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }

  function getAuthHeaders(includeContentType = true) {
    const headers = {
      apikey: supabaseAnonKey,
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    const session = getStoredSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
  }

  return {
    isConfigured: () => isSupabaseConfigured({ VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: supabaseAnonKey }),
    getUrl: () => supabaseUrl,

    // ── Auth Service ────────────────────────────────────────────────────────
    auth: {
      getSession: () => getStoredSession(),
      getUser: () => getStoredSession()?.user || null,

      onAuthStateChange: (callback) => {
        authListeners.add(callback);
        return () => authListeners.delete(callback);
      },

      /**
       * Signs up a new candidate with email and password.
       */
      signUp: async ({ email, password, data = {} }) => {
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env');
        }
        if (!email || !password) {
          throw new Error('Email and password are required.');
        }

        const resp = await fetchImpl(`${supabaseUrl}/auth/v1/signup`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ email, password, data }),
        });

        const body = await resp.json();
        if (!resp.ok) {
          throw new Error(body.msg || body.message || body.error_description || 'Sign up failed.');
        }

        if (body.access_token) {
          const session = {
            access_token: body.access_token,
            refresh_token: body.refresh_token,
            expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
            user: body.user,
          };
          saveStoredSession(session);
          notifyAuthChange('SIGNED_IN', session);
          return { user: body.user, session };
        }

        return { user: body.user, session: null };
      },

      /**
       * Signs in an existing candidate with email and password.
       */
      signInWithPassword: async ({ email, password }) => {
        if (!supabaseUrl || !supabaseAnonKey) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env');
        }
        if (!email || !password) {
          throw new Error('Email and password are required.');
        }

        const resp = await fetchImpl(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ email, password }),
        });

        const body = await resp.json();
        if (!resp.ok) {
          throw new Error(body.error_description || body.msg || body.message || 'Invalid login credentials.');
        }

        const session = {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
          user: body.user,
        };
        saveStoredSession(session);
        notifyAuthChange('SIGNED_IN', session);
        return { user: body.user, session };
      },

      /**
       * Signs out the candidate and clears local session tokens.
       */
      signOut: async () => {
        const session = getStoredSession();
        if (session?.access_token && supabaseUrl) {
          try {
            await fetchImpl(`${supabaseUrl}/auth/v1/logout`, {
              method: 'POST',
              headers: getAuthHeaders(),
            });
          } catch {
            // Ignore network failures on logout
          }
        }
        saveStoredSession(null);
        notifyAuthChange('SIGNED_OUT', null);
        return { error: null };
      },
    },

    // ── Resume Versions PostgREST Service ───────────────────────────────────
    resumes: {
      /**
       * Fetches all cloud resume versions belonging to the authenticated user.
       */
      fetchVersions: async () => {
        const session = getStoredSession();
        if (!session?.access_token) {
          throw new Error('Authentication required to fetch cloud resume versions.');
        }

        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/resume_versions?select=*&order=created_at.desc`, {
          method: 'GET',
          headers: getAuthHeaders(),
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.message || data.hint || 'Failed to fetch cloud resume versions.');
        }
        return Array.isArray(data) ? data : [];
      },

      /**
       * Inserts a new resume version into Supabase.
       */
      createVersion: async (versionRecord) => {
        const session = getStoredSession();
        if (!session?.access_token || !session.user?.id) {
          throw new Error('Authentication required to create cloud resume versions.');
        }

        const payload = {
          user_id: session.user.id,
          name: versionRecord.name,
          resume_text: versionRecord.resume_text,
          word_count: versionRecord.word_count || 0,
          char_count: versionRecord.char_count || 0,
          source_version_id: versionRecord.source_version_id || null,
          target_platform: versionRecord.target_platform || 'general',
          target_role: versionRecord.target_role || null,
          storage_path: versionRecord.storage_path || null,
          sync_status: 'synced',
        };

        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/resume_versions`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            Prefer: 'return=representation',
          },
          body: JSON.stringify(payload),
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.message || data.hint || 'Failed to create cloud resume version.');
        }
        return Array.isArray(data) ? data[0] : data;
      },

      /**
       * Updates an existing cloud resume version.
       */
      updateVersion: async (id, updates) => {
        const session = getStoredSession();
        if (!session?.access_token) {
          throw new Error('Authentication required to update cloud resume version.');
        }

        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/resume_versions?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            ...getAuthHeaders(),
            Prefer: 'return=representation',
          },
          body: JSON.stringify(updates),
        });

        const data = await resp.json();
        if (!resp.ok) {
          throw new Error(data.message || data.hint || 'Failed to update cloud resume version.');
        }
        return Array.isArray(data) ? data[0] : data;
      },

      /**
       * Deletes a cloud resume version by ID.
       */
      deleteVersion: async (id) => {
        const session = getStoredSession();
        if (!session?.access_token) {
          throw new Error('Authentication required to delete cloud resume version.');
        }

        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/resume_versions?id=eq.${id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.message || data.hint || 'Failed to delete cloud resume version.');
        }
        return { success: true };
      },

      /**
       * Deletes all cloud resume data belonging to the authenticated user.
       */
      deleteAllUserCloudData: async () => {
        const session = getStoredSession();
        if (!session?.access_token || !session.user?.id) {
          throw new Error('Authentication required to delete account cloud data.');
        }

        const resp = await fetchImpl(`${supabaseUrl}/rest/v1/resume_versions?user_id=eq.${session.user.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.message || data.hint || 'Failed to delete user cloud resumes.');
        }
        return { success: true };
      },
    },

    // ── Private File Storage Service ────────────────────────────────────────
    storage: {
      /**
       * Uploads a resume binary or text export to the user's private bucket.
       */
      uploadFile: async (filename, fileBlob, contentType = 'application/octet-stream') => {
        const session = getStoredSession();
        if (!session?.access_token || !session.user?.id) {
          throw new Error('Authentication required to upload resume files.');
        }

        const cleanPath = `${session.user.id}/${filename}`.replace(/\/+/g, '/');
        const headers = {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': contentType,
        };

        const resp = await fetchImpl(`${supabaseUrl}/storage/v1/object/resumes/${cleanPath}`, {
          method: 'POST',
          headers,
          body: fileBlob,
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data.message || 'Failed to upload resume file to private storage.');
        }
        return { path: cleanPath, Key: `resumes/${cleanPath}` };
      },
    },
  };
}

// Default singleton instance using environment variables
export const supabase = createSupabaseClient();
