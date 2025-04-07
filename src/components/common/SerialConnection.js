import React, { useState, useEffect } from 'react';
import communicationService from '../../services/communication/CommunicationService';
import { ConnectionStatus, ConnectionType } from '../../services/communication/CommunicationTypes';

/**
 * Simplified Serial Connection component for the header
 * Allows users to directly request and connect to a COM port
 */
const SerialConnection = ({ onStatusChange = () => {} }) => {
  const [baudRate, setBaudRate] = useState(115200);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  // Common baud rates for serial connections
  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 250000];
  
  // Request a new port and connect to it
  const requestAndConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // First, request available ports
      const availablePorts = await communicationService.requestPorts();
      
      // If no ports are found, show an error
      if (availablePorts.length === 0) {
        throw new Error('No ports available. Please connect a device.');
      }
      
      // Take the first available port
      const selectedPort = availablePorts[0];
      
      // Attempt to connect to the port
      const connected = await communicationService.connect({
        type: ConnectionType.SERIAL,
        port: selectedPort.path || selectedPort.port,
        baudRate: parseInt(baudRate)
      });
      
      if (connected) {
        setIsConnected(true);
        onStatusChange({ 
          connected: true, 
          port: selectedPort.displayName || selectedPort.path 
        });
        
        // Log connection to console and communication service
        const connectionMsg = `Connected to ${selectedPort.displayName || selectedPort.path} at ${baudRate} baud`;
        console.log(connectionMsg);
        communicationService.emit('response', { response: connectionMsg });
      } else {
        // Get more detailed error information
        const connectionInfo = communicationService.getConnectionInfo();
        const detailedError = connectionInfo.error || 'Failed to connect';
        
        throw new Error(detailedError);
      }
    } catch (err) {
      const errorMessage = err.message || 'Connection error';
      
      console.error('Connection error:', errorMessage);
      
      setIsConnected(false);
      setError(errorMessage);
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
    
    // Cleanup
    return () => {
      communicationService.removeListener('connection', handleConnection);
    };
  }, []);
  
  return (
    <div className="serial-connection">
      <div className="connection-controls">
        <select 
          value={baudRate}
          onChange={(e) => setBaudRate(parseInt(e.target.value))}
          disabled={isConnected || isConnecting}
          className="baud-select"
        >
          {baudRates.map(rate => (
            <option key={rate} value={rate}>{rate}</option>
          ))}
        </select>
        
        <button 
          className={`toolbar-button ${isConnecting ? 'disabled' : ''} ${!isConnected ? 'primary' : ''}`}
          onClick={!isConnected ? requestAndConnect : disconnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect to Port'}
        </button>
      </div>
      
      {error && (
        <div className="connection-error">
          {error}
        </div>
      )}
    </div>
  );
};

export default SerialConnection;