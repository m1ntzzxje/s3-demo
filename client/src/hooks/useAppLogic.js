import { useState, useEffect } from 'react';
import useAuth from './useAuth';
import useSettings from './useSettings';
import useNotifications from './useNotifications';
import useFileSystem from './useFileSystem';
import useFileOperations from './useFileOperations';
import useSync from './useSync';

export default function useAppLogic() {
  const { user, setUser, authHeaders } = useAuth();
  
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('esoft_current_view') || 'Dashboard');
  useEffect(() => { localStorage.setItem('esoft_current_view', currentView); }, [currentView]);

  const settings = useSettings();
  const notifications = useNotifications(user);
  
  const fileSystem = useFileSystem(
    user, authHeaders, notifications.pushNotif, currentView
  );

  const fileOps = useFileOperations(
    user, authHeaders, fileSystem.currentPrefix, settings.useLock, settings.lockDays, fileSystem.files,
    notifications.pushNotif, notifications.pushActivity, fileSystem.fetchFiles, fileSystem.fetchStats, fileSystem.fetchTrash, fileSystem.fetchDept
  );

  const sync = useSync(
    user, authHeaders, notifications.pushNotif, notifications.pushActivity, 
    settings.isAutoBackup, settings.autoBackupInterval, settings.backupSchedule,
    fileSystem.fetchFiles, fileSystem.fetchStats
  );

  const handlePreviewAdapter = (key) => {
    fileOps.handlePreview(key, fileSystem.setPreviewFile);
  };

  return {
    user, setUser, authHeaders, currentView, setCurrentView,
    
    ...settings,
    ...notifications,
    ...fileSystem,
    ...fileOps,
    ...sync,

    handlePreview: handlePreviewAdapter
  };
}
