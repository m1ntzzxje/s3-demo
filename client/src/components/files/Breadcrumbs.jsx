import React from 'react';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';

export default function Breadcrumbs({ 
  historyIndex, 
  navHistory, 
  goNavBack, 
  goNavForward, 
  goBackTo, 
  breadcrumbParts, 
  currentPrefix, 
  handleFileMove 
}) {
  return (
    <div className="breadcrumb-container" style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '0.3rem', marginRight: '0.5rem'}}>
        <button 
          className="icon-btn nav-arrow" 
          onClick={goNavBack} 
          disabled={historyIndex === 0}
          style={{width: 32, height: 32, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--panel)', color: historyIndex === 0 ? 'var(--muted)' : 'var(--text)'}}
          title="Go back"
        >
           <ChevronLeft size={18}/>
        </button>
        <button 
          className="icon-btn nav-arrow" 
          onClick={goNavForward} 
          disabled={historyIndex === navHistory.length - 1}
          style={{width: 32, height: 32, borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--panel)', color: historyIndex === navHistory.length - 1 ? 'var(--muted)' : 'var(--text)'}}
          title="Go forward"
        >
           <ChevronRight size={18}/>
        </button>
      </div>

      <div className="breadcrumb-root breadcrumb-item" onClick={() => goBackTo(-1)}>
        <LayoutDashboard size={14} /> Root
      </div>
      {breadcrumbParts.map((part, idx) => (
        <React.Fragment key={idx}>
          <span className="breadcrumb-sep">/</span>
          <div className="breadcrumb-item" onClick={() => goBackTo(idx)}>{part}</div>
        </React.Fragment>
      ))}
      
      {/* Drop target for Root */}
      {currentPrefix !== '' && (
        <div 
          className="breadcrumb-item" 
          style={{marginLeft: 'auto', fontSize: '0.75rem', border: '1px dashed var(--border)', padding: '2px 8px', borderRadius: '4px'}}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          onDrop={e => {
            e.preventDefault();
            e.currentTarget.style.borderColor = 'var(--border)';
            const sourceKey = e.dataTransfer.getData('sourceKey');
            if (sourceKey) handleFileMove(sourceKey, '');
          }}
        >
          Drop here to move to Root
        </div>
      )}
    </div>
  );
}
