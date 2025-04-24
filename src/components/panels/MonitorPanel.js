import React, { useState, useEffect, useRef } from 'react';
import '../../styles/monitor-panel.css';
import communicationService from '../../services/communication/CommunicationService';

const MonitorPanel = ({ refreshRate = 1000 }) => {
  const [statusData, setStatusData] = useState({
    connected: false,
    position: { x: 0, y: 0, z: 0, a: 0 },
    speed: 0,
    temperature: 0,
    utilization: 0,
    acceleration: 0,
    jerk: 0,
    velocityVector: { x: 0, y: 0, z: 0 }
  });
  
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [historyData, setHistoryData] = useState({
    speedHistory: [],
    tempHistory: [],
    accelerationHistory: [],
    jerkHistory: [],
    velocityVectorHistory: {
      x: [],
      y: [],
      z: []
    }
  });
  
  // References for the mini charts
  const speedCanvasRef = useRef(null);
  const accelerationCanvasRef = useRef(null);
  const jerkCanvasRef = useRef(null);
  const tempCanvasRef = useRef(null);
  
  // Position history to calculate acceleration and jerk
  const positionHistoryRef = useRef([]);
  const velocityHistoryRef = useRef([]);
  const timeHistoryRef = useRef([]);
  const maxDataPoints = 100; // Increased from 30 to 100 for more history

  // Function to calculate acceleration and jerk from velocity history
  // Note: If velocity is now in mm/min, we need to convert to mm/s for these calculations
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

  // Parse telemetry data from message
  const parseTelemetryData = (message) => {
    try {
      // Extract the JSON part from the message
      const jsonStart = message.indexOf('{');
      if (jsonStart === -1) return null;
      
      const jsonString = message.substring(jsonStart);
      const parsedData = JSON.parse(jsonString);
      
      // Create the result object with all available telemetry data
      const result = {
        position: {
          x: 0, y: 0, z: 0, a: 0
        },
        velocity: 0,
        velocityVector: { x: 0, y: 0, z: 0 },
        temperature: parsedData.temperature || 0
      };
      
      // Extract position if available
      if (parsedData.work) {
        result.position = {
          x: parseFloat(parsedData.work.X) || 0,
          y: parseFloat(parsedData.work.Y) || 0,
          z: parseFloat(parsedData.work.Z) || 0,
          a: 0 // Default to 0 if not present
        };
      }
      
      // Extract velocity if available
      if (parsedData.velocity !== undefined) {
        result.velocity = parseFloat(parsedData.velocity) || 0;
      }
      
      // Extract velocity vector if available
      if (parsedData.velocityVector) {
        result.velocityVector = {
          x: parseFloat(parsedData.velocityVector.X) || 0,
          y: parseFloat(parsedData.velocityVector.Y) || 0,
          z: parseFloat(parsedData.velocityVector.Z) || 0
        };
      }
      
      return result;
    } catch (error) {
      console.error("Error parsing telemetry data:", error);
      return null;
    }
  };

  // Handle position telemetry from robot
  useEffect(() => {
    const handlePositionTelemetry = (data) => {
      if (typeof data.response === 'string' && data.response.startsWith('[TELEMETRY]')) {
        try {
          const telemetryData = parseTelemetryData(data.response);
          if (!telemetryData) return;
          
          // Update position, velocity, and temperature data
          const timestamp = Date.now();
          
          // Add to position, velocity and time history
          if (telemetryData.position) {
            positionHistoryRef.current.push(telemetryData.position);
          }
          
          if (telemetryData.velocity !== undefined) {
            velocityHistoryRef.current.push(telemetryData.velocity);
            timeHistoryRef.current.push(timestamp);
          }

          // Limit history size
          if (positionHistoryRef.current.length > maxDataPoints + 3) {
            positionHistoryRef.current.shift();
            velocityHistoryRef.current.shift();
            timeHistoryRef.current.shift();
          }

          // Calculate acceleration and jerk from velocity history
          const kinematics = calculateKinematics(velocityHistoryRef.current, timeHistoryRef.current);

          // Update state with new position and calculated values
          setStatusData(prev => ({
            ...prev,
            connected: true,
            position: telemetryData.position || prev.position,
            speed: telemetryData.velocity || prev.speed,
            velocityVector: telemetryData.velocityVector || prev.velocityVector,
            acceleration: kinematics.acceleration,
            jerk: kinematics.jerk,
            temperature: telemetryData.temperature !== undefined ? telemetryData.temperature : prev.temperature
          }));

          // Add to history data for charts
          setHistoryData(prev => ({
            speedHistory: [...prev.speedHistory, telemetryData.velocity || 0].slice(-maxDataPoints),
            accelerationHistory: [...prev.accelerationHistory, kinematics.acceleration].slice(-maxDataPoints),
            jerkHistory: [...prev.jerkHistory, kinematics.jerk].slice(-maxDataPoints),
            tempHistory: [...prev.tempHistory, telemetryData.temperature || prev.tempHistory[prev.tempHistory.length - 1] || 0].slice(-maxDataPoints),
            velocityVectorHistory: {
              x: [...prev.velocityVectorHistory.x, telemetryData.velocityVector?.x || 0].slice(-maxDataPoints),
              y: [...prev.velocityVectorHistory.y, telemetryData.velocityVector?.y || 0].slice(-maxDataPoints),
              z: [...prev.velocityVectorHistory.z, telemetryData.velocityVector?.z || 0].slice(-maxDataPoints)
            }
          }));
        } catch (error) {
          console.error("Error processing telemetry:", error);
        }
      }
    };

    // Add event listener
    communicationService.on('position-telemetry', handlePositionTelemetry);
    
    // Cleanup
    return () => {
      communicationService.removeListener('position-telemetry', handlePositionTelemetry);
    };
  }, []);

  // Simulation for utilization (since it isn't in telemetry)
  useEffect(() => {
    const interval = setInterval(() => {
      const newUtilization = 10 + Math.random() * 20;
      
      setStatusData(prev => ({
        ...prev,
        utilization: newUtilization,
        connected: true,
      }));
      
      setTimeElapsed(prev => prev + refreshRate / 1000);
    }, refreshRate);

    return () => clearInterval(interval);
  }, [refreshRate]);

  // Function to draw mini charts with improved handling for larger datasets
  const drawSparkline = (canvasRef, data, color, fillColor, gradient = true) => {
    if (!canvasRef.current || data.length < 2) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Adjust for high-resolution displays
    const pixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size considering the devicePixelRatio
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;
    
    // Scale the context
    ctx.scale(pixelRatio, pixelRatio);
    
    // Adjust style to maintain visual size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Now work with logical dimensions
    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Filter out any NaN or Infinity values
    const filteredData = data.filter(value => 
      typeof value === 'number' && isFinite(value)
    );
    
    if (filteredData.length < 2) return;
    
    // Optimize data for visualization if too many points
    // Based on analysis, for a 100px wide canvas, 100 points is optimal
    // More points than pixels means we should downsample
    const pixelsPerPoint = width / filteredData.length;
    let displayData = filteredData;
    
    // If we have more than 1 point per pixel, thin the data
    if (pixelsPerPoint < 1) {
      const downsampleFactor = Math.ceil(filteredData.length / width);
      displayData = [];
      
      // Use min-max decimation to preserve peaks and valleys
      for (let i = 0; i < filteredData.length; i += downsampleFactor) {
        const chunk = filteredData.slice(i, i + downsampleFactor);
        if (chunk.length > 0) {
          // For each chunk, keep min and max values to preserve shape
          const minVal = Math.min(...chunk);
          const maxVal = Math.max(...chunk);
          
          // If min and max are different, add both; otherwise just add one
          if (minVal !== maxVal) {
            displayData.push(minVal);
            displayData.push(maxVal);
          } else {
            displayData.push(minVal);
          }
        }
      }
    }
    
    const max = Math.max(...displayData);
    const min = Math.min(...displayData);
    const range = max - min || 1;
    
    const padding = 2;
    
    // Create gradient if requested
    let fillStyle = fillColor;
    if (gradient) {
      const grd = ctx.createLinearGradient(0, 0, 0, height);
      grd.addColorStop(0, fillColor);
      grd.addColorStop(1, 'rgba(0,0,0,0.01)');
      fillStyle = grd;
    }
    
    // Use antialiasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the area under the line
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    
    // Plot each point with smooth curves
    displayData.forEach((value, index) => {
      const x = padding + (index / (displayData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        // Use bezier curves for smoothing with smoother control
        const prevX = padding + ((index - 1) / (displayData.length - 1)) * (width - padding * 2);
        const prevY = height - padding - ((displayData[index - 1] - min) / range) * (height - padding * 2);
        
        // Adjust control points to make smoother curves
        // Use 1/4 and 3/4 points for better smoothing with large datasets
        const cpX1 = prevX + (x - prevX) / 4;
        const cpX2 = prevX + 3 * (x - prevX) / 4;
        
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      }
    });
    
    // Complete the path to fill
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fill();
    
    // Draw the line on top of the fill
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    displayData.forEach((value, index) => {
      const x = padding + (index / (displayData.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        // Use bezier curves for smoothing with adjusted control points
        const prevX = padding + ((index - 1) / (displayData.length - 1)) * (width - padding * 2);
        const prevY = height - padding - ((displayData[index - 1] - min) / range) * (height - padding * 2);
        
        const cpX1 = prevX + (x - prevX) / 4;
        const cpX2 = prevX + 3 * (x - prevX) / 4;
        
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      }
    });
    ctx.stroke();
    
    // Draw end point with halo - more prominent to show current value
    if (displayData.length > 0) {
      const lastValue = displayData[displayData.length - 1];
      const x = width - padding;
      const y = height - padding - ((lastValue - min) / range) * (height - padding * 2);
      
      // Outer halo
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fill();
      
      // Center point
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  // New function to draw multi-line velocity chart
  const drawVelocityChart = (canvasRef, data) => {
    if (!canvasRef.current || !data || !data.velocityVectorHistory) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Adjust for high-resolution displays
    const pixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Set canvas size considering the devicePixelRatio
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;
    
    // Scale the context
    ctx.scale(pixelRatio, pixelRatio);
    
    // Adjust style to maintain visual size
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Now work with logical dimensions
    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const padding = 2;
    
    // Get all data arrays
    const xData = data.velocityVectorHistory.x;
    const yData = data.velocityVectorHistory.y;
    const zData = data.velocityVectorHistory.z;
    const totalData = data.speedHistory;
    
    if (xData.length < 2 || yData.length < 2 || zData.length < 2 || totalData.length < 2) return;
    
    // Find the global min and max across all datasets
    const allValues = [...xData, ...yData, ...zData, ...totalData];
    const max = Math.max(...allValues.filter(v => isFinite(v)));
    const min = Math.min(...allValues.filter(v => isFinite(v)));
    const range = max - min || 1;
    
    // Helper function to draw a line with given color
    const drawLine = (dataArray, color, drawPoints = false) => {
      // Filter out any NaN or Infinity values
      const filteredData = dataArray.filter(value => 
        typeof value === 'number' && isFinite(value)
      );
      
      if (filteredData.length < 2) return;
      
      // Optimize data for visualization if too many points
      const pixelsPerPoint = width / filteredData.length;
      let displayData = filteredData;
      
      // If we have more than 1 point per pixel, thin the data
      if (pixelsPerPoint < 1) {
        const downsampleFactor = Math.ceil(filteredData.length / width);
        displayData = [];
        
        for (let i = 0; i < filteredData.length; i += downsampleFactor) {
          const chunk = filteredData.slice(i, i + downsampleFactor);
          if (chunk.length > 0) {
            // For each chunk, keep min and max values to preserve shape
            const minVal = Math.min(...chunk);
            const maxVal = Math.max(...chunk);
            
            if (minVal !== maxVal) {
              displayData.push(minVal);
              displayData.push(maxVal);
            } else {
              displayData.push(minVal);
            }
          }
        }
      }
      
      // Draw the line
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      
      displayData.forEach((value, index) => {
        const x = padding + (index / (displayData.length - 1)) * (width - padding * 2);
        const y = height - padding - ((value - min) / range) * (height - padding * 2);
        
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          // Use bezier curves for smoothing with adjusted control points
          const prevX = padding + ((index - 1) / (displayData.length - 1)) * (width - padding * 2);
          const prevY = height - padding - ((displayData[index - 1] - min) / range) * (height - padding * 2);
          
          const cpX1 = prevX + (x - prevX) / 4;
          const cpX2 = prevX + 3 * (x - prevX) / 4;
          
          ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
        }
      });
      ctx.stroke();
      
      // Draw end point if requested
      if (drawPoints && displayData.length > 0) {
        const lastValue = displayData[displayData.length - 1];
        const x = width - padding;
        const y = height - padding - ((lastValue - min) / range) * (height - padding * 2);
        
        // Outer halo
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fill();
        
        // Center point
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
    
    // Draw all lines with their respective colors
    drawLine(xData, '#00aa55'); // X axis - Green
    drawLine(yData, '#ff5555'); // Y axis - Red
    drawLine(zData, '#5555ff'); // Z axis - Blue
    drawLine(totalData, '#aa55cc', true); // Total velocity - Purple (with endpoint)
    
    // No in-chart legend - moved to card-details section
  };

  // Draw the charts when data changes
  useEffect(() => {
    // Use the new multi-line chart for velocity
    drawVelocityChart(speedCanvasRef, historyData);
    
    // Keep original charts for other metrics
    drawSparkline(accelerationCanvasRef, historyData.accelerationHistory, '#00aa55', 'rgba(0, 170, 85, 0.3)');
    drawSparkline(jerkCanvasRef, historyData.jerkHistory, '#ff7700', 'rgba(255, 119, 0, 0.3)');
    drawSparkline(tempCanvasRef, historyData.tempHistory, '#ff5555', 'rgba(255, 85, 85, 0.3)');
  }, [historyData]);

  // Determine temperature color
  const getTempColor = (temp) => {
    if (temp < 40) return '#4caf50';
    if (temp < 50) return '#ff9800';
    return '#f44336';
  };
  
  // Connection status
  const connectionStatus = statusData.connected ? 'Connected' : 'Disconnected';
  const connectionStatusClass = statusData.connected ? 'status-online' : 'status-offline';
  const utilizationPercent = statusData.utilization + '%';

  // Format velocity vector for display
  const velocityMagnitude = statusData.speed.toFixed(1);

  return (
    <div className="panel-content monitor-panel">
      <div className="monitor-header">
        <div className="connection-status">
          <span className={`status-indicator ${connectionStatusClass}`}></span>
          <span className="status-text">{connectionStatus}</span>
        </div>
        <div className="uptime-container">
          <div className="uptime-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="uptime-value">{Math.floor(timeElapsed / 60)}m {Math.floor(timeElapsed % 60)}s</div>
        </div>
      </div>
      
      <div className="monitor-container">
        <div className="monitor-section status-cards">
          <div className="status-card">
            <div className="card-header">
              <div className="card-title">Velocity</div>
              <div className="card-badge" title="Normal value">Normal</div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{velocityMagnitude}</div>
                <div className="card-unit">mm/min</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={speedCanvasRef} width="100" height="40" className="sparkline"></canvas>
              </div>
              <div className="card-details velocity-legend">
                <span className="legend-item"><span className="color-indicator" style={{backgroundColor: '#00aa55'}}></span>X</span>
                <span className="legend-item"><span className="color-indicator" style={{backgroundColor: '#ff5555'}}></span>Y</span>
                <span className="legend-item"><span className="color-indicator" style={{backgroundColor: '#5555ff'}}></span>Z</span>
                <span className="legend-item"><span className="color-indicator" style={{backgroundColor: '#aa55cc'}}></span>Total</span>
              </div>
            </div>
          </div>
          
          <div className="status-card">
            <div className="card-header">
              <div className="card-title">Acceleration</div>
              <div className="card-badge">Normal</div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{statusData.acceleration.toFixed(1)}</div>
                <div className="card-unit">mm/s²</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={accelerationCanvasRef} width="100" height="40" className="sparkline"></canvas>
              </div>
            </div>
          </div>
          
          <div className="status-card">
            <div className="card-header">
              <div className="card-title">Jerk</div>
              <div className="card-badge">Normal</div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{statusData.jerk.toFixed(2)}</div>
                <div className="card-unit">mm/s³</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={jerkCanvasRef} width="100" height="40" className="sparkline"></canvas>
              </div>
            </div>
          </div>
          
          <div className="status-card">
            <div className="card-header">
              <div className="card-title">Temperature</div>
              <div className="card-badge" style={{backgroundColor: getTempColor(statusData.temperature)}}>
                {statusData.temperature < 40 ? 'Normal' : 
                 statusData.temperature < 50 ? 'Elevated' : 'High'}
              </div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{statusData.temperature.toFixed(1)}</div>
                <div className="card-unit">°C</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={tempCanvasRef} width="100" height="40" className="sparkline"></canvas>
              </div>
            </div>
          </div>
        </div>
        
        <div className="monitor-section utilization-section">
          <div className="utilization-header">
            <div className="utilization-title">
              <h3 className="section-title">CPU utilization</h3>
              <div className="utilization-badge" style={{
                backgroundColor: statusData.utilization > 80 ? '#f44336' : 
                                statusData.utilization > 60 ? '#ff9800' : '#4caf50'
              }}>
                {statusData.utilization.toFixed(1)}%
              </div>
            </div>
            <div className="utilization-info">
              <div className="info-pill">
                <span className="info-label">Memory</span>
                <span className="info-value">24MB</span>
              </div>
            </div>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ 
                width: utilizationPercent,
                backgroundColor: statusData.utilization > 80 ? '#f44336' : 
                                statusData.utilization > 60 ? '#ff9800' : '#4caf50'
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitorPanel;