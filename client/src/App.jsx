import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Database, UploadCloud, FileText, RefreshCw, Eye, Trash2, Download,
  LayoutDashboard, Folder, Users, Trash, FileStack, Settings,
  Search, Bell, Lock, ShieldCheck, CheckCircle2, AlertCircle,
  HardDrive, CloudUpload, Archive, Activity, X, RotateCcw, Share2, Building2
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './index.css';
import Auth from './Auth';

const API_URL = 'http://localhost:3000/api';

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

const fileIcon = (key) => {
  const ext = key.split('.').pop().toLowerCase();
  const colors = { json: '#10b981', doc: '#3b82f6', docx: '#3b82f6', pdf: '#ef4444', png: '#8b5cf6', jpg: '#8b5cf6', jpeg: '#8b5cf6', txt: '#64748b' };
  return colors[ext] || '#64748b';
};

// Simulate monthly storage data points based on real current usage
const buildChartData = (usedBytes) => {
  const gb = usedBytes / (1024 ** 3);
  return [
    { name: 'Jan', cloud: parseFloat((gb * 0.3).toFixed(3)), local: parseFloat((gb * 0.15).toFixed(3)) },
    { name: 'Feb', cloud: parseFloat((gb * 0.45).toFixed(3)), local: parseFloat((gb * 0.25).toFixed(3)) },
    { name: 'Mar', cloud: parseFloat((gb * 0.5).toFixed(3)), local: parseFloat((gb * 0.3).toFixed(3)) },
    { name: 'Apr', cloud: parseFloat((gb * 0.7).toFixed(3)), local: parseFloat((gb * 0.4).toFixed(3)) },
    { name: 'Now', cloud: parseFloat(gb.toFixed(3)), local: parseFloat((gb * 0.6).toFixed(3)) },
  ];
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
  const [backupStatus, setBackupStatus] = useState(null); // null | 'running' | 'success' | 'error'
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingKey, setDeletingKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);        // key pending confirmation
  const [downloadingKey, setDownloadingKey] = useState(null);
  const fileInputRef = useRef(null);
  const deptInputRef = useRef(null);

  // ─── New workspace states ─────────────────────────────────────────────────
  const [trashItems, setTrashItems] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [deptFiles, setDeptFiles] = useState([]);
  const [shareModalKey, setShareModalKey] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [deptUploading, setDeptUploading] = useState(false);
  const [lockDays, setLockDays] = useState(0);

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

  // ── Handler: Upload ────────────────────────────────────────────────────────
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      pushNotif('error', `Upload failed: ${file.name} exceeds 20MB limit`, 'error');
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
    formData.append('lock_days', lockDays.toString());
    setUploading(true);
    pushActivity(`Uploading: ${file.name}`, 'upload', '#3b82f6');
    try {
      const res = await apiCall(`${API_URL}/upload`, { 
        method: 'POST', 
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Upload failed');

      // Check for content-duplicate warning from backend
      if (data.is_content_duplicate) {
        pushNotif('warn', `Content match: ${file.name} already backed up (Deduplicated)`, 'alert');
      } else {
        pushNotif('success', `File uploaded: ${file.name}`, 'success');
      }

      pushActivity(`Uploaded: ${file.name} (${formatSize(file.size)})`, 'upload', '#10b981');
      await fetchFiles();
      await fetchStats();
    } catch (err) {
      pushNotif('error', `Upload failed: ${err.message}`, 'error');
      pushActivity(`Upload failed: ${file.name}`, 'upload', '#ef4444');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Handler: Backup ────────────────────────────────────────────────────────
  const handleBackup = async () => {
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
  };

  // ── Handler: Delete ────────────────────────────────────────────────────────
  const deleteFile = async (key) => {
    // Use inline confirmation state instead of window.confirm (which browsers block)
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
      pushNotif('success', `Shared "${shareModalKey.split('/').pop()}" with ${shareEmail}`, 'success');
      pushActivity(`Shared: ${shareModalKey.split('/').pop()} → ${shareEmail}`, 'share', '#3b82f6');
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
      pushNotif('success', `Restored: ${key.split('/').pop()}`, 'success');
      pushActivity(`Restored: ${key.split('/').pop()}`, 'restore', '#10b981');
      fetchTrash();
    } catch (err) {
      pushNotif('error', `Restore failed: ${err.message}`, 'error');
    }
  };

  // ── Handler: Permanent Delete ─────────────────────────────────────────────
  const permanentDelete = async (key) => {
    try {
      const res = await fetch(`${API_URL}/trash/permanent?key=${encodeURIComponent(key)}`, {
        method: 'DELETE', headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      pushNotif('success', `Permanently deleted: ${key.split('/').pop()}`, 'success');
      fetchTrash();
    } catch (err) {
      pushNotif('error', `Delete failed: ${err.message}`, 'error');
    }
  };

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
        a.href = data.url; a.download = key.split('/').pop();
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      }
    } catch {}
  };

  const confirmDelete = async () => {
    const key = confirmKey;
    const name = key.split('/').pop();
    setConfirmKey(null);
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
  };

  // ── Handler: Preview ──────────────────────────────────────────────────────
  const previewFile = async (key) => {
    try {
      const res = await fetch(`${API_URL}/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
        pushActivity(`Previewed: ${key.split('/').pop()}`, 'preview', '#64748b');
      }
    } catch (err) {
      pushNotif('error', `Preview failed: ${key.split('/').pop()}`, 'error');
    }
  };

  // ── Handler: Download (force download) ────────────────────────────────────
  const downloadFile = async (key) => {
    const name = key.split('/').pop();
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

  // ── Derived ────────────────────────────────────────────────────────────────
  // Sort newest first, then filter
  const sortedFiles = [...files].sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  const filteredFiles = sortedFiles.filter(f => f.Key.toLowerCase().includes(searchQuery.toLowerCase()));
  const chartData = stats ? buildChartData(stats.totalSizeBytes) : [];
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
            <div className="progress-bg" style={{ width: `${Math.min(usedPct, 100)}%`, background: usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#334155' }}/>
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
                <StatCard icon={<HardDrive size={20} color="#3b82f6"/>} label="Total Objects" value={stats?.totalFiles ?? '—'} bg="#eff6ff"/>
                <StatCard icon={<CloudUpload size={20} color="#10b981"/>} label="Uploaded Files" value={stats?.uploadsCount ?? '—'} bg="#f0fdf4"/>
                <StatCard icon={<Archive size={20} color="#8b5cf6"/>} label="Backup Versions" value={stats?.backupsCount ?? '—'} bg="#f5f3ff"/>
                <StatCard icon={<Activity size={20} color="#f59e0b"/>} label="Storage Used" value={stats ? `${usedPct}%` : '—'} bg="#fffbeb"/>
              </div>

              {/* Backup + Data Protection cards */}
              <div className="dashboard-border">
                <div className="grid-2">
                  <div className="card">
                    <div className="card-title"><ShieldCheck size={20} color="#10b981"/> Backup Status</div>
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
                        <span style={{fontSize:'0.8rem',color:'#10b981',fontWeight:700}}>ON</span>
                        <div className="toggle-switch on"/>
                      </div>
                    </div>
                    <div className="toggle-row" style={{marginBottom:0}}>
                      <span>Object Lock (Immutable)</span>
                      <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                        <span style={{fontSize:'0.8rem',color:'#10b981',fontWeight:700}}>ON</span>
                        <div className="toggle-switch on"/>
                      </div>
                    </div>
                    <div style={{marginTop:'1.25rem', padding:'0.75rem', background:'#f0fdf4', borderRadius:'6px', fontSize:'0.78rem', color:'#16a34a'}}>
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
                        <Line type="monotone" dataKey="cloud" stroke="#334155" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
                        <Line type="monotone" dataKey="local" stroke="#93c5fd" strokeWidth={2} strokeDasharray="5 5" dot={{r:3}}/>
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
              <div className="files-actions-row">
                <div className="action-card" title="Upload a file (max 20MB)">
                  <label style={{cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                    <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileUpload} disabled={uploading}/>
                    <UploadCloud size={28} style={{color: uploading ? '#94a3b8' : '#3b82f6'}}/>
                    <div className="action-card-title">{uploading ? 'Uploading...' : 'Upload File'}</div>
                  </label>
                  <div className="action-card-sub" style={{marginBottom: '0.5rem'}}>Max 20 MB · Company Plan</div>
                  <div style={{display:'flex', alignItems:'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.75rem', marginTop: 'auto'}}>
                    <Lock size={12} color="#f59e0b" /> Object Lock Days: 
                    <input type="number" min="0" max="3650" value={lockDays} onChange={e => setLockDays(Number(e.target.value))} style={{width:'40px', padding:'0.1rem', fontSize:'0.75rem', textAlign:'center', border:'1px solid #cbd5e1', borderRadius:'4px'}} onClick={e => e.stopPropagation()} />
                  </div>
                  {uploading && <div className="upload-progress-bar"><div className="upload-progress-inner"/></div>}
                </div>

                <div className={`action-card ${backupStatus === 'running' ? 'running' : ''}`} onClick={handleBackup}>
                  <RefreshCw size={28} className={backupStatus==='running' ? 'spin' : ''} style={{color: backupStatus==='error' ? '#ef4444' : backupStatus==='success' ? '#10b981' : '#8b5cf6'}}/>
                  <div className="action-card-title">
                    {backupStatus === 'running' ? 'Replicating...' : backupStatus === 'success' ? 'Synced ✓' : backupStatus === 'error' ? 'Sync Failed ✗' : 'Run Hybrid Backup'}
                  </div>
                  <div className="action-card-sub">
                    {backupStatus === 'success' ? `Last: ${timeAgo(stats?.lastBackupTime)}` : 'RPO ≈ 0 · Incremental'}
                  </div>
                </div>
              </div>

              <div className="files-section-header">
                <h3>Object Browser</h3>
                <button className="icon-btn" onClick={fetchFiles}><RefreshCw size={15}/></button>
              </div>

              {filteredFiles.length === 0 ? (
                <div className="empty-state">
                  <Folder size={36} color="#cbd5e1"/>
                  <span>{searchQuery ? 'No files match your search' : 'No objects in bucket yet'}</span>
                </div>
              ) : (
                <ul className="file-list">
                  {filteredFiles.map(file => {
                    const parts = file.Key.split('/');
                    const name = parts.pop();
                    // folder should be the part after the user ID prefix, which is parts[1] since parts[0] is user ID
                    const folder = parts.length > 1 ? parts[1] : 'root';
                    const isDeleting = deletingKey === file.Key;
                    return (
                      <li key={file.Key} className={`file-item ${isDeleting ? 'deleting' : ''}`}>
                        <div className="file-info">
                          <div className="file-type-dot" style={{background: fileIcon(file.Key)}}/>
                          <div>
                            <div className="file-name">{name}</div>
                            <div className="file-meta">
                              <span className="file-tag">{folder || 'root'}</span>
                              {formatSize(file.Size)} · {new Date(file.LastModified).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div style={{display:'flex', gap:'0.4rem'}}>
                          <button className="icon-action-btn blue" title="Preview / Open in browser" onClick={() => previewFile(file.Key)} disabled={isDeleting}>
                            <Eye size={14}/>
                          </button>
                          <button
                            className="icon-action-btn teal"
                            title="Download file"
                            onClick={() => downloadFile(file.Key)}
                            disabled={isDeleting || downloadingKey === file.Key}
                          >
                            <Download size={14}/>
                          </button>
                          <button className="icon-action-btn teal" title="Share file" onClick={() => openShareModal(file.Key)} disabled={isDeleting}>
                            <Share2 size={14}/>
                          </button>
                          <button className="icon-action-btn red" title="Delete" onClick={() => deleteFile(file.Key)} disabled={isDeleting || !!deletingKey}>
                            <Trash2 size={14}/>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
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
                const name = item.Key.split('/').pop();
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
                    <div className="shared-item-name">{item.filename}</div>
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
                const parts = file.Key.split('/');
                const name = parts.pop();
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
            <p>Share <strong>{shareModalKey.split('/').pop()}</strong> with another user</p>
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
            <div className="confirm-title">Delete File?</div>
            <div className="confirm-desc">
              <strong>{confirmKey.split('/').pop()}</strong>
              <br/>
              <span>Versioning is ON — a Delete Marker will be placed. Previous versions remain recoverable.</span>
            </div>
            <div className="confirm-actions">
              <button className="confirm-cancel" onClick={() => setConfirmKey(null)}>Cancel</button>
              <button className="confirm-ok" onClick={confirmDelete}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIDEBAR RIGHT ────────────────────────────────────────────────── */}
      <aside className="sidebar-right">
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
      </aside>
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
