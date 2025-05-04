import React, { useState } from 'react';
import GridEditor from './components/GridEditor';
import MouseIndicatorSettings from './components/MouseIndicatorSettings';
import VisualizationSettings from './components/VisualizationSettings';
import { VisualizationModes } from './utils/VisualizationModes';

/**
 * Enhanced Controls component for the Viewer3D panel
 * Provides UI controls for various display options in a streamlined horizontal layout
 */
const Controls = ({
  showAxes,
  setShowAxes,
  showWorkAxes,
  setShowWorkAxes,
  isGridVisible,
  setIsGridVisible,
  showToolpath,
  setShowToolpath,
  showMousePosition,
  toggleMousePosition,
  indicatorSettings,
  setIndicatorSettings,
  isPerspective,
  togglePerspective,
  fileInputRef,
  gridDimensions,
  setGridDimensions,
  onFileSelect,
  visualizationMode = VisualizationModes.MOVE_TYPE,
  setVisualizationMode,
  showDirectionIndicators = false,
  setShowDirectionIndicators,
  directionIndicatorDensity = 0.05,
  setDirectionIndicatorDensity,
  directionIndicatorScale = 0.5,
  setDirectionIndicatorScale,
  showPathLine = true,
  setShowPathLine,
  reapplyVisualization
}) => {
  const [activeSection, setActiveSection] = useState(null);
  
  // Handle STL import
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };
  
  // Toggle section visibility
  const toggleSection = (section) => {
    if (activeSection === section) {
      setActiveSection(null);
    } else {
      setActiveSection(section);
    }
  };

  return (
    <div className="viewer-controls">
      <div className="controls-toolbar">
        {/* Display options */}
        <div className="controls-section">
          <div className="controls-display-toggles">
            <div className="toggle-group">
              <label className="toggle-switch active-toggle" title="Show/Hide World Axes">
                <input
                  type="checkbox"
                  checked={showAxes}
                  onChange={() => setShowAxes(!showAxes)}
                />
                <span className="toggle-label">World Axes</span>
                <span className={`toggle-indicator ${showAxes ? 'on' : 'off'}`}></span>
              </label>
              
              <label className="toggle-switch active-toggle" title="Show/Hide Work Axes">
                <input
                  type="checkbox"
                  checked={showWorkAxes}
                  onChange={() => setShowWorkAxes(!showWorkAxes)}
                />
                <span className="toggle-label">Work Axes</span>
                <span className={`toggle-indicator ${showWorkAxes ? 'on' : 'off'}`}></span>
              </label>
              
              <label className="toggle-switch active-toggle" title="Show/Hide Grid">
                <input
                  type="checkbox"
                  checked={isGridVisible}
                  onChange={() => setIsGridVisible(!isGridVisible)}
                />
                <span className="toggle-label">Grid</span>
                <span className={`toggle-indicator ${isGridVisible ? 'on' : 'off'}`}></span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="controls-divider"></div>
        
        {/* Mouse indicator settings - Combined toggle and dropdown */}
        <div className="controls-section mouse-indicator-section">
          <div className="section-toggle-container">
            <label className="toggle-switch active-toggle" title="Show/Hide Mouse Indicator">
              <input
                type="checkbox"
                checked={showMousePosition}
                onChange={toggleMousePosition}
              />
              <span className="toggle-label">Mouse Indicator</span>
              <span className={`toggle-indicator ${showMousePosition ? 'on' : 'off'}`}></span>
            </label>
            
            <button 
              className={`dropdown-toggle-btn ${activeSection === 'mouse' ? 'active' : ''}`}
              onClick={() => toggleSection('mouse')}
              title="Mouse Indicator Settings"
            >
              <span className="toggle-icon">{activeSection === 'mouse' ? '▼' : '▶'}</span>
            </button>
          </div>
          
          {activeSection === 'mouse' && (
            <div className="controls-dropdown">
              <MouseIndicatorSettings
                showMousePosition={showMousePosition}
                toggleMousePosition={toggleMousePosition}
                indicatorSettings={indicatorSettings}
                setIndicatorSettings={setIndicatorSettings}
              />
            </div>
          )}
        </div>
        
        <div className="controls-divider"></div>
        
        {/* Toolpath and Visualization settings - Combined toggle and dropdown */}
        <div className="controls-section visualization-section">
          <div className="section-toggle-container">
            <label className="toggle-switch active-toggle" title="Show/Hide Toolpath">
              <input
                type="checkbox"
                checked={showToolpath}
                onChange={() => setShowToolpath(!showToolpath)}
              />
              <span className="toggle-label">Toolpath</span>
              <span className={`toggle-indicator ${showToolpath ? 'on' : 'off'}`}></span>
            </label>
            
            <button 
              className={`dropdown-toggle-btn ${activeSection === 'visualization' ? 'active' : ''}`}
              onClick={() => toggleSection('visualization')}
              title="Visualization Settings"
            >
              <span className="toggle-icon">{activeSection === 'visualization' ? '▼' : '▶'}</span>
            </button>
          </div>
          
          {activeSection === 'visualization' && (
            <div className="controls-dropdown">
              <VisualizationSettings
                visualizationMode={visualizationMode}
                setVisualizationMode={setVisualizationMode}
                showDirectionIndicators={showDirectionIndicators}
                setShowDirectionIndicators={setShowDirectionIndicators}
                directionIndicatorDensity={directionIndicatorDensity}
                setDirectionIndicatorDensity={setDirectionIndicatorDensity}
                directionIndicatorScale={directionIndicatorScale}
                setDirectionIndicatorScale={setDirectionIndicatorScale}
                showPathLine={showPathLine}
                setShowPathLine={setShowPathLine}
              />
            </div>
          )}
        </div>
        
        <div className="controls-divider"></div>
        
        {/* Grid editor */}
        <div className="controls-section grid-section">
          <button 
            className={`controls-section-toggle ${activeSection === 'grid' ? 'active' : ''}`}
            onClick={() => toggleSection('grid')}
            title="Grid Settings"
          >
            <span>Workspace</span>
            <span className="toggle-icon">{activeSection === 'grid' ? '▼' : '▶'}</span>
          </button>
          
          {activeSection === 'grid' && (
            <div className="controls-dropdown">
              <GridEditor 
                gridDimensions={gridDimensions} 
                setGridDimensions={setGridDimensions} 
              />
            </div>
          )}
        </div>
        
        <div className="controls-divider"></div>
        
        {/* View and import options */}
        <div className="controls-section view-options">
          <div className="view-buttons">
            <button
              className={`view-btn ${!isPerspective ? 'active' : ''}`}
              onClick={togglePerspective}
              title="Orthographic View"
            >
              Ortho
            </button>
            <button
              className={`view-btn ${isPerspective ? 'active' : ''}`}
              onClick={togglePerspective}
              title="Perspective View"
            >
              Persp
            </button>
            <button
              className="view-btn import-btn"
              onClick={handleImportClick}
              title="Import STL file"
            >
              Import STL
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl"
              multiple
              style={{ display: 'none' }}
              onChange={onFileSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Controls;