/**
 * Plugin Python API - Handles communication with Python backend
 */
class PluginPythonAPI {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.ws = null;
    this.connected = false;
    this.messageHandlers = new Map();
    this.streamHandlers = new Map();
    this.messageId = 0;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    // Python backend URL
    this.backendUrl = `ws://localhost:${window.PYTHON_BACKEND_PORT || 8001}/ws/${pluginId}`;
  }

  /**
   * Connect to Python backend
   */
  async connect() {
    if (this.connected || this.ws) {
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.backendUrl);

        this.ws.onopen = () => {
          console.log(`Plugin ${this.pluginId} connected to Python backend`);
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error(`WebSocket error for plugin ${this.pluginId}:`, error);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.ws = null;
          
          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
              this.connect();
            }, this.reconnectDelay * this.reconnectAttempts);
          }
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle response messages
      if (message.id && this.messageHandlers.has(message.id)) {
        const handler = this.messageHandlers.get(message.id);
        this.messageHandlers.delete(message.id);
        
        if (message.error) {
          handler.reject(new Error(message.error));
        } else {
          handler.resolve(message);
        }
      }
      
      // Handle stream messages
      if (message.type === 'stream_data' && message.streamId) {
        const handler = this.streamHandlers.get(message.streamId);
        if (handler) {
          handler(message.data);
        }
      }
      
      // Handle stream errors
      if (message.type === 'stream_error' && message.streamId) {
        const handler = this.streamHandlers.get(message.streamId);
        if (handler) {
          handler(null, new Error(message.error));
          this.streamHandlers.delete(message.streamId);
        }
      }
      
    } catch (error) {
      console.error('Error handling message:', error);
    }
  }

  /**
   * Send a message and wait for response
   */
  async sendMessage(type, data = {}) {
    if (!this.connected) {
      await this.connect();
    }

    const id = ++this.messageId;
    const message = { id, type, ...data };

    return new Promise((resolve, reject) => {
      this.messageHandlers.set(id, { resolve, reject });
      
      try {
        this.ws.send(JSON.stringify(message));
        
        // Timeout after 30 seconds
        setTimeout(() => {
          if (this.messageHandlers.has(id)) {
            this.messageHandlers.delete(id);
            reject(new Error('Request timeout'));
          }
        }, 30000);
        
      } catch (error) {
        this.messageHandlers.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Load Python code
   */
  async load(pythonCode, requirements = []) {
    const response = await this.sendMessage('load', {
      pythonCode,
      requirements
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to load Python code');
    }
    
    return true;
  }

  /**
   * Execute a Python function
   */
  async execute(functionName, args = [], kwargs = {}) {
    const response = await this.sendMessage('execute', {
      function: functionName,
      args,
      kwargs
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.result;
  }

  /**
   * Start a streaming operation
   */
  async startStream(functionName, args = [], kwargs = {}, onData) {
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Register stream handler
    this.streamHandlers.set(streamId, onData);
    
    const response = await this.sendMessage('stream_start', {
      streamId,
      function: functionName,
      args,
      kwargs
    });
    
    if (!response.success) {
      this.streamHandlers.delete(streamId);
      throw new Error(response.error || 'Failed to start stream');
    }
    
    // Return function to stop the stream
    return () => this.stopStream(streamId);
  }

  /**
   * Stop a streaming operation
   */
  async stopStream(streamId) {
    this.streamHandlers.delete(streamId);
    
    try {
      await this.sendMessage('stream_stop', { streamId });
    } catch (error) {
      console.error('Error stopping stream:', error);
    }
  }

  /**
   * Disconnect and clean up
   */
  async disconnect() {
    if (this.ws) {
      // Stop all streams
      for (const streamId of this.streamHandlers.keys()) {
        await this.stopStream(streamId);
      }
      
      // Clear handlers
      this.messageHandlers.clear();
      this.streamHandlers.clear();
      
      // Close connection
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

export default PluginPythonAPI;