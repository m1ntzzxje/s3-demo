import React from 'react';
import { UploadCloud, Folder, RefreshCw, Lock, CloudUpload, Archive } from 'lucide-react';
import Breadcrumbs from './Breadcrumbs';
import FolderItem from './FolderItem';
import FileItem from './FileItem';

export default function FileBrowser({
  uploading,
  handleFileUpload,
  fileInputRef,
  folderInputRef,
  handleFolderUpload,
  useLock,
  setUseLock,
  lockDays,
  setLockDays,
  backupStatus,
  handleBackup,
  historyIndex,
  navHistory,
  goNavBack,
  goNavForward,
  goBackTo,
  breadcrumbParts,
  currentPrefix,
  handleFileMove,
  fetchFiles,
  enterBackups,
  enterFolder,
  foldersAtLevel,
  sortedFiles,
  searchQuery,
  deletingKey,
  selectedFile,
  setSelectedFile,
  handlePreview,
  downloadFile,
  downloadingKey,
  openShareModal,
  deleteFile,
  deleteFolder
}) {
  return (
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
                <input type="number" min="0" max="3650" value={lockDays} onChange={e => setLockDays(Number(e.target.value))} style={{width:'45px', padding:'0.1rem', fontSize:'0.75rem', fontWeight: 800, textAlign:'center', border:'none', background:'transparent', color:'var(--text)'}} />
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

      <Breadcrumbs 
        historyIndex={historyIndex} navHistory={navHistory} 
        goNavBack={goNavBack} goNavForward={goNavForward} 
        goBackTo={goBackTo} breadcrumbParts={breadcrumbParts} 
        currentPrefix={currentPrefix} handleFileMove={handleFileMove} 
      />

      <div className="files-section-header">
        <h3>Object Browser</h3>
        <button className="icon-btn" title="Refresh list" onClick={fetchFiles}><RefreshCw size={14}/></button>
      </div>

      <div className="file-list">
        {currentPrefix === '' && (
          <div className="folder-item" onClick={enterBackups} style={{background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)'}}>
            <div className="folder-icon" style={{color: '#3b82f6'}}><Archive size={20} /></div>
            <div className="file-name" style={{fontWeight: 700}}>System Backups</div>
            <div className="owner-badge" style={{marginLeft: 'auto'}}>pinned</div>
          </div>
        )}

        {[...foldersAtLevel].sort().map(folder => (
          <FolderItem 
            key={folder} folder={folder} 
            onClick={() => enterFolder(currentPrefix + folder + '/')} 
            onDrop={handleFileMove} 
            deleteFolder={deleteFolder} 
          />
        ))}

        {sortedFiles.length === 0 && foldersAtLevel.size === 0 ? (
          <div className="empty-state">
            <CloudUpload size={48} color="var(--border)" strokeWidth={1} />
            <p>{searchQuery ? 'No results found' : 'No objects in this path'}</p>
          </div>
        ) : (
          sortedFiles.map(file => (
            <FileItem 
              key={file.Key} file={file} 
              deletingKey={deletingKey} 
              selectedFile={selectedFile} setSelectedFile={setSelectedFile} 
              handlePreview={handlePreview} downloadFile={downloadFile} 
              downloadingKey={downloadingKey} openShareModal={openShareModal} 
              deleteFile={deleteFile} 
            />
          ))
        )}
      </div>
    </div>
  );
}
