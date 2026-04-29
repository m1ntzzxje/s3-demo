import React from 'react';
import { Settings, Clock, ShieldCheck, Save, Trash2, Plus } from 'lucide-react';

export default function SettingsView({
  isAutoBackup,
  setIsAutoBackup,
  autoBackupInterval,
  setAutoBackupInterval,
  backupSchedule,
  setBackupSchedule,
  pushNotif
}) {
  const addTimeSlot = (time) => {
    if (time && !backupSchedule.includes(time)) {
      setBackupSchedule([...backupSchedule, time].sort());
      pushNotif('success', `Added scheduled backup at ${time}`, 'clock');
    }
  };

  const removeTimeSlot = (time) => {
    setBackupSchedule(backupSchedule.filter(t => t !== time));
    pushNotif('warn', `Removed scheduled backup at ${time}`, 'trash');
  };

  return (
    <div className="files-section-header" style={{flexDirection: 'column', alignItems: 'flex-start', padding: '2rem'}}>
      <h2 style={{display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem'}}>
        <Settings size={28} /> System Settings
      </h2>

      <div className="dashboard-border" style={{width: '100%', maxWidth: '800px', padding: '2.5rem', background: 'var(--bg)', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)'}}>
        <h3 style={{display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem', color: '#3b82f6', fontSize: '1.4rem'}}>
          <ShieldCheck size={26} /> Backup Automation
        </h3>

        <div style={{
          marginBottom: '2.5rem', 
          padding: '1.5rem', 
          borderRadius: '12px',
          background: 'var(--header-bg)',
          border: '1px solid var(--border)',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{flex: 1, minWidth: '250px'}}>
            <div style={{fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.6rem'}}>
              Interval Auto-Backup
              {isAutoBackup && <span style={{fontSize: '0.7rem', background: '#10b98120', color: '#10b981', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', border: '1px solid #10b98140'}}>ACTIVE</span>}
            </div>
            <div style={{fontSize: '0.9rem', color: 'var(--muted)', marginTop: '0.5rem', lineHeight: '1.4'}}>
              Automatically run incremental backups at the selected interval to ensure continuous data protection without manual intervention.
            </div>
          </div>
          
          <div style={{display: 'flex', alignItems: 'center', gap: '1.5rem'}}>
            <select
              value={autoBackupInterval}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setAutoBackupInterval(val);
                pushNotif('info', `Auto-backup interval changed to ${val < 60 ? val + ' minutes' : (val/60) + ' hour(s)'}`, 'clock');
              }}
              disabled={!isAutoBackup}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: isAutoBackup ? 'var(--bg)' : 'var(--header-bg)',
                color: isAutoBackup ? 'var(--text)' : 'var(--muted)',
                outline: 'none',
                cursor: isAutoBackup ? 'pointer' : 'not-allowed',
                opacity: isAutoBackup ? 1 : 0.6,
                fontWeight: 600,
                fontSize: '0.95rem'
              }}
            >
              <option value={5}>Every 5 Minutes</option>
              <option value={15}>Every 15 Minutes</option>
              <option value={30}>Every 30 Minutes</option>
              <option value={60}>Every 1 Hour</option>
              <option value={120}>Every 2 Hours</option>
              <option value={240}>Every 4 Hours</option>
              <option value={720}>Every 12 Hours</option>
            </select>
            
            <div 
              className={`toggle-switch ${isAutoBackup ? 'on' : ''}`} 
              onClick={() => {
                const newState = !isAutoBackup;
                setIsAutoBackup(newState);
                if(newState) pushNotif('info', `Interval backups enabled`, 'shield');
                else pushNotif('warn', 'Interval backups disabled', 'alert');
              }}
              style={{cursor:'pointer', transform: 'scale(1.3)', flexShrink: 0}}
            />
          </div>
        </div>

        <div>
          <div style={{marginBottom: '1.2rem'}}>
            <div style={{fontWeight: 700, fontSize: '1.1rem'}}>Scheduled Daily Backups</div>
            <div style={{fontSize: '0.9rem', color: 'var(--muted)', marginTop: '0.4rem'}}>
              Configure specific times of the day to execute full backups. Perfect for end-of-shift data synchronization.
            </div>
          </div>

          <div style={{background: 'var(--header-bg)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
              <div style={{fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text)'}}>
                <Clock size={18} color="#3b82f6" /> Active Daily Schedules
              </div>
            </div>

            <div style={{display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem', minHeight: '40px'}}>
              {backupSchedule.map(time => (
                <div key={time} style={{
                  background: 'linear-gradient(135deg, #3b82f615 0%, #2563eb15 100%)', 
                  padding: '8px 18px', 
                  borderRadius: '24px', 
                  fontSize: '0.95rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  border: '1px solid #3b82f630', 
                  fontWeight: 600,
                  color: '#3b82f6',
                  transition: 'all 0.2s ease',
                  cursor: 'default',
                  boxShadow: '0 2px 4px rgba(59,130,246,0.05)'
                }}>
                  <Clock size={14} />
                  {time}
                  <button 
                    onClick={() => removeTimeSlot(time)} 
                    style={{
                      border:'none', 
                      background:'rgba(239, 68, 68, 0.1)', 
                      padding:'5px', 
                      borderRadius: '50%',
                      cursor:'pointer', 
                      display:'flex', 
                      color:'#ef4444', 
                      marginLeft: '4px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.transform = 'scale(1.15)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                    title="Remove Schedule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {backupSchedule.length === 0 && (
                <div style={{fontSize: '0.9rem', color: 'var(--muted)', fontStyle: 'italic', display: 'flex', alignItems: 'center', height: '100%'}}>
                  No daily schedules configured. Add a time slot below.
                </div>
              )}
            </div>

            <div style={{borderTop: '1px solid var(--border)', paddingTop: '1.8rem'}}>
              <div style={{fontSize: '0.95rem', fontWeight: 600, marginBottom: '1.2rem', color: 'var(--text-secondary)'}}>
                Add New Schedule
              </div>
              
              <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                {/* Presets */}
                <div style={{display: 'flex', gap: '0.8rem', flexWrap: 'wrap'}}>
                  {['08:00', '12:00', '17:00', '00:00'].map(preset => (
                    <button
                      key={preset}
                      onClick={() => addTimeSlot(preset)}
                      disabled={backupSchedule.includes(preset)}
                      style={{
                        background: backupSchedule.includes(preset) ? 'var(--bg)' : 'var(--bg)',
                        border: '1px solid var(--border)',
                        color: backupSchedule.includes(preset) ? 'var(--muted)' : 'var(--text)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        cursor: backupSchedule.includes(preset) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: backupSchedule.includes(preset) ? 0.5 : 1,
                        fontWeight: 500
                      }}
                      onMouseOver={(e) => {
                        if (!backupSchedule.includes(preset)) {
                          e.currentTarget.style.borderColor = '#3b82f6';
                          e.currentTarget.style.color = '#3b82f6';
                          e.currentTarget.style.background = 'var(--header-bg)';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!backupSchedule.includes(preset)) {
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text)';
                          e.currentTarget.style.background = 'var(--bg)';
                        }
                      }}
                    >
                      <Plus size={14} /> {preset}
                    </button>
                  ))}
                </div>

                {/* Custom input */}
                <div style={{display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap'}}>
                  <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
                    <Clock size={16} style={{position: 'absolute', left: '14px', color: 'var(--muted)'}} />
                    <input 
                      type="time" 
                      className="auth-input" 
                      style={{
                        padding: '12px 14px 12px 40px', 
                        fontSize: '1rem', 
                        width: '180px', 
                        borderRadius: '10px', 
                        background: 'var(--bg)', 
                        border: '1px solid var(--border)', 
                        color: 'var(--text)',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#3b82f6';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border)';
                        e.target.style.boxShadow = 'none';
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          addTimeSlot(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      id="schedule-input-settings"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const input = document.getElementById('schedule-input-settings');
                      if (input.value) {
                        addTimeSlot(input.value);
                        input.value = '';
                      } else {
                        pushNotif('warn', 'Please select a valid time', 'alert');
                      }
                    }}
                    className="auth-btn"
                    style={{
                      width: 'auto', 
                      padding: '12px 24px', 
                      fontSize: '0.95rem', 
                      margin: 0, 
                      gap: '0.6rem',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                      transition: 'all 0.2s ease',
                      border: 'none'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                    }}
                  >
                    <Save size={18} /> Add Custom Time
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
