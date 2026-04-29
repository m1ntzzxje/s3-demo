import { useState, useEffect } from 'react';

export default function useSettings() {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('esoft_theme') === 'dark');
  const [useLock, setUseLock] = useState(false);
  const [lockDays, setLockDays] = useState(0);
  const [isAutoBackup, setIsAutoBackup] = useState(() => localStorage.getItem('esoft_auto_backup') === 'true');
  
  const [autoBackupInterval, setAutoBackupInterval] = useState(() => {
    try {
      const saved = localStorage.getItem('esoft_auto_backup_interval');
      return saved ? parseInt(saved, 10) : 5;
    } catch { return 5; }
  });
  
  const [backupSchedule, setBackupSchedule] = useState(() => {
    try {
      const saved = localStorage.getItem('esoft_backup_schedule');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [isVersioning, setIsVersioning] = useState(true);
  const [isObjectLock, setIsObjectLock] = useState(true);

  useEffect(() => {
    localStorage.setItem('esoft_theme', isDarkMode ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('esoft_auto_backup', isAutoBackup);
    localStorage.setItem('esoft_auto_backup_interval', autoBackupInterval);
  }, [isAutoBackup, autoBackupInterval]);

  useEffect(() => {
    localStorage.setItem('esoft_backup_schedule', JSON.stringify(backupSchedule));
  }, [backupSchedule]);

  return {
    isDarkMode, setIsDarkMode,
    useLock, setUseLock,
    lockDays, setLockDays,
    isAutoBackup, setIsAutoBackup,
    autoBackupInterval, setAutoBackupInterval,
    backupSchedule, setBackupSchedule,
    isVersioning, setIsVersioning,
    isObjectLock, setIsObjectLock
  };
}
