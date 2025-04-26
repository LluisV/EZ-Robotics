/**
 * src/services/communication/CommunicationService.js
 * Service for communicating with GRBL-compatible CNC controllers
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
    
    // GRBL state tracking
    this.lineBuffer = [];
    this.lastAck = true; // Start with ack=true so we can send the first command
    this.expectedResponses = new Map(); // Map of sent commands to response promises
    this.sentBytes = 0;
    this.confirmedBytes = 0;
    this.bufferSize = 128; // GRBL's default RX buffer size
    
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
        this.lineBuffer = [];
        this.lastAck = true;
        this.sentBytes = 0;
        this.confirmedBytes = 0;
        
        // Send a request for initial status
        setTimeout(() => {
          // Send a status request to check if GRBL is responding
          this._sendRealTimeCommand('?');
        }, 500);
        
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
    
    try {
      await this.activeAdapter.disconnect();
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
      this.activeAdapter = null;
      
      this.emit('connection', { 
        status: this.connectionStatus 
      });
      
      // Clear any pending commands
      this.lineBuffer = [];
      this.lastAck = true;
      this.expectedResponses.clear();
      this.sentBytes = 0;
      this.confirmedBytes = 0;
      
      return true;
    } catch (error) {
      console.error('Disconnection error:', error);
      return false;
    }
  }
  
  /**
   * Send a GRBL realtime command (like ? for status)
   * @param {string} command Single character realtime command
   * @private
   */
  _sendRealTimeCommand(command) {
    if (!this.activeAdapter || this.connectionStatus !== ConnectionStatus.CONNECTED) {
      console.warn('Cannot send realtime command: not connected');
      return;
    }
    
    try {
      // Realtime commands are sent directly, bypassing the buffer
      this.activeAdapter.write(command);
    } catch (error) {
      console.error('Error sending realtime command:', error);
      this.emit('error', { error });
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
    
    // Check for realtime commands (single character)
    if (command.length === 1 && ['?', '!', '~', '\x18'].includes(command)) {
      this._sendRealTimeCommand(command);
      
      // For status request, return a promise for the response
      if (command === '?' && expectResponse) {
        return new Promise((resolve) => {
          const onStatusResponse = (data) => {
            // Check if it's a status response (starts with < and ends with >)
            if (data.response && data.response.startsWith('<') && data.response.endsWith('>')) {
              this.removeListener('response', onStatusResponse);
              resolve(data.response);
            }
          };
          
          // Listen for the response
          this.on('response', onStatusResponse);
          
          // Set a timeout to prevent hanging if we don't get a proper response
          setTimeout(() => {
            this.removeListener('response', onStatusResponse);
            resolve(''); // Resolve with empty string on timeout
          }, 1000);
        });
      }
      
      return '';
    }
    
    // Normalize command (ensure it ends with newline)
    const normalizedCommand = command.trim() + '\n';
    const commandLength = normalizedCommand.length;
    
    // Log the command for debugging
    console.log(`Sending command: ${normalizedCommand.trim()}`);
    this.emit('command', { command: normalizedCommand.trim(), sent: true });
    
    // For immediate commands or when the buffer is free, send directly
    if (immediate || this.lastAck) {
      try {
        await this.activeAdapter.write(normalizedCommand);
        this.sentBytes += commandLength;
        
        if (expectResponse) {
          return this._waitForResponse(normalizedCommand.trim());
        }
        return '';
      } catch (error) {
        console.error('Error sending command:', error);
        throw error;
      }
    }
    
    // Otherwise, add to line buffer using GRBL's buffer counting mechanism
    return new Promise((resolve, reject) => {
      // Check if we have enough space in GRBL's buffer
      if (this.sentBytes - this.confirmedBytes + commandLength <= this.bufferSize) {
        // Send the command directly
        this.activeAdapter.write(normalizedCommand)
          .then(() => {
            this.sentBytes += commandLength;
            
            if (expectResponse) {
              // Wait for the response
              this._waitForResponse(normalizedCommand.trim())
                .then(response => resolve(response))
                .catch(error => reject(error));
            } else {
              resolve('');
            }
          })
          .catch(error => {
            console.error('Error sending command:', error);
            reject(error);
          });
      } else {
        // Not enough space, add to line buffer
        this.lineBuffer.push({
          command: normalizedCommand,
          expectResponse,
          resolve,
          reject
        });
        
        // Process the line buffer
        this._processLineBuffer();
      }
    });
  }
  
  /**
   * Wait for a response from the robot
   * @param {string} command The sent command
   * @returns {Promise<string>} Response from the robot
   * @private
   */
  _waitForResponse(command) {
    return new Promise((resolve, reject) => {
      const responseTimeout = 10000; // 10 seconds timeout
      
      // Create a handler for the response
      const responseHandler = (responseData) => {
        // Check if it's an "ok" or error response
        if (responseData.response === 'ok' || responseData.response.startsWith('error:')) {
          this.confirmedBytes += command.length + 1; // +1 for newline
          this.lastAck = true;
          
          // Process any pending commands
          this._processLineBuffer();
          
          resolve(responseData.response);
        }
      };
      
      // Add the handler to our event emitter
      this.on('response', responseHandler);
      
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        this.removeListener('response', responseHandler);
        reject(new Error('Response timeout'));
      }, responseTimeout);
      
      // Create a cleanup function to avoid duplicated code
      const cleanup = () => {
        this.removeListener('response', responseHandler);
        clearTimeout(timeout);
      };
      
      // Add error handler
      const errorHandler = (errorData) => {
        cleanup();
        reject(errorData.error);
      };
      
      this.once('error', errorHandler);
    });
  }
  
  /**
   * Process the line buffer
   * @private
   */
  _processLineBuffer() {
    // Only process if we have lines and the last command was acknowledged
    if (this.lineBuffer.length === 0 || !this.lastAck) {
      return;
    }
    
    // Get the next command
    const { command, expectResponse, resolve, reject } = this.lineBuffer[0];
    const commandLength = command.length;
    
    // Check if we have space in GRBL's buffer
    if (this.sentBytes - this.confirmedBytes + commandLength <= this.bufferSize) {
      // Remove from buffer
      this.lineBuffer.shift();
      
      // Set acknowledging status to false to prevent overlapping
      this.lastAck = false;
      
      // Send the command
      this.activeAdapter.write(command)
        .then(() => {
          this.sentBytes += commandLength;
          
          if (expectResponse) {
            // Wait for the response
            this._waitForResponse(command.trim())
              .then(response => {
                resolve(response);
                // Continue processing the buffer
                this._processLineBuffer();
              })
              .catch(error => {
                reject(error);
                this.lastAck = true; // Allow further processing even on error
                this._processLineBuffer();
              });
          } else {
            resolve('');
            this.lastAck = true;
            this._processLineBuffer();
          }
        })
        .catch(error => {
          console.error('Error sending command from buffer:', error);
          reject(error);
          this.lastAck = true; // Allow further processing even on error
          this._processLineBuffer();
        });
    }
    // If no space available, we'll retry when an 'ok' is received
  }
  
  /**
   * Send a G-code file to the robot using GRBL's buffer-based streaming
   * @param {string} fileContent Content of the G-code file
   * @param {function} progressCallback Optional callback for progress updates
   * @returns {Promise<boolean>} Whether the file was sent successfully
   */
  async sendGCodeFile(fileContent, progressCallback = null) {
    if (!this.activeAdapter || this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to robot');
    }
    
    try {
      // Normalize line endings and remove multiple blank lines
      const normalizedContent = fileContent.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
      const lines = normalizedContent.split('\n');
      const totalLines = lines.length;
      
      // Reset state
      this.lineBuffer = [];
      this.lastAck = true;
      this.sentBytes = 0;
      this.confirmedBytes = 0;
      
      // Report start of file transfer
      if (progressCallback) {
        progressCallback({
          status: 'started',
          totalLines,
          progress: 0
        });
      }
      
      let currentLine = 0;
      let errorOccurred = false;
      
      for (const line of lines) {
        // Skip empty lines and comments
        if (!line.trim() || line.trim().startsWith(';')) {
          currentLine++;
          continue;
        }
        
        try {
          // Send the line and wait for the response
          const response = await this.sendCommand(line, { expectResponse: true });
          
          // Check for error response
          if (response.startsWith('error:')) {
            console.error(`Error executing line ${currentLine + 1}: ${line} - ${response}`);
            if (progressCallback) {
              progressCallback({
                status: 'error',
                error: `Error at line ${currentLine + 1}: ${response}`,
                line: currentLine + 1,
                command: line
              });
            }
            errorOccurred = true;
            break;
          }
          
          // Update progress
          currentLine++;
          if (progressCallback) {
            progressCallback({
              status: 'progress',
              progress: Math.floor((currentLine / totalLines) * 100),
              line: currentLine,
              totalLines
            });
          }
        } catch (error) {
          console.error(`Error sending line ${currentLine + 1}: ${error.message}`);
          if (progressCallback) {
            progressCallback({
              status: 'error',
              error: error.message,
              line: currentLine + 1,
              command: line
            });
          }
          errorOccurred = true;
          break;
        }
      }
      
      if (!errorOccurred && progressCallback) {
        progressCallback({
          status: 'completed',
          totalLines
        });
      }
      
      return !errorOccurred;
    } catch (error) {
      console.error('Error sending G-code file:', error);
      if (progressCallback) {
        progressCallback({
          status: 'error',
          error: error.message
        });
      }
      throw error;
    }
  }
  
  /**
   * Send a special command (like STOP)
   * @param {string} commandType Type of special command
   * @returns {Promise<void>}
   */
  async sendSpecialCommand(commandType) {
    switch (commandType) {
      case 'STOP':
        // Send reset command (Ctrl-X)
        this._sendRealTimeCommand('\x18');
        return '';
      
      case 'FEEDHOLD':
        // Send feed hold command (!)
        this._sendRealTimeCommand('!');
        return '';
      
      case 'RESUME':
        // Send cycle start/resume command (~)
        this._sendRealTimeCommand('~');
        return '';
        
      case 'HOME':
        // Home all axes (G28)
        return this.sendCommand('$H', { expectResponse: true });
      
      case 'GET_POSITION':
        // Request current position
        this._sendRealTimeCommand('?');
        return new Promise((resolve) => {
          const onStatusResponse = (data) => {
            // Check if it's a status response
            if (data.response && data.response.startsWith('<') && data.response.endsWith('>')) {
              this.removeListener('response', onStatusResponse);
              resolve(data.response);
            }
          };
          
          this.on('response', onStatusResponse);
          
          // Set a timeout
          setTimeout(() => {
            this.removeListener('response', onStatusResponse);
            resolve(''); // Resolve with empty string on timeout
          }, 1000);
        });
      
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
      
      // Log the received line for debugging
      console.log(`Received: ${line}`);
      
      // Emit the received line as a response
      this.emit('response', { response: line });
      
      // Special handling for status responses
      if (line.startsWith('<') && line.endsWith('>')) {
        this._parseGrblStatus(line);
      }

      
      if (line.startsWith('[TELEMETRY]')) {
        this.emit('position-telemetry', { response: line });
      }
    }
    
    // Check for status characters (these don't end with newline)
    if (this.incomingBuffer.startsWith('<') && this.incomingBuffer.includes('>')) {
      const endIndex = this.incomingBuffer.indexOf('>') + 1;
      const statusLine = this.incomingBuffer.substring(0, endIndex);
      this.incomingBuffer = this.incomingBuffer.substring(endIndex);
      
      // Log the received status
      console.log(`Received status: ${statusLine}`);

      
      // Emit the received status as a response
      this.emit('response', { response: statusLine });
      
      // Parse the status
      this._parseGrblStatus(statusLine);
    }
  }
  
  /**
   * Parse GRBL status response
   * @param {string} statusLine The status line (format: <status|...>)
   * @private
   */
  _parseGrblStatus(statusLine) {
    // Strip the angle brackets
    const statusContent = statusLine.substring(1, statusLine.length - 1);
    
    // Split by pipe character
    const statusParts = statusContent.split('|');
    
    // The first part is the machine state
    const machineState = statusParts[0];
    
    // Parse remaining parts
    const status = {
      state: machineState,
      machinePosition: { x: 0, y: 0, z: 0 },
      workPosition: { x: 0, y: 0, z: 0 },
      feedRate: 0
    };
    
    for (let i = 1; i < statusParts.length; i++) {
      const part = statusParts[i];
      
      if (part.startsWith('MPos:')) {
        // Machine position
        const coords = part.substring(5).split(',');
        if (coords.length >= 3) {
          status.machinePosition = {
            x: parseFloat(coords[0]),
            y: parseFloat(coords[1]),
            z: parseFloat(coords[2])
          };
        }
      } else if (part.startsWith('WPos:')) {
        // Work position
        const coords = part.substring(5).split(',');
        if (coords.length >= 3) {
          status.workPosition = {
            x: parseFloat(coords[0]),
            y: parseFloat(coords[1]),
            z: parseFloat(coords[2])
          };
        }
      } else if (part.startsWith('FS:')) {
        // Feed and speed
        const values = part.substring(3).split(',');
        if (values.length >= 1) {
          status.feedRate = parseFloat(values[0]);
        }
      }
    }
    
    // Emit the parsed status
    this.emit('grbl-status', status);
  }
  
  /**
   * Handle errors from adapters
   * @param {Error} error Error object
   * @private
   */
  _handleError(error) {
    console.error('Communication error:', error);
    this.emit('error', { error });
  }
}

// Create singleton instance
const communicationService = new CommunicationService();

export default communicationService;