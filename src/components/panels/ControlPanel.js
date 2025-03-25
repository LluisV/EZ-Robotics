import React, { useState } from 'react';

/**
 * Control Panel component for robot positioning and control.
 * 
 * @param {Object} props Component properties
 * @param {boolean} props.showAdvanced Whether to show advanced controls
 */
const ControlPanel = ({ showAdvanced = false }) => {
  const [speed, setSpeed] = useState(25);
  const [stepSize, setStepSize] = useState(1.0);
  const [activeTool, setActiveTool] = useState(null);
  
  // Function to simulate sending a movement command
  const sendMovementCommand = (axis, direction) => {
    // In a real implementation, this would send a G-code command to the robot
    const distance = direction * stepSize;
    console.log(`Moving ${axis} by ${distance}mm at speed ${speed}%`);
    // Example G-code that would be sent: G1 ${axis}${distance} F${speed * 60}
  };
  
  // Function to home axes
  const homeAxes = (axes = 'all') => {
    console.log(`Homing ${axes} axes`);
    // Would send G28 or specific axis home commands
  };
  
  // Function to handle tool control
  const handleToolControl = (action) => {
    if (action === 'on') {
      setActiveTool('on');
      console.log('Tool activated');
    } else {
      setActiveTool(null);
      console.log('Tool deactivated');
    }
  };
  
  return (
    <div className="panel-content">  
      <div>
        <h4>Position Controls</h4>
        
        {/* Jog control layout with axis labels */}
        <div className="jog-control-container">
          {/* XY Controls Grid */}
          <div className="jog-grid">
            {/* Top row */}
            <button 
              className="jog-btn diagonal nw" 
              onClick={() => { sendMovementCommand('X', -1); sendMovementCommand('Y', 1); }}
              title="X- Y+"
            >
              <span className="triangle-nw"></span>
            </button>
            <button 
              className="jog-btn y-plus" 
              onClick={() => sendMovementCommand('Y', 1)}
              title="Y+"
            >
              <span className="triangle-up"></span>
              <span className="axis-text">Y+</span>
            </button>
            <button 
              className="jog-btn diagonal ne" 
              onClick={() => { sendMovementCommand('X', 1); sendMovementCommand('Y', 1); }}
              title="X+ Y+"
            >
              <span className="triangle-ne"></span>
            </button>
            
            {/* Middle row */}
            <button 
              className="jog-btn x-minus" 
              onClick={() => sendMovementCommand('X', -1)}
              title="X-"
            >
              <span className="triangle-left"></span>
              <span className="axis-text">X-</span>
            </button>
            <button 
              className="jog-btn home" 
              onClick={() => homeAxes('xy')}
              title="Home XY"
            >
              <span className="home-icon"></span>
            </button>
            <button 
              className="jog-btn x-plus" 
              onClick={() => sendMovementCommand('X', 1)}
              title="X+"
            >
              <span className="triangle-right"></span>
              <span className="axis-text">X+</span>
            </button>
            
            {/* Bottom row */}
            <button 
              className="jog-btn diagonal sw" 
              onClick={() => { sendMovementCommand('X', -1); sendMovementCommand('Y', -1); }}
              title="X- Y-"
            >
              <span className="triangle-sw"></span>
            </button>
            <button 
              className="jog-btn y-minus" 
              onClick={() => sendMovementCommand('Y', -1)}
              title="Y-"
            >
              <span className="triangle-down"></span>
              <span className="axis-text">Y-</span>
            </button>
            <button 
              className="jog-btn diagonal se" 
              onClick={() => { sendMovementCommand('X', 1); sendMovementCommand('Y', -1); }}
              title="X+ Y-"
            >
              <span className="triangle-se"></span>
            </button>
          </div>
          
          {/* Z Controls */}
          <div className="z-control">
            <button 
              className="jog-btn z-plus" 
              onClick={() => sendMovementCommand('Z', 1)}
              title="Z+"
            >
              <span className="triangle-up"></span>
              <span className="axis-text">Z+</span>
            </button>
            
            <button 
              className="jog-btn home-z" 
              onClick={() => homeAxes('z')}
              title="Home Z"
            >
              <span className="home-icon"></span>
            </button>
            
            <button 
              className="jog-btn z-minus" 
              onClick={() => sendMovementCommand('Z', -1)}
              title="Z-"
            >
              <span className="triangle-down"></span>
              <span className="axis-text">Z-</span>
            </button>
          </div>
        </div>
        
        <div className="control-actions">
          <button 
            className="toolbar-button" 
            onClick={() => homeAxes('all')}
          >
            Home All
          </button>
          
          <button 
            className="toolbar-button danger" 
          >
            STOP
          </button>
        </div>
        
        <h4>Step Size</h4>
        <div className="step-size-grid">
          <button 
            className={`step-btn ${stepSize === 0.1 ? 'active' : ''}`}
            onClick={() => setStepSize(0.1)}
          >
            0.1
          </button>
          <button 
            className={`step-btn ${stepSize === 0.5 ? 'active' : ''}`}
            onClick={() => setStepSize(0.5)}
          >
            0.5
          </button>
          <button 
            className={`step-btn ${stepSize === 1.0 ? 'active' : ''}`}
            onClick={() => setStepSize(1.0)}
          >
            1.0
          </button>
          <button 
            className={`step-btn ${stepSize === 5.0 ? 'active' : ''}`}
            onClick={() => setStepSize(5.0)}
          >
            5.0
          </button>
          <button 
            className={`step-btn ${stepSize === 10.0 ? 'active' : ''}`}
            onClick={() => setStepSize(10.0)}
          >
            10.0
          </button>
          <button 
            className={`step-btn ${stepSize === 50.0 ? 'active' : ''}`}
            onClick={() => setStepSize(50.0)}
          >
            50.0
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
        <div className="speed-presets">
          <button onClick={() => setSpeed(25)}>25%</button>
          <button onClick={() => setSpeed(50)}>50%</button>
          <button onClick={() => setSpeed(75)}>75%</button>
          <button onClick={() => setSpeed(100)}>100%</button>
        </div>
        
        {showAdvanced && (
          <div className="advanced-controls">
            <h4>Tool Control</h4>
            <div className="tool-controls">
              <button 
                className={`toolbar-button ${activeTool === 'on' ? 'success' : ''}`}
                onClick={() => handleToolControl('on')}
              >
                Tool On
              </button>
              <button 
                className="toolbar-button"
                onClick={() => handleToolControl('off')}
              >
                Tool Off
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;