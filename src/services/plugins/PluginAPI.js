/**
 * Plugin API Interface - Core API that plugins interact with
 * Provides controlled access to application features based on permissions
 */
class PluginAPI {
  constructor(pluginId, permissions = []) {
    this.pluginId = pluginId;
    this.permissions = permissions;
    this.subscriptions = new Map();
    this._destroyed = false;
  }

  /**
   * Serial Communication API
   */
  serial = {
    /**
     * Send a command to the serial port
     * @param {string} command - Command to send
     * @returns {Promise<boolean>} Success status
     */
    send: async (command) => {
      if (!this.hasPermission('serial:write')) {
        throw new Error('Plugin does not have serial:write permission');
      }
      
      // Check if serialService exists
      if (!window.serialService) {
        throw new Error('Serial service not available');
      }
      
      return window.serialService.send(command);
    },

    /**
     * Subscribe to serial data
     * @param {Function} callback - Callback for serial data
     * @returns {Function} Unsubscribe function
     */
    subscribe: (callback) => {
      if (!this.hasPermission('serial:read')) {
        throw new Error('Plugin does not have serial:read permission');
      }
      
      const id = this.addSubscription('serial', callback);
      
      // Create event listener
      const listener = (event) => {
        if (event.detail && event.detail.data) {
          callback(event.detail.data);
        }
      };
      
      document.addEventListener('serialdata', listener);
      
      // Return unsubscribe function
      return () => {
        document.removeEventListener('serialdata', listener);
        this.removeSubscription('serial', id);
      };
    }
  };

  /**
   * Position API
   */
  position = {
    /**
     * Get current position
     * @returns {Object} Current position {x, y, z, a}
     */
    get: () => {
      if (!this.hasPermission('position:subscribe')) {
        throw new Error('Plugin does not have position:subscribe permission');
      }
      
      // Try to get position from global state or return default
      return window.robotPosition || { x: 0, y: 0, z: 0, a: 0 };
    },

    /**
     * Subscribe to position updates
     * @param {Function} callback - Callback for position updates
     * @returns {Function} Unsubscribe function
     */
    subscribe: (callback) => {
      if (!this.hasPermission('position:subscribe')) {
        throw new Error('Plugin does not have position:subscribe permission');
      }
      
      const id = this.addSubscription('position', callback);
      
      // Create position update listener
      const listener = (event) => {
        if (event.detail && event.detail.position) {
          callback(event.detail.position);
        }
      };
      
      // Listen for position updates
      document.addEventListener('positionUpdate', listener);
      
      // Also listen for serial data that contains position
      const serialListener = (event) => {
        if (event.detail && event.detail.data) {
          const data = event.detail.data;
          // Parse position from status messages
          if (data.startsWith('<') && data.includes('|MPos:')) {
            const mPosMatch = data.match(/MPos:([^,|]+),([^,|]+),([^,|]+)/);
            if (mPosMatch) {
              const position = {
                x: parseFloat(mPosMatch[1]) || 0,
                y: parseFloat(mPosMatch[2]) || 0,
                z: parseFloat(mPosMatch[3]) || 0,
                a: 0 // A axis might not be in basic status
              };
              callback(position);
            }
          }
        }
      };
      
      document.addEventListener('serialdata', serialListener);
      
      // Return unsubscribe function
      return () => {
        document.removeEventListener('positionUpdate', listener);
        document.removeEventListener('serialdata', serialListener);
        this.removeSubscription('position', id);
      };
    }
  };

  /**
   * G-Code API
   */
  gcode = {
    /**
     * Get current G-code
     * @returns {string} Current G-code content
     */
    get: () => {
      if (!this.hasPermission('gcode:read')) {
        throw new Error('Plugin does not have gcode:read permission');
      }
      
      // Access G-code from context or global state
      if (window.gcodeContext) {
        return window.gcodeContext.gcode || '';
      }
      return '';
    },

    /**
     * Set G-code content
     * @param {string} code - G-code to set
     */
    set: (code) => {
      if (!this.hasPermission('gcode:write')) {
        throw new Error('Plugin does not have gcode:write permission');
      }
      
      if (window.gcodeContext && window.gcodeContext.setGCode) {
        window.gcodeContext.setGCode(code);
      } else {
        throw new Error('G-code context not available');
      }
    },

    /**
     * Parse G-code
     * @param {string} code - G-code to parse
     * @returns {Object} Parsed toolpath
     */
    parse: (code) => {
      if (!this.hasPermission('gcode:read')) {
        throw new Error('Plugin does not have gcode:read permission');
      }
      
      if (window.GCodeParser) {
        const parser = new window.GCodeParser();
        return parser.parse(code);
      } else {
        throw new Error('G-code parser not available');
      }
    }
  };

  /**
   * Status API
   */
  status = {
    /**
     * Get current machine status
     * @returns {Object} Machine status
     */
    get: () => {
      if (!this.hasPermission('status:subscribe')) {
        throw new Error('Plugin does not have status:subscribe permission');
      }
      
      return window.machineStatus || { 
        state: 'Unknown', 
        connected: false,
        feedRate: 0,
        spindleSpeed: 0
      };
    },

    /**
     * Subscribe to status updates
     * @param {Function} callback - Callback for status updates
     * @returns {Function} Unsubscribe function
     */
    subscribe: (callback) => {
      if (!this.hasPermission('status:subscribe')) {
        throw new Error('Plugin does not have status:subscribe permission');
      }
      
      const id = this.addSubscription('status', callback);
      
      // Create status listener
      const listener = (event) => {
        if (event.detail && event.detail.status) {
          callback(event.detail.status);
        }
      };
      
      // Listen for status updates
      document.addEventListener('statusUpdate', listener);
      
      // Also parse status from serial data
      const serialListener = (event) => {
        if (event.detail && event.detail.data) {
          const data = event.detail.data;
          // Parse GRBL status format
          if (data.startsWith('<') && data.includes('|')) {
            const stateMatch = data.match(/<([^|>]+)/);
            if (stateMatch) {
              const status = {
                state: stateMatch[1],
                connected: true,
                raw: data
              };
              callback(status);
            }
          }
        }
      };
      
      document.addEventListener('serialdata', serialListener);
      
      // Return unsubscribe function
      return () => {
        document.removeEventListener('statusUpdate', listener);
        document.removeEventListener('serialdata', serialListener);
        this.removeSubscription('status', id);
      };
    }
  };

  /**
   * Console API
   */
  console = {
    /**
     * Log a message to the console panel
     * @param {string} message - Message to log
     * @param {string} level - Log level (info, warning, error)
     */
    log: (message, level = 'info') => {
      const event = new CustomEvent('consoleEntry', {
        detail: { 
          type: level, 
          content: `[${this.pluginId}] ${message}` 
        }
      });
      document.dispatchEvent(event);
    },

    /**
     * Log info message
     * @param {string} message - Message to log
     */
    info: (message) => {
      this.console.log(message, 'info');
    },

    /**
     * Log warning message
     * @param {string} message - Message to log
     */
    warn: (message) => {
      this.console.log(message, 'warning');
    },

    /**
     * Log error message
     * @param {string} message - Message to log
     */
    error: (message) => {
      this.console.log(message, 'error');
    }
  };

  /**
   * UI API
   */
  ui = {
    /**
     * Show a notification
     * @param {string} message - Notification message
     * @param {string} type - Notification type (info, success, warning, error)
     */
    showNotification: (message, type = 'info') => {
      // Dispatch notification event
      const event = new CustomEvent('showNotification', {
        detail: { 
          message, 
          type, 
          source: this.pluginId 
        }
      });
      document.dispatchEvent(event);
    },

    /**
     * Request file selection from user
     * @param {Object} options - File selection options
     * @returns {Promise<File>} Selected file
     */
    requestFile: async (options = {}) => {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = options.accept || '*/*';
        
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            resolve(file);
          } else {
            reject(new Error('No file selected'));
          }
        };
        
        input.click();
      });
    }
  };

  /**
   * Storage API
   */
  storage = {
    /**
     * Get value from storage
     * @param {string} key - Storage key
     * @returns {any} Stored value
     */
    get: (key) => {
      const storageKey = `plugin_${this.pluginId}_${key}`;
      try {
        const value = localStorage.getItem(storageKey);
        return value ? JSON.parse(value) : null;
      } catch (error) {
        console.error('Storage get error:', error);
        return null;
      }
    },

    /**
     * Set value in storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     */
    set: (key, value) => {
      const storageKey = `plugin_${this.pluginId}_${key}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify(value));
      } catch (error) {
        console.error('Storage set error:', error);
      }
    },

    /**
     * Remove value from storage
     * @param {string} key - Storage key
     */
    remove: (key) => {
      const storageKey = `plugin_${this.pluginId}_${key}`;
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Storage remove error:', error);
      }
    },

    /**
     * Clear all plugin storage
     */
    clear: () => {
      const prefix = `plugin_${this.pluginId}_`;
      const keys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      
      keys.forEach(key => localStorage.removeItem(key));
    }
  };

  /**
   * Check if plugin has a specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether plugin has permission
   */
  hasPermission(permission) {
    return this.permissions.includes(permission);
  }

  /**
   * Add a subscription
   * @private
   */
  addSubscription(type, callback) {
    const id = Math.random().toString(36).substr(2, 9);
    
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Map());
    }
    
    this.subscriptions.get(type).set(id, callback);
    return id;
  }

  /**
   * Remove a subscription
   * @private
   */
  removeSubscription(type, id) {
    const typeSubscriptions = this.subscriptions.get(type);
    if (typeSubscriptions) {
      typeSubscriptions.delete(id);
    }
  }

  /**
   * Destroy the API instance and clean up
   */
  destroy() {
    this._destroyed = true;
    
    // Clear all subscriptions
    this.subscriptions.clear();
    
    // Clear storage if needed
    // this.storage.clear(); // Uncomment to clear storage on destroy
  }

  /**
   * Check if API is destroyed
   * @returns {boolean} Whether API is destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }
}

export default PluginAPI;