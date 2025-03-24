import React, { useState } from 'react';

/**
 * Control Panel component for robot positioning and control.
 * 
 * @param {Object} props Component properties
 * @param {boolean} props.showAdvanced Whether to show advanced controls
 */
const ControlPanel = ({ showAdvanced = false }) => {
  const [speed, setSpeed] = useState(50);
  const [stepSize, setStepSize] = useState(1.0);
  
  return (
    <div className="panel-content">
      <div className="panel-header">
        <div className="panel-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
          Robot Control
        </div>
      </div>
      
      <div>
        <h4>Position Controls</h4>
        <div className="control-grid">
          <div></div>
          <button className="control-btn">Y+</button>
          <div></div>
          <button className="control-btn">X-</button>
          <button className="control-btn">Home</button>
          <button className="control-btn">X+</button>
          <div></div>
          <button className="control-btn">Y-</button>
          <div></div>
        </div>
        
        <div className="control-grid" style={{ marginTop: '10px' }}>
          <button className="control-btn">Z+</button>
          <div></div>
          <div></div>
          <div></div>
          <button className="control-btn">Z-</button>
          <div></div>
        </div>
        
        <h4>Step Size</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <button 
            className={`toolbar-button ${stepSize === 0.1 ? 'primary' : ''}`}
            onClick={() => setStepSize(0.1)}
          >
            0.1
          </button>
          <button 
            className={`toolbar-button ${stepSize === 1.0 ? 'primary' : ''}`}
            onClick={() => setStepSize(1.0)}
          >
            1.0
          </button>
          <button 
            className={`toolbar-button ${stepSize === 10.0 ? 'primary' : ''}`}
            onClick={() => setStepSize(10.0)}
          >
            10.0
          </button>
        </div>
        
        <h4>Speed ({speed}%)</h4>
        <input 
          type="range" 
          min="1" 
          max="100" 
          value={speed}
          onChange={(e) => setSpeed(parseInt(e.target.value))} 
        />
        
        {showAdvanced && (
          <div style={{ marginTop: '20px' }}>
            <h4>Advanced Controls</h4>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button className="toolbar-button">Home All</button>
              <button className="toolbar-button danger">Emergency Stop</button>
            </div>
            
            <h4>Tool Control</h4>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button className="toolbar-button">Tool On</button>
              <button className="toolbar-button">Tool Off</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;