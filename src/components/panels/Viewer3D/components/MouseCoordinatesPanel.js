import React, { useState, useEffect } from 'react';
import { getThemeColors, addThemeChangeListener } from '../utils/themeColors';

/**
 * Component to display mouse coordinates in the 3D view
 * Shows coordinates when mouse is raycasted to the workspace plane
 * 
 * @param {Object} props Component properties
 * @param {Object} props.mousePosition Mouse position coordinates {x, y, z}
 * @param {boolean} props.visible Whether the panel is visible
 * @param {Object} props.workOffset Work coordinate offset {x, y, z}
 */
const MouseCoordinatesPanel = ({ mousePosition, visible = true, workOffset = { x: 0, y: 0, z: 0 } }) => {
  const [themeColors, setThemeColors] = useState(getThemeColors());
  const [showWorkCoords, setShowWorkCoords] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [localMousePosition, setLocalMousePosition] = useState({ x: 0, y: 0, z: 0 });
  const [isMouseOverScene, setIsMouseOverScene] = useState(false);
  const [showPanel, setShowPanel] = useState(true); // Always show panel by default
  
  // Update local state when mousePosition prop changes
  useEffect(() => {
    if (mousePosition) {
      setLocalMousePosition(mousePosition);
      
      // If we're receiving mouse position updates, mouse must be over scene or nearby
      if (mousePosition.x !== 0 || mousePosition.y !== 0 || mousePosition.z !== 0) {
        setIsMouseOverScene(true);
      }
    }
  }, [mousePosition]);
  
  // Update colors when theme changes
  useEffect(() => {
    const removeListener = addThemeChangeListener(() => {
      setThemeColors(getThemeColors());
    });
    
    return () => removeListener();
  }, []);
  
  // Don't render if not visible
  if (!visible || !showPanel) return null;
  
  // Calculate work coordinates (subtract work offset from machine coordinates)
  const workCoords = {
    x: localMousePosition.x - workOffset.x,
    y: localMousePosition.y - workOffset.y,
    z: localMousePosition.z - workOffset.z
  };
  
  // Background color based on theme
  const getBgColor = () => {
    // Check if we're in a light theme
    if (themeColors.background.match(/^#[0-9a-f]{6}$/i)) {
      const r = parseInt(themeColors.background.substring(1, 3), 16);
      const g = parseInt(themeColors.background.substring(3, 5), 16);
      const b = parseInt(themeColors.background.substring(5, 7), 16);
      
      // If it's a light theme (average RGB > 128)
      if ((r + g + b) / 3 > 128) {
        return 'rgba(0, 0, 0, 0.7)';
      }
    }
    
    // Default for dark themes
    return 'rgba(0, 0, 0, 0.6)';
  };
  
  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: getBgColor(),
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'monospace',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
        zIndex: 10,
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '140px',
        maxWidth: '180px',
        transition: 'all 0.2s ease-in-out',
        border: `1px solid ${themeColors.gridPrimary}`,
        opacity: isMouseOverScene ? 1 : 0.6
      }}
    >
      {/* Header with toggle controls */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '6px',
          borderBottom: `1px solid ${themeColors.gridPrimary}`,
          paddingBottom: '4px'
        }}
      >
        <div style={{ fontWeight: 'bold', opacity: 0.9 }}>Coordinates</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setShowWorkCoords(!showWorkCoords)}
            style={{
              background: 'none',
              border: 'none',
              color: showWorkCoords ? themeColors.workCoord : '#888',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '3px',
              pointerEvents: 'auto',
              fontWeight: showWorkCoords ? 'bold' : 'normal'
            }}
            title={showWorkCoords ? "Hide work coordinates" : "Show work coordinates"}
          >
            WORK
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ccc',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '0 4px',
              pointerEvents: 'auto'
            }}
            title={expanded ? "Collapse panel" : "Expand panel"}
          >
            {expanded ? '▼' : '▲'}
          </button>
        </div>
      </div>
      
      {expanded && (
        <>
          {/* Always show coordinates, with a hint when mouse is not over the scene */}
          <div style={{ 
            color: '#aaa', 
            fontSize: '10px', 
            marginBottom: '4px', 
            textAlign: 'center',
            display: isMouseOverScene ? 'none' : 'block'  
          }}>
            Move mouse over workspace
          </div>
          
          {/* Machine coordinates */}
          <div style={{ marginBottom: showWorkCoords ? '8px' : '0' }}>
            <div style={{ 
              fontSize: '10px', 
              marginBottom: '4px', 
              color: themeColors.worldCoord,
              fontWeight: 'bold'
            }}>
              MACHINE
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: themeColors.xAxis, fontWeight: 'bold', width: '12px' }}>X:</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{localMousePosition.x.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: themeColors.yAxis, fontWeight: 'bold', width: '12px' }}>Y:</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{localMousePosition.y.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span style={{ color: themeColors.zAxis, fontWeight: 'bold', width: '12px' }}>Z:</span>
              <span style={{ flex: 1, textAlign: 'right' }}>{localMousePosition.z.toFixed(2)}</span>
            </div>
          </div>
          
          {/* Work coordinates - only shown if enabled */}
          {showWorkCoords && (
            <div>
              <div style={{ 
                fontSize: '10px', 
                marginBottom: '4px', 
                color: themeColors.workCoord,
                fontWeight: 'bold'
              }}>
                WORK
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: themeColors.xAxis, fontWeight: 'bold', width: '12px' }}>X:</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{workCoords.x.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: themeColors.yAxis, fontWeight: 'bold', width: '12px' }}>Y:</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{workCoords.y.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <span style={{ color: themeColors.zAxis, fontWeight: 'bold', width: '12px' }}>Z:</span>
                <span style={{ flex: 1, textAlign: 'right' }}>{workCoords.z.toFixed(2)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MouseCoordinatesPanel;