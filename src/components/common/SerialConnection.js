import React, { useState, useEffect, useCallback } from 'react';
import serialService from '../../services/SerialCommunicationService';

/**
 * Serial Connection component for connecting to FluidNC robots
 */
const SerialConnection = ({ onConnectionChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState(115200); // Default baud rate for FluidNC
  const [error, setError] = useState(null);
  
  // Handle serial connection events
  const handleConnectionChange = useCallback((connected, port = null, error = null) => {
    setIsConnected(connected);
    if (onConnectionChange) {
      onConnectionChange({
        connected,
        port,
        error
      });
    }
    
    if (error) {
      setError(error.message || "Unknown error");
    } else {
      setError(null);
    }
  }, [onConnectionChange]);
  
  // Function to connect to the serial port
  const connectToSerialPort = async () => {
    try {
      // Check if the browser supports the Serial API
      if (!serialService.isSupported()) {
        throw new Error("WebSerial API not supported in this browser. Use Chrome or Edge.");
      }
      
      const success = await serialService.connect(baudRate);
        if (success) {
        handleConnectionChange(true, serialService.getPortInfo());
        
        // Send an initial status request to get position data
        setTimeout(() => {
            serialService.send('?');
        }, 100);
        }
    } catch (error) {
      console.error("Serial connection error:", error);
      handleConnectionChange(false, null, error);
    }
  };
  
  // Function to disconnect
  const disconnectFromSerialPort = async () => {
    try {
      await serialService.disconnect();
      handleConnectionChange(false);
    } catch (error) {
      console.error("Error disconnecting:", error);
      handleConnectionChange(false, null, error);
    }
  };

  // Setup event listeners for the serial service
  useEffect(() => {
    const removeListener = serialService.addListener((event, data) => {
      switch (event) {
        case 'connect':
          setIsConnected(true);
          setError(null);
          break;
        case 'disconnect':
          setIsConnected(false);
          setError(null);
          break;
        case 'error':
          if (data.error) {
            setError(data.error.message || "Unknown error");
          }
          break;
        case 'data':
          // Handle incoming data from serial port
          if (data.data) {
            // Dispatch a custom event with the received data
            const event = new CustomEvent('serialdata', { detail: { type: 'response', data: data.data } });
            document.dispatchEvent(event);
          }
          break;
        default:
          break;
      }
    });
    
    // Make the sendData function available globally
    window.sendSerialData = serialService.send;
    
    // Check initial connection state
    setIsConnected(serialService.getConnectionStatus());
    
    return () => {
      removeListener();
    };
  }, []);

  // Render component
  return (
    <div className="serial-connection">
      <div className="connection-controls">
        <select
          className="baud-select"
          value={baudRate}
          onChange={(e) => setBaudRate(e.target.value)}
          disabled={isConnected}
        >
          <option value="9600">9600</option>
          <option value="19200">19200</option>
          <option value="38400">38400</option>
          <option value="57600">57600</option>
          <option value="115200">115200</option>
          <option value="230400">230400</option>
          <option value="250000">250000</option>
          <option value="500000">500000</option>
          <option value="921600">921600</option>
        </select>
        
        {!isConnected ? (
          <button 
            className="toolbar-button primary"
            onClick={connectToSerialPort}
            title="Connect to FluidNC via Serial"
          >
            Connect
          </button>
        ) : (
          <button 
            className="toolbar-button danger"
            onClick={disconnectFromSerialPort}
            title="Disconnect from Serial"
          >
            Disconnect
          </button>
        )}
      </div>
      
      {error && (
        <div className="connection-error" title={error}>
          {error}
        </div>
      )}
    </div>
  );
};

export default SerialConnection;