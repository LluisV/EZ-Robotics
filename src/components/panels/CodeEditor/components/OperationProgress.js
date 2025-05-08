import React from 'react';

/**
 * Unified Operation Progress component
 * Combines transfer and execution progress into a single cohesive interface
 */
const OperationProgress = ({
  isTransferring,
  transferProgress,
  transferStatusMessage,
  transferError,
  retryTransfer,
  
  isExecuting,
  executedLine,
  executionProgress,
  totalLines,
  
  fileName
}) => {
  return (
    <div className="operation-progress-container">
      {/* Common container for all progress elements */}
      <div className="progress-box">
        {/* Transfer progress section */}
        {isTransferring && (
          <div className="progress-section transfer-section">
            <div className="status-indicator-wrapper">
              <div className="status-indicator transfer-indicator"></div>
              <span className="status-text">
                {transferStatusMessage || `Transferring: ${fileName}`}
              </span>
            </div>
            
            <div className="progress-bar transfer-bar">
              <div
                className="progress-fill transfer-fill"
                style={{ width: `${transferProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Execution progress section */}
        {isExecuting && (
          <div className="progress-section execution-section">
            <div className="status-indicator-wrapper">
              <div className={`status-indicator execution-indicator ${isExecuting ? 'executing' : ''}`}></div>
              <span className="status-text">
                {`Executing line ${executedLine} of ${totalLines}`}
              </span>
            </div>
            
            <div className="progress-bar execution-bar">
              <div
                className="progress-fill execution-fill"
                style={{ width: `${executionProgress}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {/* Error message display */}
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

export default OperationProgress;