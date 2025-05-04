import React from 'react';
import { VisualizationModes } from '../utils/VisualizationModes';

/**
 * Enhanced VisualizationSettings component with improved UI
 * 
 * @param {Object} props Component properties
 * @param {string} props.visualizationMode Current visualization mode
 * @param {Function} props.setVisualizationMode Function to update visualization mode
 * @param {boolean} props.showDirectionIndicators Whether to show direction indicators
 * @param {Function} props.setShowDirectionIndicators Function to update direction indicators
 * @param {number} props.directionIndicatorDensity Density of direction indicators
 * @param {Function} props.setDirectionIndicatorDensity Function to update indicator density
 * @param {number} props.directionIndicatorScale Scale of direction indicators
 * @param {Function} props.setDirectionIndicatorScale Function to update indicator scale
 * @param {boolean} props.showPathLine Whether to show path line
 * @param {Function} props.setShowPathLine Function to update path line visibility
 */
const VisualizationSettings = ({
  visualizationMode,
  setVisualizationMode,
  showDirectionIndicators,
  setShowDirectionIndicators,
  directionIndicatorDensity = 0.05,
  setDirectionIndicatorDensity,
  directionIndicatorScale = 0.5,
  setDirectionIndicatorScale,
  showPathLine,
  setShowPathLine
}) => {
  // Define available visualization modes
  const visualizationOptions = [
    { value: VisualizationModes.MOVE_TYPE, label: 'Move Type' },
    { value: VisualizationModes.FEED_RATE, label: 'Feed Rate' },
    { value: VisualizationModes.Z_HEIGHT, label: 'Z-Height' },
    { value: VisualizationModes.TOOL_NUMBER, label: 'Tool Number' },
    { value: VisualizationModes.MOVE_DISTANCE, label: 'Move Distance' },
    { value: VisualizationModes.SEQUENCE, label: 'Sequence' }
  ];
  
  const handleVisualizationModeChange = (e) => {
    const newMode = e.target.value;
    setVisualizationMode(newMode);
  };
  
  const handleDirectionIndicatorsChange = (e) => {
    setShowDirectionIndicators(e.target.checked);
  };
  
  const handleDensityChange = (e) => {
    const value = parseFloat(e.target.value);
    setDirectionIndicatorDensity(value / 100); // Convert percent to decimal
  };
  
  const handleScaleChange = (e) => {
    const value = parseFloat(e.target.value);
    setDirectionIndicatorScale(value / 100); // Convert percent to decimal
  };
  
  const handlePathLineChange = (e) => {
    setShowPathLine(e.target.checked);
  };
  
  return (
    <div className="visualization-settings">
      <div className="vis-settings-header">
        <div className="vis-selector">
          <select
            value={visualizationMode}
            onChange={handleVisualizationModeChange}
            className="vis-select"
            title="Visualization Mode"
          >
            {visualizationOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="vis-settings-options">
        <div className="vis-option">
          <label className="vis-checkbox-label">
            <input
              type="checkbox"
              checked={showPathLine}
              onChange={handlePathLineChange}
              className="vis-checkbox"
            />
            <span>Show Path Overview</span>
          </label>
        </div>
        
        <div className="vis-option">
          <label className="vis-checkbox-label">
            <input
              type="checkbox"
              checked={showDirectionIndicators}
              onChange={handleDirectionIndicatorsChange}
              className="vis-checkbox"
            />
            <span>Show Direction Indicators</span>
          </label>
        </div>
        
        {showDirectionIndicators && (
          <div className="vis-slider-options">
            <div className="vis-slider-container">
              <div className="vis-slider-label">Density:</div>
              <div className="vis-slider-control">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={directionIndicatorDensity * 100}
                  onChange={handleDensityChange}
                  className="vis-slider"
                />
                <span className="vis-slider-value">{Math.round(directionIndicatorDensity * 100)}%</span>
              </div>
            </div>
            
            <div className="vis-slider-container">
              <div className="vis-slider-label">Size:</div>
              <div className="vis-slider-control">
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={directionIndicatorScale * 100}
                  onChange={handleScaleChange}
                  className="vis-slider"
                />
                <span className="vis-slider-value">{Math.round(directionIndicatorScale * 100)}%</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="vis-legend">
          <div className="vis-legend-title">Legend:</div>
          
          {visualizationMode === VisualizationModes.MOVE_TYPE && (
            <div className="vis-legend-content move-type-legend">
              <div className="vis-legend-item">
                <div className="vis-legend-color rapid"></div>
                <span>Rapid</span>
              </div>
              <div className="vis-legend-item">
                <div className="vis-legend-color cut"></div>
                <span>Cut</span>
              </div>
              <div className="vis-legend-item">
                <div className="vis-legend-color plunge"></div>
                <span>Plunge</span>
              </div>
              <div className="vis-legend-item">
                <div className="vis-legend-color lift"></div>
                <span>Lift</span>
              </div>
            </div>
          )}
          
          {visualizationMode === VisualizationModes.FEED_RATE && (
            <div className="vis-legend-content">
              <div className="vis-legend-gradient feed-gradient"></div>
              <div className="vis-legend-labels">
                <span>Low</span>
                <span>Feed Rate</span>
                <span>High</span>
              </div>
            </div>
          )}
          
          {visualizationMode === VisualizationModes.Z_HEIGHT && (
            <div className="vis-legend-content">
              <div className="vis-legend-gradient z-gradient"></div>
              <div className="vis-legend-labels">
                <span>Min</span>
                <span>Z-Height</span>
                <span>Max</span>
              </div>
            </div>
          )}
          
          {visualizationMode === VisualizationModes.MOVE_DISTANCE && (
            <div className="vis-legend-content">
              <div className="vis-legend-gradient distance-gradient"></div>
              <div className="vis-legend-labels">
                <span>Short</span>
                <span>Distance</span>
                <span>Long</span>
              </div>
            </div>
          )}
          
          {visualizationMode === VisualizationModes.SEQUENCE && (
            <div className="vis-legend-content">
              <div className="vis-legend-gradient sequence-gradient"></div>
              <div className="vis-legend-labels">
                <span>Start</span>
                <span>Sequence</span>
                <span>End</span>
              </div>
            </div>
          )}
          
          {visualizationMode === VisualizationModes.TOOL_NUMBER && (
            <div className="vis-legend-content tool-legend">
              <div className="vis-legend-item">
                <div className="vis-legend-color tool1"></div>
                <span>Tool 1</span>
              </div>
              <div className="vis-legend-item">
                <div className="vis-legend-color tool2"></div>
                <span>Tool 2</span>
              </div>
              <div className="vis-legend-item">
                <div className="vis-legend-color tool3"></div>
                <span>Tool 3+</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualizationSettings;