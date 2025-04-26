import { useState, useEffect, useCallback, useRef } from 'react';

import '../../styles/control-panel.css';
import communicationService from '../../services/communication/CommunicationService';
import EventEmitter from 'events';

/**
 * Modern Control Panel component for FluidNC positioning and control with exact position input.
 */
const ControlPanel = () => {
  const [speed, setSpeed] = useState(25);
  const [stepSize, setStepSize] = useState(1.0);
  const [activeTool, setActiveTool] = useState(null);
  const [position, setPosition] = useState({
    work: { x: 0, y: 0, z: 0, a: 0 },
    world: { x: 0, y: 0, z: 0, a: 0 }
  });
  const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [showExactPositionInput, setShowExactPositionInput] = useState(true);
  const [moveType, setMoveType] = useState('G1');
  const [positionView, setPositionView] = useState('work'); // 'work' or 'world'
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Add log messages to console
  const logToConsole = (type, message) => {
    communicationService.emit(type === 'error' ? 'error' : 'response', { 
      [type === 'error' ? 'error' : 'response']: message 
    });
  };

  // Function to send a movement command to FluidNC
  const sendMovementCommand = (axis, direction) => {
    // Get connection status
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      logToConsole('error', 'Not connected. Connection status: ' + connectionInfo.status);
      return;
    }

    const distance = direction * stepSize;

    // Create G-code command - FluidNC expects relative mode for incremental movement
    // The $J= command is FluidNC's jog command that accepts relative coordinates
    const feedrateInMmPerMin = speed * 60; // Convert from percentage to mm/min
    const jogCommand = `$J=${axis}${distance} F${feedrateInMmPerMin}`;

    logToConsole('command', `Sending jog command: ${jogCommand}`);

    // Send the command
    communicationService.sendCommand(jogCommand)
      .catch(err => {
        logToConsole('error', 'Error sending jog command: ' + err);
      });
  };

  // Function to handle tool control
  const handleToolToggle = () => {
    setActiveTool(!activeTool);
    
    // Send the appropriate FluidNC command to toggle spindle
    const command = !activeTool ? 'M3 S1000' : 'M5';  // M3=Spindle on, M5=Spindle off, S1000=1000 RPM
    
    logToConsole('command', `Toggling tool state: ${command}`);
    
    communicationService.sendCommand(command)
      .then(() => {
        logToConsole('response', `Tool ${!activeTool ? 'activated' : 'deactivated'}`);
      })
      .catch(err => {
        logToConsole('error', 'Error toggling tool: ' + err);
      });
  };

  // Function to home axes for FluidNC
  const homeAxes = (axes = 'all') => {
    // Get connection status
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      logToConsole('error', 'Not connected. Connection status: ' + connectionInfo.status);
      return;
    }

    let gcode = '';

    if (axes === 'all') {
      // FluidNC uses $H to home all axes
      gcode = '$H';
      logToConsole('command', 'Sending home all axes command: $H');
    } else {
      // FluidNC allows homing specific axes with $H<axis>
      gcode = `$H${axes.toUpperCase()}`;
      logToConsole('command', `Sending home command: ${gcode}`);
    }

    // Send the command
    communicationService.sendCommand(gcode)
      .catch(err => {
        logToConsole('error', 'Error sending home command: ' + err);
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
      logToConsole('error', 'Not connected. Connection status:' + connectionInfo.status);
      return;
    }

    logToConsole('command', 'Sending stop command');

    // FluidNC stop command is Ctrl-X (ASCII 0x18)
    communicationService.sendSpecialCommand('STOP')
      .catch(err => {
        logToConsole('error', 'Error sending stop command: ' + err);
      });
  };

  // Function to set current position as work zero in FluidNC
  const setWorkZero = (axes = 'all') => {
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      logToConsole('error', 'Not connected. Connection status: ' + connectionInfo.status);
      return;
    }

    let gcode = '';
    if (axes === 'all') {
      // FluidNC uses G10 L20 P0 X0 Y0 Z0 to set work offset for the current WCS
      gcode = 'G10 L20 P0 X0 Y0 Z0 A0';
      logToConsole('command', 'Setting current position as work zero for all axes');
    } else {
      // Set zero only for specified axes
      const axesArray = axes.split('');
      gcode = `G10 L20 P0 ${axesArray.map(axis => `${axis.toUpperCase()}0`).join(' ')}`;
      logToConsole('command', `Setting current position as work zero for ${axes.toUpperCase()} axes`);
    }

    // Send the command
    communicationService.sendCommand(gcode)
      .then(() => {
        showToast('Work zero position set successfully');
        // Update local position state
        setPosition(prev => ({
          ...prev,
          work: {
            ...prev.work,
            x: 0,
            y: 0,
            z: 0,
            a: 0
          }
        }));
      })
      .catch(err => {
        logToConsole('error', 'Error setting work zero: ' + err);
      });
  };

  // Function to move to work zero position in FluidNC
  const moveToWorkZero = () => {
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      logToConsole('error', 'Not connected. Connection status: ' + connectionInfo.status);
      return;
    }

    // First move Z to a safe height to avoid collisions
    const safeHeight = 5; // 5mm above work zero
    const feedrateInMmPerMin = speed * 60;
    const gcode = `G0 Z${safeHeight} F${feedrateInMmPerMin}\nG0 X0 Y0 F${feedrateInMmPerMin}\nG0 Z0 F${feedrateInMmPerMin/2}`;

    logToConsole('command', 'Moving to work zero position');

    // Send the command
    communicationService.sendCommand(gcode)
      .then(() => {
        showToast('Moved to work zero position');
      })
      .catch(err => {
        logToConsole('error', 'Error moving to work zero: ' + err);
      });
  };

  // Function to reset FluidNC
  const resetMachine = () => {
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      logToConsole('error', 'Not connected. Connection status: ' + connectionInfo.status);
      return;
    }

    // Confirm before resetting
    if (window.confirm('Are you sure you want to reset the machine? This will clear all errors and restart the controller.')) {
      logToConsole('command', 'Resetting machine');

      // For FluidNC, send a Ctrl-X to perform a soft reset
      communicationService.sendSpecialCommand('STOP')
        .then(() => {
          showToast('Machine reset successful');
        })
        .catch(err => {
          logToConsole('error', 'Error resetting machine: ' + err);
        });
    }
  };

  // Show a toast message
  const showToast = (message) => {
    setToastMessage(message);
    setShowSuccessToast(true);

    // Hide after 3 seconds
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  // Function to move to exact position using FluidNC
  const moveToExactPosition = (moveType = 'G1') => {
    // Get connection status
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      logToConsole('error', 'Not connected. Connection status:' + connectionInfo.status);
      return;
    }

    // Use the correct coordinate values based on the current view
    let coordsToSend = { ...targetPosition };
    const feedrateInMmPerMin = speed * 60;

    // Create G-code command for movement based on the move type
    let gcode;
    
    if (positionView === 'world') {
      // For machine coordinates (world), FluidNC requires G53
      gcode = `G53 ${moveType} X${coordsToSend.x} Y${coordsToSend.y} Z${coordsToSend.z} F${feedrateInMmPerMin}`;
      if (coordsToSend.a !== 0) {
        gcode += ` A${coordsToSend.a}`;
      }
    } else {
      // For work coordinates, use normal G0/G1 commands
      gcode = `${moveType} X${coordsToSend.x} Y${coordsToSend.y} Z${coordsToSend.z} F${feedrateInMmPerMin}`;
      if (coordsToSend.a !== 0) {
        gcode += ` A${coordsToSend.a}`;
      }
    }

    logToConsole('command', `Sending movement command: ${gcode}`);

    // Send the command
    communicationService.sendCommand(gcode)
      .catch(err => {
        logToConsole('error', 'Error sending movement command: ' + err);
      });
  };

  // Helper function to parse FluidNC position telemetry
  const parseTelemetryPosition = (message) => {
    try {
      // Extract JSON from FluidNC telemetry message
      const jsonStart = message.indexOf('{');
      if (jsonStart === -1) return null;

      const jsonString = message.substring(jsonStart);
      const data = JSON.parse(jsonString);

      // Check for expected structure (modified for FluidNC format)
      if (!data.work || !data.world) {
        console.log("Missing expected work/world properties");
        return null;
      }

      return {
        work: {
          x: parseFloat(data.work.X) || 0,
          y: parseFloat(data.work.Y) || 0,
          z: parseFloat(data.work.Z) || 0,
          a: parseFloat(data.work.A) || 0
        },
        world: {
          x: parseFloat(data.world.X) || 0,
          y: parseFloat(data.world.Y) || 0,
          z: parseFloat(data.world.Z) || 0,
          a: parseFloat(data.world.A) || 0
        }
      };
    } catch (error) {
      console.error("Error parsing telemetry:", error);
      return null;
    }
  };

  // Initialize target position from current position
  useEffect(() => {
    setTargetPosition({ ...position[positionView] });
  }, [showExactPositionInput, positionView, position]);

  // Listen to FluidNC position updates
  useEffect(() => {
    const handlePositionTelemetry = (data) => {
      if (typeof data.response === 'string' && data.response.startsWith('[TELEMETRY]')) {
        const newPosition = parseTelemetryPosition(data.response);

        if (newPosition) {
          setPosition(newPosition);
        }
      }
    };

    // Add event listener
    communicationService.on('position-telemetry', handlePositionTelemetry);

    // Cleanup listener on unmount
    return () => {
      communicationService.removeListener('position-telemetry', handlePositionTelemetry);
    };
  }, []);

  // Get the active position object based on current view
  const activePosition = position[positionView];

  return (
    <div className="control-panel">
      {/* Toast notification */}
      {showSuccessToast && (
        <div className="success-toast">
          <div className="toast-content">
            <span className="toast-icon">✓</span>
            <span className="toast-message">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Position Display */}
      <div className="control-section position-display">
        <div className="section-header">
          <h3>Position Control</h3>
        </div>

        {/* Position View Selector */}
        <div className="position-view-selector">
          <div className="move-mode-selector">
            <button
              className={`move-mode-btn ${positionView === 'work' ? 'active' : ''}`}
              onClick={() => setPositionView('work')}
              aria-pressed={positionView === 'work'}
            >
              <span className="move-mode-icon">Work</span>
              <span className="move-mode-label">Coordinate</span>
            </button>
            <button
              className={`move-mode-btn ${positionView === 'world' ? 'active' : ''}`}
              onClick={() => setPositionView('world')}
              aria-pressed={positionView === 'world'}
            >
              <span className="move-mode-icon">World</span>
              <span className="move-mode-label">Coordinate</span>
            </button>
          </div>
        </div>

        {/* Enhanced Position Cards */}
        <div className="position-cards">
          <div className="position-card x-position">
            <div className="position-card-header">
              <div className="axis-label">X</div>
              <div className="axis-value">{activePosition.x.toFixed(2)}</div>
            </div>
            <div className="unit">mm</div>
            <div className="secondary-position">
              {positionView === 'work' ?
                `World: ${position.world.x.toFixed(2)}` :
                `Work: ${position.work.x.toFixed(2)}`}
            </div>
          </div>

          <div className="position-card y-position">
            <div className="position-card-header">
              <div className="axis-label">Y</div>
              <div className="axis-value">{activePosition.y.toFixed(2)}</div>
            </div>
            <div className="unit">mm</div>
            <div className="secondary-position">
              {positionView === 'work' ?
                `World: ${position.world.y.toFixed(2)}` :
                `Work: ${position.work.y.toFixed(2)}`}
            </div>
          </div>

          <div className="position-card z-position">
            <div className="position-card-header">
              <div className="axis-label">Z</div>
              <div className="axis-value">{activePosition.z.toFixed(2)}</div>
            </div>
            <div className="unit">mm</div>
            <div className="secondary-position">
              {positionView === 'work' ?
                `World: ${position.world.z.toFixed(2)}` :
                `Work: ${position.work.z.toFixed(2)}`}
            </div>
          </div>

          <div className="position-card a-orientation">
            <div className="position-card-header">
              <div className="axis-label">A</div>
              <div className="axis-value">{activePosition.a.toFixed(2)}</div>
            </div>
            <div className="unit">deg</div>
            <div className="secondary-position">
              {positionView === 'work' ?
                `World: ${position.world.a.toFixed(2)}` :
                `Work: ${position.work.a.toFixed(2)}`}
            </div>
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

              {/* Move Type Selector */}
              <div className="move-controls">
                <div className="move-mode-selector">
                  <button
                    className={`move-mode-btn ${moveType === 'G0' ? 'active' : ''}`}
                    onClick={() => setMoveType('G0')}
                    aria-pressed={moveType === 'G0'}
                  >
                    <span className="move-mode-icon">G0</span>
                    <span className="move-mode-label">Rapid</span>
                  </button>
                  <button
                    className={`move-mode-btn ${moveType === 'G1' ? 'active' : ''}`}
                    onClick={() => setMoveType('G1')}
                    aria-pressed={moveType === 'G1'}
                  >
                    <span className="move-mode-icon">G1</span>
                    <span className="move-mode-label">Controlled</span>
                  </button>
                </div>

                <button
                  className="move-to-position-btn"
                  onClick={() => moveToExactPosition(moveType)}
                >
                  <span className="btn-icon"></span>
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
            className="global-btn set-zero"
            onClick={() => setWorkZero('all')}
            title="Set current position as work zero"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Set Zero
          </button>

          <button
            className="global-btn move-to-zero"
            onClick={moveToWorkZero}
            title="Move to work zero position"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Go To Zero
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

      {/* Tool Controls - Modified for FluidNC spindle control */}
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
              <div className="tool-name">FluidNC Spindle</div>
              <div className="tool-state">{activeTool ? 'Spindle running' : 'Spindle stopped'}</div>
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
  )};


  export default ControlPanel;