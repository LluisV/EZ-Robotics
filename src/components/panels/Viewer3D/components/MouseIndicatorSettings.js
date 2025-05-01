import React, { useState } from 'react';

/**
 * Mouse Indicator Settings component
 * Allows customizing the mouse position indicator appearance
 */
const MouseIndicatorSettings = ({ 
  showMousePosition, 
  toggleMousePosition,
  indicatorSettings,
  setIndicatorSettings
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Default settings if not provided
  const settings = indicatorSettings || {
    showProjectionLines: true,
    pulseAnimation: true,
    size: 'medium'
  };
  
  const handleToggleProjectionLines = () => {
    setIndicatorSettings({
      ...settings,
      showProjectionLines: !settings.showProjectionLines
    });
  };
  
  const handleTogglePulse = () => {
    setIndicatorSettings({
      ...settings,
      pulseAnimation: !settings.pulseAnimation
    });
  };
  
  const handleSizeChange = (e) => {
    setIndicatorSettings({
      ...settings,
      size: e.target.value
    });
  };

  return (
    <div style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
          <input
            type="checkbox"
            checked={showMousePosition}
            onChange={toggleMousePosition}
            style={{ margin: 0 }}
          />
          Show Coordinates
        </label>
        
        {showMousePosition && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '10px',
              cursor: 'pointer',
              padding: '0 4px'
            }}
            title="Indicator settings"
          >
            {isExpanded ? '▼' : '▶︎'}
          </button>
        )}
      </div>
      
      {showMousePosition && isExpanded && (
        <div style={{ 
          marginTop: '5px', 
          marginLeft: '20px', 
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={settings.showProjectionLines}
              onChange={handleToggleProjectionLines}
              style={{ margin: 0 }}
            />
            Show Projection Lines
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={settings.pulseAnimation}
              onChange={handleTogglePulse}
              style={{ margin: 0 }}
            />
            Pulse Animation
          </label>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span>Size:</span>
            <select
              value={settings.size}
              onChange={handleSizeChange}
              style={{ 
                fontSize: '10px', 
                padding: '2px',
                border: '1px solid var(--border-color)',
                borderRadius: '3px'
              }}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default MouseIndicatorSettings;