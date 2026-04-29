import React from 'react';

export function NavItem({ icon, label, active, onClick }) {
  return (
    <div className={`nav-item${active ? ' active' : ''}${!onClick ? ' disabled' : ''}`} onClick={onClick}>
      {icon} {label}
    </div>
  );
}

export function StatCard({ icon, label, value, bg }) {
  return (
    <div className="stat-card" style={{background: bg}}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
