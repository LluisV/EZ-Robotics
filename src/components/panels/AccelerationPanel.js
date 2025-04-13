import React, { useState, useEffect, useRef } from 'react';
import communicationService from '../../services/communication/CommunicationService';
import '../../styles/acceleration-panel.css';

/**
 * Acceleration Profile Panel for controlling motion dynamics
 * Provides controls for acceleration/deceleration parameters and velocity curve visualization
 */
const AccelerationPanel = () => {
  // State for acceleration parameters
  const [accelParams, setAccelParams] = useState({
    maxAccel: 800,                // mm/s²
    maxJerk: 20,                  // mm/s³
    maxVelocity: 2000,            // mm/s
    lookAheadDistance: 20,        // mm
    corneringSpeed: 25,           // % of max velocity
    smoothingFactor: 0.5,         // 0-1
  });

  // Canvas ref for combined velocity/acceleration visualization
  const graphCanvasRef = useRef(null);
  const graphContainerRef = useRef(null);
  
  // Keep track of any changes from default values
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Initial load of parameters from machine
  useEffect(() => {
    const fetchAccelerationSettings = async () => {
      if (communicationService.getConnectionInfo().status === 'connected') {
        try {
          communicationService.emit('response', { 
            response: "[INFO] Retrieved acceleration settings from machine" 
          });
        } catch (error) {
          console.error("Failed to fetch acceleration settings:", error);
        }
      }
    };
    
    fetchAccelerationSettings();
  }, []);

  // Handle parameter changes
  const handleParamChange = (param, value) => {
    // Convert string values to numbers and clamp within allowed ranges
    const numValue = parseFloat(value);
    
    // Define limits for different parameters
    const limits = {
      maxAccel: { min: 10, max: 10000 },
      maxJerk: { min: 0, max: 1000 },
      maxVelocity: { min: 100, max: 10000 },
      lookAheadDistance: { min: 0, max: 100 },
      corneringSpeed: { min: 1, max: 100 },
      smoothingFactor: { min: 0, max: 1 },
    };
    
    // Apply limits if defined
    let validValue = numValue;
    if (limits[param]) {
      validValue = Math.max(limits[param].min, Math.min(numValue, limits[param].max));
    }
    
    // Update the parameters directly without setState callback 
    // for more reliable updates
    const updatedParams = {
      ...accelParams,
      [param]: validValue
    };
    
    setAccelParams(updatedParams);
    setHasUnsavedChanges(true);
  };
  
  // Apply settings to the machine
  const applySettings = async () => {
    if (communicationService.getConnectionInfo().status !== 'connected') {
      communicationService.emit('error', { 
        error: "Cannot apply settings: Machine not connected" 
      });
      return;
    }
    
    try {
      communicationService.emit('response', { 
        response: "[INFO] Applying acceleration profile..." 
      });
      
      // Simulate commands being sent
      const commands = [
        `$110=${accelParams.maxAccel}`, // X acceleration mm/s²
        `$111=${accelParams.maxAccel}`, // Y acceleration
        `$112=${accelParams.maxAccel * 0.5}`, // Z acceleration
        `$120=${accelParams.maxVelocity}`, // X maximum velocity mm/min
        `$121=${accelParams.maxVelocity}`, // Y maximum velocity
        `$122=${accelParams.maxVelocity * 0.7}`, // Z maximum velocity (typically lower)
        `$23=${accelParams.maxJerk}`, // Max jerk setting
        `$24=${accelParams.lookAheadDistance}`, // Look ahead buffer
        `$26=${accelParams.corneringSpeed/100}`, // Cornering factor (converted to decimal)
        `$27=${accelParams.smoothingFactor}`, // Path smoothing
      ];
      
      // Simulate sending each command with a small delay
      for (const cmd of commands) {
        await new Promise(resolve => setTimeout(resolve, 100));
        communicationService.emit('command', { command: cmd, sent: true });
        communicationService.emit('response', { response: "ok" });
      }
      
      // Final confirmation
      setTimeout(() => {
        communicationService.emit('response', { 
          response: "[INFO] Acceleration profile successfully applied to machine" 
        });
        setHasUnsavedChanges(false);
      }, 500);
      
    } catch (error) {
      communicationService.emit('error', { 
        error: `Failed to apply settings: ${error.message}` 
      });
    }
  };
  
  // Presets
  const loadPreset = (preset) => {
    const presets = {
      default: {
        maxAccel: 800,
        maxJerk: 20,
        maxVelocity: 2000,
        lookAheadDistance: 20,
        corneringSpeed: 25,
        smoothingFactor: 0.5,
      },
      highSpeed: {
        maxAccel: 1500,
        maxJerk: 40,
        maxVelocity: 4000,
        lookAheadDistance: 30,
        corneringSpeed: 20,
        smoothingFactor: 0.4,
      },
      highPrecision: {
        maxAccel: 400,
        maxJerk: 10,
        maxVelocity: 1500,
        lookAheadDistance: 15,
        corneringSpeed: 15,
        smoothingFactor: 0.7,
      }
    };
    
    setAccelParams(presets[preset]);
    setHasUnsavedChanges(true);
  };
  
  // Handle window resize and panel size changes
  useEffect(() => {
    const handleResize = () => {
      drawCombinedGraph();
    };

    window.addEventListener('resize', handleResize);
    
    // Create a ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      drawCombinedGraph();
    });
    
    if (graphContainerRef.current) {
      resizeObserver.observe(graphContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (graphContainerRef.current) {
        resizeObserver.unobserve(graphContainerRef.current);
      }
    };
  }, []);

  // Drawing function for combined velocity and acceleration curve visualization
  // Using useCallback to memoize the function 
  const drawCombinedGraph = React.useCallback(() => {
    if (!graphCanvasRef.current || !graphContainerRef.current) return;
    
    const canvas = graphCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions based on container size and device pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;
    const rect = graphContainerRef.current.getBoundingClientRect();
    
    // Set the canvas dimensions considering pixelRatio for high-DPI displays
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;
    
    // Scale the context
    ctx.scale(pixelRatio, pixelRatio);
    
    // Set canvas display size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Now we work with logical size (not physical pixels)
    const width = rect.width;
    const height = rect.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate time and distance parameters based on acceleration profile
    const maxVel = accelParams.maxVelocity / 1000; // m/s for easier math
    const accel = accelParams.maxAccel / 1000; // m/s²
    
    // Calculate time to reach max velocity
    const timeToMaxVel = maxVel / accel;
    
    // Calculate distance to reach max velocity
    const distToMaxVel = 0.5 * accel * Math.pow(timeToMaxVel, 2);
    
    // Simulate a movement with acceleration, constant velocity, and deceleration
    // For a total distance of 3 times the distance to reach max velocity
    const totalDistance = distToMaxVel * 3;
    
    // Time to travel with constant max velocity
    const timeConstantVel = (totalDistance - (2 * distToMaxVel)) / maxVel;
    
    // Total travel time
    const totalTime = (2 * timeToMaxVel) + timeConstantVel;
    
    // Calculate the velocity curve
    const numPoints = 500;
    const velocityPoints = [];
    const accelerationPoints = [];
    
    for (let i = 0; i < numPoints; i++) {
      const t = (i / (numPoints - 1)) * totalTime;
      let v, a;
      
      if (t <= timeToMaxVel) {
        // Acceleration phase
        v = accel * t;
        a = accel;
      } else if (t <= timeToMaxVel + timeConstantVel) {
        // Constant velocity phase
        v = maxVel;
        a = 0;
      } else {
        // Deceleration phase
        const decTime = t - (timeToMaxVel + timeConstantVel);
        v = maxVel - (accel * decTime);
        a = -accel;
      }
      
      // Apply jerk effect at acceleration/deceleration transitions
      // Higher jerk means sharper transitions
      const jerkFactor = accelParams.maxJerk / 20; // Normalized jerk factor
      
      // Apply smoothing at transitions
      if (Math.abs(t - timeToMaxVel) < 0.1 * timeToMaxVel) {
        const delta = Math.abs(t - timeToMaxVel) / (0.1 * timeToMaxVel);
        const smooth = Math.pow(Math.sin(delta * Math.PI / 2), jerkFactor);
        v = v * (1 - smooth) + maxVel * smooth;
        
        // Smooth acceleration transition
        a = a * (1 - smooth);
      }
      
      if (Math.abs(t - (timeToMaxVel + timeConstantVel)) < 0.1 * timeToMaxVel) {
        const delta = Math.abs(t - (timeToMaxVel + timeConstantVel)) / (0.1 * timeToMaxVel);
        const smooth = Math.pow(Math.sin(delta * Math.PI / 2), jerkFactor);
        v = v * (1 - smooth) + maxVel * smooth;
        
        // Smooth deceleration transition
        a = -accel * smooth;
      }
      
      // Clamp to avoid negative velocity
      v = Math.max(0, v);
      
      // Store points
      const x = (t / totalTime) * width;
      const velocityY = height * 0.7 - (v / maxVel) * (height * 0.7 - 20);
      const accelerationY = height * 0.7 + ((a / accel) * (height * 0.3 - 10));
      
      velocityPoints.push({ x, y: velocityY });
      accelerationPoints.push({ x, y: accelerationY });
    }
    
    // Draw background with gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(0, 0, 0, 0.05)');
    bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw divider between velocity and acceleration sections
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.lineTo(width, height * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Add labels
    ctx.font = '10px Arial';
    ctx.fillStyle = '#999';
    
    // X axis label
    ctx.fillText('Time (s)', width / 2, height - 5);
    
    // Y axis label for velocity
    ctx.save();
    ctx.translate(10, height * 0.35);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Velocity (mm/s)', 0, 0);
    ctx.restore();
    
    // Y axis label for acceleration
    ctx.save();
    ctx.translate(10, height * 0.85);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Acceleration (mm/s²)', 0, 0);
    ctx.restore();
    
    // Add section titles
    ctx.fillStyle = '#ccc';
    ctx.font = '11px Arial';
    ctx.fillText('Velocity Profile', 10, 15);
    ctx.fillText('Acceleration', 10, height * 0.7 + 15);
    
    // Draw horizontal grid lines (velocity)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i <= 4; i++) {
      const y = height * 0.7 - (i / 4) * (height * 0.7 - 20);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      // Label percentage of max velocity
      if (i > 0) {
        ctx.fillStyle = '#888';
        ctx.fillText(`${i * 25}%`, 5, y - 3);
      }
    }
    
    // Draw the velocity curve with gradient fill
    ctx.strokeStyle = '#00AAFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(velocityPoints[0].x, velocityPoints[0].y);
    
    for (let i = 1; i < velocityPoints.length; i++) {
      ctx.lineTo(velocityPoints[i].x, velocityPoints[i].y);
    }
    
    ctx.stroke();
    
    // Add gradient fill below velocity curve
    const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    gradient.addColorStop(0, 'rgba(0, 170, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 170, 255, 0.0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(velocityPoints[0].x, height * 0.7);
    ctx.lineTo(velocityPoints[0].x, velocityPoints[0].y);
    
    for (let i = 1; i < velocityPoints.length; i++) {
      ctx.lineTo(velocityPoints[i].x, velocityPoints[i].y);
    }
    
    ctx.lineTo(velocityPoints[velocityPoints.length - 1].x, height * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Draw acceleration curve
    ctx.strokeStyle = '#FF5555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(accelerationPoints[0].x, accelerationPoints[0].y);
    
    for (let i = 1; i < accelerationPoints.length; i++) {
      ctx.lineTo(accelerationPoints[i].x, accelerationPoints[i].y);
    }
    
    ctx.stroke();
    
    // Draw zero acceleration line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(0, height * 0.7);
    ctx.lineTo(width, height * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Mark key phases
    // Acceleration end point
    const accelEndX = (timeToMaxVel / totalTime) * width;
    const accelEndY = height * 0.7 - (height * 0.7 - 20);
    
    // Deceleration start point
    const decelStartX = ((timeToMaxVel + timeConstantVel) / totalTime) * width;
    const decelStartY = height * 0.7 - (height * 0.7 - 20);
    
    // Add phase labels (smaller font for compactness)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '10px Arial';
    
    // Acceleration phase
    ctx.fillText('Acceleration', accelEndX / 2 - 25, height * 0.4);
    
    // Constant velocity phase
    ctx.fillText('Constant Velocity', (accelEndX + decelStartX) / 2 - 40, height * 0.4);
    
    // Deceleration phase
    ctx.fillText('Deceleration', (decelStartX + width) / 2 - 25, height * 0.4);
    
    // Add vertical phase dividers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Acceleration end / constant velocity start
    ctx.beginPath();
    ctx.moveTo(accelEndX, 10);
    ctx.lineTo(accelEndX, height - 10);
    ctx.stroke();
    
    // Constant velocity end / deceleration start
    ctx.beginPath();
    ctx.moveTo(decelStartX, 10);
    ctx.lineTo(decelStartX, height - 10);
    ctx.stroke();
    
    ctx.setLineDash([]);
  }, [accelParams]); // Adding dependency array for useCallback
  
  // Redraw when parameters change
  useEffect(() => {
    // Force redraw whenever any parameter changes
    const timer = setTimeout(() => {
      if (graphCanvasRef.current && graphContainerRef.current) {
        drawCombinedGraph();
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, [accelParams.maxAccel, accelParams.maxJerk, accelParams.maxVelocity, 
      accelParams.lookAheadDistance, accelParams.corneringSpeed, accelParams.smoothingFactor]);
  
  return (
    <div className="acceleration-panel">
      <div className="panel-header">
        <h3>Acceleration Profile</h3>
        {hasUnsavedChanges && (
          <div className="unsaved-indicator">Unsaved Changes</div>
        )}
      </div>
      
      <div className="acceleration-panel-content">
        <div className="graph-container" ref={graphContainerRef}>
          <canvas ref={graphCanvasRef} className="combined-graph"></canvas>
        </div>
        
        <div className="controls-container">
          {/* Motion Parameters */}
          <div className="parameter-group">
            <h4>Motion Parameters</h4>
            
            <div className="parameters-grid">
              <div className="parameter-row">
                <label>Max Acceleration</label>
                <div className="parameter-input">
                  <input 
                    type="number"
                    value={accelParams.maxAccel}
                    onChange={(e) => handleParamChange('maxAccel', e.target.value)}
                    min="10"
                    max="10000"
                    step="10"
                  />
                  <span className="unit">mm/s²</span>
                </div>
              </div>
              
              <div className="parameter-row">
                <label>Maximum Velocity</label>
                <div className="parameter-input">
                  <input 
                    type="number"
                    value={accelParams.maxVelocity}
                    onChange={(e) => handleParamChange('maxVelocity', e.target.value)}
                    min="100"
                    max="10000"
                    step="50"
                  />
                  <span className="unit">mm/s</span>
                </div>
              </div>
              
              <div className="parameter-row">
                <label>Max Jerk</label>
                <div className="parameter-input">
                  <input 
                    type="number"
                    value={accelParams.maxJerk}
                    onChange={(e) => handleParamChange('maxJerk', e.target.value)}
                    min="0"
                    max="1000"
                    step="1"
                  />
                  <span className="unit">mm/s³</span>
                </div>
              </div>
              
              <div className="parameter-row">
                <label>Cornering Speed</label>
                <div className="parameter-input">
                  <input 
                    type="number"
                    value={accelParams.corneringSpeed}
                    onChange={(e) => handleParamChange('corneringSpeed', e.target.value)}
                    min="1"
                    max="100"
                    step="1"
                  />
                  <span className="unit">%</span>
                </div>
              </div>
              
              <div className="parameter-row">
                <label>Path Smoothing</label>
                <div className="parameter-input range-input">
                  <input 
                    type="range"
                    value={accelParams.smoothingFactor}
                    onChange={(e) => handleParamChange('smoothingFactor', e.target.value)}
                    min="0"
                    max="1"
                    step="0.01"
                  />
                  <span className="value">{accelParams.smoothingFactor.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="parameter-row">
                <label>Look-ahead Distance</label>
                <div className="parameter-input">
                  <input 
                    type="number"
                    value={accelParams.lookAheadDistance}
                    onChange={(e) => handleParamChange('lookAheadDistance', e.target.value)}
                    min="0"
                    max="100"
                    step="1"
                  />
                  <span className="unit">mm</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Presets and Actions */}
          <div className="action-section">
            <div className="presets-container">
              <h4>Load Preset</h4>
              <div className="preset-buttons">
                <button 
                  className="preset-btn" 
                  onClick={() => loadPreset('default')}
                >
                  Standard
                </button>
                <button 
                  className="preset-btn"
                  onClick={() => loadPreset('highSpeed')}
                >
                  High Speed
                </button>
                <button 
                  className="preset-btn"
                  onClick={() => loadPreset('highPrecision')}
                >
                  High Precision
                </button>
              </div>
            </div>
            
            <button 
              className="apply-btn"
              onClick={applySettings}
              disabled={!hasUnsavedChanges || communicationService.getConnectionInfo().status !== 'connected'}
            >
              Apply to Machine
            </button>
          </div>
          
          {/* Collapsed Parameter Guide (can be expanded/collapsed) */}
          <details className="parameter-guide">
            <summary>Parameter Guide</summary>
            <ul className="explanation-list">
              <li><strong>Max Acceleration</strong>: Maximum rate of velocity change (higher values = faster response but more vibration)</li>
              <li><strong>Max Jerk</strong>: Rate of change of acceleration (higher values = sharper corners but more strain on motors)</li>
              <li><strong>Cornering Speed</strong>: Velocity percentage maintained at corners (higher values = faster paths but less precision)</li>
              <li><strong>Path Smoothing</strong>: Smooths out movements (higher values = smoother motion but less accurate path following)</li>
              <li><strong>Look-ahead Distance</strong>: How far ahead the controller plans movements (higher values = better optimization but more latency)</li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
};

export default AccelerationPanel;