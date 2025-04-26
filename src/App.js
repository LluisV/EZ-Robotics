import React, { useState, useRef, useCallback, useEffect } from 'react';
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

import Header from './components/common/Header';
import Footer from './components/common/Footer';
import Toolbar from './components/common/Toolbar';
import ThemeSelector from './components/common/ThemeSelector';
import dockingManager from './services/docking/DockingManager';
import { GCodeProvider } from './contexts/GCodeContext';
import './services/SerialCommunicationService';

// Import panel components
import ControlPanel from './components/panels/ControlPanel';
import MonitorPanel from './components/panels/MonitorPanel';
import Viewer3DPanel from './components/panels/Viewer3DPanel';
import CodeEditorPanel from './components/panels/CodeEditorPanel';
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
  }, [availableThemes]);

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
  }, [currentTheme, availableThemes]);

  // Handle theme change
  const handleThemeChange = useCallback((themeId) => {
    setCurrentTheme(themeId);
    // Save theme preference in localStorage
    localStorage.setItem('preferredTheme', themeId);
  }, []);

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

  // Define components for dockview
  const components = {
    controlPanel: ControlPanelWrapper,
    monitor: MonitorPanelWrapper,
    viewer3D: Viewer3DPanelWrapper,
    codeEditor: CodeEditorPanelWrapper,
    console: ConsolePanelWrapper,
    acceleration: AccelerationPanelWrapper
  };

  // Handle ready event
  const onReady = (event) => {
    try {
      console.log('Dockview ready event received');
      setIsLoading(false);
      
      // Get the API and store it
      const { api } = event;
      setDockviewApi(api);
      
      // Initialize the docking manager which will load the default layout
      dockingManager.initialize(api);
      
      console.log('Docking manager initialized');
    } catch (err) {
      console.error('Error in onReady:', err);
      setError(err.message);
    }
  };

  return (
    <GCodeProvider>
      <div className="app-container">
        <Header>
          <ThemeSelector 
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            availableThemes={availableThemes}
          />
        </Header>
        <Toolbar dockviewApi={dockviewApi} />
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