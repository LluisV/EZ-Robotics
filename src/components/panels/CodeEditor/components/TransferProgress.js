import React from 'react';

/**
 * Transfer progress component for displaying file transfer status
 * 
 * SIMPLIFIED: Removed animation, directly shows transfer progress
 */
const TransferProgress = ({
  statusMessage,
  transferProgress,
  isPaused,
  pauseTransfer,
  resumeTransfer,
  stopTransfer,
  transferError,
  retryTransfer,
  fileName,
  lowPerformanceMode = false
}) => {
  return (
    <div className="transfer-container">
      <div className="transfer-progress-container">
        <div className="transfer-status">
          <div className="status-indicator-wrapper">
            <div className="status-indicator"></div>
            <span className="status-text">{statusMessage || `Transferring: ${fileName}`}</span>
          </div>

          {/* Control buttons - fixed position on right */}
          <div className="transfer-controls">
            {isPaused ? (
              <button
                className="toolbar-btn resume-btn"
                onClick={resumeTransfer}
                title="Resume transfer"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--resume-color, #2196F3)" strokeWidth="2">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
            ) : (
              <button
                className="toolbar-btn pause-btn"
                onClick={pauseTransfer}
                title="Pause transfer"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--pause-color, #FF9800)" strokeWidth="2">
                  <rect x="6" y="4" width="4" height="16"></rect>
                  <rect x="14" y="4" width="4" height="16"></rect>
                </svg>
              </button>
            )}

            <button
              className="toolbar-btn stop-btn"
              onClick={stopTransfer}
              title="Stop transfer"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--stop-color, #F44336)" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </button>
          </div>
        </div>

        {/* Simplified: Use transferProgress directly */}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${transferProgress}%` }}
          ></div>
        </div>

        {transferError && (
          <div className="transfer-error">
            <div className="error-message">{transferError}</div>
            <button onClick={retryTransfer} className="retry-btn">Retry</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(TransferProgress); // PERFORMANCE OPTIMIZATION: Memoize the component