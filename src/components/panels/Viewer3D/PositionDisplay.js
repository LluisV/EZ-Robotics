import React from 'react';
import { getThemeColors } from './utils/themeColors';

/**
 * Component to display robot position information
 */
const PositionDisplay = ({ robotPosition, workOffset }) => {
  const themeColors = getThemeColors();
  
  return (
    <div className="robot-position-display" style={{
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      borderTop: '1px solid var(--border-color)',
      paddingTop: '8px',
      marginTop: '8px',
      width: '100%'
    }}>
      {/* World coordinates */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(0,0,0,0.1)',
        padding: '4px 8px',
        borderRadius: '4px'
      }}>
        <span style={{ color: themeColors.worldCoord, fontWeight: 'bold' }}>World:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: themeColors.xAxis }}>X:</span>
          <span>{robotPosition.x.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: themeColors.yAxis }}>Y:</span>
          <span>{robotPosition.y.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: themeColors.zAxis }}>Z:</span>
          <span>{robotPosition.z.toFixed(2)}</span>
        </div>
        {robotPosition.a !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ color: themeColors.robotPosition }}>A:</span>
            <span>{robotPosition.a.toFixed(2)}°</span>
          </div>
        )}
      </div>

      {/* Work coordinates */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: 'rgba(0,0,0,0.1)',
        padding: '4px 8px',
        borderRadius: '4px'
      }}>
        <span style={{ color: themeColors.workCoord, fontWeight: 'bold' }}>Work:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: themeColors.xAxis }}>X:</span>
          <span>{(robotPosition.x - workOffset.x).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: themeColors.yAxis }}>Y:</span>
          <span>{(robotPosition.y - workOffset.y).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ color: themeColors.zAxis }}>Z:</span>
          <span>{(robotPosition.z - workOffset.z).toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};

export default PositionDisplay;