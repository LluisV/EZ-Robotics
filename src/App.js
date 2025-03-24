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
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import Toolbar from './components/common/Toolbar';
import ThemeSelector from './components/common/ThemeSelector';

// Import panel components
import ControlPanel from './components/panels/ControlPanel';
import MonitorPanel from './components/panels/MonitorPanel';
import Viewer3DPanel from './components/panels/Viewer3DPanel';
import CodeEditorPanel from './components/panels/CodeEditorPanel';

/**
 * Main application component
 */
function App() {
  const dockviewRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('dracula');

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

  // Define components for dockview
  const components = {
    controlPanel: ControlPanelWrapper,
    monitor: MonitorPanelWrapper,
    viewer3D: Viewer3DPanelWrapper,
    codeEditor: CodeEditorPanelWrapper
  };

  // Handle ready event
  const onReady = (event) => {
    try {
      console.log('Dockview ready event received');
      setIsLoading(false);
      
      // Get the API
      const { api } = event;
      
      // Add Control Panel on the left
      api.addPanel({
        id: 'control',
        component: 'controlPanel',
        params: { showAdvanced: false }
      });
      
      // Add 3D Viewer next to Control Panel
      api.addPanel({
        id: 'viewer',
        component: 'viewer3D',
        params: { showAxes: true },
        position: { referencePanel: 'control', direction: 'right' }
      });
      
      // Add Code Editor to the right of 3D Viewer
      api.addPanel({
        id: 'editor',
        component: 'codeEditor',
        params: { language: 'gcode' },
        position: { referencePanel: 'viewer', direction: 'right' }
      });
      
      // Add Monitor at the bottom spanning all columns
      api.addPanel({
        id: 'monitor',
        component: 'monitor',
        params: { refreshRate: 1000 },
        position: { referencePanel: 'viewer', direction: 'down' }
      });
      
      console.log('All panels added successfully');
    } catch (err) {
      console.error('Error in onReady:', err);
      setError(err.message);
    }
  };

  return (
    <div className="app-container">
      <Header>
        <ThemeSelector 
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          availableThemes={availableThemes}
        />
      </Header>
      <Toolbar />
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
      <Footer />
    </div>
  );
}

export default App;