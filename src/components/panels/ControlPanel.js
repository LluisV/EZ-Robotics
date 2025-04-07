import { useState, useEffect, useCallback, useRef } from 'react';

import '../../styles/control-panel.css';
import communicationService from '../../services/communication/CommunicationService';


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
  const [moveType, setMoveType] = useState('G1');
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const pollingIntervalRef = useRef(null);
  const POLLING_RATE = 500; // 500ms (2Hz) - adjust based on your requirements
  
  const logToConsole = (type, message) => {
    switch(type) {
      case 'command':
        communicationService.emit('command', { command: message, sent: true });
        break;
      case 'response':
        communicationService.emit('response', { response: message });
        break;
      case 'error':
        communicationService.emit('error', { error: message });
        break;
      case 'info':
        communicationService.emit('response', { response: `[INFO] ${message}` });
        break;
      default:
        communicationService.emit('response', { response: message });
    }
  };

  // Function to simulate sending a movement command
  const sendMovementCommand = (axis, direction) => {
    // Get connection status
  const connectionInfo = communicationService.getConnectionInfo();
  if (connectionInfo.status !== 'connected') {
    console.log('Not connected. Connection status:', connectionInfo.status);
    return;
  }

  const distance = direction * stepSize;
  
  // Create G-code command for movement
  const gcode = `G1 ${axis}${distance} F${speed * 60}`; // Convert speed percentage to mm/min feed rate
  
  console.log(`Sending command: ${gcode}`);
  
  // Send the command
  communicationService.sendCommand(gcode)
    .then(() => {
      // Request current position after movement
      return communicationService.sendCommand('?POS', { immediate: true });
    })
    .then(response => {
      // Parse position from response
      const posRegex = /X:(-?\d+\.?\d*)\s+Y:(-?\d+\.?\d*)\s+Z:(-?\d+\.?\d*)(?:\s+A:(-?\d+\.?\d*))?/i;
      const match = response.match(posRegex);
      
      if (match) {
        setPosition({
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3]),
          a: match[4] ? parseFloat(match[4]) : position.a // Keep the current value for A if not reported
        });
      }
    })
    .catch(err => {
      console.error('Error sending movement command:', err);
    });
  };
  
  // Function to handle tool control
  const handleToolToggle = () => {
    setActiveTool(!activeTool);
  };
  
  // Function to home axes
  const homeAxes = (axes = 'all') => {
    // Get connection status
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      console.log('Not connected. Connection status:', connectionInfo.status);
      return;
    }
  
    let gcode = '';
    
    if (axes === 'all') {
      gcode = 'G28';
      console.log('Sending home all axes command: G28');
    } else {
      // Format: G28 X Y Z for specific axes
      gcode = `G28 ${axes.toUpperCase()}`;
      console.log(`Sending home command: ${gcode}`);
    }
    
    // Send the command
    communicationService.sendCommand(gcode)
      .then(() => {
        // Request current position after homing
        return communicationService.sendCommand('?POS', { immediate: true });
      })
      .then(response => {
        // Parse position from response
        const posRegex = /X:(-?\d+\.?\d*)\s+Y:(-?\d+\.?\d*)\s+Z:(-?\d+\.?\d*)(?:\s+A:(-?\d+\.?\d*))?/i;
        const match = response.match(posRegex);
        
        if (match) {
          setPosition({
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            z: parseFloat(match[3]),
            a: match[4] ? parseFloat(match[4]) : position.a // Keep the current value for A if not reported
          });
        }
      })
      .catch(err => {
        console.error('Error sending home command:', err);
      });
  };
  
  // Handle target position input changes
  const handleTargetPositionChange = (axis, value) => {
    setTargetPosition(prev => ({
      ...prev,
      [axis]: parseFloat(value) || 0
    }));
  };

  const handleStop = () => {
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      console.log('Not connected. Connection status:', connectionInfo.status);
      return;
    }
  
    console.log('Sending stop command');
    
    // Send the command
    communicationService.sendSpecialCommand('STOP')
      .catch(err => {
        console.error('Error sending stop command:', err);
      });
  };
  
  // Function to move to exact position
  const moveToExactPosition = (moveType = 'G1') => {
    // Get connection status
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      console.log('Not connected. Connection status:', connectionInfo.status);
      return;
    }
  
    // Create G-code command for movement
    const gcode = `${moveType} X${targetPosition.x} Y${targetPosition.y} Z${targetPosition.z} A${targetPosition.a} F${speed * 60}`; // Convert speed percentage to mm/min feed rate
    
    console.log(`Sending command: ${gcode}`);
    
    // Send the command
    communicationService.sendCommand(gcode)
      .then(() => {
        // Request current position after movement
        return communicationService.sendCommand('?POS', { immediate: true });
      })
      .then(response => {
        // Parse position from response
        const posRegex = /X:(-?\d+\.?\d*)\s+Y:(-?\d+\.?\d*)\s+Z:(-?\d+\.?\d*)(?:\s+A:(-?\d+\.?\d*))?/i;
        const match = response.match(posRegex);
        
        if (match) {
          setPosition({
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            z: parseFloat(match[3]),
            a: match[4] ? parseFloat(match[4]) : position.a // Keep the current value for A if not reported
          });
        }
      })
      .catch(err => {
        console.error('Error sending movement command:', err);
      });
  };

  const queryPosition = useCallback(async () => {
    if (!isConnected) return;
    
    try {
      const response = await communicationService.sendCommand('?POS', { 
        immediate: true,
        expectResponse: true,
        silent: true // Don't log the command itself
      });
      
      // Parse position from response
      const posRegex = /X:(-?\d+\.?\d*)\s+Y:(-?\d+\.?\d*)\s+Z:(-?\d+\.?\d*)(?:\s+A:(-?\d+\.?\d*))?/i;
      const match = response.match(posRegex);
      
      if (match) {
        setPosition({
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          z: parseFloat(match[3]),
          a: match[4] ? parseFloat(match[4]) : position.a // Keep current A value if not reported
        });
      }
    } catch (err) {
      // Silent failure for polling - no need to show errors for routine position checks
      console.error('Position polling error:', err);
    }
  }, [isConnected, position.a]);
  
  // Initialize target position from current position
  useEffect(() => {
    setTargetPosition({...position});
  }, [showExactPositionInput]);
  
// Setup and cleanup for position polling
useEffect(() => {
  // Check connection status initially
  const connectionInfo = communicationService.getConnectionInfo();
  setIsConnected(connectionInfo.status === 'connected');

  // Setup connection status listener
  const handleConnection = (data) => {
    setIsConnected(data.status === 'connected');
    
    if (data.status === 'connected') {
      logToConsole('info', 'Connection established - starting position monitoring');
    } else {
      logToConsole('info', 'Connection lost - position monitoring paused');
    }
  };
  
  communicationService.on('connection', handleConnection);
  
  // Start position polling if connected
  if (isConnected && pollingEnabled) {
    logToConsole('info', 'Starting position monitoring');
    pollingIntervalRef.current = setInterval(queryPosition, POLLING_RATE);
  }
  
  // Cleanup function
  return () => {
    communicationService.removeListener('connection', handleConnection);
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
}, [isConnected, pollingEnabled, queryPosition]);

// Effect to manage the polling interval when connection state changes
useEffect(() => {
  // Clear existing interval
  if (pollingIntervalRef.current) {
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = null;
  }
  
  // Start new interval if connected and polling is enabled
  if (isConnected && pollingEnabled) {
    pollingIntervalRef.current = setInterval(queryPosition, POLLING_RATE);
    
    // Immediately query position on connection
    queryPosition();
  }
  
  return () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };
}, [isConnected, pollingEnabled, queryPosition]);



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
                <span className="unit-label">°</span>
              </div>
            </div>
            
            <div className="move-controls">
              <div className="move-mode-selector">
                <button 
                  className={`move-mode-btn ${moveType === 'G0' ? 'active' : ''}`}
                  onClick={() => setMoveType('G0')}
                >
                  <span className="move-mode-icon">G0</span>
                  <span className="move-mode-label">Rapid</span>
                </button>
                <button 
                  className={`move-mode-btn ${moveType === 'G1' ? 'active' : ''}`}
                  onClick={() => setMoveType('G1')}
                >
                  <span className="move-mode-icon">G1</span>
                  <span className="move-mode-label">Controlled</span>
                </button>
              </div>
              
              <button 
                className="move-to-position-btn"
                onClick={() => moveToExactPosition(moveType)}
              >
                <span className="btn-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </span>
                Move to Position
              </button>
            </div>
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
  onClick={handleStop}
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