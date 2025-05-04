/**
 * Enhanced G-Code Sender for GRBL/FluidNC machines
 * 
 * Implements a safe line-by-line approach with support for:
 * - Line numbering to track execution progress
 * - Separate tracking of sending vs. execution progress
 * - Improved error handling and recovery
 */
class GCodeSender {
  constructor() {
    // Core state
    this.lines = [];                // Array of GCode lines to send
    this.currentLineIndex = 0;      // Current line index to send
    this.isSending = false;         // Whether we're currently sending
    this.isPaused = false;          // Whether sending is paused
    this.isChecking = false;        // Whether we're in check mode
    
    // Execution tracking
    this.isExecuting = false;       // Whether code is still being executed
    this.executedLineIndex = 0;     // Last line executed by the controller
    
    // Line numbering
    this.useLineNumbers = true;     // Whether to use line numbers
    this.lineNumberPrefix = 'N';    // Prefix for line numbers
    this.startLineNumber = 1;       // Starting line number
    
    // Retry configuration
    this.MAX_RETRIES = 3;           // Maximum number of retries per line
    this.RETRY_DELAY = 1000;        // 1 second delay before retry
    this.currentRetries = 0;        // Current retry count for current line
    
    // Response timeout
    this.responseTimeout = null;
    this.MAX_RESPONSE_WAIT = 30000; // 30 seconds max wait for response
    
    // Callback functions
    this.callbacks = {
      onProgress: null,           // Called when send progress is made
      onExecutionProgress: null,  // Called when execution progress is made
      onComplete: null,           // Called when all sending is complete
      onExecutionComplete: null,  // Called when execution is complete
      onError: null,              // Called when errors occur
      onLineSuccess: null,        // Called when a line is successfully sent
      onLineError: null,          // Called when a line fails
      onPause: null,              // Called when sending is paused
      onResume: null,             // Called when sending is resumed
      onStatusUpdate: null        // Called when machine status updates
    };
    
    // Serial service reference
    this.serialService = null;
    
    // Response handler reference
    this.responseHandler = this.handleResponse.bind(this);
    
    // Debug logging
    this.debug = false; // Set to false to disable debug logging
    
    // PERFORMANCE OPTIMIZATION: Add throttling for UI updates
    this.UI_UPDATE_INTERVAL = 250; // Only update UI every 250ms
    this.lastProgressUpdate = 0;
    this.lastExecutionUpdate = 0;
    
    // Track progress separately from UI updates
    this.currentProgress = {
      sent: 0,
      acknowledged: 0,
      total: 0,
      progress: 0
    };
    
    // Track execution progress
    this.executionProgress = {
      executed: 0,
      total: 0,
      progress: 0
    };
    
    // For tracking when execution is actually complete (after all lines are sent)
    this.executionCompleteTimeout = null;
    this.EXECUTION_COMPLETE_TIMEOUT = 2000; // 2 seconds after last status update
    this.lastStatusTime = 0;
  }
  
  /**
   * Log debugging information if debug mode is enabled
   */
  log(...args) {
    if (this.debug) {
      console.log("[EnhancedGCodeSender]", ...args);
    }
  }
  
  /**
   * Load GCode from a string
   * @param {string} gcode - The G-code text to load
   * @returns {number} - Number of lines loaded
   */
  loadGCode(gcode) {
    // Reset state
    this.currentLineIndex = 0;
    this.executedLineIndex = 0;
    
    // Split G-code into lines and clean them
    this.lines = gcode.split('\n')
      .map(line => {
        // Remove any existing line numbers first
        let cleanLine = line.replace(/^N\d+\s+/, '');
        
        // Remove comments and trim whitespace
        const commentIndex = cleanLine.indexOf(';');
        return (commentIndex >= 0 ? cleanLine.substring(0, commentIndex) : cleanLine).trim();
      })
      .filter(line => line); // Remove empty lines
    
    this.log(`Loaded ${this.lines.length} lines of G-code`);
    
    // Reset execution tracking
    this.executionProgress = {
      executed: 0,
      total: this.lines.length,
      progress: 0
    };
    
    return this.lines.length;
  }
  
  /**
   * Set event callbacks
   * @param {Object} callbacks - Object containing callback functions
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  /**
   * Start sending the G-code
   * @param {Object} serialService - The serial service to use for sending
   * @param {boolean} checkMode - Whether to run in check mode (no movement)
   * @returns {Promise<boolean>} - Success status
   */
  async start(serialService, checkMode = false) {
    if (this.isSending) {
      this.log("Already sending G-code");
      return false;
    }
    
    if (!serialService || typeof serialService.send !== 'function') {
      console.error("Invalid serial service provided");
      if (this.callbacks.onError) {
        this.callbacks.onError("Invalid serial service");
      }
      return false;
    }
    
    if (this.lines.length === 0) {
      this.log("No G-code loaded");
      if (this.callbacks.onError) {
        this.callbacks.onError("No G-code loaded");
      }
      return false;
    }
    
    // Setup
    this.serialService = serialService;
    this.isSending = true;
    this.isExecuting = true;
    this.isPaused = false;
    this.isChecking = checkMode;
    this.currentLineIndex = 0;
    this.executedLineIndex = 0;
    this.currentRetries = 0;
    this.lastProgressUpdate = 0;
    this.lastExecutionUpdate = 0;
    this.lastStatusTime = Date.now();
    
    // Clear any existing timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.executionCompleteTimeout) {
      clearTimeout(this.executionCompleteTimeout);
      this.executionCompleteTimeout = null;
    }
    
    // Remove any existing event listener to avoid duplicates
    document.removeEventListener('serialdata', this.responseHandler);
    
    // Set up event listener for responses
    document.addEventListener('serialdata', this.responseHandler);
    
    // Send configuration commands to FluidNC
    try {
     
      
      // Send the first line
      await this.sendNextLine();
      
      return true;
    } catch (error) {
      console.error("Error starting G-code transfer:", error);
      if (this.callbacks.onError) {
        this.callbacks.onError("Error starting G-code transfer: " + error.message);
      }
      this.stop();
      return false;
    }
  }
  
  /**
   * PERFORMANCE OPTIMIZATION: Throttled progress update
   * Only sends UI updates at a controlled rate to prevent lag
   */
  updateProgress() {
    // Update internal progress state
    this.currentProgress = {
      sent: this.currentLineIndex,
      acknowledged: this.currentLineIndex,
      total: this.lines.length,
      progress: Math.min((this.currentLineIndex / this.lines.length) * 100, 100)
    };
    
    // Only notify UI at throttled intervals
    const now = Date.now();
    if ((now - this.lastProgressUpdate) >= this.UI_UPDATE_INTERVAL) {
      this.lastProgressUpdate = now;
      
      // Only call the callback if enough time has passed
      if (this.callbacks.onProgress) {
        this.callbacks.onProgress(this.currentProgress);
      }
    }
  }
  
  /**
   * Update execution progress based on controller status
   * @param {number} executedLine - The line currently being executed
   */
  updateExecutionProgress(executedLine) {
    // Check if it's a valid line number
    if (executedLine !== undefined && executedLine >= 0) {
      this.executedLineIndex = executedLine;
      
      // Update internal execution progress
      this.executionProgress = {
        executed: executedLine,
        total: this.lines.length,
        progress: Math.min((executedLine / this.lines.length) * 100, 100)
      };
      
      // Only notify UI at throttled intervals
      const now = Date.now();
      if ((now - this.lastExecutionUpdate) >= this.UI_UPDATE_INTERVAL) {
        this.lastExecutionUpdate = now;
        
        if (this.callbacks.onExecutionProgress) {
          this.callbacks.onExecutionProgress(this.executionProgress);
        }
      }
      
      // Update last status time to track execution completion
      this.lastStatusTime = Date.now();
      
      // Reset execution complete timeout since we're still executing
      if (this.executionCompleteTimeout) {
        clearTimeout(this.executionCompleteTimeout);
        this.executionCompleteTimeout = null;
      }
    }
  }
  
  /**
   * Send the next line of GCode
   */
  async sendNextLine() {
    if (!this.isSending || this.isPaused) {
      return;
    }
    
    // Check if we've reached the end of the lines
    if (this.currentLineIndex >= this.lines.length) {
      this.onSendingComplete();
      return;
    }
    
    let line = this.lines[this.currentLineIndex];
    
    // Add line number if enabled
    if (this.useLineNumbers) {
      const lineNumber = this.startLineNumber + this.currentLineIndex;
      line = `${this.lineNumberPrefix}${lineNumber} ${line}`;
    }
    
    try {
      // Log what we're sending for debugging
      this.log(`Sending line ${this.currentLineIndex+1}/${this.lines.length}: ${line}`);
      
      // Send the line
      await this.serialService.send(line);
      
      // Set a timeout for response
      this.setResponseTimeout();
      
      // PERFORMANCE OPTIMIZATION: Use throttled progress updates
      this.updateProgress();
    } catch (error) {
      console.error(`Error sending line: ${error.message}`);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(`Error sending line: ${error.message}`);
      }
      
      // Pause on error
      this.pause("Send error: " + error.message);
    }
  }
  
  /**
   * Set a timeout for line acknowledgment
   */
  setResponseTimeout() {
    // Clear any existing timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
    }
    
    // Set a new timeout
    this.responseTimeout = setTimeout(() => {
      this.handleTimeout();
    }, this.MAX_RESPONSE_WAIT);
  }
  
  /**
   * Handle timeout when response is not received
   */
  handleTimeout() {
    if (!this.isSending) {
      return;
    }
    
    this.log(`Command timeout - no response for line ${this.currentLineIndex + 1}`);
    
    // If we've reached the maximum retries, report error and pause
    if (this.currentRetries >= this.MAX_RETRIES) {
      const line = this.lines[this.currentLineIndex];
      const errorMessage = `Maximum retries (${this.MAX_RETRIES}) reached for line ${this.currentLineIndex + 1}: ${line}`;
      console.error(errorMessage);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(errorMessage);
      }
      
      if (this.callbacks.onLineError) {
        this.callbacks.onLineError(this.currentLineIndex, line, "Maximum retries reached");
      }
      
      this.pause("Response timeout after maximum retries");
      return;
    }
    
    // Increment retry count
    this.currentRetries++;
    
    // Try sending a status query to check if the controller is responsive
    this.log(`Attempting retry ${this.currentRetries}/${this.MAX_RETRIES} for line ${this.currentLineIndex + 1}`);
    
    // Try to send the line again after a delay
    setTimeout(() => {
      if (this.isSending && !this.isPaused) {
        this.sendNextLine(); // Resend the current line
      }
    }, this.RETRY_DELAY);
  }
  
  /**
   * Handle response from the controller
   */
  handleResponse(event) {
    const data = event.detail;
    
    if (!data || !data.data) return;
    
    const response = data.data.trim();
    
    // Skip empty responses
    if (!response) return;
    
    // Handle status responses
    if (response.startsWith('<') && response.includes('|')) {
      this.handleStatusResponse(response);
      return;
    }
    
    // Make sure we're still in sending mode
    if (!this.isSending) {
      return;
    }
    
    this.log("Received response:", response);
    
    // Clear the response timeout since we got a response
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (response === 'ok') {
      // Line was processed successfully
      this.log(`Line ${this.currentLineIndex + 1} acknowledged with 'ok'`);
      
      // Reset retry counter for next line
      this.currentRetries = 0;
      
      // Notify line success
      if (this.callbacks.onLineSuccess) {
        this.callbacks.onLineSuccess(this.currentLineIndex, this.lines[this.currentLineIndex]);
      }
      
      // Move to next line
      this.currentLineIndex++;
      
      // PERFORMANCE OPTIMIZATION: Use throttled progress updates
      this.updateProgress();
      
      // Check if we're done
      if (this.currentLineIndex >= this.lines.length) {
        this.onSendingComplete();
      } 
      // Send next line if not paused
      else if (!this.isPaused) {
        this.sendNextLine();
      }
    } 
    else if (response.startsWith('error:')) {
      const errorMessage = `Error: ${response.substring(6)} at line ${this.currentLineIndex + 1}: ${this.lines[this.currentLineIndex]}`;
      console.error(errorMessage);
      
      // Notify callbacks
      if (this.callbacks.onError) {
        this.callbacks.onError(errorMessage);
      }
      
      if (this.callbacks.onLineError) {
        this.callbacks.onLineError(this.currentLineIndex, this.lines[this.currentLineIndex], response.substring(6));
      }
      
      // If we haven't reached max retries, retry the line
      if (this.currentRetries < this.MAX_RETRIES) {
        this.currentRetries++;
        this.log(`Retrying line ${this.currentLineIndex + 1}, attempt ${this.currentRetries}/${this.MAX_RETRIES}`);
        
        // Retry after a delay
        setTimeout(() => {
          if (this.isSending && !this.isPaused) {
            this.sendNextLine(); // Resend the current line
          }
        }, this.RETRY_DELAY);
      } else {
        // Max retries reached, pause sending
        this.pause(`Maximum retries reached on error: ${response}`);
      }
    }
    else if (response.startsWith('ALARM:')) {
      // Alarm state - this is serious
      const alarmMessage = `Machine alarm: ${response}`;
      console.error(alarmMessage);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(alarmMessage);
      }
      
      this.pause("Alarm triggered");
    }
  }
  
  /**
   * Handle status response from controller
   * @param {string} status - Status message from controller
   */
  handleStatusResponse(status) {
    // Parse status response
    try {
      // Update last status time
      this.lastStatusTime = Date.now();
      
      // Extract state
      const stateMatch = status.match(/<([^|>]+)/);
      const state = stateMatch ? stateMatch[1] : "Unknown";
      
      // Check for line number information for execution tracking
      const lineMatch = status.match(/Ln:(\d+)/);
      if (lineMatch) {
        const executedLine = parseInt(lineMatch[1], 10);
        
        // Update execution progress
        this.updateExecutionProgress(executedLine);
      }
      
      // Extract machine position
      const posMatch = status.match(/MPos:([^|>]+)/);
      const position = posMatch ? posMatch[1].split(',').map(parseFloat) : [0, 0, 0];
      
      // Extract work coordinates
      const wcoMatch = status.match(/WCO:([^|>]+)/);
      const workOffset = wcoMatch ? wcoMatch[1].split(',').map(parseFloat) : [0, 0, 0];
      
      // Extract feed and speed
      const fsMatch = status.match(/FS:([^|>]+)/);
      const feedSpeed = fsMatch ? fsMatch[1].split(',').map(parseFloat) : [0, 0];
      
      // Create status object
      const statusObj = {
        state,
        position,
        workOffset,
        feedRate: feedSpeed[0] || 0,
        spindleSpeed: feedSpeed[1] || 0,
        executedLine: lineMatch ? parseInt(lineMatch[1], 10) : -1,
        raw: status
      };
      
      // Notify callback if available
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(statusObj);
      }
      
      // Check if execution is complete
      // This happens when the state is Idle and we've sent all lines
      if (state === "Idle" && this.currentLineIndex >= this.lines.length && this.isExecuting) {
        // Don't immediately consider execution complete - wait a short time
        // to ensure there are no more movements
        if (!this.executionCompleteTimeout) {
          this.executionCompleteTimeout = setTimeout(() => {
            this.onExecutionComplete();
          }, this.EXECUTION_COMPLETE_TIMEOUT);
        }
      } else if (this.executionCompleteTimeout) {
        // If we're not idle or haven't sent all lines, cancel the timeout
        clearTimeout(this.executionCompleteTimeout);
        this.executionCompleteTimeout = null;
      }
    } catch (error) {
      this.log("Error parsing status:", error);
    }
  }
  
  /**
   * Called when all sending is complete
   */
  onSendingComplete() {
    this.log("G-code sending complete");
    
    // If in check mode, exit it
    if (this.isChecking) {
      try {
        this.serialService.send('$C');
        this.log("Disabled check mode");
      } catch (error) {
        this.log("Error disabling check mode:", error);
      }
    }
    
    this.isSending = false;
    
    // Note: We don't set isExecuting to false here, as the machine
    // might still be moving for a while. Execution completion is tracked
    // separately via status updates.
    
    // Clean up sending resources
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete({
        sent: this.currentLineIndex,
        total: this.lines.length
      });
    }

  }
  
  /**
   * Called when execution is complete
   */
  onExecutionComplete() {
    if (!this.isExecuting) return;
    
    this.log("G-code execution complete");
    this.isExecuting = false;
    
    // Clear all timeouts
    if (this.executionCompleteTimeout) {
      clearTimeout(this.executionCompleteTimeout);
      this.executionCompleteTimeout = null;
    }

    
    // Clean up the event listener
    document.removeEventListener('serialdata', this.responseHandler);
    
    // Final execution progress update
    this.executionProgress.executed = this.lines.length;
    this.executionProgress.progress = 100;
    
    if (this.callbacks.onExecutionProgress) {
      this.callbacks.onExecutionProgress(this.executionProgress);
    }
    
    if (this.callbacks.onExecutionComplete) {
      this.callbacks.onExecutionComplete({
        executed: this.lines.length,
        total: this.lines.length
      });
    }
  }
  
  /**
   * Pause sending
   * @param {string} reason - Reason for pausing
   */
  pause(reason = "User requested") {
    if (!this.isSending || this.isPaused) return false;
    
    this.isPaused = true;
    
    if (this.callbacks.onPause) {
      this.callbacks.onPause(reason);
    }
    
    this.log(`Sending paused: ${reason}`);
    
    // Try to send feed hold if this was user-requested
    if (reason === "User requested") {
      try {
        // Send ! character (feed hold)
        if (this.serialService) {
          this.serialService.feedHold();
        }
      } catch (error) {
        this.log("Error sending feed hold:", error);
      }
    }
    
    return true;
  }
  
  /**
   * Resume sending
   */
  resume() {
    if (!this.isSending || !this.isPaused) return false;
    
    try {
      // Send ~ character (cycle start/resume)
      if (this.serialService) {
        this.serialService.resumeFromHold();
      }
    } catch (error) {
      this.log("Error sending resume:", error);
    }
    
    this.isPaused = false;
    
    if (this.callbacks.onResume) {
      this.callbacks.onResume();
    }
    
    this.log("Sending resumed");
    
    // Continue processing
    this.sendNextLine();
    
    return true;
  }
  
  /**
   * Stop sending
   */
  stop() {
    if (!this.isSending && !this.isExecuting) return false;
    
    this.log("Stopping G-code sending");
    
    this.isSending = false;
    this.isPaused = false;
    this.isExecuting = false;
    
    // Clean up
    document.removeEventListener('serialdata', this.responseHandler);
    
    // Cancel any timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.executionCompleteTimeout) {
      clearTimeout(this.executionCompleteTimeout);
      this.executionCompleteTimeout = null;
    }
    
    // Optional: send a feed hold and then a reset
    try {
      if (this.serialService) {
        // Feed hold first to stop movement
        this.serialService.feedHold();
        
        // Then after a brief delay, send reset
        setTimeout(() => {
          this.serialService.flush();
        }, 100);
      }
    } catch (error) {
      this.log("Error during stop sequence:", error);
    }
    
    return true;
  }
  
  /**
   * Get the current status
   * @returns {Object} - Status object
   */
  getStatus() {
    // Calculate progress safely
    let sendProgress = 0;
    let executionProgress = 0;
    
    if (this.lines.length > 0) {
      sendProgress = Math.min(
        (this.currentLineIndex / this.lines.length) * 100,
        100
      );
      
      executionProgress = Math.min(
        (this.executedLineIndex / this.lines.length) * 100,
        100
      );
    }
    
    return {
      isSending: this.isSending,
      isPaused: this.isPaused,
      isExecuting: this.isExecuting,
      isChecking: this.isChecking,
      currentLine: this.currentLineIndex < this.lines.length ? 
        this.lines[this.currentLineIndex] : null,
      currentLineIndex: this.currentLineIndex,
      executedLineIndex: this.executedLineIndex,
      totalLines: this.lines.length,
      sendProgress: sendProgress,
      executionProgress: executionProgress,
      remainingLines: this.lines.length - this.currentLineIndex,
      remainingExecution: this.lines.length - this.executedLineIndex,
      retryCount: this.currentRetries,
      maxRetries: this.MAX_RETRIES,
      useLineNumbers: this.useLineNumbers
    };
  }
}

export default GCodeSender;