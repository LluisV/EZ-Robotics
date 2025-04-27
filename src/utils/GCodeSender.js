/**
 * Simple GCode Sender for GRBL/FluidNC machines
 * Sends one line at a time and waits for confirmation before sending the next.
 */
class SimpleGCodeSender {
  constructor() {
    // Core state
    this.lines = [];          // Array of GCode lines to send
    this.currentLineIndex = 0; // Current line being processed
    this.isSending = false;   // Whether we're currently sending
    this.isPaused = false;    // Whether sending is paused
    
    // Callback functions
    this.callbacks = {
      onProgress: null,       // Called when progress is made
      onComplete: null,       // Called when all sending is complete
      onError: null,          // Called when errors occur
      onLineSuccess: null,    // Called when a line is successfully sent
      onPause: null,          // Called when sending is paused
      onResume: null          // Called when sending is resumed
    };
    
    // Timeout handling
    this.responseTimeout = null;
    this.MAX_RESPONSE_WAIT = 20000; // 20 seconds max wait for response
    this.waitingForResponse = false; // Flag to track if we're waiting for a response
    
    // Response handler reference
    this.lineResponseHandler = this.handleLineResponse.bind(this);
    
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
    this.retryCount = 0;
    
    // Split G-code into lines and clean them
    this.lines = gcode.split('\n')
      .map(line => {
        // Remove comments and trim whitespace
        const commentIndex = line.indexOf(';');
        return (commentIndex >= 0 ? line.substring(0, commentIndex) : line).trim();
      })
      .filter(line => line); // Remove empty lines

    // Add a finishing line that will set the machine to a safe state
    if (this.lines.length > 0 && !this.lines.includes('G28')) {
      // Add a move to a safe height and home command at the end if not already present
      if (!this.lines[this.lines.length - 1].startsWith('G1 Z')) {
        this.lines.push('G1 Z10 F1000 ; Move to safe height');
      }
    }
      
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
   * @returns {Promise<boolean>} - Success status
   */
  async start(serialService) {
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
    this.isSending = true;
    this.isPaused = false;
    this.waitingForResponse = false;
    this.retryCount = 0;
    this.serialService = serialService;
    this.currentLineIndex = 0;
    
    // Clear any existing timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    // Remove any existing event listener to avoid duplicates
    document.removeEventListener('serialdata', this.lineResponseHandler);
    
    // Set up event listener for responses
    document.addEventListener('serialdata', this.lineResponseHandler);
    
    this.log(`Starting G-code transfer: ${this.lines.length} lines`);
    
    // Flush any pending commands in the controller's buffer
    try {
      await this.serialService.flush();
      this.log("Flushed controller buffer before starting transfer");
    } catch (error) {
      this.log("Failed to flush controller buffer, proceeding anyway:", error);
    }
    
    // Send the first line
    try {
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
   * Send the next line in the queue
   */
  async sendNextLine() {
    if (!this.isSending || this.isPaused) {
      this.log("Not sending due to pause or stopped state");
      return;
    }
    
    // Check if we're done
    if (this.currentLineIndex >= this.lines.length) {
      this.log("All lines sent, completing transfer");
      this.onSendingComplete();
      return;
    }
    
    // Check if we're already waiting for a response
    if (this.waitingForResponse) {
      this.log("Already waiting for a response, won't send another line");
      return;
    }
    
    const line = this.lines[this.currentLineIndex];
    
    // Make sure we're not waiting for a response already
    if (this.responseTimeout) {
      this.log("Canceling previous timeout before sending new line");
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    try {
      // Log what we're sending for debugging
      this.log(`Sending line ${this.currentLineIndex+1}/${this.lines.length}: ${line}`);
      
      // Set waiting flag before sending
      this.waitingForResponse = true;
      
      // Send the line
      await this.serialService.send(line);
      
      // Notify that we sent a line
      if (this.callbacks.onProgress) {
        // Calculate progress safely
        const progress = Math.min(
          ((this.currentLineIndex + 1) / this.lines.length) * 100,
          100
        );
        
        this.callbacks.onProgress({
          sent: this.currentLineIndex + 1,
          acknowledged: this.currentLineIndex,
          total: this.lines.length,
          progress: progress
        });
      }
      
      if (this.callbacks.onLineSuccess) {
        this.callbacks.onLineSuccess(this.currentLineIndex);
      }
      
      // Set timeout for response
      this.responseTimeout = setTimeout(() => {
        this.handleTimeout();
      }, this.MAX_RESPONSE_WAIT);
      
    } catch (error) {
      console.error(`Error sending line: ${error.message}`);
      this.waitingForResponse = false;
      
      if (this.callbacks.onError) {
        this.callbacks.onError(`Error sending line: ${error.message}`);
      }
      // Pause on error
      this.pause("Send error: " + error.message);
    }
  }
  
  /**
   * Handle response from the controller
   */
  handleLineResponse(event) {
    const data = event.detail;
    
    if (!data || !data.data) return;
    
    const response = data.data.trim();
    
    // Skip empty responses
    if (!response) return;
    
    // Debug logging to help identify response issues
    this.log("Serial response:", response);
    
    // Skip status responses and handle them separately
    if (response.startsWith('<')) {
      // This is a status response, not an 'ok' for our command
      return;
    }
    
    // Make sure we're still in sending mode
    if (!this.isSending) {
      this.log("Received response but not in sending mode:", response);
      return;
    }
    
    // Check if we're waiting for a response
    if (!this.waitingForResponse) {
      this.log("Received response but not waiting for one:", response);
      return;
    }
    
    // Clear any timeout since we got a response
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    // Reset waiting flag and retry count
    this.waitingForResponse = false;
    this.retryCount = 0;
    
    if (response === 'ok') {
      // Line was processed successfully
      this.log(`Line ${this.currentLineIndex+1} acknowledged with 'ok'`);
      
      this.currentLineIndex++;
      
      // Safety check: don't let currentLine exceed total lines
      if (this.currentLineIndex > this.lines.length) {
        console.error("Index exceeded line count. Fixing currentLineIndex.");
        this.currentLineIndex = this.lines.length;
      }
      
      // Calculate progress - make sure it can't exceed 100%
      const progress = Math.min(
        (this.currentLineIndex / this.lines.length) * 100, 
        100
      );
      
      if (this.callbacks.onProgress) {
        this.callbacks.onProgress({
          sent: this.currentLineIndex,
          acknowledged: this.currentLineIndex,
          total: this.lines.length,
          progress: progress
        });
      }
      
      // Continue sending if not paused
      if (!this.isPaused) {
        this.sendNextLine();
      }
    } 
    else if (response.startsWith('error:')) {
      // Error occurred
      const errorMessage = `Error: ${response.substring(6)} at line ${this.currentLineIndex + 1}: ${this.lines[this.currentLineIndex]}`;
      console.error(errorMessage);
      
      if (this.callbacks.onError) {
        this.callbacks.onError(errorMessage);
      }
      
      // Move to next line despite the error, or we could pause here if preferred
      this.currentLineIndex++;
      
      // Safety check: don't let currentLine exceed total lines
      if (this.currentLineIndex > this.lines.length) {
        console.error("Index exceeded line count. Fixing currentLineIndex.");
        this.currentLineIndex = this.lines.length;
      }
      
      if (!this.isPaused) {
        this.sendNextLine();
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
      // Unrecognized response - most likely informational
      this.log(`Received unrecognized response: ${response}`);
      
      // We still need to continue with the next line
      // This happens with GRBL when it sends informational messages that aren't errors
      if (!this.isPaused) {
        this.sendNextLine();
      }
    }
  }
  
  /**
   * Handle timeout when no response is received
   */
  handleTimeout() {
    this.log(`Command timeout - no response received after ${this.MAX_RESPONSE_WAIT/1000} seconds`);
    
    // Make sure we're still in a sending state
    if (!this.isSending) {
      this.log("Timeout triggered but not in sending mode anymore");
      return;
    }
    
    // Check for index out of bounds
    if (this.currentLineIndex >= this.lines.length) {
      console.error("Current index is beyond line count in timeout handler");
      this.onSendingComplete();
      return;
    }
    
    // Report the timeout
    const lineNum = this.currentLineIndex + 1;
    const lineContent = this.lines[this.currentLineIndex];
    const timeoutMessage = `Timeout waiting for response to line ${lineNum}: ${lineContent}`;
    console.error(timeoutMessage);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(timeoutMessage);
    }
    
    // Reset the timeout and waiting status
    this.responseTimeout = null;
    this.waitingForResponse = false;
    
    // Try to retry the command before giving up
    if (!this.retryCount) this.retryCount = 0;
    
    if (this.retryCount < 10) {
      this.retryCount++;
      this.log(`Retrying line ${lineNum} (attempt ${this.retryCount}/10)`);
      
      // Try sending a status query to see if the machine is responsive
      try {
        this.serialService.send('?').catch(() => {});
      } catch (e) {
        console.error("Failed to send status query:", e);
      }
      
      // Retry sending the same line after a short delay
      setTimeout(() => {
        if (this.isSending && !this.isPaused) {
          this.sendNextLine(); // This will resend the current line since we didn't increment currentLineIndex
        }
      }, 1000);
      
      return;
    }
    
    // Reset retry count
    this.retryCount = 0;
    
    // Pause sending due to timeout after retries
    this.pause("Response timeout after 10 retries");
  }
  
  /**
   * Called when all sending is complete
   */
  onSendingComplete() {
    this.log("G-code sending complete");
    
    this.isSending = false;
    this.waitingForResponse = false;
    
    // Clean up
    document.removeEventListener('serialdata', this.lineResponseHandler);
    
    // Cancel any timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    if (this.callbacks.onComplete) {
      this.callbacks.onComplete({
        sent: this.currentLineIndex,
        acknowledged: this.currentLineIndex,
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
    
    return true;
  }
  
  /**
   * Resume sending
   */
  resume() {
    if (!this.isSending || !this.isPaused) return false;
    
    this.isPaused = false;
    
    if (this.callbacks.onResume) {
      this.callbacks.onResume();
    }
    
    // Continue sending
    this.sendNextLine();
    
    return true;
  }
  
  /**
   * Stop sending
   */
  stop() {
    if (!this.isSending) return false;
    
    this.isSending = false;
    this.isPaused = false;
    
    // Clean up
    document.removeEventListener('serialdata', this.lineResponseHandler);
    
    // Cancel any timeout
    if (this.responseTimeout) {
      clearTimeout(this.responseTimeout);
      this.responseTimeout = null;
    }
    
    console.log("G-code sending stopped");
    
    return true;
  }
  
  /**
   * Get the current status
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
      waitingForResponse: this.waitingForResponse,
      linesSent: this.currentLineIndex,
      linesAcknowledged: this.currentLineIndex,
      totalLines: this.lines.length,
      progress: progress,
      currentLine: this.currentLineIndex < this.lines.length ? this.lines[this.currentLineIndex] : null
    };
  }
}

// Export the class
export default SimpleGCodeSender;