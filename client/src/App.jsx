import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database, UploadCloud, FileText, RefreshCw, Eye, Trash2, Download,
  LayoutDashboard, Folder, Users, Trash, FileStack, Settings,
  Search, Bell, Lock, ShieldCheck, CheckCircle2, AlertCircle,
  HardDrive, CloudUpload, Archive, Activity, X, RotateCcw, Share2, Building2,
  Sun, Moon, ChevronLeft, ChevronRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';
import Auth from './Auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const timeAgo = (date) => {
  if (!date) return 'Never';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString();
};

const stripTimestamp = (key) => {
  if (!key) return '';
  const name = key.split('/').pop();
  const firstUnderscore = name.indexOf('_');
  // If there's an underscore and the part before it is largely numeric (timestamp), strip it
  if (firstUnderscore > 0 && /^\d+$/.test(name.substring(0, firstUnderscore))) {
    return name.substring(firstUnderscore + 1);
  }
  return name;
};

const fileIcon = (key) => {
  const name = stripTimestamp(key);
  const ext = name.split('.').pop().toLowerCase();
  const colors = { json: '#10b981', doc: '#3b82f6', docx: '#3b82f6', pdf: '#ef4444', png: '#8b5cf6', jpg: '#8b5cf6', jpeg: '#8b5cf6', txt: '#64748b' };
  return colors[ext] || '#64748b';
};

// Simulate 7-day storage growth data points
const buildChartData = (usedBytes) => {
  const gb = usedBytes / (1024 ** 3);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Now'];
  return days.map((day, i) => {
    const factor = i === 6 ? 1 : (0.4 + (i * 0.08) + (Math.sin(i * 1.5) * 0.05));
    return {
      name: day,
      cloud: parseFloat((gb * factor).toFixed(5)),
      local: parseFloat((gb * factor * 0.6).toFixed(5))
    };
  });
};

// ─── Notification state helpers ──────────────────────────────────────────────
const makeNotif = (type, text, icon) => ({
  id: Date.now() + Math.random(), type, text, icon, time: new Date().toISOString()
});

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('esoft_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('esoft_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('esoft_user');
    }
  }, [user]);

  const [currentView, setCurrentView] = useState(() => {
    return localStorage.getItem('esoft_current_view') || 'Dashboard';
  });

  const [notifications, setNotifications] = useState(() => {
    try {
      const savedUser = localStorage.getItem('esoft_user');
      if (!savedUser) return [];
      const uid = JSON.parse(savedUser).id;
      const saved = localStorage.getItem(`esoft_notif_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [activities, setActivities] = useState(() => {
    try {
      const savedUser = localStorage.getItem('esoft_user');
      if (!savedUser) return [];
      const uid = JSON.parse(savedUser).id;
      const saved = localStorage.getItem(`esoft_acts_${uid}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('esoft_current_view', currentView);
  }, [currentView]);

  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);       // { file, formData } for manual retry
  const [uploadRetryCount, setUploadRetryCount] = useState(0); // current attempt shown in UI
  const [backupStatus, setBackupStatus] = useState(null); // null | 'running' | 'success' | 'error'
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingKey, setDeletingKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);        // key pending confirmation
  const [confirmType, setConfirmType] = useState('trash');   // 'trash' | 'permanent' | 'folder'
  const [downloadingKey, setDownloadingKey] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const deptInputRef = useRef(null);

  // ─── New workspace states ─────────────────────────────────────────────────
  const [trashItems, setTrashItems] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [deptFiles, setDeptFiles] = useState([]);
  const [shareModalKey, setShareModalKey] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [deptUploading, setDeptUploading] = useState(false);
  const [useLock, setUseLock] = useState(false);
  const [lockDays, setLockDays] = useState(0);
  const [isAutoBackup, setIsAutoBackup] = useState(() => {
    return localStorage.getItem('esoft_auto_backup') === 'true';
  });
  const [isVersioning, setIsVersioning] = useState(true);
  const [isObjectLock, setIsObjectLock] = useState(true);
  const [currentPrefix, setCurrentPrefix] = useState(''); // Current sub-folder path
  const [navHistory, setNavHistory] = useState(['']); // For browser-like back/forward
  const [historyIndex, setHistoryIndex] = useState(0);
  const [storageHistory, setStorageHistory] = useState([]); // Persistent storage log
  const [selectedFile, setSelectedFile] = useState(null); // File object for details panel
  const [previewFile, setPreviewFile] = useState(null); // File object for modal preview

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('esoft_theme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('esoft_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Persistence for user-specific data
  useEffect(() => {
    if (user) {
      // 1. RE-LOAD when User changes (fixes logout/login issue)
      try {
        const savedNotifs = localStorage.getItem(`esoft_notif_${user.id}`);
        const savedActs = localStorage.getItem(`esoft_acts_${user.id}`);
        setNotifications(savedNotifs ? JSON.parse(savedNotifs) : []);
        setActivities(savedActs ? JSON.parse(savedActs) : []);
      } catch {
        setNotifications([]);
        setActivities([]);
      }
    } else {
      // Clear UI when logged out
      setNotifications([]);
      setActivities([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && (notifications.length > 0 || activities.length > 0)) {
      // 2. SAVE when notifications/activities update
      localStorage.setItem(`esoft_notif_${user.id}`, JSON.stringify(notifications));
      localStorage.setItem(`esoft_acts_${user.id}`, JSON.stringify(activities));
    }
  }, [notifications, activities, user]);

  const authHeaders = useCallback(() => {
    return { 'Authorization': `Bearer ${user?.token}` };
  }, [user]);

  // Auto-logout when token is stale (401/403)
  const apiCall = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    if (res.status === 401) {
      // Token expired or invalid — force logout to clear stale session
      setUser(null);
      setFiles([]); setStats(null); setNotifications([]); setActivities([]);
      setCurrentView('Dashboard');
      throw new Error('Session expired. Please login again.');
    }
    return res;
  }, [authHeaders, user]);

  const pushNotif = useCallback((type, text, icon) => {
    setNotifications(prev => [makeNotif(type, text, icon), ...prev].slice(0, 10));
  }, []);

  const pushActivity = useCallback((text, icon, color) => {
    setActivities(prev => [{ id: Date.now() + Math.random(), text, icon, color, time: new Date().toISOString() }, ...prev].slice(0, 15));
  }, []);

  // ── Fetch stats (real numbers from S3) ────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiCall(`${API_URL}/stats`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);

      // Auto-notify if storage > 50%
      if (data.usedPercent > 50) {
        setNotifications(prev => {
          const already = prev.find(n => n.text.includes('50%'));
          if (!already) return [makeNotif('warn', `Storage used over 50% (${data.usedPercent}%)`, 'alert'), ...prev].slice(0, 10);
          return prev;
        });
      }
    } catch (err) {}
  }, [user, apiCall]);

  // ── Fetch files ────────────────────────────────────────────────────────────
  const fetchFiles = useCallback(async () => {
    if (!user) return;
    try {
      // We fetch everything for the user to make client-side filtering easy for this demo
      const res = await apiCall(`${API_URL}/files`);
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {}
  }, [user, apiCall]);

  // Poll stats every 15s & re-fetch when user changes
  useEffect(() => {
    if (!user) return;
    fetchStats();
    const id = setInterval(fetchStats, 15000);
    return () => clearInterval(id);
  }, [fetchStats, user]);

  // Handle storage history log (persistent data points for the chart)
  useEffect(() => {
    if (!stats || !user) return;
    const uid = user.id;
    const historyKey = `esoft_storage_history_${uid}`;
    
    // Load existing history if not yet loaded
    let currentHistory = storageHistory.length > 0 ? storageHistory : [];
    if (currentHistory.length === 0) {
      const saved = localStorage.getItem(historyKey);
      if (saved) currentHistory = JSON.parse(saved);
    }

    const lastPoint = currentHistory[currentHistory.length - 1];
    const newSize = stats.totalSizeBytes;
    const now = new Date();
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

    // Add new point if size changed or if it's been a while since last point
    const shouldAdd = !lastPoint || 
                      lastPoint.cloudSize !== newSize || 
                      (now - new Date(lastPoint.timestamp)) > 600000; // 10 mins

    if (shouldAdd) {
      const newPoint = { 
        name: timeStr, 
        cloud: parseFloat((newSize / (1024 ** 3)).toFixed(5)), 
        local: parseFloat((newSize * 0.6 / (1024 ** 3)).toFixed(5)),
        cloudSize: newSize,
        timestamp: now.toISOString()
      };
      // Keep last 10 record points for the log
      const updatedHistory = [...currentHistory, newPoint].slice(-10);
      setStorageHistory(updatedHistory);
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    }
  }, [stats, user]);

  // Fetch files when switching to My Files or when user changes
  useEffect(() => {
    if (currentView === 'My Files' && user) fetchFiles();
  }, [currentView, fetchFiles, user]);

  const fetchTrash = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/trash`, { headers: authHeaders() });
      const data = await res.json();
      setTrashItems(Array.isArray(data) ? data : []);
    } catch {}
  }, [user, authHeaders]);

  const fetchShared = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiCall(`${API_URL}/shared`);
      const data = await res.json();
      const newItems = Array.isArray(data) ? data : [];
      
      // Notify if new files arrived
      if (newItems.length > sharedItems.length) {
        const latest = newItems[0];
        // Only notify if we already had some data or if it's the very first poll after login
        pushNotif('info', `New file shared by ${latest.owner_name}: ${latest.filename}`, 'share');
      }
      
      setSharedItems(newItems);
    } catch {}
  }, [user, apiCall, sharedItems.length]);

  const fetchDept = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/department`, { headers: authHeaders() });
      const data = await res.json();
      setDeptFiles(Array.isArray(data) ? data : []);
    } catch {}
  }, [user, authHeaders]);

  useEffect(() => {
    if (currentView === 'Trash' && user) fetchTrash();
    if (currentView === 'Shared with me' && user) fetchShared();
    if (currentView === 'Department' && user) fetchDept();
  }, [currentView, user, fetchTrash, fetchShared, fetchDept]);

  // Background polling for Shared files (every 30s) so notifications pop up even if on Dashboard
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchShared, 30000);
    return () => clearInterval(interval);
  }, [user, fetchShared]);

  // ── Helper: Upload with auto-retry (exponential backoff) ──────────────────
  const uploadWithRetry = useCallback(async (formData, fileName, maxAttempts = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setUploadRetryCount(attempt);
        const res = await apiCall(`${API_URL}/upload`, { method: 'POST', body: formData });
        const data = await res.json();

        // ── Reject: file too large (server-side) ──
        if (res.status === 400 && data.detail?.includes('20MB')) {
          throw Object.assign(new Error(`File "${fileName}" exceeds the 20MB limit`), { noRetry: true });
        }
        // ── Reject: blocked file type ──
        if (res.status === 400 && data.detail?.includes('blocked')) {
          throw Object.assign(new Error(data.detail), { noRetry: true });
        }
        // ── S3 / Server error ──
        if (!res.ok) {
          const errMsg = data.detail || `Server error ${res.status}`;
          throw new Error(`S3 Error: ${errMsg}`);
        }
        return data; // success
      } catch (err) {
        lastError = err;
        if (err.noRetry) throw err; // do not retry validation errors
        if (attempt < maxAttempts) {
          const delay = attempt * 1500; // 1.5s, 3s backoff
          pushNotif('warn', `Upload attempt ${attempt} failed — retrying in ${delay / 1000}s…`, 'alert');
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }, [apiCall, pushNotif]);

  // ── Handler: Upload ────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // ── Reject: file too large (instant, client-side) ──
    if (file.size > 20 * 1024 * 1024) {
      pushNotif('error', `Rejected: "${file.name}" exceeds the 20MB limit (${formatSize(file.size)})`, 'error');
      pushActivity(`Rejected (too large): ${file.name}`, 'upload', '#ef4444');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // ── Reject: dangerous file extension (client-side pre-check) ──
    const blockedExts = ['.exe','.bat','.cmd','.sh','.msi','.dll','.scr','.ps1','.vbs','.jar','.reg'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (blockedExts.includes(ext)) {
      pushNotif('error', `Rejected: "${file.name}" — file type "${ext}" is blocked for security`, 'error');
      pushActivity(`Rejected (blocked type): ${file.name}`, 'upload', '#ef4444');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // --- Detect Duplicate Filename ---
    const isDuplicate = files.some(f => f.Key.endsWith(file.name));
    if (isDuplicate) {
      const proceed = window.confirm(`File "${file.name}" already exists. Upload a new version?`);
      if (!proceed) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lock_days', useLock ? lockDays.toString() : "0");
    formData.append('prefix', currentPrefix); // Pass the current folder prefix

    setUploading(true);
    setUploadError(null);
    pushActivity(`Uploading: ${file.name}`, 'upload', '#3b82f6');

    try {
      const data = await uploadWithRetry(formData, file.name);

      if (data.is_content_duplicate) {
        pushNotif('warn', `Content match: "${file.name}" already backed up (Deduplicated)`, 'alert');
      } else {
        pushNotif('success', `File uploaded: ${file.name}`, 'success');
      }
      pushActivity(`Uploaded: ${file.name} (${formatSize(file.size)})`, 'upload', '#10b981');
      setUploadError(null);
      await fetchFiles();
      await fetchStats();
    } catch (err) {
      // Classify error for a better message
      const isNetworkErr = err.message === 'Failed to fetch' || err.message.includes('NetworkError');
      const msg = isNetworkErr
        ? `Network error — server unreachable. Check your connection.`
        : err.message;
      pushNotif('error', `Upload failed: ${msg}`, 'error');
      pushActivity(`Upload failed after retries: ${file.name}`, 'upload', '#ef4444');
      // Store failed upload context so user can retry manually
      if (!err.noRetry) setUploadError({ file, formData, fileName: file.name });
    } finally {
      setUploading(false);
      setUploadRetryCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Handler: Manual Retry ──────────────────────────────────────────────────
  const handleManualRetry = async () => {
    if (!uploadError) return;
    const { formData, fileName } = uploadError;
    setUploading(true);
    setUploadError(null);
    pushNotif('info', `Retrying upload: ${fileName}…`, 'alert');
    pushActivity(`Manual retry: ${fileName}`, 'upload', '#f59e0b');
    try {
      const data = await uploadWithRetry(formData, fileName);
      pushNotif('success', `File uploaded: ${fileName}`, 'success');
      pushActivity(`Uploaded (retry OK): ${fileName}`, 'upload', '#10b981');
      await fetchFiles();
      await fetchStats();
    } catch (err) {
      pushNotif('error', `Retry failed: ${err.message}`, 'error');
      setUploadError({ formData, fileName }); // keep retry button visible
    } finally {
      setUploading(false);
      setUploadRetryCount(0);
    }
  };

  // ── Handler: Backup ────────────────────────────────────────────────────────
  const handleBackup = useCallback(async () => {
    if (backupStatus === 'running') return;
    setBackupStatus('running');
    pushActivity('Backup sync started (Incremental)', 'backup', '#8b5cf6');
    try {
      const res = await fetch(`${API_URL}/backup`, { 
        method: 'POST',
        headers: authHeaders()
      });
      if (!res.ok) throw new Error('Backup failed');
      const data = await res.json();
      setBackupStatus('success');
      pushNotif('success', 'Backup sync completed successfully', 'success');
      pushActivity(`Backup synced — Checksum: ${data?.result?.checksum?.slice(0, 12) ?? 'OK'}...`, 'backup', '#10b981');
      await fetchFiles();
      await fetchStats();
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (err) {
      setBackupStatus('error');
      pushNotif('error', 'Backup sync failed — check S3 connection', 'error');
      pushActivity('Backup sync failed', 'backup', '#ef4444');
      setTimeout(() => setBackupStatus(null), 4000);
    }
  }, [API_URL, authHeaders, backupStatus, fetchFiles, fetchStats, pushActivity, pushNotif]);

  // Auto-backup timer
  useEffect(() => {
    localStorage.setItem('esoft_auto_backup', isAutoBackup);
    if (!isAutoBackup || !user) return;

    // Run initial check then interval every 5 minutes
    const interval = setInterval(() => {
      handleBackup();
    }, 5 * 60 * 1000); //5 minutes

    return () => clearInterval(interval);
  }, [isAutoBackup, user, handleBackup]);

  // ── Handler: Delete ────────────────────────────────────────────────────────
  const deleteFile = async (key) => {
    setConfirmType('trash');
    setConfirmKey(key);
  };

  // ── Handler: Permanent Delete ─────────────────────────────────────────────
  const permanentDelete = async (key) => {
    setConfirmType('permanent');
    setConfirmKey(key);
  };

  // ── Handler: Share ─────────────────────────────────────────────────────────
  const openShareModal = (key) => {
    setShareModalKey(key);
    setShareEmail('');
  };

  const submitShare = async () => {
    if (!shareEmail.trim() || !shareModalKey) return;
    try {
      const res = await fetch(`${API_URL}/share`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: shareModalKey, target_email: shareEmail.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      pushNotif('success', `Shared "${stripTimestamp(shareModalKey)}" with ${shareEmail}`, 'success');
      pushActivity(`Shared: ${stripTimestamp(shareModalKey)} → ${shareEmail}`, 'share', '#3b82f6');
      setShareModalKey(null);
    } catch (err) {
      pushNotif('error', err.message || 'Share failed', 'error');
    }
  };

  // ── Handler: Restore from Trash ───────────────────────────────────────────
  const restoreFile = async (key) => {
    try {
      const res = await fetch(`${API_URL}/trash/restore?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      pushNotif('success', `Restored: ${stripTimestamp(key)}`, 'success');
      pushActivity(`Restored: ${stripTimestamp(key)}`, 'restore', '#10b981');
      fetchTrash();
    } catch (err) {
      pushNotif('error', `Restore failed: ${err.message}`, 'error');
    }
  };

  // ── Handler: Permanent Delete ─────────────────────────────────────────────
  // (moved to confirmed action)

  // ── Handler: Dept Upload ───────────────────────────────────────────────────
  const handleDeptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      pushNotif('error', `${file.name} exceeds 20MB limit`, 'error');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    setDeptUploading(true);
    try {
      const res = await fetch(`${API_URL}/department/upload`, {
        method: 'POST', body: formData, headers: authHeaders()
      });
      if (!res.ok) throw new Error('Upload failed');
      pushNotif('success', `Uploaded to Department: ${file.name}`, 'success');
      pushActivity(`Dept upload: ${file.name}`, 'upload', '#7c3aed');
      fetchDept();
    } catch (err) {
      pushNotif('error', `Dept upload failed: ${file.name}`, 'error');
    }
    setDeptUploading(false);
    if (deptInputRef.current) deptInputRef.current.value = '';
  };

  // ── Handler: Dept Download ────────────────────────────────────────────────
  const deptDownload = async (key) => {
    try {
      const res = await fetch(`${API_URL}/department/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url; a.download = stripTimestamp(key);
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } catch {}
  };

  const confirmDelete = async () => {
    const key = confirmKey;
    const type = confirmType;
    setConfirmKey(null);

    if (type === 'trash') {
      const name = stripTimestamp(key);
      setDeletingKey(key);
      pushActivity(`Moving to Trash: ${name}`, 'delete', '#f59e0b');
      try {
        const res = await fetch(`${API_URL}/files?key=${encodeURIComponent(key)}`, { 
          method: 'DELETE',
          headers: authHeaders()
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        pushNotif('warn', `Moved to Trash: ${name}`, 'trash');
        pushActivity(`Moved to Trash: ${name} (recoverable)`, 'delete', '#f59e0b');
        await fetchFiles();
        await fetchStats();
      } catch (err) {
        pushNotif('error', `Failed to delete ${name}`, 'error');
      }
      setDeletingKey(null);
    } else if (type === 'permanent') {
      const name = stripTimestamp(key);
      try {
        const res = await fetch(`${API_URL}/trash/permanent?key=${encodeURIComponent(key)}`, {
          method: 'DELETE', headers: authHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail);
        pushNotif('success', `Permanently deleted: ${name}`, 'success');
        fetchTrash();
        fetchStats();
      } catch (err) {
        pushNotif('error', `Delete failed: ${err.message}`, 'error');
      }
    } else if (type === 'folder') {
      const folderName = key.split('/').filter(Boolean).pop();
      try {
        pushActivity(`Deleting folder: ${folderName}`, 'delete', '#ef4444');
        const res = await apiCall(`${API_URL}/folders?prefix=${encodeURIComponent(key)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete folder');
        pushNotif('success', `Folder "${folderName}" deleted`, 'success');
        await fetchFiles();
        await fetchStats();
      } catch (err) {
        pushNotif('error', `Failed to delete folder: ${err.message}`, 'error');
      }
    }
  };

  // ── Handler: Preview ──────────────────────────────────────────────────────
  const handlePreview = async (key) => {
    try {
      const res = await fetch(`${API_URL}/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) {
        // Instead of window.open, let's store it for our Modal
        const ext = key.split('.').pop().toLowerCase();
        let type = 'other';
        if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) type = 'image';
        else if (ext === 'pdf') type = 'pdf';
        else if (['txt','json','md','csv'].includes(ext)) type = 'text';

        let content = null;
        if (type === 'text') {
          const textRes = await fetch(data.url);
          content = await textRes.text();
        }

        setPreviewFile({ key, url: data.url, type, content });
        pushActivity(`Previewed: ${stripTimestamp(key)}`, 'preview', '#64748b');
      }
    } catch (err) {
      pushNotif('error', `Preview failed: ${stripTimestamp(key)}`, 'error');
    }
  };

  // ── Handler: Download (force download) ────────────────────────────────────
  const downloadFile = async (key) => {
    const name = stripTimestamp(key);
    setDownloadingKey(key);
    try {
      const res = await fetch(`${API_URL}/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) {
        const a = document.createElement('a');
        a.href = data.url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        pushActivity(`Downloaded: ${name}`, 'download', '#3b82f6');
        pushNotif('success', `Download started: ${name}`, 'success');
      }
    } catch (err) {
      pushNotif('error', `Download failed: ${name}`, 'error');
    }
    setDownloadingKey(null);
  };
  
  // ── Handler: Move File (Drag & Drop) ──────────────────────────────────────
  const handleFileMove = async (sourceKey, targetFolder) => {
    // Only move if not already in that folder
    const parts = sourceKey.split('/');
    const currentFolder = parts.slice(2, -1).join('/') + '/'; // uploads/path/ -> path/
    if (currentFolder === targetFolder || (currentFolder === '/' && targetFolder === '')) return;

    try {
      pushActivity(`Moving ${stripTimestamp(sourceKey)} to ${targetFolder || 'Root'}`, 'move', '#f59e0b');
      const res = await apiCall(`${API_URL}/files/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_key: sourceKey, target_folder: targetFolder })
      });
      if (!res.ok) throw new Error('Move failed');
      pushNotif('success', `Moved to ${targetFolder || 'Root'}`, 'success');
      await fetchFiles();
    } catch (err) {
      pushNotif('error', `Move failed: ${err.message}`, 'error');
    }
  };

  const deleteFolder = async (folderName) => {
    const prefix = fullPrefix + folderName + '/';
    setConfirmType('folder');
    setConfirmKey(prefix);
  };

  const handleFolderUpload = async (e) => {
    const filesArray = Array.from(e.target.files);
    if (!filesArray.length) return;

    setUploading(true);
    pushActivity(`Uploading folder: ${filesArray.length} objects`, 'upload', '#3b82f6');
    
    let successCount = 0;
    for (const file of filesArray) {
      const formData = new FormData();
      formData.append('file', file);
      // webkitRelativePath is e.g. "my-folder/sub/file.txt"
      // We want to upload it to currentPrefix + "my-folder/sub/"
      const relativePath = file.webkitRelativePath || '';
      const folderPath = relativePath.substring(0, relativePath.lastIndexOf('/'));
      const uploadPrefix = currentPrefix + (folderPath ? folderPath + '/' : '');
      
      formData.append('prefix', uploadPrefix);
      formData.append('lock_days', useLock ? lockDays.toString() : "0");

      try {
        await uploadWithRetry(formData, file.name, 1); // 1 retry for bulk
        successCount++;
      } catch (err) {
        pushNotif('error', `Failed: ${file.name}`, 'error');
      }
    }
    
    pushNotif('success', `Uploaded ${successCount} files in folder structure`, 'success');
    await fetchFiles();
    await fetchStats();
    setUploading(false);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  // ── Handler: Folder Navigation ─────────────────────────────────────────────
  const updatePrefixWithHistory = (newPrefix) => {
    if (newPrefix === currentPrefix) return;
    const newHistory = navHistory.slice(0, historyIndex + 1);
    newHistory.push(newPrefix);
    setNavHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentPrefix(newPrefix);
    setSelectedFile(null);
  };

  const enterFolder = (folderName) => {
    updatePrefixWithHistory(currentPrefix + folderName + '/');
  };

  const goBackTo = (index) => {
    if (index === -1) {
      updatePrefixWithHistory('');
      return;
    }
    const parts = currentPrefix.split('/').filter(Boolean);
    const newPath = parts.slice(0, index + 1).join('/') + '/';
    updatePrefixWithHistory(newPath);
  };
  
  const enterBackups = () => {
    updatePrefixWithHistory('!backups!');
  };

  const goNavBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setCurrentPrefix(navHistory[newIdx]);
      setSelectedFile(null);
    }
  };

  const goNavForward = () => {
    if (historyIndex < navHistory.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setCurrentPrefix(navHistory[newIdx]);
      setSelectedFile(null);
    }
  };

  const goBackToParent = () => {
    if (currentPrefix === '' || currentPrefix === '!backups!') {
       if (currentPrefix !== '') updatePrefixWithHistory('');
       return;
    }
    const parts = currentPrefix.split('/').filter(Boolean);
    const newPath = parts.slice(0, -1).join('/') + '/';
    updatePrefixWithHistory(newPath);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isBackupsView = currentPrefix === '!backups!';
  const fullPrefix = isBackupsView 
    ? `${user.id}/backup/` 
    : `${user.id}/uploads/${currentPrefix}`;
  
  // Sort oldest to newest (or vice versa) and filter for search
  const searchedFiles = files.filter(f => f.Key.toLowerCase().includes(searchQuery.toLowerCase()));

  // 1. Identify Folders and Files at the current level
  const foldersAtLevel = new Set();
  const filesAtLevel = [];

  searchedFiles.forEach(f => {
    // If we are in backups view, we show files in user_id/backup/
    if (f.Key.startsWith(fullPrefix) && f.Key !== fullPrefix) {
      const relativeKey = f.Key.slice(fullPrefix.length);
      const parts = relativeKey.split('/');
      if (parts.length > 1) {
        foldersAtLevel.add(parts[0]);
      } else {
        filesAtLevel.push(f);
      }
    }
  });

  const sortedFiles = [...filesAtLevel].sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  const breadcrumbParts = isBackupsView ? ['System Backups'] : currentPrefix.split('/').filter(Boolean);
  
  // Use real persistent history if available, otherwise fallback to simulation
  const chartData = storageHistory.length > 2 
    ? storageHistory 
    : stats ? buildChartData(stats.totalSizeBytes) : [];

  const usedPct = stats?.usedPercent ?? 0;
  const unreadCount = notifications.filter(n => n.type === 'error' || n.type === 'warn').length;

  if (!user) {
    return <Auth onLoginSuccess={setUser} />;
  }

  return (
    <div className="layout">

      {/* ── SIDEBAR LEFT ─────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-user">
          <div className="avatar-circle">{user.name.substring(0, 2).toUpperCase()}</div>
          <span>{user.name}</span>
          <button 
            className="logout-btn"
            onClick={() => {
              setUser(null);
              setFiles([]);
              setStats(null);
              setNotifications([]);
              setActivities([]);
              setCurrentView('Dashboard');
            }}
            title="Logout"
          >
            <Lock size={12} /> Logout
          </button>
        </div>

        <nav>
          <div className="nav-section">
            <h4>MAIN</h4>
            <NavItem icon={<Database size={17}/>} label="Dashboard" active={currentView==='Dashboard'} onClick={() => setCurrentView('Dashboard')}/>
          </div>
          <div className="nav-section">
            <h4>WORKSPACE</h4>
            <NavItem icon={<Folder size={17}/>} label="My Files" active={currentView==='My Files'} onClick={() => setCurrentView('My Files')}/>
            <NavItem icon={<Users size={17}/>} label="Shared with me" active={currentView==='Shared with me'} onClick={() => setCurrentView('Shared with me')}/>
            <NavItem icon={<Building2 size={17}/>} label="Department" active={currentView==='Department'} onClick={() => setCurrentView('Department')}/>
            <NavItem icon={<Trash size={17}/>} label="Trash" active={currentView==='Trash'} onClick={() => setCurrentView('Trash')}/>
          </div>
          <div className="nav-section">
            <h4>ANALYTICS</h4>
            <NavItem icon={<FileStack size={17}/>} label="Storage Analytic"/>
            <NavItem icon={<FileText size={17}/>} label="Usage Reports"/>
          </div>
          <div className="nav-section">
            <h4>SYSTEM</h4>
            <NavItem icon={<Settings size={17}/>} label="Settings"/>
          </div>
        </nav>

        <div className="system-storage">
          <div className="storage-label">STORAGE</div>
          <div className="storage-values">
            <span>{stats ? formatSize(stats.totalSizeBytes) : '—'}</span>
            <span className="storage-max">/ 2 GB</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bg" style={{ width: `${Math.min(usedPct, 100)}%`, background: usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#3b82f6' }}/>
          </div>
          <div className="storage-pct">{usedPct}% used</div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="main-content">
        <header className="header">
          <div className="header-left">
            <Database size={16}/> <span className="breadcrumb">{currentView === 'Dashboard' ? 'MAIN' : 'WORKSPACE'}</span> / <strong>{currentView}</strong>
          </div>
          <div className="header-actions">
            {currentView === 'My Files' && (
              <div className="search-wrapper">
                <Search size={14} className="search-icon"/>
                <input className="search-box" placeholder="Search files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
              </div>
            )}
            <button 
              className="icon-btn theme-toggle" 
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} 
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button className="icon-btn" title="Refresh stats" onClick={fetchStats}><RefreshCw size={17}/></button>
            <div className="bell-wrapper">
              <Bell size={17}/>
              {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
            </div>
          </div>
        </header>

        <div className="dashboard-scroll">

          {/* ── DASHBOARD VIEW ─────────────────────────────────────────── */}
          {currentView === 'Dashboard' && (
            <div>
              {/* Stats bar */}
              <div className="stats-row">
                <StatCard icon={<HardDrive size={20} color="#3b82f6"/>} label="Total Objects" value={stats?.totalFiles ?? '—'} bg={isDarkMode ? '#1e293b' : '#eff6ff'}/>
                <StatCard icon={<CloudUpload size={20} color="#10b981"/>} label="Uploaded Files" value={stats?.uploadsCount ?? '—'} bg={isDarkMode ? '#1e293b' : '#f0fdf4'}/>
                <StatCard icon={<Archive size={20} color="#8b5cf6"/>} label="Backup Versions" value={stats?.backupsCount ?? '—'} bg={isDarkMode ? '#1e293b' : '#f5f3ff'}/>
                <StatCard icon={<Activity size={20} color="#f59e0b"/>} label="Storage Used" value={stats ? `${usedPct}%` : '—'} bg={isDarkMode ? '#1e293b' : '#fffbeb'}/>
              </div>

              {/* Backup + Data Protection cards */}
              <div className="dashboard-border">
                <div className="grid-2">
                  <div className="card">
                    <div className="card-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}><ShieldCheck size={20} color="#10b981"/> Backup Status</div>
                      <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                        <span style={{fontSize:'0.7rem', color: isAutoBackup ? '#10b981' : '#94a3b8', fontWeight:700}}>AUTO</span>
                        <div 
                          className={`toggle-switch ${isAutoBackup ? 'on' : ''}`} 
                          onClick={() => {
                            const newState = !isAutoBackup;
                            setIsAutoBackup(newState);
                            if(newState) pushNotif('info', 'Auto-protection enabled (Every 5m)', 'shield');
                            else pushNotif('warn', 'Auto-protection disabled', 'alert');
                          }}
                          style={{cursor:'pointer'}}
                        />
                      </div>
                    </div>
                    <div className="status-text" style={{color: '#10b981'}}>Healthy</div>
                    {stats?.lastBackupTime
                      ? <div className="status-sub">Last sync: {timeAgo(stats.lastBackupTime)}</div>
                      : <div className="status-sub" style={{color:'#ef4444'}}>No backup yet</div>
                    }
                    <div className="progress-blue" style={{marginTop:'1.5rem'}}>
                      <div className="progress-blue-inner" style={{width:`${Math.min(usedPct, 100)}%`}}/>
                    </div>
                    <div style={{fontSize:'0.78rem', color:'#3b82f6', marginTop:'0.4rem'}}>{usedPct}% of 2 GB used</div>
                  </div>
                  <div className="card">
                    <div className="card-title"><Lock size={20} color="#3b82f6"/> Data Protection</div>
                    <div className="toggle-row">
                      <span>Versioning</span>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                        <span style={{fontSize:'0.8rem',color: isVersioning ? '#10b981' : '#94a3b8',fontWeight:700}}>{isVersioning ? 'ON' : 'OFF'}</span>
                        <div className={`toggle-switch ${isVersioning ? 'on' : ''}`} onClick={() => {
                          const ns = !isVersioning;
                          setIsVersioning(ns);
                          pushNotif(ns ? 'success' : 'error', `Versioning ${ns ? 'enabled' : 'disabled'}`, ns ? 'shield' : 'alert');
                        }}/>
                      </div>
                    </div>
                    <div className="toggle-row" style={{marginBottom:0}}>
                      <span>Object Lock (Immutable)</span>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                        <span style={{fontSize:'0.8rem',color: isObjectLock ? '#10b981' : '#94a3b8',fontWeight:700}}>{isObjectLock ? 'ON' : 'OFF'}</span>
                        <div className={`toggle-switch ${isObjectLock ? 'on' : ''}`} onClick={() => {
                          const ns = !isObjectLock;
                          setIsObjectLock(ns);
                          if(!ns) pushNotif('error', 'Object Lock disabled - Data is now mutable', 'alert');
                          else pushNotif('success', 'Object Lock enabled - Files are immutable', 'shield');
                        }}/>
                      </div>
                    </div>
                    <div style={{marginTop:'1.25rem', padding:'0.75rem', background: isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4', borderRadius:'6px', fontSize:'0.78rem', color: isDarkMode ? '#4ade80' : '#16a34a', border: isDarkMode ? '1px solid rgba(22, 163, 74, 0.3)' : 'none'}}>
                      ✓ Anti-ransomware protection active — AES-256 encrypted at rest
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="chart-area">
                  <div style={{fontWeight:600, marginBottom:'1.5rem', fontSize:'0.95rem'}}>Storage Overview (Hybrid: Cloud + Local)</div>
                  {stats && stats.totalSizeBytes > 0 ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:11}} dy={8}/>
                        <YAxis axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:11}} dx={-8} tickFormatter={v => v.toFixed(3) + 'GB'}/>
                        <Tooltip formatter={(v, n) => [v.toFixed(4) + ' GB', n === 'cloud' ? 'Cloud' : 'Local']}/>
                        <Line 
                          type="monotone" 
                          dataKey="cloud" 
                          stroke={isDarkMode ? '#60a5fa' : '#334155'} 
                          strokeWidth={2.5} 
                          dot={{r:4, fill: isDarkMode ? '#1e293b' : 'white', strokeWidth: 2}} 
                          activeDot={{r:6, strokeWidth:0}}
                          animationDuration={1500}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="local" 
                          stroke="#93c5fd" 
                          strokeWidth={2} 
                          strokeDasharray="5 5" 
                          dot={{r:3}} 
                          animationDuration={2000}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:'0.9rem', flexDirection:'column', gap:'0.5rem'}}>
                      <Archive size={32} color="#cbd5e1"/>
                      <span>No data yet — upload files or run a backup to see metrics</span>
                    </div>
                  )}
                  {stats && stats.totalSizeBytes > 0 && (
                    <div style={{display:'flex', gap:'2rem', fontSize:'0.82rem', fontWeight:600, marginTop:'1rem'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><div style={{width:8,height:8,borderRadius:'50%',background:'#334155'}}/> Cloud: {formatSize(stats.totalSizeBytes)}</div>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem',color:'#3b82f6'}}><div style={{width:8,height:8,borderRadius:'50%',background:'#3b82f6'}}/> Local: {formatSize(stats.totalSizeBytes * 0.6)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MY FILES VIEW ──────────────────────────────────────────── */}
          {currentView === 'My Files' && (
            <div>
              <div className="files-actions-row" style={{gridTemplateColumns: 'minmax(400px, 2fr) 1fr'}}>
                <div className="action-card" style={{padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
                  <div style={{display: 'flex', flexDirection: 'row', flex: 1}}>
                    <label className="upload-half left" style={{flex: 1, padding: '1.25rem', borderRight: '1px solid var(--border)', cursor: uploading ? 'not-allowed' : 'pointer', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                      <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileUpload} disabled={uploading}/>
                      <div style={{width: 44, height: 44, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom: '0.5rem'}}>
                         <UploadCloud size={24} color="#3b82f6"/>
                      </div>
                      <div style={{fontWeight: 700, fontSize: '0.85rem'}}>File</div>
                      <div style={{fontSize: '0.7rem', color: 'var(--muted)'}}>Up to 20MB</div>
                    </label>
                    <label className="upload-half right" style={{flex: 1, padding: '1.25rem', cursor: uploading ? 'not-allowed' : 'pointer', transition: 'background 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
                      <input ref={folderInputRef} type="file" webkitdirectory="" directory="" style={{display:'none'}} onChange={handleFolderUpload} disabled={uploading}/>
                      <div style={{width: 44, height: 44, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom: '0.5rem'}}>
                         <Folder size={24} color="#f59e0b"/>
                      </div>
                      <div style={{fontWeight: 700, fontSize: '0.85rem'}}>Folder</div>
                      <div style={{fontSize: '0.7rem', color: 'var(--muted)'}}>Recursive</div>
                    </label>
                  </div>
                  <div style={{padding: '0.6rem 1.25rem', background: 'var(--header-bg)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem'}}>
                    <label style={{display:'flex', alignItems:'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', fontWeight: 600}}>
                       <input type="checkbox" checked={useLock} onChange={e => setUseLock(e.target.checked)} style={{width: 15, height: 15}}/>
                       <Lock size={14} color={useLock ? '#f59e0b' : '#94a3b8'}/>
                       <span>WORM Object Lock Protection</span>
                    </label>
                    {useLock && (
                      <div style={{display:'flex', alignItems:'center', gap: '0.5rem', animation: 'fadeIn 0.2s', padding: '2px 8px', borderRadius: '4px', background: 'var(--bg)', border: '1px solid var(--border)'}}>
                        <input 
                          type="number" min="0" max="3650" value={lockDays} 
                          onChange={e => setLockDays(Number(e.target.value))} 
                          style={{width:'45px', padding:'0.1rem', fontSize:'0.75rem', fontWeight: 800, textAlign:'center', border:'none', background:'transparent', color:'var(--text)'}} 
                        />
                        <span style={{color: 'var(--muted)', fontWeight: 500}}>days</span>
                      </div>
                    )}
                  </div>
                  {uploading && (
                    <div style={{height: '3px', width: '100%', background: 'rgba(59, 130, 246, 0.1)', overflow: 'hidden'}}>
                      <div className="upload-progress-inner" style={{height: '100%', width: '40%', background: '#3b82f6', animation: 'progressAnim 2s infinite linear'}}/>
                    </div>
                  )}
                </div>

                <div className={`action-card ${backupStatus === 'running' ? 'running' : ''}`} onClick={handleBackup} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '1.25rem', cursor: 'pointer', textAlign: 'center'}}>
                  <div style={{width: 50, height: 50, borderRadius: '50%', background: 'rgba(139, 92, 246, 0.14)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                    <RefreshCw size={26} className={backupStatus==='running' ? 'spin' : ''} color="#8b5cf6"/>
                  </div>
                  <div>
                    <div style={{fontWeight: 800, fontSize: '0.9rem'}}>Backup System</div>
                    <div style={{fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.1rem'}}>
                       {backupStatus === 'success' ? 'Cloud Synced ✓' : 'Incremental Mode'}
                    </div>
                  </div>
                  {backupStatus === 'success' && <div className="owner-badge" style={{fontSize: '0.65rem'}}>RPO Active</div>}
                </div>
              </div>

              {/* Breadcrumbs & Navigation */}
              <div className="breadcrumb-container" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.5rem'}}>
                  <button 
                    className="icon-btn nav-arrow" 
                    onClick={goNavBack} 
                    disabled={historyIndex === 0}
                    style={{width: 32, height: 32, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--panel)', color: historyIndex === 0 ? 'var(--muted)' : 'var(--text)'}}
                    title="Go back"
                  >
                     <ChevronLeft size={18}/>
                  </button>
                  <button 
                    className="icon-btn nav-arrow" 
                    onClick={goNavForward} 
                    disabled={historyIndex === navHistory.length - 1}
                    style={{width: 32, height: 32, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--panel)', color: historyIndex === navHistory.length - 1 ? 'var(--muted)' : 'var(--text)'}}
                    title="Go forward"
                  >
                     <ChevronRight size={18}/>
                  </button>
                </div>

                <div className="breadcrumb-root breadcrumb-item" onClick={() => goBackTo(-1)}>
                  <LayoutDashboard size={14} /> Root
                </div>
                {breadcrumbParts.map((part, idx) => (
                  <React.Fragment key={idx}>
                    <span className="breadcrumb-sep">/</span>
                    <div className="breadcrumb-item" onClick={() => goBackTo(idx)}>{part}</div>
                  </React.Fragment>
                ))}
                
                {/* Drop target for Root */}
                {currentPrefix !== '' && (
                  <div 
                    className="breadcrumb-item" 
                    style={{marginLeft: 'auto', fontSize: '0.75rem', border: '1px dashed var(--border)', padding: '2px 8px', borderRadius: '4px'}}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
                    onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                    onDrop={e => {
                      e.preventDefault();
                      e.currentTarget.style.borderColor = 'var(--border)';
                      const sourceKey = e.dataTransfer.getData('sourceKey');
                      if (sourceKey) handleFileMove(sourceKey, '');
                    }}
                  >
                    Drop here to move to Root
                  </div>
                )}
              </div>

              <div className="files-section-header">
                <h3>Object Browser</h3>
                <button className="icon-btn" title="Refresh list" onClick={fetchFiles}><RefreshCw size={14}/></button>
              </div>

                <div className="file-list">
                {/* Pinned Backups Folder at Root */}
                {currentPrefix === '' && (
                  <div className="folder-item" onClick={enterBackups} style={{background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)'}}>
                    <div className="folder-icon" style={{color: '#3b82f6'}}><Archive size={20} /></div>
                    <div className="file-name" style={{fontWeight: 700}}>System Backups</div>
                    <div className="owner-badge" style={{marginLeft: 'auto'}}>pinned</div>
                  </div>
                )}

                {/* Render Folders First */}
                {[...foldersAtLevel].sort().map(folder => (
                  <div 
                    key={folder} 
                    className="folder-item" 
                    onClick={() => enterFolder(folder)}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'var(--sidebar-active)'; }}
                    onDragLeave={e => { e.currentTarget.style.background = ''; }}
                    onDrop={e => {
                      e.preventDefault();
                      e.currentTarget.style.background = '';
                      const sourceKey = e.dataTransfer.getData('sourceKey');
                      if (sourceKey) handleFileMove(sourceKey, currentPrefix + folder + '/');
                    }}
                  >
                      <div className="folder-icon"><Folder size={20} /></div>
                      <div className="file-name">{folder}</div>
                      <button className="icon-action-btn red" style={{marginLeft: 'auto', border: 'none', background: 'transparent'}} onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                ))}

                {/* Render Files */}
                {sortedFiles.length === 0 && foldersAtLevel.size === 0 ? (
                  <div className="empty-state">
                    <CloudUpload size={48} color="var(--border)" strokeWidth={1} />
                    <p>{searchQuery ? 'No results found' : 'No objects in this path'}</p>
                  </div>
                ) : (
                  sortedFiles.map(file => {
                    const isDeleting = deletingKey === file.Key;
                    return (
                      <div 
                        key={file.Key} 
                        className={`file-item ${isDeleting ? 'deleting' : ''}`}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('sourceKey', file.Key);
                          e.currentTarget.style.opacity = '0.5';
                        }}
                        onDragEnd={e => {
                          e.currentTarget.style.opacity = '1';
                        }}
                      >
                        <div className="file-info">
                          <div className="file-type-dot" style={{background: fileIcon(file.Key)}} />
                          <div>
                            <div className="file-name" style={{cursor:'pointer'}} onClick={() => handlePreview(file.Key)}>
                              {stripTimestamp(file.Key)}
                            </div>
                            <div className="file-meta">
                              {file.Key.includes('/backup/') && <span className="file-tag" style={{background: '#dbeafe', color: '#1e40af'}}>system-state</span>}
                              <span>{formatSize(file.Size)} • {timeAgo(file.LastModified)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="header-actions" style={{gap: '0.5rem'}}>
                          {/* File Details Toggle */}
                          <button 
                            className={`icon-action-btn ${selectedFile?.Key === file.Key ? 'active' : ''}`} 
                            title="File Details" 
                            onClick={(e) => { e.stopPropagation(); setSelectedFile(selectedFile?.Key === file.Key ? null : file); }}
                            style={{background: selectedFile?.Key === file.Key ? 'var(--accent)' : 'var(--panel)', color: selectedFile?.Key === file.Key ? 'white' : 'var(--muted)'}}
                          >
                            <ShieldCheck size={14}/>
                          </button>
                          <button className="icon-action-btn blue" title="Quick Preview" onClick={() => handlePreview(file.Key)}><Eye size={15}/></button>
                          <button className="icon-action-btn teal" title="Download" onClick={() => downloadFile(file.Key)} disabled={downloadingKey === file.Key}>
                            {downloadingKey === file.Key ? <RefreshCw size={14} className="spin"/> : <Download size={15}/>}
                          </button>
                          <button className="icon-action-btn blue" title="Share file" onClick={() => openShareModal(file.Key)}><Share2 size={15}/></button>
                          <button className="icon-action-btn red" title="Delete" onClick={() => deleteFile(file.Key)}><Trash2 size={15}/></button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── TRASH VIEW ───────────────────────────────────────────────── */}
          {currentView === 'Trash' && (
            <div>
              <div className="view-header">
                <Trash size={20} color="#ef4444"/>
                <div><h2>Trash</h2><div className="view-header-sub">Files soft-deleted via Versioning. Restore or permanently remove.</div></div>
                <button className="icon-btn" style={{marginLeft:'auto'}} onClick={fetchTrash}><RefreshCw size={15}/></button>
              </div>
              {trashItems.length === 0 ? (
                <div className="empty-state"><Trash size={36} color="#cbd5e1"/><span>Trash is empty</span></div>
              ) : trashItems.map(item => {
                const name = stripTimestamp(item.Key);
                return (
                  <div key={item.Key} className="trash-item">
                    <div>
                      <div className="trash-item-name">{name}</div>
                      <div className="trash-item-meta">
                        <span className="file-tag" style={{background:'#fee2e2',color:'#ef4444'}}>deleted</span>
                        Deleted · {timeAgo(item.DeletedAt)}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'0.4rem'}}>
                      <button className="restore-btn" onClick={() => restoreFile(item.Key)}>
                        <RotateCcw size={12} style={{marginRight:'0.3rem'}}/> Restore
                      </button>
                      <button className="perm-del-btn" onClick={() => permanentDelete(item.Key)}>
                        Delete Forever
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── SHARED WITH ME VIEW ──────────────────────────────────────── */}
          {currentView === 'Shared with me' && (
            <div>
              <div className="view-header">
                <Users size={20} color="#3b82f6"/>
                <div><h2>Shared with me</h2><div className="view-header-sub">Files others have shared with your account.</div></div>
                <button className="icon-btn" style={{marginLeft:'auto'}} onClick={fetchShared}><RefreshCw size={15}/></button>
              </div>
              {sharedItems.length === 0 ? (
                <div className="empty-state"><Users size={36} color="#cbd5e1"/><span>No files shared with you yet</span></div>
              ) : sharedItems.map(item => (
                <div key={item.key} className="shared-item">
                  <div>
                    <div className="shared-item-name">{stripTimestamp(item.key)}</div>
                    <div className="shared-item-meta">
                      <span className="owner-badge">from: {item.owner_name}</span>
                      {timeAgo(item.shared_at)}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'0.4rem'}}>
                    {item.url && (
                      <button className="icon-action-btn teal" title="Download" onClick={() => {const a=document.createElement('a');a.href=item.url;a.download=item.filename;document.body.appendChild(a);a.click();document.body.removeChild(a);}}>
                        <Download size={14}/>
                      </button>
                    )}
                    {item.url && (
                      <button className="icon-action-btn blue" title="Preview" onClick={() => window.open(item.url,'_blank')}>
                        <Eye size={14}/>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── DEPARTMENT VIEW ─────────────────────────────────────────────── */}
          {currentView === 'Department' && (
            <div>
              <div className="view-header">
                <Building2 size={20} color="#7c3aed"/>
                <div><h2>Department</h2><div className="view-header-sub">Shared workspace — all team members can upload and access.</div></div>
                <label style={{marginLeft:'auto'}}>
                  <input ref={deptInputRef} type="file" style={{display:'none'}} onChange={handleDeptUpload} disabled={deptUploading}/>
                  <span className="restore-btn" style={{cursor:'pointer',background:'#ede9fe',color:'#7c3aed',border:'1px solid #c4b5fd'}}>
                    <UploadCloud size={14} style={{marginRight:'0.3rem'}}/>{deptUploading ? 'Uploading…' : 'Upload to Dept'}
                  </span>
                </label>
                <button className="icon-btn" onClick={fetchDept}><RefreshCw size={15}/></button>
              </div>
              {deptFiles.length === 0 ? (
                <div className="empty-state"><Building2 size={36} color="#cbd5e1"/><span>No files in Department yet</span></div>
              ) : deptFiles.map(file => {
                const name = stripTimestamp(file.Key);
                const parts = file.Key.split('/');
                const uploader = parts[1] || 'unknown';
                return (
                  <div key={file.Key} className="dept-item">
                    <div>
                      <div className="dept-item-name">{name}</div>
                      <div className="dept-item-meta">
                        <span className="dept-badge">dept</span>
                        <span className="owner-badge">{uploader}</span>
                        {formatSize(file.Size)} · {timeAgo(file.LastModified)}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:'0.4rem'}}>
                      <button className="icon-action-btn teal" title="Download" onClick={() => deptDownload(file.Key)}>
                        <Download size={14}/>
                      </button>
                      <button className="icon-action-btn blue" title="Preview" onClick={async () => {const r=await fetch(`${API_URL}/department/download?key=${encodeURIComponent(file.Key)}`,{headers:authHeaders()});const d=await r.json();if(d.url)window.open(d.url,'_blank');}}>
                        <Eye size={14}/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── SHARE MODAL ─────────────────────────────────────────────────────── */}
      {shareModalKey && (
        <div className="share-modal-overlay">
          <div className="share-modal">
            <h3>Share File</h3>
            <p>Share <strong>{stripTimestamp(shareModalKey)}</strong> with another user</p>
            <div className="share-input-row">
              <input
                className="share-input"
                type="email"
                placeholder="Enter email address..."
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitShare()}
                autoFocus
              />
              <button className="share-btn" onClick={submitShare}>Share</button>
            </div>
            <button className="share-cancel-btn" onClick={() => setShareModalKey(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── INLINE CONFIRM DIALOG ──────────────────────────────────────────── */}
      {confirmKey && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <div className="confirm-icon"><Trash2 size={22} color="#ef4444"/></div>
            <div className="confirm-title">
              {confirmType === 'permanent' ? 'Permanent Delete?' : confirmType === 'folder' ? 'Delete Folder?' : 'Move to Trash?'}
            </div>
            <div className="confirm-desc">
              <strong>{confirmType === 'folder' ? confirmKey.split('/').filter(Boolean).pop() : stripTimestamp(confirmKey)}</strong>
              <br/>
              {confirmType === 'permanent' ? (
                <span style={{color: '#ef4444', fontWeight: 600}}>This action cannot be undone. Area you sure?</span>
              ) : confirmType === 'folder' ? (
                <span>Are you sure you want to delete this folder and all its contents? This action is permanent.</span>
              ) : (
                <span>Versioning is ON — a Delete Marker will be placed. Previous versions remain recoverable.</span>
              )}
            </div>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmKey(null)}>Cancel</button>
              <button className="confirm-ok" onClick={confirmDelete}>{confirmType === 'trash' ? 'Move to Trash' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR RIGHT ────────────────────────────────────────────────── */}
      <aside className="sidebar-right">
        {selectedFile ? (
          <div className="file-details-panel" style={{animation: 'fadeIn 0.2s'}}>
            <div className="right-section-header">
              <h3>File Intelligence</h3>
              <button className="clear-btn" onClick={() => setSelectedFile(null)}>Close</button>
            </div>
            
            <div style={{background: 'var(--bg)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '1.5rem'}}>
              <div style={{display:'flex', justifyContent:'center', marginBottom: '1rem'}}>
                <div style={{width: 60, height:60, borderRadius: '12px', background: fileIcon(selectedFile.Key), display: 'flex', alignItems:'center', justifyContent: 'center', color: 'white'}}>
                   <FileText size={32} />
                </div>
              </div>
              <div style={{textAlign:'center', fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all'}}>{stripTimestamp(selectedFile.Key)}</div>
              <div style={{textAlign:'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem'}}>{selectedFile.Key.split('.').pop().toUpperCase()} File</div>
            </div>

            <div className="nav-section">
               <h4 style={{marginBottom: '0.75rem'}}>METADATA</h4>
               <div style={{display:'flex', flexDirection:'column', gap: '0.75rem', fontSize: '0.82rem'}}>
                 <div style={{display:'flex', justifyContent: 'space-between'}}><span color="var(--muted)">Size:</span> <strong>{formatSize(selectedFile.Size)}</strong></div>
                 <div style={{display:'flex', justifyContent: 'space-between'}}><span color="var(--muted)">Modified:</span> <strong>{new Date(selectedFile.LastModified).toLocaleDateString()}</strong></div>
                 <div style={{display:'flex', justifyContent: 'space-between'}}><span color="var(--muted)">Storage:</span> <strong style={{color: '#10b981'}}>Cloud Native</strong></div>
                 <div style={{display:'flex', justifyContent: 'space-between', alignItems:'flex-start'}}>
                    <span color="var(--muted)">S3 URI:</span> 
                    <strong style={{fontSize: '0.65rem', wordBreak: 'break-all', textAlign: 'right', marginLeft: '1rem', color: 'var(--muted)'}}>s3://{selectedFile.Key}</strong>
                 </div>
               </div>
            </div>

            <div className="nav-section" style={{marginTop: '1.5rem'}}>
               <h4>VERSIONING & SECURITY</h4>
               <div style={{marginTop: '0.75rem', padding: '0.85rem', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px'}}>
                  <div style={{display:'flex', alignItems:'center', gap: '0.5rem', marginBottom: '0.6rem'}}>
                    <ShieldCheck size={16} color="#10b981" />
                    <span style={{fontSize: '0.8rem', fontWeight: 600}}>Object Immutable</span>
                  </div>
                  <div style={{fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5}}>
                    This version is protected by S3 Object Lock. Data cannot be modified or deleted until the retention period expires.
                  </div>
               </div>
            </div>
          </div>
        ) : (
          <>
            <div className="right-section-header">
              <h3>Notifications</h3>
              {notifications.length > 0 && (
                <button className="clear-btn" onClick={() => setNotifications([])}>Clear</button>
              )}
            </div>
            {notifications.length === 0
              ? <div className="empty-panel"><Bell size={22} color="#cbd5e1"/><span>No notifications</span></div>
              : notifications.map(n => (
                <div key={n.id} className="notify-item">
                  <div className={`notify-icon-dot ${n.type}`}>{n.type==='success' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}</div>
                  <div>
                    <div className="notify-text">{n.text}</div>
                    <div className="notify-time">{timeAgo(n.time)}</div>
                  </div>
                </div>
              ))
            }

            <div style={{marginTop:'1.5rem'}}>
              <div className="right-section-header">
                <h3>Activities</h3>
                {activities.length > 0 && (
                  <button className="clear-btn" onClick={() => setActivities([])}>Clear</button>
                )}
              </div>
              {activities.length === 0
                ? <div className="empty-panel"><Activity size={22} color="#cbd5e1"/><span>No recent activity</span></div>
                : activities.map(a => (
                  <div key={a.id} className="notify-item">
                    <div className="activity-dot" style={{background: a.color}}/>
                    <div>
                      <div className="notify-text">{a.text}</div>
                      <div className="notify-time">{timeAgo(a.time)}</div>
                    </div>
                  </div>
                ))
              }
            </div>
          </>
        )}
      </aside>

      {/* ── PREVIEW MODAL ─────────────────────────────────────────────────── */}
      {previewFile && (
        <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-header">
              <div style={{fontWeight:600}}>{stripTimestamp(previewFile.key)}</div>
              <button className="icon-btn" onClick={() => setPreviewFile(null)}><X size={18}/></button>
            </div>
            <div className="preview-body">
              {previewFile.type === 'image' && <img src={previewFile.url} alt="Preview" />}
              {previewFile.type === 'pdf' && <iframe src={previewFile.url} title="PDF Preview" />}
              {previewFile.type === 'text' && <pre>{previewFile.content}</pre>}
              {previewFile.type === 'other' && (
                <div style={{color:'#fff', textAlign:'center', padding: '2rem'}}>
                  <FileText size={64} style={{marginBottom:'1.5rem', opacity: 0.5}}/>
                  <p style={{fontSize: '1.1rem'}}>Preview not available for this file type</p>
                  <p style={{fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem'}}>Extension: {previewFile.key.split('.').pop().toUpperCase()}</p>
                  <button className="confirm-cancel" style={{marginTop:'2rem', border: '1px solid #334155'}} onClick={() => downloadFile(previewFile.key)}>
                    <Download size={14} style={{marginRight: '0.5rem'}}/> Download to View
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function NavItem({ icon, label, active, onClick }) {
  return (
    <div className={`nav-item${active ? ' active' : ''}${!onClick ? ' disabled' : ''}`} onClick={onClick}>
      {icon} {label}
    </div>
  );
}

function StatCard({ icon, label, value, bg }) {
  return (
    <div className="stat-card" style={{background: bg}}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default App;
