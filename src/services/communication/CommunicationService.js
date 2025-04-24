/**
 * src/services/communication/CommunicationService.js
 * Improved service for reliable file transfers with the robot
 */
import EventEmitter from 'events';
import SerialAdapter from './adapters/SerialAdapter';
import WebSocketAdapter from './adapters/WebSocketAdapter';
import { ConnectionStatus, ConnectionType } from './CommunicationTypes';

class CommunicationService extends EventEmitter {
  constructor() {
    super();
    
    // Initialize adapters
    this.serialAdapter = new SerialAdapter();
    this.webSocketAdapter = new WebSocketAdapter();
    
    // Current settings and state
    this.activeAdapter = null;
    this.connectionType = null;
    this.connectionStatus = ConnectionStatus.DISCONNECTED;
    this.availablePorts = [];
    this.selectedPort = null;
    this.baudRate = 115200; // Default baud rate
    
    // Queue for commands
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.isBusy = false;
    this.responseTimeout = 5000; // ms
    
    // File transfer state
    this.fileTransfer = {
      inProgress: false,
      fileName: null,
      fileContent: null,
      totalLines: 0,
      currentLine: 0,
      chunkSize: 64, // Send in smaller chunks for better reliability
      bytesTransferred: 0,
      bytesTotal: 0,
      error: null,
      lastAcknowledged: -1,
      retryCount: 0,
      maxRetries: 3,
      timeoutId: null
    };
    
    // Buffer for received data
    this.incomingBuffer = '';
    
    // Set up event listeners for adapters
    this._setupAdapterListeners();
  }
  
  /**
   * Get available serial ports
   * @returns {Promise<Array>} List of available ports
   */
  async getAvailablePorts() {
    try {
      this.availablePorts = await this.serialAdapter.listPorts();
      return this.availablePorts;
    } catch (error) {
      console.error('Error listing ports:', error);
      throw error;
    }
  }
  
  /**
   * Connect to robot
   * @param {Object} options Connection options
   * @param {ConnectionType} options.type Connection type (SERIAL or WEBSOCKET)
   * @param {string} options.port Port name (for serial) or URL (for WebSocket)
   * @param {number} options.baudRate Baud rate (for serial)
   * @returns {Promise<boolean>} Whether connection was successful
   */
  async connect(options) {
    // Disconnect if already connected
    if (this.connectionStatus === ConnectionStatus.CONNECTED) {
      await this.disconnect();
    }
    
    this.connectionType = options.type || ConnectionType.SERIAL;
    
    try {
      let connected = false;
      
      if (this.connectionType === ConnectionType.SERIAL) {
        this.activeAdapter = this.serialAdapter;
        this.selectedPort = options.port;
        this.baudRate = options.baudRate || this.baudRate;
        
        connected = await this.serialAdapter.connect({
          port: this.selectedPort,
          baudRate: this.baudRate
        });
      } else if (this.connectionType === ConnectionType.WEBSOCKET) {
        this.activeAdapter = this.webSocketAdapter;
        this.selectedPort = options.port; // URL in this case
        
        connected = await this.webSocketAdapter.connect({
          url: this.selectedPort
        });
      }
      
      if (connected) {
        this.connectionStatus = ConnectionStatus.CONNECTED;
        this.emit('connection', { 
          status: this.connectionStatus,
          type: this.connectionType,
          port: this.selectedPort
        });
        
        // Clear the buffer on new connection
        this.incomingBuffer = '';
        
        return true;
      } else {
        this.connectionStatus = ConnectionStatus.ERROR;
        this.emit('connection', { 
          status: this.connectionStatus,
          error: 'Failed to connect' 
        });
        return false;
      }
    } catch (error) {
      this.connectionStatus = ConnectionStatus.ERROR;
      this.emit('connection', { 
        status: this.connectionStatus,
        error: error.message 
      });
      console.error('Connection error:', error);
      return false;
    }
  }
  
  /**
   * Disconnect from robot
   * @returns {Promise<boolean>} Whether disconnection was successful
   */
  async disconnect() {
    if (!this.activeAdapter || this.connectionStatus === ConnectionStatus.DISCONNECTED) {
      return true;
    }
    
    // If file transfer is in progress, cancel it
    if (this.fileTransfer.inProgress) {
      this.cancelFileTransfer('Disconnected');
    }
    
    try {
      await this.activeAdapter.disconnect();
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
      this.activeAdapter = null;
      
      this.emit('connection', { 
        status: this.connectionStatus 
      });
      
      // Clear any pending commands
      this.commandQueue = [];
      this.isProcessingQueue = false;
      this.isBusy = false;
      
      return true;
    } catch (error) {
      console.error('Disconnection error:', error);
      return false;
    }
  }
  
  /**
   * Send a G-code command to the robot
   * @param {string} command G-code command to send
   * @param {Object} options Command options
   * @param {boolean} options.immediate Whether to send immediately or queue
   * @param {boolean} options.expectResponse Whether to wait for a response
   * @returns {Promise<string>} Command response (if expectResponse=true)
   */
  async sendCommand(command, options = {}) {
    const { immediate = false, expectResponse = true } = options;
    
    if (!this.activeAdapter || this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to robot');
    }
    
    // Normalize command (ensure it ends with newline)
    const normalizedCommand = command.trim() + '\n';
    
    // Log the command for debugging
    console.log(`Sending command: ${normalizedCommand.trim()}`);
    this.emit('command', { command: normalizedCommand.trim(), sent: true });
    
    // For immediate commands, send directly and don't queue
    if (immediate) {
      try {
        await this.activeAdapter.write(normalizedCommand);
        
        if (expectResponse) {
          return this._waitForResponse();
        }
        return '';
      } catch (error) {
        console.error('Error sending immediate command:', error);
        throw error;
      }
    }
    
    // For normal commands, add to queue
    return new Promise((resolve, reject) => {
      this.commandQueue.push({
        command: normalizedCommand,
        expectResponse,
        resolve,
        reject
      });
      
      // Start processing the queue if not already doing so
      if (!this.isProcessingQueue) {
        this._processCommandQueue();
      }
    });
  }
  
  /**
   * Send a file to the robot with reliable transfer protocol
   * @param {string} fileName Name to give the file on the robot
   * @param {string} fileContent Content of the file to send
   * @returns {Promise<void>}
   */
  async sendFile(fileName, fileContent) {
    if (!this.activeAdapter || this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to robot');
    }
    
    // If a file transfer is already in progress, cancel it
    if (this.fileTransfer.inProgress) {
      this.cancelFileTransfer('New transfer started');
    }
    
    try {
      // Normalize line endings and remove multiple blank lines
      const normalizedContent = fileContent.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
      const fileSize = normalizedContent.length;
      const lines = normalizedContent.split('\n');
      
      // Initialize file transfer state
      this.fileTransfer = {
        inProgress: true,
        fileName,
        fileContent: normalizedContent,
        lines,
        totalLines: lines.length,
        currentLine: 0,
        chunkSize: 64, // Number of lines to send in each chunk before waiting for acknowledgment
        bytesTransferred: 0,
        bytesTotal: fileSize,
        error: null,
        lastAcknowledged: -1,
        retryCount: 0,
        maxRetries: 3,
        timeoutId: null
      };
      
      this.emit('fileTransfer', { 
        status: 'started', 
        fileName, 
        totalLines: this.fileTransfer.totalLines,
        bytesTotal: fileSize 
      });
      
      // First, delete the file if it exists to ensure a clean state
      await this.sendCommand(`@DELETE ${fileName}`, { expectResponse: true });
      
      // Send the file receive command with size information
      const response = await this.sendCommand(`@RECEIVE ${fileName} ${fileSize}`, { expectResponse: true });
      
      // Check if the response indicates the receiver is ready
      if (!response.includes('Receiving file')) {
        throw new Error(`Failed to start file transfer: ${response}`);
      }
      
      // Start the reliable transfer process
      await this._startReliableFileTransfer();
      
      // Validate the transfer was successful
      if (this.fileTransfer.error) {
        throw new Error(`File transfer failed: ${this.fileTransfer.error}`);
      }
      
      this.emit('fileTransfer', { 
        status: 'completed', 
        fileName,
        bytesTransferred: this.fileTransfer.bytesTotal
      });
      
      return fileName;
    } catch (error) {
      this.fileTransfer.error = error.message;
      this.emit('fileTransfer', { 
        status: 'error', 
        error: error.message
      });
      console.error('File transfer error:', error);
      throw error;
    }
  }
  
  /**
   * Run a G-code file on the robot
   * @param {string} fileName Name of the file to run
   * @returns {Promise<string>} Response from the run command
   */
  async runFile(fileName) {
    try {
      // Make sure file name starts with /
      if (!fileName.startsWith('/')) {
        fileName = '/' + fileName;
      }
      
      // Send run command
      const response = await this.sendCommand(`@RUN ${fileName}`, { expectResponse: true });
      
      this.emit('fileRun', { 
        status: 'started', 
        fileName,
        response
      });
      
      return response;
    } catch (error) {
      this.emit('fileRun', { 
        status: 'error', 
        fileName,
        error: error.message
      });
      console.error('File run error:', error);
      throw error;
    }
  }
  
  /**
   * Upload and run a G-code file in one operation
   * @param {string} fileName Name to give the file
   * @param {string} fileContent Content of the G-code file
   * @returns {Promise<string>} Response from the run command
   */
  async uploadAndRunFile(fileName, fileContent) {
    try {
      // Upload the file
      await this.sendFile(fileName, fileContent);
      
      // Run the file
      return await this.runFile(fileName);
    } catch (error) {
      console.error('Upload and run error:', error);
      throw error;
    }
  }
  
  /**
   * Cancel an in-progress file transfer
   * @param {string} reason Reason for cancellation
   */
  cancelFileTransfer(reason = 'User cancelled') {
    if (!this.fileTransfer.inProgress) {
      return;
    }
    
    // Clear any pending timeout
    if (this.fileTransfer.timeoutId) {
      clearTimeout(this.fileTransfer.timeoutId);
    }
    
    // Try to send a cancellation signal to the device
    try {
      this.sendCommand(`@CANCEL`, { immediate: true, expectResponse: false });
    } catch (error) {
      console.error('Error sending cancel command:', error);
    }
    
    this.fileTransfer.inProgress = false;
    this.fileTransfer.error = reason;
    
    this.emit('fileTransfer', { 
      status: 'cancelled', 
      reason,
      fileName: this.fileTransfer.fileName,
      bytesTransferred: this.fileTransfer.bytesTransferred,
      bytesTotal: this.fileTransfer.bytesTotal
    });
  }
  
  /**
   * Send a special command (like STOP)
   * @param {string} commandType Type of special command
   * @returns {Promise<void>}
   */
  async sendSpecialCommand(commandType) {
    switch (commandType) {
      case 'STOP':
        // Send emergency stop command (M112)
        return this.sendCommand('M112', { immediate: true, expectResponse: false });
      
      case 'HOME':
        // Home all axes (G28)
        return this.sendCommand('G28', { expectResponse: true });
      
      case 'GET_POSITION':
        // Request current position
        return this.sendCommand('?POS', { immediate: true });
      
      case 'GET_STATUS':
        // Request machine status
        return this.sendCommand('?STATUS', { immediate: true });
      
      default:
        throw new Error(`Unknown special command: ${commandType}`);
    }
  }
  
  /**
   * Get current connection status
   * @returns {Object} Connection status information
   */
  getConnectionInfo() {
    return {
      status: this.connectionStatus,
      type: this.connectionType,
      port: this.selectedPort,
      baudRate: this.baudRate
    };
  }
  
  /**
   * Get file transfer status
   * @returns {Object} File transfer status information
   */
  getFileTransferStatus() {
    if (!this.fileTransfer.inProgress) {
      return { status: 'idle' };
    }
    
    return {
      status: 'active',
      fileName: this.fileTransfer.fileName,
      progress: Math.round((this.fileTransfer.bytesTransferred / this.fileTransfer.bytesTotal) * 100),
      bytesTransferred: this.fileTransfer.bytesTransferred,
      bytesTotal: this.fileTransfer.bytesTotal,
      currentLine: this.fileTransfer.currentLine,
      totalLines: this.fileTransfer.totalLines,
      error: this.fileTransfer.error
    };
  }
  
  /**
   * Request ports from the user
   * @returns {Promise<Array>} List of newly requested ports
   */
  async requestPorts() {
    try {
      // Attempt to request new ports from the user
      const requestedPort = await this.serialAdapter.requestPort();
      
      // Refresh the available ports list
      await this.getAvailablePorts();
      
      // Emit an event about the new port request
      this.emit('response', { 
        response: `Port request completed. New ports available.` 
      });
      
      return this.availablePorts;
    } catch (error) {
      const errorMsg = `Port request error: ${error.message}`;
      console.error(errorMsg);
      this.emit('error', { error: errorMsg });
      throw error;
    }
  }
  
  /**
   * Set up event listeners for adapters
   * @private
   */
  _setupAdapterListeners() {
    // Serial adapter events
    this.serialAdapter.on('data', (data) => this._handleIncomingData(data));
    this.serialAdapter.on('error', (error) => this._handleError(error));
    
    // WebSocket adapter events
    this.webSocketAdapter.on('data', (data) => this._handleIncomingData(data));
    this.webSocketAdapter.on('error', (error) => this._handleError(error));
  }
  
  /**
   * Handle incoming data from the robot
   * @param {string} data Received data
   * @private
   */
  _handleIncomingData(data) {
    // Add data to buffer
    this.incomingBuffer += data;
    
    // Process complete lines
    let lineEndIndex;
    while ((lineEndIndex = this.incomingBuffer.indexOf('\n')) !== -1) {
      // Extract the line
      const line = this.incomingBuffer.substring(0, lineEndIndex).trim();
      
      // Remove the processed line from the buffer
      this.incomingBuffer = this.incomingBuffer.substring(lineEndIndex + 1);
      
      // Skip empty lines
      if (!line) continue;
      
      // Handle file transfer acknowledgments
      if (this.fileTransfer.inProgress) {
        if (line.includes('Progress:')) {
          // Extract progress information
          const progressMatch = line.match(/Progress:\s*(\d+)%\s*\((\d+)\/(\d+)/);
          if (progressMatch) {
            const percentage = parseInt(progressMatch[1], 10);
            const bytesTransferred = parseInt(progressMatch[2], 10);
            const bytesTotal = parseInt(progressMatch[3], 10);
            
            this.fileTransfer.bytesTransferred = bytesTransferred;
            
            this.emit('fileTransfer', {
              status: 'progress',
              progress: percentage,
              bytesTransferred,
              bytesTotal,
              currentLine: this.fileTransfer.currentLine,
              totalLines: this.fileTransfer.totalLines
            });
          }
        } else if (line === '</FILE>') {
          // End of file transfer
          this._handleFileTransferCompletion();
        } else if (line.includes('File receive completed:')) {
          // Successful file transfer completion
          this._handleFileTransferCompletion();
        } else if (line.includes('Error:') || line.includes('Failed:')) {
          // Error during file transfer
          this.fileTransfer.error = line;
          this.cancelFileTransfer(line);
        }
      }
      
      // Check for position telemetry
      if (line.startsWith('[TELEMETRY]')) {
        this.emit('position-telemetry', { response: line });
      }
      
      // Emit the received line
      this.emit('response', { response: line });
      
      // Log the response for debugging
      console.log(`Received: ${line}`);
      
      // If we're waiting for a response, this will resolve the waiting promise
      if (this.pendingResponseResolve) {
        const resolve = this.pendingResponseResolve;
        this.pendingResponseResolve = null;
        
        if (this.pendingResponseTimeout) {
          clearTimeout(this.pendingResponseTimeout);
          this.pendingResponseTimeout = null;
        }
        
        resolve(line);
      }
    }
  }
  
  /**
   * Handle errors from adapters
   * @param {Error} error Error object
   * @private
   */
  _handleError(error) {
    console.error('Communication error:', error);
    this.emit('error', { error });
    
    // If there's a pending response, reject it
    if (this.pendingResponseReject) {
      const reject = this.pendingResponseReject;
      this.pendingResponseReject = null;
      
      if (this.pendingResponseTimeout) {
        clearTimeout(this.pendingResponseTimeout);
        this.pendingResponseTimeout = null;
      }
      
      reject(error);
    }
    
    // If there's a file transfer in progress, cancel it
    if (this.fileTransfer.inProgress) {
      this.cancelFileTransfer(error.message);
    }
  }
  
  /**
   * Handle successful completion of file transfer
   * @private
   */
  _handleFileTransferCompletion() {
    if (!this.fileTransfer.inProgress) return;
    
    // Set state to completed
    const { fileName, bytesTotal } = this.fileTransfer;
    this.fileTransfer.bytesTransferred = bytesTotal;
    this.fileTransfer.inProgress = false;
    
    // Emit completion event
    this.emit('fileTransfer', {
      status: 'completed',
      fileName,
      bytesTransferred: bytesTotal,
      bytesTotal
    });
  }
  
  /**
   * Wait for a response from the robot
   * @returns {Promise<string>} Response from the robot
   * @private
   */
  _waitForResponse() {
    return new Promise((resolve, reject) => {
      this.pendingResponseResolve = resolve;
      this.pendingResponseReject = reject;
      
      // Set a timeout for the response
      this.pendingResponseTimeout = setTimeout(() => {
        if (this.pendingResponseResolve) {
          const tempReject = this.pendingResponseReject;
          this.pendingResponseResolve = null;
          this.pendingResponseReject = null;
          tempReject(new Error('Response timeout'));
        }
      }, this.responseTimeout);
    });
  }
  
  /**
   * Process the command queue
   * @private
   */
  async _processCommandQueue() {
    if (this.isProcessingQueue || this.commandQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.commandQueue.length > 0) {
      const { command, expectResponse, resolve, reject } = this.commandQueue.shift();
      
      try {
        await this.activeAdapter.write(command);
        
        if (expectResponse) {
          const response = await this._waitForResponse();
          resolve(response);
        } else {
          resolve('');
        }
      } catch (error) {
        reject(error);
      }
      
      // Small delay between commands to avoid overwhelming the device
      await new Promise(r => setTimeout(r, 50));
    }
    
    this.isProcessingQueue = false;
  }
  
  /**
   * Start the reliable file transfer process
   * @private
   */
  async _startReliableFileTransfer() {
    // Attempt to send the file data in chunks with acknowledgment between chunks
    const { fileName, lines, totalLines, chunkSize, bytesTotal } = this.fileTransfer;
    
    try {
      let currentLine = 0;
      
      // Send chunks until all lines are sent
      while (currentLine < totalLines) {
        // Calculate end of chunk (not exceeding total lines)
        const endLine = Math.min(currentLine + chunkSize, totalLines);
        
        // Get the lines for this chunk
        const chunkLines = lines.slice(currentLine, endLine);
        const chunkContent = chunkLines.join('\n') + (endLine < totalLines ? '\n' : '');
        
        // Update current line in state
        this.fileTransfer.currentLine = currentLine;
        
        // Calculate bytes transferred so far
        let bytesTransferred = 0;
        for (let i = 0; i < currentLine; i++) {
          bytesTransferred += lines[i].length + 1; // +1 for newline
        }
        this.fileTransfer.bytesTransferred = bytesTransferred;
        
        // Send the chunk
        await this.activeAdapter.write(chunkContent);
        
        // Wait for acknowledgment (progress update) before sending the next chunk
        // This is a simplified approach - ideally we'd have explicit acknowledgments
        await this._waitForChunkAcknowledgment(bytesTransferred);
        
        // Move to next chunk
        currentLine = endLine;
      }
      
      // Signal end of file transfer if needed
      // Some protocols might need an explicit end marker
      await this.activeAdapter.write('\n');
      
      // Wait for final acknowledgment
      await this._waitForFileTransferCompletion();
      
      return true;
    } catch (error) {
      this.fileTransfer.error = error.message;
      throw error;
    }
  }
  
  /**
   * Wait for acknowledgment of a chunk
   * @param {number} expectedBytes Expected number of bytes to be acknowledged
   * @private
   */
  _waitForChunkAcknowledgment(expectedBytes) {
    return new Promise((resolve, reject) => {
      // Set a timeout for acknowledgment
      const timeout = setTimeout(() => {
        this.fileTransfer.retryCount++;
        
        if (this.fileTransfer.retryCount > this.fileTransfer.maxRetries) {
          reject(new Error('Maximum retries exceeded waiting for chunk acknowledgment'));
        } else {
          // For retry behavior, we would ideally resend the chunk
          // Here we'll just resolve to continue the process
          console.warn(`No explicit acknowledgment received, continuing anyway (retry ${this.fileTransfer.retryCount})`);
          resolve();
        }
      }, 1000); // 1-second timeout
      
      // Set up a one-time listener for progress events
      const progressHandler = (data) => {
        if (data.status === 'progress' && data.bytesTransferred >= expectedBytes) {
          clearTimeout(timeout);
          this.removeListener('fileTransfer', progressHandler);
          resolve();
        }
      };
      
      this.on('fileTransfer', progressHandler);
    });
  }
  
  /**
   * Wait for file transfer completion
   * @private
   */
  _waitForFileTransferCompletion() {
    return new Promise((resolve, reject) => {
      // Set a timeout for completion
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for file transfer completion'));
      }, 10000); // 10-second timeout for final acknowledgment
      
      // Set up a one-time listener for completion event
      const completionHandler = (data) => {
        if (data.status === 'completed') {
          clearTimeout(timeout);
          this.removeListener('fileTransfer', completionHandler);
          resolve();
        } else if (data.status === 'error' || data.status === 'cancelled') {
          clearTimeout(timeout);
          this.removeListener('fileTransfer', completionHandler);
          reject(new Error(data.error || 'Transfer failed'));
        }
      };
      
      this.on('fileTransfer', completionHandler);
    });
  }
}

// Create singleton instance
const communicationService = new CommunicationService();

export default communicationService;