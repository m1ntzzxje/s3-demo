import { useState, useEffect, useCallback } from 'react';
import API_URL, { apiCall } from '../services/api';

export default function useFileSystem(user, authHeaders, pushNotif, currentView) {
  const [files, setFiles] = useState([]);
  const [trashItems, setTrashItems] = useState([]);
  const [sharedItems, setSharedItems] = useState([]);
  const [deptFiles, setDeptFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [storageHistory, setStorageHistory] = useState([]);
  
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [navHistory, setNavHistory] = useState(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiCall('/stats', user.token, {}, () => {});
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
      if (data.usedPercent > 50) {
        pushNotif('warn', `Storage used over 50% (${data.usedPercent}%)`, 'alert');
      }
    } catch (err) {}
  }, [user, pushNotif]);

  const fetchFiles = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiCall('/files', user.token, {}, () => {});
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {}
  }, [user]);

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
      const res = await apiCall('/shared', user.token, {}, () => {});
      const data = await res.json();
      const newItems = Array.isArray(data) ? data : [];
      if (newItems.length > sharedItems.length) {
        pushNotif('info', `New file shared by ${newItems[0].owner_name}: ${newItems[0].filename}`, 'share');
      }
      setSharedItems(newItems);
    } catch {}
  }, [user, sharedItems.length, pushNotif]);

  const fetchDept = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/department`, { headers: authHeaders() });
      const data = await res.json();
      setDeptFiles(Array.isArray(data) ? data : []);
    } catch {}
  }, [user, authHeaders]);

  useEffect(() => {
    if (!user) return;
    fetchStats();
    const id = setInterval(fetchStats, 15000);
    return () => clearInterval(id);
  }, [fetchStats, user]);

  useEffect(() => {
    if (!stats || !user) return;
    const historyKey = `esoft_storage_history_${user.id}`;
    let currentHistory = storageHistory.length > 0 ? storageHistory : (JSON.parse(localStorage.getItem(historyKey) || '[]'));
    const lastPoint = currentHistory[currentHistory.length - 1];
    const newSize = stats.totalSizeBytes;
    const now = new Date();
    const timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');

    if (!lastPoint || lastPoint.cloudSize !== newSize || (now - new Date(lastPoint.timestamp)) > 600000) {
      const newPoint = { 
        name: timeStr, cloud: parseFloat((newSize / (1024 ** 3)).toFixed(5)), 
        local: parseFloat((newSize * 0.6 / (1024 ** 3)).toFixed(5)),
        cloudSize: newSize, timestamp: now.toISOString()
      };
      const updatedHistory = [...currentHistory, newPoint].slice(-10);
      setStorageHistory(updatedHistory);
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    }
  }, [stats, user, storageHistory]);

  useEffect(() => { if (currentView === 'My Files' && user) fetchFiles(); }, [currentView, fetchFiles, user]);
  useEffect(() => {
    if (!user) return;
    if (currentView === 'Trash') fetchTrash();
    if (currentView === 'Shared with me') fetchShared();
    if (currentView === 'Department') fetchDept();
  }, [currentView, user, fetchTrash, fetchShared, fetchDept]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchShared, 30000);
    return () => clearInterval(interval);
  }, [user, fetchShared]);

  const updatePrefixWithHistory = (newPrefix) => {
    if (newPrefix === currentPrefix) return;
    const newHistory = [...navHistory.slice(0, historyIndex + 1), newPrefix];
    setNavHistory(newHistory); setHistoryIndex(newHistory.length - 1);
    setCurrentPrefix(newPrefix); setSelectedFile(null);
  };
  const enterFolder = (folderName) => updatePrefixWithHistory(currentPrefix + folderName + '/');
  const enterBackups = () => updatePrefixWithHistory('!backups!');
  const goNavBack = () => { if (historyIndex > 0) { setHistoryIndex(historyIndex - 1); setCurrentPrefix(navHistory[historyIndex - 1]); setSelectedFile(null); } };
  const goNavForward = () => { if (historyIndex < navHistory.length - 1) { setHistoryIndex(historyIndex + 1); setCurrentPrefix(navHistory[historyIndex + 1]); setSelectedFile(null); } };
  const goBackTo = (index) => index === -1 ? updatePrefixWithHistory('') : updatePrefixWithHistory(currentPrefix.split('/').filter(Boolean).slice(0, index + 1).join('/') + '/');

  return {
    files, trashItems, sharedItems, deptFiles, stats, storageHistory,
    currentPrefix, navHistory, historyIndex, searchQuery, setSearchQuery,
    selectedFile, setSelectedFile, previewFile, setPreviewFile,
    fetchStats, fetchFiles, fetchTrash, fetchShared, fetchDept,
    enterFolder, enterBackups, goNavBack, goNavForward, goBackTo
  };
}
