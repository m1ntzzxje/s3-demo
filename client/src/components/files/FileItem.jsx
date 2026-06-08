import React from 'react';
import { Eye, Download, Share2, Trash2, ShieldCheck, RefreshCw, Cloud, CloudOff, Clock } from 'lucide-react';
import { formatSize, timeAgo, fileIcon, stripTimestamp } from '../../utils/formatters';

export default function FileItem({ 
  file, 
  deletingKey, 
  selectedFile, 
  setSelectedFile, 
  handlePreview, 
  downloadFile, 
  downloadingKey, 
  openShareModal, 
  deleteFile,
  handleToggleSync,
  handleUpdateSchedule
}) {
  const isDeleting = deletingKey === file.Key;
  const syncEnabled = file.sync_enabled !== false; 
  const syncSchedule = file.sync_schedule || 'daily';
  
  return (
    <div 
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
            {syncEnabled && (
              <span className="file-tag" style={{background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px'}}>
                <Clock size={10} /> {syncSchedule}
              </span>
            )}
            <span>{formatSize(file.Size)} • {timeAgo(file.LastModified)}</span>
          </div>
        </div>
      </div>
      <div className="header-actions" style={{gap: '0.4rem'}}>
        {syncEnabled && (
          <select 
            className="schedule-select"
            value={syncSchedule}
            onChange={(e) => handleUpdateSchedule(file.Key, e.target.value)}
            style={{fontSize: '0.65rem', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', cursor: 'pointer'}}
          >
            <option value="immediate">Real-time</option>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="manual">Manual</option>
          </select>
        )}
        <button 
          className={`icon-action-btn ${syncEnabled ? 'blue' : ''}`} 
          title={syncEnabled ? "Backup Enabled" : "Backup Disabled"} 
          onClick={(e) => { e.stopPropagation(); handleToggleSync(file.Key, syncEnabled); }}
          style={{background: syncEnabled ? 'rgba(59, 130, 246, 0.1)' : 'var(--panel)', color: syncEnabled ? '#3b82f6' : 'var(--muted)'}}
        >
          {syncEnabled ? <Cloud size={15}/> : <CloudOff size={15}/>}
        </button>
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
}
