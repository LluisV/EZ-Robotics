import React, { useState, useEffect, useRef } from 'react';

/**
 * MonitorPanel component for displaying FluidNC status information with tabbed layout.
 * Uses real FluidNC status data formatting based on the provided documentation.
 */
const MonitorPanel = () => {
  // State for tab selection
  const [activeTab, setActiveTab] = useState('overview');
  
  // State for performance histories
  const [historyData, setHistoryData] = useState({
    speedHistory: Array(30).fill(0),
    accelerationHistory: Array(30).fill(0),
    jerkHistory: Array(30).fill(0),
    tempHistory: Array(30).fill(0),
    // Add position history for each axis
    positionHistory: {
      x: Array(30).fill(0),
      y: Array(30).fill(0),
      z: Array(30).fill(0)
    }
  });
  
  // State for position, feed, and spindle information
  const [statusData, setStatusData] = useState({
    connected: false,
    state: 'Unknown',
    position: { x: 0, y: 0, z: 0, a: 0 },
    machine: { x: 0, y: 0, z: 0, a: 0 },
    workOffset: { x: 0, y: 0, z: 0, a: 0 },
    feedRate: 0,
    spindleSpeed: 0,
    temperature: 25.0, // Default temperature value
    buffer: { available: 15, total: 128 },
    overrides: { feed: 100, rapid: 100, spindle: 100 }
  });
  
  // State for limit switch information
  const [limitSwitches, setLimitSwitches] = useState({
    x: { min: false, max: false },
    y: { min: false, max: false },
    z: { min: false, max: false },
    probe: false,
    door: false,
    hardLimits: true,
    softLimits: true
  });
  
  // Reference for canvas elements
  const velocityCanvasRef = useRef(null);
  const accelerationCanvasRef = useRef(null);
  const jerkCanvasRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const positionHistoryCanvasRef = useRef(null);
  
  // For tracking derived kinematic values
  const velocityHistoryRef = useRef([]);
  const timeHistoryRef = useRef([]);
  const maxDataPoints = 30;
  
  // Reference for tracking the last update time
  const lastUpdateTimeRef = useRef(Date.now());
  const noUpdateIntervalRef = useRef(null);
  
  /**
   * Calculate acceleration and jerk from velocity history
   * @param {Array<number>} velocities - Array of velocities in mm/min
   * @param {Array<number>} times - Array of timestamps
   * @returns {Object} Object with acceleration and jerk values
   */
  const calculateKinematics = (velocities, times) => {
    if (velocities.length < 2 || times.length < 2) {
      return { acceleration: 0, jerk: 0 };
    }

    // Convert velocities from mm/min to mm/s for calculations
    const velocitiesInMmPerSec = velocities.map(v => v / 60);

    // Calculate accelerations (first derivative of velocity)
    const accelerations = [];
    for (let i = 1; i < velocitiesInMmPerSec.length; i++) {
      const deltaVel = velocitiesInMmPerSec[i] - velocitiesInMmPerSec[i-1];
      const deltaTime = (times[i] - times[i-1]) / 1000; // convert to seconds
      if (deltaTime > 0) {
        accelerations.push(deltaVel / deltaTime);
      } else {
        accelerations.push(0);
      }
    }

    // Calculate jerk (first derivative of acceleration)
    const jerks = [];
    for (let i = 1; i < accelerations.length; i++) {
      const deltaAcc = accelerations[i] - accelerations[i-1];
      const deltaTime = (times[i] - times[i-1]) / 1000; // convert to seconds
      if (deltaTime > 0) {
        jerks.push(deltaAcc / deltaTime);
      } else {
        jerks.push(0);
      }
    }

    // Return the most recent values, or 0 if not enough data
    return {
      acceleration: accelerations.length > 0 ? accelerations[accelerations.length - 1] : 0,
      jerk: jerks.length > 0 ? jerks[jerks.length - 1] : 0
    };
  };

  /**
   * Parse FluidNC status message format
   * @param {string} message - The status message from FluidNC
   * @returns {Object|null} Parsed status data or null if parsing failed
   */
  const parseStatusMessage = (message) => {
    try {
      // Check if it's a FluidNC/GRBL status message
      // Format: <state|MPos:x,y,z|WCO:x,y,z|Bf:available,total|FS:feed,speed|WPos:x,y,z|Ov:feed,rapid,spindle>
      if (message.startsWith('<') && message.includes('|')) {
        // Parse the state
        const stateMatch = message.match(/<([^|>]+)/);
        const state = stateMatch ? stateMatch[1].trim() : "Unknown";
        
        // Parse machine position (MPos)
        const mPosMatch = message.match(/MPos:([^,]+),([^,]+),([^,|]+)/);
        
        // Parse work position (WPos)
        const wPosMatch = message.match(/WPos:([^,]+),([^,]+),([^,|]+)/);
        
        // Parse work coordinate offset (WCO)
        const wcoMatch = message.match(/WCO:([^,]+),([^,]+),([^,|]+)/);
        
        // Parse buffer status (Bf)
        const bfMatch = message.match(/Bf:([^,]+),([^|]+)/);
        
        // Parse feed and speed (FS)
        const fsMatch = message.match(/FS:([^,]+),([^|]+)/);
        
        // Parse overrides (Ov)
        const ovMatch = message.match(/Ov:([^,]+),([^,]+),([^|>]+)/);
        
        // Build the status data object
        const statusData = {
          state: state,
          connected: true,
        };
        
        // Extract machine position if available
        if (mPosMatch) {
          statusData.machine = {
            x: parseFloat(mPosMatch[1]) || 0,
            y: parseFloat(mPosMatch[2]) || 0,
            z: parseFloat(mPosMatch[3]) || 0,
            a: 0 // Assuming A is not present in basic status
          };
        }
        
        // Extract work position if available
        if (wPosMatch) {
          statusData.position = {
            x: parseFloat(wPosMatch[1]) || 0,
            y: parseFloat(wPosMatch[2]) || 0,
            z: parseFloat(wPosMatch[3]) || 0,
            a: 0 // Assuming A is not present in basic status
          };
        } else if (mPosMatch && wcoMatch) {
          // Calculate work position from machine position and work offset
          const wcoX = parseFloat(wcoMatch[1]) || 0;
          const wcoY = parseFloat(wcoMatch[2]) || 0;
          const wcoZ = parseFloat(wcoMatch[3]) || 0;
          
          statusData.position = {
            x: statusData.machine.x - wcoX,
            y: statusData.machine.y - wcoY,
            z: statusData.machine.z - wcoZ,
            a: statusData.machine.a  // Assuming A offset is 0
          };
          
          statusData.workOffset = {
            x: wcoX,
            y: wcoY,
            z: wcoZ,
            a: 0
          };
        }
        
        // Extract buffer info if available
        if (bfMatch) {
          statusData.buffer = {
            available: parseInt(bfMatch[1], 10) || 0,
            total: parseInt(bfMatch[2], 10) || 0
          };
        }
        
        // Extract feed and speed if available
        if (fsMatch) {
          statusData.feedRate = parseFloat(fsMatch[1]) || 0;
          statusData.spindleSpeed = parseFloat(fsMatch[2]) || 0;
        }
        
        // Extract overrides if available
        if (ovMatch) {
          statusData.overrides = {
            feed: parseInt(ovMatch[1], 10) || 100,
            rapid: parseInt(ovMatch[2], 10) || 100,
            spindle: parseInt(ovMatch[3], 10) || 100
          };
        }
        
        return statusData;
      }
      return null;
    } catch (error) {
      console.error("Error parsing status message:", error);
      return null;
    }
  };

  /**
   * Update the charts with a zero value when no updates are received
   */
  const updateChartsWithZeroValue = () => {
    const currentTime = Date.now();
    const timeSinceLastUpdate = currentTime - lastUpdateTimeRef.current;
    
    // If no updates for 250ms, start adding zeros for velocity, acceleration, and jerk
    if (timeSinceLastUpdate >= 110) {
      // Add a zero value with the current timestamp
      velocityHistoryRef.current.push(0);
      timeHistoryRef.current.push(currentTime);
      
      // Limit history size
      while (velocityHistoryRef.current.length > maxDataPoints) {
        velocityHistoryRef.current.shift();
        timeHistoryRef.current.shift();
      }
      
      // Calculate kinematics with the new zero values
      const kinematics = calculateKinematics(
        velocityHistoryRef.current, 
        timeHistoryRef.current
      );
      
      // Update history data for charts
      setHistoryData(prev => {
        return {
          speedHistory: [...prev.speedHistory.slice(1), 0],
          accelerationHistory: [...prev.accelerationHistory.slice(1), kinematics.acceleration],
          jerkHistory: [...prev.jerkHistory.slice(1), kinematics.jerk],
          tempHistory: [...prev.tempHistory.slice(1), prev.tempHistory[prev.tempHistory.length-1] || 0],
          positionHistory: prev.positionHistory // Keep position history unchanged
        };
      });
    }
  };

  /**
   * Listen for machine status updates
   */
  useEffect(() => {
    const handlePositionStatus = (event) => {
  const data = event.detail;
  
  // Remove the check for data.type === 'response' since SerialCommunicationService 
  // doesn't send that structure
  if (data && data.data) {
    // Check if this is a status message in FluidNC/GRBL format
    if (data.data.startsWith('<') && data.data.includes('|')) {
      try {
        // Update last update time
        lastUpdateTimeRef.current = Date.now();
        
        const parsedStatus = parseStatusMessage(data.data);
        if (!parsedStatus) return;
        
        // Update status data
        setStatusData(prev => ({
          ...prev,
          ...parsedStatus
        }));
        
        // Track velocity for kinematics calculations
        const timestamp = Date.now();
        
        if (parsedStatus.feedRate !== undefined) {
          velocityHistoryRef.current.push(parsedStatus.feedRate);
          timeHistoryRef.current.push(timestamp);
        }
        
        // Limit history size
        while (velocityHistoryRef.current.length > maxDataPoints) {
          velocityHistoryRef.current.shift();
          timeHistoryRef.current.shift();
        }
        
        // Calculate acceleration and jerk
        const kinematics = calculateKinematics(
          velocityHistoryRef.current, 
          timeHistoryRef.current
        );
        
        // Update history data for charts and position history
        setHistoryData(prev => {
          // Update position history if we have position data
          let newPositionHistory = { ...prev.positionHistory };
          
          if (parsedStatus.position) {
            newPositionHistory = {
              x: [...prev.positionHistory.x.slice(1), parsedStatus.position.x || 0],
              y: [...prev.positionHistory.y.slice(1), parsedStatus.position.y || 0],
              z: [...prev.positionHistory.z.slice(1), parsedStatus.position.z || 0]
            };
          }
          
          return {
            speedHistory: [...prev.speedHistory.slice(1), parsedStatus.feedRate || 0],
            accelerationHistory: [...prev.accelerationHistory.slice(1), kinematics.acceleration],
            jerkHistory: [...prev.jerkHistory.slice(1), kinematics.jerk],
            tempHistory: [...prev.tempHistory.slice(1), prev.tempHistory[prev.tempHistory.length-1] || 0],
            positionHistory: newPositionHistory
          };
        });
        
      } catch (error) {
        console.error("Error processing status data:", error);
      }
    }
  }
};
    
    // Listen for status data from serial port
    document.addEventListener('serialdata', handlePositionStatus);
    
    // Set up interval to check for lack of updates and add zero values if needed
    noUpdateIntervalRef.current = setInterval(updateChartsWithZeroValue, 100);
    
    return () => {
      document.removeEventListener('serialdata', handlePositionStatus);
      // Clear the interval when component unmounts
      if (noUpdateIntervalRef.current) {
        clearInterval(noUpdateIntervalRef.current);
      }
    };
  }, []);

  /**
   * Parse FluidNC limit switch information
   */
  useEffect(() => {
    const handleLimitSwitchStatus = (event) => {
      const data = event.detail;
      
      if (data && data.type === 'response' && data.data) {
        try {
          // Look for GPIO/Dump response format
          // This is a custom handling based on the $GPIO/Dump command
          // Example: "0 GPIO0 I1" where I1 means input with value 1
          
          // For demonstration, we'll simulate parsing a GPIO dump
          // In a real implementation, you would need to map GPIO pins to specific limit switches
          
          // Sample parsing logic (to be replaced with actual implementation)
          if (data.data.includes('GPIO') && data.data.includes('I')) {
            // Update limit switch state if we see relevant GPIO data
            // This is highly dependent on your FluidNC configuration
            // For now, we'll leave the existing limit switch state
          }
        } catch (error) {
          console.error("Error parsing limit switch data:", error);
        }
      }
    };
    
    // Listen for GPIO dump data
    document.addEventListener('serialdata', handleLimitSwitchStatus);
    
    return () => {
      document.removeEventListener('serialdata', handleLimitSwitchStatus);
    };
  }, []);

  /**
   * Draw mini charts for performance metrics
   */
  useEffect(() => {
    const drawChart = (canvasRef, data, color, fillColor = null) => {
      if (!canvasRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Get actual container width and set canvas size to match
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth;
      
      // Set canvas dimensions to match container
      canvas.width = containerWidth;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      if (data.length < 2) return;
      
      // Calculate min and max for scaling
      const max = Math.max(...data.filter(n => !isNaN(n) && isFinite(n)));
      const min = Math.min(...data.filter(n => !isNaN(n) && isFinite(n)));
      const range = max - min || 1; // Avoid division by zero
      
      // Add padding to avoid drawing at the very edges
      const padding = 2;
      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;
      
      // Start drawing path
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      
      // Move to first point with padding
      const x0 = padding;
      const y0 = height - padding - ((data[0] - min) / range) * chartHeight;
      ctx.moveTo(x0, y0);
      
      // Draw line to each point
      for (let i = 1; i < data.length; i++) {
        const x = padding + (chartWidth * (i / (data.length - 1)));
        const y = height - padding - ((data[i] - min) / range) * chartHeight;
        ctx.lineTo(x, y);
      }
      
      // Stroke the line
      ctx.stroke();
      
      // Fill area under the line if fillColor provided
      if (fillColor) {
        const lastX = padding + chartWidth;
        const lastY = height - padding - ((data[data.length - 1] - min) / range) * chartHeight;
        
        ctx.lineTo(lastX, height - padding);
        ctx.lineTo(padding, height - padding);
        ctx.closePath();
        
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
    };
    
    /**
     * Draw position history chart
     */
    const drawPositionChart = () => {
      if (!positionHistoryCanvasRef.current) return;
      
      const canvas = positionHistoryCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Get actual container width and set canvas size to match
      const container = canvas.parentElement;
      const containerWidth = container.clientWidth;
      
      // Set canvas dimensions to match container
      canvas.width = containerWidth;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Set up chart area with padding
      const padding = 20;
      const chartWidth = width - 2 * padding;
      const chartHeight = height - 2 * padding;
      
      // Draw coordinate axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      
      // Draw X axis
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding);
      ctx.stroke();
      
      // Draw Y axis
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, height - padding);
      ctx.stroke();
      
      // Draw position history for each axis
      const drawAxisHistory = (data, color) => {
        if (data.length < 2) return;
        
        // Calculate min and max for scaling
        const max = Math.max(...data.filter(n => !isNaN(n) && isFinite(n)));
        const min = Math.min(...data.filter(n => !isNaN(n) && isFinite(n)));
        const range = Math.max(0.1, max - min); // Ensure non-zero range
        
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        
        // Move to first point
        const x0 = padding;
        const y0 = height - padding - (chartHeight * ((data[0] - min) / range));
        ctx.moveTo(x0, y0);
        
        // Draw line to each point
        for (let i = 1; i < data.length; i++) {
          const x = padding + (chartWidth * (i / (data.length - 1)));
          const y = height - padding - (chartHeight * ((data[i] - min) / range));
          ctx.lineTo(x, y);
        }
        
        ctx.stroke();
      };
      
      // Draw position data for each axis
      drawAxisHistory(historyData.positionHistory.x, 'var(--accent-red, #ff5252)');
      drawAxisHistory(historyData.positionHistory.y, 'var(--accent-green, #4caf50)');
      drawAxisHistory(historyData.positionHistory.z, 'var(--accent-blue, #2196f3)');
    };
    
    // Draw all charts
    drawChart(velocityCanvasRef, historyData.speedHistory, 'var(--accent-blue, #2196f3)', 'rgba(33, 150, 243, 0.1)');
    drawChart(accelerationCanvasRef, historyData.accelerationHistory, 'var(--accent-green, #4caf50)', 'rgba(76, 175, 80, 0.1)');
    drawChart(jerkCanvasRef, historyData.jerkHistory, 'var(--accent-orange, #ff9800)', 'rgba(255, 152, 0, 0.1)');
    drawChart(tempCanvasRef, historyData.tempHistory, 'var(--accent-red, #ff5252)', 'rgba(255, 82, 82, 0.1)');
    
    // Draw position history chart
    drawPositionChart();
    
  }, [historyData]);

  // Get connection status
  useEffect(() => {
    // Check initial connection state
    const checkConnectionStatus = () => {
      if (window.serialService && typeof window.serialService.getConnectionStatus === 'function') {
        const isConnected = window.serialService.getConnectionStatus();
        setStatusData(prev => ({
          ...prev,
          connected: isConnected
        }));
      }
    };
    
    // Listen for connection status changes
    const handleConnectionChange = (event) => {
      if (event.detail) {
        setStatusData(prev => ({
          ...prev,
          connected: !!event.detail.connected
        }));
      }
    };
    
    // Initial check
    checkConnectionStatus();
    
    // Set up event listener
    document.addEventListener('serialconnection', handleConnectionChange);
    
    return () => {
      document.removeEventListener('serialconnection', handleConnectionChange);
    };
  }, []);

  /**
   * Functionality to request the limit switch status from FluidNC
   */
  const requestLimitSwitchStatus = () => {
    if (window.sendSerialData && typeof window.sendSerialData === 'function') {
      window.sendSerialData('$GPIO/Dump');
    }
  };

  /**
   * Polling mechanism to update temperature
   * Since FluidNC doesn't provide temperature in standard status,
   * we simulate temperature readings based on a realistic pattern
   */
  useEffect(() => {
    const simulateTemperature = () => {
      setStatusData(prev => {
        // Create a realistic temperature pattern (in a real implementation, 
        // this would come from an actual temperature sensor on FluidNC)
        const newTemp = prev.temperature + (Math.random() * 0.2 - 0.1);
        return {
          ...prev,
          temperature: parseFloat(newTemp.toFixed(1))
        };
      });
      
      setHistoryData(prev => ({
        ...prev,
        tempHistory: [...prev.tempHistory.slice(1), statusData.temperature]
      }));
    };
    
    // Update temperature every 5 seconds
    const interval = setInterval(simulateTemperature, 5000);
    
    return () => clearInterval(interval);
  }, [statusData.temperature]);

  return (
    <div className="monitor-panel">
      {/* Status Header - Always visible, compact */}
      <div className="monitor-header">
        <div className="status-container">
          <div className="state-indicator">
            <span className={`state-dot state-${statusData.state.toLowerCase()}`}></span>
            <span className="state-text">{statusData.state}</span>
          </div>
          <div className="status-coordinates">
            <span className="status-label">G54</span>
            <span className="status-label">G90</span>
          </div>
        </div>
        
        <div className="connection-info">
          <span className="connection-text">{statusData.connected ? "Connected" : "Disconnected"}</span>
          <span className="version-label">FluidNC v3.7.2</span>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="tabs-container">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'position' ? 'active' : ''}`}
          onClick={() => setActiveTab('position')}
        >
          Position
        </button>
        <button 
          className={`tab-button ${activeTab === 'limits' ? 'active' : ''}`}
          onClick={() => setActiveTab('limits')}
          onDoubleClick={requestLimitSwitchStatus} // Double click to refresh limit switch data
        >
          Limit Switches
        </button>
        <button 
          className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('metrics')}
        >
          Performance
        </button>
      </div>
      
      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            <div className="grid-layout two-columns">
              {/* Position Summary */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Position (Work)</h3>
                  <button 
                    className="view-details-button"
                    onClick={() => setActiveTab('position')}
                  >
                    Details →
                  </button>
                </div>
                
                <div className="position-grid">
                  <div className="axis-position">
                    <div className="axis-badge x-axis">X</div>
                    <span className="axis-value">{statusData.position.x.toFixed(3)}</span>
                  </div>
                  
                  <div className="axis-position">
                    <div className="axis-badge y-axis">Y</div>
                    <span className="axis-value">{statusData.position.y.toFixed(3)}</span>
                  </div>
                  
                  <div className="axis-position">
                    <div className="axis-badge z-axis">Z</div>
                    <span className="axis-value">{statusData.position.z.toFixed(3)}</span>
                  </div>
                  
                  <div className="axis-position">
                    <div className="axis-badge a-axis">A</div>
                    <span className="axis-value">{statusData.position.a.toFixed(3)}</span>
                  </div>
                </div>
              </div>
              
              {/* Limit Switches Summary */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Limit Switches</h3>
                  <button 
                    className="view-details-button"
                    onClick={() => setActiveTab('limits')}
                  >
                    Details →
                  </button>
                </div>
                
                <div className="limits-grid">
                  <div className="limit-summary">
                    <span className="limit-axis x-axis-lim">X-Axis</span>
                    <div className="limit-indicators">
                      <span className={`limit-dot ${limitSwitches.x.min ? 'limit-active' : 'limit-inactive'}`}></span>
                      <span className={`limit-dot ${limitSwitches.x.max ? 'limit-active' : 'limit-inactive'}`}></span>
                    </div>
                  </div>
                  
                  <div className="limit-summary">
                    <span className="limit-axis y-axis-lim">Y-Axis</span>
                    <div className="limit-indicators">
                      <span className={`limit-dot ${limitSwitches.y.min ? 'limit-active' : 'limit-inactive'}`}></span>
                      <span className={`limit-dot ${limitSwitches.y.max ? 'limit-active' : 'limit-inactive'}`}></span>
                    </div>
                  </div>
                  
                  <div className="limit-summary">
                    <span className="limit-axis z-axis-lim">Z-Axis</span>
                    <div className="limit-indicators">
                      <span className={`limit-dot ${limitSwitches.z.min ? 'limit-active' : 'limit-inactive'}`}></span>
                      <span className={`limit-dot ${limitSwitches.z.max ? 'limit-active' : 'limit-inactive'}`}></span>
                    </div>
                  </div>
                </div>
                
                <div className="sensor-row">
                  <div className="sensor-item">
                    <span className={`limit-dot ${limitSwitches.probe ? 'limit-active' : 'limit-inactive'}`}></span>
                    <span className="sensor-label">Probe</span>
                  </div>
                  <div className="sensor-item">
                    <span className={`limit-dot ${limitSwitches.door ? 'limit-active' : 'limit-inactive'}`}></span>
                    <span className="sensor-label">Door</span>
                  </div>
                </div>
              </div>
              
              {/* Feed & Speed Summary */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Feed & Speed</h3>
                </div>
                
                <div className="feed-speed-container">
                  <div className="meter-item">
                    <div className="meter-label-row">
                      <span className="meter-label">Feed Rate</span>
                      <span className="meter-value primary-value">{statusData.feedRate.toFixed(0)} mm/min</span>
                    </div>
                    <div className="meter-bar">
                      <div 
                        className="meter-fill feed-fill"
                        style={{ width: `${Math.min((statusData.feedRate / 2000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="meter-item">
                    <div className="meter-label-row">
                      <span className="meter-label">Spindle</span>
                      <span className="meter-value spindle-value">
                        {statusData.spindleSpeed.toFixed(0)} RPM
                      </span>
                    </div>
                    <div className="meter-bar">
                      <div 
                        className="meter-fill spindle-fill"
                        style={{ width: `${Math.min((statusData.spindleSpeed / 24000) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Buffer Summary */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">System Status</h3>
                </div>
                
                <div className="system-status-container">
                  <div className="meter-item">
                    <div className="meter-label-row">
                      <span className="meter-label">Buffer Available</span>
                      <span className="meter-value">{statusData.buffer.available}/{statusData.buffer.total}</span>
                    </div>
                    <div className="meter-bar">
                      <div 
                        className="meter-fill buffer-fill"
                        style={{ width: `${Math.min((statusData.buffer.available / statusData.buffer.total) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="meter-item">
                    <div className="meter-label-row">
                      <span className="meter-label">Temperature</span>
                      <span className="meter-value temperature-value">{statusData.temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="meter-bar">
                      <div 
                        className="meter-fill temperature-fill"
                        style={{ width: `${Math.min((statusData.temperature / 80) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Performance Metrics Summary */}
              <div className="card full-width">
                <div className="card-header">
                  <h3 className="card-title">Performance Metrics</h3>
                  <button 
                    className="view-details-button"
                    onClick={() => setActiveTab('metrics')}
                  >
                    Details →
                  </button>
                </div>
                
                <div className="mini-charts-container">
                  <div className="mini-chart">
                    <div className="mini-chart-header">
                      <span className="mini-chart-title">Velocity</span>
                      <span className="mini-chart-value primary-value">{statusData.feedRate.toFixed(0)} mm/min</span>
                    </div>
                    <div className="chart-container">
                      <canvas ref={velocityCanvasRef} height="32"></canvas>
                    </div>
                  </div>
                  
                  <div className="mini-chart">
                    <div className="mini-chart-header">
                      <span className="mini-chart-title">Acceleration</span>
                      <span className="mini-chart-value">
                        {historyData.accelerationHistory[historyData.accelerationHistory.length - 1].toFixed(2)} mm/s²
                      </span>
                    </div>
                    <div className="chart-container">
                      <canvas ref={accelerationCanvasRef} height="32"></canvas>
                    </div>
                  </div>
                  
                  <div className="mini-chart">
                    <div className="mini-chart-header">
                      <span className="mini-chart-title">Jerk</span>
                      <span className="mini-chart-value">
                        {historyData.jerkHistory[historyData.jerkHistory.length - 1].toFixed(2)} mm/s³
                      </span>
                    </div>
                    <div className="chart-container">
                      <canvas ref={jerkCanvasRef} height="32"></canvas>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Position Tab */}
        {activeTab === 'position' && (
          <div className="position-tab">
            <div className="card full-width">
              <div className="card-header">
                <h3 className="card-title">Position Data</h3>
                <div className="coordinate-toggle">
                  <button className="toggle-button active">Work</button>
                  <button className="toggle-button">Machine</button>
                </div>
              </div>
              
              <div className="coordinate-grid">
                <div className="coordinate-card">
                  <div className="coordinate-header">
                    <div className="axis-badge x-axis-large">X</div>
                    <span className="axis-name">X-Axis</span>
                  </div>
                  <div className="coordinate-value primary-value">{statusData.position.x.toFixed(3)}</div>
                  <div className="alternate-coordinate">Machine: {statusData.machine.x.toFixed(3)} mm</div>
                </div>
                
                <div className="coordinate-card">
                  <div className="coordinate-header">
                    <div className="axis-badge y-axis-large">Y</div>
                    <span className="axis-name">Y-Axis</span>
                  </div>
                  <div className="coordinate-value primary-value">{statusData.position.y.toFixed(3)}</div>
                  <div className="alternate-coordinate">Machine: {statusData.machine.y.toFixed(3)} mm</div>
                </div>
                
                <div className="coordinate-card">
                  <div className="coordinate-header">
                    <div className="axis-badge z-axis-large">Z</div>
                    <span className="axis-name">Z-Axis</span>
                  </div>
                  <div className="coordinate-value primary-value">{statusData.position.z.toFixed(3)}</div>
                  <div className="alternate-coordinate">Machine: {statusData.machine.z.toFixed(3)} mm</div>
                </div>
                
                <div className="coordinate-card">
                  <div className="coordinate-header">
                    <div className="axis-badge a-axis-large">A</div>
                    <span className="axis-name">A-Axis</span>
                  </div>
                  <div className="coordinate-value primary-value">{statusData.position.a.toFixed(3)}</div>
                  <div className="alternate-coordinate">Machine: {statusData.machine.a.toFixed(3)} deg</div>
                </div>
              </div>
            </div>
            
            <div className="grid-layout two-columns">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Work Coordinate Offsets</h3>
                </div>
                
                <div className="offset-header-card">
                  <div className="offset-row">
                    <span className="offset-label">Active System</span>
                    <span className="offset-value highlight">G54</span>
                  </div>
                </div>
                
                <div className="offset-grid">
                  <div className="offset-header">Axis</div>
                  <div className="offset-header">G54 Offset</div>
                  <div className="offset-header">G92 Offset</div>
                  <div className="offset-header">Total Offset</div>
                  
                  <div className="offset-cell x-axis">X</div>
                  <div className="offset-cell">{statusData.workOffset.x.toFixed(3)}</div>
                  <div className="offset-cell">0.000</div>
                  <div className="offset-cell">{statusData.workOffset.x.toFixed(3)}</div>
                  
                  <div className="offset-cell y-axis">Y</div>
                  <div className="offset-cell">{statusData.workOffset.y.toFixed(3)}</div>
                  <div className="offset-cell">0.000</div>
                  <div className="offset-cell">{statusData.workOffset.y.toFixed(3)}</div>
                  
                  <div className="offset-cell z-axis">Z</div>
                  <div className="offset-cell">{statusData.workOffset.z.toFixed(3)}</div>
                  <div className="offset-cell">0.000</div>
                  <div className="offset-cell">{statusData.workOffset.z.toFixed(3)}</div>
                  
                  <div className="offset-cell a-axis">A</div>
                  <div className="offset-cell">{statusData.workOffset.a.toFixed(3)}</div>
                  <div className="offset-cell">0.000</div>
                  <div className="offset-cell">{statusData.workOffset.a.toFixed(3)}</div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Position History</h3>
                </div>
                
                <div className="position-history-chart">
                  {/* Position history visualization with our new canvas-based chart */}
                  <canvas ref={positionHistoryCanvasRef} height="200"></canvas>
                  <div className="position-legend">
                    <div className="legend-item">
                      <span className="legend-color x-axis-color"></span>
                      <span className="legend-text">X-Axis</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color y-axis-color"></span>
                      <span className="legend-text">Y-Axis</span>
                    </div>
                    <div className="legend-item">
                      <span className="legend-color z-axis-color"></span>
                      <span className="legend-text">Z-Axis</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Limit Switches Tab */}
        {activeTab === 'limits' && (
          <div className="limits-tab">
            <div className="card full-width">
              <div className="card-header">
                <h3 className="card-title">Limit Switches Status</h3>
              </div>
              
              <div className="limit-switches-grid">
                {/* X Axis */}
                <div className="limit-switch-card">
                  <div className="limit-switch-header">
                    <div className="axis-badge x-axis-large">X</div>
                    <span className="axis-name">X-Axis</span>
                  </div>
                  
                  <div className="limit-switch-row">
                    <div className="limit-switch-label">Minimum Limit</div>
                    <div className={`limit-switch-indicator ${limitSwitches.x.min ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                  
                  <div className="limit-switch-row">
                    <div className="limit-switch-label">Maximum Limit</div>
                    <div className={`limit-switch-indicator ${limitSwitches.x.max ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                </div>
                
                {/* Y Axis */}
                <div className="limit-switch-card">
                  <div className="limit-switch-header">
                    <div className="axis-badge y-axis-large">Y</div>
                    <span className="axis-name">Y-Axis</span>
                  </div>
                  
                  <div className="limit-switch-row">
                    <div className="limit-switch-label">Minimum Limit</div>
                    <div className={`limit-switch-indicator ${limitSwitches.y.min ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                  
                  <div className="limit-switch-row">
                    <div className="limit-switch-label">Maximum Limit</div>
                    <div className={`limit-switch-indicator ${limitSwitches.y.max ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                </div>
                
                {/* Z Axis */}
                <div className="limit-switch-card">
                  <div className="limit-switch-header">
                    <div className="axis-badge z-axis-large">Z</div>
                    <span className="axis-name">Z-Axis</span>
                  </div>
                  
                  <div className="limit-switch-row">
                    <div className="limit-switch-label">Minimum Limit</div>
                    <div className={`limit-switch-indicator ${limitSwitches.z.min ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                  
                  <div className="limit-switch-row">
                    <div className="limit-switch-label">Maximum Limit</div>
                    <div className={`limit-switch-indicator ${limitSwitches.z.max ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="grid-layout two-columns">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Additional Sensors</h3>
                </div>
                
                <div className="additional-sensors-grid">
                  <div className="sensor-card">
                    <div className="sensor-header">
                      <div className="sensor-badge probe-badge">P</div>
                      <span className="sensor-name">Probe</span>
                    </div>
                    <div className={`sensor-indicator ${limitSwitches.probe ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                  
                  <div className="sensor-card">
                    <div className="sensor-header">
                      <div className="sensor-badge door-badge">D</div>
                      <span className="sensor-name">Door</span>
                    </div>
                    <div className={`sensor-indicator ${limitSwitches.door ? 'limit-active' : 'limit-inactive'}`}></div>
                  </div>
                  
                  <div className="sensor-card">
                    <div className="sensor-header">
                      <div className="sensor-badge estop-badge">E</div>
                      <span className="sensor-name">E-Stop</span>
                    </div>
                    <div className="sensor-indicator limit-inactive"></div>
                  </div>
                  
                  <div className="sensor-card">
                    <div className="sensor-header">
                      <div className="sensor-badge fault-badge">F</div>
                      <span className="sensor-name">Fault</span>
                    </div>
                    <div className="sensor-indicator limit-inactive"></div>
                  </div>
                </div>
              </div>
              
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Limit Configuration</h3>
                </div>
                
                <div className="limit-config-container">
                  <div className="limit-config-row">
                    <span className="limit-config-label">Hard Limits</span>
                    <span className={`limit-config-value ${limitSwitches.hardLimits ? 'config-enabled' : 'config-disabled'}`}>
                      {limitSwitches.hardLimits ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  
                  <div className="limit-config-row">
                    <span className="limit-config-label">Soft Limits</span>
                    <span className={`limit-config-value ${limitSwitches.softLimits ? 'config-enabled' : 'config-disabled'}`}>
                      {limitSwitches.softLimits ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  
                  <div className="limit-config-row">
                    <span className="limit-config-label">Limit Pins Invert</span>
                    <span className="limit-config-value config-enabled">True</span>
                  </div>
                  
                  <div className="limit-config-row">
                    <span className="limit-config-label">Probe Invert</span>
                    <span className="limit-config-value config-disabled">False</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Performance Metrics Tab */}
        {activeTab === 'metrics' && (
          <div className="performance-tab">
            <div className="grid-layout two-columns">
              {/* Velocity Chart */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Velocity</h3>
                  <span className="metric-badge primary-value">{statusData.feedRate.toFixed(0)} mm/min</span>
                </div>
                
                <div className="large-chart-container">
                  <canvas ref={velocityCanvasRef} height="140"></canvas>
                </div>
                
                <div className="chart-stats">
                  <div className="stat-item">Min: 0</div>
                  <div className="stat-item">Avg: {(historyData.speedHistory.reduce((a, b) => a + b, 0) / historyData.speedHistory.length).toFixed(0)}</div>
                  <div className="stat-item">Max: {Math.max(...historyData.speedHistory).toFixed(0)}</div>
                </div>
              </div>
              
              {/* Acceleration Chart */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Acceleration</h3>
                  <span className="metric-badge">
                    {historyData.accelerationHistory[historyData.accelerationHistory.length - 1].toFixed(2)} mm/s²
                  </span>
                </div>
                
                <div className="large-chart-container">
                  <canvas ref={accelerationCanvasRef} height="140"></canvas>
                </div>
                
                <div className="chart-stats">
                  <div className="stat-item">Min: 0</div>
                  <div className="stat-item">Avg: {(historyData.accelerationHistory.reduce((a, b) => a + b, 0) / historyData.accelerationHistory.length).toFixed(2)}</div>
                  <div className="stat-item">Max: {Math.max(...historyData.accelerationHistory).toFixed(2)}</div>
                </div>
              </div>
              
              {/* Jerk Chart */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Jerk</h3>
                  <span className="metric-badge">
                    {historyData.jerkHistory[historyData.jerkHistory.length - 1].toFixed(2)} mm/s³
                  </span>
                </div>
                
                <div className="large-chart-container">
                  <canvas ref={jerkCanvasRef} height="140"></canvas>
                </div>
                
                <div className="chart-stats">
                  <div className="stat-item">Min: 0</div>
                  <div className="stat-item">Avg: {(historyData.jerkHistory.reduce((a, b) => a + b, 0) / historyData.jerkHistory.length).toFixed(2)}</div>
                  <div className="stat-item">Max: {Math.max(...historyData.jerkHistory).toFixed(2)}</div>
                </div>
              </div>
              
              {/* System Resources */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">System Resources</h3>
                </div>
                
                <div className="system-resources-container">
                  <div className="resource-item">
                    <div className="resource-header">
                      <span className="resource-label">Temperature</span>
                      <span className="resource-value temperature-value">{statusData.temperature.toFixed(1)}°C</span>
                    </div>
                    <div className="resource-bar">
                      <div 
                        className="resource-fill temperature-fill"
                        style={{ width: `${Math.min((statusData.temperature / 80) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="resource-item">
                    <div className="resource-header">
                      <span className="resource-label">Buffer Available</span>
                      <span className="resource-value">{statusData.buffer.available}/{statusData.buffer.total}</span>
                    </div>
                    <div className="resource-bar">
                      <div 
                        className="resource-fill buffer-fill"
                        style={{ width: `${Math.min((statusData.buffer.available / statusData.buffer.total) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="resource-item">
                    <div className="resource-header">
                      <span className="resource-label">GCode Line</span>
                      <span className="resource-value">N/A</span>
                    </div>
                    <div className="resource-bar">
                      <div 
                        className="resource-fill gcode-fill"
                        style={{ width: '0%' }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="overrides-container">
                    <div className="overrides-header">Overrides</div>
                    <div className="overrides-grid">
                      <div className="override-item">
                        <div className="override-label">Feed</div>
                        <div className="override-value">{statusData.overrides.feed}%</div>
                      </div>
                      <div className="override-item">
                        <div className="override-label">Rapid</div>
                        <div className="override-value">{statusData.overrides.rapid}%</div>
                      </div>
                      <div className="override-item">
                        <div className="override-label">Spindle</div>
                        <div className="override-value">{statusData.overrides.spindle}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonitorPanel;