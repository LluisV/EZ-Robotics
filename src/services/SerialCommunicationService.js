class SerialCommunicationService {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readingTask = null;
    this.isConnected = false;
    this.baudRate = 115200;
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.listeners = [];
    this.connectionPromise = null;
    this.buffer = '';
    
    // Fixed-length queue for commands
    this.commandQueue = [];
    this.processingCommand = false;
    
    // Bind methods
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
  startPositionPolling(interval = 1000) {
    if (this.positionPollingInterval) {
      clearInterval(this.positionPollingInterval);
    }
    
    this.positionPollingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('?').catch(err => {
          console.warn('Failed to send position query:', err);
        });
      }
    }, interval);
  }
  
  /**
   * Stop polling for position updates
   */
  stopPositionPolling() {
    if (this.positionPollingInterval) {
      clearInterval(this.positionPollingInterval);
      this.positionPollingInterval = null;
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
        
        // Request a port from the user
        this.port = await navigator.serial.requestPort();
        this.baudRate = baudRate;
        
        // Open the port
        await this.port.open({
          baudRate: parseInt(baudRate, 10),
          dataBits: 8,
          stopBits: 1,
          parity: "none",
          flowControl: "none"
        });
        
        this.isConnected = true;
        
        // Start reading from the port
        this.startReading();
                
        // Start position polling
        this.startPositionPolling(100);

        // Notify listeners
        this.notifyListeners('connect', { port: this.port.getInfo() });
       
        // Send initial query to FluidNC
        await this.send("$#"); // Request parameters
        
        resolve(true);
      } catch (error) {
        console.error("Serial connection error:", error);
        this.notifyListeners('error', { error });
        this.isConnected = false;
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
      this.port = null;
      this.readingTask = null;
      this.commandQueue = [];
      this.processingCommand = false;

      this.stopPositionPolling();
      
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
   * Send data to the serial port
   * @param {string} data - The string data to send
   * @returns {Promise<boolean>} Success status
   */
  async send(data) {
    if (!this.port || !this.isConnected) {
      return false;
    }
    
    // Add newline if not already present
    if (!data.endsWith('\n')) {
      data += '\n';
    }
    
    return new Promise((resolve) => {
      // Add to queue
      this.commandQueue.push({
        data,
        resolve,
      });
      
      // Start processing if not already processing
      if (!this.processingCommand) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the command queue
   */
  async processQueue() {
    if (this.commandQueue.length === 0) {
      this.processingCommand = false;
      return;
    }
    
    this.processingCommand = true;
    const command = this.commandQueue.shift();
    
    try {
      if (!this.port || !this.isConnected) {
        command.resolve(false);
        this.processingCommand = false;
        return;
      }
      
      const writer = this.port.writable.getWriter();
      
      try {
        await writer.write(this.encoder.encode(command.data));
        
        // Notify command sent
        this.notifyListeners('send', { data: command.data });
        
        command.resolve(true);
      } finally {
        // Always release the writer lock
        writer.releaseLock();
      }
      
      // Process next command after a small delay
      // This delay helps with timing issues on some controllers
      setTimeout(() => {
        this.processQueue();
      }, 50);
      
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
   * Start reading data from the port
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
          
          // Decode the received data
          const text = this.decoder.decode(value);
          this.buffer += text;
          
          // Process complete lines
          const lines = this.buffer.split('\n');
          // Keep the last incomplete line in the buffer
          this.buffer = lines.pop() || '';
          
          // Process each complete line
          for (const line of lines) {
            if (line.trim()) {
              // Determine if this is a status/telemetry message
              const isStatusMessage = line.trim().startsWith('<') && line.includes('|MPos:');
              
              // Notify listeners with type information
              this.notifyListeners('data', { 
                data: line.trim(),
                isStatusMessage  // Add this flag
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
   * Flush any pending commands
   * @returns {Promise<boolean>} Success status
   */
  async flush() {
    // Clear command queue
    this.commandQueue = [];
    
    if (!this.isConnected) {
      return true;
    }
    
    try {
      // Send a soft reset to clear the device buffer
      // CTRL+X (ASCII 24)
      await this.send('\x18');
      return true;
    } catch (error) {
      console.error("Error flushing output:", error);
      return false;
    }
  }
}

// Create singleton instance
const serialService = new SerialCommunicationService();

// Register global access
window.serialService = serialService;

export default serialService;