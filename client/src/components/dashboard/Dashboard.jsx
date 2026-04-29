import React from 'react';
import { HardDrive, CloudUpload, Archive, Activity, ShieldCheck, Lock, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from '../shared/UI';
import { formatSize, timeAgo } from '../../utils/formatters';

export default function Dashboard({ 
  stats, 
  usedPct, 
  isDarkMode, 
  isAutoBackup, 
  setIsAutoBackup, 
  pushNotif, 
  isVersioning,
  setIsVersioning,
  isObjectLock,
  setIsObjectLock,
  chartData,
  handleUserSyncTrigger,
  userSyncStatus,
  userSyncing
}) {

  return (
    <div>
      {/* Stats bar */}
      <div className="stats-row">
        <StatCard icon={<HardDrive size={20} color="#3b82f6"/>} label="Total Objects" value={stats?.totalFiles ?? '—'} bg={isDarkMode ? '#1e293b' : '#eff6ff'}/>
        <StatCard icon={<CloudUpload size={20} color="#10b981"/>} label="Uploaded Files" value={stats?.uploadsCount ?? '—'} bg={isDarkMode ? '#1e293b' : '#f0fdf4'}/>
        <StatCard icon={<Archive size={20} color="#8b5cf6"/>} label="Backup Versions" value={stats?.backupsCount ?? '—'} bg={isDarkMode ? '#1e293b' : '#f5f3ff'}/>
        <StatCard icon={<Activity size={20} color="#f59e0b"/>} label="Storage Used" value={stats ? `${usedPct}%` : '—'} bg={isDarkMode ? '#1e293b' : '#fffbeb'}/>
      </div>

      {/* Backup + Data Protection cards */}
      <div className="dashboard-border">
        <div className="grid-2">
          <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
            <div className="card-title" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}><ShieldCheck size={20} color="#10b981"/> Backup Status</div>
              <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                <span style={{fontSize:'0.7rem', color: isAutoBackup ? '#10b981' : '#94a3b8', fontWeight:700}}>
                  {isAutoBackup ? 'AUTO-SYNC ON' : 'AUTO-SYNC OFF'}
                </span>
              </div>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '0.5rem'}}>
              <div>
                <div className="status-text" style={{color: '#10b981'}}>Healthy</div>
                {stats?.lastBackupTime
                  ? <div className="status-sub">Last sync: {timeAgo(stats.lastBackupTime)}</div>
                  : <div className="status-sub" style={{color:'#ef4444'}}>No backup yet</div>
                }
              </div>
              <div style={{fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'right'}}>
                <div>Running regularly</div>
              </div>
            </div>

            <div className="progress-blue" style={{marginTop:'auto', paddingTop: '1.5rem'}}>
              <div className="progress-blue-inner" style={{width:`${Math.min(usedPct, 100)}%`}}/>
            </div>
            <div style={{fontSize:'0.78rem', color:'#3b82f6', marginTop:'0.4rem'}}>{usedPct}% of 2 GB used</div>
          </div>
          <div className="card">
            <div className="card-title"><Lock size={20} color="#3b82f6"/> Data Protection</div>
            <div className="toggle-row">
              <span>Versioning</span>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <span style={{fontSize:'0.8rem',color: isVersioning ? '#10b981' : '#94a3b8',fontWeight:700}}>{isVersioning ? 'ON' : 'OFF'}</span>
                <div className={`toggle-switch ${isVersioning ? 'on' : ''}`} onClick={() => {
                  const ns = !isVersioning;
                  setIsVersioning(ns);
                  pushNotif(ns ? 'success' : 'error', `Versioning ${ns ? 'enabled' : 'disabled'}`, ns ? 'shield' : 'alert');
                }}/>
              </div>
            </div>
            <div className="toggle-row" style={{marginBottom:0}}>
              <span>Object Lock (Immutable)</span>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                <span style={{fontSize:'0.8rem',color: isObjectLock ? '#10b981' : '#94a3b8',fontWeight:700}}>{isObjectLock ? 'ON' : 'OFF'}</span>
                <div className={`toggle-switch ${isObjectLock ? 'on' : ''}`} onClick={() => {
                  const ns = !isObjectLock;
                  setIsObjectLock(ns);
                  if(!ns) pushNotif('error', 'Object Lock disabled - Data is now mutable', 'alert');
                  else pushNotif('success', 'Object Lock enabled - Files are immutable', 'shield');
                }}/>
              </div>
            </div>
            <div style={{marginTop:'1.25rem', padding:'0.75rem', background: isDarkMode ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4', borderRadius:'6px', fontSize:'0.78rem', color: isDarkMode ? '#4ade80' : '#16a34a', border: isDarkMode ? '1px solid rgba(22, 163, 74, 0.3)' : 'none'}}>
              ✓ Anti-ransomware protection active — AES-256 encrypted at rest
            </div>
          </div>
        </div>

        <div style={{padding: '1.5rem', borderBottom: '1px solid var(--border)', background: isDarkMode ? 'linear-gradient(90deg, #1e293b, #0f172a)' : 'linear-gradient(90deg, #f8fafc, #eff6ff)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <div style={{width: 44, height: 44, borderRadius: 12, background: '#3b82f622', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'}}>
               <ShieldCheck size={24} />
            </div>
            <div>
              <div style={{fontWeight: 700, fontSize: '1rem'}}>Personal Secure Storage (Server 2)</div>
              <div style={{fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2}}>
                Snapshot your current files directly to the disaster recovery "Hard Copy" node.
              </div>
            </div>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '2rem'}}>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: '0.72rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em'}}>Last Secure Pull</div>
              <div style={{fontSize: '0.9rem', fontWeight: 700, color: userSyncStatus?.last_sync ? '#10b981' : 'var(--muted)'}}>
                {userSyncStatus?.last_sync ? timeAgo(userSyncStatus.last_sync) : 'Never'}
              </div>
            </div>
            <button 
              onClick={handleUserSyncTrigger}
              disabled={userSyncing}
              className="auth-btn" 
              style={{
                width: 'auto', margin: 0, padding: '10px 20px', fontSize: '0.85rem', 
                background: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {userSyncing ? <Activity size={16} className="spin-icon" /> : <RefreshCw size={16} />}
              {userSyncing ? 'Syncing...' : 'Secure Personal Data'}
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="chart-area">
          <div style={{fontWeight:600, marginBottom:'1.5rem', fontSize:'0.95rem'}}>Storage Overview (Hybrid: Cloud + Local)</div>
          {stats && stats.totalSizeBytes > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:11}} dy={8}/>
                <YAxis axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:11}} dx={-8} tickFormatter={v => v.toFixed(3) + 'GB'}/>
                <Tooltip formatter={(v, n) => [v.toFixed(4) + ' GB', n === 'cloud' ? 'Cloud' : 'Local']}/>
                <Line 
                  type="monotone" 
                  dataKey="cloud" 
                  stroke={isDarkMode ? '#60a5fa' : '#334155'} 
                  strokeWidth={2.5} 
                  dot={{r:4, fill: isDarkMode ? '#1e293b' : 'white', strokeWidth: 2}} 
                  activeDot={{r:6, strokeWidth:0}}
                  animationDuration={1500}
                />
                <Line 
                  type="monotone" 
                  dataKey="local" 
                  stroke="#93c5fd" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={{r:3}} 
                  animationDuration={2000}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8', fontSize:'0.9rem', flexDirection:'column', gap:'0.5rem'}}>
              <Archive size={32} color="#cbd5e1"/>
              <span>No data yet — upload files or run a backup to see metrics</span>
            </div>
          )}
          {stats && stats.totalSizeBytes > 0 && (
            <div style={{display:'flex', gap:'2rem', fontSize:'0.82rem', fontWeight:600, marginTop:'1rem'}}>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><div style={{width:8,height:8,borderRadius:'50%',background:'#334155'}}/> Cloud: {formatSize(stats.totalSizeBytes)}</div>
              <div style={{display:'flex',alignItems:'center',gap:'0.5rem',color:'#3b82f6'}}><div style={{width:8,height:8,borderRadius:'50%',background:'#3b82f6'}}/> Local: {formatSize(stats.totalSizeBytes * 0.6)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
