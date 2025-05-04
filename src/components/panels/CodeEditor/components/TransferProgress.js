import React, { useState, useEffect, useRef } from 'react';

/**
 * Transfer progress component for displaying file transfer status
 * 
 * PERFORMANCE OPTIMIZATION: Added smooth progress animation to reduce UI lag
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
  // PERFORMANCE OPTIMIZATION: Animate progress changes smoothly
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const rafRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  
  // Setup smooth progress animation
  useEffect(() => {
    // Cancel any existing animation
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    const animateProgress = (timestamp) => {
      // Skip if too soon since last update (throttle to ~60fps)
      if (timestamp - lastUpdateTimeRef.current < 16) {
        rafRef.current = requestAnimationFrame(animateProgress);
        return;
      }
      
      lastUpdateTimeRef.current = timestamp;
      
      setAnimatedProgress(prev => {
        // Calculate the step size based on the difference
        const diff = transferProgress - prev;
        
        // If we're very close to the target, just snap to it
        if (Math.abs(diff) < 0.1) {
          return transferProgress;
        }
        
        // Otherwise animate smoothly - faster for larger differences
        const step = Math.sign(diff) * Math.min(
          Math.abs(diff) * 0.1, // 10% of the difference
          1.0 // But max 1% per frame
        );
        
        // Next animated value
        const next = prev + step;
        
        // Continue animation
        rafRef.current = requestAnimationFrame(animateProgress);
        return next;
      });
    };
    
    // Start the animation loop
    rafRef.current = requestAnimationFrame(animateProgress);
    
    // Clean up on unmount or when transferProgress changes
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [transferProgress]);
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

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

        {/* PERFORMANCE OPTIMIZATION: Use animatedProgress for smoother UI */}
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${animatedProgress}%` }}
          ></div>
        </div>

        <div className="progress-text">
          {`${animatedProgress.toFixed(1)}% completed`}
          {lowPerformanceMode && (
            <span className="performance-note"> (reduced UI updates during transfer)</span>
          )}
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