import React from 'react';

/**
 * Application footer component
 */
const Footer = () => {
  return (
    <footer>
      <div className="footer-status">
        <span>Status: <span style={{ color: 'var(--status-offline)' }}>Disconnected</span></span>
        <span>Position: X:0.00 Y:0.00 Z:0.00</span>
      </div>
      
      <div className="footer-info">
        <span>Memory: 24MB</span>
        <span className="footer-divider">|</span>
        <span>Plugins: 3 Available</span>
        <span className="footer-divider">|</span>
        <span>© 2025 Robot Control UI</span>
      </div>
    </footer>
  );
};

export default Footer;