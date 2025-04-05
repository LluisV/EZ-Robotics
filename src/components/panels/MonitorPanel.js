import React, { useState, useEffect, useRef } from 'react';
import '../../styles/monitor-panel.css';

const MonitorPanel = ({ refreshRate = 1000 }) => {
  const [statusData, setStatusData] = useState({
    connected: false,
    position: { x: 0, y: 0, z: 0, a: 0 },
    speed: 0,
    temperature: 0,
    utilization: 0,
    voltage: 24.0,
    current: 1.5,
  });
  
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [historyData, setHistoryData] = useState({
    speedHistory: [],
    tempHistory: [],
    voltageHistory: [],
    currentHistory: []
  });
  
  // Referencias para los mini gráficos
  const speedCanvasRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const voltageCanvasRef = useRef(null);
  const currentCanvasRef = useRef(null);
  
  const maxDataPoints = 30;

  // Simulación de datos
  useEffect(() => {
    const interval = setInterval(() => {
      const newTemp = 45 + Math.random() * 5;
      const newSpeed = 50 + Math.random() * 10;
      const newUtilization = 10 + Math.random() * 20;
      const newVoltage = 24.0 + (Math.random() - 0.5) * 0.4;
      const newCurrent = 1.5 + (Math.random() - 0.5) * 0.3;
      
      setStatusData(prev => ({
        ...prev,
        connected: true,
        position: {
          x: prev.position.x + (Math.random() - 0.5) * 0.1,
          y: prev.position.y + (Math.random() - 0.5) * 0.1,
          z: prev.position.z + (Math.random() - 0.5) * 0.1,
          a: prev.position.a + (Math.random() - 0.5) * 0.5,
        },
        speed: newSpeed,
        temperature: newTemp,
        utilization: newUtilization,
        voltage: newVoltage,
        current: newCurrent,
      }));
      
      setHistoryData(prev => ({
        speedHistory: [...prev.speedHistory, newSpeed].slice(-maxDataPoints),
        tempHistory: [...prev.tempHistory, newTemp].slice(-maxDataPoints),
        voltageHistory: [...prev.voltageHistory, newVoltage].slice(-maxDataPoints),
        currentHistory: [...prev.currentHistory, newCurrent].slice(-maxDataPoints)
      }));
      
      setTimeElapsed(prev => prev + refreshRate / 1000);
    }, refreshRate);

    return () => clearInterval(interval);
  }, [refreshRate]);

  // Función para dibujar mini gráficos
  const drawSparkline = (canvasRef, data, color, fillColor, gradient = true) => {
    if (!canvasRef.current || data.length < 2) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Ajusta para pantallas de alta resolución
    const pixelRatio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    // Establece el tamaño del canvas considerando el devicePixelRatio
    canvas.width = rect.width * pixelRatio;
    canvas.height = rect.height * pixelRatio;
    
    // Escala el contexto
    ctx.scale(pixelRatio, pixelRatio);
    
    // Ajusta el estilo para que conserve el tamaño visual
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    // Ahora trabaja con dimensiones lógicas (no físicas)
    const width = rect.width;
    const height = rect.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const padding = 2;
    
    // Crear degradado si se solicita
    let fillStyle = fillColor;
    if (gradient) {
      const grd = ctx.createLinearGradient(0, 0, 0, height);
      grd.addColorStop(0, fillColor);
      grd.addColorStop(1, 'rgba(0,0,0,0.01)');
      fillStyle = grd;
    }
    
    // Usar antialiasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Dibujar el área bajo la línea
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    
    // Trazar cada punto con curvas suaves
    data.forEach((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        // Usar curvas bezier para suavizar la línea
        const prevX = padding + ((index - 1) / (data.length - 1)) * (width - padding * 2);
        const prevY = height - padding - ((data[index - 1] - min) / range) * (height - padding * 2);
        
        const cpX1 = prevX + (x - prevX) / 3;
        const cpX2 = prevX + 2 * (x - prevX) / 3;
        
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      }
    });
    
    // Completar el path para rellenar
    ctx.lineTo(width - padding, height - padding);
    ctx.lineTo(padding, height - padding);
    ctx.closePath();
    ctx.fill();
    
    // Dibujar la línea encima del relleno
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    data.forEach((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        // Usar curvas bezier para suavizar la línea
        const prevX = padding + ((index - 1) / (data.length - 1)) * (width - padding * 2);
        const prevY = height - padding - ((data[index - 1] - min) / range) * (height - padding * 2);
        
        const cpX1 = prevX + (x - prevX) / 3;
        const cpX2 = prevX + 2 * (x - prevX) / 3;
        
        ctx.bezierCurveTo(cpX1, prevY, cpX2, y, x, y);
      }
    });
    ctx.stroke();
    
    // Dibujar punto final con halo
    if (data.length > 0) {
      const lastValue = data[data.length - 1];
      const x = width - padding;
      const y = height - padding - ((lastValue - min) / range) * (height - padding * 2);
      
      // Halo exterior
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      
      // Punto central
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  };

  // Dibujar los mini gráficos cuando los datos cambian
  useEffect(() => {
    drawSparkline(speedCanvasRef, historyData.speedHistory, '#aa55cc', 'rgba(170, 85, 204, 0.3)');
    drawSparkline(tempCanvasRef, historyData.tempHistory, '#ff5555', 'rgba(255, 85, 85, 0.3)');
    drawSparkline(voltageCanvasRef, historyData.voltageHistory, '#ff7700', 'rgba(255, 119, 0, 0.3)');
    drawSparkline(currentCanvasRef, historyData.currentHistory, '#00aa55', 'rgba(0, 170, 85, 0.3)');
  }, [historyData]);

  // Determinar el color de temperatura
  const getTempColor = (temp) => {
    if (temp < 40) return '#4caf50';
    if (temp < 50) return '#ff9800';
    return '#f44336';
  };
  
  // Estado de conexión
  const connectionStatus = statusData.connected ? 'Conectado' : 'Desconectado';
  const connectionStatusClass = statusData.connected ? 'status-online' : 'status-offline';
  const utilizationPercent = statusData.utilization + '%';

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
              <div className="card-badge" title="Valor nominal">Normal</div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{statusData.speed.toFixed(1)}</div>
                <div className="card-unit">mm/s</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={speedCanvasRef} width="100" height="40" className="sparkline"></canvas>
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
          
          <div className="status-card">
            <div className="card-header">
              <div className="card-title">Voltage</div>
              <div className="card-badge">Stable</div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{statusData.voltage.toFixed(1)}</div>
                <div className="card-unit">V</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={voltageCanvasRef} width="100" height="40" className="sparkline"></canvas>
              </div>
            </div>
          </div>
          
          <div className="status-card">
            <div className="card-header">
              <div className="card-title">Current</div>
              <div className="card-badge">Normal</div>
            </div>
            <div className="card-content">
              <div className="card-value-container">
                <div className="card-value">{statusData.current.toFixed(2)}</div>
                <div className="card-unit">A</div>
              </div>
              <div className="sparkline-container">
                <canvas ref={currentCanvasRef} width="100" height="40" className="sparkline"></canvas>
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