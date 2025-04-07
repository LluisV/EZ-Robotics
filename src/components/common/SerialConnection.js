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
    setError(null);
    try {
      const availablePorts = await communicationService.getAvailablePorts();
      console.log('Available ports:', availablePorts);
      setPorts(availablePorts);
      
      // If we have ports but none selected, select the first one
      if (availablePorts.length > 0 && !selectedPort) {
        setSelectedPort(availablePorts[0].port);
      }
    } catch (err) {
      console.error('Error listing ports:', err);
      setError('Failed to list ports: ' + err.message);
    }
  };
  
  // Connect to selected port
  const connect = async () => {
    if (!selectedPort) {
      setError('No port selected');
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const connected = await communicationService.connect({
        type: 'SERIAL',
        port: selectedPort,
        baudRate: parseInt(baudRate)
      });
      
      if (connected) {
        setIsConnected(true);
        onStatusChange({ connected: true, port: selectedPort });
        
        // Log connection to console
        communicationService.emit('response', { 
          response: `Connected to ${selectedPort} at ${baudRate} baud` 
        });
      } else {
        setError('Failed to connect to port');
        setIsConnected(false);
        onStatusChange({ connected: false, error: 'Failed to connect' });
      }
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message);
      setIsConnected(false);
      onStatusChange({ connected: false, error: err.message });
    } finally {
      setIsConnecting(false);
    }
  };
  
  // Disconnect from port
  const disconnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await communicationService.disconnect();
      setIsConnected(false);
      onStatusChange({ connected: false });
      
      // Log disconnection to console
      communicationService.emit('response', { 
        response: 'Disconnected from serial port' 
      });
    } catch (err) {
      console.error('Disconnection error:', err);
      setError(err.message);
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
          value={selectedPort ? selectedPort.path || selectedPort : ''}
          onChange={(e) => setSelectedPort(e.target.value)}
          disabled={isConnected || isConnecting}
          className="port-select"
        >
          <option value="">Select COM Port</option>
          {ports.map((port, index) => (
            <option key={index} value={port.port || port}>
              {port.displayName || port.port || port}
            </option>
          ))}
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
          onClick={refreshPorts}
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
          disabled={isConnecting || (!selectedPort && !isConnected)}
        >
          {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
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