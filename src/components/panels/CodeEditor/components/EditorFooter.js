import React from 'react';

/**
 * Enhanced footer status bar component for the code editor
 * Modern IDE-like styling 
 */
const EditorFooter = ({
  currentLine,
  currentColumn,
  statusMessage,
  totalLines,
  fileSize,
  errors,
  warnings,
  modified,
  codeFormat
}) => {
  return (
    <div className="editor-footer">
      <div className="editor-status-bar">
        <div className="status-section cursor-position">
          <span className="position-text">
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
            {currentLine}:{currentColumn}
          </span>
        </div>

        {statusMessage && (
          <div className="status-section message-section">
            <span className={`status-message ${errors.some(e => e.line === currentLine) ? 'error' : 'warning'}`}>
              {statusMessage}
            </span>
          </div>
        )}

        <div className="status-section editor-info">
          <span className="info-item">{totalLines} lines</span>
          <span className="status-divider">|</span>
          <span className="info-item">G-code</span>
          <span className="status-divider">|</span>
          <span className="info-item">{fileSize}</span>
          {errors.length > 0 && (
            <>
              <span className="status-divider">|</span>
              <span className="info-item error">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '3px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12" y2="16" />
                </svg>
                {errors.length} {errors.length !== 1 ? 'errors' : 'error'}
              </span>
            </>
          )}
          {warnings.length > 0 && (
            <>
              <span className="status-divider">|</span>
              <span className="info-item warning">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '3px' }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12" y2="17" />
                </svg>
                {warnings.length} {warnings.length !== 1 ? 'warnings' : 'warning'}
              </span>
            </>
          )}
        </div>

        <div className="status-section editor-mode">
          <span className={`mode-indicator ${modified ? 'modified' : ''}`}>
            {modified ? 'Modified' : 'Saved'}
          </span>
          
          {/* Format indicator */}
          {codeFormat === 'grbl' && (
            <span className="file-format-badge grbl" style={{ fontSize: '8px', padding: '1px 4px', marginLeft: '8px' }}>GRBL</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorFooter;