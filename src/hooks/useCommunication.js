/**
 * src/hooks/useCommunication.js
 * React hook for FluidNC communication service
 */
import { useState, useEffect, useCallback } from 'react';
import communicationService from '../services/communication/CommunicationService';
import { ConnectionStatus, ConnectionType, CommonBaudRates } from '../services/communication/CommunicationTypes';

/**
 * Custom hook for using the FluidNC communication service in React components
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
  const [workPosition, setWorkPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [machineStatus, setMachineStatus] = useState('Unknown');
  const [feedRate, setFeedRate] = useState(0);
  
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
      
      addLogEntry('info', `Refreshed ports: ${ports.length} found`);
    } catch (err) {
      const errorMsg = `Error refreshing ports: ${err.message}`;
      setError(errorMsg);
      addLogEntry('error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPort]);
  
  /**
   * Connect to FluidNC device
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
   * Request port selection from the user (using Web Serial API)
   */
  const requestPorts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const ports = await communicationService.requestPorts();
      setAvailablePorts(ports);
      
      // Set default port if available and none selected
      if (ports.length > 0 && !selectedPort) {
        setSelectedPort(ports[0].port);
      }
      
      addLogEntry('info', `Requested ports: ${ports.length} found`);
    } catch (err) {
      const errorMsg = `Error requesting ports: ${err.message}`;
      setError(errorMsg);
      addLogEntry('error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPort]);
  
  /**
   * Disconnect from FluidNC device
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
   * Send a G-code command to FluidNC
   */
  const sendCommand = useCallback(async (command, options = {}) => {
    setError(null);
    
    try {
      if (connectionStatus !== ConnectionStatus.CONNECTED) {
        throw new Error('Not connected to FluidNC');
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
   * Send a special command to FluidNC (STOP, FEEDHOLD, RESUME, etc.)
   */
  const sendSpecialCommand = useCallback(async (commandType) => {
    setError(null);
    
    try {
      if (connectionStatus !== ConnectionStatus.CONNECTED) {
        throw new Error('Not connected to FluidNC');
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
   * Send a movement command (jog) to FluidNC
   */
  const sendMovementCommand = useCallback(async (axis, direction, distance, feedrate) => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to FluidNC');
      return;
    }
    
    try {
      // Create FluidNC jog command - FluidNC uses $J= for jogging
      const jog = `$J=${axis}${direction > 0 ? '+' : ''}${distance} F${feedrate}`;
      addLogEntry('command', `> ${jog} (Jog ${axis} ${direction > 0 ? '+' : '-'}${distance})`);
      
      return await communicationService.sendCommand(jog);
    } catch (err) {
      setError(`Movement error: ${err.message}`);
      addLogEntry('error', `Movement error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Home specific axes or all axes with FluidNC
   */
  const homeAxes = useCallback(async (axes = 'all') => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to FluidNC');
      return;
    }
    
    try {
      let command = '';
      
      // FluidNC uses $H for homing
      if (axes === 'all') {
        command = '$H';
        addLogEntry('command', '> $H (Home all axes)');
      } else {
        // FluidNC can home specific axes with $H<axis>
        command = `$H${axes.toUpperCase()}`; 
        addLogEntry('command', `> ${command} (Home ${axes} axes)`);
      }
      
      return await communicationService.sendCommand(command);
    } catch (err) {
      setError(`Homing error: ${err.message}`);
      addLogEntry('error', `Homing error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Get current machine position
   */
  const getPosition = useCallback(async () => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to FluidNC');
      return;
    }
    
    try {
      // FluidNC uses ? command to get status including position
      addLogEntry('command', '> ? (Get status/position)');
      await communicationService.sendSpecialCommand('GET_POSITION');
      
      // The actual position will be updated through the event handler
      return {
        machine: machinePosition,
        work: workPosition
      };
    } catch (err) {
      setError(`Position query error: ${err.message}`);
      addLogEntry('error', `Position query error: ${err.message}`);
    }
  }, [connectionStatus, machinePosition, workPosition]);
  
  /**
   * Get machine status from FluidNC
   */
  const getMachineStatus = useCallback(async () => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to FluidNC');
      return;
    }
    
    try {
      // FluidNC uses ? command to get status
      addLogEntry('command', '> ? (Get status)');
      await communicationService.sendSpecialCommand('GET_POSITION');
      
      // The actual status will be updated through the event handler
      return machineStatus;
    } catch (err) {
      setError(`Status query error: ${err.message}`);
      addLogEntry('error', `Status query error: ${err.message}`);
    }
  }, [connectionStatus, machineStatus]);
  
  /**
   * Send a feedhold command to pause the machine
   */
  const pauseMachine = useCallback(async () => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to FluidNC');
      return;
    }
    
    try {
      addLogEntry('command', '> ! (Feedhold/pause)');
      await communicationService.sendSpecialCommand('FEEDHOLD');
      return true;
    } catch (err) {
      setError(`Pause error: ${err.message}`);
      addLogEntry('error', `Pause error: ${err.message}`);
    }
  }, [connectionStatus]);
  
  /**
   * Send a resume command to continue after a feedhold
   */
  const resumeMachine = useCallback(async () => {
    if (connectionStatus !== ConnectionStatus.CONNECTED) {
      setError('Not connected to FluidNC');
      return;
    }
    
    try {
      addLogEntry('command', '> ~ (Resume)');
      await communicationService.sendSpecialCommand('RESUME');
      return true;
    } catch (err) {
      setError(`Resume error: ${err.message}`);
      addLogEntry('error', `Resume error: ${err.message}`);
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
    
    // Handle responses from FluidNC
    const handleResponse = (data) => {
      if (!data.response || data.response.startsWith('[TELEMETRY]')) {
        // Skip telemetry responses as they're handled separately
        return;
      }
      
      addLogEntry('response', data.response);
    };
    
    // Handle FluidNC status updates
    const handleFluidNCStatus = (status) => {
      setMachineStatus(status.state);
      setMachinePosition(status.machinePosition);
      setWorkPosition(status.workPosition);
      setFeedRate(status.feedRate);
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
    communicationService.on('fluidnc-status', handleFluidNCStatus);
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
      communicationService.removeListener('fluidnc-status', handleFluidNCStatus);
      communicationService.removeListener('error', handleError);
    };
  }, []);
  
  // Initial port refresh
  useEffect(() => {
    if (connectionType === ConnectionType.SERIAL) {
      refreshPorts();
    }
  }, [refreshPorts, connectionType]);
  
  // Set up a regular status update request
  useEffect(() => {
    let statusInterval;
    
    if (connectionStatus === ConnectionStatus.CONNECTED) {
      // Request status every 250ms (FluidNC will throttle if needed)
      statusInterval = setInterval(() => {
        communicationService.sendSpecialCommand('GET_POSITION').catch(() => {
          // Ignore errors in background polling
        });
      }, 250);
    }
    
    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [connectionStatus]);
  
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
    requestPorts,
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
    pauseMachine,
    resumeMachine,
    
    // Machine state
    machinePosition,
    workPosition,
    machineStatus,
    feedRate,
    
    // Logging
    logs,
    addLogEntry,
    clearLogs
  };
};

export default useCommunication;