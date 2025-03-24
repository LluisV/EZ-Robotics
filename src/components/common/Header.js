import React from 'react';

/**
 * Application header component
 */
const Header = ({ children }) => {
  return (
    <header>
      <div className="logo-container">
        <h1 className="app-title">Robot Control UI</h1>
        <span className="app-version">v0.1.0</span>
      </div>
      
      <div className="header-controls">
        {children}
        
        <select className="toolbar-select">
          <option value="">Select Robot</option>
          <option value="robot1">3D Printer</option>
          <option value="robot2">CNC Machine</option>
          <option value="robot3">Robot Arm</option>
        </select>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="status-indicator status-offline"></span>
          <span>Disconnected</span>
        </div>
        
        <button className="primary">
          Connect
        </button>
      </div>
    </header>
  );
};

export default Header;