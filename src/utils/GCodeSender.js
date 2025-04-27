/**
 * G-Code Sender for GRBL/FluidNC machines
 * 
 * Implements buffer-based streaming similar to UGS and other professional senders.
 * This approach keeps the controller's buffer full but not overflowed, maximizing
 * throughput while maintaining reliability.
 */
class GCodeSender {
  constructor() {
    // Core state
    this.lines = [];                 // Array of GCode lines to send
    this.linesSent = [];             // Array of line objects with metadata
    this.currentLineIndex = 0;       // Current line index to send
    this.lastAcknowledgedIndex = -1; // Last acknowledged line index
    this.isSending = false;          // Whether we're currently sending
    this.isPaused = false;           // Whether sending is paused
    this.isChecking = false;         // Whether we're in check mode
    
    // Buffer management
    this.bufferSize = 127;          // GRBL's default RX buffer size (most machines)
    this.bufferUsed = 0;            // Currently used buffer space (bytes)
    
    // Status tracking
    this.statusPollInterval = null;  // Interval for status polling (fallback)
    this.STATUS_POLL_RATE = 200;     // How often to poll for status (ms) if needed
    this.lastStatusTime = null;      // Last time we received a status update
    
    // Timeout handling
    this.responseTimeout = null;
    this.MAX_RESPONSE_WAIT = 30000;  // 30 seconds max wait for response
    this.RETRY_DELAY = 1000;         // 1 second delay before retry
    this.MAX_RETRIES = 3;            // Maximum number of retries per line
    
    // Callback functions
    this.callbacks = {
      onProgress: null,       // Called when progress is made
      onComplete: null,       // Called when all sending is complete
      onError: null,          // Called when errors occur
      onLineSuccess: null,    // Called when a line is successfully sent
      onLineError: null,      // Called when a line fails
      onPause: null,          // Called when sending is paused
      onResume: null,         // Called when sending is resumed
      onStatusUpdate: null    // Called when machine status updates
    };
    
    // Serial service reference
    this.serialService = null;
    
    // Response handler reference
    this.responseHandler = this.handleResponse.bind(this);
    
    // Debug logging
    this.debug = true; // Set to false to disable debug logging
  }
  
  /**
   * Log debugging information if debug mode is enabled
   */
  log(...args) {
    if (this.debug) {
      console.log("[GCodeSender]", ...args);
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
    this.lastAcknowledgedIndex = -1;
    this.bufferUsed = 0;
    this.linesSent = [];
    
    // Split G-code into lines and clean them
    this.lines = gcode.split('\n')
      .map(line => {
        // Remove comments and trim whitespace
        const commentIndex = line.indexOf(';');
        return (commentIndex >= 0 ? line.substring(0, commentIndex) : line).trim();
      })
      .filter(line => line); // Remove empty lines
    
    this.log(`Loaded ${this.lines.length} lines of G-code`);
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
   * Set GRBL buffer size (for different controller versions)
   * @param {number} size - Buffer size in bytes
   */
  setBufferSize(size) {
    // Validate buffer size (most GRBL variants use 127-byte buffer)
    if (typeof size === 'number' && size > 0) {
      this.bufferSize = size;
      this.log(`Set GRBL buffer size to ${size} bytes`);
    }
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
    this.isPaused = false;
    this.isChecking = checkMode;
    this.bufferUsed = 0;
    this.currentLineIndex = 0;
    this.lastAcknowledgedIndex = -1;
    this.linesSent = [];
    this.lastStatusTime = null;
    
    // Clear any existing timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    // Remove any existing event listener to avoid duplicates
    document.removeEventListener('serialdata', this.responseHandler);
    
    // Set up event listener for responses
    document.addEventListener('serialdata', this.responseHandler);
    
    this.log(`Starting G-code transfer: ${this.lines.length} lines, Check mode: ${checkMode}`);
    
    try {
      // If check mode is enabled, send the $C command to enable it
      if (checkMode) {
        await this.serialService.send('$C');
        this.log("Enabled check mode");
      }
      
      // Flush any pending commands and ensure controller is ready
      await this.serialService.flush();
      this.log("Flushed controller buffer before starting transfer");
      
      // Send a single status query to check if auto-reporting is active
      // The controller will respond immediately, and we'll decide if polling is needed
      // based on whether we get automatic reports afterward
      await this.serialService.send('?');
      
      // Wait a moment to see if auto-reporting kicks in
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Begin filling the buffer
      await this.fillBuffer();
      
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
   * Fill the buffer with as many lines as possible
   * This is the core of the streaming algorithm used by UGS and other professional senders
   */
  async fillBuffer() {
    if (!this.isSending || this.isPaused) {
      return;
    }
    
    // If we've sent all lines, don't try to send more
    if (this.currentLineIndex >= this.lines.length) {
      return;
    }
    
    // Process as many lines as will fit in the buffer
    while (this.currentLineIndex < this.lines.length && !this.isPaused) {
      const line = this.lines[this.currentLineIndex];
      const lineLength = this.getLineLength(line);
      
      // Check if this line would overflow the buffer
      if (this.bufferUsed + lineLength > this.bufferSize) {
        this.log(`Buffer nearly full (${this.bufferUsed}/${this.bufferSize}), waiting for acknowledgments...`);
        break;
      }
      
      try {
        // Log what we're sending for debugging
        this.log(`Sending line ${this.currentLineIndex+1}/${this.lines.length}: ${line}`);
        
        // Send the line
        await this.serialService.send(line);
        
        // Track this line in our sent lines array with metadata
        this.linesSent.push({
          index: this.currentLineIndex,
          content: line,
          length: lineLength,
          sent: true,
          acknowledged: false,
          timestamp: Date.now(),
          retries: 0
        });
        
        // Update buffer usage
        this.bufferUsed += lineLength;
        this.log(`Buffer usage: ${this.bufferUsed}/${this.bufferSize} bytes`);
        
        // Update line index
        this.currentLineIndex++;
        
        // Notify progress
        if (this.callbacks.onProgress) {
          // Calculate progress percentage - sent vs. total lines
          const progress = Math.min(
            ((this.currentLineIndex) / this.lines.length) * 100,
            100
          );
          
          this.callbacks.onProgress({
            sent: this.currentLineIndex,
            acknowledged: this.lastAcknowledgedIndex + 1,
            total: this.lines.length,
            progress: progress,
            bufferUsed: this.bufferUsed,
            bufferSize: this.bufferSize
          });
        }
        
        if (this.callbacks.onLineSuccess) {
          this.callbacks.onLineSuccess(this.currentLineIndex - 1, line);
        }
      } catch (error) {
        console.error(`Error sending line: ${error.message}`);
        
        if (this.callbacks.onError) {
          this.callbacks.onError(`Error sending line: ${error.message}`);
        }
        
        // Pause on error
        this.pause("Send error: " + error.message);
        break;
      }
    }
    
    // If we've sent the last line and all lines are acknowledged, we're done
    if (this.currentLineIndex >= this.lines.length && 
        this.lastAcknowledgedIndex >= this.lines.length - 1) {
      this.onSendingComplete();
    }
    // If we're blocking on buffer but have unacknowledged lines, set a timeout
    else if (this.linesSent.length > 0 && 
             !this.linesSent.every(line => line.acknowledged)) {
      this.setResponseTimeout();
    }
  }
  
  /**
   * Calculate the line length in bytes, considering GRBL's line counting
   * @param {string} line - The G-code line
   * @returns {number} - Length in bytes
   */
  getLineLength(line) {
    // GRBL counts the length of the line including the terminating newline
    // We add 1 to account for the newline character
    return new TextEncoder().encode(line + '\n').length;
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
   * Handle timeout when not enough responses are received
   */
  handleTimeout() {
    // Check if we're still in a sending state
    if (!this.isSending) {
      return;
    }
    
    // Find the earliest unacknowledged line
    const unacknowledgedLine = this.linesSent.find(line => !line.acknowledged);
    
    if (!unacknowledgedLine) {
      this.log("Timeout but no unacknowledged lines found");
      return;
    }
    
    const timeElapsed = Date.now() - unacknowledgedLine.timestamp;
    this.log(`Command timeout - no response for line ${unacknowledgedLine.index + 1} after ${timeElapsed/1000} seconds`);
    
    // If we've reached the maximum retries, report error and pause
    if (unacknowledgedLine.retries >= this.MAX_RETRIES) {
      const errorMessage = `Maximum retries (${this.MAX_RETRIES}) reached for line ${unacknowledgedLine.index + 1}: ${unacknowledgedLine.content}`;
      console.error(errorMessage);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(errorMessage);
      }
      
      if (this.callbacks.onLineError) {
        this.callbacks.onLineError(unacknowledgedLine.index, unacknowledgedLine.content, "Maximum retries reached");
      }
      
      this.pause("Response timeout after maximum retries");
      return;
    }
    
    // Try sending a status query to check if the controller is responsive
    this.log(`Attempting recovery for line ${unacknowledgedLine.index + 1}, retry ${unacknowledgedLine.retries + 1}/${this.MAX_RETRIES}`);
    
    this.serialService.send('?').catch(() => {
      this.log("Status query failed during recovery");
    });
    
    // Increment retry count
    unacknowledgedLine.retries++;
    
    // Set a new timeout with a longer delay for the retry
    this.responseTimeout = setTimeout(() => {
      // If still not acknowledged, try more aggressive recovery
      if (!unacknowledgedLine.acknowledged) {
        this.attemptRecovery();
      }
    }, this.RETRY_DELAY);
  }
  
  /**
   * Attempt to recover from a stalled state
   */
  async attemptRecovery() {
    this.log("Attempting connection recovery");
    
    try {
      // First try a soft reset
      this.log("Sending soft reset (Ctrl+X)");
      await this.serialService.send('\x18');
      
      // Wait a moment for reset to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if we're still connected
      if (!this.serialService.getConnectionStatus()) {
        this.log("Lost connection during recovery");
        this.pause("Connection lost");
        return;
      }
      
      // Reset our state
      this.log("Resetting sender state after recovery");
      this.bufferUsed = 0;
      
      // Mark all sent but unacknowledged lines as not sent
      this.linesSent.forEach(line => {
        if (!line.acknowledged) {
          line.sent = false;
        }
      });
      
      // Reset current line index to the earliest unacknowledged line
      const earliestUnacked = this.linesSent.findIndex(line => !line.acknowledged);
      if (earliestUnacked >= 0) {
        this.currentLineIndex = this.linesSent[earliestUnacked].index;
      }
      
      this.log(`Resuming from line ${this.currentLineIndex + 1}`);
      
      // Resume sending
      if (this.isPaused) {
        this.resume();
      } else {
        this.fillBuffer();
      }
    } catch (error) {
      console.error("Recovery failed:", error);
      this.pause("Recovery failed: " + error.message);
    }
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
    
    // Skip status responses and handle them separately
    if (response.startsWith('<') && response.includes('|')) {
      this.handleStatusResponse(response);
      return;
    }
    
    // Make sure we're still in sending mode
    if (!this.isSending) {
      return;
    }
    
    this.log("Received response:", response);
    
    // Reset the response timeout since we got a response
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (response === 'ok') {
      // Line was processed successfully - acknowledge the oldest unacknowledged line
      const lineToAck = this.linesSent.find(line => !line.acknowledged);
      
      if (lineToAck) {
        this.log(`Line ${lineToAck.index + 1} acknowledged with 'ok'`);
        
        // Mark as acknowledged
        lineToAck.acknowledged = true;
        
        // Update last acknowledged index
        this.lastAcknowledgedIndex = lineToAck.index;
        
        // Free up buffer space
        this.bufferUsed -= lineToAck.length;
        this.log(`Buffer usage after ack: ${this.bufferUsed}/${this.bufferSize} bytes`);
        
        // Update progress
        if (this.callbacks.onProgress) {
          // Calculate progress - acknowledged vs. total lines
          const progress = Math.min(
            ((this.lastAcknowledgedIndex + 1) / this.lines.length) * 100,
            100
          );
          
          this.callbacks.onProgress({
            sent: this.currentLineIndex,
            acknowledged: this.lastAcknowledgedIndex + 1,
            total: this.lines.length,
            progress: progress,
            bufferUsed: this.bufferUsed,
            bufferSize: this.bufferSize
          });
        }
        
        // Continue filling the buffer if not paused
        if (!this.isPaused) {
          this.fillBuffer();
        }
      } else {
        this.log("Received 'ok' but no unacknowledged line found");
      }
    } 
    else if (response.startsWith('error:')) {
      // Error occurred - identify the line that caused it
      const lineWithError = this.linesSent.find(line => !line.acknowledged);
      
      if (lineWithError) {
        const errorMessage = `Error: ${response.substring(6)} at line ${lineWithError.index + 1}: ${lineWithError.content}`;
        console.error(errorMessage);
        
        // Notify callbacks
        if (this.callbacks.onError) {
          this.callbacks.onError(errorMessage);
        }
        
        if (this.callbacks.onLineError) {
          this.callbacks.onLineError(lineWithError.index, lineWithError.content, response.substring(6));
        }
        
        // Mark the line as acknowledged (error is still an acknowledgment)
        lineWithError.acknowledged = true;
        
        // Update last acknowledged index
        this.lastAcknowledgedIndex = lineWithError.index;
        
        // Free up buffer space
        this.bufferUsed -= lineWithError.length;
        
        // Continue sending if not paused
        if (!this.isPaused) {
          this.fillBuffer();
        }
      } else {
        this.log("Received error but no unacknowledged line found");
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
    else {
      // Unrecognized response - could be startup message or other info
      this.log(`Received unrecognized response: ${response}`);
      
      // We don't acknowledge any line for unrecognized responses,
      // but we may need to continue filling the buffer
      if (!this.isPaused) {
        this.fillBuffer();
      }
    }
    
    // Check if we need to set a new timeout
    if (this.isSending && 
        !this.isPaused && 
        this.linesSent.some(line => !line.acknowledged)) {
      this.setResponseTimeout();
    }
    
    // Check if we're done
    if (this.currentLineIndex >= this.lines.length && 
        (this.lastAcknowledgedIndex >= this.lines.length - 1 || this.linesSent.every(line => line.acknowledged))) {
      this.onSendingComplete();
    }
  }
  
  /**
   * Handle status response from controller
   * @param {string} status - Status message from controller
   */
  handleStatusResponse(status) {
    // Parse status response (e.g., "<Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>")
    try {
      // Record that we received an automatic status update
      this.lastStatusTime = Date.now();
      
      // Extract state
      const stateMatch = status.match(/<([^|>]+)/);
      const state = stateMatch ? stateMatch[1] : "Unknown";
      
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
        raw: status
      };
      
      // Notify callback if available
      if (this.callbacks.onStatusUpdate) {
        this.callbacks.onStatusUpdate(statusObj);
      }
    } catch (error) {
      this.log("Error parsing status:", error);
    }
  }
  
  /**
   * Start polling for status (if needed)
   * Note: With FluidNC's automatic reporting (every 50ms), this is usually not necessary
   */
  startStatusPolling() {
    // With FluidNC's automatic reporting, we typically don't need to poll
    // This method is kept for compatibility with controllers that don't auto-report
    
    // Check if we've received an automatic status report recently
    const now = Date.now();
    if (this.lastStatusTime && now - this.lastStatusTime < 500) {
      // We're already getting automatic reports, no need to poll
      this.log("Automatic status reporting detected, skipping polling");
      return;
    }
    
    // Only start polling if automatic reporting isn't detected
    this.stopStatusPolling();
    this.statusPollInterval = setInterval(() => {
      if (!this.isSending) {
        this.stopStatusPolling();
        return;
      }
      
      try {
        this.serialService.send('?').catch(() => {});
      } catch (error) {
        this.log("Error sending status query:", error);
      }
    }, this.STATUS_POLL_RATE);
  }
  
  /**
   * Stop polling for status
   */
  stopStatusPolling() {
    if (this.statusPollInterval) {
      clearInterval(this.statusPollInterval);
      this.statusPollInterval = null;
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
    this.isPaused = false;
    
    // Clean up
    document.removeEventListener('serialdata', this.responseHandler);
    this.stopStatusPolling();
    
    // Cancel any timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete({
        sent: this.lines.length,
        acknowledged: this.lastAcknowledgedIndex + 1,
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
    
    // Continue processing the queue
    this.fillBuffer();
    
    return true;
  }
  
  /**
   * Stop sending
   */
  stop() {
    if (!this.isSending) return false;
    
    this.log("Stopping G-code sending");
    
    this.isSending = false;
    this.isPaused = false;
    
    // Clean up
    document.removeEventListener('serialdata', this.responseHandler);
    this.stopStatusPolling();
    
    // Cancel any timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
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
    
    // Reset any status tracking
    this.lastStatusTime = null;
    
    return true;
  }
  
  /**
   * Get the current status
   * @returns {Object} - Status object
   */
  getStatus() {
    // Calculate progress safely
    let progress = 0;
    if (this.lines.length > 0) {
      progress = Math.min(
        ((this.lastAcknowledgedIndex + 1) / this.lines.length) * 100,
        100
      );
    }
    
    // Calculate buffer usage percentage
    const bufferUsagePercent = this.bufferSize > 0 ? 
      (this.bufferUsed / this.bufferSize) * 100 : 0;
    
    return {
      isSending: this.isSending,
      isPaused: this.isPaused,
      isChecking: this.isChecking,
      linesSent: this.currentLineIndex,
      linesAcknowledged: this.lastAcknowledgedIndex + 1,
      totalLines: this.lines.length,
      progress: progress,
      bufferUsed: this.bufferUsed,
      bufferSize: this.bufferSize,
      bufferUsagePercent: bufferUsagePercent,
      currentLine: this.currentLineIndex < this.lines.length ? 
        this.lines[this.currentLineIndex] : null,
      remainingLines: this.lines.length - (this.lastAcknowledgedIndex + 1),
      unacknowledgedLines: this.linesSent.filter(line => !line.acknowledged).length
    };
  }
}

export default GCodeSender;