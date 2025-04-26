import React, { useState, useEffect } from 'react';
import SerialConnection from './SerialConnection';

/**
 * Application header component with added serial connection UI and machine state indicator
 */
const Header = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    port: null,
    error: null
  });
  const [machineState, setMachineState] = useState('Unknown');

  const handleConnectionStatusChange = (status) => {
    setConnectionStatus(status);
    
    // Dispatch a global event when connection status changes
    const event = new CustomEvent('serialconnection', { 
      detail: { connected: status.connected, port: status.port } 
    });
    document.dispatchEvent(event);
  };

  // Listen for machine state updates from serial data
  useEffect(() => {
    const handleSerialData = (event) => {
      const data = event.detail;
      
      if (data && data.type === 'response' && data.data) {
        // Check if this is a status message in GRBL format: <status|MPos:x,y,z|...>
        if (data.data.startsWith('<') && data.data.includes('|')) {
          try {
            // Parse machine status
            const statusMatch = data.data.match(/<([^|]+)\|/);
            if (statusMatch) {
              const status = statusMatch[1].trim();
              setMachineState(status);
            }
          } catch (error) {
            console.error("Error parsing machine state:", error);
          }
        }
      }
    };
    
    // Listen for serial data events
    document.addEventListener('serialdata', handleSerialData);
    
    return () => {
      document.removeEventListener('serialdata', handleSerialData);
    };
  }, []);

  // Function to determine color for machine state
  const getMachineStateColor = (state) => {
    const stateUpper = state.toUpperCase();
    
    switch (stateUpper) {
      case 'IDLE':
        return 'var(--status-online)'; // Green
      case 'RUN':
        return 'var(--accent-blue)'; // Blue
      case 'HOLD':
        return 'var(--accent-orange)'; // Orange
      case 'JOG':
        return 'var(--accent-purple)'; // Purple
      case 'ALARM':
        return 'var(--status-offline)'; // Red
      case 'DOOR':
      case 'CHECK':
      case 'HOME':
        return 'var(--accent-orange)'; // Orange
      case 'SLEEP':
        return '#999999'; // Gray
      default:
        return '#999999'; // Gray for unknown states
    }
  };

  return (
    <header>
      <div className="logo-container">
        <h1 className="app-title">Robot Control UI</h1>
        <span className="app-version">v0.1.0</span>
      </div>
      
      <div className="header-controls">
        {children}
        
        <SerialConnection onConnectionChange={handleConnectionStatusChange} />
        
        {/* Connection Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            className={`status-indicator ${connectionStatus.connected ? 'status-online' : 'status-offline'}`}
          ></span>
          <span>{connectionStatus.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        
        {/* Machine State Indicator - Only show when connected */}
        {connectionStatus.connected && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginLeft: '12px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            padding: '4px 10px',
            borderRadius: '4px',
            gap: '8px'
          }}>
            <span style={{ 
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: getMachineStateColor(machineState),
              boxShadow: `0 0 5px ${getMachineStateColor(machineState)}`,
              animation: machineState.toUpperCase() === 'ALARM' ? 'pulse 1.5s infinite' : 'none'
            }}></span>
            <span style={{ 
              fontWeight: '500',
              textTransform: 'uppercase',
              fontSize: '12px'
            }}>
              {machineState}
            </span>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;