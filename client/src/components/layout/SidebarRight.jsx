import React from 'react';
import { FileText, Bell, Activity, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import { formatSize, timeAgo, fileIcon, stripTimestamp } from '../../utils/formatters';

export default function SidebarRight({ 
  selectedFile, 
  setSelectedFile, 
  notifications, 
  setNotifications, 
  activities, 
  setActivities 
}) {
  return (
    <aside className="sidebar-right">
      {selectedFile ? (
        <div className="file-details-panel" style={{animation: 'fadeIn 0.2s'}}>
          <div className="right-section-header">
            <h3>File Intelligence</h3>
            <button className="clear-btn" onClick={() => setSelectedFile(null)}>Close</button>
          </div>
          
          <div style={{background: 'var(--bg)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '1.5rem'}}>
            <div style={{display:'flex', justifyContent:'center', marginBottom: '1rem'}}>
              <div style={{width: 60, height:60, borderRadius: '12px', background: fileIcon(selectedFile.Key), display: 'flex', alignItems:'center', justifyContent: 'center', color: 'white'}}>
                 <FileText size={32} />
              </div>
            </div>
            <div style={{textAlign:'center', fontWeight: 700, fontSize: '0.95rem', wordBreak: 'break-all'}}>{stripTimestamp(selectedFile.Key)}</div>
            <div style={{textAlign:'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.2rem'}}>{selectedFile.Key.split('.').pop().toUpperCase()} File</div>
          </div>

          <div className="nav-section">
             <h4 style={{marginBottom: '0.75rem'}}>METADATA</h4>
             <div style={{display:'flex', flexDirection:'column', gap: '0.75rem', fontSize: '0.82rem'}}>
               <div style={{display:'flex', justifyContent: 'space-between'}}><span color="var(--muted)">Size:</span> <strong>{formatSize(selectedFile.Size)}</strong></div>
               <div style={{display:'flex', justifyContent: 'space-between'}}><span color="var(--muted)">Modified:</span> <strong>{new Date(selectedFile.LastModified).toLocaleDateString()}</strong></div>
               <div style={{display:'flex', justifyContent: 'space-between'}}><span color="var(--muted)">Storage:</span> <strong style={{color: '#10b981'}}>Cloud Native</strong></div>
               <div style={{display:'flex', justifyContent: 'space-between', alignItems:'flex-start'}}>
                  <span color="var(--muted)">S3 URI:</span> 
                  <strong style={{fontSize: '0.65rem', wordBreak: 'break-all', textAlign: 'right', marginLeft: '1rem', color: 'var(--muted)'}}>s3://{selectedFile.Key}</strong>
               </div>
             </div>
          </div>

          <div className="nav-section" style={{marginTop: '1.5rem'}}>
             <h4>VERSIONING & SECURITY</h4>
             <div style={{marginTop: '0.75rem', padding: '0.85rem', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px'}}>
                <div style={{display:'flex', alignItems:'center', gap: '0.5rem', marginBottom: '0.6rem'}}>
                  <ShieldCheck size={16} color="#10b981" />
                  <span style={{fontSize: '0.8rem', fontWeight: 600}}>Object Immutable</span>
                </div>
                <div style={{fontSize: '0.75rem', color: 'var(--muted)', lineHeight: 1.5}}>
                  This version is protected by S3 Object Lock. Data cannot be modified or deleted until the retention period expires.
                </div>
             </div>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
    </aside>
  );
}
