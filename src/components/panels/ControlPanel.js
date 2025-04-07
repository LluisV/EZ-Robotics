import React, { useState, useEffect } from 'react';
import '../../styles/control-panel.css';

/**
 * Modern Control Panel component for robot positioning and control with exact position input.
 */
const ControlPanel = () => {
  const [speed, setSpeed] = useState(25);
  const [stepSize, setStepSize] = useState(1.0);
  const [activeTool, setActiveTool] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [showExactPositionInput, setShowExactPositionInput] = useState(true);
  
  // Function to simulate sending a movement command
  const sendMovementCommand = (axis, direction) => {
    // In a real implementation, this would send a G-code command to the robot
    const distance = direction * stepSize;
    console.log(`Moving ${axis} by ${distance}mm at speed ${speed}%`);
    
    // Simulate position change
    setPosition(prev => {
      const newPosition = { ...prev };
      newPosition[axis.toLowerCase()] += distance;
      return newPosition;
    });
  };
  
  // Function to handle tool control
  const handleToolToggle = () => {
    setActiveTool(!activeTool);
  };
  
  // Function to home axes
  const homeAxes = (axes = 'all') => {
    console.log(`Homing ${axes} axes`);
    // Reset position based on which axes are being homed
    setPosition(prev => {
      const newPosition = { ...prev };
      
      if (axes === 'all' || axes.includes('x')) newPosition.x = 0;
      if (axes === 'all' || axes.includes('y')) newPosition.y = 0;
      if (axes === 'all' || axes.includes('z')) newPosition.z = 0;
      if (axes === 'all' || axes.includes('a')) newPosition.a = 0;
      
      return newPosition;
    });
  };
  
  // Handle target position input changes
  const handleTargetPositionChange = (axis, value) => {
    setTargetPosition(prev => ({
      ...prev,
      [axis]: parseFloat(value) || 0
    }));
  };
  
  // Function to move to exact position
  const moveToExactPosition = () => {
    console.log(`Moving to exact position: X:${targetPosition.x}, Y:${targetPosition.y}, Z:${targetPosition.z}, A:${targetPosition.a} at speed ${speed}%`);
    
    // In a real implementation, this would generate and send the appropriate G-code
    // For example: G1 X10 Y20 Z5 F1000
    
    // Simulate position change
    setPosition({...targetPosition});
  };

  // Simulate random position changes for demonstration
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setPosition(prev => ({
          x: parseFloat((prev.x + (Math.random() - 0.5) * 0.05).toFixed(2)),
          y: parseFloat((prev.y + (Math.random() - 0.5) * 0.05).toFixed(2)),
          z: parseFloat((prev.z + (Math.random() - 0.5) * 0.05).toFixed(2)),
          a: parseFloat((prev.a + (Math.random() - 0.5) * 0.05).toFixed(2))
        }));
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected]);
  
  // Initialize target position from current position
  useEffect(() => {
    setTargetPosition({...position});
  }, [showExactPositionInput]);
  
  return (
    <div className="control-panel">
      {/* Position Display */}
      <div className="control-section position-display">
        <div className="section-header">
          <h3>Position Control</h3>
        </div>
        
        {/* Enhanced Position Cards */}
        <div className="position-cards">
          <div className="position-card x-position">
            <div className="position-card-header">
              <div className="axis-label">X</div>
              <div className="axis-value">{position.x.toFixed(2)}</div>
            </div>
            <div className="unit">mm</div>
          </div>
          
          <div className="position-card y-position">
            <div className="position-card-header">
              <div className="axis-label">Y</div>
              <div className="axis-value">{position.y.toFixed(2)}</div>
            </div>
            <div className="unit">mm</div>
          </div>
          
          <div className="position-card z-position">
            <div className="position-card-header">
              <div className="axis-label">Z</div>
              <div className="axis-value">{position.z.toFixed(2)}</div>
            </div>
            <div className="unit">mm</div>
          </div>

          <div className="position-card a-orientation">
            <div className="position-card-header">
              <div className="axis-label">A</div>
              <div className="axis-value">{position.a.toFixed(2)}</div>
            </div>
            <div className="unit">deg</div>
          </div>
        </div>

        {/* Exact Position Input */}
        {showExactPositionInput && (
          <div className="exact-position-input">
            <div className="exact-position-form">
              <div className="input-row">
                <div className="input-group">
                  <label className="axis-label x-axis">X:</label>
                  <input 
                    type="number" 
                    value={targetPosition.x}
                    onChange={(e) => handleTargetPositionChange('x', e.target.value)}
                    step="0.1"
                  />
                  <span className="unit-label">mm</span>
                </div>
                
                <div className="input-group">
                  <label className="axis-label y-axis">Y:</label>
                  <input 
                    type="number" 
                    value={targetPosition.y}
                    onChange={(e) => handleTargetPositionChange('y', e.target.value)}
                    step="0.1"
                  />
                  <span className="unit-label">mm</span>
                </div>
              </div>
              
              <div className="input-row">
                <div className="input-group">
                  <label className="axis-label z-axis">Z:</label>
                  <input 
                    type="number" 
                    value={targetPosition.z}
                    onChange={(e) => handleTargetPositionChange('z', e.target.value)}
                    step="0.1"
                  />
                  <span className="unit-label">mm</span>
                </div>
                
                <div className="input-group">
                  <label className="axis-label a-axis">A:</label>
                  <input 
                    type="number" 
                    value={targetPosition.a}
                    onChange={(e) => handleTargetPositionChange('a', e.target.value)}
                    step="0.1"
                  />
                  <span className="unit-label">º</span>
                </div>
              </div>
              
              <button 
                className="move-to-position-btn"
                onClick={moveToExactPosition}
              >
                Move to Position
              </button>
            </div>
          </div>
        )}
      
        {/* Movement Controls */}
        <div className="movement-controls">
          <div className="xy-controls">
            <div className="control-grid">
              <button 
                className="control-btn diagonal nw" 
                onClick={() => { sendMovementCommand('X', -1); sendMovementCommand('Y', 1); }}
                title="X- Y+"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <line x1="17" y1="7" x2="7" y2="17"></line>
                  <polyline points="7 7 7 17 17 17"></polyline>
                </svg>
              </button>
              
              <button 
                className="control-btn y-plus" 
                onClick={() => sendMovementCommand('Y', 1)}
                title="Y+"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
                <span className="control-text">Y+</span>
              </button>
              
              <button 
                className="control-btn diagonal ne" 
                onClick={() => { sendMovementCommand('X', 1); sendMovementCommand('Y', 1); }}
                title="X+ Y+"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <line x1="7" y1="7" x2="17" y2="17"></line>
                  <polyline points="17 7 17 17 7 17"></polyline>
                </svg>
              </button>
              
              <button 
                className="control-btn x-minus" 
                onClick={() => sendMovementCommand('X', -1)}
                title="X-"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span className="control-text">X-</span>
              </button>
              
              <button 
                className="control-btn home-xy" 
                onClick={() => homeAxes('xy')}
                title="Home XY"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </button>
              
              <button 
                className="control-btn x-plus" 
                onClick={() => sendMovementCommand('X', 1)}
                title="X+"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span className="control-text">X+</span>
              </button>
              
              <button 
                className="control-btn diagonal sw" 
                onClick={() => { sendMovementCommand('X', -1); sendMovementCommand('Y', -1); }}
                title="X- Y-"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <line x1="17" y1="17" x2="7" y2="7"></line>
                  <polyline points="7 17 7 7 17 7"></polyline>
                </svg>
              </button>
              
              <button 
                className="control-btn y-minus" 
                onClick={() => sendMovementCommand('Y', -1)}
                title="Y-"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span className="control-text">Y-</span>
              </button>
              
              <button 
                className="control-btn diagonal se" 
                onClick={() => { sendMovementCommand('X', 1); sendMovementCommand('Y', -1); }}
                title="X+ Y-"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="17 17 17 7 7 7"></polyline>
                </svg>
              </button>
            </div>
            
            {/* A Controls */}
            <div className="a-control">
              <button 
                className="jog-btn a-minus" 
                onClick={() => sendMovementCommand('A', -1)}
                title="A-"
              >
                <span className="triangle-left"></span>
                <span className="axis-text">A-</span>
              </button>
              <button 
                className="jog-btn home-a" 
                onClick={() => homeAxes('a')}
                title="Home A"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </button>
              <button 
                className="jog-btn a-plus" 
                onClick={() => sendMovementCommand('A', 1)}
                title="A+"
              >
                <span className="triangle-right"></span>
                <span className="axis-text">A+</span>
              </button>
            </div>
          </div>
          
          <div className="z-controls">
            <button 
              className="control-btn z-plus" 
              onClick={() => sendMovementCommand('Z', 1)}
              title="Z+"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <polyline points="18 15 12 9 6 15"></polyline>
              </svg>
              <span className="control-text">Z+</span>
            </button>
            
            <button 
              className="control-btn home-z" 
              onClick={() => homeAxes('z')}
              title="Home Z"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </button>
            
            <button 
              className="control-btn z-minus" 
              onClick={() => sendMovementCommand('Z', -1)}
              title="Z-"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              <span className="control-text">Z-</span>
            </button>
          </div>
        </div>
                
        <div className="global-controls">
          <button 
            className="global-btn home-all" 
            onClick={() => homeAxes('all')}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Home All
          </button>
          
          <button 
            className="global-btn stop-btn" 
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
            STOP
          </button>
        </div>
      </div>
      
      {/* Step Size Controls */}
      <div className="control-section step-size-section">
        <div className="section-header">
          <h3>Step Size</h3>
        </div>
        <div className="step-size-controls">
          {[0.1, 0.5, 1.0, 5.0, 10.0, 50.0].map(size => (
            <button 
              key={size}
              className={`step-btn ${stepSize === size ? 'active' : ''}`}
              onClick={() => setStepSize(size)}
            >
              {size}mm
            </button>
          ))}
        </div>
      </div>
      
      {/* Speed Controls */}
      <div className="control-section speed-section">
        <div className="section-header">
          <h3>Speed Control</h3>
          <div className="speed-value">{speed}%</div>
        </div>
        <div className="speed-slider-container">
          <input 
            type="range" 
            min="1" 
            max="100" 
            value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value))} 
            className="speed-slider"
          />
          <div className="speed-ticks">
            <span className="speed-tick">0%</span>
            <span className="speed-tick">25%</span>
            <span className="speed-tick">50%</span>
            <span className="speed-tick">75%</span>
            <span className="speed-tick">100%</span>
          </div>
        </div>
        <div className="speed-presets">
          <button onClick={() => setSpeed(25)}>25%</button>
          <button onClick={() => setSpeed(50)}>50%</button>
          <button onClick={() => setSpeed(75)}>75%</button>
          <button onClick={() => setSpeed(100)}>100%</button>
        </div>
      </div>
      
      {/* Tool Controls */}
      <div className="control-section tool-section">
        <div className="section-header">
          <h3>Tool Control</h3>
          <div className="status-badge">
            <span className={`status-text ${activeTool ? 'active' : 'inactive'}`}>
              {activeTool ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
        
        <div className="tool-control-container">
          <div className="tool-status-display">
            <div className={`status-indicator ${activeTool ? 'active' : 'inactive'}`}>
              <div className="pulse-ring"></div>
            </div>
            <div className="tool-status-info">
              <div className="tool-name">CNC Tool</div>
              <div className="tool-state">{activeTool ? 'Ready to operate' : 'Standby mode'}</div>
            </div>
          </div>
          
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={activeTool} 
              onChange={handleToolToggle}
            />
            <span className="toggle-slider">
              <span className="toggle-knob">
                <span className="toggle-icon">
                  {activeTool ? (
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none">
                      <path d="M5 12l5 5 9-9" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  )}
                </span>
              </span>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;