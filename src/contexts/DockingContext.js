import React, { createContext, useContext, useState, useEffect } from 'react';
import dockingManager from '../services/docking/DockingManager';
import { panelDefinitions } from '../services/docking/panelRegistry';

// Create context with default value to avoid the null issue
const DockingContext = createContext({
  availablePanels: [],
  savedLayouts: [],
  isInitialized: false,
  initializeDockingManager: () => {},
  addPanel: () => {},
  removePanel: () => {},
  saveLayout: () => {},
  loadLayout: () => {},
  resetLayout: () => {}
});

/**
 * Provider component for docking context
 */
export const DockingProvider = ({ children }) => {
  const [availablePanels, setAvailablePanels] = useState(panelDefinitions);
  const [savedLayouts, setSavedLayouts] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved layouts from localStorage on init
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const layouts = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('layout_')) {
          layouts.push(key.substring(7)); // Remove 'layout_' prefix
        }
      }
      setSavedLayouts(layouts);
    }
  }, []);

  // Initialize docking manager
  const initializeDockingManager = (api) => {
    dockingManager.initialize(api);
    setIsInitialized(true);
  };

  // Add a new panel
  const addPanel = (panelType, params = {}, location = 'center') => {
    return dockingManager.addPanel(panelType, params, location);
  };

  // Remove a panel
  const removePanel = (panelId) => {
    dockingManager.removePanel(panelId);
  };

  // Save current layout
  const saveLayout = (name) => {
    const layout = dockingManager.saveLayout(name);
    if (!savedLayouts.includes(name)) {
      setSavedLayouts([...savedLayouts, name]);
    }
    return layout;
  };

  // Load a saved layout
  const loadLayout = (name) => {
    return dockingManager.loadLayout(name);
  };

  // Reset layout to default
  const resetLayout = () => {
    dockingManager.resetLayout();
  };

  // Context value
  const contextValue = {
    availablePanels,
    savedLayouts,
    isInitialized,
    initializeDockingManager,
    addPanel,
    removePanel,
    saveLayout,
    loadLayout,
    resetLayout
  };

  return (
    <DockingContext.Provider value={contextValue}>
      {children}
    </DockingContext.Provider>
  );
};

/**
 * Hook to use the docking context
 */
export const useDocking = () => {
  const context = useContext(DockingContext);
  if (context === null) {
    throw new Error('useDocking must be used within a DockingProvider');
  }
  return context;
};

export default DockingContext;