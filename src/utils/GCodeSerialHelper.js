/**
 * Helper class to interface between SerialCommunicationService and GCodeSender
 * Specifically handles the event dispatching for received data
 */
class GCodeSerialHelper {
    constructor() {
      this.serialService = null;
      this.removeListenerFunction = null;
      this.initialized = false;
    }
  
    /**
     * Initialize the helper with the serial service
     * @param {Object} serialService - The serial service to use
     */
    initialize(serialService) {
      if (this.initialized) {
        // Clean up previous initialization if exists
        this.cleanup();
      }
      
      this.serialService = serialService;
      
      // Set up response listener
      const responseListener = (event, data) => {
        // Only process 'data' events
        if (event !== 'data') {
          return;
        }
        
        // Create and dispatch a custom event for the GCodeSender
        const serialDataEvent = new CustomEvent('serialdata', {
          detail: data
        });
        
        document.dispatchEvent(serialDataEvent);
      };
      
      // Add the listener to the serial service
      // SerialCommunicationService.addListener returns a function to remove the listener
      this.removeListenerFunction = this.serialService.addListener(responseListener);
      this.initialized = true;
    }
  
    /**
     * Clean up the helper
     */
    cleanup() {
      if (!this.initialized) {
        return;
      }
      
      // Remove the listener from the serial service using the function returned by addListener
      if (this.removeListenerFunction && typeof this.removeListenerFunction === 'function') {
        this.removeListenerFunction();
        this.removeListenerFunction = null;
      }
      
      this.serialService = null;
      this.initialized = false;
    }
  }
  
  // Create and export a singleton instance
  const gCodeSerialHelper = new GCodeSerialHelper();
  export default gCodeSerialHelper;