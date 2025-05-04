/**
 * Enhanced Serial Communication Service for FluidNC/GRBL machines
 * This implementation prioritizes reliability and proper line handling
 */
class SerialCommunicationService {
  constructor() {
    // Serial port references
    this.port = null;
    this.reader = null;
    this.readingTask = null;
    
    // Status tracking
    this.isConnected = false;
    this.baudRate = 115200;
    this.buffer = '';
    this.lastReceivedTime = 0;
    
    // Text encoding/decoding
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    
    // Event listeners
    this.listeners = [];
    
    // Connection management
    this.connectionPromise = null;
    this.reconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 3;
    this.isReconnecting = false;
    
    // Status polling
    this.positionPollingInterval = null;
    this.watchdogInterval = null;
    this.connectionTimeout = null;
    
    // Command queue for proper sequencing
    this.commandQueue = [];
    this.processingCommand = false;
    this.lastCommandTime = 0;
    this.MIN_COMMAND_INTERVAL = 50; // ms between commands for reliable transmission
    
    // Bind methods to maintain context
    this.connect = this.connect.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.send = this.send.bind(this);
    this.startReading = this.startReading.bind(this);
    this.processQueue = this.processQueue.bind(this);
  }

  /**
   * Check if WebSerial API is supported
   * @returns {boolean} Whether WebSerial is supported
   */
  isSupported() {
    return navigator && navigator.serial;
  }

  /**
   * Start polling for position updates
   * @param {number} interval - Polling interval in milliseconds
   */
  startPositionPolling(interval = 250) {
    this.stopPositionPolling();
    
    this.positionPollingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('?').catch(err => {
          console.warn('Failed to send position query:', err);
        });
      }
    }, interval);
    
    // Start watchdog to detect connection issues
    this.startWatchdog();
  }
  
  /**
   * Stop polling for position updates
   */
  stopPositionPolling() {
    if (this.positionPollingInterval) {
      clearInterval(this.positionPollingInterval);
      this.positionPollingInterval = null;
    }
    
    this.stopWatchdog();
  }
  
  /**
   * Start watchdog timer to detect connection issues
   */
  startWatchdog() {
    this.stopWatchdog();
    
    this.watchdogInterval = setInterval(() => {
      if (!this.isConnected) return;
      
      const now = Date.now();
      // If we haven't received data in 3 seconds while connected, attempt recovery
      if (this.lastReceivedTime > 0 && now - this.lastReceivedTime > 3000) {
        console.warn("Connection watchdog triggered - no data received for 3 seconds");
        this.attemptRecovery();
      }
    }, 1000);
  }
  
  /**
   * Stop watchdog timer
   */
  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }
  
  /**
   * Attempt to recover from a stalled connection
   */
  async attemptRecovery() {
    if (this.isReconnecting) return;
    
    console.log("Attempting connection recovery...");
    this.isReconnecting = true;
    
    try {
      // First try sending a status query to see if connection is still alive
      await this.send('?');
      
      // Set a timeout to check if we get a response
      this.connectionTimeout = setTimeout(async () => {
        console.warn("No response to recovery attempt, trying soft reset");
        try {
          // Try a soft reset
          await this.send('\x18');
          
          // Set another timeout to check if reset helped
          this.connectionTimeout = setTimeout(async () => {
            console.error("Recovery failed, attempting reconnection");
            
            // Last resort - disconnect and reconnect
            if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
              this.reconnectAttempts++;
              
              const portInfo = this.port ? this.port.getInfo() : null;
              await this.disconnect();
              
              // Wait a moment before reconnecting
              setTimeout(async () => {
                if (portInfo) {
                  try {
                    // Try to reconnect to the same port
                    this.port = await navigator.serial.getPorts()
                      .then(ports => ports.find(p => 
                        p.getInfo().usbProductId === portInfo.usbProductId &&
                        p.getInfo().usbVendorId === portInfo.usbVendorId
                      ));
                      
                    if (this.port) {
                      await this.connect(this.baudRate);
                    }
                  } catch (e) {
                    console.error("Automatic reconnection failed:", e);
                    this.notifyListeners('error', { 
                      error: e, 
                      message: "Automatic reconnection failed" 
                    });
                  }
                }
                
                this.isReconnecting = false;
              }, 1000);
            } else {
              console.error("Maximum reconnection attempts reached");
              this.notifyListeners('error', { 
                message: "Maximum reconnection attempts reached. Please reconnect manually." 
              });
              this.isReconnecting = false;
            }
          }, 2000);
        } catch (e) {
          console.error("Recovery attempt failed:", e);
          this.isReconnecting = false;
        }
      }, 1000);
    } catch (e) {
      console.error("Initial recovery attempt failed:", e);
      this.isReconnecting = false;
    }
  }

  /**
   * Connect to a serial port
   * @param {number} baudRate - Baud rate to use
   * @returns {Promise<boolean>} Success status
   */
  async connect(baudRate = 115200) {
    // If already connecting, return the existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }
    
    // Create a new connection promise
    this.connectionPromise = new Promise(async (resolve) => {
      try {
        if (!this.isSupported()) {
          throw new Error("WebSerial API not supported in this browser. Use Chrome or Edge.");
        }
        
        // If already connected, disconnect first
        if (this.isConnected) {
          await this.disconnect();
        }
        
        // Reset reconnect counter
        this.reconnectAttempts = 0;
        
        // Request a port from the user if we don't have one
        if (!this.port) {
          this.port = await navigator.serial.requestPort();
        }
        
        this.baudRate = baudRate;
        
        // Open the port with explicit settings for better compatibility
        await this.port.open({
          baudRate: parseInt(baudRate, 10),
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none",
          bufferSize: 4096  // Larger buffer for reliability
        });
        
        this.isConnected = true;
        this.lastReceivedTime = Date.now();
        
        // Start reading from the port
        this.startReading();
        
        // Start position polling with a more responsive rate
        //this.startPositionPolling(250);

        // Notify listeners
        this.notifyListeners('connect', { port: this.port.getInfo() });
       
        // Wait for controller to initialize
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reset the controller for a clean state
        await this.send('\x18'); // Soft reset (Ctrl+X)
        
        // Wait for reset to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Send initial queries to FluidNC
        await this.send("$I"); // Request system information
        await this.send("$#"); // Request parameters
        await this.send("$Report/Interval=100"); // Set status report interval to 50ms
        await this.send("$/use_line_numbers=true"); 

        resolve(true);
      } catch (error) {
        console.error("Serial connection error:", error);
        this.notifyListeners('error', { error });
        this.isConnected = false;
        
        // Make sure port is properly closed
        if (this.port) {
          try {
            await this.port.close();
          } catch (e) {
            console.warn("Error closing port after failed connection:", e);
          }
        }
        
        resolve(false);
      } finally {
        this.connectionPromise = null;
      }
    });
    
    return this.connectionPromise;
  }

  /**
   * Disconnect from the serial port
   * @returns {Promise<boolean>} Success status
   */
  async disconnect() {
    if (!this.port || !this.isConnected) {
      return true;
    }
    
    // Stop polling and watchdog
    this.stopPositionPolling();
    this.stopWatchdog();
    
    // Clear any timeouts
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    try {
      // Cancel the reading task if exists
      if (this.readingTask) {
        this.readingTask.abort();
      }
      
      // Close the reader if exists
      if (this.reader) {
        try {
          await this.reader.cancel();
          this.reader.releaseLock();
          this.reader = null;
        } catch (error) {
          console.warn("Error releasing reader lock:", error);
        }
      }
      
      // Close the port
      await this.port.close();
      
      this.isConnected = false;
      this.commandQueue = [];
      this.processingCommand = false;
      
      // Notify listeners
      this.notifyListeners('disconnect', {});
      
      return true;
    } catch (error) {
      console.error("Error disconnecting from serial port:", error);
      this.notifyListeners('error', { error });
      
      // Force reset the state
      this.isConnected = false;
      this.port = null;
      this.reader = null;
      this.readingTask = null;
      this.processingCommand = false;
      
      return false;
    }
  }

  /**
   * Send data to the serial port with improved reliability
   * @param {string} data - The string data to send
   * @returns {Promise<boolean>} Success status
   */
  async send(data) {
    if (!this.port || !this.isConnected) {
      return false;
    }
    
    // Add newline if not already present and not a soft reset
    if (data !== '\x18' && !data.endsWith('\n')) {
      data += '\n';
    }
    
    return new Promise((resolve) => {
      // Add to queue
      this.commandQueue.push({
        data,
        resolve,
        timestamp: Date.now()
      });
      
      // Start processing if not already processing
      if (!this.processingCommand) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the command queue with improved timing for reliability
   */
  async processQueue() {
    if (this.commandQueue.length === 0) {
      this.processingCommand = false;
      return;
    }
    
    this.processingCommand = true;
    
    // Check if we need to wait to maintain minimum command interval
    const now = Date.now();
    const timeSinceLastCommand = now - this.lastCommandTime;
    
    if (timeSinceLastCommand < this.MIN_COMMAND_INTERVAL) {
      // Wait until minimum interval has passed
      await new Promise(resolve => 
        setTimeout(resolve, this.MIN_COMMAND_INTERVAL - timeSinceLastCommand)
      );
    }
    
    const command = this.commandQueue.shift();
    
    try {
      if (!this.port || !this.isConnected) {
        command.resolve(false);
        this.processingCommand = false;
        return;
      }
      
      // Get writer and ensure it's released after
      const writer = this.port.writable.getWriter();
      
      try {
        // Convert to bytes
        const dataToSend = command.data === '\x18' ? 
          new Uint8Array([24]) : // Ctrl+X (ASCII 24)
          this.encoder.encode(command.data);
        
        // Write with explicit flush
        await writer.write(dataToSend);
        
        // Update last command time
        this.lastCommandTime = Date.now();
        
        // Notify command sent
        this.notifyListeners('send', { data: command.data });
        
        command.resolve(true);
      } finally {
        // Always release the writer lock
        writer.releaseLock();
      }
      
      // Process next command after a controlled interval
      // This helps maintain reliable timing with FluidNC/GRBL
      setTimeout(() => {
        this.processQueue();
      }, this.MIN_COMMAND_INTERVAL);
      
    } catch (error) {
      console.error("Error sending data:", error);
      this.notifyListeners('error', { error });
      command.resolve(false);
      
      // Continue processing after a delay
      setTimeout(() => {
        this.processingCommand = false;
        this.processQueue();
      }, 500);
    }
  }

  /**
   * Start reading data from the port with improved error handling
   */
  startReading() {
    if (!this.port || !this.isConnected) {
      return;
    }
    
    // Setup abort controller for cancellation
    const abortController = new AbortController();
    this.readingTask = abortController;
    
    // Start reading loop
    const readLoop = async () => {
      try {
        // Get reader
        this.reader = this.port.readable.getReader();
        this.buffer = '';
        
        while (true) {
          const { value, done } = await this.reader.read();
          
          if (done) {
            break;
          }
          
          // Update last received time for watchdog
          this.lastReceivedTime = Date.now();
          
          // Decode the received data
          const text = this.decoder.decode(value);
          this.buffer += text;
          
          // Process complete lines
          const lines = this.buffer.split('\n');
          // Keep the last incomplete line in the buffer
          this.buffer = lines.pop() || '';
          
          // Process each complete line
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine) {
              // Determine if this is a status/telemetry message
              const isStatusMessage = trimmedLine.startsWith('<') && trimmedLine.includes('|MPos:');
              
              // Notify listeners with type information
              this.notifyListeners('data', { 
                data: trimmedLine,
                isStatusMessage
              });
            }
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log("Serial reading aborted");
        } else {
          console.error("Error reading from serial port:", error);
          this.notifyListeners('error', { error });
          
          // If disconnected unexpectedly, update state
          if (this.isConnected) {
            this.isConnected = false;
            this.notifyListeners('disconnect', { unexpected: true });
          }
        }
      } finally {
        // Release the lock
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch (error) {
            console.warn("Error releasing reader lock:", error);
          }
          this.reader = null;
        }
      }
    };
    
    // Execute the reading loop
    readLoop();
  }

  /**
   * Add a listener for serial events
   * @param {Function} callback - Callback function for events
   * @returns {Function} Function to remove listener
   */
  addListener(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    
    this.listeners.push(callback);
    
    // Return function to remove this listener
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {Object} data - Event data
   */
  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error("Error in serial event listener:", error);
      }
    }
    
    // Also dispatch standard events for compatibility
    document.dispatchEvent(new CustomEvent('serialdata', { 
      detail: event === 'data' ? data : null 
    }));
    
    document.dispatchEvent(new CustomEvent('serialconnection', { 
      detail: event === 'connect' ? { connected: true, port: data.port } : 
              event === 'disconnect' ? { connected: false } : null 
    }));
    
    if (event === 'error') {
      document.dispatchEvent(new CustomEvent('serialerror', { 
        detail: data 
      }));
    }
  }

  /**
   * Get the connection status
   * @returns {boolean} Whether connected to a serial port
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get information about the connected port
   * @returns {Object|null} Port information or null if not connected
   */
  getPortInfo() {
    return this.isConnected && this.port ? this.port.getInfo() : null;
  }
  
  /**
   * Flush any pending commands and reset the controller
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    // Clear command queue
    this.commandQueue = [];
    
    if (!this.isConnected) {
      return true;
    }
    
    try {
      // Pause briefly to ensure any in-progress commands complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send a soft reset to clear the device buffer
      // CTRL+X (ASCII 24)
      await this.send('\x18');
      
      // Wait for reset to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error("Error flushing output:", error);
      return false;
    }
  }
  
  /**
   * Send a query to check machine status
   * @returns {Promise<boolean>} Success status
   */
  async queryStatus() {
    if (!this.isConnected) {
      return false;
    }
    
    try {
      return await this.send('?');
    } catch (error) {
      console.error("Error querying status:", error);
      return false;
    }
  }
  
  /**
   * Send a command to unlock the machine
   * @returns {Promise<boolean>} Success status
   */
  async unlockMachine() {
    if (!this.isConnected) {
      return false;
    }
    
    try {
      return await this.send('$X');
    } catch (error) {
      console.error("Error unlocking machine:", error);
      return false;
    }
  }
  
  /**
   * Send a feed hold command (pause)
   * @returns {Promise<boolean>} Success status
   */
  async feedHold() {
    if (!this.isConnected) {
      return false;
    }
    
    try {
      // Send '!' character (feed hold)
      const writer = this.port.writable.getWriter();
      await writer.write(new Uint8Array([33]));
      writer.releaseLock();
      
      return true;
    } catch (error) {
      console.error("Error sending feed hold:", error);
      return false;
    }
  }
  
  /**
   * Send a resume command
   * @returns {Promise<boolean>} Success status
   */
  async resumeFromHold() {
    if (!this.isConnected) {
      return false;
    }
    
    try {
      // Send '~' character (cycle start/resume)
      const writer = this.port.writable.getWriter();
      await writer.write(new Uint8Array([126]));
      writer.releaseLock();
      
      return true;
    } catch (error) {
      console.error("Error sending resume:", error);
      return false;
    }
  }
}

// Create singleton instance
const serialService = new SerialCommunicationService();

// Register global access for easy debugging and scripting
window.serialService = serialService;

// For backwards compatibility
window.sendSerialData = async (data) => {
  if (!serialService.isConnected) {
    return false;
  }
  return serialService.send(data);
};

export default serialService;