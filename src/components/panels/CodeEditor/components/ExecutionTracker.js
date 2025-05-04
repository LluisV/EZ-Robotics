import React from 'react';

/**
 * Execution Tracker Component - ONLY for tracking execution progress
 * Completely separate from transfer progress
 */
const ExecutionTracker = ({
  isExecuting,
  executedLine,
  executionProgress,
  totalLines
}) => {
  if (!isExecuting && executionProgress <= 0) return null;

  return (
    <div className="execution-container">
      <div className="execution-progress-container">
        <div className="execution-status">
          <div className="status-indicator-wrapper">
            <div className={`status-indicator execution-indicator ${isExecuting ? 'executing' : ''}`}></div>
            <span className="status-text">
              {`Executing line ${executedLine} of ${totalLines}`}
            </span>
          </div>
        </div>

        {/* Execution progress bar */}
        <div className="progress-bar execution-bar">
          <div
            className="progress-fill execution-fill"
            style={{ width: `${executionProgress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ExecutionTracker); // Memoize the component