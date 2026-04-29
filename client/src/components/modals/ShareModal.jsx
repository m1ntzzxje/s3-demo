import React from 'react';
import { stripTimestamp } from '../../utils/formatters';

export default function ShareModal({ shareModalKey, setShareModalKey, shareEmail, setShareEmail, submitShare }) {
  if (!shareModalKey) return null;

  return (
    <div className="share-modal-overlay">
      <div className="share-modal">
        <h3>Share File</h3>
        <p>Share <strong>{stripTimestamp(shareModalKey)}</strong> with another user</p>
        <div className="share-input-row">
          <input
            className="share-input"
            type="email"
            placeholder="Enter email address..."
            value={shareEmail}
            onChange={e => setShareEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitShare()}
            autoFocus
          />
          <button className="share-btn" onClick={submitShare}>Share</button>
        </div>
        <button className="share-cancel-btn" onClick={() => setShareModalKey(null)}>Cancel</button>
      </div>
    </div>
  );
}
