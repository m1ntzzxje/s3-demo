import React from 'react';
import { Trash, RefreshCw, RotateCcw, Users, Download, Eye, Building2, UploadCloud } from 'lucide-react';
import { timeAgo, stripTimestamp, formatSize } from '../../utils/formatters';

export function TrashView({ trashItems, fetchTrash, restoreFile, permanentDelete }) {
  return (
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
  );
}

export function SharedView({ sharedItems, fetchShared }) {
  return (
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
  );
}

export function DepartmentView({ deptFiles, fetchDept, handleDeptUpload, deptUploading, deptInputRef, deptDownload, authHeaders, API_URL }) {
  return (
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
  );
}
