/**
 * src/services/communication/CommunicationService.js
 * Main service for handling communication with the robot
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
    const { immediate = false, expectResponse = false } = options;
    
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
      
      // Check for position telemetry
      if (line.startsWith('[TELEMETRY][POS]')) {
        console.log('Emitting position telemetry:', line); // Added debug log
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
}

// Create singleton instance
const communicationService = new CommunicationService();

export default communicationService;