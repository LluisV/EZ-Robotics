import React, { useState, useEffect } from 'react';
import dockingManager from '../../services/docking/DockingManager';

/**
 * Layout Manager component for saving, loading, and managing dock layouts
 */
const LayoutManager = ({ dockviewApi }) => {
  const [layouts, setLayouts] = useState([]);
  const [activeLayout, setActiveLayout] = useState('default');
  const [newLayoutName, setNewLayoutName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Initialize docking manager with the API
  useEffect(() => {
    if (dockviewApi) {
      dockingManager.initialize(dockviewApi);
      loadSavedLayouts();
    }
  }, [dockviewApi]);

  // Load saved layouts from localStorage
  const loadSavedLayouts = () => {
    const savedLayouts = [];
    
    // Always include default layout
    savedLayouts.push({ id: 'default', name: 'Default Layout' });
    
    // Get user-saved layouts from localStorage
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('layout_')) {
          const layoutName = key.substring(7); // Remove 'layout_' prefix
          if (layoutName !== 'default') { // Skip default since we already added it
            savedLayouts.push({ id: layoutName, name: layoutName });
          }
        }
      }
    }
    
    setLayouts(savedLayouts);
  };

  // Save the current layout
  const saveLayout = () => {
    if (!newLayoutName.trim()) return;
    
    dockingManager.saveLayout(newLayoutName);
    setShowSaveDialog(false);
    setNewLayoutName('');
    loadSavedLayouts();
    setActiveLayout(newLayoutName);
  };

  // Load a layout
  const loadLayout = (layoutId) => {
    if (layoutId === 'default') {
      dockingManager.resetLayout();
    } else {
      dockingManager.loadLayout(layoutId);
    }
    setActiveLayout(layoutId);
  };

  // Delete a layout
  const deleteLayout = (layoutId, event) => {
    event.stopPropagation(); // Prevent triggering load layout
    
    if (layoutId === 'default') {
      alert('Cannot delete the default layout');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the "${layoutId}" layout?`)) {
      localStorage.removeItem(`layout_${layoutId}`);
      loadSavedLayouts();
      
      // If active layout was deleted, switch to default
      if (activeLayout === layoutId) {
        loadLayout('default');
      }
    }
  };

  return (
    <div className="layout-manager">
      <div className="toolbar-group">
        <select 
          className="toolbar-select"
          value={activeLayout}
          onChange={(e) => loadLayout(e.target.value)}
        >
          {layouts.map(layout => (
            <option key={layout.id} value={layout.id}>
              {layout.name}
            </option>
          ))}
        </select>
        
        <button 
          className="toolbar-button" 
          onClick={() => setShowSaveDialog(true)}
          title="Save current layout"
        >
          Save Layout
        </button>
        
        <button 
          className="toolbar-button" 
          onClick={() => loadLayout('default')}
          title="Reset to default layout"
        >
          Reset Layout
        </button>
      </div>
      
      {showSaveDialog && (
        <div className="layout-save-dialog">
          <div className="layout-save-dialog-content">
            <h3>Save Layout</h3>
            <input 
              type="text" 
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              placeholder="Layout name"
              className="layout-name-input"
            />
            <div className="layout-save-buttons">
              <button 
                className="toolbar-button" 
                onClick={() => setShowSaveDialog(false)}
              >
                Cancel
              </button>
              <button 
                className="toolbar-button primary" 
                onClick={saveLayout}
                disabled={!newLayoutName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LayoutManager;