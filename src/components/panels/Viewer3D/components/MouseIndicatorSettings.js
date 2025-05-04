import React from 'react';

/**
 * Enhanced MouseIndicatorSettings component with improved UI
 * Controls the appearance and behavior of the mouse position indicator
 */
const MouseIndicatorSettings = ({ 
  showMousePosition,
  toggleMousePosition,
  indicatorSettings,
  setIndicatorSettings
}) => {
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
    <div className="mouse-indicator-settings">
      <div className="indicator-options">
        <div className="indicator-option">
          <label className="indicator-checkbox-label">
            <input
              type="checkbox"
              checked={settings.showProjectionLines}
              onChange={handleToggleProjectionLines}
              className="indicator-checkbox"
            />
            <span>Projection Lines</span>
          </label>
        </div>
        
        <div className="indicator-option">
          <label className="indicator-checkbox-label">
            <input
              type="checkbox"
              checked={settings.pulseAnimation}
              onChange={handleTogglePulse}
              className="indicator-checkbox"
            />
            <span>Pulse Animation</span>
          </label>
        </div>
        
        <div className="indicator-option size-selector">
          <label className="indicator-select-label">
            <span>Size:</span>
            <select
              value={settings.size}
              onChange={handleSizeChange}
              className="indicator-select"
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
};

export default MouseIndicatorSettings;