// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { setupMonacoEnvironment, setupMonacoErrorHandler } from './utils/setupMonaco';

// Initialize Monaco error handler first before anything else
setupMonacoErrorHandler();

// Then initialize Monaco environment before rendering the app
setupMonacoEnvironment();

// Disable React error overlay for Monaco cancellation errors in development
if (process.env.NODE_ENV === 'development') {
  // Store original error event listener
  const originalErrorEventListener = window.addEventListener;
  
  // Override addEventListener to intercept error events
  window.addEventListener = function(event, callback, options) {
    if (event === 'error') {
      const wrappedCallback = function(e) {
        // Check if this is a Monaco cancellation error
        if (e && e.error && e.error.name === 'Canceled' && e.error.message === 'Canceled') {
          // Prevent the error from propagating
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Otherwise call the original callback
        return callback(e);
      };
      // Call original addEventListener with wrapped callback
      return originalErrorEventListener.call(this, event, wrappedCallback, options);
    }
    // For non-error events, call original addEventListener
    return originalErrorEventListener.call(this, event, callback, options);
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);