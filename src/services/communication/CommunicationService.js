/**
 * src/services/communication/CommunicationService.js
 * Service for communicating with FluidNC-compatible CNC controllers
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
    
    // FluidNC state tracking
    this.lineBuffer = [];
    this.lastAck = true; // Start with ack=true so we can send the first command
    this.expectedResponses = new Map(); // Map of sent commands to response promises
    this.sentLines = 0;
    this.confirmedLines = 0;
    this.receivedResponses = 0;
    
    // Buffer for received data
    this.incomingBuffer = '';
    
    // FluidNC state
    this.machineState = 'Unknown';
    this.workPosition = { x: 0, y: 0, z: 0, a: 0 };
    this.machinePosition = { x: 0, y: 0, z: 0, a: 0 };
    
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
   * Connect to a FluidNC device
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
        this.sentLines = 0;
        this.confirmedLines = 0;
        this.receivedResponses = 0;
        
        // Send initial commands to set up FluidNC
        await this._sendInitialConfig();
        
        // Send a request for initial status
        setTimeout(() => {
          // Send a status request to check if FluidNC is responding
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
   * Send initial configuration to FluidNC
   * @private
   */
  async _sendInitialConfig() {
    // Send initialization commands for FluidNC
    const initCommands = [
      '$SR', // Status report with position data
      '$SLP=250', // Status report interval in milliseconds
      '$EA', // Enable all axes
      '$I', // Request FluidNC information
    ];
    
    // Send each command with a small delay in between
    for (const cmd of initCommands) {
      try {
        await this.sendCommand(cmd, { immediate: true });
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`Error sending initialization command ${cmd}:`, error);
      }
    }
  }
  
  /**
   * Disconnect from FluidNC device
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
      this.sentLines = 0;
      this.confirmedLines = 0;
      this.receivedResponses = 0;
      
      return true;
    } catch (error) {
      console.error('Disconnection error:', error);
      return false;
    }
  }
  
  /**
   * Send a FluidNC realtime command (like ? for status)
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
   * Send a G-code command to FluidNC
   * @param {string} command G-code command to send
   * @param {Object} options Command options
   * @param {boolean} options.immediate Whether to send immediately or queue
   * @param {boolean} options.expectResponse Whether to wait for a response
   * @returns {Promise<string>} Command response (if expectResponse=true)
   */
  async sendCommand(command, options = {}) {
    const { immediate = false, expectResponse = true } = options;
    
    if (!this.activeAdapter || this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to FluidNC');
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
    
    // Log the command for debugging
    console.log(`Sending command: ${normalizedCommand.trim()}`);
    this.emit('command', { command: normalizedCommand.trim(), sent: true });
    
    // For immediate commands or when the buffer is free, send directly
    if (immediate || this.lastAck) {
      try {
        await this.activeAdapter.write(normalizedCommand);
        this.sentLines++;
        
        if (expectResponse) {
          return this._waitForResponse(normalizedCommand.trim());
        }
        return '';
      } catch (error) {
        console.error('Error sending command:', error);
        throw error;
      }
    }
    
    // Otherwise, add to line buffer for FluidNC's line-by-line protocol
    return new Promise((resolve, reject) => {
      // Add to line buffer
      this.lineBuffer.push({
        command: normalizedCommand,
        expectResponse,
        resolve,
        reject
      });
      
      // Process the line buffer
      this._processLineBuffer();
    });
  }
  
  /**
   * Wait for a response from FluidNC
   * @param {string} command The sent command
   * @returns {Promise<string>} Response from FluidNC
   * @private
   */
  _waitForResponse(command) {
    return new Promise((resolve, reject) => {
      const responseTimeout = 10000; // 10 seconds timeout
      
      // Create a handler for the response
      const responseHandler = (responseData) => {
        // Check if it's an "ok" or error response
        if (responseData.response === 'ok' || responseData.response.startsWith('error:')) {
          this.confirmedLines++;
          this.lastAck = true;
          
          // Process any pending commands
          this._processLineBuffer();
          
          this.removeListener('response', responseHandler);
          clearTimeout(timeout);
          
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
    });
  }
  
  /**
   * Process the line buffer for FluidNC's line-by-line protocol
   * @private
   */
  _processLineBuffer() {
    // Only process if we have lines and the last command was acknowledged
    if (this.lineBuffer.length === 0 || !this.lastAck) {
      return;
    }
    
    // Get the next command
    const { command, expectResponse, resolve, reject } = this.lineBuffer[0];
    
    // Remove from buffer
    this.lineBuffer.shift();
    
    // Set acknowledging status to false to prevent overlapping
    this.lastAck = false;
    
    // Send the command
    this.activeAdapter.write(command)
      .then(() => {
        this.sentLines++;
        
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
  
  /**
   * Send a G-code file to FluidNC using line-by-line streaming
   * @param {string} fileContent Content of the G-code file
   * @param {function} progressCallback Optional callback for progress updates
   * @returns {Promise<boolean>} Whether the file was sent successfully
   */
  async sendGCodeFile(fileContent, progressCallback = null) {
    if (!this.activeAdapter || this.connectionStatus !== ConnectionStatus.CONNECTED) {
      throw new Error('Not connected to FluidNC');
    }
    
    try {
      // Normalize line endings and remove multiple blank lines
      const normalizedContent = fileContent.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
      const lines = normalizedContent.split('\n');
      const totalLines = lines.length;
      
      // Reset state
      this.lineBuffer = [];
      this.lastAck = true;
      this.sentLines = 0;
      this.confirmedLines = 0;
      
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
      
      // We use sequential line-by-line sending for FluidNC
      // Each line must be acknowledged before sending the next
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
          if (progressCallback && currentLine % 5 === 0) { // Update every 5 lines to reduce overhead
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
   * Send a special command to FluidNC
   * @param {string} commandType Type of special command
   * @returns {Promise<void>}
   */
  async sendSpecialCommand(commandType) {
    switch (commandType) {
      case 'STOP':
        // Send soft reset command (Ctrl-X) for FluidNC
        this._sendRealTimeCommand('\x18');
        return '';
      
      case 'FEEDHOLD':
        // Send feed hold command (!) for FluidNC
        this._sendRealTimeCommand('!');
        return '';
      
      case 'RESUME':
        // Send cycle start/resume command (~) for FluidNC
        this._sendRealTimeCommand('~');
        return '';
        
      case 'HOME':
        // Home all axes with FluidNC command
        return this.sendCommand('$H', { expectResponse: true });
      
      case 'GET_POSITION':
        // Request current position using FluidNC's status report
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
      baudRate: this.baudRate,
      machineState: this.machineState
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
   * Handle incoming data from FluidNC
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
      
      // Special handling for FluidNC telemetry messages
      if (line.startsWith('[MSG:')) {
        // FluidNC message
        this._parseFluidNCMessage(line);
      }
      
      // Handle position updates in JSON format
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const telemetryData = JSON.parse(line);
          if (telemetryData.coordsys || telemetryData.position) {
            this._parseFluidNCJSON(telemetryData);
          }
        } catch (e) {
          console.error('Error parsing JSON:', e);
        }
      }
      
      // Create telemetry message for position data
      if (this.machinePosition && this.workPosition) {
        const telemetryMsg = `[TELEMETRY] Position data: ${JSON.stringify({
          world: {
            X: this.machinePosition.x.toFixed(3),
            Y: this.machinePosition.y.toFixed(3),
            Z: this.machinePosition.z.toFixed(3),
            A: this.machinePosition.a.toFixed(3)
          },
          work: {
            X: this.workPosition.x.toFixed(3),
            Y: this.workPosition.y.toFixed(3),
            Z: this.workPosition.z.toFixed(3),
            A: this.workPosition.a.toFixed(3)
          }
        })}`;
        
        this.emit('position-telemetry', { response: telemetryMsg });
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
      this._parseFluidNCStatus(statusLine);
    }
  }
  
  /**
   * Parse FluidNC message in the format [MSG:...]
   * @param {string} message The message line
   * @private
   */
  _parseFluidNCMessage(message) {
    // FluidNC messages are in the format [MSG:content]
    const content = message.substring(5, message.length - 1);
    
    console.log('FluidNC message:', content);
    
    // Process based on message content
    if (content.includes('Initialize')) {
      // FluidNC is initializing
      this.emit('response', { response: 'FluidNC initializing...' });
    } else if (content.includes('error')) {
      // Error message
      this.emit('error', { error: content });
    }
  }
  
  /**
   * Parse FluidNC status response in the format <status|...>
   * @param {string} statusLine The status line
   * @private
   */
  _parseFluidNCStatus(statusLine) {
    // Strip the angle brackets
    const statusContent = statusLine.substring(1, statusLine.length - 1);
    
    // Split by pipe character
    const statusParts = statusContent.split('|');
    
    // The first part is the machine state
    const machineState = statusParts[0];
    this.machineState = machineState;
    
    // Parse remaining parts
    const status = {
      state: machineState,
      machinePosition: { ...this.machinePosition },
      workPosition: { ...this.workPosition },
      feedRate: 0
    };
    
    for (let i = 1; i < statusParts.length; i++) {
      const part = statusParts[i];
      
      if (part.startsWith('MPos:')) {
        // Machine position (absolute coordinates)
        const coords = part.substring(5).split(',');
        if (coords.length >= 3) {
          this.machinePosition = {
            x: parseFloat(coords[0]),
            y: parseFloat(coords[1]),
            z: parseFloat(coords[2]),
            a: coords.length >= 4 ? parseFloat(coords[3]) : 0
          };
          status.machinePosition = { ...this.machinePosition };
        }
      } else if (part.startsWith('WPos:')) {
        // Work position (relative to work coordinate system)
        const coords = part.substring(5).split(',');
        if (coords.length >= 3) {
          this.workPosition = {
            x: parseFloat(coords[0]),
            y: parseFloat(coords[1]),
            z: parseFloat(coords[2]),
            a: coords.length >= 4 ? parseFloat(coords[3]) : 0
          };
          status.workPosition = { ...this.workPosition };
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
    this.emit('fluidnc-status', status);
    
    // Create telemetry message for position data
    const telemetryMsg = `[TELEMETRY] Position data: ${JSON.stringify({
      world: {
        X: this.machinePosition.x.toFixed(3),
        Y: this.machinePosition.y.toFixed(3),
        Z: this.machinePosition.z.toFixed(3),
        A: this.machinePosition.a.toFixed(3)
      },
      work: {
        X: this.workPosition.x.toFixed(3),
        Y: this.workPosition.y.toFixed(3),
        Z: this.workPosition.z.toFixed(3),
        A: this.workPosition.a.toFixed(3)
      }
    })}`;
    
    this.emit('position-telemetry', { response: telemetryMsg });
  }
  
  /**
   * Parse FluidNC JSON data format
   * @param {Object} jsonData JSON data from FluidNC
   * @private
   */
  _parseFluidNCJSON(jsonData) {
    // Update positions if available
    if (jsonData.coordsys && jsonData.coordsys.system === 'MCS') {
      // Machine coordinate system
      if (jsonData.coordsys.position) {
        this.machinePosition = {
          x: parseFloat(jsonData.coordsys.position.x || 0),
          y: parseFloat(jsonData.coordsys.position.y || 0),
          z: parseFloat(jsonData.coordsys.position.z || 0),
          a: parseFloat(jsonData.coordsys.position.a || 0)
        };
      }
    } else if (jsonData.coordsys && jsonData.coordsys.system === 'WCS') {
      // Work coordinate system
      if (jsonData.coordsys.position) {
        this.workPosition = {
          x: parseFloat(jsonData.coordsys.position.x || 0),
          y: parseFloat(jsonData.coordsys.position.y || 0),
          z: parseFloat(jsonData.coordsys.position.z || 0),
          a: parseFloat(jsonData.coordsys.position.a || 0)
        };
      }
    }
    
    // If simple position update
    if (jsonData.position) {
      if (jsonData.position.mcs) {
        this.machinePosition = {
          x: parseFloat(jsonData.position.mcs.x || 0),
          y: parseFloat(jsonData.position.mcs.y || 0),
          z: parseFloat(jsonData.position.mcs.z || 0),
          a: parseFloat(jsonData.position.mcs.a || 0)
        };
      }
      if (jsonData.position.wcs) {
        this.workPosition = {
          x: parseFloat(jsonData.position.wcs.x || 0),
          y: parseFloat(jsonData.position.wcs.y || 0),
          z: parseFloat(jsonData.position.wcs.z || 0),
          a: parseFloat(jsonData.position.wcs.a || 0)
        };
      }
    }
    
    // Create telemetry message for position data
    const telemetryMsg = `[TELEMETRY] Position data: ${JSON.stringify({
      world: {
        X: this.machinePosition.x.toFixed(3),
        Y: this.machinePosition.y.toFixed(3),
        Z: this.machinePosition.z.toFixed(3),
        A: this.machinePosition.a.toFixed(3)
      },
      work: {
        X: this.workPosition.x.toFixed(3),
        Y: this.workPosition.y.toFixed(3),
        Z: this.workPosition.z.toFixed(3),
        A: this.workPosition.a.toFixed(3)
      }
    })}`;
    
    this.emit('position-telemetry', { response: telemetryMsg });
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