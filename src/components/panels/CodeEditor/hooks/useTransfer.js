import { useState, useRef, useEffect } from 'react';
// Import directly from utils folder rather than through index.js to avoid circular dependencies
import GCodeSender from '../../../../utils/GCodeSender';
import gCodeSerialHelper from '../../../../utils/GCodeSerialHelper';

/**
 * Custom hook for managing G-code transfer to machines
 */
const useTransfer = (code, fileName, setStatusMessage, setSelectedLine) => {
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferError, setTransferError] = useState(null);
  const [lastProgress, setLastProgress] = useState(0); // Progress tracking for logging
  
  const gcodeSenderRef = useRef(new GCodeSender());

  // Initialize serial communication
  useEffect(() => {
    if (window.serialService) {
      gCodeSerialHelper.initialize(window.serialService);
    }
    
    // Clean up when the component unmounts
    return () => {
      gCodeSerialHelper.cleanup();
      
      // Also stop any ongoing transfer
      if (gcodeSenderRef.current) {
        gcodeSenderRef.current.stop();
      }
    };
  }, []);

  // Helper function to log messages to the console panel
  const logToConsole = (type, message) => {
    // Create a custom event to log to console panel
    const event = new CustomEvent('consoleEntry', { 
      detail: { type, content: message }
    });
    document.dispatchEvent(event);
  };

  /**
   * Send G-code to robot using GRBL protocol with improved reliability
   */
  const sendToRobot = async () => {
    // Check if the serialService is available and connected
    if (!window.serialService || !window.serialService.getConnectionStatus()) {
      const errorMsg = "Cannot send G-code: Not connected to machine";
      logToConsole('error', errorMsg);
      setStatusMessage(errorMsg);
      setTransferError(errorMsg);
      return;
    }
  
    const gCodeToSend = code;
    if (!gCodeToSend.trim()) {
      const emptyMsg = "No G-code content to send";
      logToConsole('error', emptyMsg);
      setStatusMessage(emptyMsg);
      return;
    }
  
    try {
      // Start file transfer UI updates
      setIsTransferring(true);
      setTransferProgress(0);
      setTransferError(null);
      setIsPaused(false);
      setLastProgress(0); // Reset last logged progress
      
      // Load the G-code
      const totalLines = gcodeSenderRef.current.loadGCode(gCodeToSend);
      const totalBytes = new Blob([gCodeToSend]).size;
      
      // Log to console panel that we're starting transfer
      logToConsole('system', `Starting transfer: ${fileName} (${totalBytes} bytes, ${totalLines} lines)`);
      
      // Set up the callbacks for simplified sender
      gcodeSenderRef.current.setCallbacks({
        onProgress: (data) => {
          // Update progress UI
          setTransferProgress(data.progress);
          
          // Format progress message with line information
          setStatusMessage(
            `Transferring: ${data.progress.toFixed(1)}% (${data.acknowledged}/${data.total} lines)`
          );
          
          // Log progress occasionally (every 5%)
          const currentProgressFloor = Math.floor(data.progress);
          if (currentProgressFloor % 5 === 0 && 
              currentProgressFloor !== Math.floor(lastProgress)) {
            logToConsole('info', 
              `Transfer progress: ${data.progress.toFixed(1)}% (${data.acknowledged}/${data.total} lines)`
            );
            setLastProgress(data.progress);
          }
          
          // Highlight current line in editor
          if (data.acknowledged > 0 && data.acknowledged <= totalLines) {
            setSelectedLine(data.acknowledged);
          }
        },
        
        onComplete: (data) => {
          // Update UI for completion
          setTransferProgress(100);
          setIsTransferring(false);
          
          const completeMsg = `Transfer completed: ${fileName} (${data.total} lines)`;
          logToConsole('system', completeMsg);
          setStatusMessage(completeMsg);
          
          // Clear line highlight after transfer
          setTimeout(() => {
            setSelectedLine(-1);
          }, 2000);
        },
        
        onError: (error) => {
          // Log error
          logToConsole('error', `Transfer error: ${error}`);
          
          // Update error message in UI
          setTransferError(error);
        },
        
        onLineSuccess: (lineIndex, lineContent) => {
          // Log each successful line (more detailed logging for line-by-line mode)
          logToConsole('debug', `Sent line ${lineIndex+1}: ${lineContent}`);
        },
        
        onLineError: (lineIndex, lineContent, errorMessage) => {
          // Always log line errors
          logToConsole('error', `Error at line ${lineIndex+1}: ${errorMessage} - ${lineContent}`);
          
          // Highlight the line with error
          setSelectedLine(lineIndex + 1);
          
          // Add retry information to status
          const status = gcodeSenderRef.current.getStatus();
          setStatusMessage(`Error at line ${lineIndex+1} - Retry ${status.retryCount}/${status.maxRetries}`);
        },
        
        onPause: (reason) => {
          logToConsole('warning', `Transfer paused: ${reason || 'User requested'}`);
          setStatusMessage(`Transfer paused: ${reason || 'User requested'}`);
          setIsPaused(true);
        },
        
        onResume: () => {
          logToConsole('info', 'Transfer resumed');
          setIsPaused(false);
          setStatusMessage(`Transfer resumed`);
        },
        
        onStatusUpdate: (status) => {
          // Update machine status display with controller state
          const statusText = `Machine state: ${status.state} | Position: X${status.position[0].toFixed(3)} Y${status.position[1].toFixed(3)} Z${status.position[2].toFixed(3)} | Feed rate: ${status.feedRate}`;
          
          // Update status display in UI
          document.dispatchEvent(new CustomEvent('machineStatus', { 
            detail: status 
          }));
        }
      });
      
      // Start the transfer - the 'false' parameter means not to use check mode
      const success = await gcodeSenderRef.current.start(window.serialService, false);
      
      if (!success) {
        throw new Error("Failed to start G-code transfer");
      }
      
    } catch (error) {
      const errorMsg = `Error sending G-code to machine: ${error.message}`;
      console.error(errorMsg);
      logToConsole('error', errorMsg);
      setTransferError(`Error: ${error.message}`);
      setIsTransferring(false);
      
      // Make sure to stop the sender
      gcodeSenderRef.current.stop();
    }
  };

  /**
   * Pause the current transfer
   */
  const pauseTransfer = () => {
    if (gcodeSenderRef.current && gcodeSenderRef.current.pause) {
      const success = gcodeSenderRef.current.pause();
      if (success) {
        setIsPaused(true);
        setStatusMessage('Transfer paused - machine feed hold active');
        
        // Log to console panel
        logToConsole('warning', 'Transfer paused by user');
      }
    }
  };

  /**
   * Resume the current transfer
   */
  const resumeTransfer = () => {
    if (gcodeSenderRef.current && gcodeSenderRef.current.resume) {
      const success = gcodeSenderRef.current.resume();
      if (success) {
        setIsPaused(false);
        setStatusMessage('Transfer resumed - continuing from paused position');
        
        // Log to console panel
        logToConsole('info', 'Transfer resumed by user');
      }
    }
  };

  /**
   * Stop/cancel the current transfer
   */
  const stopTransfer = () => {
    if (gcodeSenderRef.current && gcodeSenderRef.current.stop) {
      const success = gcodeSenderRef.current.stop();
      if (success) {
        setIsPaused(false);
        setIsTransferring(false);
        setTransferProgress(0);
        setStatusMessage('Transfer stopped - machine operation cancelled');
        
        // Log to console panel
        logToConsole('error', 'Transfer stopped by user');
      }
    }
  };

  /**
   * Retry the transfer after an error
   */
  const retryTransfer = () => {
    if (!isTransferring && transferError) {
      setTransferError(null);
      sendToRobot();
    }
  };

  /**
   * Display detailed status information for the transfer
   */
  const showDetailedStatus = () => {
    if (!gcodeSenderRef.current) return;
    
    const status = gcodeSenderRef.current.getStatus();
    const statusMsg = `
      Progress: ${status.progress.toFixed(1)}%
      Lines sent: ${status.linesSent}/${status.totalLines}
      Lines acknowledged: ${status.linesAcknowledged}/${status.totalLines}
      Buffer usage: ${status.bufferUsed}/${status.bufferSize} bytes (${status.bufferUsagePercent.toFixed(1)}%)
      Remaining lines: ${status.remainingLines}
      Unacknowledged lines: ${status.unacknowledgedLines}
    `;
    
    // Log detailed status to console
    logToConsole('info', statusMsg);
  };

  return {
    isPaused,
    isTransferring,
    transferProgress,
    transferError,
    sendToRobot,
    pauseTransfer,
    resumeTransfer,
    stopTransfer,
    retryTransfer,
    showDetailedStatus
  };
};

export default useTransfer;