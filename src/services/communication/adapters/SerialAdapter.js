/**
 * src/services/communication/adapters/SerialAdapter.js
 * Adapter for serial port communication with the robot
 */
import EventEmitter from 'events';

class SerialAdapter extends EventEmitter {
  constructor() {
    super();
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readingLoop = null;
    
    this._checkSerialApiSupport();
  }
  
  /**
   * Check if Web Serial API is supported
   * @private
   */
  _checkSerialApiSupport() {
    this.isSupported = typeof navigator !== 'undefined' && 
                      navigator.serial && 
                      typeof navigator.serial.getPorts === 'function';
    
    if (!this.isSupported) {
      console.warn('Web Serial API is not supported in this browser');
    }
  }
  
  /**
   * List available serial ports
   * @returns {Promise<Array>} Array of available ports
   */
  async listPorts() {
    if (!this.isSupported) {
      throw new Error('Web Serial API is not supported in this browser');
    }
    
    try {
      // Get ports the user has already granted access to
      const existingPorts = await navigator.serial.getPorts();
      
      // Return list of port info objects
      return existingPorts.map(port => {
        // Serial port info is quite limited in the Web Serial API
        // In the future, if better port information becomes available, enhance this
        return {
          port: port,
          displayName: 'Serial Device', // Cannot get friendly names with Web Serial API
          isRequestedPort: false,
          isOpen: port === this.port && this.port.readable !== null
        };
      });
    } catch (error) {
      console.error('Error listing serial ports:', error);
      throw error;
    }
  }
  
  /**
   * Request a port from the user
   * @returns {Promise<SerialPort>} Selected port
   */
  async requestPort() {
    if (!this.isSupported) {
      throw new Error('Web Serial API is not supported in this browser');
    }
    
    try {
      // This will show a port picker UI to the user
      const port = await navigator.serial.requestPort();
      return port;
    } catch (error) {
      // User cancelled or other error
      console.error('Error requesting serial port:', error);
      throw error;
    }
  }
  
  /**
   * Connect to a serial port
   * @param {Object} options Connection options
   * @param {SerialPort|undefined} options.port Port object (if undefined, will request)
   * @param {number} options.baudRate Baud rate
   * @returns {Promise<boolean>} Whether connection was successful
   */
  async connect(options = {}) {
    if (!this.isSupported) {
      throw new Error('Web Serial API is not supported in this browser');
    }
    
    // Default baud rate
    const baudRate = options.baudRate || 115200;
    
    try {
      let port;
      
      // If port object is provided, use it, otherwise request from user
      if (options.port && typeof options.port !== 'string') {
        port = options.port;
      } else {
        port = await this.requestPort();
      }
      // Open the port
      await port.open({ baudRate });
      
      // Store the port reference
      this.port = port;
      
      // Create a TextEncoder and TextDecoder for handling strings
      this.encoder = new TextEncoder();
      this.decoder = new TextDecoder();
      
      // Get reader and writer
      this.reader = this.port.readable.getReader();
      this.writer = this.port.writable.getWriter();
      
      // Start reading loop
      this._startReadingLoop();
      
      return true;
    } catch (error) {
      console.error('Error connecting to serial port:', error);
      this.emit('error', error);
      return false;
    }
  }
  
  /**
   * Disconnect from serial port
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.port) return;
    
    try {
      // Stop reading loop
      if (this.readingLoop) {
        this.readingLoop = false;
      }
      
      // Release the reader and writer
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }
      
      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }
      
      // Close the port
      await this.port.close();
      this.port = null;
      
    } catch (error) {
      console.error('Error disconnecting from serial port:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Write data to the serial port
   * @param {string} data Data to write
   * @returns {Promise<void>}
   */
  async write(data) {
    if (!this.port || !this.writer) {
      throw new Error('Not connected to a serial port');
    }
    
    try {
      const encoded = this.encoder.encode(data);
      await this.writer.write(encoded);
    } catch (error) {
      console.error('Error writing to serial port:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Start reading loop for incoming data
   * @private
   */
  async _startReadingLoop() {
    if (!this.reader) return;
    
    this.readingLoop = true;
    
    try {
      while (this.readingLoop) {
        const { value, done } = await this.reader.read();
        
        if (done) {
          // The stream was cancelled
          this.readingLoop = false;
          break;
        }
        
        if (value) {
          // Convert Uint8Array to string and emit data event
          const text = this.decoder.decode(value);
          this.emit('data', text);
        }
      }
    } catch (error) {
      console.error('Error reading from serial port:', error);
      this.emit('error', error);
    } finally {
      // Make sure to release the lock if the loop ends
      if (this.reader) {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }
}

export default SerialAdapter;