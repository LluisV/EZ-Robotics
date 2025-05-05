import React from 'react';

/**
 * Error boundary specifically designed to catch and suppress Monaco Editor errors
 * This prevents them from bubbling up to React's error overlay
 */
class MonacoErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    
    // Track original console.error
    this.originalConsoleError = console.error;
    
    // Override console.error to suppress Monaco cancellation errors
    console.error = (...args) => {
      // Check if this is a Monaco cancellation error
      const isMonacoError = args.some(arg => 
        typeof arg === 'string' && 
        (arg.includes('Canceled:') || 
         (arg.includes('Uncaught') && arg.includes('Canceled')))
      );
      
      if (isMonacoError) {
        // Don't pass Monaco errors to console
        return;
      }
      
      // Pass other errors through
      this.originalConsoleError.apply(console, args);
    };
  }
  
  static getDerivedStateFromError(error) {
    // Detect if this is a Monaco cancellation error
    if (error && 
        (error.name === 'Canceled' || 
         (error.message && error.message.includes('Canceled')))) {
      // Suppress the error by not updating state
      return null;
    }
    
    // For other errors, update state to trigger the fallback UI
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    // Check if this is a Monaco cancellation error
    if (error && 
        (error.name === 'Canceled' || 
         (error.message && error.message.includes('Canceled')))) {
      // Suppress Monaco cancellation errors
      return;
    }
    
    // For other errors, log them
    console.error("Component error:", error, errorInfo);
  }
  
  componentWillUnmount() {
    // Restore original console.error
    console.error = this.originalConsoleError;
  }
  
  render() {
    if (this.state.hasError) {
      // Render fallback UI for non-Monaco errors
      return <div className="error-boundary">Something went wrong.</div>;
    }
    
    // Render children normally
    return this.props.children;
  }
}

export default MonacoErrorBoundary;