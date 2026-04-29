import React, { useState, useEffect, useCallback } from 'react';
import {
  Server, Cloud, HardDrive, RefreshCw, Play, Trash2,
  CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight,
  Database, Activity, ArrowRight, Loader2
} from 'lucide-react';
import { syncApi } from '../../services/api';
import { formatSize } from '../../utils/formatters';

const DASHBOARD_ANIMATIONS = `
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slide-in-left {
    from { opacity: 0; transform: translateX(-30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes breathe-glow {
    0%, 100% { filter: drop-shadow(0 0 5px var(--glow-color)); opacity: 0.8; }
    50% { filter: drop-shadow(0 0 15px var(--glow-color)); opacity: 1; }
  }
  .animate-fade-up { animation: fade-up 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
  .animate-stagger-1 { animation-delay: 0.1s; }
  .animate-stagger-2 { animation-delay: 0.2s; }
  .animate-stagger-3 { animation-delay: 0.3s; }
  .animate-stagger-4 { animation-delay: 0.4s; }
  
  .node-card-hover:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0,0,0,0.12) !important;
  }
`;

// ── Colour tokens per status ──────────────────────────────────────────────────
const STATUS_COLOR = {
  done:             '#10b981',
  done_with_errors: '#f59e0b',
  running:          '#3b82f6',
  failed:           '#ef4444',
  pending:          '#6b7280',
};

function statusIcon(status, size = 16) {
  if (status === 'done')             return <CheckCircle2 size={size} color="#10b981" style={{ filter: 'drop-shadow(0 0 5px #10b98155)' }} />;
  if (status === 'done_with_errors') return <AlertTriangle size={size} color="#f59e0b" />;
  if (status === 'running')          return <RefreshCw size={size} color="#3b82f6" className="spin-icon" />;
  if (status === 'failed')           return <XCircle size={size} color="#ef4444" />;
  return                                    <Clock size={size} color="#6b7280" />;
}

function relTime(isoStr) {
  if (!isoStr) return '—';
  const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
  if (diff < 60)   return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoStr).toLocaleDateString();
}

// ── Node Card (Creative Edition) ──────────────────────────────────────────────
function NodeCard({ icon, title, subtitle, badge, badgeColor, stats, isActive, pulse, health = 100, delayClass }) {
  return (
    <div 
      className={`node-card-hover animate-fade-up ${delayClass}`}
      style={{
        flex: 1, minWidth: 240,
        background: 'var(--header-bg)',
        border: `1px solid ${isActive ? `${badgeColor}44` : 'var(--border)'}`,
        borderRadius: 16,
        padding: '1.6rem',
        position: 'relative',
        boxShadow: isActive ? `0 15px 35px ${badgeColor}15` : '0 4px 15px rgba(0,0,0,0.03)',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        opacity: 0, // for animation
        cursor: 'default'
      }}
    >
      {/* Creative Background Glow */}
      {isActive && (
        <div style={{
          position: 'absolute', top: '-20%', right: '-20%', width: '60%', height: '60%',
          background: `radial-gradient(circle, ${badgeColor}10 0%, transparent 70%)`,
          zIndex: 0
        }} />
      )}

      {pulse && (
        <span style={{
          position: 'absolute', top: 16, right: 16,
          width: 10, height: 10, borderRadius: '50%',
          background: badgeColor || '#10b981',
          boxShadow: `0 0 10px ${badgeColor}`,
          animation: 'pulse-dot 1.4s infinite',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: `${badgeColor || '#3b82f6'}12`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: badgeColor || '#3b82f6',
            boxShadow: isActive ? `inset 0 0 10px ${badgeColor}22` : 'none'
          }}>
            {React.cloneElement(icon, { size: 24 })}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>{title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600 }}>{subtitle}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1.2rem' }}>
          {badge && (
            <div style={{
              padding: '4px 12px', borderRadius: 6,
              background: `${badgeColor || '#3b82f6'}12`,
              color: badgeColor || '#3b82f6',
              fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              {badge}
            </div>
          )}
          {/* Integrity Meter */}
          <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
            <div style={{ width: `${health}%`, height: '100%', background: badgeColor, transition: 'width 1s ease' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {stats.map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontWeight: 700 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Particle Flow Arrow ───────────────────────────────────────────────────────
function FlowArrow({ active, label }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '0.5rem', padding: '0 0.8rem', minWidth: 90,
    }}>
      <div style={{
        fontSize: '0.65rem', fontWeight: 800,
        color: active ? '#3b82f6' : 'var(--muted)',
        textAlign: 'center', letterSpacing: '0.1em', textTransform: 'uppercase',
        opacity: active ? 1 : 0.6
      }}>{label}</div>
      <div style={{ position: 'relative', width: 80, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          height: 4, width: '100%',
          background: active ? '#3b82f622' : 'var(--border)',
          borderRadius: 4,
          overflow: 'hidden', position: 'relative'
        }}>
          {active && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, transparent, #3b82f6, #8b5cf6, transparent)',
              animation: 'flow-slide 2s infinite linear',
              backgroundSize: '200% 100%'
            }} />
          )}
        </div>
        <ArrowRight size={18}
          color={active ? '#8b5cf6' : 'var(--muted)'}
          style={{ position: 'absolute', right: -10, filter: active ? 'drop-shadow(0 0 5px #8b5cf6aa)' : 'none' }}
        />
      </div>
    </div>
  );
}

// ── History Table ─────────────────────────────────────────────────────────────
function HistoryRow({ job }) {
  const type_label = {
    s3_transit_push:   'System Cloud Backup',
    server2_pull:      'System Local Sync',
    user_transit_push: 'Personal Cloud Push',
    user_server2_pull: 'Personal Local Pull',
    s3_cleanup:        'Transit Hub Cleanup',
  }[job.job_type] || job.job_type;

  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {statusIcon(job.status, 14)}
          <span style={{ fontWeight: 600 }}>{type_label}</span>
        </div>
      </td>
      <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: STATUS_COLOR[job.status] || '#6b7280', fontWeight: 700 }}>
        {job.status}
      </td>
      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
        {job.files_done ?? 0} / {job.files_total ?? 0}
      </td>
      <td style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
        {job.size_bytes ? formatSize(job.size_bytes) : '—'}
      </td>
      <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--muted)' }}>
        {relTime(job.started_at)}
        {job.status === 'running' && job.progress_pct !== undefined && (
          <div style={{ width: '100%', height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
            <div style={{ width: `${job.progress_pct}%`, height: '100%', background: '#3b82f6', transition: 'width 0.3s ease' }} />
          </div>
        )}
      </td>
      <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#ef4444', maxWidth: 200 }}>
        {job.errors?.length > 0
          ? <span title={job.errors.join('\n')} style={{ cursor: 'help' }}>
              ⚠ {job.errors.length} error{job.errors.length > 1 ? 's' : ''}
            </span>
          : <span style={{ color: '#10b981' }}>✓ Clean</span>
        }
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SyncMonitor({ token, pushNotif }) {
  const [status,     setStatus]     = useState(null);
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [triggering, setTriggering] = useState(null); // 'push' | 'pull' | 'pipeline' | 'cleanup'

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const [sRes, hRes] = await Promise.all([
        syncApi.getStatus(token),
        syncApi.getHistory(token, 15),
      ]);
      if (sRes.ok) setStatus(await sRes.json());
      if (hRes.ok) setHistory(await hRes.json());
    } catch (e) {
      pushNotif?.('error', 'Failed to fetch sync status', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10000); // auto-refresh every 10s
    return () => clearInterval(id);
  }, [refresh]);

  const trigger = async (action, label) => {
    setTriggering(action);
    try {
      const fn = {
        push:     () => syncApi.triggerPush(token),
        pull:     () => syncApi.triggerPull(token),
        pipeline: () => syncApi.triggerPipeline(token),
        cleanup:  () => syncApi.cleanup(token),
      }[action];
      const res = await fn();
      const data = await res.json();
      pushNotif?.('success', data.message || `${label} started`, 'success');
      setTimeout(refresh, 1500);
    } catch (e) {
      pushNotif?.('error', `Failed to trigger ${label}`, 'error');
    } finally {
      setTriggering(null);
    }
  };

  const lp = status?.last_push;
  const ll = status?.last_pull;
  const lc = status?.last_cleanup;

  const pushActive    = lp?.status === 'running';
  const pullActive    = ll?.status === 'running';
  const s3HasTransit  = (status?.transit_count ?? 0) > 0;
  const server2Online = status?.server2_exists;

  const server1Stats = [
    { label: 'Cloud Status', value: 'Active Source' },
    { label: 'File Inventory', value: status?.totalFiles ?? '—' },
    { label: 'Latest Sync', value: relTime(lp?.started_at) },
  ];
  const s3Stats = [
    { label: 'Transit Hub', value: 'Ready' },
    { label: 'Queue Count', value: status?.transit_count ?? '0' },
    { label: 'Buffer Size', value: status?.transit_size_bytes ? formatSize(status.transit_size_bytes) : '0 B' },
  ];
  const server2Stats = [
    { label: 'DR Node',    value: 'Hard Copy' },
    { label: 'Integrity',  value: server2Online ? '100% Verified' : 'Checking...' },
    { label: 'Local Files', value: status?.server2_file_count ?? '0' },
    { label: 'Last Update', value: relTime(ll?.started_at) },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
        <Loader2 size={32} color="#3b82f6" className="spin-icon" />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      <style>{DASHBOARD_ANIMATIONS}</style>
      
      {/* ── Header ── */}
      <div className="animate-fade-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', margin: 0, fontSize: '1.4rem' }}>
            <Activity size={26} color="#3b82f6" /> Personal Sync Monitor
          </h2>
          <p style={{ color: 'var(--muted)', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
            Monitoring your private 3-node backup pipeline. Scoped to your account data.
          </p>
        </div>
        <button
          onClick={refresh}
          style={{ background: 'var(--header-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}
        >
          <RefreshCw size={14} /> Refresh Now
        </button>
      </div>

      {/* ── 3-Node Diagram ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
        <NodeCard
          icon={<Server size={22} />}
          title="Server 1"
          subtitle="Cloud / Primary"
          badge="HEALTHY"
          badgeColor="#10b981"
          stats={server1Stats}
          isActive={true}
          pulse={pushActive}
          delayClass="animate-stagger-1"
        />
        <FlowArrow active={pushActive || s3HasTransit} label="Secure Push" />
        <NodeCard
          icon={<Cloud size={22} />}
          title="S3 Transit"
          subtitle="AWS / MinIO"
          badge={pushActive ? 'SYNCING...' : (s3HasTransit ? 'DATA PRESENT' : 'DONE')}
          badgeColor={pushActive ? '#8b5cf6' : (s3HasTransit ? '#f59e0b' : '#10b981')}
          stats={s3Stats}
          isActive={s3HasTransit || pushActive}
          pulse={pushActive || pullActive}
          delayClass="animate-stagger-2"
        />
        <FlowArrow active={pullActive} label="Secure Pull" />
        <NodeCard
          icon={<HardDrive size={22} />}
          title="Server 2"
          subtitle="DR / Hard Copy"
          badge={pullActive ? 'SYNCING...' : (server2Online ? 'ONLINE' : 'OFFLINE')}
          badgeColor={pullActive ? '#8b5cf6' : (server2Online ? '#10b981' : '#ef4444')}
          stats={server2Stats}
          isActive={server2Online}
          pulse={pullActive}
          delayClass="animate-stagger-3"
        />
      </div>

      {/* ── Action Buttons ── */}
      <div className="animate-fade-up animate-stagger-4" style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {[
          { action: 'push',     label: 'Push My Data to Cloud',  color: '#8b5cf6', icon: <Cloud size={14} /> },
        ].map(({ action, label, color, icon }) => (
          <button
            key={action}
            onClick={() => trigger(action, label)}
            disabled={!!triggering}
            style={{
              background: triggering === action ? `${color}33` : `${color}22`,
              color,
              border: `1px solid ${color}66`,
              borderRadius: 8,
              padding: '8px 16px',
              cursor: triggering ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              fontWeight: 700, fontSize: '0.82rem',
              transition: 'all 0.2s',
              opacity: triggering && triggering !== action ? 0.5 : 1,
            }}
          >
            {triggering === action ? <Loader2 size={14} className="spin-icon" /> : icon}
            {label}
          </button>
        ))}
      </div>

      {/* ── Job History Table ── */}
      <div style={{
        background: 'var(--header-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={16} color="#3b82f6" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Job History</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)' }}>Last 15 jobs</span>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.85rem' }}>
            No sync jobs recorded yet. Trigger a pipeline to start.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                  {['Job', 'Status', 'Files', 'Size', 'Started', 'Errors'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.05em' }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((job, i) => <HistoryRow key={job.job_id || i} job={job} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hard Copy Rules Legend ── */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.2rem', background: 'var(--header-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.7rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={14} /> Hard Copy Rules (Server 2 Protection)
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {[
            ['Pull-only',     'Server 2 always pulls. Nothing pushes to it.'],
            ['No-delete',     'Files never deleted even if removed from S3.'],
            ['Soft-archive',  'Old versions saved to archive/ before overwrite.'],
            ['Hash-verify',   'MD5 checked after every download. Retry ×3 on mismatch.'],
          ].map(([rule, desc]) => (
            <div key={rule} style={{ minWidth: 200, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#10b981' }}>{rule}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
