/**
 * src/hooks/useCommunication.js
 * React hook for communication service
 */
import { useState, useEffect, useCallback } from 'react';
import communicationService from '../services/communication/CommunicationService';
import { ConnectionStatus, ConnectionType, CommonBaudRates } from '../services/communication/CommunicationTypes';

/**
 * Custom hook for using the communication service in React components
 */
const useCommunication = () => {
  // State for ports and connection status
  const [availablePorts, setAvailablePorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState(null);
  const [baudRate, setBaudRate] = useState(115200);
  const [connectionStatus, setConnectionStatus] = useState(ConnectionStatus.DISCONNECTED);
  const [connectionType, setConnectionType] = useState(ConnectionType.SERIAL);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // State for device capabilities and status
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [machineStatus, setMachineStatus] = useState('Unknown');
  
  /**
   * Get available serial ports
   */
  const refreshPorts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const ports = await communicationService.getAvailablePorts();
      setAvailablePorts(ports);
      
      // Set default port if available and none selected
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0].port);
      }
    } catch (err) {
      setError(`Error refreshing ports: ${err.message}`);
      addLogEntry('error', `Error refreshing ports: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPort]);
  
  /**
   * Connect to the selected port or WebSocket URL
   */
  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (connectionType === ConnectionType.SERIAL && !selectedPort) {
        throw new Error('No port selected');
      }
      
      const options = {
        type: connectionType,
        baudRate: baudRate
      };
      
      if (connectionType === ConnectionType.SERIAL) {
        options.port = selectedPort;
      } else {
        // For WebSocket, use the selectedPort as URL
        options.port = selectedPort; 
      }
      
      const connected = await communicationService.connect(options);
      
      if (connected) {
        addLogEntry('info', `Connected to ${connectionType === ConnectionType.SERIAL ? 'port' : 'WebSocket'}: ${selectedPort.toString()}`);
      } else {
        throw new Error('Failed to connect');
      }
    } catch (err) {
      setError(`Connection error: ${err.message}`);
      addLogEntry('error', `Connection error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [connectionType, selectedPort, baudRate]);
  
  /**
   * Disconnect from the device
   */
  const disconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await communicationService.disconnect();
      addLogEntry('info', 'Disconnected from device');
    } catch (err) {
      setError(`Disconnection error: ${err.message}`);
      addLogEntry('error', `Disconnection error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Send a G-code command to the device
   */
  const sendCommand = useCallback(async (command, options = {}) => {
    setError(null);
    
    try {
      if (connectionStatus !== ConnectionStatus.CONNECTED) {
        throw new Error('Not connected to a device');
      }
      
      addLogEntry('command', `> ${command}`);
      const response = await communicationService.sendCommand(command, options);
      
      if (response && options.expectResponse !== false) {
        addLogEntry('response', response);
      }
      
      return response;
    } catch (err) {
      setError(`Command error: ${err.message}`);
      addLogEntry('error', `Command error: ${err.message}`);
      throw err;
    }
  }, [connectionStatus]);
  
  /**
   * Send a special command like STOP or HOME
   */
  const sendSpecialCommand = useCallback(async (commandType) => {
    setError(null);
    
    try {
      if (connectionStatus !== ConnectionStatus.CONNECTED) {
        throw new Error('Not connected to a device');
      }
      
      addLogEntry('command', `> [${commandType}]`);
      const response = await communicationService.sendSpecialCommand(commandType);
      
      if (response) {
        addLogEntry('response', response);
      }
      
      return response;
    } catch (err) {
      setError(`Command error: ${err.message}`);
      addLogEntry('error', `Error sending ${commandType}: ${err.message}`);
      throw err;
    }
  }, [connectionStatus]);
  
  /**
   * Send a movement command (G0/G1)
   */
  const sendMovementCommand = useCallback(async (axis, direction, distance, feedrate) => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to a device');
      return;
    }
    
    try {
      // Create G-code command for movement
      // Use G0 for rapid movement or G1 for controlled movement
      const gcode = `G1 ${axis}${direction * distance} F${feedrate}`;
      addLogEntry('command', `> ${gcode} (Move ${axis} ${direction > 0 ? '+' : '-'}${distance})`);
      
      return await communicationService.sendCommand(gcode);
    } catch (err) {
      setError(`Movement error: ${err.message}`);
      addLogEntry('error', `Movement error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Home all axes or specific axis
   */
  const homeAxes = useCallback(async (axes = 'all') => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to a device');
      return;
    }
    
    try {
      let gcode = '';
      
      if (axes === 'all') {
        gcode = 'G28';
        addLogEntry('command', '> G28 (Home all axes)');
      } else {
        // Format: G28 X Y Z for specific axes
        gcode = `G28 ${axes}`;
        addLogEntry('command', `> ${gcode} (Home axes: ${axes})`);
      }
      
      return await communicationService.sendCommand(gcode);
    } catch (err) {
      setError(`Homing error: ${err.message}`);
      addLogEntry('error', `Homing error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Get current position
   */
  const getPosition = useCallback(async () => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to a device');
      return;
    }
    
    try {
      addLogEntry('command', '> ?POS (Get position)');
      const response = await communicationService.sendCommand('?POS', { immediate: true });
      
      // Parse position information from response
      // Format varies by firmware, this is just one example:
      // Position: X:100.000 Y:50.000 Z:10.000
      const posRegex = /X:(-?\d+\.?\d*)\s+Y:(-?\d+\.?\d*)\s+Z:(-?\d+\.?\d*)/i;
      const match = response.match(posRegex);
      
      if (match) {
        const position = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3]),
        };
        
        // Update position state
        setMachinePosition(position);
        return position;
      }
      
      return null;
    } catch (err) {
      setError(`Position query error: ${err.message}`);
      addLogEntry('error', `Position query error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Get machine status
   */
  const getMachineStatus = useCallback(async () => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to a device');
      return;
    }
    
    try {
      addLogEntry('command', '> ?STATUS (Get status)');
      const response = await communicationService.sendCommand('?STATUS', { immediate: true });
      
      // Parse status information from response
      // Format varies by firmware, this is just one example:
      // Status: IDLE | Absolute mode: ON
      const statusRegex = /Status:\s*(\w+)/i;
      const match = response.match(statusRegex);
      
      if (match) {
        const status = match[1];
        setMachineStatus(status);
        return status;
      }
      
      return null;
    } catch (err) {
      setError(`Status query error: ${err.message}`);
      addLogEntry('error', `Status query error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Add a log entry
   */
  const addLogEntry = useCallback((type, message) => {
    const entry = {
      type,
      message,
      timestamp: new Date().toISOString()
    };
    
    setLogs(prevLogs => [...prevLogs, entry]);
  }, []);
  
  /**
   * Clear log entries
   */
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);
  
  // Set up event listeners for the communication service
  useEffect(() => {
    // Handle connection status changes
    const handleConnection = (data) => {
      setConnectionStatus(data.status);
      
      if (data.error) {
        setError(data.error);
      }
    };
    
    // Handle received commands
    const handleCommand = (data) => {
      if (data.sent) {
        // This event is for logging purposes and we already log when sending commands
        return;
      }
      
      // This would be for commands received from other sources
      addLogEntry('command', `> ${data.command}`);
    };
    
    // Handle responses from the device
    const handleResponse = (data) => {
      addLogEntry('response', data.response);
      
      // Try to parse position from response
      const posRegex = /X:(-?\d+\.?\d*)\s+Y:(-?\d+\.?\d*)\s+Z:(-?\d+\.?\d*)/i;
      const posMatch = data.response.match(posRegex);
      
      if (posMatch) {
        setMachinePosition({
          x: parseFloat(posMatch[1]),
          y: parseFloat(posMatch[2]),
          z: parseFloat(posMatch[3]),
        });
      }
      
      // Try to parse status from response
      const statusRegex = /Status:\s*(\w+)/i;
      const statusMatch = data.response.match(statusRegex);
      
      if (statusMatch) {
        setMachineStatus(statusMatch[1]);
      }
    };
    
    // Handle errors
    const handleError = (data) => {
      setError(data.error?.message || 'Unknown error');
      addLogEntry('error', data.error?.message || 'Unknown error');
    };
    
    // Register event listeners
    communicationService.on('connection', handleConnection);
    communicationService.on('command', handleCommand);
    communicationService.on('response', handleResponse);
    communicationService.on('error', handleError);
    
    // Get initial connection status
    const info = communicationService.getConnectionInfo();
    setConnectionStatus(info.status);
    setConnectionType(info.type || ConnectionType.SERIAL);
    
    // Clean up listeners on unmount
    return () => {
      communicationService.removeListener('connection', handleConnection);
      communicationService.removeListener('command', handleCommand);
      communicationService.removeListener('response', handleResponse);
      communicationService.removeListener('error', handleError);
    };
  }, []);
  
  // Initial port refresh
  useEffect(() => {
    if (connectionType === ConnectionType.SERIAL) {
      refreshPorts();
    }
  }, [refreshPorts, connectionType]);
  
  return {
    // Connection management
    connectionStatus,
    connectionType,
    setConnectionType,
    availablePorts,
    selectedPort,
    setSelectedPort,
    baudRate,
    setBaudRate,
    commonBaudRates: CommonBaudRates,
    refreshPorts,
    connect,
    disconnect,
    isLoading,
    error,
    
    // Command functions
    sendCommand,
    sendSpecialCommand,
    sendMovementCommand,
    homeAxes,
    getPosition,
    getMachineStatus,
    
    // Machine state
    machinePosition,
    machineStatus,
    
    // Logging
    logs,
    addLogEntry,
    clearLogs
  };
};

export default useCommunication;