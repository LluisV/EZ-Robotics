import React, { useState } from 'react';
import GridEditor from './components/GridEditor';
import MouseIndicatorSettings from './components/MouseIndicatorSettings';
import VisualizationSettings from './components/VisualizationSettings';
import { VisualizationModes } from './utils/VisualizationModes';

/**
 * Controls component for the Viewer3D panel
 * Provides UI controls for various display options
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
  onFileSelect,  // For importing STL files
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
  // Handle STL import
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="panel-header" style={{ flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showAxes}
              onChange={() => setShowAxes(!showAxes)}
              style={{ margin: 0 }}
            />
            World Axes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showWorkAxes}
              onChange={() => setShowWorkAxes(!showWorkAxes)}
              style={{ margin: 0 }}
            />
            Work Axes
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={isGridVisible}
              onChange={() => setIsGridVisible(!isGridVisible)}
              style={{ margin: 0 }}
            />
            Grid
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showToolpath}
              onChange={() => setShowToolpath(!showToolpath)}
              style={{ margin: 0 }}
            />
            Toolpath
          </label>

          <MouseIndicatorSettings
            showMousePosition={showMousePosition}
            toggleMousePosition={toggleMousePosition}
            indicatorSettings={indicatorSettings}
            setIndicatorSettings={setIndicatorSettings}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
          <button
            className={`toolbar-button ${!isPerspective ? 'primary' : ''}`}
            onClick={togglePerspective}
            title="Orthographic View"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Ortho
          </button>
          <button
            className={`toolbar-button ${isPerspective ? 'primary' : ''}`}
            onClick={togglePerspective}
            title="Perspective View"
            style={{ padding: '4px 8px', fontSize: '11px' }}
          >
            Persp
          </button>
          <button
            className="toolbar-button"
            onClick={handleImportClick}
            title="Import STL file"
            style={{ padding: '4px 8px', fontSize: '11px' }}
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
      
      {/* New visualization settings section */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        gap: '12px', 
        marginTop: '10px', 
        paddingTop: '10px',
        borderTop: '1px solid var(--border-color)',
        flexWrap: 'wrap'
      }}>
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
          reapplyVisualization={reapplyVisualization}
        />
      </div>

      {/* Workspace size controls */}
      <GridEditor 
        gridDimensions={gridDimensions} 
        setGridDimensions={setGridDimensions} 
      />
    </div>
  );
};

export default Controls;