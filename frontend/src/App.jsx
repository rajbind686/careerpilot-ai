import React, { useState, useEffect } from 'react';
import {
  checkHealth,
  extractResumeText,
  compareResumeWithJob,
  getCoachStatus,
  requestCoachFeedback,
  requestTailorResume,
} from './services/api';
import {
  getHistory,
  saveComparison,
  deleteComparison,
  clearHistory,
} from './services/historyStorage';
import { exportResumeTextAsFile, exportResumeTextAsDocx } from './services/exportService';
import {
  JOB_STATUSES,
  getJobs,
  addJob,
  updateJob,
  deleteJob,
  clearJobs,
  filterAndSearchJobs,
} from './services/jobTrackerStorage';
import {
  getResumeVersions,
  saveResumeVersion,
  renameResumeVersion,
  deleteResumeVersion,
  clearResumeVersions,
  calculateWordCount,
} from './services/resumeVersionStorage';
import {
  COACH_PRESETS,
  applySuggestionToText,
} from './services/coachService';
import {
  validateTailorInputs,
  formatDefaultTailoredVersionName,
  computeComparisonStats,
  TAILOR_PRESETS,
} from './services/tailorService';
import { supabase, isSupabaseConfigured } from './services/supabaseClient';
import {
  syncLocalVersionsToCloud,
  loadCloudVersionsToDevice,
  getSyncSummary,
} from './services/supabaseSyncService';

/* ── Icons (inline SVGs, no extra dep) ── */
function IconCloud() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function IconCloudCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 14 2 2 4-4" />
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
    </svg>
  );
}
function IconWand() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4V2m0 16v-2M8 9h2m10 0h2m-4.2 2.8 1.4 1.4M18.8 5.2l-1.4 1.4M3 21l9-9m0 0 3-3-9-9-3 3 9 9Z" />
    </svg>
  );
}

function IconSparkles() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
      <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconExternalLink() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* Helper to format technical AI provider errors into user-friendly messages */
function formatProviderErrorMessage(rawError) {
  if (!rawError) return '';
  const str = String(rawError);
  if (str.includes('404') || str.includes('NOT_FOUND') || str.includes('not found') || str.includes('no longer available')) {
    return 'The requested AI model is unavailable or has been deprecated by the provider. Please try again or check your model configuration.';
  }
  if (str.includes('503') || str.includes('UNAVAILABLE') || str.includes('high demand') || str.includes('timed out')) {
    return 'The AI provider is currently experiencing temporary high demand or timeout. Please click Retry below to try again.';
  }
  if (str.includes('400') || str.includes('API_KEY_INVALID') || str.includes('API key not valid')) {
    return 'The configured API key appears to be invalid or unauthorized. Please verify your key in backend/.env.';
  }
  if (str.includes('429') || str.includes('RESOURCE_EXHAUSTED') || str.includes('Quota')) {
    return 'The AI provider rate limit was reached. Please wait a few moments and click Retry.';
  }
  if (str.includes('Failed to fetch') || str.includes('Could not connect')) {
    return 'Could not reach the CareerPilot backend. Please ensure the backend server is running on port 8000.';
  }
  return rawError.length > 200 ? 'An unexpected issue occurred while requesting suggestions from the AI provider.' : rawError;
}

export default function App() {
  // Backend health status state
  const [backendStatus, setBackendStatus] = useState('checking');
  const [backendInfo, setBackendInfo] = useState(null);

  // File extraction states
  const [selectedFile, setSelectedFile] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractErrorStatus, setExtractErrorStatus] = useState(null);

  // Resume text states: pristine baseline vs editable working copy
  const [fileTypeConfirmed, setFileTypeConfirmed] = useState(null);
  const [originalExtractedText, setOriginalExtractedText] = useState('');
  const [workingResumeText, setWorkingResumeText] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Export states (Milestones 5 & 6)
  const [exportTxtSuccessMsg, setExportTxtSuccessMsg] = useState('');
  const [exportTxtError, setExportTxtError] = useState('');
  const [exportDocxSuccessMsg, setExportDocxSuccessMsg] = useState('');
  const [exportDocxError, setExportDocxError] = useState('');

  // Job description & comparison states
  const [jobDescription, setJobDescription] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [comparisonResult, setComparisonResult] = useState(null);

  // Comparison History states (Milestone 4)
  const [historyItems, setHistoryItems] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [saveJobTitle, setSaveJobTitle] = useState('');
  const [saveCompanyName, setSaveCompanyName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [expandedCardIds, setExpandedCardIds] = useState(new Set());

  // Navigation tab state ('analyser' | 'tracker')
  const [activeTab, setActiveTab] = useState('analyser');

  // Job Tracker states
  const [trackedJobs, setTrackedJobs] = useState([]);
  const [trackerError, setTrackerError] = useState(null);
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('All');

  // Job Tracker form states (Add / Edit)
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobFormCompany, setJobFormCompany] = useState('');
  const [jobFormRole, setJobFormRole] = useState('');
  const [jobFormUrl, setJobFormUrl] = useState('');
  const [jobFormDate, setJobFormDate] = useState('');
  const [jobFormStatus, setJobFormStatus] = useState('Applied');
  const [jobFormError, setJobFormError] = useState('');

  // Resume Versions states
  const [resumeVersions, setResumeVersions] = useState([]);
  const [versionError, setVersionError] = useState(null);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);
  const [isSaveVersionBoxOpen, setIsSaveVersionBoxOpen] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');
  const [versionActionError, setVersionActionError] = useState('');
  const [versionSuccessMsg, setVersionSuccessMsg] = useState('');
  const [editingVersionId, setEditingVersionId] = useState(null);
  const [renameVersionInput, setRenameVersionInput] = useState('');

  // AI Resume Coach states
  const [coachStatus, setCoachStatus] = useState({ configured: false, message: '', missing_env_var: 'GEMINI_API_KEY' });
  const [coachPreset, setCoachPreset] = useState('general');
  const [coachJobDescription, setCoachJobDescription] = useState('');
  const [isCoachingLoading, setIsCoachingLoading] = useState(false);
  const [coachError, setCoachError] = useState('');
  const [coachCritique, setCoachCritique] = useState('');
  const [coachSuggestions, setCoachSuggestions] = useState([]);
  const [suggestionStatuses, setSuggestionStatuses] = useState({});
  const [editingSuggestionId, setEditingSuggestionId] = useState(null);
  const [editingSuggestionText, setEditingSuggestionText] = useState('');
  const [coachSuccessMsg, setCoachSuccessMsg] = useState('');
  const [coachSectionFilter, setCoachSectionFilter] = useState('all');

  // Resume Tailoring states ('tailor' tab)
  const [tailorPreset, setTailorPreset] = useState('general');
  const [tailorJobDescription, setTailorJobDescription] = useState('');
  const [isTailoringLoading, setIsTailoringLoading] = useState(false);
  const [tailorError, setTailorError] = useState('');
  const [tailorErrorStatus, setTailorErrorStatus] = useState(null);
  const [tailorDraft, setTailorDraft] = useState(null);
  const [editedTailorText, setEditedTailorText] = useState('');
  const [isEditingTailorDraft, setIsEditingTailorDraft] = useState(false);
  const [tailorVersionNameInput, setTailorVersionNameInput] = useState('');
  const [tailorSuccessMsg, setTailorSuccessMsg] = useState('');
  const [tailorSavedRecord, setTailorSavedRecord] = useState(null);

  // Supabase Auth & Cloud Sync states
  const [supabaseConfigured] = useState(() => isSupabaseConfigured());
  const [userSession, setUserSession] = useState(() => supabase.auth.getSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | 'account'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncResultMsg, setSyncResultMsg] = useState('');
  const [versionFilter, setVersionFilter] = useState('all');

  useEffect(() => {
    verifyBackend();
    loadSavedHistory();
    loadTrackedJobs();
    loadResumeVersions();
    loadCoachStatus();

    // Check existing Supabase session and load cloud versions
    const session = supabase.auth.getSession();
    if (session) {
      setUserSession(session);
      loadCloudVersionsToDevice({ client: supabase }).then((res) => {
        if (res.success && res.importedCount > 0) {
          loadResumeVersions();
        }
      });
    }

    const unsubscribe = supabase.auth.onAuthStateChange((event, newSession) => {
      setUserSession(newSession);
      if (newSession) {
        loadCloudVersionsToDevice({ client: supabase }).then((res) => {
          if (res.success && res.importedCount > 0) {
            loadResumeVersions();
          }
        });
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  async function verifyBackend() {
    setBackendStatus('checking');
    try {
      const data = await checkHealth();
      setBackendStatus('connected');
      setBackendInfo(data);
    } catch {
      setBackendStatus('disconnected');
      setBackendInfo(null);
    }
  }

  function loadSavedHistory() {
    const res = getHistory();
    if (res.success) {
      setHistoryItems(res.data);
      setHistoryError(null);
    } else {
      setHistoryError(res.message);
    }
  }

  function loadTrackedJobs() {
    const res = getJobs();
    if (res.success) {
      setTrackedJobs(res.data);
      setTrackerError(null);
    } else {
      setTrackerError(res.message);
    }
  }

  function loadResumeVersions() {
    const res = getResumeVersions();
    if (res.success) {
      setResumeVersions(res.data);
      setVersionError(null);
    } else {
      setVersionError(res.message);
    }
  }

  function handleSaveCurrentVersion(e) {
    if (e) e.preventDefault();
    setVersionActionError('');
    setVersionSuccessMsg('');

    if (!newVersionName.trim()) {
      setVersionActionError('Please enter a name for this version.');
      return;
    }

    if (!workingResumeText.trim()) {
      setVersionActionError('Resume text is empty.');
      return;
    }

    const res = saveResumeVersion({
      name: newVersionName,
      resumeText: workingResumeText,
    });

    if (res.success) {
      if (supabaseConfigured && userSession) {
        supabase.resumes.createVersion({
          name: res.record.name,
          resume_text: res.record.resume_text,
          word_count: res.record.word_count,
          char_count: res.record.char_count,
          target_platform: 'general',
        }).then((cloudRec) => {
          if (cloudRec?.id) {
            const all = getResumeVersions();
            if (all.success) {
              const updated = all.data.map((item) =>
                item.id === res.record.id ? { ...item, cloud_id: cloudRec.id, sync_status: 'synced' } : item
              );
              window.localStorage.setItem('careerpilot_resume_versions', JSON.stringify(updated));
              loadResumeVersions();
            }
          }
        }).catch((err) => {
          console.warn('Could not auto-sync new version to cloud:', err);
        });
      }

      loadResumeVersions();
      setNewVersionName('');
      setIsSaveVersionBoxOpen(false);
      setVersionSuccessMsg(`✓ Saved version "${res.record.name}" successfully.`);
      setTimeout(() => setVersionSuccessMsg(''), 4000);
    } else {
      setVersionActionError(res.message || 'Failed to save version.');
    }
  }

  function handleLoadVersion(version) {
    if (isTextEdited) {
      const confirmLoad = window.confirm(
        `Replace current editor text with version "${version.name}"? Any unsaved edits will be replaced.`
      );
      if (!confirmLoad) return;
    }

    setWorkingResumeText(version.resume_text);
    setOriginalExtractedText(version.resume_text);
    setFileTypeConfirmed('Saved Version');
    setComparisonResult(null);
    setIsVersionsModalOpen(false);
    setVersionSuccessMsg(`✓ Loaded version "${version.name}" into editor.`);
    setTimeout(() => setVersionSuccessMsg(''), 4000);
  }

  function handleStartRenameVersion(version) {
    setEditingVersionId(version.id);
    setRenameVersionInput(version.name);
    setVersionActionError('');
  }

  async function handleSaveRenameVersion(id) {
    setVersionActionError('');
    if (!renameVersionInput.trim()) {
      setVersionActionError('Version name cannot be empty.');
      return;
    }

    const version = resumeVersions.find((v) => v.id === id);
    const newName = renameVersionInput.trim();
    const res = renameResumeVersion(id, newName);
    if (res.success) {
      loadResumeVersions();
      setEditingVersionId(null);
      setRenameVersionInput('');
      setVersionActionError('');

      if (version?.cloud_id && supabaseConfigured && userSession) {
        try {
          await supabase.resumes.updateVersion(version.cloud_id, { name: newName });
        } catch (err) {
          console.warn('Failed to update version name in cloud:', err);
        }
      }
    } else {
      setVersionActionError(res.message || 'Failed to rename version.');
    }
  }

  async function handleDeleteVersion(id, name) {
    const confirmed = window.confirm(
      `Are you sure you want to delete resume version "${name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    const version = resumeVersions.find((v) => v.id === id);
    const res = deleteResumeVersion(id);
    if (res.success) {
      loadResumeVersions();
      if (editingVersionId === id) {
        setEditingVersionId(null);
      }

      if (version?.cloud_id && supabaseConfigured && userSession) {
        try {
          await supabase.resumes.deleteVersion(version.cloud_id);
        } catch (err) {
          console.warn('Failed to delete version from cloud:', err);
        }
      }
    } else {
      alert(res.message || 'Failed to delete version.');
    }
  }

  // ── Supabase Auth & Cloud Sync Handlers ─────────────────────────────────────
  async function handleAuthSignUp(e) {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter both an email and password.');
      return;
    }
    if (authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const res = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword.trim(),
      });
      if (res.session) {
        setUserSession(res.session);
        setAuthSuccessMsg('✓ Account created and signed in successfully!');
        setTimeout(() => setIsAuthModalOpen(false), 1200);
      } else {
        setAuthSuccessMsg('✓ Account created! Please check your email or sign in.');
        setAuthMode('signin');
      }
    } catch (err) {
      setAuthError(err.message || 'Failed to sign up.');
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleAuthSignIn(e) {
    if (e) e.preventDefault();
    setAuthError('');
    setAuthSuccessMsg('');
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Please enter both an email and password.');
      return;
    }

    setIsAuthLoading(true);
    try {
      const res = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword.trim(),
      });
      setUserSession(res.session);
      setAuthSuccessMsg('✓ Signed in successfully!');
      setTimeout(() => setIsAuthModalOpen(false), 1000);
      loadCloudVersionsToDevice({ client: supabase }).then((loadRes) => {
        if (loadRes.success && loadRes.importedCount > 0) {
          loadResumeVersions();
        }
      });
    } catch (err) {
      setAuthError(err.message || 'Invalid email or password.');
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleAuthSignOut() {
    setIsAuthLoading(true);
    try {
      await supabase.auth.signOut();
      setUserSession(null);
      setAuthSuccessMsg('');
      setAuthError('');
      setIsAuthModalOpen(false);
    } catch (err) {
      setAuthError(err.message || 'Failed to sign out.');
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleSyncToCloud() {
    if (!supabaseConfigured) {
      setIsAuthModalOpen(true);
      return;
    }
    if (!userSession) {
      setIsAuthModalOpen(true);
      setAuthMode('signin');
      return;
    }

    setIsSyncingCloud(true);
    setSyncProgress(null);
    setSyncResultMsg('');

    try {
      const result = await syncLocalVersionsToCloud({
        client: supabase,
        onProgress: (prog) => {
          setSyncProgress(prog);
        },
      });

      if (result.success) {
        setSyncResultMsg(`✓ Synced ${result.syncedCount} new version(s) to cloud (${result.existingCount} already up to date).`);
      } else {
        setSyncResultMsg(`⚠️ Sync completed: ${result.syncedCount} synced, ${result.failedCount} failed.`);
      }
      loadResumeVersions();
    } catch (err) {
      setSyncResultMsg(`Sync error: ${err.message}`);
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => {
        setSyncProgress(null);
      }, 4000);
    }
  }

  async function handleDeleteAllCloudResumes() {
    if (!window.confirm('Are you sure you want to delete all resume versions from your Supabase cloud storage? Your local versions on this browser will not be deleted.')) {
      return;
    }
    setIsAuthLoading(true);
    try {
      await supabase.resumes.deleteAll();
      const local = getResumeVersions();
      if (local.success && local.data) {
        const updated = local.data.map((v) => ({ ...v, sync_status: 'local', cloud_id: null }));
        window.localStorage.setItem('careerpilot_resume_versions', JSON.stringify(updated));
        loadResumeVersions();
      }
      setAuthSuccessMsg('✓ All cloud resume versions deleted successfully.');
      setTimeout(() => setAuthSuccessMsg(''), 4000);
    } catch (err) {
      setAuthError(`Failed to delete cloud data: ${err.message}`);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function loadCoachStatus() {
    try {
      const data = await getCoachStatus();
      setCoachStatus(data);
    } catch {
      setCoachStatus({ configured: false, message: 'Could not connect to AI coach status endpoint.' });
    }
  }

  async function handleRequestCoachFeedback() {
    setCoachError('');
    setCoachSuccessMsg('');

    if (!workingResumeText.trim()) {
      setCoachError('Resume text is empty. Please upload a resume or load a saved version first.');
      return;
    }

    setIsCoachingLoading(true);
    try {
      const data = await requestCoachFeedback(workingResumeText, coachJobDescription, coachPreset);
      setCoachCritique(data.overall_critique || '');
      setCoachSuggestions(data.suggestions || []);
      setSuggestionStatuses({});
      setCoachSuccessMsg(`✓ Received ${data.total_suggestions || data.suggestions?.length || 0} coaching suggestions.`);
      setTimeout(() => setCoachSuccessMsg(''), 4000);
    } catch (err) {
      setCoachError(err.message || 'Failed to generate coaching suggestions.');
    } finally {
      setIsCoachingLoading(false);
    }
  }

  function handleAcceptSuggestion(suggestion, customText = null) {
    const res = applySuggestionToText(workingResumeText, suggestion, customText);
    if (res.success) {
      setWorkingResumeText(res.updatedText);
      setSuggestionStatuses((prev) => ({
        ...prev,
        [suggestion.id]: customText !== null ? 'edited' : 'accepted',
      }));
      setCoachSuccessMsg(`✓ Applied suggestion to ${suggestion.section}. Resume text updated.`);
      setTimeout(() => setCoachSuccessMsg(''), 4000);
    } else {
      alert(res.reason || 'Could not apply suggestion.');
    }
  }

  function handleRejectSuggestion(suggestionId) {
    setSuggestionStatuses((prev) => ({
      ...prev,
      [suggestionId]: 'rejected',
    }));
  }

  function handleStartEditSuggestion(suggestion) {
    setEditingSuggestionId(suggestion.id);
    setEditingSuggestionText(suggestion.suggested_text);
  }

  function handleSaveEditSuggestion(suggestion) {
    if (!editingSuggestionText.trim()) {
      alert('Suggested text cannot be empty.');
      return;
    }
    handleAcceptSuggestion(suggestion, editingSuggestionText);
    setEditingSuggestionId(null);
  }

  // Resume Tailoring handlers
  async function handleRequestTailorResume() {
    setTailorError('');
    setTailorErrorStatus(null);
    setTailorSuccessMsg('');
    setTailorSavedRecord(null);

    const validation = validateTailorInputs(workingResumeText, tailorJobDescription);
    if (!validation.valid) {
      setTailorError(validation.error);
      return;
    }

    setIsTailoringLoading(true);
    try {
      const data = await requestTailorResume(workingResumeText, tailorJobDescription, tailorPreset);
      setTailorDraft(data);
      setEditedTailorText(data.tailored_resume_text || '');
      setTailorVersionNameInput(formatDefaultTailoredVersionName(tailorPreset, tailorJobDescription));
      setIsEditingTailorDraft(false);
    } catch (err) {
      setTailorError(err.message || 'Failed to generate tailored resume.');
      setTailorErrorStatus(err.status || null);
    } finally {
      setIsTailoringLoading(false);
    }
  }

  function handleAcceptTailoredDraft() {
    if (!tailorDraft) return;

    const textToSave = (editedTailorText || tailorDraft.tailored_resume_text || '').trim();
    if (!textToSave) {
      setTailorError('Cannot save an empty tailored resume.');
      return;
    }

    const versionName = (tailorVersionNameInput || '').trim() || formatDefaultTailoredVersionName(tailorPreset, tailorJobDescription);

    const res = saveResumeVersion({
      name: versionName,
      resumeText: textToSave,
    });

    if (res.success) {
      if (supabaseConfigured && userSession) {
        supabase.resumes.createVersion({
          name: res.record.name,
          resume_text: res.record.resume_text,
          word_count: res.record.word_count,
          char_count: res.record.char_count,
          target_platform: tailorPreset || 'general',
          target_role: null,
        }).then((cloudRec) => {
          if (cloudRec?.id) {
            const all = getResumeVersions();
            if (all.success) {
              const updated = all.data.map((item) =>
                item.id === res.record.id ? { ...item, cloud_id: cloudRec.id, sync_status: 'synced', target_platform: tailorPreset } : item
              );
              window.localStorage.setItem('careerpilot_resume_versions', JSON.stringify(updated));
              loadResumeVersions();
            }
          }
        }).catch((err) => {
          console.warn('Could not auto-sync tailored version to cloud:', err);
        });
      }

      loadResumeVersions();
      setTailorSavedRecord(res.record);
      setTailorSuccessMsg(`✓ Saved new version "${res.record.name}". Your original resume remains unchanged.`);
      setTailorError('');
    } else {
      setTailorError(res.message || 'Failed to save tailored resume version.');
    }
  }

  function handleDiscardTailoredDraft() {
    if (window.confirm('Discard this tailored draft? Your active resume and job description will not be affected.')) {
      setTailorDraft(null);
      setEditedTailorText('');
      setIsEditingTailorDraft(false);
      setTailorSavedRecord(null);
      setTailorSuccessMsg('');
      setTailorError('');
    }
  }

  function handleExportTailoredTxt() {
    const textToExport = (editedTailorText || tailorDraft?.tailored_resume_text || '').trim();
    if (!textToExport) return;
    try {
      exportResumeTextAsFile(textToExport);
    } catch (err) {
      alert(err.message || 'Failed to export text file.');
    }
  }

  async function handleExportTailoredDocx() {
    const textToExport = (editedTailorText || tailorDraft?.tailored_resume_text || '').trim();
    if (!textToExport) return;
    try {
      await exportResumeTextAsDocx(textToExport);
    } catch (err) {
      alert(err.message || 'Failed to export DOCX file.');
    }
  }

  function handleLoadTailoredIntoEditor() {
    const textToLoad = (editedTailorText || tailorDraft?.tailored_resume_text || '').trim();
    if (!textToLoad) return;
    setWorkingResumeText(textToLoad);
    setActiveTab('analyser');
  }

  function handleNavigateToTailor(jobDesc = '') {
    if (jobDesc) {
      setTailorJobDescription(jobDesc);
    }
    setActiveTab('tailor');
    loadCoachStatus();
  }

  function handleOpenAddJob(prefill = {}) {
    setEditingJobId(null);
    setJobFormCompany(prefill.company || '');
    setJobFormRole(prefill.role || '');
    setJobFormUrl(prefill.jobUrl || '');
    setJobFormDate(prefill.dateApplied || new Date().toISOString().slice(0, 10));
    setJobFormStatus(prefill.status || 'Applied');
    setJobFormError('');
    setIsJobFormOpen(true);
    if (activeTab !== 'tracker') {
      setActiveTab('tracker');
    }
  }

  function handleOpenEditJob(job) {
    setEditingJobId(job.id);
    setJobFormCompany(job.company || '');
    setJobFormRole(job.role || '');
    setJobFormUrl(job.job_url || '');
    setJobFormDate(job.date_applied || new Date().toISOString().slice(0, 10));
    setJobFormStatus(job.status || 'Applied');
    setJobFormError('');
    setIsJobFormOpen(true);
  }

  function handleCancelJobForm() {
    setIsJobFormOpen(false);
    setEditingJobId(null);
    setJobFormError('');
  }

  function handleSaveJobForm(e) {
    e.preventDefault();
    setJobFormError('');

    if (!jobFormCompany.trim()) {
      setJobFormError('Company name is required.');
      return;
    }

    if (!jobFormRole.trim()) {
      setJobFormError('Job role is required.');
      return;
    }

    if (editingJobId) {
      const res = updateJob(editingJobId, {
        company: jobFormCompany,
        role: jobFormRole,
        jobUrl: jobFormUrl,
        dateApplied: jobFormDate,
        status: jobFormStatus,
      });

      if (res.success) {
        loadTrackedJobs();
        setIsJobFormOpen(false);
        setEditingJobId(null);
      } else {
        setJobFormError(res.message || 'Failed to update job application.');
      }
    } else {
      const res = addJob({
        company: jobFormCompany,
        role: jobFormRole,
        jobUrl: jobFormUrl,
        dateApplied: jobFormDate,
        status: jobFormStatus,
      });

      if (res.success) {
        loadTrackedJobs();
        setIsJobFormOpen(false);
      } else {
        setJobFormError(res.message || 'Failed to add job application.');
      }
    }
  }

  function handleDeleteJob(id, company, role) {
    const confirmed = window.confirm(`Are you sure you want to delete "${role}" at ${company}?`);
    if (!confirmed) return;

    const res = deleteJob(id);
    if (res.success) {
      loadTrackedJobs();
      if (editingJobId === id) {
        handleCancelJobForm();
      }
    } else {
      alert(res.message || 'Failed to delete job.');
    }
  }

  function handleResetTrackerStorage() {
    clearJobs();
    loadTrackedJobs();
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Interested':
        return 'badge-status-interested';
      case 'Applied':
        return 'badge-status-applied';
      case 'Interviewing':
        return 'badge-status-interviewing';
      case 'Offer':
        return 'badge-status-offer';
      case 'Rejected':
        return 'badge-status-rejected';
      default:
        return 'badge-neutral';
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0] || null;
    setSelectedFile(file);
    setExtractError('');
    setExtractErrorStatus(null);

    if (file && file.size > 5 * 1024 * 1024) {
      setExtractError(`Selected file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The application limit is 5 MB.`);
      setExtractErrorStatus(413);
    }
  }

  async function handleExtract(e) {
    e.preventDefault();
    setExtractError('');
    setExtractErrorStatus(null);
    setComparisonResult(null);
    setSaveSuccessMsg('');
    setExportTxtSuccessMsg('');
    setExportTxtError('');
    setExportDocxSuccessMsg('');
    setExportDocxError('');

    if (!selectedFile) {
      setExtractError('Please select a resume file (.pdf or .docx).');
      return;
    }

    setIsExtracting(true);
    try {
      const data = await extractResumeText(selectedFile);
      setFileTypeConfirmed(data.file_type);
      setOriginalExtractedText(data.extracted_text);
      setWorkingResumeText(data.extracted_text);
    } catch (err) {
      setExtractError(err.message || 'Unable to extract text from the document.');
      setExtractErrorStatus(err.status || 500);
    } finally {
      setIsExtracting(false);
    }
  }

  function handleRestoreOriginal() {
    setWorkingResumeText(originalExtractedText);
    setCompareError('');
    setExportTxtError('');
    setExportDocxError('');
  }

  function handleCopyText() {
    if (workingResumeText) {
      navigator.clipboard.writeText(workingResumeText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  // Plain-Text Export handler (Milestone 5)
  function handleExportTxt() {
    setExportTxtError('');
    setExportTxtSuccessMsg('');

    try {
      const result = exportResumeTextAsFile(workingResumeText);
      if (result.success) {
        setExportTxtSuccessMsg('✓ Download started');
        setTimeout(() => setExportTxtSuccessMsg(''), 3000);
      }
    } catch (err) {
      setExportTxtError(err.message || 'Failed to export text.');
    }
  }

  // DOCX Export handler (Milestone 6)
  async function handleExportDocx() {
    setExportDocxError('');
    setExportDocxSuccessMsg('');

    try {
      const result = await exportResumeTextAsDocx(workingResumeText);
      if (result.success) {
        setExportDocxSuccessMsg('✓ Download started');
        setTimeout(() => setExportDocxSuccessMsg(''), 3000);
      }
    } catch (err) {
      setExportDocxError(err.message || 'Failed to export DOCX.');
    }
  }

  async function handleCompare(e) {
    e.preventDefault();
    setCompareError('');
    setComparisonResult(null);
    setSaveSuccessMsg('');

    if (!workingResumeText.trim()) {
      setCompareError('Resume text is empty. Extract or enter resume text first.');
      return;
    }

    if (!jobDescription.trim()) {
      setCompareError('Please paste a job description to compare against.');
      return;
    }

    setIsComparing(true);
    try {
      const result = await compareResumeWithJob(workingResumeText, jobDescription);
      setComparisonResult(result);
    } catch (err) {
      setCompareError(err.message || 'Comparison request failed.');
    } finally {
      setIsComparing(false);
    }
  }

  // Save comparison handler (Milestone 4)
  function handleSaveHistory(e) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccessMsg('');

    if (!saveJobTitle.trim()) {
      setSaveError('Please enter a Job Title to identify this comparison.');
      return;
    }

    const res = saveComparison({
      jobTitle: saveJobTitle,
      companyName: saveCompanyName,
      comparisonResult,
    });

    if (res.success) {
      setSaveSuccessMsg('✓ Comparison saved to your local history.');
      setSaveJobTitle('');
      setSaveCompanyName('');
      loadSavedHistory();
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } else {
      setSaveError(res.message || 'Failed to save comparison.');
    }
  }

  // Delete single history entry (Milestone 4)
  function handleDeleteHistoryItem(id) {
    const confirmed = window.confirm('Are you sure you want to delete this saved comparison?');
    if (!confirmed) return;

    const res = deleteComparison(id);
    if (res.success) {
      loadSavedHistory();
    } else {
      alert(res.message || 'Failed to delete record.');
    }
  }

  // Clear all history handler with confirmation (Milestone 4)
  function handleClearAllHistory() {
    const confirmed = window.confirm(
      'Are you sure you want to delete all saved comparisons? This action cannot be undone.'
    );
    if (!confirmed) return;

    const res = clearHistory();
    if (res.success) {
      loadSavedHistory();
    }
  }

  // Toggle card expansion in history
  function toggleExpandCard(id) {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const isTextEdited = originalExtractedText && workingResumeText !== originalExtractedText;

  /* ── Step indicator helpers ── */
  const step1Done = !!workingResumeText;
  const step2Done = !!workingResumeText;
  const step3Done = !!comparisonResult;

  function stepClass(n) {
    if (n === 1) return step1Done ? 'done' : 'active';
    if (n === 2) return step2Done ? 'done' : step1Done ? 'active' : '';
    if (n === 3) return step3Done ? 'done' : step1Done ? 'active' : '';
    if (n === 4) return step3Done ? 'active' : '';
    return '';
  }

  /* ── Score helpers ── */
  const pct = comparisonResult?.summary?.overlap_percentage ?? 0;

  /* ── Filtered Tracked Jobs ── */
  const filteredTrackedJobs = filterAndSearchJobs(trackedJobs, {
    statusFilter: jobStatusFilter,
    searchQuery: jobSearch,
  });

  return (
    <>
      {/* ══ Top Navigation ══ */}
      <nav className="nav" aria-label="Main navigation">
        <div className="nav-inner">
          <div className="nav-brand">
            <div className="nav-logo-mark">
              <IconLogo />
            </div>
            <span className="nav-wordmark">CareerPilot<em>AI</em></span>
          </div>

          <div className="nav-tabs" role="tablist" aria-label="Main views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analyser'}
              className={`nav-tab ${activeTab === 'analyser' ? 'active' : ''}`}
              onClick={() => setActiveTab('analyser')}
            >
              Resume Analyser
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tracker'}
              className={`nav-tab ${activeTab === 'tracker' ? 'active' : ''}`}
              onClick={() => setActiveTab('tracker')}
            >
              <IconBriefcase />
              Job Tracker
              {trackedJobs.length > 0 && (
                <span className="nav-tab-badge">{trackedJobs.length}</span>
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'coach'}
              className={`nav-tab ${activeTab === 'coach' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('coach');
                loadCoachStatus();
              }}
            >
              <IconSparkles />
              AI Resume Coach
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tailor'}
              className={`nav-tab ${activeTab === 'tailor' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('tailor');
                loadCoachStatus();
              }}
            >
              <IconWand />
              Tailor Resume to Job
            </button>
          </div>

          <div className="nav-right">
            {/* Supabase Cloud Sync / Account button */}
            {userSession ? (
              <button
                type="button"
                className="btn-nav user-account-pill"
                onClick={() => {
                  setIsAuthModalOpen(true);
                  setAuthMode('account');
                }}
                title={`Signed in as ${userSession.user?.email || 'user'}`}
                aria-label={`Account (${userSession.user?.email || 'user'})`}
              >
                <IconUser />
                <span className="user-email-truncate">{userSession.user?.email}</span>
                <span className="sync-dot-online" title="Cloud sync active" />
              </button>
            ) : (
              <button
                type="button"
                className="btn-nav-icon"
                onClick={() => {
                  setIsAuthModalOpen(true);
                  setAuthMode('signin');
                }}
                title={supabaseConfigured ? 'Sign in to sync resumes across devices' : 'Cloud Sync (Unconfigured)'}
                aria-label={supabaseConfigured ? 'Sign in to sync resumes across devices' : 'Cloud Sync (Unconfigured)'}
              >
                <IconCloud />
              </button>
            )}

            <button
              type="button"
              className="btn-nav"
              onClick={verifyBackend}
              aria-label="Refresh backend connection status"
              title="Refresh connection status"
            >
              <IconRefresh />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ══ Page Header ══ */}
      <div className="page-header">
        <div className="page-header-inner">
          {activeTab === 'analyser' && (
            <>
              <h1>Resume keyword analyser</h1>
              <p>
                Upload your resume, paste a job description, and instantly see which
                supported technical keywords match — entirely on your machine, privately.
              </p>
            </>
          )}
          {activeTab === 'tracker' && (
            <>
              <h1>Job Application Tracker</h1>
              <p>
                Manage your target companies, roles, application dates, and interview status —
                stored 100% privately in local storage.
              </p>
            </>
          )}
          {activeTab === 'coach' && (
            <>
              <h1>AI Resume Coach</h1>
              <p>
                Actionable, section-by-section suggestions to improve your resume — with full
                user control, platform presets, and zero hallucinated facts.
              </p>
            </>
          )}
          {activeTab === 'tailor' && (
            <>
              <h1>Tailor Resume to Job</h1>
              <p>
                Generate an evidence-grounded, role-tailored resume draft. Inspect changed sections,
                review unevidenced requirements, edit the draft, and save it as a new version.
              </p>
            </>
          )}
        </div>
      </div>

      {/* ══ Workspace ══ */}
      {activeTab === 'analyser' && (
        <div className="workspace">

        {/* ── Main column ── */}
        <main className="workspace-main">

          {/* Step indicator */}
          <div className="steps" aria-label="Workflow steps" role="list">
            <div className={`step ${stepClass(1)}`} role="listitem">
              <span className="step-num">{step1Done ? <IconCheck /> : '1'}</span>
              Upload
            </div>
            <div className="step-line" />
            <div className={`step ${stepClass(2)}`} role="listitem">
              <span className="step-num">{step2Done ? <IconCheck /> : '2'}</span>
              Review
            </div>
            <div className="step-line" />
            <div className={`step ${stepClass(3)}`} role="listitem">
              <span className="step-num">{step3Done ? <IconCheck /> : '3'}</span>
              Compare
            </div>
            <div className="step-line" />
            <div className={`step ${stepClass(4)}`} role="listitem">
              <span className="step-num">4</span>
              Results
            </div>
          </div>

          {/* ── Step 1: Upload ── */}
          <div className="card card-upload" aria-labelledby="s1-title">
            <div className="card-body">
              <div style={{ marginBottom: '20px' }}>
                <p className="section-eyebrow">Step 1</p>
                <h2 id="s1-title" className="section-title">Upload your resume</h2>
                <p className="section-desc">
                  PDF or DOCX · max 5 MB · text extracted in-memory, never saved to disk
                </p>
              </div>

              <form onSubmit={handleExtract}>
                {/* Drop zone */}
                <label
                  className={`upload-zone${selectedFile ? ' has-file' : ''}`}
                  htmlFor="resume-file"
                  aria-label="Upload resume file"
                >
                  <div className="upload-icon">
                    <IconUpload />
                  </div>

                  {selectedFile ? (
                    <>
                      <span className="upload-primary-text" style={{ color: 'var(--brand)' }}>
                        File selected
                      </span>
                      <span className="upload-file-name">
                        <IconFile />
                        {selectedFile.name}
                      </span>
                      <span className="upload-secondary-text">
                        {(selectedFile.size / 1024).toFixed(0)} KB · Click to change
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="upload-primary-text">
                        Click to select, or drag &amp; drop
                      </span>
                      <span className="upload-secondary-text">PDF or DOCX · Max 5 MB</span>
                    </>
                  )}

                  <input
                    id="resume-file"
                    type="file"
                    className="sr-only"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                  />
                </label>

                {extractError && (
                  <div className="alert alert-danger" role="alert" style={{ marginTop: '14px' }}>
                    <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div>
                      <strong>
                        {extractErrorStatus === 413 && 'Upload limit exceeded: '}
                        {extractErrorStatus === 415 && 'Unsupported format: '}
                        {extractErrorStatus === 422 && 'Unreadable document: '}
                        {(!extractErrorStatus || extractErrorStatus >= 500) && 'Error: '}
                      </strong>
                      {extractError}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg"
                    disabled={isExtracting || !selectedFile || backendStatus === 'disconnected'}
                  >
                    {isExtracting ? (
                      <><span className="spinner" />Extracting text…</>
                    ) : (
                      'Extract Resume Text'
                    )}
                  </button>
                  {backendStatus === 'disconnected' && (
                    <span style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 500 }}>
                      Backend offline — start the server on port 8000
                    </span>
                  )}
                </div>

                {resumeVersions.length > 0 && !workingResumeText && (
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>
                      Have a previously saved resume version?
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsVersionsModalOpen(true)}
                    >
                      Browse saved versions ({resumeVersions.length})
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* ── Step 2: Review & Edit ── */}
          {workingResumeText && (
            <div className="card" aria-labelledby="s2-title">
              <div className="card-body">
                <div className="section-header">
                  <div>
                    <p className="section-eyebrow">Step 2</p>
                    <h2 id="s2-title" className="section-title" style={{ marginBottom: 0 }}>
                      Review &amp; edit
                    </h2>
                    <p className="section-desc" style={{ marginBottom: 0 }}>
                      The comparison uses this working copy. Edit to fix OCR artefacts or add missing context.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    {fileTypeConfirmed && (
                      <span className="badge badge-brand">{fileTypeConfirmed}</span>
                    )}
                    {isTextEdited && (
                      <span className="badge badge-warning">Edited</span>
                    )}
                  </div>
                </div>

                <textarea
                  id="resume-text"
                  className="form-control mono"
                  rows={12}
                  value={workingResumeText}
                  onChange={(e) => setWorkingResumeText(e.target.value)}
                  aria-label="Extracted resume text — editable"
                />

                {/* Toolbar */}
                <div className="toolbar">
                  {isTextEdited && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleRestoreOriginal}
                    >
                      Restore original
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyText}
                  >
                    {copySuccess ? '✓ Copied!' : 'Copy text'}
                  </button>
                  <div className="toolbar-sep" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!workingResumeText.trim()}
                    onClick={handleExportTxt}
                    title="Export as plain text"
                  >
                    {exportTxtSuccessMsg || 'Export .txt'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={!workingResumeText.trim()}
                    onClick={handleExportDocx}
                    title="Export as Word document"
                  >
                    {exportDocxSuccessMsg || 'Export .docx'}
                  </button>
                  <div className="toolbar-sep" />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!workingResumeText.trim()}
                    onClick={() => {
                      setIsSaveVersionBoxOpen((prev) => !prev);
                      setVersionActionError('');
                    }}
                    title="Explicitly save this text as a named version"
                  >
                    Save as version
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsVersionsModalOpen(true)}
                    title="Manage saved resume versions"
                  >
                    Saved versions {resumeVersions.length > 0 ? `(${resumeVersions.length})` : ''}
                  </button>
                  <div className="toolbar-sep" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--brand)', fontWeight: 600 }}
                    onClick={() => {
                      setActiveTab('coach');
                      loadCoachStatus();
                    }}
                    title="Open AI Resume Coach with this resume text"
                  >
                    <IconSparkles /> AI Coach
                  </button>
                </div>

                {/* Inline Save Version Box */}
                {isSaveVersionBoxOpen && (
                  <div className="version-save-box" style={{ marginTop: '14px' }}>
                    <div className="version-save-heading">Save resume version</div>
                    <div className="version-save-desc">
                      Save this working copy under a custom name to quickly reload or compare later.
                      Stored only in this browser's local storage.
                    </div>
                    <form onSubmit={handleSaveCurrentVersion}>
                      <div className="version-save-row">
                        <input
                          type="text"
                          className="form-control"
                          style={{ flex: '1 1 220px' }}
                          placeholder="e.g. SRE Tailored v2, Frontend Lead"
                          value={newVersionName}
                          onChange={(e) => setNewVersionName(e.target.value)}
                          autoFocus
                        />
                        <button type="submit" className="btn btn-primary btn-sm">
                          Save Version
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setIsSaveVersionBoxOpen(false);
                            setVersionActionError('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                      {versionActionError && (
                        <p className="inline-error" role="alert" style={{ marginTop: '8px' }}>
                          {versionActionError}
                        </p>
                      )}
                    </form>
                  </div>
                )}

                {versionSuccessMsg && (
                  <p className="inline-success" role="status" style={{ marginTop: '10px' }}>
                    {versionSuccessMsg}
                  </p>
                )}

                {/* Export error */}
                {(exportTxtError || exportDocxError) && (
                  <p className="inline-error" role="alert">
                    {exportTxtError || exportDocxError}
                  </p>
                )}

                {/* Export notice */}
                <div className="alert alert-brand" style={{ marginTop: '14px' }}>
                  <IconInfo />
                  <span>
                    <strong>Export notice:</strong> Both .txt and .docx generation run entirely in
                    your browser — your resume text is never sent over the network. The .docx output
                    is a clean single-column document; original layout, images, and multi-column
                    designs are not recreated. Always review before submitting.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Compare ── */}
          {workingResumeText && (
            <div className="card" aria-labelledby="s3-title">
              <div className="card-body">
                <p className="section-eyebrow">Step 3</p>
                <h2 id="s3-title" className="section-title">Compare to job description</h2>
                <p className="section-desc" style={{ marginBottom: '20px' }}>
                  Paste the full job posting. We scan for supported technical terms using a
                  deterministic dictionary — no AI inference, no guessing.
                </p>

                <form onSubmit={handleCompare}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="job-description">
                      Job description text
                    </label>
                    <textarea
                      id="job-description"
                      className="form-control"
                      rows={7}
                      placeholder="Paste the full job posting or requirements section here…"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  </div>

                  {compareError && (
                    <div className="alert alert-danger" role="alert" style={{ marginBottom: '14px' }}>
                      <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <div><strong>Error:</strong> {compareError}</div>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isComparing || !jobDescription.trim() || backendStatus === 'disconnected'}
                  >
                    {isComparing ? (
                      <><span className="spinner" />Analysing…</>
                    ) : (
                      'Run comparison'
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Step 4: Results ── */}
          {comparisonResult && (
            <div className="card card-results" aria-labelledby="s4-title">
              <div className="card-body">
                <p className="section-eyebrow">Step 4</p>
                <h2 id="s4-title" className="section-title" style={{ marginBottom: '20px' }}>
                  Analysis results
                </h2>

                {/* Score block */}
                <div className="score-block">
                  <div className="score-ring" aria-label={`${pct} percent match`}>
                    <span className="score-ring-pct">{pct}%</span>
                    <span className="score-ring-label">match</span>
                  </div>
                  <div className="score-detail">
                    <div className="score-fraction">
                      {comparisonResult.summary.supported_terms_found_count}
                      <span className="of">of</span>
                      {comparisonResult.summary.total_supported_job_terms}
                    </div>
                    <div className="score-sublabel">supported terms detected in your resume</div>
                    <div className="score-calc">
                      {comparisonResult.summary.calculation_explanation}
                    </div>
                  </div>
                </div>

                {/* Coverage / disclaimer */}
                <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                  <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <div>
                    <strong>Scope:</strong> {comparisonResult.coverage_notice}
                    <span style={{ display: 'block', marginTop: '3px', fontSize: '12px', opacity: 0.85 }}>
                      {comparisonResult.summary.disclaimer}
                    </span>
                  </div>
                </div>

                {/* Zero terms */}
                {comparisonResult.summary.total_supported_job_terms === 0 && (
                  <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
                    <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    <div>
                      <strong>No supported dictionary terms found</strong> in this job description.
                      The posting may use different terminology or fall outside our current dictionary scope.
                    </div>
                  </div>
                )}

                {/* Matched terms */}
                {comparisonResult.matched_terms.length > 0 && (
                  <div className="terms-section">
                    <div className="terms-label matched">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Matched terms ({comparisonResult.matched_terms.length})
                    </div>
                    <div className="tag-cloud">
                      {comparisonResult.matched_terms.map((item, idx) => (
                        <span key={idx} className="matched-tag">
                          {item.term}
                          <span className="counts">
                            {item.occurrences_in_resume}r&nbsp;/&nbsp;{item.occurrences_in_job}j
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing terms */}
                {comparisonResult.missing_terms.length > 0 && (
                  <div className="terms-section">
                    <div className="terms-label missing">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Missing terms ({comparisonResult.missing_terms.length})
                    </div>
                    <div className="missing-row">
                      {comparisonResult.missing_terms.map((item, idx) => (
                        <div key={idx} className="missing-item">
                          <span className="missing-item-term">{item.term}</span>
                          <span className="missing-item-count">
                            mentioned {item.occurrences_in_job}× in job
                          </span>
                          <p className="missing-item-guidance">{item.guidance}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Save to history */}
                <div className="save-section">
                  <h3 className="save-heading">Save to local history</h3>
                  <p className="save-desc">
                    Only job title, company, date, and term lists are saved — your resume and job
                    description text are never persisted.
                  </p>
                  <form onSubmit={handleSaveHistory}>
                    <div className="save-row">
                      <div className="save-field">
                        <div className="form-group">
                          <label className="form-label" htmlFor="save-job-title">
                            Job title <span style={{ color: 'var(--danger)', fontWeight: 400 }}>*</span>
                          </label>
                          <input
                            id="save-job-title"
                            type="text"
                            className="form-control"
                            placeholder="e.g. Backend Engineer"
                            value={saveJobTitle}
                            onChange={(e) => setSaveJobTitle(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="save-field">
                        <div className="form-group">
                          <label className="form-label" htmlFor="save-company">
                            Company <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(optional)</span>
                          </label>
                          <input
                            id="save-company"
                            type="text"
                            className="form-control"
                            placeholder="e.g. Acme Corp"
                            value={saveCompanyName}
                            onChange={(e) => setSaveCompanyName(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        style={{ alignSelf: 'flex-end', marginBottom: '0', flexShrink: 0 }}
                      >
                        Save
                      </button>
                    </div>

                    {saveError && (
                      <p className="inline-error" role="alert" style={{ marginTop: '8px' }}>
                        {saveError}
                      </p>
                    )}
                    {saveSuccessMsg && (
                      <p className="inline-success" role="status" style={{ marginTop: '8px' }}>
                        {saveSuccessMsg}
                      </p>
                    )}
                  </form>

                  <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                      Want a full evidence-grounded resume draft tailored to this job?
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleNavigateToTailor(jobDescription)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <IconWand />
                      Tailor Resume for this Job →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ── Sidebar: History ── */}
        <aside className="workspace-sidebar">
          <div className="history-card" aria-labelledby="history-title">

            <div className="history-card-header">
              <div className="history-card-title">
                <IconHistory />
                <span id="history-title">History</span>
                <span className="history-count">{historyItems.length}</span>
              </div>
              {historyItems.length > 0 && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleClearAllHistory}
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="history-privacy">
              History is stored only in this browser's local storage. No data is synced to a
              server or cloud database.
            </div>

            {/* Corrupted storage */}
            {historyError && (
              <div className="alert alert-danger" role="alert" style={{ margin: '12px 20px' }}>
                <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div>
                  <strong>Storage error:</strong> {historyError}
                  <br />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '8px' }}
                    onClick={() => { clearHistory(); loadSavedHistory(); }}
                  >
                    Reset storage
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {historyItems.length === 0 && !historyError && (
              <div className="history-empty">
                <div className="history-empty-icon">
                  <IconHistory />
                </div>
                <p style={{ fontWeight: 600, color: 'var(--color-text-2)', marginBottom: '4px' }}>
                  No saved comparisons
                </p>
                <p>
                  Run a comparison and click&nbsp;<strong>Save</strong> to track your job targets here.
                </p>
              </div>
            )}

            {/* History list */}
            {historyItems.length > 0 && (
              <div className="history-list">
                {historyItems.map((item) => {
                  const isExpanded = expandedCardIds.has(item.id);
                  return (
                    <div key={item.id} className="history-item">
                      <div className="history-item-top">
                        <div>
                          <div className="history-item-title">{item.job_title}</div>
                          {item.company_name && (
                            <div className="history-item-company">{item.company_name}</div>
                          )}
                          <div className="history-item-date">
                            {new Date(item.created_at).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </div>
                        </div>
                        <span className="history-item-score">
                          {item.summary.overlap_percentage}%
                        </span>
                      </div>

                      <div className="history-item-actions">
                        <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                          {item.summary.supported_terms_found_count}/{item.summary.total_supported_job_terms} terms
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleExpandCard(item.id)}
                          aria-expanded={isExpanded}
                          style={{ padding: '4px 8px' }}
                        >
                          {isExpanded ? 'Hide' : 'Details'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '4px 8px', color: 'var(--brand)' }}
                          onClick={() => handleOpenAddJob({ company: item.company_name, role: item.job_title })}
                          title="Track this role in Job Tracker"
                        >
                          Track
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            color: 'var(--danger)',
                            background: 'transparent',
                            border: '1px solid var(--danger-border)',
                            padding: '4px 8px',
                          }}
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          aria-label={`Delete ${item.job_title}`}
                        >
                          ×
                        </button>
                      </div>

                      {/* Expanded breakdown */}
                      {isExpanded && (
                        <div className="history-expanded">
                          {item.matched_terms?.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <div className="history-expanded-heading matched">
                                Matched ({item.matched_terms.length})
                              </div>
                              <div className="tag-cloud">
                                {item.matched_terms.map((m, idx) => (
                                  <span key={idx} className="badge badge-success" style={{ fontSize: '11px' }}>
                                    {m.term}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {item.missing_terms?.length > 0 && (
                            <div>
                              <div className="history-expanded-heading missing">
                                Missing ({item.missing_terms.length})
                              </div>
                              <div className="tag-cloud">
                                {item.missing_terms.map((m, idx) => (
                                  <span key={idx} className="badge badge-danger" style={{ fontSize: '11px' }}>
                                    {m.term}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

      </div>
      )}

      {/* ══ Job Tracker Workspace ══ */}
      {activeTab === 'tracker' && (
        <div className="tracker-workspace">
          {/* Top Toolbar: Search + Add Button */}
          <div className="tracker-toolbar">
            <div className="tracker-search-wrap">
              <span className="tracker-search-icon">
                <IconSearch />
              </span>
              <input
                type="text"
                className="tracker-search-input"
                placeholder="Search by company or role…"
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                aria-label="Search jobs by company or role"
              />
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenAddJob()}
            >
              <IconPlus /> Add Job
            </button>
          </div>

          {/* Status Filter Pills */}
          <div className="tracker-filters" role="group" aria-label="Filter jobs by status">
            {['All', ...JOB_STATUSES].map((status) => {
              const count = status === 'All'
                ? trackedJobs.length
                : trackedJobs.filter((j) => j.status === status).length;
              return (
                <button
                  key={status}
                  type="button"
                  className={`filter-pill ${jobStatusFilter === status ? 'active' : ''}`}
                  onClick={() => setJobStatusFilter(status)}
                >
                  {status}
                  <span className="filter-pill-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Add / Edit Form Card */}
          {isJobFormOpen && (
            <div className="card tracker-form-card" aria-labelledby="tracker-form-title">
              <div className="card-body">
                <div className="section-header" style={{ marginBottom: '16px' }}>
                  <div>
                    <h3 id="tracker-form-title" className="section-title">
                      {editingJobId ? 'Edit Job Entry' : 'Add New Job'}
                    </h3>
                    <p className="section-desc">
                      Track your application privately in this browser's local storage.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleCancelJobForm}
                    aria-label="Cancel editing"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveJobForm}>
                  <div className="tracker-form-grid">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="job-company">
                        Company <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        id="job-company"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Google, Amazon, Acme"
                        value={jobFormCompany}
                        onChange={(e) => setJobFormCompany(e.target.value)}
                        autoFocus
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="job-role">
                        Role / Title <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        id="job-role"
                        type="text"
                        className="form-control"
                        placeholder="e.g. Cloud Support Engineer"
                        value={jobFormRole}
                        onChange={(e) => setJobFormRole(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="job-status">
                        Status <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <select
                        id="job-status"
                        className="form-control"
                        value={jobFormStatus}
                        onChange={(e) => setJobFormStatus(e.target.value)}
                      >
                        {JOB_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="job-date">
                        Date Applied
                      </label>
                      <input
                        id="job-date"
                        type="date"
                        className="form-control"
                        value={jobFormDate}
                        onChange={(e) => setJobFormDate(e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                      <label className="form-label" htmlFor="job-url">
                        Job Posting URL <span style={{ color: 'var(--color-text-3)', fontWeight: 400 }}>(optional)</span>
                      </label>
                      <input
                        id="job-url"
                        type="url"
                        className="form-control"
                        placeholder="https://example.com/careers/job-123"
                        value={jobFormUrl}
                        onChange={(e) => setJobFormUrl(e.target.value)}
                      />
                    </div>
                  </div>

                  {jobFormError && (
                    <p className="inline-error" role="alert" style={{ marginBottom: '14px' }}>
                      {jobFormError}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button type="submit" className="btn btn-primary">
                      {editingJobId ? 'Save Changes' : 'Add Job'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelJobForm}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Corrupted storage notification */}
          {trackerError && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: '20px' }}>
              <IconInfo />
              <div>
                <strong>Job tracker storage error:</strong> {trackerError}
                <br />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '8px' }}
                  onClick={handleResetTrackerStorage}
                >
                  Reset Tracker Storage
                </button>
              </div>
            </div>
          )}

          {/* Empty state: No tracked jobs at all */}
          {trackedJobs.length === 0 && !trackerError && (
            <div className="tracker-empty-card">
              <div className="tracker-empty-icon">
                <IconBriefcase />
              </div>
              <h3 className="tracker-empty-title">No tracked jobs yet</h3>
              <p className="tracker-empty-desc">
                Organize your job search in one place. Keep track of interested roles, applications submitted,
                interviews, and offers — stored only in this browser.
              </p>
              {!isJobFormOpen && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleOpenAddJob()}
                >
                  <IconPlus /> Add your first job
                </button>
              )}
            </div>
          )}

          {/* Filtered empty state: Jobs exist, but no matches */}
          {trackedJobs.length > 0 && filteredTrackedJobs.length === 0 && (
            <div className="tracker-empty-card" style={{ padding: '36px 20px' }}>
              <h3 className="tracker-empty-title">No matching jobs found</h3>
              <p className="tracker-empty-desc" style={{ marginBottom: '14px' }}>
                No jobs match status "{jobStatusFilter}"
                {jobSearch.trim() ? ` or query "${jobSearch}"` : ''}.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setJobStatusFilter('All');
                  setJobSearch('');
                }}
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Jobs List */}
          {filteredTrackedJobs.length > 0 && (
            <div className="jobs-list" role="list" aria-label="Tracked jobs">
              {filteredTrackedJobs.map((job) => (
                <div key={job.id} className="job-card" role="listitem">
                  <div className="job-info">
                    <div className="job-header-row">
                      <span className="job-company">{job.company}</span>
                      <span className={`badge ${getStatusBadgeClass(job.status)}`}>
                        {job.status}
                      </span>
                    </div>

                    <div className="job-role">{job.role}</div>

                    <div className="job-meta-row">
                      <span className="job-meta-item">
                        <IconCalendar />
                        {job.date_applied ? `Applied: ${job.date_applied}` : 'Recently added'}
                      </span>

                      {job.job_url && (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="job-link"
                          title="Open job URL in new tab"
                        >
                          <IconExternalLink />
                          Posting link
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="job-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenEditJob(job)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteJob(job.id, job.company, job.role)}
                      aria-label={`Delete ${job.role} at ${job.company}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ AI Resume Coach Workspace ══ */}
      {activeTab === 'coach' && (
        <div className="coach-workspace">
          {/* Provider Configuration Banner */}
          {!coachStatus.configured ? (
            <div className="coach-config-banner" role="region" aria-label="AI Coach Configuration Warning">
              <div className="coach-config-header">
                <span className="coach-config-title">
                  <IconInfo />
                  AI Provider Not Configured
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={loadCoachStatus}
                >
                  Re-check Status
                </button>
              </div>
              <p className="coach-config-desc">
                {coachStatus.message ||
                  'The AI Resume Coach requires an active AI provider API key on the backend to generate live personalized coaching.'}
              </p>
              <div className="coach-setup-steps">
                <strong>To enable live AI suggestions:</strong>
                <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  <li>
                    Set your environment variable: <code>export GEMINI_API_KEY="your-gemini-key"</code>
                  </li>
                  <li>Or set it in a <code>.env</code> file in the <code>backend/</code> directory.</li>
                  <li>Restart the FastAPI backend server.</li>
                </ol>
                <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#78350f' }}>
                  * CareerPilot AI does not use fake or canned AI responses. When configured, requests are sent directly to the official provider from the backend.
                </div>
              </div>
            </div>
          ) : coachSuggestions.length > 0 ? (
            <div className="coach-connected-banner success">
              <div className="coach-connected-info">
                <span className="dot dot-connected" style={{ width: 8, height: 8 }} />
                <span>
                  <strong>Coaching Active:</strong> {coachSuggestions.length} suggestions generated using {coachStatus.model || 'Google Gemini'}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadCoachStatus}
                title="Refresh AI provider status"
              >
                Check Status
              </button>
            </div>
          ) : (
            <div className="coach-connected-banner configured">
              <div className="coach-connected-info">
                <span className="dot dot-connected" style={{ width: 8, height: 8 }} />
                <span>
                  <strong>API Key Configured:</strong> {coachStatus.provider === 'google_gemini' ? 'Google Gemini' : (coachStatus.provider || 'AI Provider')} ({coachStatus.model || 'gemini-3.1-flash-lite'}) • Ready to analyze
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadCoachStatus}
                title="Refresh AI provider status"
              >
                Check Status
              </button>
            </div>
          )}

          {/* Coach Request Controls Card */}
          <div className="coach-input-card">
            <div className="coach-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 className="coach-card-title">Configure Coaching Request</h2>
                <p className="coach-card-subtitle">
                  Select your target platform preset and optionally supply a job description to generate role-aligned improvements.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleNavigateToTailor(coachJobDescription)}
                title="Generate a full tailored resume draft for a specific job"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <IconWand />
                Tailor Resume to Job →
              </button>
            </div>

            {/* Presets */}
            <div className="coach-field-group">
              <div className="coach-field-label-row">
                <label className="coach-field-label">Target Platform Preset</label>
              </div>
              <div className="preset-selector-row">
                {COACH_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`preset-pill ${coachPreset === preset.id ? 'active' : ''}`}
                    onClick={() => setCoachPreset(preset.id)}
                    aria-pressed={coachPreset === preset.id}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <div className="preset-hint-card">
                {COACH_PRESETS.find((p) => p.id === coachPreset)?.description}
              </div>
            </div>

            {/* Target Job Description (Optional) */}
            <div className="coach-field-group">
              <div className="coach-field-label-row">
                <label htmlFor="coach-jd-input" className="coach-field-label">
                  Target Job Description <span className="optional">(optional)</span>
                </label>
                {coachJobDescription && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '12px', padding: '2px 8px' }}
                    onClick={() => setCoachJobDescription('')}
                  >
                    Clear JD
                  </button>
                )}
              </div>
              <textarea
                id="coach-jd-input"
                className="coach-textarea"
                rows="5"
                placeholder="Paste the job description or role requirements here to get tailored keyword alignment and relevant suggestions..."
                value={coachJobDescription}
                onChange={(e) => setCoachJobDescription(e.target.value)}
              />
            </div>

            {/* Resume Availability Banner */}
            {workingResumeText.trim() ? (
              <div className="coach-resume-status-box active">
                <div className="coach-resume-status-info">
                  <span className="dot dot-connected" style={{ width: 8, height: 8 }} />
                  <span>
                    <strong>Active Resume:</strong> {calculateWordCount(workingResumeText)} words loaded in editor.
                  </span>
                </div>
                <div className="coach-resume-status-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--brand)', fontWeight: 600 }}
                    onClick={() => setActiveTab('analyser')}
                  >
                    Edit in Analyser
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsVersionsModalOpen(true)}
                  >
                    Switch Version
                  </button>
                </div>
              </div>
            ) : (
              <div className="coach-resume-status-box missing">
                <div className="coach-resume-status-info">
                  <IconInfo />
                  <div>
                    <strong>No resume loaded.</strong> Upload a resume or select a saved version to get personalized coaching.
                  </div>
                </div>
                <div className="coach-resume-status-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('analyser')}
                  >
                    Upload in Analyser
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsVersionsModalOpen(true)}
                  >
                    Load Saved Version
                  </button>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="coach-action-bar">
              <div className="coach-privacy-note">
                <IconInfo />
                <span>
                  <strong>Privacy guarantee:</strong> Data is transmitted to the AI provider only when you click "Request AI Feedback". Credentials stay server-side.
                </span>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                disabled={isCoachingLoading || !workingResumeText.trim()}
                onClick={handleRequestCoachFeedback}
                style={{ minWidth: '190px' }}
              >
                {isCoachingLoading ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />
                    Generating Coaching...
                  </>
                ) : (
                  'Request AI Feedback'
                )}
              </button>
            </div>
          </div>

          {/* Feedback & Notifications */}
          {coachSuccessMsg && (
            <div className="alert alert-success" style={{ marginBottom: '20px' }}>
              {coachSuccessMsg}
            </div>
          )}
          {coachError && (
            <div className="coach-error-card" role="alert">
              <div className="coach-error-body">
                <div className="coach-error-title">
                  <IconInfo />
                  <span>Unable to Generate Coaching Suggestions</span>
                </div>
                <p className="coach-error-desc">
                  {formatProviderErrorMessage(coachError)}
                </p>
                <details className="coach-error-details">
                  <summary>View technical details</summary>
                  <code>{coachError}</code>
                </details>
              </div>
              <div className="coach-error-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleRequestCoachFeedback}
                  disabled={isCoachingLoading}
                >
                  {isCoachingLoading ? (
                    <>
                      <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
                      Retrying...
                    </>
                  ) : (
                    'Retry'
                  )}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setCoachError('')}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Overall Critique */}
          {coachCritique && (
            <div className="coach-critique-card">
              <div className="coach-critique-heading">Overall Resume Critique</div>
              <div className="coach-critique-text">{coachCritique}</div>
            </div>
          )}

          {/* Filter Bar & Suggestions */}
          {coachSuggestions.length > 0 && (
            <div>
              <div className="coach-filter-bar">
                <div className="coach-filter-group">
                  <span className="coach-filter-label">Filter by Section:</span>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'headline', label: 'Headline' },
                    { id: 'summary', label: 'Summary' },
                    { id: 'skills', label: 'Skills' },
                    { id: 'experience', label: 'Experience' },
                    { id: 'projects', label: 'Projects' },
                  ].map((filter) => {
                    const count =
                      filter.id === 'all'
                        ? coachSuggestions.length
                        : coachSuggestions.filter((s) => s.section === filter.id).length;
                    if (count === 0 && filter.id !== 'all') return null;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        className={`preset-pill ${coachSectionFilter === filter.id ? 'active' : ''}`}
                        style={{ fontSize: '12px', padding: '4px 12px' }}
                        onClick={() => setCoachSectionFilter(filter.id)}
                      >
                        {filter.label} ({count})
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                  Showing {coachSuggestions.filter((s) => coachSectionFilter === 'all' || s.section === coachSectionFilter).length} of {coachSuggestions.length} suggestions
                </div>
              </div>

              {/* Suggestion Cards */}
              <div className="suggestions-list">
                {coachSuggestions
                  .filter((s) => coachSectionFilter === 'all' || s.section === coachSectionFilter)
                  .map((suggestion) => {
                    const status = suggestionStatuses[suggestion.id] || 'pending';
                    const isEditing = editingSuggestionId === suggestion.id;

                    return (
                      <div
                        key={suggestion.id}
                        className={`suggestion-card ${status}`}
                        id={`suggestion-${suggestion.id}`}
                      >
                        <div className="suggestion-header-row">
                          <div className="suggestion-tags">
                            <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                              {suggestion.section}
                            </span>
                            <span className={`badge badge-action-${suggestion.action}`}>
                              {suggestion.action.toUpperCase()}
                            </span>
                            {status === 'accepted' && (
                              <span className="badge badge-success">✓ Applied</span>
                            )}
                            {status === 'edited' && (
                              <span className="badge badge-success">✓ Applied (Edited)</span>
                            )}
                            {status === 'rejected' && (
                              <span className="badge badge-neutral">✕ Dismissed</span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleStartEditSuggestion(suggestion)}
                                  title="Edit suggested text before applying"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRejectSuggestion(suggestion.id)}
                                  title="Dismiss suggestion without modifying resume"
                                >
                                  Reject
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleAcceptSuggestion(suggestion)}
                                  title="Apply suggestion to resume text"
                                >
                                  Accept
                                </button>
                              </>
                            )}
                            {(status === 'accepted' || status === 'edited') && (
                              <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>
                                Applied to resume
                              </span>
                            )}
                            {status === 'rejected' && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleAcceptSuggestion(suggestion)}
                              >
                                Reconsider & Accept
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Rationale */}
                        <div className="suggestion-reason">
                          <strong>Why: </strong>
                          {suggestion.reason}
                        </div>

                        {/* Inline Edit Box */}
                        {isEditing ? (
                          <div style={{ margin: '14px 0', padding: '14px', background: 'var(--gray-50)', borderRadius: 'var(--r-md)', border: '1px solid var(--color-border)' }}>
                            <label className="coach-field-label" style={{ fontSize: '12.5px', marginBottom: '8px' }}>
                              Customize suggestion before applying to resume:
                            </label>
                            <textarea
                              className="coach-textarea"
                              rows="3"
                              value={editingSuggestionText}
                              onChange={(e) => setEditingSuggestionText(e.target.value)}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setEditingSuggestionId(null)}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSaveEditSuggestion(suggestion)}
                              >
                                Apply Edit
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Diff View: Original vs. Suggested */
                          <div className="suggestion-diff-grid">
                            {suggestion.original_text ? (
                              <div className="diff-box diff-original">
                                <div className="diff-label">
                                  <span>Current Text</span>
                                </div>
                                <div>{suggestion.original_text}</div>
                              </div>
                            ) : (
                              <div className="diff-box diff-original" style={{ opacity: 0.7 }}>
                                <div className="diff-label">
                                  <span>Current Text</span>
                                </div>
                                <div style={{ fontStyle: 'italic' }}>(Not present in resume — proposed addition)</div>
                              </div>
                            )}

                            <div className="diff-box diff-suggested">
                              <div className="diff-label">
                                <span>Suggested Change</span>
                              </div>
                              <div>{suggestion.suggested_text}</div>
                            </div>
                          </div>
                        )}

                        {/* Question for user regarding missing facts */}
                        {(suggestion.question_for_user || suggestion.question) && (
                          <div className="suggestion-question-box">
                            <span style={{ fontSize: '15px' }}>💬</span>
                            <div>
                              <strong>Clarification / Missing Metric:</strong> {suggestion.question_for_user || suggestion.question}
                              <div style={{ fontSize: '11.5px', color: 'var(--gray-500)', marginTop: '2px' }}>
                                The AI coach does not invent achievements or metrics. Answer this question when editing to provide accurate real data.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Empty State when no suggestions yet */}
          {coachSuggestions.length === 0 && !isCoachingLoading && (
            <div className="coach-empty-card">
              <h3 className="coach-empty-title">AI-Powered Resume Feedback</h3>
              <p className="coach-empty-desc">
                Select your target platform preset above and click <strong>Request AI Feedback</strong> to generate structured, section-by-section suggestions for your headline, summary, skills, experience, and projects.
              </p>
              <div className="coach-empty-features">
                <div>✓ <strong>Never Hallucinates:</strong> Missing metrics are flagged as questions.</div>
                <div>✓ <strong>Full User Control:</strong> Accept, edit, or reject each suggestion.</div>
                <div>✓ <strong>Targeted Presets:</strong> General ATS, Naukri & LinkedIn formats.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Resume Tailoring Workspace ══ */}
      {activeTab === 'tailor' && (
        <div className="tailor-workspace">
          {/* Provider Configuration Banner */}
          {!coachStatus.configured ? (
            <div className="coach-config-banner" role="region" aria-label="AI Provider Configuration Warning">
              <div className="coach-config-header">
                <span className="coach-config-title">
                  <IconInfo />
                  AI Provider Not Configured
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={loadCoachStatus}
                >
                  Re-check Status
                </button>
              </div>
              <p className="coach-config-desc">
                {coachStatus.message ||
                  'Resume tailoring requires an active AI provider API key on the backend to generate job-aligned drafts.'}
              </p>
              <div className="coach-setup-steps">
                <strong>To enable live AI tailoring:</strong>
                <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                  <li>
                    Set your environment variable: <code>export GEMINI_API_KEY="your-gemini-key"</code>
                  </li>
                  <li>Or set it in a <code>.env</code> file in the <code>backend/</code> directory.</li>
                  <li>Restart the FastAPI backend server.</li>
                </ol>
                <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#78350f' }}>
                  * CareerPilot AI does not use fake or canned AI responses. When configured, requests are sent directly to the official provider from the backend.
                </div>
              </div>
            </div>
          ) : (
            <div className="coach-connected-banner configured">
              <div className="coach-connected-info">
                <span className="dot dot-connected" style={{ width: 8, height: 8 }} />
                <span>
                  <strong>API Key Configured:</strong> {coachStatus.provider === 'google_gemini' ? 'Google Gemini' : (coachStatus.provider || 'AI Provider')} ({coachStatus.model || 'gemini-3.1-flash-lite'}) • Ready to tailor
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadCoachStatus}
                title="Refresh AI provider status"
              >
                Check Status
              </button>
            </div>
          )}

          {/* Feedback & Notifications */}
          {tailorSuccessMsg && (
            <div className="alert alert-success" style={{ marginBottom: '20px' }}>
              <IconCheck />
              <div>{tailorSuccessMsg}</div>
            </div>
          )}

          {tailorError && (
            <div className="coach-error-card" role="alert">
              <div className="coach-error-body">
                <div className="coach-error-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {tailorErrorStatus === 404
                    ? 'AI Model Not Found (404)'
                    : tailorErrorStatus === 503
                    ? 'AI Provider Not Configured (503)'
                    : 'Tailoring Request Failed'}
                </div>
                <div className="coach-error-desc">
                  {tailorError}
                </div>
              </div>
              <div className="coach-error-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleRequestTailorResume}
                  disabled={isTailoringLoading}
                >
                  Retry Request
                </button>
              </div>
            </div>
          )}

          {/* If no tailored draft generated yet: Configuration & Input View */}
          {!tailorDraft ? (
            <div className="coach-input-card">
              <div className="coach-card-header">
                <h2 className="coach-card-title">Tailor Resume to Target Job</h2>
                <p className="coach-card-subtitle">
                  Paste the target job description and choose a platform preset. The AI will generate a tailored resume draft strictly grounded in your evidenced experience — without hallucinating or fabricating facts.
                </p>
              </div>

              {/* Target Platform Preset */}
              <div className="coach-field-group">
                <div className="coach-field-label-row">
                  <label className="coach-field-label">Target Platform Preset</label>
                </div>
                <div className="preset-selector-row">
                  {TAILOR_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-pill ${tailorPreset === preset.id ? 'active' : ''}`}
                      onClick={() => setTailorPreset(preset.id)}
                      aria-pressed={tailorPreset === preset.id}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
                <div className="preset-hint-card">
                  {TAILOR_PRESETS.find((p) => p.id === tailorPreset)?.description}
                </div>
              </div>

              {/* Active Resume Status */}
              {workingResumeText.trim() ? (
                <div className="coach-resume-status-box active">
                  <div className="coach-resume-status-info">
                    <span className="dot dot-connected" style={{ width: 8, height: 8 }} />
                    <span>
                      <strong>Active Resume:</strong> {calculateWordCount(workingResumeText)} words loaded in editor{selectedFile?.name ? ` (${selectedFile.name})` : ''}.
                    </span>
                  </div>
                  <div className="coach-resume-status-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--brand)', fontWeight: 600 }}
                      onClick={() => setActiveTab('analyser')}
                    >
                      Edit in Analyser
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setIsVersionsModalOpen(true)}
                    >
                      Switch Version
                    </button>
                  </div>
                </div>
              ) : (
                <div className="coach-resume-status-box missing">
                  <div className="coach-resume-status-info">
                    <IconInfo />
                    <div>
                      <strong>No resume loaded.</strong> An active resume is required to generate a tailored draft.
                    </div>
                  </div>
                  <div className="coach-resume-status-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setActiveTab('analyser')}
                    >
                      Upload in Analyser
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setIsVersionsModalOpen(true)}
                    >
                      Load Saved Version
                    </button>
                  </div>
                </div>
              )}

              {/* Target Job Description Input (REQUIRED) */}
              <div className="coach-field-group">
                <div className="coach-field-label-row">
                  <label htmlFor="tailor-jd-input" className="coach-field-label">
                    Target Job Description <span style={{ color: 'var(--danger)', fontWeight: 600 }}>*</span>
                  </label>
                  {tailorJobDescription && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '12px', padding: '2px 8px' }}
                      onClick={() => setTailorJobDescription('')}
                    >
                      Clear JD
                    </button>
                  )}
                </div>
                <textarea
                  id="tailor-jd-input"
                  className="coach-textarea"
                  rows="7"
                  placeholder="Paste the target job description or role requirements here (e.g. responsibilities, required technical skills, qualifications)..."
                  value={tailorJobDescription}
                  onChange={(e) => setTailorJobDescription(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '12px', color: 'var(--gray-500)' }}>
                  <span>Required to align your resume with target role terminology</span>
                  <span>{calculateWordCount(tailorJobDescription)} words</span>
                </div>
              </div>

              {/* Action Bar */}
              <div className="coach-action-bar">
                <div className="coach-privacy-note">
                  <IconInfo />
                  <span>
                    <strong>Evidence Guarantee:</strong> Generates a complete draft using only your evidenced facts. Any missing requirements are flagged separately.
                  </span>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isTailoringLoading || !workingResumeText.trim() || !tailorJobDescription.trim()}
                  onClick={handleRequestTailorResume}
                  style={{ minWidth: '220px' }}
                >
                  {isTailoringLoading ? (
                    <>
                      <span className="spinner" style={{ width: 14, height: 14, marginRight: 8 }} />
                      Tailoring Resume...
                    </>
                  ) : (
                    <>
                      <IconWand />
                      Generate Tailored Draft
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Review Screen: Tailored Draft Generated */
            <div>
              {/* Review Header Card */}
              <div className="tailor-review-header">
                <div className="tailor-review-meta">
                  <div className="tailor-review-title">
                    <IconWand />
                    Tailored Resume Draft (Review Mode)
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="tailor-stats-badge">
                      Target: {TAILOR_PRESETS.find((p) => p.id === tailorDraft.preset)?.name || tailorDraft.preset}
                    </span>
                    {(() => {
                      const stats = computeComparisonStats(workingResumeText, editedTailorText || tailorDraft.tailored_resume_text);
                      return (
                        <span className="tailor-stats-badge">
                          Original: {stats.originalWords} words → Draft: {stats.tailoredWords} words ({stats.wordDiff >= 0 ? `+${stats.wordDiff}` : stats.wordDiff})
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="tailor-review-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsEditingTailorDraft(!isEditingTailorDraft)}
                  >
                    {isEditingTailorDraft ? 'Preview Formatted' : 'Edit Draft Text'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAcceptTailoredDraft}
                  >
                    Accept & Save as New Version
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={handleDiscardTailoredDraft}
                  >
                    Discard Draft
                  </button>
                </div>
              </div>

              {/* Success Banner if Saved */}
              {tailorSavedRecord && (
                <div className="tailor-success-banner">
                  <div className="tailor-success-top">
                    <IconCheck />
                    Version Saved Successfully!
                  </div>
                  <div className="tailor-success-body">
                    Saved as <strong>"{tailorSavedRecord.name}"</strong> in your browser's local storage. Your original resume remains safe and untouched.
                  </div>
                  <div className="tailor-success-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleExportTailoredTxt}
                    >
                      Export Plain Text (.txt)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleExportTailoredDocx}
                    >
                      Export Word (.docx)
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleLoadTailoredIntoEditor}
                    >
                      Load into Active Editor
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setIsVersionsModalOpen(true)}
                    >
                      View All Versions
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setTailorDraft(null);
                        setTailorSavedRecord(null);
                        setTailorSuccessMsg('');
                      }}
                    >
                      Tailor Another Role
                    </button>
                  </div>
                </div>
              )}

              {/* Save as New Version Card (if not yet saved) */}
              {!tailorSavedRecord && (
                <div className="tailor-save-card">
                  <div className="tailor-save-title">Save as New Resume Version</div>
                  <div className="tailor-save-desc">
                    Accepting this draft saves it as a new independent version in your browser's local storage. It will <strong>never overwrite</strong> your active resume.
                  </div>
                  <div className="tailor-save-row">
                    <input
                      type="text"
                      className="tailor-save-input"
                      placeholder="Enter version name (e.g. Senior DevOps - Acme Corp)"
                      value={tailorVersionNameInput}
                      onChange={(e) => setTailorVersionNameInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAcceptTailoredDraft}
                    >
                      Save as New Version
                    </button>
                  </div>
                </div>
              )}

              {/* Unevidenced Requirements Box ("Not evidenced in your resume") */}
              {tailorDraft.unsupported_requirements && tailorDraft.unsupported_requirements.length > 0 && (
                <div className="tailor-unsupported-card">
                  <div className="tailor-unsupported-header">
                    <span>⚠️</span>
                    Not Evidenced in Your Resume ({tailorDraft.unsupported_requirements.length} requirement{tailorDraft.unsupported_requirements.length > 1 ? 's' : ''})
                  </div>
                  <div className="tailor-unsupported-desc">
                    The following requirements from the job description are not mentioned in your source resume. To maintain 100% factual integrity, they were <strong>NOT added</strong> to the tailored draft. Confirm whether you have this experience:
                  </div>
                  <div className="tailor-unsupported-list">
                    {tailorDraft.unsupported_requirements.map((item, idx) => (
                      <div key={idx} className="tailor-unsupported-item">
                        <div className="tailor-unsupported-item-title">
                          <span>{item.requirement}</span>
                          <span className="tailor-unsupported-badge">Missing from Resume</span>
                        </div>
                        <div className="tailor-unsupported-expl">{item.explanation}</div>
                        {item.question_to_confirm && (
                          <div className="tailor-unsupported-question">
                            💬 <strong>Clarification Question:</strong> {item.question_to_confirm}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section-by-Section Changes & Role Alignment */}
              {tailorDraft.sections_changed && tailorDraft.sections_changed.length > 0 && (
                <div className="tailor-changes-card">
                  <div className="tailor-changes-header">
                    <h3 className="tailor-changes-title">
                      Section-by-Section Adjustments ({tailorDraft.sections_changed.length} section{tailorDraft.sections_changed.length > 1 ? 's' : ''} modified)
                    </h3>
                    <p className="tailor-changes-subtitle">
                      Review how each section was reordered, focused, or reworded to match the target job description based strictly on your real experience.
                    </p>
                  </div>

                  <div className="tailor-changes-list">
                    {tailorDraft.sections_changed.map((change, idx) => (
                      <div key={idx} className="tailor-change-item">
                        <div className="tailor-change-meta">
                          <span className="tailor-change-section-badge">{change.section}</span>
                          <span className="tailor-change-expl">{change.explanation}</span>
                        </div>
                        <div className="tailor-diff-grid">
                          <div className="diff-box diff-original">
                            <div className="diff-label">
                              <span>Source Resume</span>
                            </div>
                            <div>{change.original_snippet || <span style={{ fontStyle: 'italic', opacity: 0.7 }}>(New tailored section)</span>}</div>
                          </div>
                          <div className="diff-box diff-suggested">
                            <div className="diff-label">
                              <span>Tailored Draft</span>
                            </div>
                            <div>{change.tailored_snippet}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Tailored Resume Draft Container */}
              <div className="tailor-draft-card">
                <div className="tailor-draft-topbar">
                  <div className="tailor-draft-title">
                    Complete Tailored Resume Draft
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--gray-500)' }}>
                      {calculateWordCount(editedTailorText || tailorDraft.tailored_resume_text)} words
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsEditingTailorDraft(!isEditingTailorDraft)}
                    >
                      {isEditingTailorDraft ? 'Finish Editing' : 'Edit Text in Place'}
                    </button>
                  </div>
                </div>

                {isEditingTailorDraft ? (
                  <div>
                    <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--brand)', fontWeight: 600 }}>
                      ✎ You are editing the tailored draft. Any changes made here will be saved when you accept.
                    </div>
                    <textarea
                      className="tailor-draft-editor"
                      rows="20"
                      value={editedTailorText}
                      onChange={(e) => setEditedTailorText(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="tailor-draft-preview">
                    {editedTailorText || tailorDraft.tailored_resume_text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Saved Resume Versions Modal ══ */}
      {isVersionsModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="versions-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsVersionsModalOpen(false);
              setEditingVersionId(null);
            }
          }}
        >
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 id="versions-modal-title" className="modal-title">
                <IconFile />
                Saved Resume Versions
                {resumeVersions.length > 0 && (
                  <span className="badge badge-neutral" style={{ marginLeft: '6px' }}>
                    {resumeVersions.length}
                  </span>
                )}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setIsVersionsModalOpen(false);
                  setEditingVersionId(null);
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Cloud Sync Status Banner */}
              {userSession ? (
                <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                  <IconCloudCheck />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong>Cloud Sync Active:</strong> Signed in as <code>{userSession.user?.email}</code>.
                      <div style={{ fontSize: '12px', marginTop: '2px', opacity: 0.9 }}>
                        Resumes marked "Synced" are backed up to your private Supabase account with Row Level Security.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSyncToCloud}
                      disabled={isSyncingCloud}
                    >
                      {isSyncingCloud ? 'Syncing…' : 'Sync to Account'}
                    </button>
                  </div>
                </div>
              ) : supabaseConfigured ? (
                <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                  <IconCloud />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong>Local Browser Storage:</strong> Resumes are stored on this device.
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>
                        Sign in to sync your resume library across devices with private cloud backup.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setIsAuthModalOpen(true);
                        setAuthMode('signin');
                      }}
                    >
                      Sign In to Sync
                    </button>
                  </div>
                </div>
              ) : (
                <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                  <IconInfo />
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong>Local-Only Storage:</strong> Resumes are stored only in this browser's local storage.
                      <div style={{ fontSize: '12px', marginTop: '2px' }}>
                        Configure Supabase credentials in <code>frontend/.env</code> to enable cross-device cloud sync.
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsAuthModalOpen(true)}
                    >
                      Setup Cloud Sync
                    </button>
                  </div>
                </div>
              )}

              {/* Sync Progress Indicator */}
              {isSyncingCloud && syncProgress && (
                <div className="sync-progress-box" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span>Syncing "{syncProgress.versionName}"…</span>
                    <span>{syncProgress.current} of {syncProgress.total}</span>
                  </div>
                  <div className="sync-progress-bar">
                    <div
                      className="sync-progress-fill"
                      style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {syncResultMsg && (
                <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                  <IconInfo />
                  <div>{syncResultMsg}</div>
                </div>
              )}

              {versionError && (
                <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                  <IconInfo />
                  <div><strong>Storage error:</strong> {versionError}</div>
                </div>
              )}

              {/* Filter Tabs & Quick Action */}
              {resumeVersions.length > 0 && (
                <div className="version-controls-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                  <div className="version-filter-tabs">
                    <button
                      type="button"
                      className={`version-filter-btn ${versionFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setVersionFilter('all')}
                    >
                      All ({resumeVersions.length})
                    </button>
                    <button
                      type="button"
                      className={`version-filter-btn ${versionFilter === 'synced' ? 'active' : ''}`}
                      onClick={() => setVersionFilter('synced')}
                    >
                      Synced ({resumeVersions.filter((v) => v.sync_status === 'synced' || v.cloud_id).length})
                    </button>
                    <button
                      type="button"
                      className={`version-filter-btn ${versionFilter === 'local' ? 'active' : ''}`}
                      onClick={() => setVersionFilter('local')}
                    >
                      Local Only ({resumeVersions.filter((v) => v.sync_status !== 'synced' && !v.cloud_id).length})
                    </button>
                  </div>
                  {userSession && !isSyncingCloud && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleSyncToCloud}
                      title="Sync all local versions to your Supabase account"
                    >
                      <IconCloud /> Sync Now
                    </button>
                  )}
                </div>
              )}

              {/* Empty state */}
              {resumeVersions.length === 0 && (
                <div className="tracker-empty-card" style={{ padding: '36px 20px', borderStyle: 'dashed' }}>
                  <div className="tracker-empty-icon">
                    <IconFile />
                  </div>
                  <h4 className="tracker-empty-title">No saved resume versions</h4>
                  <p className="tracker-empty-desc" style={{ marginBottom: 0 }}>
                    When reviewing or editing your resume, click <strong>Save as version</strong> to
                    keep tailored variations for different job descriptions.
                  </p>
                </div>
              )}

              {/* Versions list */}
              {resumeVersions.length > 0 && (
                <div className="versions-list" role="list" aria-label="Resume versions">
                  {resumeVersions
                    .filter((v) => {
                      if (versionFilter === 'synced') return v.sync_status === 'synced' || Boolean(v.cloud_id);
                      if (versionFilter === 'local') return v.sync_status !== 'synced' && !v.cloud_id;
                      return true;
                    })
                    .map((v) => (
                      <div key={v.id} className="version-item" role="listitem">
                        <div className="version-info">
                          {editingVersionId === v.id ? (
                            <div className="version-rename-row">
                              <input
                                type="text"
                                className="version-rename-input"
                                value={renameVersionInput}
                                onChange={(e) => setRenameVersionInput(e.target.value)}
                                autoFocus
                                aria-label="New version name"
                              />
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleSaveRenameVersion(v.id)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setEditingVersionId(null);
                                  setVersionActionError('');
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="version-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div className="version-name">{v.name}</div>
                                <span className={`sync-badge ${v.sync_status === 'synced' || v.cloud_id ? 'sync-badge-synced' : 'sync-badge-local'}`}>
                                  {v.sync_status === 'synced' || v.cloud_id ? (
                                    <>
                                      <IconCloudCheck /> Synced
                                    </>
                                  ) : (
                                    <>
                                      <IconCloud /> Local Only
                                    </>
                                  )}
                                </span>
                                {v.target_platform && v.target_platform !== 'general' && (
                                  <span className="badge badge-platform">{v.target_platform}</span>
                                )}
                              </div>
                              <div className="version-meta">
                                <span>
                                  {new Date(v.created_at).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                                <span>·</span>
                                <span>{v.word_count || 0} words</span>
                                <span>·</span>
                                <span>{v.char_count || 0} chars</span>
                              </div>
                            </>
                          )}
                        </div>

                        {editingVersionId !== v.id && (
                          <div className="version-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleLoadVersion(v)}
                              title="Load this version into the resume editor"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStartRenameVersion(v)}
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => exportResumeTextAsFile(v.resume_text, `${v.name.replace(/\s+/g, '_')}.txt`)}
                              title="Export as plain text"
                            >
                              TXT
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => exportResumeTextAsDocx(v.resume_text, `${v.name.replace(/\s+/g, '_')}.docx`)}
                              title="Export as Microsoft Word DOCX"
                            >
                              DOCX
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteVersion(v.id, v.name)}
                              aria-label={`Delete version ${v.name}`}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsVersionsModalOpen(false);
                  setEditingVersionId(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Supabase Auth & Cloud Sync Modal ══ */}
      {isAuthModalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAuthModalOpen(false);
              setAuthError('');
              setAuthSuccessMsg('');
            }
          }}
        >
          <div className="modal-dialog auth-modal-dialog">
            <div className="modal-header">
              <h3 id="auth-modal-title" className="modal-title">
                <IconCloud />
                {supabaseConfigured
                  ? userSession
                    ? 'Cloud Account & Sync'
                    : authMode === 'signup'
                    ? 'Create Supabase Account'
                    : 'Sign in to CareerPilot'
                  : 'Supabase Cloud Sync Setup'}
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError('');
                  setAuthSuccessMsg('');
                }}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {!supabaseConfigured ? (
                /* Unconfigured state view - honest and informative */
                <div className="supabase-unconfigured-box">
                  <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                    <IconInfo />
                    <div>
                      <strong>Supabase is not configured yet.</strong>
                      <div style={{ marginTop: '4px', fontSize: '13px' }}>
                        To enable secure cross-device resume sync, configure your Supabase credentials in <code>frontend/.env</code>.
                      </div>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Setup Instructions:</h4>
                  <ol style={{ fontSize: '13px', lineHeight: '1.7', paddingLeft: '20px', color: '#475569' }}>
                    <li>Create a project at <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>supabase.com</a>.</li>
                    <li>Execute the database migration in <code>supabase/migrations/20261121_resume_sync.sql</code> in your Supabase SQL Editor.</li>
                    <li>Copy your Project URL and public <strong>anon key</strong> (never use the <code>service_role</code> secret key).</li>
                    <li>Add the variables to <code>frontend/.env</code>:
                      <pre className="env-code-box" style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '12px', marginTop: '6px' }}>
                        VITE_SUPABASE_URL=https://your-project-id.supabase.co{'\n'}
                        VITE_SUPABASE_ANON_KEY=your-supabase-public-anon-key
                      </pre>
                    </li>
                    <li>Restart the frontend development server.</li>
                  </ol>

                  <div className="alert alert-info" style={{ marginTop: '16px', fontSize: '12px' }}>
                    <strong>Privacy Guarantee:</strong> Local-first storage remains active. Your resumes will continue to be stored safely in your local browser even without cloud sync.
                  </div>
                </div>
              ) : userSession ? (
                /* Authenticated Account view */
                <div className="auth-account-view">
                  <div className="account-info-card">
                    <div className="account-avatar">
                      <IconUser />
                    </div>
                    <div className="account-details">
                      <div className="account-email">{userSession.user?.email}</div>
                      <div className="account-id">User ID: <code>{userSession.user?.id}</code></div>
                      <div className="account-status-badge">
                        <span className="dot" /> Connected to Supabase Cloud
                      </div>
                    </div>
                  </div>

                  {authError && (
                    <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
                      <IconInfo />
                      <div>{authError}</div>
                    </div>
                  )}
                  {authSuccessMsg && (
                    <div className="alert alert-success" style={{ marginBottom: '14px' }}>
                      <IconCheck />
                      <div>{authSuccessMsg}</div>
                    </div>
                  )}

                  <div className="account-section">
                    <h4 className="account-section-title">What is stored in your cloud account:</h4>
                    <ul className="account-stored-list">
                      <li><strong>Resume Versions:</strong> Version names, resume text, timestamps, platform presets, and word counts.</li>
                      <li><strong>Row Level Security (RLS):</strong> Protected so only your authenticated user ID can read, modify, or delete your records.</li>
                      <li><strong>Credentials:</strong> Stored securely with Supabase Auth (Argon2 / bcrypt password hashing).</li>
                    </ul>
                  </div>

                  <div className="account-actions-row">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setIsAuthModalOpen(false);
                        setIsVersionsModalOpen(true);
                      }}
                    >
                      Open Saved Versions
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAuthSignOut}
                      disabled={isAuthLoading}
                    >
                      {isAuthLoading ? 'Signing out…' : 'Sign Out'}
                    </button>
                  </div>

                  {/* Danger Zone: Cloud Data Deletion */}
                  <div className="account-danger-zone">
                    <h4 className="danger-title">Delete Cloud Resumes</h4>
                    <p className="danger-desc">
                      Permanently remove all resume versions associated with your account from Supabase cloud database. Your local browser copies will be retained.
                    </p>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={handleDeleteAllCloudResumes}
                      disabled={isAuthLoading}
                    >
                      {isAuthLoading ? 'Deleting…' : 'Delete All Cloud Resumes'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Sign In / Sign Up form */
                <div className="auth-form-container">
                  <div className="auth-mode-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === 'signin'}
                      className={`auth-mode-tab ${authMode === 'signin' ? 'active' : ''}`}
                      onClick={() => {
                        setAuthMode('signin');
                        setAuthError('');
                        setAuthSuccessMsg('');
                      }}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={authMode === 'signup'}
                      className={`auth-mode-tab ${authMode === 'signup' ? 'active' : ''}`}
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError('');
                        setAuthSuccessMsg('');
                      }}
                    >
                      Sign Up
                    </button>
                  </div>

                  {authError && (
                    <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
                      <IconInfo />
                      <div>{authError}</div>
                    </div>
                  )}
                  {authSuccessMsg && (
                    <div className="alert alert-success" style={{ marginBottom: '14px' }}>
                      <IconCheck />
                      <div>{authSuccessMsg}</div>
                    </div>
                  )}

                  <form onSubmit={authMode === 'signup' ? handleAuthSignUp : handleAuthSignIn}>
                    <div className="form-group" style={{ marginBottom: '14px' }}>
                      <label className="form-label" htmlFor="auth-email-input">
                        Email Address
                      </label>
                      <input
                        id="auth-email-input"
                        type="email"
                        className="form-input"
                        placeholder="you@example.com"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '18px' }}>
                      <label className="form-label" htmlFor="auth-password-input">
                        Password
                      </label>
                      <input
                        id="auth-password-input"
                        type="password"
                        className="form-input"
                        placeholder="Minimum 6 characters"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        required
                        autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      />
                    </div>

                    <div className="auth-submit-row">
                      <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={isAuthLoading}
                      >
                        {isAuthLoading ? (
                          'Processing…'
                        ) : authMode === 'signup' ? (
                          'Create Account & Start Syncing'
                        ) : (
                          'Sign In to Sync'
                        )}
                      </button>
                    </div>

                    <div className="auth-footer-help">
                      {authMode === 'signin' ? (
                        <span>
                          Don't have an account?{' '}
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setAuthMode('signup');
                              setAuthError('');
                            }}
                          >
                            Sign up here
                          </button>
                        </span>
                      ) : (
                        <span>
                          Already have an account?{' '}
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setAuthMode('signin');
                              setAuthError('');
                            }}
                          >
                            Sign in here
                          </button>
                        </span>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthError('');
                  setAuthSuccessMsg('');
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
