import React from 'react';
import { Database, Search, Sun, Moon, RefreshCw, Bell } from 'lucide-react';

export default function Header({ 
  currentView, 
  searchQuery, 
  setSearchQuery, 
  isDarkMode, 
  setIsDarkMode, 
  fetchStats, 
  unreadCount 
}) {
  return (
    <header className="header">
      <div className="header-left">
        <Database size={16}/> <span className="breadcrumb">{currentView === 'Dashboard' ? 'MAIN' : 'WORKSPACE'}</span> / <strong>{currentView}</strong>
      </div>
      <div className="header-actions">
        {currentView === 'My Files' && (
          <div className="search-wrapper">
            <Search size={14} className="search-icon"/>
            <input 
              className="search-box" 
              placeholder="Search files..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
        <button 
          className="icon-btn theme-toggle" 
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'} 
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="icon-btn" title="Refresh stats" onClick={fetchStats}>
          <RefreshCw size={17}/>
        </button>
        <div className="bell-wrapper">
          <Bell size={17}/>
          {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
        </div>
      </div>
    </header>
  );
}
