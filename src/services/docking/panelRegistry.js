import React from 'react';
// Import panel components with validation
let ControlPanel, MonitorPanel, Viewer3DPanel, CodeEditorPanel;

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
  Viewer3DPanel = require('../../components/panels/Viewer3DPanel').default;
} catch (e) {
  console.error('Failed to import Viewer3DPanel:', e);
  Viewer3DPanel = () => <div>Viewer3D Panel (Import Error)</div>;
}

try {
  CodeEditorPanel = require('../../components/panels/CodeEditorPanel').default;
} catch (e) {
  console.error('Failed to import CodeEditorPanel:', e);
  CodeEditorPanel = () => <div>Code Editor Panel (Import Error)</div>;
}

/**
 * Registry of all panel components available in the application.
 * Each panel is wrapped with a common container for consistent styling.
 */
export const panelComponents = {
  controlPanel: (props) => {
    console.log('Rendering controlPanel with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <ControlPanel {...params} />
      </div>
    );
  },
  
  monitor: (props) => {
    console.log('Rendering monitor with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <MonitorPanel {...params} />
      </div>
    );
  },
  
  viewer3D: (props) => {
    console.log('Rendering viewer3D with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <Viewer3DPanel {...params} />
      </div>
    );
  },
  
  codeEditor: (props) => {
    console.log('Rendering codeEditor with props:', props);
    const params = props?.params || {};
    return (
      <div className="panel-container">
        <CodeEditorPanel {...params} />
      </div>
    );
  },
};

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
  }
];