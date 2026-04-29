import { useState, useCallback, useRef } from 'react';
import API_URL, { apiCall } from '../services/api';
import { formatSize, stripTimestamp } from '../utils/formatters';

export default function useFileOperations(
  user, authHeaders, currentPrefix, useLock, lockDays, files,
  pushNotif, pushActivity, fetchFiles, fetchStats, fetchTrash, fetchDept
) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [deletingKey, setDeletingKey] = useState(null);
  const [confirmKey, setConfirmKey] = useState(null);
  const [confirmType, setConfirmType] = useState('trash');
  const [downloadingKey, setDownloadingKey] = useState(null);
  const [shareModalKey, setShareModalKey] = useState(null);
  const [shareEmail, setShareEmail] = useState('');
  const [deptUploading, setDeptUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const deptInputRef = useRef(null);

  const uploadWithRetry = useCallback(async (formData, fileName, maxAttempts = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        setUploadRetryCount(attempt);
        const res = await apiCall('/upload', user.token, { method: 'POST', body: formData }, () => {});
        const data = await res.json();
        if (res.status === 400 && data.detail?.includes('20MB')) throw Object.assign(new Error(`File "${fileName}" exceeds the 20MB limit`), { noRetry: true });
        if (res.status === 400 && data.detail?.includes('blocked')) throw Object.assign(new Error(data.detail), { noRetry: true });
        if (!res.ok) throw new Error(`S3 Error: ${data.detail || res.status}`);
        return data;
      } catch (err) {
        lastError = err;
        if (err.noRetry) throw err;
        if (attempt < maxAttempts) {
          pushNotif('warn', `Upload attempt ${attempt} failed — retrying...`, 'alert');
          await new Promise(r => setTimeout(r, attempt * 1500));
        }
      }
    }
    throw lastError;
  }, [user, pushNotif]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      pushNotif('error', `Rejected: "${file.name}" exceeds 20MB`, 'error');
      pushActivity(`Rejected (too large): ${file.name}`, 'upload', '#ef4444');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const blockedExts = ['.exe','.bat','.cmd','.sh','.msi','.dll','.scr','.ps1','.vbs','.jar','.reg'];
    if (blockedExts.includes(file.name.slice(file.name.lastIndexOf('.')).toLowerCase())) {
      pushNotif('error', `Rejected: "${file.name}" blocked for security`, 'error');
      pushActivity(`Rejected (blocked type): ${file.name}`, 'upload', '#ef4444');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (files.some(f => f.Key.endsWith(file.name)) && !window.confirm(`File "${file.name}" exists. Upload new version?`)) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('lock_days', useLock ? lockDays.toString() : "0");
    formData.append('prefix', currentPrefix);

    setUploading(true);
    setUploadError(null);
    pushActivity(`Uploading: ${file.name}`, 'upload', '#3b82f6');

    try {
      const data = await uploadWithRetry(formData, file.name);
      pushNotif(data.is_content_duplicate ? 'warn' : 'success', data.is_content_duplicate ? `Content match: "${file.name}" Deduplicated` : `File uploaded: ${file.name}`, data.is_content_duplicate ? 'alert' : 'success');
      pushActivity(`Uploaded: ${file.name} (${formatSize(file.size)})`, 'upload', '#10b981');
      await fetchFiles();
      await fetchStats();
    } catch (err) {
      pushNotif('error', `Upload failed: ${err.message}`, 'error');
      pushActivity(`Upload failed: ${file.name}`, 'upload', '#ef4444');
    } finally {
      setUploading(false);
      setUploadRetryCount(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
      const relativePath = file.webkitRelativePath || '';
      formData.append('prefix', currentPrefix + (relativePath.substring(0, relativePath.lastIndexOf('/')) ? relativePath.substring(0, relativePath.lastIndexOf('/')) + '/' : ''));
      formData.append('lock_days', useLock ? lockDays.toString() : "0");
      try { await uploadWithRetry(formData, file.name, 1); successCount++; } catch (err) {}
    }
    pushNotif('success', `Uploaded ${successCount} files`, 'success');
    await fetchFiles();
    await fetchStats();
    setUploading(false);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleDeptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData(); formData.append('file', file); setDeptUploading(true);
    try {
      const res = await fetch(`${API_URL}/department/upload`, { method: 'POST', body: formData, headers: authHeaders() });
      if (!res.ok) throw new Error(); pushNotif('success', `Uploaded: ${file.name}`, 'success'); fetchDept();
    } catch (err) { pushNotif('error', `Dept upload failed`, 'error'); }
    setDeptUploading(false); if (deptInputRef.current) deptInputRef.current.value = '';
  };

  const deleteFile = (key) => { setConfirmType('trash'); setConfirmKey(key); };
  const permanentDelete = (key) => { setConfirmType('permanent'); setConfirmKey(key); };
  const openShareModal = (key) => { setShareModalKey(key); setShareEmail(''); };
  const deleteFolder = (folderName) => { setConfirmType('folder'); setConfirmKey((currentPrefix === '!backups!' ? `${user?.id}/backup/` : `${user?.id}/uploads/${currentPrefix}`) + folderName + '/'); };

  const submitShare = async () => {
    if (!shareEmail.trim() || !shareModalKey) return;
    try {
      const res = await fetch(`${API_URL}/share`, {
        method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: shareModalKey, target_email: shareEmail.trim() })
      });
      if (!res.ok) throw new Error((await res.json()).detail);
      pushNotif('success', `Shared "${stripTimestamp(shareModalKey)}" with ${shareEmail}`, 'success');
      pushActivity(`Shared: ${stripTimestamp(shareModalKey)} → ${shareEmail}`, 'share', '#3b82f6');
      setShareModalKey(null);
    } catch (err) { pushNotif('error', err.message, 'error'); }
  };

  const confirmDelete = async () => {
    const key = confirmKey; const type = confirmType; setConfirmKey(null);
    try {
      if (type === 'trash') {
        const res = await fetch(`${API_URL}/files?key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) throw new Error(); pushNotif('warn', `Moved to Trash`, 'trash'); await fetchFiles(); await fetchStats();
      } else if (type === 'permanent') {
        const res = await fetch(`${API_URL}/trash/permanent?key=${encodeURIComponent(key)}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) throw new Error(); pushNotif('success', `Deleted permanently`, 'success'); fetchTrash(); fetchStats();
      } else if (type === 'folder') {
        const res = await apiCall(`/folders?prefix=${encodeURIComponent(key)}`, user.token, { method: 'DELETE' }, () => {});
        if (!res.ok) throw new Error(); pushNotif('success', `Folder deleted`, 'success'); await fetchFiles(); await fetchStats();
      }
    } catch (err) { pushNotif('error', `Action failed`, 'error'); }
  };

  const handlePreview = async (key, setPreviewFile) => {
    try {
      const res = await fetch(`${API_URL}/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) {
        const ext = key.split('.').pop().toLowerCase();
        let type = 'other'; let content = null;
        if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) type = 'image'; else if (ext === 'pdf') type = 'pdf'; else if (['txt','json','md','csv'].includes(ext)) type = 'text';
        if (type === 'text') content = await (await fetch(data.url)).text();
        setPreviewFile({ key, url: data.url, type, content });
      }
    } catch (err) { pushNotif('error', `Preview failed`, 'error'); }
  };

  const downloadFile = async (key) => {
    setDownloadingKey(key);
    try {
      const res = await fetch(`${API_URL}/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) { const a = document.createElement('a'); a.href = data.url; document.body.appendChild(a); a.click(); document.body.removeChild(a); pushNotif('success', `Downloading...`, 'success'); }
    } catch (err) { pushNotif('error', `Download failed`, 'error'); }
    setDownloadingKey(null);
  };

  const deptDownload = async (key) => {
    try {
      const res = await fetch(`${API_URL}/department/download?key=${encodeURIComponent(key)}`, { headers: authHeaders() });
      const data = await res.json();
      if (data.url) { const a = document.createElement('a'); a.href = data.url; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
    } catch {}
  };

  const handleFileMove = async (sourceKey, targetFolder) => {
    const parts = sourceKey.split('/'); const currentFolder = parts.slice(2, -1).join('/') + '/'; 
    if (currentFolder === targetFolder || (currentFolder === '/' && targetFolder === '')) return;
    try {
      const res = await apiCall('/files/move', user.token, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_key: sourceKey, target_folder: targetFolder }) }, () => {});
      if (!res.ok) throw new Error(); pushNotif('success', `Moved successfully`, 'success'); await fetchFiles();
    } catch (err) { pushNotif('error', `Move failed`, 'error'); }
  };

  const restoreFile = async (key) => {
    try {
      const res = await fetch(`${API_URL}/trash/restore?key=${encodeURIComponent(key)}`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json()).detail);
      pushNotif('success', `Restored: ${stripTimestamp(key)}`, 'success'); fetchTrash();
    } catch (err) { pushNotif('error', `Restore failed`, 'error'); }
  };

  return {
    uploading, uploadError, uploadRetryCount, deletingKey, confirmKey, confirmType, downloadingKey, deptUploading,
    shareModalKey, shareEmail, setShareEmail, fileInputRef, folderInputRef, deptInputRef,
    handleFileUpload, handleFolderUpload, handleDeptUpload, deleteFile, permanentDelete, deleteFolder,
    openShareModal, submitShare, confirmDelete, handlePreview, downloadFile, deptDownload, handleFileMove, restoreFile,
    setShareModalKey, setConfirmKey
  };
}
