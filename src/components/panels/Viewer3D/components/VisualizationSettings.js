import React, { useState } from 'react';
import { VisualizationModes } from '../utils/VisualizationModes';

/**
 * Component to control toolpath visualization settings
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
 * @param {Function} props.reapplyVisualization Function to reapply visualization
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
  setShowPathLine,
  reapplyVisualization
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
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
    <div style={{ margin: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
          Visualization:
        </label>
        
        <select
          value={visualizationMode}
          onChange={handleVisualizationModeChange}
          style={{
            fontSize: '12px',
            padding: '2px 4px',
            border: '1px solid var(--border-color)',
            borderRadius: '3px',
            background: 'var(--bg-light)'
          }}
        >
          {visualizationOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '10px',
            cursor: 'pointer',
            padding: '0 4px'
          }}
          title="Visualization settings"
        >
          {isExpanded ? '▼' : '▶︎'}
        </button>
      </div>
      
      {isExpanded && (
        <div style={{ 
          marginTop: '5px', 
          marginLeft: '20px', 
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--bg-medium)',
          padding: '8px',
          borderRadius: '4px'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={showPathLine}
              onChange={handlePathLineChange}
              style={{ margin: 0 }}
            />
            Show Path Overview
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              checked={showDirectionIndicators}
              onChange={handleDirectionIndicatorsChange}
              style={{ margin: 0 }}
            />
            Show Direction Indicators
          </label>
          
          {showDirectionIndicators && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '20px' }}>
                <span>Density:</span>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={directionIndicatorDensity * 100}
                  onChange={handleDensityChange}
                  style={{ width: '100px' }}
                />
                <span>{Math.round(directionIndicatorDensity * 100)}%</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '20px' }}>
                <span>Size:</span>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={directionIndicatorScale * 100}
                  onChange={handleScaleChange}
                  style={{ width: '100px' }}
                />
                <span>{Math.round(directionIndicatorScale * 100)}%</span>
              </div>
            </>
          )}
          
          {/* Visualization Legends */}
          <div style={{ marginTop: '5px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Legend:</div>
            
            {visualizationMode === VisualizationModes.MOVE_TYPE && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#3498db', borderRadius: '2px' }}></div>
                  <span>Rapid Move</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#f39c12', borderRadius: '2px' }}></div>
                  <span>Cut</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#e74c3c', borderRadius: '2px' }}></div>
                  <span>Plunge</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#2ecc71', borderRadius: '2px' }}></div>
                  <span>Lift</span>
                </div>
              </div>
            )}
            
            {visualizationMode === VisualizationModes.FEED_RATE && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ 
                  height: '20px', 
                  background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                  borderRadius: '2px',
                  marginBottom: '4px'
                }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Low</span>
                  <span>Feed Rate</span>
                  <span>High</span>
                </div>
              </div>
            )}
            
            {visualizationMode === VisualizationModes.Z_HEIGHT && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ 
                  height: '20px', 
                  background: 'linear-gradient(to right, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                  borderRadius: '2px',
                  marginBottom: '4px'
                }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Min</span>
                  <span>Z-Height</span>
                  <span>Max</span>
                </div>
              </div>
            )}
            
            {visualizationMode === VisualizationModes.MOVE_DISTANCE && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ 
                  height: '20px', 
                  background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                  borderRadius: '2px',
                  marginBottom: '4px'
                }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Short</span>
                  <span>Distance</span>
                  <span>Long</span>
                </div>
              </div>
            )}
            
            {visualizationMode === VisualizationModes.SEQUENCE && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ 
                  height: '20px', 
                  background: 'linear-gradient(to right, #ff0000, #ff00ff, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)',
                  borderRadius: '2px',
                  marginBottom: '4px'
                }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Start</span>
                  <span>Sequence</span>
                  <span>End</span>
                </div>
              </div>
            )}
            
            {visualizationMode === VisualizationModes.TOOL_NUMBER && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#e74c3c', borderRadius: '2px' }}></div>
                  <span>Tool 1</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#3498db', borderRadius: '2px' }}></div>
                  <span>Tool 2</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: '#2ecc71', borderRadius: '2px' }}></div>
                  <span>Tool 3</span>
                </div>
                <div style={{ fontSize: '10px', fontStyle: 'italic', marginTop: '3px' }}>
                  Colors assigned sequentially to tool numbers
                </div>
              </div>
            )}
            
            <button
              onClick={reapplyVisualization}
              style={{
                marginTop: '8px',
                padding: '3px 8px',
                fontSize: '11px',
                backgroundColor: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Reapply Visualization
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizationSettings;