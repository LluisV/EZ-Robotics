import React, { useState } from 'react';

/**
 * Application header component with added serial connection UI
 */
const Header = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    port: null,
    error: null
  });

  const handleConnectionStatusChange = (status) => {
    setConnectionStatus(status);
  };

  return (
    <header>
      <div className="logo-container">
        <h1 className="app-title">Robot Control UI</h1>
        <span className="app-version">v0.1.0</span>
      </div>
      
      <div className="header-controls">
        {children}
                
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span 
            className={`status-indicator ${connectionStatus.connected ? 'status-online' : 'status-offline'}`}
          ></span>
          <span>{connectionStatus.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
    </header>
  );
};

export default Header;