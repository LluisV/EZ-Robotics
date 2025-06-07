import React from 'react';
// Import panel components with validation
let ControlPanel, MonitorPanel, Viewer3DPanel, CodeEditorPanel, ConsolePanel, AccelerationPanel;

try {
  ControlPanel = require('../../components/panels/ControlPanel').default;
} catch (e) {
  console.error('Failed to import ControlPanel:', e);
  ControlPanel = () => <div>Control Panel (Import Error)</div>;
}

try {
  MonitorPanel = require('../../components/panels/MonitorPanel').default;
} catch (e) {
  console.error('Failed to import MonitorPanel:', e);
  MonitorPanel = () => <div>Monitor Panel (Import Error)</div>;
}

try {
  Viewer3DPanel = require('../../components/panels/Viewer3D').default;
} catch (e) {
  console.error('Failed to import Viewer3DPanel:', e);
  Viewer3DPanel = () => <div>Viewer3D Panel (Import Error)</div>;
}

try {
  CodeEditorPanel = require('../../components/panels/CodeEditor').default;
} catch (e) {
  console.error('Failed to import CodeEditorPanel:', e);
  CodeEditorPanel = () => <div>Code Editor Panel (Import Error)</div>;
}

try {
  ConsolePanel = require('../../components/panels/ConsolePanel').default;
} catch (e) {
  console.error('Failed to import ConsolePanel:', e);
  ConsolePanel = () => <div>Console Panel (Import Error)</div>;
}

try {
  AccelerationPanel = require('../../components/panels/AccelerationPanel').default;
} catch (e) {
  console.error('Failed to import AccelerationPanel:', e);
  AccelerationPanel = () => <div>Acceleration Panel (Import Error)</div>;
}

/**
 * Registry of all panel components available in the application.
 * Each panel is wrapped with a common container for consistent styling.
 * All components are wrapped with React.memo for Dockview compatibility.
 */
export const panelComponents = {
  controlPanel: React.memo((props) => {
    console.log('Rendering controlPanel with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <ControlPanel {...params} />
      </div>
    );
  }),
  
  monitor: React.memo((props) => {
    console.log('Rendering monitor with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <MonitorPanel {...params} />
      </div>
    );
  }),
  
  viewer3D: React.memo((props) => {
    console.log('Rendering viewer3D with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <Viewer3DPanel {...params} />
      </div>
    );
  }),
  
  codeEditor: React.memo((props) => {
    console.log('Rendering codeEditor with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <CodeEditorPanel {...params} />
      </div>
    );
  }),
  
  console: React.memo((props) => {
    console.log('Rendering console with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <ConsolePanel {...params} />
      </div>
    );
  }),

  acceleration: React.memo((props) => {
    console.log('Rendering acceleration panel with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <AccelerationPanel {...params} />
      </div>
    );
  }),
};

// Set display names for debugging
Object.keys(panelComponents).forEach(key => {
  panelComponents[key].displayName = `MemoizedPanel_${key}`;
});

/**
 * Panel metadata definitions that include titles, icons, and other configuration.
 * Used for creating new panels and in the UI.
 */
export const panelDefinitions = [
  {
    id: 'controlPanel',
    title: 'Robot Control',
    component: 'controlPanel',
    params: { showAdvanced: false },
    defaultLocation: 'left'
  },
  {
    id: 'monitor',
    title: 'Status Monitor',
    component: 'monitor',
    params: { refreshRate: 1000 },
    defaultLocation: 'bottom'
  },
  {
    id: 'viewer3D',
    title: '3D Workspace Viewer',
    component: 'viewer3D',
    params: { showAxes: true },
    defaultLocation: 'center'
  },
  {
    id: 'codeEditor',
    title: 'G-Code Editor',
    component: 'codeEditor',
    params: { language: 'gcode' },
    defaultLocation: 'right'
  },
  {
    id: 'console',
    title: 'Command Console',
    component: 'console',
    params: {},
    defaultLocation: 'bottom'
  },
  {
    id: 'acceleration',
    title: 'Acceleration Profile',
    component: 'acceleration',
    params: { showAdvanced: false },
    defaultLocation: 'right'
  }
];

// Make panel components and definitions available globally for plugin system
if (typeof window !== 'undefined') {
  window.panelComponents = panelComponents;
  window.panelDefinitions = panelDefinitions;
}