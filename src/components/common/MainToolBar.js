import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, LayoutGrid, PlusSquare, Package, 
  Settings, ChevronDown, Plug, PlugZap, Palette
} from 'lucide-react';
import dockingManager from '../../services/docking/DockingManager';
import serialService from '../../services/SerialCommunicationService';
import { Upload } from 'lucide-react';
import enhancedPluginManager from '../../services/plugins/PluginManager';

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
  const [kinematicsType, setKinematicsType] = useState('Unknown');
  const [machineInfo, setMachineInfo] = useState({ firmware: '', version: '' });
  
  // UI state
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [selectedPanelType, setSelectedPanelType] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState('');

  // Plugin management states
  const [showPluginDialog, setShowPluginDialog] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState([]);
  const [isLoadingPlugin, setIsLoadingPlugin] = useState(false);
  const pluginInputRef = useRef(null);
    
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
    
    // Get current machine info
    const info = serialService.getMachineInfo();
    setKinematicsType(info.kinematics);
    setMachineInfo({ firmware: info.firmware, version: info.version });
    
    // Set up listener for connection changes
    const removeListener = serialService.addListener((event, data) => {
      if (event === 'connect') {
        setIsConnected(true);
      } else if (event === 'disconnect') {
        setIsConnected(false);
        // Reset kinematics on disconnect
        setKinematicsType('Unknown');
        setMachineInfo({ firmware: '', version: '' });
      } else if (event === 'kinematics') {
        // Update kinematics info when received
        setKinematicsType(data.type || 'Unknown');
        setMachineInfo({ 
          firmware: data.firmware || '', 
          version: data.version || '' 
        });
      }
    });
    
    // Also listen for kinematics events directly
    const handleKinematicsEvent = (event) => {
      const data = event.detail;
      if (data) {
        setKinematicsType(data.type || 'Unknown');
        setMachineInfo({ 
          firmware: data.firmware || '', 
          version: data.version || '' 
        });
      }
    };
    
    document.addEventListener('kinematics', handleKinematicsEvent);
    
    return () => {
      if (removeListener) removeListener();
      document.removeEventListener('kinematics', handleKinematicsEvent);
    };
  }, []);

  // Add this useEffect inside the MainToolbar component:

useEffect(() => {
  const handleDependencyStatus = (event) => {
    const { pluginId, status, type, notificationId, hide } = event.detail;
    
    if (hide) {
      // Remove notification
      const notification = document.getElementById(notificationId);
      if (notification) {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }
      return;
    }
    
    // Check if notification already exists
    let notification = document.getElementById(notificationId);
    
    if (!notification) {
      // Create new notification
      notification = document.createElement('div');
      notification.id = notificationId;
      notification.className = `dependency-notification ${type}`;
      notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: var(--bg-dark);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 1rem 1.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 1rem;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
      `;
      
      // Add spinner for loading states
      if (type === 'info') {
        const spinner = document.createElement('div');
        spinner.className = 'dependency-spinner';
        spinner.style.cssText = `
          width: 20px;
          height: 20px;
          border: 2px solid var(--accent-primary);
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        `;
        notification.appendChild(spinner);
      }
      
      // Add status text
      const statusText = document.createElement('div');
      statusText.className = 'dependency-status-text';
      statusText.style.cssText = `
        flex: 1;
        color: var(--text-primary);
      `;
      notification.appendChild(statusText);
      
      // Add close button for errors
      if (type === 'error') {
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
          margin-left: 1rem;
        `;
        closeBtn.onclick = () => {
          notification.classList.add('fade-out');
          setTimeout(() => notification.remove(), 300);
        };
        notification.appendChild(closeBtn);
      }
      
      document.body.appendChild(notification);
    }
    
    // Update status text
    const statusText = notification.querySelector('.dependency-status-text');
    if (statusText) {
      statusText.innerHTML = `
        <div style="font-weight: 500; margin-bottom: 0.25rem;">Plugin: ${pluginId}</div>
        <div style="font-size: 0.875rem; color: var(--text-secondary);">${status}</div>
      `;
    }
    
    // Update notification class for styling
    notification.className = `dependency-notification ${type}`;
    
    // Add appropriate icon for success
    if (type === 'success') {
      const spinner = notification.querySelector('.dependency-spinner');
      if (spinner) {
        spinner.remove();
      }
      
      // Add success icon if not already present
      if (!notification.querySelector('.success-icon')) {
        const successIcon = document.createElement('div');
        successIcon.className = 'success-icon';
        successIcon.innerHTML = '✓';
        successIcon.style.cssText = `
          width: 24px;
          height: 24px;
          background: var(--accent-success);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        `;
        notification.insertBefore(successIcon, notification.firstChild);
      }
      
      // Auto-hide success messages after 5 seconds
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }
    
    // Add error icon for errors
    if (type === 'error') {
      const spinner = notification.querySelector('.dependency-spinner');
      if (spinner) {
        spinner.remove();
      }
      
      if (!notification.querySelector('.error-icon')) {
        const errorIcon = document.createElement('div');
        errorIcon.className = 'error-icon';
        errorIcon.innerHTML = '!';
        errorIcon.style.cssText = `
          width: 24px;
          height: 24px;
          background: var(--accent-error);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        `;
        notification.insertBefore(errorIcon, notification.firstChild);
      }
    }
  };
  
  document.addEventListener('pluginDependencyStatus', handleDependencyStatus);
  
  return () => {
    document.removeEventListener('pluginDependencyStatus', handleDependencyStatus);
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

  // Load installed plugins and listen for changes
  useEffect(() => {
    const loadInstalledPlugins = () => {
      const plugins = enhancedPluginManager.getLoadedPlugins();
      setInstalledPlugins(plugins);
    };
    
    loadInstalledPlugins();
    
    // Listen for plugin load/unload events
    enhancedPluginManager.eventBus.addEventListener('pluginLoaded', loadInstalledPlugins);
    enhancedPluginManager.eventBus.addEventListener('pluginUnloaded', loadInstalledPlugins);
    
    return () => {
      enhancedPluginManager.eventBus.removeEventListener('pluginLoaded', loadInstalledPlugins);
      enhancedPluginManager.eventBus.removeEventListener('pluginUnloaded', loadInstalledPlugins);
    };
  }, []);
  
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
  const handleAddPanel = (panelType) => {
    if (!panelType) return;
    
    try {
      dockingManager.addPanel(panelType);
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

  // Handle plugin import from ZIP file
  const handlePluginImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      alert('Please select a valid plugin file (.zip)');
      return;
    }
    
    setIsLoadingPlugin(true);
    
    try {
      // Load the plugin
      const manifest = await enhancedPluginManager.loadPluginFromZip(file);
      
      // Show success message
      alert(`Plugin "${manifest.name}" loaded successfully!`);
      
      // Add panel to the layout if docking manager is initialized
      if (dockingManager.isInitialized()) {
        dockingManager.addPanel(
          manifest.id, 
          manifest.panel.params || {}, 
          manifest.panel.defaultLocation
        );
      }
      
    } catch (error) {
      console.error('Plugin import error:', error);
      alert(`Failed to import plugin: ${error.message}`);
    } finally {
      setIsLoadingPlugin(false);
      // Reset file input
      if (pluginInputRef.current) {
        pluginInputRef.current.value = '';
      }
    }
  };
  
  // Get current layout name
  const getCurrentLayoutName = () => {
    const layout = layouts.find(l => l.id === currentLayout);
    return layout ? layout.name : 'Default';
  };

  // Get current theme name
  const getCurrentThemeName = () => {
    const theme = availableThemes.find(t => t.id === currentTheme);
    return theme ? theme.name : 'Default';
  };

  // Get kinematics display info
  const getKinematicsDisplay = () => {
    if (kinematicsType === 'Unknown' || !isConnected) {
      return null;
    }
    
    return {
      name: kinematicsType,
      color: '#4caf50' // Simple green color for all kinematics types
    };
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
              onClick={() => handleAddPanel('controlPanel')}
            >
              Control Panel
            </button>
            <button 
              className="dropdown-item"
              onClick={() => handleAddPanel('monitor')}
            >
              Status Monitor
            </button>
            <button 
              className="dropdown-item"
              onClick={() => handleAddPanel('viewer3D')}
            >
              3D Viewer
            </button>
            <button 
              className="dropdown-item"
              onClick={() => handleAddPanel('codeEditor')}
            >
              G-Code Editor
            </button>
            <button 
              className="dropdown-item"
              onClick={() => handleAddPanel('console')}
            >
              Console
            </button>
            <button 
              className="dropdown-item"
              onClick={() => handleAddPanel('acceleration')}
            >
              Acceleration Profile
            </button>
          </div>
        )}
      </div>
      
      {/* Hidden file input for plugin import */}
      <input
        ref={pluginInputRef}
        type="file"
        accept=".zip"
        style={{ display: 'none' }}
        onChange={handlePluginImport}
      />
      
      {/* Plugin Management Dropdown */}
      <div className="toolbar-dropdown toolbar-dropdown-trigger">
        <button 
          className="toolbar-button with-text" 
          onClick={() => toggleDropdown('plugin')}
          title="Manage Plugins"
        >
          <Package size={16} />
          <span className="button-text">Plugins</span>
          <ChevronDown size={12} />
        </button>
        
        {activeDropdown === 'plugin' && (
          <div className="toolbar-dropdown-content">
            {/* Import Plugin Button */}
            <button 
              className="dropdown-item with-icon"
              onClick={() => pluginInputRef.current?.click()}
              disabled={isLoadingPlugin}
            >
              <Upload size={14} />
              {isLoadingPlugin ? 'Loading...' : 'Import Plugin (.zip)'}
            </button>
            
            <div className="dropdown-divider"></div>
            
            {/* Plugin Registry (Future) */}
            <button 
              className="dropdown-item with-icon"
              onClick={() => {
                alert('Plugin marketplace coming soon!');
                setActiveDropdown(null);
              }}
            >
              <Package size={14} />
              Browse Plugin Marketplace
            </button>
            
            <div className="dropdown-divider"></div>
            
            {/* Installed Plugins */}
            <div className="dropdown-section">
              <div className="dropdown-section-title">Installed Plugins</div>
              
              {installedPlugins.length === 0 ? (
                <div className="dropdown-item disabled">No plugins installed</div>
              ) : (
                installedPlugins.map(plugin => (
                  <div key={plugin.id} className="plugin-item">
                    <div className="plugin-info">
                      <span className="plugin-name">{plugin.name}</span>
                      <span className="plugin-version">v{plugin.version}</span>
                    </div>
                    {!plugin.builtIn && (
                      <button
                        className="plugin-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Unload plugin "${plugin.name}"?`)) {
                            enhancedPluginManager.unloadPlugin(plugin.id);
                          }
                        }}
                        title="Unload plugin"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            
            <div className="dropdown-divider"></div>
            
            {/* Developer Options */}
            <button 
              className="dropdown-item with-icon"
              onClick={() => {
                window.open('https://github.com/fluidnc/plugin-template', '_blank');
                setActiveDropdown(null);
              }}
            >
              <Package size={14} />
              Create New Plugin
            </button>
          </div>
        )}
      </div>
    </div>
    
    {/* Center - Connection status and machine info */}
    <div className="toolbar-section center">
      <div className="connection-status">
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></div>
        <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        
        {/* Kinematics Badge */}
        {getKinematicsDisplay() && (
          <div 
            className="kinematics-badge"
            style={{
              backgroundColor: getKinematicsDisplay().color + '20',
              color: getKinematicsDisplay().color,
              border: `1px solid ${getKinematicsDisplay().color}40`,
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: '600',
              marginLeft: '8px',
              letterSpacing: '0.5px'
            }}
            title={`Machine Type: ${kinematicsType}${machineInfo.firmware ? ` (${machineInfo.firmware})` : ''}`}
          >
            {getKinematicsDisplay().name}
          </div>
        )}
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
      
      {/* Theme selector - IMPROVED */}
      <div className="toolbar-dropdown toolbar-dropdown-trigger">
        <button 
          className="toolbar-button with-text theme-button" 
          onClick={() => toggleDropdown('theme')}
          title="Change Theme"
        >
          <Palette size={16} className="theme-icon" />
          <span className="button-text">Theme: {getCurrentThemeName()}</span>
          <ChevronDown size={12} />
        </button>
        
        {activeDropdown === 'theme' && (
          <div className="toolbar-dropdown-content theme-dropdown">
            {availableThemes.map(theme => (
              <button 
                key={theme.id}
                className={`dropdown-item theme-item ${currentTheme === theme.id ? 'active' : ''}`}
                onClick={() => {
                  onThemeChange(theme.id);
                  setActiveDropdown(null);
                }}
              >
                <span className={`theme-color-preview ${theme.id}`}></span>
                <span className="theme-name">{theme.name}</span>
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