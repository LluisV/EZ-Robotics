import React, { useState } from 'react';
import LayoutSelector from './LayoutSelector';
import dockingManager from '../../services/docking/DockingManager';

/**
 * Toolbar component with action buttons and layout controls
 */
const Toolbar = ({ dockviewApi }) => {
  const [selectedPanelType, setSelectedPanelType] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState('');

  // Add a new panel to the layout
  const handleAddPanel = () => {
    if (!selectedPanelType) return;
    
    try {
      dockingManager.addPanel(selectedPanelType);
      setSelectedPanelType('');
    } catch (error) {
      console.error('Failed to add panel:', error);
      alert(`Failed to add panel: ${error.message}`);
    }
  };

  // Load a plugin
  const handleLoadPlugin = () => {
    if (!selectedPlugin) return;
    
    // In a real implementation, this would load the plugin
    console.log(`Loading plugin: ${selectedPlugin}`);
    alert(`Plugin "${selectedPlugin}" would be loaded here.`);
    setSelectedPlugin('');
  };

  return (
    <div className="toolbar-container">
      <div className="toolbar-group">
        <button className="toolbar-button">
          Open File
        </button>
        
        {/* Layout Management Controls */}
        <LayoutSelector dockviewApi={dockviewApi} />
        
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
        <select 
          className="toolbar-select"
          value={selectedPanelType}
          onChange={(e) => setSelectedPanelType(e.target.value)}
        >
          <option value="">Select Panel</option>
          <option value="controlPanel">Control Panel</option>
          <option value="monitor">Status Monitor</option>
          <option value="viewer3D">3D Viewer</option>
          <option value="codeEditor">G-Code Editor</option>
          <option value="taskManager">Task Manager</option>
          <option value="pluginPanel">Plugin Panel</option>
        </select>
        <button 
          className="toolbar-button"
          onClick={handleAddPanel}
          disabled={!selectedPanelType}
        >
          Add
        </button>
      </div>
      
      <div className="toolbar-group">
        <span>Plugins:</span>
        <select 
          className="toolbar-select"
          value={selectedPlugin}
          onChange={(e) => setSelectedPlugin(e.target.value)}
        >
          <option value="">Select Plugin</option>
          <option value="imageToGcode">Image to G-Code</option>
          <option value="mazeSolver">Maze Solver</option>
          <option value="objectPalletizer">Object Palletizer</option>
        </select>
        <button 
          className="toolbar-button"
          onClick={handleLoadPlugin}
          disabled={!selectedPlugin}
        >
          Load
        </button>
      </div>
    </div>
  );
};

export default Toolbar;