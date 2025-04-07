import React, { useState, useEffect } from 'react';
import communicationService from '../../services/communication/CommunicationService';

/**
 * Serial Connection component for the header
 * Allows users to select and connect to COM ports
 */
const SerialConnection = ({ onStatusChange = () => {} }) => {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [baudRate, setBaudRate] = useState(115200);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  // Common baud rates for serial connections
  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 250000];
  
  // Refresh available ports
  const refreshPorts = async () => {
    try {
      const availablePorts = await communicationService.getAvailablePorts();
      
      // Enhanced port naming with more information
      const formattedPorts = availablePorts.map((port, index) => ({
        ...port,
        displayName: port.path || `Serial Device COM${index + 1}`,
        id: port.path || `port-${index + 1}`
      }));
      
      console.log('Available ports:', formattedPorts);
      communicationService.emit('response', { 
        response: `Found ${formattedPorts.length} available port(s)` 
      });
      
      setPorts(formattedPorts);
      
      // If we have ports but none selected, select the first one
      if (formattedPorts.length > 0 && !selectedPort) {
        setSelectedPort(formattedPorts[0].id);
      }
    } catch (err) {
      const errorMsg = `Failed to list ports: ${err.message}`;
      console.error(errorMsg);
      communicationService.emit('error', { error: errorMsg });
    }
  };

  // Request new ports from user
  const requestNewPorts = async () => {
    try {
      const availablePorts = await communicationService.requestPorts();
      
      // Enhanced port naming with more information
      const formattedPorts = availablePorts.map((port, index) => ({
        ...port,
        displayName: port.displayName || `Serial Device COM${index + 1}`,
        id: port.path || `port-${index + 1}`
      }));
      
      console.log('Newly requested ports:', formattedPorts);
      communicationService.emit('response', { 
        response: `Requested ${formattedPorts.length} new port(s)` 
      });
      
      setPorts(formattedPorts);
      
      // If we have ports but none selected, select the first one
      if (formattedPorts.length > 0 && !selectedPort) {
        setSelectedPort(formattedPorts[0].id);
      }
    } catch (err) {
      const errorMsg = `Failed to request ports: ${err.message}`;
      console.error(errorMsg);
      communicationService.emit('error', { error: errorMsg });
    }
  };
  
  // Connect to selected port
  const connect = async () => {
    // Find the full port details based on the selected port ID
    const portDetails = ports.find(p => p.id === selectedPort);
    
    if (!portDetails) {
      const errorMsg = 'No valid port selected';
      console.error(errorMsg);
      communicationService.emit('error', { error: errorMsg });
      return;
    }
    
    setIsConnecting(true);

    try {
      const connected = await communicationService.connect({
        type: 'SERIAL',
        port: portDetails.path || portDetails.port,
        baudRate: parseInt(baudRate)
      });
      
      if (connected) {
        setIsConnected(true);
        onStatusChange({ 
          connected: true, 
          port: portDetails.displayName || portDetails.path 
        });
        
        // Log connection to console and communication service
        const connectionMsg = `Connected to ${portDetails.displayName || portDetails.path} at ${baudRate} baud`;
        console.log(connectionMsg);
        communicationService.emit('response', { response: connectionMsg });
      } else {
        // Get more detailed error information from the communication service
        const connectionInfo = communicationService.getConnectionInfo();
        const detailedError = connectionInfo.error || 'Unknown connection error';
        
        const errorMsg = `Failed to connect: ${detailedError}`;
        console.error(errorMsg);
        communicationService.emit('error', { error: errorMsg });
        
        setIsConnected(false);
        onStatusChange({ 
          connected: false, 
          error: detailedError 
        });
      }
    } catch (err) {
      // Ensure we always have a string error message
      const errorMessage = err 
        ? (err.message || err.toString() || 'Unexpected connection error') 
        : 'Undefined connection error';
      
      console.error('Connection error:', errorMessage);
      communicationService.emit('error', { error: errorMessage });
      
      setIsConnected(false);
      onStatusChange({ 
        connected: false, 
        error: errorMessage 
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Disconnect from port
  const disconnect = async () => {
    setIsConnecting(true);
    
    try {
      await communicationService.disconnect();
      setIsConnected(false);
      onStatusChange({ connected: false });
      
      // Log disconnection to console and communication service
      const disconnectMsg = 'Disconnected from serial port';
      console.log(disconnectMsg);
      communicationService.emit('response', { response: disconnectMsg });
    } catch (err) {
      const errorMsg = `Disconnection error: ${err.message}`;
      console.error(errorMsg);
      communicationService.emit('error', { error: errorMsg });
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Setup event listeners for the communication service
  useEffect(() => {
    const handleConnection = (data) => {
      setIsConnected(data.status === 'CONNECTED');
      
      if (data.error) {
        setError(data.error);
      }
    };
    
    communicationService.on('connection', handleConnection);
    
    // Get initial status
    const info = communicationService.getConnectionInfo();
    setIsConnected(info.status === 'CONNECTED');
    
    // Initial port refresh
    refreshPorts();
    
    // Cleanup
    return () => {
      communicationService.removeListener('connection', handleConnection);
    };
  }, []);
  
  return (
    <div className="serial-connection">
      <div className="connection-controls">
        <select 
          value={selectedPort}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={isConnected || isConnecting}
          className="port-select"
        >
          {ports.length > 0 
            ? ports.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.displayName || 'Serial Device'}
                </option>
              ))
            : <option value="">No ports available</option>
          }
        </select>
        
        <select 
          value={baudRate}
          onChange={(e) => setBaudRate(e.target.value)}
          disabled={isConnected || isConnecting}
          className="baud-select"
        >
          {baudRates.map(rate => (
            <option key={rate} value={rate}>{rate}</option>
          ))}
        </select>
        
        <button 
          className={`toolbar-button ${isConnecting ? 'disabled' : ''} ${!isConnected ? 'primary' : ''}`}
          onClick={requestNewPorts}
          disabled={isConnecting}
          title="Refresh port list"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
        </button>
        
        <button 
          className={`toolbar-button ${isConnecting ? 'disabled' : ''} ${isConnected ? 'danger' : 'primary'}`}
          onClick={isConnected ? disconnect : connect}
          disabled={isConnecting || (ports.length === 0)}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
      
      {/* Errors are now logged to the console */}
    </div>
  );
};

export default SerialConnection;