import React, { useState, useEffect } from 'react';

/**
 * Monitor Panel component for displaying real-time robot status.
 * 
 * @param {Object} props Component properties
 * @param {number} props.refreshRate Data refresh rate in milliseconds
 */
const MonitorPanel = ({ refreshRate = 1000 }) => {
  const [statusData, setStatusData] = useState({
    connected: false,
    position: { x: 0, y: 0, z: 0 },
    speed: 0,
    temperature: 0,
    utilization: 0,
    lastCommand: '',
    errors: [],
  });

  // Simulate status updates
  useEffect(() => {
    const interval = setInterval(() => {
      // In a real implementation, this would fetch data from the robot
      const newTemp = 45 + Math.random() * 5;
      const newUtilization = 10 + Math.random() * 20;
      
      setStatusData(prev => ({
        ...prev,
        connected: true,
        position: {
          x: prev.position.x + (Math.random() - 0.5) * 0.1,
          y: prev.position.y + (Math.random() - 0.5) * 0.1,
          z: prev.position.z + (Math.random() - 0.5) * 0.1,
        },
        speed: 50 + Math.random() * 10,
        temperature: newTemp,
        utilization: newUtilization,
      }));
    }, refreshRate);

    return () => clearInterval(interval);
  }, [refreshRate]);

  return (
    <div className="panel-content">

      <div className="monitor-grid">
        <div className="monitor-value">
          <div className="monitor-label">X Position</div>
          <div className="monitor-data">{statusData.position.x.toFixed(2)} mm</div>
        </div>
        <div className="monitor-value">
          <div className="monitor-label">Y Position</div>
          <div className="monitor-data">{statusData.position.y.toFixed(2)} mm</div>
        </div>
        <div className="monitor-value">
          <div className="monitor-label">Z Position</div>
          <div className="monitor-data">{statusData.position.z.toFixed(2)} mm</div>
        </div>
        <div className="monitor-value">
          <div className="monitor-label">Speed</div>
          <div className="monitor-data">{statusData.speed.toFixed(1)} mm/s</div>
        </div>
        <div className="monitor-value">
          <div className="monitor-label">Temperature</div>
          <div className="monitor-data">{statusData.temperature.toFixed(1)} °C</div>
        </div>
        <div className="monitor-value">
          <div className="monitor-label">Utilization</div>
          <div className="monitor-data">{statusData.utilization.toFixed(1)} %</div>
        </div>
      </div>
    </div>
  );
};

export default MonitorPanel;