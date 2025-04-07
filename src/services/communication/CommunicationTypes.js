/**
 * src/services/communication/CommunicationTypes.js
 * Types and constants for the communication service
 */

/**
 * Connection types
 * @enum {string}
 */
export const ConnectionType = {
    SERIAL: 'serial',
    WEBSOCKET: 'websocket'
  };
  
  /**
   * Connection status
   * @enum {string}
   */
  export const ConnectionStatus = {
    DISCONNECTED: 'disconnected',
    CONNECTED: 'connected',
    CONNECTING: 'connecting',
    ERROR: 'error'
  };
  
  /**
   * Command types for special commands
   * @enum {string}
   */
  export const CommandType = {
    STOP: 'STOP',
    HOME: 'HOME',
    GET_POSITION: 'GET_POSITION',
    GET_STATUS: 'GET_STATUS'
  };
  
  /**
   * Robot status values
   * @enum {string}
   */
  export const RobotStatus = {
    IDLE: 'IDLE',
    MOVING: 'MOVING',
    HOMING: 'HOMING',
    ERROR: 'ERROR'
  };
  
  /**
   * Default list of common baud rates
   * @type {number[]}
   */
  export const CommonBaudRates = [
    9600,
    19200,
    38400,
    57600,
    115200,
    230400,
    250000, // Common for 3D printers
    500000,
    921600
  ];