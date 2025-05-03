/**
 * Simplified G-Code Sender for GRBL/FluidNC machines
 * 
 * Implements a safe line-by-line approach where each line must be
 * acknowledged before the next one is sent.
 */
class GCodeSender {
  constructor() {
    // Core state
    this.lines = [];                // Array of GCode lines to send
    this.currentLineIndex = 0;      // Current line index to send
    this.isSending = false;         // Whether we're currently sending
    this.isPaused = false;          // Whether sending is paused
    this.isChecking = false;        // Whether we're in check mode
    
    // Retry configuration
    this.MAX_RETRIES = 3;           // Maximum number of retries per line
    this.RETRY_DELAY = 1000;        // 1 second delay before retry
    this.currentRetries = 0;        // Current retry count for current line
    
    // Response timeout
    this.responseTimeout = null;
    this.MAX_RESPONSE_WAIT = 30000; // 30 seconds max wait for response
    
    // Callback functions
    this.callbacks = {
      onProgress: null,      // Called when progress is made
      onComplete: null,      // Called when all sending is complete
      onError: null,         // Called when errors occur
      onLineSuccess: null,   // Called when a line is successfully sent
      onLineError: null,     // Called when a line fails
      onPause: null,         // Called when sending is paused
      onResume: null,        // Called when sending is resumed
      onStatusUpdate: null   // Called when machine status updates
    };
    
    // Serial service reference
    this.serialService = null;
    
    // Response handler reference
    this.responseHandler = this.handleResponse.bind(this);
    
    // Debug logging
    this.debug = false; // Set to false to disable debug logging
  }
  
  /**
   * Log debugging information if debug mode is enabled
   */
  log(...args) {
    if (this.debug) {
      console.log("[SimpleGCodeSender]", ...args);
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
    this.currentLineIndex = 0;
    this.currentRetries = 0;
    
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
      
      // Send a single status query
      await this.serialService.send('?');
      
      // Wait a moment to ensure controller is ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
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
    
    const line = this.lines[this.currentLineIndex];
    
    try {
      // Log what we're sending for debugging
      this.log(`Sending line ${this.currentLineIndex+1}/${this.lines.length}: ${line}`);
      
      // Send the line
      await this.serialService.send(line);
      
      // Set a timeout for response
      this.setResponseTimeout();
      
      // Notify line sending
      if (this.callbacks.onProgress) {
        const progress = Math.min(
          (this.currentLineIndex / this.lines.length) * 100,
          100
        );
        
        this.callbacks.onProgress({
          sent: this.currentLineIndex,
          acknowledged: this.currentLineIndex,
          total: this.lines.length,
          progress: progress
        });
      }
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
      
      // Update progress
      if (this.callbacks.onProgress) {
        const progress = Math.min(
          (this.currentLineIndex / this.lines.length) * 100,
          100
        );
        
        this.callbacks.onProgress({
          sent: this.currentLineIndex,
          acknowledged: this.currentLineIndex,
          total: this.lines.length,
          progress: progress
        });
      }
      
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
    // Parse status response (e.g., "<Idle|MPos:0.000,0.000,0.000|FS:0,0|WCO:0.000,0.000,0.000>")
    try {
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
    
    // Cancel any timeout
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
    if (!this.isSending) return false;
    
    this.log("Stopping G-code sending");
    
    this.isSending = false;
    this.isPaused = false;
    
    // Clean up
    document.removeEventListener('serialdata', this.responseHandler);
    
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
        (this.currentLineIndex / this.lines.length) * 100,
        100
      );
    }
    
    return {
      isSending: this.isSending,
      isPaused: this.isPaused,
      isChecking: this.isChecking,
      currentLine: this.currentLineIndex < this.lines.length ? 
        this.lines[this.currentLineIndex] : null,
      currentLineIndex: this.currentLineIndex,
      totalLines: this.lines.length,
      progress: progress,
      remainingLines: this.lines.length - this.currentLineIndex,
      retryCount: this.currentRetries,
      maxRetries: this.MAX_RETRIES
    };
  }
}

export default GCodeSender;