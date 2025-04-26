import { useState, useEffect, useCallback, useRef } from 'react';
import serialService from '../../services/SerialCommunicationService';
import '../../styles/control-panel.css';

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
  const [isConnected, setIsConnected] = useState(false);

  // Add log messages to console
  const logToConsole = (type, message) => {
    // Create a custom event to log to console panel
    const event = new CustomEvent('consoleEntry', { 
      detail: { type, content: message }
    });
    document.dispatchEvent(event);
  };

  // Check if serial connection is available
  useEffect(() => {
    // Listen for serial connection status changes
    const handleConnectionChange = (event) => {
      if (event.detail) {
        setIsConnected(event.detail.connected);
      }
    };

    document.addEventListener('serialconnection', handleConnectionChange);
    
    // Check initial connection state
    setIsConnected(serialService.getConnectionStatus());
    
    return () => {
      document.removeEventListener('serialconnection', handleConnectionChange);
    };
  }, []);

  // Function to send a movement command to FluidNC
  const sendMovementCommand = (axis, direction) => {
    if (!isConnected) {
      logToConsole('error', 'Cannot move: Not connected to machine');
      showToast('Cannot move: Not connected to machine');
      return;
    }

    const distance = direction * stepSize;

    // Create G-code command - FluidNC expects relative mode for incremental movement
    // The $J= command is FluidNC's jog command that accepts relative coordinates
    const feedrateInMmPerMin = speed * 60; // Convert from percentage to mm/min
    
    // Construct the jog command with the specified axis and distance
    let jogCommand = `$J=G91 ${axis}${distance} F${feedrateInMmPerMin}`;
    
    logToConsole('command', `Sending jog command: ${jogCommand}`);

    // Send the command to the serial port
    serialService.send(jogCommand)
      .then(success => {
        if (!success) {
          logToConsole('error', 'Failed to send jog command: No response from machine');
        }
      })
      .catch(error => {
        logToConsole('error', `Error sending jog command: ${error.message}`);
      });
  };

  // Function to handle tool control
  const handleToolToggle = () => {
    if (!isConnected) {
      logToConsole('error', 'Cannot toggle tool: Not connected to machine');
      showToast('Cannot toggle tool: Not connected to machine');
      return;
    }
    
    // Toggle tool state
    const newState = !activeTool;
    
    // Send the appropriate FluidNC command to toggle spindle
    const command = newState ? 'M3 S1000' : 'M5';  // M3=Spindle on, M5=Spindle off, S1000=1000 RPM
    
    logToConsole('command', `Toggling tool state: ${command}`);
    
    // Send command to the serial port
    serialService.send(command)
      .then(success => {
        if (success) {
          setActiveTool(newState);
          showToast(`Tool ${newState ? 'activated' : 'deactivated'}`);
        } else {
          logToConsole('error', 'Failed to toggle tool: No response from machine');
        }
      })
      .catch(error => {
        logToConsole('error', `Error toggling tool: ${error.message}`);
      });
  };

  // Function to home axes for FluidNC
  const homeAxes = (axes = 'all') => {
    if (!isConnected) {
      logToConsole('error', 'Cannot home: Not connected to machine');
      showToast('Cannot home: Not connected to machine');
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

    // Send the command to the serial port
    serialService.send(gcode)
      .then(success => {
        if (success) {
          showToast(`Homing ${axes === 'all' ? 'all axes' : axes.toUpperCase()}`);
        } else {
          logToConsole('error', 'Failed to send home command: No response from machine');
        }
      })
      .catch(error => {
        logToConsole('error', `Error sending home command: ${error.message}`);
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
    if (!isConnected) {
      logToConsole('error', 'Cannot stop: Not connected to machine');
      showToast('Cannot stop: Not connected to machine');
      return;
    }

    logToConsole('command', 'Sending stop command: !');

    // Send the command to immediately stop motion
    serialService.send('!')
      .then(success => {
        if (success) {
          showToast('Emergency stop sent');
          
          // Also follow with a soft reset
          setTimeout(() => {
            serialService.send('\x18'); // CTRL+X for soft reset
          }, 100);
        } else {
          logToConsole('error', 'Failed to send stop command: No response from machine');
        }
      })
      .catch(error => {
        logToConsole('error', `Error sending stop command: ${error.message}`);
      });
  };

  // Function to set current position as work zero in FluidNC
  const setWorkZero = (axes = 'all') => {
    if (!isConnected) {
      logToConsole('error', 'Cannot set zero: Not connected to machine');
      showToast('Cannot set zero: Not connected to machine');
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

    // Send the command to the serial port
    serialService.send(gcode)
      .then(success => {
        if (success) {
          showToast(`Position set as work zero for ${axes === 'all' ? 'all axes' : axes.toUpperCase()}`);
        } else {
          logToConsole('error', 'Failed to set work zero: No response from machine');
        }
      })
      .catch(error => {
        logToConsole('error', `Error setting work zero: ${error.message}`);
      });
  };

  // Function to move to work zero position in FluidNC
  const moveToWorkZero = () => {
    if (!isConnected) {
      logToConsole('error', 'Cannot move to zero: Not connected to machine');
      showToast('Cannot move to zero: Not connected to machine');
      return;
    }

    // First move Z to a safe height to avoid collisions
    const safeHeight = 5; // 5mm above work zero
    const feedrateInMmPerMin = speed * 60;
    const gcode = `G0 Z${safeHeight} F${feedrateInMmPerMin}\nG0 X0 Y0 F${feedrateInMmPerMin}\nG0 Z0 F${feedrateInMmPerMin/2}`;

    logToConsole('command', 'Moving to work zero position');

    // Send each line of the command with a small delay between them
    const commands = gcode.split('\n');
    
    const sendSequentially = async () => {
      for (const cmd of commands) {
        try {
          const success = await serialService.send(cmd);
          if (!success) {
            logToConsole('error', `Failed to send command: ${cmd}`);
            break;
          }
          // Add a small delay between commands
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logToConsole('error', `Error sending command: ${error.message}`);
          break;
        }
      }
      showToast('Moving to work zero position');
    };
    
    sendSequentially();
  };

  // Function to reset FluidNC
  const resetMachine = () => {
    if (!isConnected) {
      logToConsole('error', 'Cannot reset: Not connected to machine');
      showToast('Cannot reset: Not connected to machine');
      return;
    }

    // Confirm before resetting
    if (window.confirm('Are you sure you want to reset the machine? This will clear all errors and restart the controller.')) {
      logToConsole('command', 'Resetting machine with Ctrl-X');

      // Send CTRL+X for a soft reset
      serialService.send('\x18')
        .then(success => {
          if (success) {
            showToast('Machine reset command sent');
          } else {
            logToConsole('error', 'Failed to reset machine: No response');
          }
        })
        .catch(error => {
          logToConsole('error', `Error resetting machine: ${error.message}`);
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
    if (!isConnected) {
      logToConsole('error', 'Cannot move to position: Not connected to machine');
      showToast('Cannot move to position: Not connected to machine');
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

    // Send the command to the serial port
    serialService.send(gcode)
      .then(success => {
        if (success) {
          showToast(`Moving to ${positionView} position`);
        } else {
          logToConsole('error', 'Failed to move to position: No response from machine');
        }
      })
      .catch(error => {
        logToConsole('error', `Error moving to position: ${error.message}`);
      });
  };


  // Initialize target position from current position
  useEffect(() => {
    setTargetPosition({ ...position[positionView] });
  }, [showExactPositionInput, positionView, position]);

  // Listen to FluidNC position updates
  useEffect(() => {
    const handlePositionTelemetry = (event) => {
      const data = event.detail;
      
      if (data && data.type === 'response' && data.data) {
        // Check if this is a status message in GRBL format: <status|MPos:x,y,z|...>
        if (data.data.startsWith('<') && data.data.includes('|MPos:')) {
          try {
            // Parse machine position (MPos)
            const mPosMatch = data.data.match(/MPos:([^,|]+),([^,|]+),([^,|]+)/);
            // Parse work coordinate offset (WCO)
            const wcoMatch = data.data.match(/WCO:([^,|]+),([^,|]+),([^,|]+)/);
            
            if (mPosMatch) {
              // Extract machine positions
              const worldX = parseFloat(mPosMatch[1]) || 0;
              const worldY = parseFloat(mPosMatch[2]) || 0;
              const worldZ = parseFloat(mPosMatch[3]) || 0;
              
              // Create a copy of the current position to update
              const newPosition = {
                work: { ...position.work },
                world: {
                  x: worldX,
                  y: worldY,
                  z: worldZ,
                  a: position.world.a // Preserve A value as it might not be in MPos
                }
              };
              
              // If WCO data is available, update work coordinates
              if (wcoMatch) {
                const wcoX = parseFloat(wcoMatch[1]) || 0;
                const wcoY = parseFloat(wcoMatch[2]) || 0;
                const wcoZ = parseFloat(wcoMatch[3]) || 0;
                
                // Calculate work positions by subtracting offsets
                newPosition.work.x = worldX - wcoX;
                newPosition.work.y = worldY - wcoY;
                newPosition.work.z = worldZ - wcoZ;
                // A axis usually not included in basic WCO reports
              } else {
                // If no WCO data, calculate work position based on 
                // the difference between the previous world and work positions
                const previousWorldX = position.world.x;
                const previousWorldY = position.world.y;
                const previousWorldZ = position.world.z;
                
                // Calculate the offsets from previous known positions
                const offsetX = previousWorldX - position.work.x;
                const offsetY = previousWorldY - position.work.y;
                const offsetZ = previousWorldZ - position.work.z;
                
                // Apply these same offsets to the new world position
                newPosition.work.x = worldX - offsetX;
                newPosition.work.y = worldY - offsetY;
                newPosition.work.z = worldZ - offsetZ;
              }
              
              // Update position state
              setPosition(newPosition);
            }
          } catch (error) {
            console.error("Error parsing position status:", error);
          }
        }
      }
    };
    
    // Listen for status data
    document.addEventListener('serialdata', handlePositionTelemetry);
    
    return () => {
      document.removeEventListener('serialdata', handlePositionTelemetry);
    };
  }, [position]); // Add position to dependencies

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
                  disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
              >
                <span className="triangle-left"></span>
                <span className="axis-text">A-</span>
              </button>
              <button
                className="jog-btn home-a"
                onClick={() => homeAxes('a')}
                title="Home A"
                disabled={!isConnected}
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
                disabled={!isConnected}
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
              disabled={!isConnected}
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
              disabled={!isConnected}
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
              disabled={!isConnected}
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
            disabled={!isConnected}
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
            disabled={!isConnected}
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
            disabled={!isConnected}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Go To Zero
          </button>

          <button
            className="global-btn stop-btn"
            onClick={handleStop}
            disabled={!isConnected}
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
              disabled={!isConnected}
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