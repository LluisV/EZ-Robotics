import React, { useState } from 'react';
import GridEditor from './components/GridEditor';

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
  isPerspective,
  togglePerspective,
  fileInputRef,
  gridDimensions,
  setGridDimensions
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

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={showMousePosition}
              onChange={toggleMousePosition}
              style={{ margin: 0 }}
            />
            Show Coordinates
          </label>
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
          />
        </div>
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