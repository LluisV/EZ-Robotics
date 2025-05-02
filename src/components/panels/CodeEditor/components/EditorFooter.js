import React from 'react';

/**
 * Footer status bar component for the code editor
 */
const EditorFooter = ({
  currentLine,
  currentColumn,
  statusMessage,
  totalLines,
  fileSize,
  errors,
  warnings,
  modified
}) => {
  return (
    <div className="editor-footer">
      <div className="editor-status-bar">
        <div className="status-section cursor-position">
          <span className="position-text">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
            Ln {currentLine}, Col {currentColumn}
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
          <span className="info-item">UTF-8</span>
          <span className="status-divider">|</span>
          <span className="info-item">{fileSize}</span>
          {errors.length > 0 && (
            <>
              <span className="status-divider">|</span>
              <span className="info-item error">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
            </>
          )}
          {warnings.length > 0 && (
            <>
              <span className="status-divider">|</span>
              <span className="info-item warning">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>

        <div className="status-section editor-mode">
          <span className={`mode-indicator ${modified ? 'modified' : ''}`}>
            {modified ? 'Modified' : 'Saved'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default EditorFooter;