import React from 'react';
import { X, FileText, Download } from 'lucide-react';
import { stripTimestamp } from '../../utils/formatters';

export default function PreviewModal({ previewFile, setPreviewFile, downloadFile }) {
  if (!previewFile) return null;

  return (
    <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
      <div className="preview-modal" onClick={e => e.stopPropagation()}>
        <div className="preview-header">
          <div style={{fontWeight:600}}>{stripTimestamp(previewFile.key)}</div>
          <button className="icon-btn" onClick={() => setPreviewFile(null)}><X size={18}/></button>
        </div>
        <div className="preview-body">
          {previewFile.type === 'image' && <img src={previewFile.url} alt="Preview" />}
          {previewFile.type === 'pdf' && <iframe src={previewFile.url} title="PDF Preview" />}
          {previewFile.type === 'text' && <pre>{previewFile.content}</pre>}
          {previewFile.type === 'other' && (
            <div style={{color:'#fff', textAlign:'center', padding: '2rem'}}>
              <FileText size={64} style={{marginBottom:'1.5rem', opacity: 0.5}}/>
              <p style={{fontSize: '1.1rem'}}>Preview not available for this file type</p>
              <p style={{fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem'}}>Extension: {previewFile.key.split('.').pop().toUpperCase()}</p>
              <button 
                className="confirm-cancel" 
                style={{marginTop:'2rem', border: '1px solid #334155'}} 
                onClick={() => downloadFile(previewFile.key)}
              >
                <Download size={14} style={{marginRight: '0.5rem'}}/> Download to View
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
