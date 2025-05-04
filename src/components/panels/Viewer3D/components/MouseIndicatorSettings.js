import React from 'react';

/**
 * Simplified MouseIndicatorSettings component 
 * Controls only the projection lines visibility
 */
const MouseIndicatorSettings = ({ 
  showMousePosition,
  toggleMousePosition,
  indicatorSettings,
  setIndicatorSettings
}) => {
  // Default settings if not provided
  const settings = indicatorSettings || {
    showProjectionLines: true
  };
  
  const handleToggleProjectionLines = () => {
    setIndicatorSettings({
      ...settings,
      showProjectionLines: !settings.showProjectionLines
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
      </div>
    </div>
  );
};

export default MouseIndicatorSettings;