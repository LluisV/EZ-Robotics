import React from 'react';

/**
 * Header component with toolbar for the code editor
 */
const EditorHeader = ({
  fileName,
  modified,
  transformMode,
  setTransformMode,
  openFile,
  saveFile,
  formatCode,
  sendToRobot,
  isPaused,
  pauseTransfer,
  resumeTransfer,
  stopTransfer
}) => {
  return (
    <div className="editor-toolbar">
      <div className="toolbar-section">
        {/* File operations */}
        <button className="toolbar-btn" onClick={openFile} title="Open File">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h6"/>
            <path d="M14 15v4M12 17h4"/>
          </svg>
        </button>
        <button className="toolbar-btn" onClick={saveFile} title="Save File">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
        </button>
        
        <span className="toolbar-divider"></span>
        
        {/* Code operations */}
        <button className="toolbar-btn" onClick={formatCode} title="Format Code">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10H3M21 6H3M21 14H3M21 18H3"/>
          </svg>
        </button>
        
        {/* Transform button */}
        <button
          className={`toolbar-btn ${transformMode ? 'active' : ''}`}
          onClick={() => transformMode ? setTransformMode(null) : setTransformMode('transform')}
          title="Transform G-code"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        
        <span className="toolbar-divider"></span>
        
        {/* Execution controls with colored icons */}
        <button 
          className="toolbar-btn action-btn" 
          onClick={sendToRobot}
          title="Send to Machine"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--play-color, #4CAF50)" strokeWidth="2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        
        <button 
          className="toolbar-btn action-btn" 
          onClick={isPaused ? resumeTransfer : pauseTransfer}
          title={isPaused ? "Resume Transfer" : "Pause Transfer"}
        >
          {isPaused ? (
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--resume-color, #2196F3)" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--pause-color, #FF9800)" strokeWidth="2">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          )}
        </button>
        
        <button 
          className="toolbar-btn action-btn" 
          onClick={stopTransfer}
          title="Stop Transfer"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--stop-color, #F44336)" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
        </button>
      </div>

      <div className="file-info">
        <div className="file-name">
          <span className="file-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </span>
          <span className="name">{fileName}</span>
          {modified && <span className="modified-indicator">●</span>}
        </div>
      </div>
    </div>
  );
};

export default EditorHeader;