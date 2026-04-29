import React from 'react';
import './index.css';

import Auth from './Auth';
import API_URL from './services/api';
import useAppLogic from './hooks/useAppLogic';

// Utilities
import { buildChartData } from './utils/formatters';

// Components
import SidebarLeft from './components/layout/SidebarLeft';
import SidebarRight from './components/layout/SidebarRight';
import Header from './components/layout/Header';
import Dashboard from './components/dashboard/Dashboard';
import FileBrowser from './components/files/FileBrowser';
import ShareModal from './components/modals/ShareModal';
import PreviewModal from './components/modals/PreviewModal';
import ConfirmDialog from './components/modals/ConfirmDialog';
import { TrashView, SharedView, DepartmentView } from './components/files/OtherViews';
import SettingsView from './components/system/Settings';
import SyncMonitor from './components/system/SyncMonitor';

export default function App() {
  const {
    user, setUser, currentView, setCurrentView, notifications, setNotifications, activities, setActivities,
    files, uploading, backupStatus, stats, searchQuery, setSearchQuery, deletingKey, confirmKey,
    setConfirmKey, confirmType, downloadingKey, fileInputRef, folderInputRef, deptInputRef,
    trashItems, sharedItems, deptFiles, shareModalKey, setShareModalKey, shareEmail, setShareEmail, deptUploading,
    useLock, setUseLock, lockDays, setLockDays, isAutoBackup, setIsAutoBackup, autoBackupInterval, setAutoBackupInterval, isVersioning, setIsVersioning,
    isObjectLock, setIsObjectLock, currentPrefix, navHistory, historyIndex, storageHistory, selectedFile, setSelectedFile,
    previewFile, setPreviewFile, userSyncStatus, userSyncing, isDarkMode, setIsDarkMode, backupSchedule, setBackupSchedule, pushNotif, fetchStats, fetchFiles, fetchTrash,
    fetchShared, fetchDept, handleFileUpload, handleBackup, handleUserSyncTrigger, deleteFile, permanentDelete, openShareModal, submitShare,
    handleFolderUpload, enterFolder, enterBackups, goNavBack, goNavForward, goBackTo, restoreFile, handleDeptUpload,
    deptDownload, confirmDelete, handlePreview, downloadFile, handleFileMove, deleteFolder, authHeaders
  } = useAppLogic();

  if (!user) return <Auth onLoginSuccess={setUser} />;

  const isBackupsView = currentPrefix === '!backups!';
  const fullPrefix = isBackupsView ? `${user?.id}/backup/` : `${user?.id}/uploads/${currentPrefix}`;
  const searchedFiles = files.filter(f => f.Key.toLowerCase().includes(searchQuery.toLowerCase()));
  
  const foldersAtLevel = new Set();
  const filesAtLevel = [];
  searchedFiles.forEach(f => {
    if (f.Key.startsWith(fullPrefix) && f.Key !== fullPrefix) {
      const relativeKey = f.Key.slice(fullPrefix.length);
      const parts = relativeKey.split('/');
      if (parts.length > 1) foldersAtLevel.add(parts[0]);
      else filesAtLevel.push(f);
    }
  });

  const sortedFiles = [...filesAtLevel].sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
  const breadcrumbParts = isBackupsView ? ['System Backups'] : currentPrefix.split('/').filter(Boolean);
  const chartData = storageHistory.length > 2 ? storageHistory : stats ? buildChartData(stats.totalSizeBytes) : [];
  const usedPct = stats?.usedPercent ?? 0;
  const unreadCount = notifications.filter(n => n.type === 'error' || n.type === 'warn').length;

  return (
    <div className="layout">
      <SidebarLeft user={user} setUser={setUser} currentView={currentView} setCurrentView={setCurrentView} stats={stats} usedPct={usedPct} />

      <main className="main-content">
        <Header currentView={currentView} searchQuery={searchQuery} setSearchQuery={setSearchQuery} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} fetchStats={fetchStats} unreadCount={unreadCount} />

        <div className="dashboard-scroll">
          {currentView === 'Dashboard' && (
            <Dashboard 
              stats={stats} usedPct={usedPct} isDarkMode={isDarkMode} isAutoBackup={isAutoBackup} 
              setIsAutoBackup={setIsAutoBackup} pushNotif={pushNotif} isVersioning={isVersioning} 
              setIsVersioning={setIsVersioning} isObjectLock={isObjectLock} setIsObjectLock={setIsObjectLock} 
              chartData={chartData} userSyncStatus={userSyncStatus} userSyncing={userSyncing}
              handleUserSyncTrigger={handleUserSyncTrigger}
            />
          )}

          {currentView === 'My Files' && (
            <FileBrowser 
              uploading={uploading} handleFileUpload={handleFileUpload} fileInputRef={fileInputRef} folderInputRef={folderInputRef}
              handleFolderUpload={handleFolderUpload} useLock={useLock} setUseLock={setUseLock} lockDays={lockDays} setLockDays={setLockDays}
              backupStatus={backupStatus} handleBackup={handleBackup} historyIndex={historyIndex} navHistory={navHistory}
              goNavBack={goNavBack} goNavForward={goNavForward} goBackTo={goBackTo} breadcrumbParts={breadcrumbParts} currentPrefix={currentPrefix} 
              handleFileMove={handleFileMove} fetchFiles={fetchFiles} enterBackups={enterBackups} enterFolder={enterFolder}
              foldersAtLevel={foldersAtLevel} sortedFiles={sortedFiles} searchQuery={searchQuery} deletingKey={deletingKey}
              selectedFile={selectedFile} setSelectedFile={setSelectedFile} handlePreview={handlePreview} downloadFile={downloadFile}
              downloadingKey={downloadingKey} openShareModal={openShareModal} deleteFile={deleteFile} deleteFolder={deleteFolder}
            />
          )}

          {currentView === 'Trash' && (
            <TrashView trashItems={trashItems} fetchTrash={fetchTrash} restoreFile={restoreFile} permanentDelete={permanentDelete} />
          )}

          {currentView === 'Shared with me' && (
            <SharedView sharedItems={sharedItems} fetchShared={fetchShared} />
          )}

          {currentView === 'Department' && (
            <DepartmentView deptFiles={deptFiles} fetchDept={fetchDept} handleDeptUpload={handleDeptUpload} deptUploading={deptUploading} deptInputRef={deptInputRef} deptDownload={deptDownload} authHeaders={authHeaders} API_URL={API_URL} />
          )}

          {currentView === 'Settings' && (
            <SettingsView 
              isAutoBackup={isAutoBackup} setIsAutoBackup={setIsAutoBackup}
              autoBackupInterval={autoBackupInterval} setAutoBackupInterval={setAutoBackupInterval}
              backupSchedule={backupSchedule} setBackupSchedule={setBackupSchedule}
              pushNotif={pushNotif}
            />
          )}

          {currentView === 'Sync Monitor' && (
            <SyncMonitor token={user?.token} pushNotif={pushNotif} />
          )}
        </div>
      </main>

      <SidebarRight selectedFile={selectedFile} setSelectedFile={setSelectedFile} notifications={notifications} setNotifications={setNotifications} activities={activities} setActivities={setActivities} />

      <ShareModal shareModalKey={shareModalKey} setShareModalKey={setShareModalKey} shareEmail={shareEmail} setShareEmail={setShareEmail} submitShare={submitShare} />
      <PreviewModal previewFile={previewFile} setPreviewFile={setPreviewFile} downloadFile={downloadFile} />
      <ConfirmDialog confirmKey={confirmKey} confirmType={confirmType} setConfirmKey={setConfirmKey} confirmDelete={confirmDelete} />
    </div>
  );
}
