// App.js with updated toolbar implementation and plugin system
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  DockviewReact,
  themeDark,
  themeLight,
  themeVisualStudio,
  themeAbyss,
  themeDracula,
  themeReplit,
  themeLightSpaced,
  themeAbyssSpaced
} from 'dockview';
import 'dockview/dist/styles/dockview.css';
import './App.css';
import './styles/layout.css';
import './styles/console.css';
import './styles/control-panel.css';
import './styles/monitor-panel.css';
import './styles/serial-connection.css';
import './styles/3dview-panel.css';
import './styles/toolbar.css';
import './styles/robot-settings.css';

import MainToolbar from './components/common/MainToolBar';
import dockingManager from './services/docking/DockingManager';
import { GCodeProvider } from './contexts/GCodeContext';
import './services/SerialCommunicationService';

// Import panel components
import ControlPanel from './components/panels/ControlPanel';
import MonitorPanel from './components/panels/MonitorPanel';
import Viewer3DPanel from './components/panels/Viewer3D/exports';
import CodeEditorPanel from './components/panels/CodeEditor';
import ConsolePanel from './components/panels/ConsolePanel';
import AccelerationPanel from './components/panels/AccelerationPanel';

/**
 * Main application component
 */
function App() {
  const dockviewRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('dracula');
  const [dockviewApi, setDockviewApi] = useState(null);
  const [componentVersion, setComponentVersion] = useState(0); // For forcing component updates

  const MINIMUM_WIDTH = 380; // Minimum width in pixels

  // Define available themes
  const availableThemes = [
    { id: 'dark', name: 'Dark', theme: themeDark },
    { id: 'light', name: 'Light', theme: themeLight },
    { id: 'visual-studio', name: 'Visual Studio', theme: themeVisualStudio },
    { id: 'abyss', name: 'Abyss', theme: themeAbyss },
    { id: 'dracula', name: 'Dracula', theme: themeDracula },
    { id: 'replit', name: 'Replit', theme: themeReplit },
    { id: 'light-spaced', name: 'Light Spaced', theme: themeLightSpaced },
    { id: 'abyss-spaced', name: 'Abyss Spaced', theme: themeAbyssSpaced }
  ];

  // Load saved theme from localStorage on initial load
  useEffect(() => {
    const savedTheme = localStorage.getItem('preferredTheme');
    if (savedTheme && availableThemes.some(t => t.id === savedTheme)) {
      setCurrentTheme(savedTheme);
    }
  }, []);

  // Make utilities available globally for plugins
  useEffect(() => {
    // Make GCode parser available
    if (window.GCodeParser === undefined) {
      import('./utils/GCodeParser').then(module => {
        window.GCodeParser = module.default;
      });
    }
    
    // Make serial service available
    if (window.serialService === undefined) {
      import('./services/SerialCommunicationService').then(module => {
        window.serialService = module.default;
      });
    }
    
    // Initialize plugin manager with panel registry
    import('./services/plugins/PluginManager').then(module => {
      const manager = module.default;
      if (window.panelDefinitions) {
        manager.initialize(window.panelDefinitions);
      }
    });
    
    // Make React available globally for plugins
    window.React = React;
  }, []);

  // Listen for plugin load events to update components
  useEffect(() => {
    const handlePluginLoaded = () => {
      console.log('Plugin loaded event received, updating components');
      // Force component refresh
      setComponentVersion(v => v + 1);
    };
    
    const handlePluginUnloaded = () => {
      console.log('Plugin unloaded event received, updating components');
      // Force component refresh
      setComponentVersion(v => v + 1);
    };
    
    // Wait a bit for enhancedPluginManager to be available
    const setupListeners = () => {
      if (window.enhancedPluginManager) {
        window.enhancedPluginManager.eventBus.addEventListener('pluginLoaded', handlePluginLoaded);
        window.enhancedPluginManager.eventBus.addEventListener('pluginUnloaded', handlePluginUnloaded);
        
        return () => {
          window.enhancedPluginManager.eventBus.removeEventListener('pluginLoaded', handlePluginLoaded);
          window.enhancedPluginManager.eventBus.removeEventListener('pluginUnloaded', handlePluginUnloaded);
        };
      }
    };
    
    // Try immediately
    const cleanup = setupListeners();
    
    // If not available yet, try again after a delay
    if (!cleanup) {
      const timer = setTimeout(() => {
        setupListeners();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    
    return cleanup;
  }, []);

  // Get current theme object from theme ID
  const getCurrentThemeObject = useCallback(() => {
    const found = availableThemes.find(t => t.id === currentTheme);
    
    // Apply theme class to document root for global styling
    document.documentElement.className = `theme-${currentTheme}`;
    
    // Apply CSS variables from the theme to the document root
    if (found && found.theme) {
      const themeVars = found.theme.colors || {};
      Object.entries(themeVars).forEach(([key, value]) => {
        if (key.startsWith('--')) {
          document.documentElement.style.setProperty(key, value);
        }
      });
    }
    
    return found ? found.theme : themeDracula;
  }, [currentTheme]);

  // Handle theme change
  const handleThemeChange = useCallback((themeId) => {
    setCurrentTheme(themeId);
    // Save theme preference in localStorage
    localStorage.setItem('preferredTheme', themeId);
  }, []);

  // File open handler
  const handleFileOpen = useCallback(() => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.gcode,.nc,.tap,.cnc';
    fileInput.click();
    
    fileInput.onchange = (event) => {
      const file = event.target.files[0];
      if (file) {
        // Find GCode editor panel to open the file in
        const editorPanel = dockviewApi.panels.find(p => 
          p.component === 'codeEditor' || p.id.startsWith('codeEditor')
        );
        
        if (editorPanel) {
          // Read the file and pass it to the editor
          const reader = new FileReader();
          reader.onload = (e) => {
            // Dispatch custom event for the editor panel to handle
            document.dispatchEvent(new CustomEvent('file-content-loaded', {
              detail: {
                name: file.name,
                content: e.target.result
              }
            }));
          };
          reader.readAsText(file);
        } else {
          // If no editor panel exists, create one and then open the file
          dockingManager.addPanel('codeEditor');
          // Short delay to ensure panel is created
          setTimeout(() => {
            const reader = new FileReader();
            reader.onload = (e) => {
              document.dispatchEvent(new CustomEvent('file-content-loaded', {
                detail: {
                  name: file.name,
                  content: e.target.result
                }
              }));
            };
            reader.readAsText(file);
          }, 100);
        }
      }
    };
  }, [dockviewApi]);

  // Create wrapper components for our panels
  const ControlPanelWrapper = React.memo(props => {
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <ControlPanel {...params} />
      </div>
    );
  });

  const MonitorPanelWrapper = React.memo(props => {
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <MonitorPanel {...params} />
      </div>
    );
  });

  const Viewer3DPanelWrapper = React.memo(props => {
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <Viewer3DPanel {...params} />
      </div>
    );
  });

  const CodeEditorPanelWrapper = React.memo(props => {
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <CodeEditorPanel {...params} />
      </div>
    );
  });

  const ConsolePanelWrapper = React.memo(props => {
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <ConsolePanel {...params} />
      </div>
    );
  });

  const AccelerationPanelWrapper = React.memo(props => {
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <AccelerationPanel {...params} />
      </div>
    );
  });

  useEffect(() => {
  // Set Python backend port from environment or default
  window.PYTHON_BACKEND_PORT = process.env.REACT_APP_PYTHON_BACKEND_PORT || 8001;
}, []);

  // Define components for dockview - use dynamic components from panelComponents
 const components = useMemo(() => {
    console.log('Rebuilding components object, version:', componentVersion);
    
    // If panelComponents exists, use it directly as it contains all components
    if (window.panelComponents) {
      console.log('Using window.panelComponents:', Object.keys(window.panelComponents));
      return window.panelComponents;
    }
    
    // Fallback to local components if window.panelComponents doesn't exist
    return {
      controlPanel: ControlPanelWrapper,
      monitor: MonitorPanelWrapper,
      viewer3D: Viewer3DPanelWrapper,
      codeEditor: CodeEditorPanelWrapper,
      console: ConsolePanelWrapper,
      acceleration: AccelerationPanelWrapper
    };
  }, [componentVersion]); // Re-create when version changes

  // Handle ready event
  const onReady = (event) => {
    try {
      console.log('Dockview ready event received');
      setIsLoading(false);
      
      // Get the API and store it
      const { api } = event;
      setDockviewApi(api);
      
      // Make the dockviewApi globally available for plugins and tools
      window.dockviewApi = api;
      
      // Add a listener for when panels are added to set constraints immediately
      api.onDidAddPanel(panel => {
        console.log(`Panel added: ${panel.id}, setting minimum width to ${MINIMUM_WIDTH}px`);
        if (panel.api && panel.api.setConstraints) {
          panel.api.setConstraints({
            minimumWidth: MINIMUM_WIDTH,
            minimumHeight: 100
          });
        }
      });
      
      // Add a listener for groups as well
      api.onDidAddGroup(group => {
        console.log(`Group added: ${group.id}, setting minimum width to ${MINIMUM_WIDTH}px`);
        if (group.api && group.api.setConstraints) {
          group.api.setConstraints({
            minimumWidth: MINIMUM_WIDTH,
            minimumHeight: 100
          });
        }
      });
      
      // Initialize the docking manager which will load the default layout
      dockingManager.initialize(api);
      
      console.log('Docking manager initialized');
      
      // Add direct CSS override for additional enforcement
      // This is a backup method that forces minimum width via CSS
      const style = document.createElement('style');
      style.textContent = `
        .dv-panel {
          min-width: ${MINIMUM_WIDTH}px !important;
        }
        .dock-container .dockview-group {
          min-width: ${MINIMUM_WIDTH}px !important;
        }
      `;
      document.head.appendChild(style);
      
    } catch (err) {
      console.error('Error in onReady:', err);
      setError(err.message);
    }
  };

  // Handle panel addition
  const handleAddPanel = (panelType) => {
    if (!dockviewApi) return;
    
    try {
      dockingManager.addPanel(panelType);
    } catch (err) {
      console.error(`Error adding panel ${panelType}:`, err);
      setError(err.message);
    }
  };

  // Handle plugin import
  const handleImportPlugin = (pluginId) => {
    // This would integrate with your plugin system
    console.log(`Importing plugin: ${pluginId}`);
    
    // If you have a plugin manager, you would call it here
    if (window.pluginManager && typeof window.pluginManager.loadPlugin === 'function') {
      window.pluginManager.loadPlugin(pluginId)
        .then(plugin => {
          console.log(`Plugin ${pluginId} loaded:`, plugin);
        })
        .catch(err => {
          console.error(`Error loading plugin ${pluginId}:`, err);
        });
    }
  };

  return (
    <GCodeProvider>
      <div className="app-container">
        {/* New MainToolbar component */}
        <MainToolbar
          dockviewApi={dockviewApi}
          onThemeChange={handleThemeChange}
          currentTheme={currentTheme}
          availableThemes={availableThemes}
          onFileOpen={handleFileOpen}
          onAddPanel={handleAddPanel}
          onImportPlugin={handleImportPlugin}
        />
        
        <div className="dock-container">
          {error ? (
            <div className="error-container">
              <h2>Error initializing dockable layout</h2>
              <p>{error}</p>
              <button onClick={() => window.location.reload()} className="danger">
                Retry
              </button>
            </div>
          ) : (
            <DockviewReact
              components={components}
              onReady={onReady}
              theme={getCurrentThemeObject()}
            />
          )}
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
            </div>
          )}
        </div>
      </div>
    </GCodeProvider>
  );
}

export default App;