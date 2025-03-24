import React from 'react';

/**
 * Toolbar component with action buttons and layout controls
 */
const Toolbar = () => {
  return (
    <div className="toolbar-container">
      <div className="toolbar-group">
        <button className="toolbar-button">
          Open File
        </button>
        <button className="toolbar-button">
          Save Layout
        </button>
        <button className="toolbar-button">
          Reset Layout
        </button>
        <div className="toolbar-divider"></div>
        
        <button className="toolbar-button" title="Start">
          <span style={{ color: 'var(--accent-green)' }}>▶</span>
        </button>
        <button className="toolbar-button" title="Pause">
          <span style={{ color: 'var(--accent-orange)' }}>⏸</span>
        </button>
        <button className="toolbar-button" title="Stop">
          <span style={{ color: 'var(--accent-red)' }}>⏹</span>
        </button>
      </div>
      
      <div className="toolbar-group">
        <span>Add Panel:</span>
        <select className="toolbar-select">
          <option value="">Select Panel</option>
          <option value="controlPanel">Control Panel</option>
          <option value="monitor">Status Monitor</option>
          <option value="viewer3D">3D Viewer</option>
          <option value="codeEditor">G-Code Editor</option>
          <option value="taskManager">Task Manager</option>
          <option value="pluginPanel">Plugin Panel</option>
        </select>
        <button className="toolbar-button">
          Add
        </button>
      </div>
      
      <div className="toolbar-group">
        <span>Plugins:</span>
        <select className="toolbar-select">
          <option value="">Select Plugin</option>
          <option value="imageToGcode">Image to G-Code</option>
          <option value="mazeSolver">Maze Solver</option>
          <option value="objectPalletizer">Object Palletizer</option>
        </select>
        <button className="toolbar-button">
          Load
        </button>
      </div>
    </div>
  );
};

export default Toolbar;