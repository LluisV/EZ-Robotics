import React, { useState, useEffect } from 'react';
import { 
  FileText, LayoutGrid, PlusSquare, Package, 
  Settings, ChevronDown, Plug, PlugZap
} from 'lucide-react';
import dockingManager from '../../services/docking/DockingManager';
import serialService from '../../services/SerialCommunicationService';

/**
 * Main toolbar component for Robot Control UI.
 * Modern, minimalist, IDE-like interface with all necessary controls.
 * 
 * @param {Object} props Component properties
 * @param {string} props.currentTheme Current theme ID
 * @param {Function} props.onThemeChange Function to call when theme changes
 * @param {Array} props.availableThemes List of available themes
 * @param {Object} props.dockviewApi Dockview API for layout management
 */
const MainToolbar = ({ 
  currentTheme = 'dracula', 
  onThemeChange, 
  availableThemes = [], 
  dockviewApi 
}) => {
  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [baudRate, setBaudRate] = useState('115200');
  
  // UI state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedPanelType, setSelectedPanelType] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState('');
  
  // Track available layouts
  const [layouts, setLayouts] = useState([]);
  const [currentLayout, setCurrentLayout] = useState('default');
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeDropdown && !event.target.closest('.toolbar-dropdown-trigger')) {
        setActiveDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeDropdown]);
  
  // Initialize with connection status
  useEffect(() => {
    // Check current connection status
    setIsConnected(serialService.getConnectionStatus());
    
    // Set up listener for connection changes
    const removeListener = serialService.addListener((event) => {
      if (event === 'connect') {
        setIsConnected(true);
      } else if (event === 'disconnect') {
        setIsConnected(false);
      }
    });
    
    return () => {
      if (removeListener) removeListener();
    };
  }, []);
  
  // Load available layouts
  useEffect(() => {
    if (dockviewApi) {
      // Get predefined layouts
      const predefined = dockingManager.getPredefinedLayouts();
      
      // Get user layouts from localStorage
      const userSaved = [];
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('layout_') && !key.includes('default')) {
            const layoutName = key.substring(7); // Remove 'layout_' prefix
            userSaved.push({
              id: layoutName,
              name: layoutName.charAt(0).toUpperCase() + layoutName.slice(1), 
              isPredefined: false
            });
          }
        }
      }
      
      setLayouts([...predefined, ...userSaved]);
    }
  }, [dockviewApi]);
  
  // Toggle dropdown visibility
  const toggleDropdown = (name) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };
  
  // Handle connection toggle
  const toggleConnection = async () => {
    if (isConnected) {
      await serialService.disconnect();
    } else {
      try {
        await serialService.connect(parseInt(baudRate, 10));
      } catch (err) {
        console.error('Connection error:', err);
      }
    }
  };
  
  // Handle file open
  const handleOpenFile = () => {
    // Trigger file input click
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.gcode,.nc,.cnc,.g';
    fileInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          // Dispatch custom event for file content
          const fileContent = e.target.result;
          document.dispatchEvent(new CustomEvent('fileLoaded', { 
            detail: { content: fileContent, name: file.name } 
          }));
        };
        reader.readAsText(file);
      }
    });
    fileInput.click();
  };
  
  // Apply a layout
  const applyLayout = (layoutId) => {
    dockingManager.loadLayout(layoutId);
    setCurrentLayout(layoutId);
    setActiveDropdown(null);
  };
  
  // Save current layout
  const saveCurrentLayout = () => {
    // Prompt for layout name
    const layoutName = prompt('Enter layout name:');
    if (layoutName) {
      dockingManager.saveLayout(layoutName);
      // Refresh layouts
      const updatedLayouts = [...layouts, { 
        id: layoutName, 
        name: layoutName, 
        isPredefined: false 
      }];
      setLayouts(updatedLayouts);
      setCurrentLayout(layoutName);
    }
  };
  
  // Add panel to the layout
  const handleAddPanel = () => {
    if (!selectedPanelType) return;
    
    try {
      dockingManager.addPanel(selectedPanelType);
      setSelectedPanelType('');
      setActiveDropdown(null);
    } catch (error) {
      console.error('Failed to add panel:', error);
    }
  };
  
  // Load plugin
  const handleLoadPlugin = () => {
    if (!selectedPlugin) return;
    
    // In a real implementation, this would load the plugin
    console.log(`Loading plugin: ${selectedPlugin}`);
    setSelectedPlugin('');
    setActiveDropdown(null);
  };
  
  // Get current layout name
  const getCurrentLayoutName = () => {
    const layout = layouts.find(l => l.id === currentLayout);
    return layout ? layout.name : 'Default';
  };
  
  return (
    <div className="main-toolbar">
      {/* Left side tools */}
      <div className="toolbar-section">
        {/* Open File */}
        <button 
          className="toolbar-button icon-button" 
          onClick={handleOpenFile}
          title="Open File"
        >
          <FileText size={16} />
        </button>
        
        <div className="toolbar-divider"></div>
        
        {/* Layout selector */}
        <div className="toolbar-dropdown toolbar-dropdown-trigger">
          <button 
            className="toolbar-button with-text" 
            onClick={() => toggleDropdown('layout')}
            title="Select Layout"
          >
            <LayoutGrid size={16} />
            <span className="button-text">{getCurrentLayoutName()}</span>
            <ChevronDown size={12} />
          </button>
          
          {activeDropdown === 'layout' && (
            <div className="toolbar-dropdown-content">
              <div className="dropdown-section">
                <div className="dropdown-section-title">Predefined Layouts</div>
                {layouts
                  .filter(layout => layout.isPredefined)
                  .map(layout => (
                    <button 
                      key={layout.id}
                      className={`dropdown-item ${currentLayout === layout.id ? 'active' : ''}`}
                      onClick={() => applyLayout(layout.id)}
                    >
                      {layout.name}
                    </button>
                  ))
                }
              </div>
              
              {layouts.some(layout => !layout.isPredefined) && (
                <div className="dropdown-section">
                  <div className="dropdown-section-title">User Layouts</div>
                  {layouts
                    .filter(layout => !layout.isPredefined)
                    .map(layout => (
                      <div key={layout.id} className="dropdown-item-with-action">
                        <button 
                          className={`dropdown-item ${currentLayout === layout.id ? 'active' : ''}`}
                          onClick={() => applyLayout(layout.id)}
                        >
                          {layout.name}
                        </button>
                        <button 
                          className="dropdown-item-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            const confirm = window.confirm(`Delete layout "${layout.name}"?`);
                            if (confirm) {
                              localStorage.removeItem(`layout_${layout.id}`);
                              setLayouts(layouts.filter(l => l.id !== layout.id));
                              if (currentLayout === layout.id) {
                                applyLayout('default');
                              }
                            }
                          }}
                          title="Delete layout"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  }
                </div>
              )}
              
              <div className="dropdown-divider"></div>
              <button 
                className="dropdown-item with-icon" 
                onClick={saveCurrentLayout}
              >
                <PlusSquare size={14} /> Save Current Layout
              </button>
            </div>
          )}
        </div>
        
        {/* Add Panel */}
        <div className="toolbar-dropdown toolbar-dropdown-trigger">
          <button 
            className="toolbar-button with-text" 
            onClick={() => toggleDropdown('panel')}
            title="Add Panel"
          >
            <PlusSquare size={16} />
            <span className="button-text">Panel</span>
            <ChevronDown size={12} />
          </button>
          
          {activeDropdown === 'panel' && (
            <div className="toolbar-dropdown-content">
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPanelType('controlPanel');
                  handleAddPanel();
                }}
              >
                Control Panel
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPanelType('monitor');
                  handleAddPanel();
                }}
              >
                Status Monitor
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPanelType('viewer3D');
                  handleAddPanel();
                }}
              >
                3D Viewer
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPanelType('codeEditor');
                  handleAddPanel();
                }}
              >
                G-Code Editor
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPanelType('console');
                  handleAddPanel();
                }}
              >
                Console
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPanelType('acceleration');
                  handleAddPanel();
                }}
              >
                Acceleration Profile
              </button>
            </div>
          )}
        </div>
        
        {/* Import Plugin */}
        <div className="toolbar-dropdown toolbar-dropdown-trigger">
          <button 
            className="toolbar-button with-text" 
            onClick={() => toggleDropdown('plugin')}
            title="Import Plugin"
          >
            <Package size={16} />
            <span className="button-text">Plugin</span>
            <ChevronDown size={12} />
          </button>
          
          {activeDropdown === 'plugin' && (
            <div className="toolbar-dropdown-content">
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPlugin('imageToGcode');
                  handleLoadPlugin();
                }}
              >
                Image to G-Code
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPlugin('mazeSolver');
                  handleLoadPlugin();
                }}
              >
                Maze Solver
              </button>
              <button 
                className="dropdown-item"
                onClick={() => {
                  setSelectedPlugin('objectPalletizer');
                  handleLoadPlugin();
                }}
              >
                Object Palletizer
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Center - Connection status */}
      <div className="toolbar-section center">
        <div className="connection-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
          <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      {/* Right side controls */}
      <div className="toolbar-section">
        {/* Connection controls */}
        <div className="connection-controls">
          <select 
            className="baud-select"
            value={baudRate}
            onChange={(e) => setBaudRate(e.target.value)}
            disabled={isConnected}
          >
            <option value="9600">9600</option>
            <option value="19200">19200</option>
            <option value="38400">38400</option>
            <option value="57600">57600</option>
            <option value="115200">115200</option>
            <option value="230400">230400</option>
            <option value="250000">250000</option>
          </select>
          
          <button 
            className={`connect-button ${isConnected ? 'connected' : 'disconnected'}`}
            onClick={toggleConnection}
          >
            {isConnected ? (
              <>
                <PlugZap size={16} className="icon-pulse" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <Plug size={16} />
                <span>Connect</span>
              </>
            )}
          </button>
        </div>
        
        <div className="toolbar-divider"></div>
        
        {/* Theme selector */}
        <div className="toolbar-dropdown toolbar-dropdown-trigger">
          <button 
            className="toolbar-button with-text" 
            onClick={() => toggleDropdown('theme')}
            title="Change Theme"
          >
            <span className="button-text">Theme</span>
            <ChevronDown size={12} />
          </button>
          
          {activeDropdown === 'theme' && (
            <div className="toolbar-dropdown-content">
              {availableThemes.map(theme => (
                <button 
                  key={theme.id}
                  className={`dropdown-item ${currentTheme === theme.id ? 'active' : ''}`}
                  onClick={() => {
                    onThemeChange(theme.id);
                    setActiveDropdown(null);
                  }}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Settings */}
        <button className="toolbar-button icon-button" title="Settings">
          <Settings size={16} />
        </button>
      </div>
    </div>
  );
};

export default MainToolbar;