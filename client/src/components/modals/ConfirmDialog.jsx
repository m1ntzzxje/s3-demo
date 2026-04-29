import React from 'react';
import { Trash2 } from 'lucide-react';
import { stripTimestamp } from '../../utils/formatters';

export default function ConfirmDialog({ confirmKey, confirmType, setConfirmKey, confirmDelete }) {
  if (!confirmKey) return null;

  return (
    <div className="confirm-overlay">
      <div className="confirm-box">
        <div className="confirm-icon"><Trash2 size={22} color="#ef4444"/></div>
        <div className="confirm-title">
          {confirmType === 'permanent' ? 'Permanent Delete?' : confirmType === 'folder' ? 'Delete Folder?' : 'Move to Trash?'}
        </div>
        <div className="confirm-desc">
          <strong>{confirmType === 'folder' ? confirmKey.split('/').filter(Boolean).pop() : stripTimestamp(confirmKey)}</strong>
          <br/>
          {confirmType === 'permanent' ? (
            <span style={{color: '#ef4444', fontWeight: 600}}>This action cannot be undone. Area you sure?</span>
          ) : confirmType === 'folder' ? (
            <span>Are you sure you want to delete this folder and all its contents? This action is permanent.</span>
          ) : (
            <span>Versioning is ON — a Delete Marker will be placed. Previous versions remain recoverable.</span>
          )}
        </div>
        <div className="confirm-actions">
          <button className="confirm-cancel" onClick={() => setConfirmKey(null)}>Cancel</button>
          <button className="confirm-ok" onClick={confirmDelete}>{confirmType === 'trash' ? 'Move to Trash' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  );
}
