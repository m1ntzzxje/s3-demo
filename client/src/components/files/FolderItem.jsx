import React from 'react';
import { Folder, Trash2 } from 'lucide-react';

export default function FolderItem({ folder, onClick, onDrop, deleteFolder }) {
  return (
    <div 
      className="folder-item" 
      onClick={onClick}
      onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = 'var(--sidebar-active)'; }}
      onDragLeave={e => { e.currentTarget.style.background = ''; }}
      onDrop={e => {
        e.preventDefault();
        e.currentTarget.style.background = '';
        const sourceKey = e.dataTransfer.getData('sourceKey');
        if (sourceKey && onDrop) onDrop(sourceKey, folder);
      }}
    >
      <div className="folder-icon"><Folder size={20} /></div>
      <div className="file-name">{folder}</div>
      <button 
        className="icon-action-btn red" 
        style={{marginLeft: 'auto', border: 'none', background: 'transparent'}} 
        onClick={(e) => { e.stopPropagation(); deleteFolder(folder); }}
      >
        <Trash2 size={14}/>
      </button>
    </div>
  );
}
