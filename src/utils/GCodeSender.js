/**
 * Professional G-Code Sender with advanced buffer management
 * Based on techniques used in UGS, bCNC, and other professional senders
 */
class GCodeSender {
    constructor() {
      // Queue to store lines to be sent
      this.queue = [];
      
      // Tracking variables
      this.isSending = false;
      this.isPaused = false;
      this.linesSent = 0;
      this.linesAcknowledged = 0;
      this.totalLines = 0;
      
      // Response handler reference
      this.responseHandler = null;
      
      // Callbacks for status updates
      this.callbacks = {
        onProgress: null,
        onComplete: null,
        onError: null,
        onLineSuccess: null,
        onPause: null,
        onResume: null
      };
      
      // Advanced buffer management
      this.serialBuffer = {
        size: 128,           // Default GRBL buffer size is 128 bytes
        used: 0,             // Current bytes in buffer
        maxCommands: 5,      // Maximum number of unacknowledged commands
        activeCommands: 0,   // Current unacknowledged commands
        lastResponseTime: 0, // Time of last response
        avgResponseTime: 500 // Moving average of response times (ms)
      };
      
      // Timeout management
      this.timeoutTimers = [];
      this.COMMAND_TIMEOUT = 20000;  // 20 seconds - much longer for slow operations
      this.MAX_COMMAND_RETRIES = 3;  // Max retries for a failed command
      this.commandRetries = 0;
      
      // Status polling
      this.statusPollingInterval = null;
      this.STATUS_POLLING_RATE = 1000; // ms
    }
    
    /**
     * Load G-code from a string
     * @param {string} gcode - The G-code to load
     */
    loadGCode(gcode) {
      // Reset state
      this.queue = [];
      this.linesSent = 0;
      this.linesAcknowledged = 0;
      this.serialBuffer.used = 0;
      this.serialBuffer.activeCommands = 0;
      this.commandRetries = 0;
      
      // Split G-code into lines and clean them
      const lines = gcode.split('\n');
      
      // Process each line
      this.queue = lines
        .map(line => {
          // Remove comments and trim whitespace
          const commentIndex = line.indexOf(';');
          return (commentIndex >= 0 ? line.substring(0, commentIndex) : line).trim();
        })
        .filter(line => line); // Remove empty lines
        
      this.totalLines = this.queue.length;
      
      // Log info about loaded file
      console.log(`Loaded ${this.totalLines} lines of G-code`);
      
      return this.totalLines;
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
     * @returns {Promise} A promise that resolves when sending is complete
     */
    async start(serialService) {
      if (this.isSending) {
        console.warn("Already sending G-code");
        return false;
      }
      
      if (!serialService || typeof serialService.send !== 'function') {
        console.error("Invalid serial service provided");
        
        if (this.callbacks.onError) {
          this.callbacks.onError("Invalid serial service");
        }
        
        return false;
      }
      
      if (this.queue.length === 0) {
        console.warn("No G-code loaded");
        
        if (this.callbacks.onError) {
          this.callbacks.onError("No G-code loaded");
        }
        
        return false;
      }
      
      // Setup
      this.isSending = true;
      this.isPaused = false;
      this.serialService = serialService;
      
      // Reset counters and buffer tracking
      this.linesSent = 0;
      this.linesAcknowledged = 0;
      this.serialBuffer.used = 0;
      this.serialBuffer.activeCommands = 0;
      this.commandRetries = 0;
      
      // Cancel any existing timeout timers
      this.timeoutTimers.forEach(timer => clearTimeout(timer));
      this.timeoutTimers = [];
      
      // Setup response handler
      this.setupResponseHandler();
      
      // Start status polling
      this.startStatusPolling();
      
      // Start sending
      await this.fillBuffer();
      
      return true;
    }
    
    /**
     * Start polling for status to keep the connection alive
     */
    startStatusPolling() {
      if (this.statusPollingInterval) {
        clearInterval(this.statusPollingInterval);
      }
      
      this.statusPollingInterval = setInterval(() => {
        if (this.isSending && this.serialService) {
          this.serialService.send('?').catch(err => {
            console.warn('Error sending status request:', err);
          });
        }
      }, this.STATUS_POLLING_RATE);
    }
    
    /**
     * Stop status polling
     */
    stopStatusPolling() {
      if (this.statusPollingInterval) {
        clearInterval(this.statusPollingInterval);
        this.statusPollingInterval = null;
      }
    }
    
    /**
     * Setup the response handler for the serial communication
     */
    setupResponseHandler() {
      // Cleanup existing handler if any
      if (this.responseHandler) {
        document.removeEventListener('serialdata', this.responseHandler);
      }
      
      // Create new handler
      this.responseHandler = (event) => {
        const data = event.detail;
        
        if (!data || !data.data) return;
        
        const response = data.data.trim();
        const now = Date.now();
        
        // Calculate response time for adaptive timing
        if (this.serialBuffer.lastResponseTime > 0) {
          const responseTime = now - this.serialBuffer.lastResponseTime;
          
          // Update moving average (80% old value, 20% new value)
          this.serialBuffer.avgResponseTime = 
            (this.serialBuffer.avgResponseTime * 0.8) + (responseTime * 0.2);
        }
        
        this.serialBuffer.lastResponseTime = now;
        
        // Cancel any timeout timers for this response
        if (this.timeoutTimers.length > 0) {
          clearTimeout(this.timeoutTimers[0]);
          this.timeoutTimers.shift();
        }
        
        // Parse response
        if (response === 'ok') {
          // Line was processed successfully
          this.linesAcknowledged++;
          this.serialBuffer.activeCommands--;
          
          // Reduce the buffer usage (approximate size of command + CRLF)
          const approximateCommandSize = this.getApproximateCommandSize(
            this.queue[this.linesAcknowledged - 1] || ''
          );
          
          this.serialBuffer.used = Math.max(0, this.serialBuffer.used - approximateCommandSize);
          
          if (this.callbacks.onLineSuccess) {
            this.callbacks.onLineSuccess(this.linesAcknowledged);
          }
          
          if (this.callbacks.onProgress) {
            this.callbacks.onProgress({
              sent: this.linesSent,
              acknowledged: this.linesAcknowledged,
              total: this.totalLines,
              progress: (this.linesAcknowledged / this.totalLines) * 100
            });
          }
          
          // Reset retry counter after successful command
          this.commandRetries = 0;
          
          // Continue sending if not paused
          if (!this.isPaused) {
            this.fillBuffer();
          }
        } 
        else if (response.startsWith('error:')) {
          // Error occurred
          const errorCode = parseInt(response.substring(6)) || 0;
          const errorMessage = `Error: ${response.substring(6)}`;
          console.error(errorMessage);
          
          this.serialBuffer.activeCommands--;
          
          // Handle different error types
          if ([8, 9, 10, 11].includes(errorCode)) {
            // These are fatal errors, pause the sending
            this.isPaused = true;
            
            if (this.callbacks.onPause) {
              this.callbacks.onPause(`Fatal error: ${errorMessage}`);
            }
            
            if (this.callbacks.onError) {
              this.callbacks.onError(errorMessage);
            }
          } else {
            // Non-fatal errors, we can continue
            // Reduce the buffer usage (approximate size of command + CRLF)
            const approximateCommandSize = this.getApproximateCommandSize(
              this.queue[this.linesAcknowledged] || ''
            );
            
            this.serialBuffer.used = Math.max(0, this.serialBuffer.used - approximateCommandSize);
            
            // Increment acknowledged lines to move past the error
            this.linesAcknowledged++;
            
            if (this.callbacks.onError) {
              this.callbacks.onError(errorMessage);
            }
            
            // Continue sending if not paused
            if (!this.isPaused) {
              this.fillBuffer();
            }
          }
        }
        // Handle other responses (like status reports)
        else if (response.startsWith('<')) {
          // Status report - we don't wait for these
          this.parseStatusResponse(response);
        }
        else if (response.startsWith('ALARM:')) {
          // Alarm state - this is serious 
          const alarmMessage = `Machine alarm: ${response}`;
          console.error(alarmMessage);
          
          this.isPaused = true;
          
          if (this.callbacks.onError) {
            this.callbacks.onError(alarmMessage);
          }
          
          if (this.callbacks.onPause) {
            this.callbacks.onPause("Alarm triggered");
          }
        }
      };
      
      // Register the handler
      document.addEventListener('serialdata', this.responseHandler);
    }
    
    /**
     * Parse status response from GRBL
     * @param {string} response - The status response
     */
    parseStatusResponse(response) {
      // Example implementation - could be expanded for more detailed status tracking
      try {
        // Extract machine state
        const stateMatch = response.match(/<([^|]+)\|/);
        if (stateMatch) {
          const state = stateMatch[1].trim();
          
          // Handle different states
          if (state === 'Alarm') {
            this.isPaused = true;
            
            if (this.callbacks.onPause) {
              this.callbacks.onPause("Machine is in ALARM state");
            }
          }
        }
      } catch (error) {
        console.warn("Error parsing status response:", error);
      }
    }
    
    /**
     * Fill the buffer with commands up to the limit
     */
    async fillBuffer() {
      // Check if we're done sending
      if (this.linesSent >= this.totalLines) {
        if (this.linesAcknowledged >= this.totalLines) {
          this.onSendingComplete();
        }
        return;
      }
      
      // Check if we're paused
      if (this.isPaused) {
        return;
      }
      
      // Calculate how many commands we can send
      const availableBufferSize = this.serialBuffer.size - this.serialBuffer.used;
      
      // Send commands until buffer is full or we hit the activeCommands limit
      while (
        this.linesSent < this.totalLines && 
        this.serialBuffer.activeCommands < this.serialBuffer.maxCommands
      ) {
        const line = this.queue[this.linesSent];
        
        // Skip empty lines
        if (!line) {
          this.linesSent++;
          continue;
        }
        
        // Calculate approximate size of this command
        const commandSize = this.getApproximateCommandSize(line);
        
        // Check if it will fit in the buffer
        if (commandSize > availableBufferSize && this.serialBuffer.activeCommands > 0) {
          // Buffer would overflow, wait for more acknowledgments
          break;
        }
        
        // Send the line
        await this.sendLine(line);
        
        // Update tracking
        this.linesSent++;
        this.serialBuffer.activeCommands++;
        this.serialBuffer.used += commandSize;
      }
    }
    
    /**
     * Send a single line of G-code
     * @param {string} line - The line to send
     */
    async sendLine(line) {
      try {
        // Send the line
        await this.serialService.send(line);
        
        // Set timeout for acknowledgment
        const timeoutDuration = Math.max(
          this.COMMAND_TIMEOUT,
          this.serialBuffer.avgResponseTime * 10 // At least 10x the average response time
        );
        
        const timeoutTimer = setTimeout(() => {
          this.handleTimeout();
        }, timeoutDuration);
        
        this.timeoutTimers.push(timeoutTimer);
        
      } catch (error) {
        console.error(`Error sending line: ${error.message}`);
        
        if (this.callbacks.onError) {
          this.callbacks.onError(`Error sending line: ${error.message}`);
        }
        
        // Retry logic
        if (this.commandRetries < this.MAX_COMMAND_RETRIES) {
          this.commandRetries++;
          
          // Wait a moment before retrying
          setTimeout(() => {
            this.linesSent--; // Back up one line to retry
            this.serialBuffer.activeCommands--; // Don't count this as an active command
            this.fillBuffer(); // Try again
          }, 1000);
        } else {
          // Too many retries, pause sending
          this.isPaused = true;
          
          if (this.callbacks.onPause) {
            this.callbacks.onPause(`Too many retries (${this.MAX_COMMAND_RETRIES})`);
          }
        }
      }
    }
    
    /**
     * Calculate the approximate size of a command in the serial buffer
     * @param {string} command - The command to measure
     * @returns {number} The approximate size in bytes
     */
    getApproximateCommandSize(command) {
      // Each character is 1 byte, plus 2 bytes for CRLF
      return command.length + 2;
    }
    
    /**
     * Handle timeout when no response is received
     */
    handleTimeout() {
      console.warn("Command timeout - no response received");
      
      if (this.callbacks.onError) {
        this.callbacks.onError("Command timeout - no response received");
      }
      
      // Try sending a status query to see if the machine is responsive
      this.serialService.send('?').catch(() => {});
      
      // Retry logic
      if (this.commandRetries < this.MAX_COMMAND_RETRIES) {
        this.commandRetries++;
        
        // Reduce active commands and try again
        this.serialBuffer.activeCommands = Math.max(0, this.serialBuffer.activeCommands - 1);
        
        if (!this.isPaused) {
          this.fillBuffer();
        }
      } else {
        // Too many retries, pause sending
        this.isPaused = true;
        
        if (this.callbacks.onPause) {
          this.callbacks.onPause(`Command timeout after ${this.MAX_COMMAND_RETRIES} retries`);
        }
      }
    }
    
    /**
     * Called when all sending is complete
     */
    onSendingComplete() {
      this.isSending = false;
      
      // Clean up
      if (this.responseHandler) {
        document.removeEventListener('serialdata', this.responseHandler);
        this.responseHandler = null;
      }
      
      // Cancel all timeout timers
      this.timeoutTimers.forEach(timer => clearTimeout(timer));
      this.timeoutTimers = [];
      
      // Stop status polling
      this.stopStatusPolling();
      
      console.log("G-code sending complete");
      
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete({
          sent: this.linesSent,
          acknowledged: this.linesAcknowledged,
          total: this.totalLines
        });
      }
    }
    
    /**
     * Reset the serial buffer state
     */
    resetBufferState() {
      this.serialBuffer.used = 0;
      this.serialBuffer.activeCommands = 0;
      
      // Cancel all timeout timers
      this.timeoutTimers.forEach(timer => clearTimeout(timer));
      this.timeoutTimers = [];
    }
    
    /**
     * Pause sending
     */
    pause() {
      if (!this.isSending || this.isPaused) return false;
      
      this.isPaused = true;
      
      if (this.callbacks.onPause) {
        this.callbacks.onPause();
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
      this.fillBuffer();
      
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
      if (this.responseHandler) {
        document.removeEventListener('serialdata', this.responseHandler);
        this.responseHandler = null;
      }
      
      // Cancel all timeout timers
      this.timeoutTimers.forEach(timer => clearTimeout(timer));
      this.timeoutTimers = [];
      
      // Stop status polling
      this.stopStatusPolling();
      
      console.log("G-code sending stopped");
      
      return true;
    }
    
    /**
     * Get the current status
     */
    getStatus() {
      return {
        isSending: this.isSending,
        isPaused: this.isPaused,
        linesSent: this.linesSent,
        linesAcknowledged: this.linesAcknowledged,
        totalLines: this.totalLines,
        progress: this.totalLines > 0 ? (this.linesAcknowledged / this.totalLines) * 100 : 0,
        bufferUsage: this.serialBuffer.used,
        bufferCapacity: this.serialBuffer.size,
        activeCommands: this.serialBuffer.activeCommands
      };
    }
    
    /**
     * Flush the controller's buffer
     * This sends a soft reset (Ctrl-X) to clear any pending commands
     */
    async flush() {
      if (!this.serialService) return false;
      
      try {
        // Send soft reset
        await this.serialService.send('\x18');
        
        // Reset our internal state
        this.resetBufferState();
        
        return true;
      } catch (error) {
        console.error("Error flushing controller buffer:", error);
        return false;
      }
    }
  }
  
  export default GCodeSender;