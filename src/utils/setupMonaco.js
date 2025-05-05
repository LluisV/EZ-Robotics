/**
 * Monaco editor environment configuration
 * Sets up worker paths and helps with correct initialization
 */

// Import monaco editor
import * as monaco from 'monaco-editor';

/**
 * Configure the Monaco editor environment
 * This is needed to properly set up workers
 */
export function setupMonacoEnvironment() {
  // Prevent Monaco from creating web workers by providing an alternative implementation
  // This is important because web workers can cause "Canceled" error messages in development
  const workerCallbacks = {};
  let nextWorkerId = 0;
  
  // Create a fake worker environment that doesn't rely on actual Web Workers
  window.MonacoEnvironment = {
    getWorker: function (moduleId, label) {
      const workerId = nextWorkerId++;
      
      // Create a worker class that doesn't actually spawn a thread
      class MonacoFakeWorker {
        constructor() {
          this.listeners = {};
          
          // Store the worker ID for debugging
          this.id = workerId;
          
          // Track promises to help with cleanup
          this._pendingPromises = new Set();
        }
        
        // Add event listener
        addEventListener(type, listener) {
          if (!this.listeners[type]) {
            this.listeners[type] = [];
          }
          this.listeners[type].push(listener);
        }
        
        // Remove event listener  
        removeEventListener(type, listener) {
          if (this.listeners[type]) {
            const index = this.listeners[type].indexOf(listener);
            if (index !== -1) {
              this.listeners[type].splice(index, 1);
            }
          }
        }
        
        // Dispatch events
        _dispatchEvent(type, event) {
          if (this.listeners[type]) {
            this.listeners[type].forEach(listener => {
              try {
                listener(event);
              } catch (e) {
                console.error("Error in worker event listener:", e);
              }
            });
          }
          
          // Handle 'message' events specially
          if (type === 'message' && typeof this.onmessage === 'function') {
            try {
              this.onmessage(event);
            } catch (e) {
              console.error("Error in worker onmessage:", e);
            }
          }
        }
        
        // Post message (simulated)
        postMessage(data) {
          if (workerCallbacks[this.id]) {
            // Execute the callback in a setTimeout to simulate asynchronous behavior
            // This helps avoid stack overflows and makes the behavior more like a real worker
            setTimeout(() => {
              try {
                workerCallbacks[this.id]({
                  data: data,
                  target: this
                });
              } catch (e) {
                console.error("Error in worker message handler:", e);
              }
            }, 0);
          }
        }
        
        // Simulate termination
        terminate() {
          delete workerCallbacks[this.id];
          this.listeners = {};
          this.onmessage = null;
          
          // Mark all pending promises as canceled
          this._pendingPromises.forEach(promise => {
            if (promise.cancel) {
              promise.cancel();
            }
          });
          this._pendingPromises.clear();
        }
      }
      
      // Create a fake worker
      const worker = new MonacoFakeWorker();
      
      // Load the worker script in the main thread
      // This helps avoid problems with CORS and CSP
      const workerScript = {
        'json': 'https://unpkg.com/monaco-editor@0.40.0/min/vs/language/json/json.worker.js',
        'css': 'https://unpkg.com/monaco-editor@0.40.0/min/vs/language/css/css.worker.js',
        'html': 'https://unpkg.com/monaco-editor@0.40.0/min/vs/language/html/html.worker.js',
        'typescript': 'https://unpkg.com/monaco-editor@0.40.0/min/vs/language/typescript/ts.worker.js',
        'javascript': 'https://unpkg.com/monaco-editor@0.40.0/min/vs/language/typescript/ts.worker.js',
        'default': 'https://unpkg.com/monaco-editor@0.40.0/min/vs/editor/editor.worker.js'
      }[label] || 'https://unpkg.com/monaco-editor@0.40.0/min/vs/editor/editor.worker.js';
      
      // Since we can't execute the worker script directly in the main thread,
      // we simulate the behavior by creating a handler for messages sent to the worker
      workerCallbacks[worker.id] = (event) => {
        // Here we would normally execute the worker script's code
        // But since we can't, we manually handle the common operations
        if (event && event.data) {
          if (event.data.type === 'initialize') {
            // Send back a success response
            worker._dispatchEvent('message', {
              data: { type: 'initialized' }
            });
          } else {
            // For other operations, send an empty/error response
            // This means some advanced features won't work, but basic editing will
            worker._dispatchEvent('message', {
              data: { 
                type: event.data.type + 'Response',
                requestId: event.data.requestId,
                error: { message: 'Operation not supported in simulated worker' }
              }
            });
          }
        }
      };
      
      return worker;
    }
  };
}

/**
 * Register the G-code language with Monaco
 */
export function registerGCodeLanguage() {
  // Register G-code language if it doesn't exist
  if (!monaco.languages.getLanguages().some(lang => lang.id === 'gcode')) {
    // Register a new language
    monaco.languages.register({ id: 'gcode' });
    
    // Define language tokens
    monaco.languages.setMonarchTokensProvider('gcode', {
      tokenizer: {
        root: [
          // Comments
          [/;.*$/, 'comment'],
          [/\(.*?\)/, 'comment'],
          
          // G-codes and M-codes
          [/\b(G0|G00|G1|G01|G2|G02|G3|G03|G4|G04|G28|G90|G91|G92)\b/, 'keyword'],
          [/\b(M0|M00|M1|M01|M2|M02|M3|M03|M4|M04|M5|M05|M6|M06|M30)\b/, 'keyword'],
          
          // GRBL specific commands
          [/\$[A-Za-z0-9=]+/, 'type'],
          
          // Parameters (X, Y, Z, etc.)
          [/\b([XYZABCIJKRFESTDPQ])(-?\d+\.?\d*)/, ['variable', 'number']],
          
          // Numbers
          [/\b\d+\.?\d*\b/, 'number'],
          
          // Other tokens
          [/[#<>]/, 'delimiter'],
        ]
      }
    });
    
    // Register a theme
    monaco.editor.defineTheme('gcode-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6', fontStyle: 'bold' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'type', foreground: 'E06C75', fontStyle: 'bold' },
      ],
      colors: {}
    });
  }
}

/**
 * Helper function to dispose of Monaco resources safely
 * @param {Object} editor - Monaco editor instance
 */
export function disposeMonacoEditor(editor) {
  if (editor) {
    try {
      // Cancel any pending operations
      if (editor._lastOperation && typeof editor._lastOperation.cancel === 'function') {
        editor._lastOperation.cancel();
      }
      
      // Get the model associated with the editor
      const model = editor.getModel();
      
      // Remove any markers from the model to avoid delayed updates
      if (model && monaco.editor) {
        monaco.editor.setModelMarkers(model, 'gcode-validation', []);
      }
      
      // Dispose the model first
      if (model) {
        try {
          model.dispose();
        } catch (err) {
          console.warn("Error disposing model:", err);
        }
      }
      
      // Then dispose the editor
      editor.dispose();
    } catch (err) {
      console.warn("Error disposing Monaco editor:", err);
    }
  }
}

/**
 * Initialize Monaco with all required configuration
 */
export function initializeMonaco() {
  setupMonacoEnvironment();
  registerGCodeLanguage();
  
  // Set the default theme
  monaco.editor.setTheme('gcode-theme');
  
  return monaco;
}

export default {
  initializeMonaco,
  setupMonacoEnvironment,
  registerGCodeLanguage,
  disposeMonacoEditor
};