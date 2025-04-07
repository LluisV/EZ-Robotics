/**
 * src/services/communication/adapters/WebSocketAdapter.js
 * Adapter for WebSocket communication with the robot
 */
import EventEmitter from 'events';

class WebSocketAdapter extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.url = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 2000; // ms
  }
  
  /**
   * Connect to WebSocket server
   * @param {Object} options Connection options
   * @param {string} options.url WebSocket URL
   * @param {boolean} options.autoReconnect Whether to auto-reconnect on disconnect
   * @returns {Promise<boolean>} Whether connection was successful
   */
  async connect(options = {}) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return true; // Already connected
    }
    
    if (this.isConnecting) {
      return false; // Already connecting
    }
    
    this.isConnecting = true;
    this.url = options.url;
    this.autoReconnect = options.autoReconnect !== false; // Default to true
    
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);
        
        // Set up event handlers
        this.socket.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          console.log('WebSocket connected');
          
          resolve(true);
        };
        
        this.socket.onmessage = (event) => {
          this.emit('data', event.data);
        };
        
        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        };
        
        this.socket.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          this.socket = null;
          
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(new Error('Connection closed while connecting'));
          }
          
          // Auto-reconnect logic
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
              this.connect({ url: this.url, autoReconnect: true })
                .catch(err => console.error('Reconnect failed:', err));
            }, this.reconnectInterval);
          }
        };
        
        // Set timeout for connection
        setTimeout(() => {
          if (this.isConnecting) {
            this.isConnecting = false;
            if (this.socket) {
              this.socket.close();
              this.socket = null;
            }
            reject(new Error('Connection timeout'));
          }
        }, 5000);
        
      } catch (error) {
        this.isConnecting = false;
        console.error('WebSocket connection error:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from WebSocket server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.socket) return;
    
    return new Promise((resolve) => {
      // Turn off auto-reconnect before closing
      this.autoReconnect = false;
      
      // Use a closure event handler to resolve after the socket closes
      const onClose = () => {
        this.socket = null;
        resolve();
      };
      
      if (this.socket.readyState === WebSocket.CONNECTING || 
          this.socket.readyState === WebSocket.OPEN) {
        // Register one-time close handler for clean shutdown
        this.socket.addEventListener('close', onClose, { once: true });
        this.socket.close();
      } else {
        // If socket is already closing or closed, resolve immediately
        this.socket = null;
        resolve();
      }
    });
  }
  
  /**
   * Write data to the WebSocket
   * @param {string} data Data to write
   * @returns {Promise<void>}
   */
  async write(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    return new Promise((resolve, reject) => {
      try {
        this.socket.send(data);
        resolve();
      } catch (error) {
        console.error('Error writing to WebSocket:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Check if WebSocket is connected
   * @returns {boolean} Whether WebSocket is connected
   */
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

export default WebSocketAdapter;