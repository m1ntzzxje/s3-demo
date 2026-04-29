import { useState, useEffect, useCallback } from 'react';
import API_URL, { syncApi } from '../services/api';

export default function useSync(
  user, authHeaders, pushNotif, pushActivity, isAutoBackup, autoBackupInterval, backupSchedule,
  fetchFiles, fetchStats
) {
  const [backupStatus, setBackupStatus] = useState(null);
  const [userSyncStatus, setUserSyncStatus] = useState(null);
  const [userSyncing, setUserSyncing] = useState(false);
  const [lastScheduledRun, setLastScheduledRun] = useState(null);

  const fetchUserSyncStatus = useCallback(async () => {
    if (!user) return;
    try {
      const res = await syncApi.getUserStatus(user.token);
      if (res.ok) setUserSyncStatus(await res.json());
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchUserSyncStatus();
    const id = setInterval(fetchUserSyncStatus, 15000);
    return () => clearInterval(id);
  }, [fetchUserSyncStatus, user]);

  const handleBackup = useCallback(async () => {
    if (backupStatus === 'running') return;
    setBackupStatus('running');
    pushActivity('Backup sync started', 'backup', '#8b5cf6');
    try {
      const res = await fetch(`${API_URL}/backup`, { method: 'POST', headers: authHeaders() });
      if (!res.ok) throw new Error('Backup failed');
      const data = await res.json();
      setBackupStatus('success');
      pushNotif('success', 'Backup completed successfully', 'success');
      pushActivity(`Backup synced — Checksum: ${data?.result?.checksum?.slice(0, 12)}...`, 'backup', '#10b981');
      if (fetchFiles) await fetchFiles();
      if (fetchStats) await fetchStats();
      setTimeout(() => setBackupStatus(null), 3000);
    } catch (err) {
      setBackupStatus('error');
      pushNotif('error', 'Backup failed', 'error');
      pushActivity('Backup failed', 'backup', '#ef4444');
      setTimeout(() => setBackupStatus(null), 4000);
    }
  }, [authHeaders, backupStatus, pushActivity, pushNotif, fetchFiles, fetchStats]);

  const handleUserSyncTrigger = useCallback(async () => {
    if (userSyncing) return;
    setUserSyncing(true);
    pushActivity('Personal hard-copy backup initiated', 'shield', '#3b82f6');
    try {
      const res = await syncApi.triggerUserSync(user.token);
      if (!res.ok) throw new Error();
      pushNotif('info', 'Hard-copy sync running in background', 'shield');
      setTimeout(fetchUserSyncStatus, 2000);
    } catch {
      pushNotif('error', 'Failed to trigger personal backup', 'error');
    } finally {
      setTimeout(() => setUserSyncing(false), 5000);
    }
  }, [user, userSyncing, fetchUserSyncStatus, pushActivity, pushNotif]);

  const handleTransitPush = useCallback(async () => {
    if (userSyncing) return;
    try {
      const res = await syncApi.triggerPush(user.token);
      if (res.ok) {
        pushNotif('info', 'Pushed local changes to Transit Hub', 'cloud');
        setTimeout(fetchUserSyncStatus, 2000);
      }
    } catch {}
  }, [user, userSyncing, fetchUserSyncStatus, pushNotif]);

  const handleServer2Pull = useCallback(async () => {
    if (userSyncing) return;
    try {
      const res = await syncApi.triggerPull(user.token);
      if (res.ok) {
        pushNotif('success', 'Server 2 is securely pulling data from Transit Hub', 'hard-drive');
        setTimeout(fetchUserSyncStatus, 2000);
      }
    } catch {}
  }, [user, userSyncing, fetchUserSyncStatus, pushNotif]);

  useEffect(() => {
    if (!isAutoBackup || !user) return;
    const interval = setInterval(() => handleTransitPush(), autoBackupInterval * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAutoBackup, autoBackupInterval, user, handleTransitPush]);

  useEffect(() => {
    if (!isAutoBackup || !user || backupSchedule.length === 0) return;

    const checkSchedule = setInterval(() => {
      const now = new Date();
      const currentTS = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
      
      if (backupSchedule.includes(currentTS) && lastScheduledRun !== currentTS) {
        setLastScheduledRun(currentTS);
        handleServer2Pull();
        pushNotif('info', `Scheduled Server 2 Pull triggered at ${currentTS}`, 'clock');
      }
    }, 30000); // Check every 30s

    return () => clearInterval(checkSchedule);
  }, [isAutoBackup, user, backupSchedule, lastScheduledRun, handleServer2Pull, pushNotif]);

  return {
    backupStatus, userSyncStatus, userSyncing,
    fetchUserSyncStatus, handleBackup, handleUserSyncTrigger
  };
}
