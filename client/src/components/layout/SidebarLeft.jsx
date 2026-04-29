import React from 'react';
import { Database, Folder, Users, Building2, Trash, FileStack, FileText, Settings, Lock, Activity } from 'lucide-react';
import { NavItem } from '../shared/UI';
import { formatSize } from '../../utils/formatters';

export default function SidebarLeft({ user, setUser, currentView, setCurrentView, stats, usedPct }) {
  const handleLogout = () => {
    setUser(null);
    setCurrentView('Dashboard');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-user">
        <div className="avatar-circle">{user?.name?.substring(0, 2).toUpperCase()}</div>
        <span>{user?.name}</span>
        <button 
          className="logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <Lock size={12} /> Logout
        </button>
      </div>

      <nav>
        <div className="nav-section">
          <h4>MAIN</h4>
          <NavItem 
            icon={<Database size={17}/>} 
            label="Dashboard" 
            active={currentView==='Dashboard'} 
            onClick={() => setCurrentView('Dashboard')}
          />
        </div>
        <div className="nav-section">
          <h4>WORKSPACE</h4>
          <NavItem icon={<Folder size={17}/>} label="My Files" active={currentView==='My Files'} onClick={() => setCurrentView('My Files')}/>
          <NavItem icon={<Users size={17}/>} label="Shared with me" active={currentView==='Shared with me'} onClick={() => setCurrentView('Shared with me')}/>
          <NavItem icon={<Building2 size={17}/>} label="Department" active={currentView==='Department'} onClick={() => setCurrentView('Department')}/>
          <NavItem icon={<Trash size={17}/>} label="Trash" active={currentView==='Trash'} onClick={() => setCurrentView('Trash')}/>
        </div>
        <div className="nav-section">
          <h4>ANALYTICS</h4>
          <NavItem icon={<FileStack size={17}/>} label="Storage Analytic"/>
          <NavItem icon={<FileText size={17}/>} label="Usage Reports"/>
        </div>
        <div className="nav-section">
          <h4>SYSTEM</h4>
          <NavItem 
            icon={<Settings size={17}/>} 
            label="Settings" 
            active={currentView==='Settings'} 
            onClick={() => setCurrentView('Settings')}
          />
          <NavItem
            icon={<Activity size={17}/>}
            label="Sync Monitor"
            active={currentView==='Sync Monitor'}
            onClick={() => setCurrentView('Sync Monitor')}
          />
        </div>
      </nav>

      <div className="system-storage">
        <div className="storage-label">STORAGE</div>
        <div className="storage-values">
          <span>{stats ? formatSize(stats.totalSizeBytes) : '—'}</span>
          <span className="storage-max">/ 2 GB</span>
        </div>
        <div className="progress-bar-container">
          <div 
            className="progress-bg" 
            style={{ 
              width: `${Math.min(usedPct, 100)}%`, 
              background: usedPct > 80 ? '#ef4444' : usedPct > 50 ? '#f59e0b' : '#3b82f6' 
            }}
          />
        </div>
        <div className="storage-pct">{usedPct}% used</div>
      </div>
    </aside>
  );
}
