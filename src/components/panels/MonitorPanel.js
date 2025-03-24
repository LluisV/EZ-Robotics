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

  const [logs, setLogs] = useState([
    { type: 'info', message: 'System initialized', timestamp: new Date().toLocaleTimeString() },
    { type: 'info', message: 'Waiting for connection', timestamp: new Date().toLocaleTimeString() },
  ]);

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

      // Add a log entry occasionally
      if (Math.random() > 0.7) {
        const types = ['info', 'warning', 'error'];
        const typeIndex = Math.floor(Math.random() * 3);
        const messages = [
          'Position updated',
          'Temperature reading',
          'Movement completed',
          'Command executed',
          'Warning: Temperature rising',
          'Error: Command timeout'
        ];
        const messageIndex = Math.floor(Math.random() * messages.length);
        
        // Add new log at the beginning
        setLogs(prev => [
          {
            type: types[typeIndex >= messages.length - 2 ? 1 : typeIndex >= messages.length - 1 ? 2 : 0],
            message: messages[messageIndex],
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev.slice(0, 49) // Keep only the last 50 logs
        ]);
      }
    }, refreshRate);

    return () => clearInterval(interval);
  }, [refreshRate]);

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div className="panel-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
          </svg>
          Status Monitor
        </div>
        <div className={`status-indicator ${statusData.connected ? 'status-online' : 'status-offline'}`}></div>
      </div>
      
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
      
      <h4>System Log</h4>
      <div className="log-container">
        {logs.map((log, index) => (
          <div key={index} className={`log-entry log-${log.type}`}>
            [{log.timestamp}] {log.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MonitorPanel;