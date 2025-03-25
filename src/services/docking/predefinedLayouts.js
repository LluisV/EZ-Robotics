/**
 * Predefined layouts for Dockview
 */

// Common panel definitions
const panelDefinitions = {
  control: {
    id: 'control',
    contentComponent: 'controlPanel',
    title: '⊹ Robot Control'
  },
  viewer: {
    id: 'viewer',
    contentComponent: 'viewer3D',
    params: { showAxes: true },
    title: '⬢ 3D Workspace Viewer'
  },
  editor: {
    id: 'editor',
    contentComponent: 'codeEditor',
    params: { language: 'gcode' },
    title: '❮❯ G-Code Editor'
  },
  console: {
    id: 'console',
    contentComponent: 'console',
    params: {},
    title: '❯_ Command Console'
  },
  monitor: {
    id: 'monitor',
    contentComponent: 'monitor',
    title: '◉ Status Monitor'
  }
};

// Helper function to create panel objects with customizable params
const createPanel = (id, extraParams = {}) => {
  const panel = { ...panelDefinitions[id] };
  panel.params = { ...(panel.params || {}), ...extraParams };
  return panel;
};

// Common layout configuration
const createLayout = (gridRoot, activeGroup = '2') => ({
  grid: {
    root: gridRoot,
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL'
  },
  panels: {
    control: createPanel('control', { showAdvanced: activeGroup === '2' }),
    viewer: createPanel('viewer'),
    editor: createPanel('editor'),
    console: createPanel('console'),
    monitor: createPanel('monitor', { 
      refreshRate: activeGroup === '2' && gridRoot.data[1]?.data?.[0]?.data?.views?.includes('monitor') ? 500 : 1000 
    })
  },
  activeGroup
});

// Default layout with balanced panels
export const defaultLayout = createLayout({
  type: 'branch',
  data: [
    {
      type: 'branch',
      data: [
        { type: 'leaf', data: { views: ['control'], activeView: 'control', id: '1' }, size: 60 },
        { type: 'leaf', data: { views: ['monitor'], activeView: 'monitor', id: '2' }, size: 40 }
      ],
      direction: 'column',
      size: 20
    },
    {
      type: 'branch',
      data: [
        { type: 'leaf', data: { views: ['viewer'], activeView: 'viewer', id: '3' }, size: 75 },
        { type: 'leaf', data: { views: ['console'], activeView: 'console', id: '4' }, size: 25 }
      ],
      direction: 'column',
      size: 60
    },
    { type: 'leaf', data: { views: ['editor'], activeView: 'editor', id: '5' }, size: 20 }
  ],
  direction: 'row',
  size: 100
});

// Code-focused layout with larger editor area
export const codingLayout = createLayout({
  type: 'branch',
  data: [
    { type: 'leaf', data: { views: ['control'], activeView: 'control', id: '1' }, size: 15 },
    {
      type: 'branch',
      data: [
        { type: 'leaf', data: { views: ['editor'], activeView: 'editor', id: '2' }, size: 70 },
        { type: 'leaf', data: { views: ['console'], activeView: 'console', id: '3' }, size: 30 }
      ],
      direction: 'column',
      size: 65
    },
    { type: 'leaf', data: { views: ['viewer', 'monitor'], activeView: 'viewer', id: '4' }, size: 20 }
  ],
  direction: 'row',
  size: 100
});

// 3D view focused layout for modeling and visualization
export const visualizationLayout = createLayout({
  type: 'branch',
  data: [
    { type: 'leaf', data: { views: ['control', 'editor'], activeView: 'control', id: '1' }, size: 20 },
    {
      type: 'branch',
      data: [
        { type: 'leaf', data: { views: ['viewer'], activeView: 'viewer', id: '2' }, size: 70 },
        { type: 'leaf', data: { views: ['console'], activeView: 'console', id: '3' }, size: 30 }
      ],
      direction: 'column',
      size: 60
    },
    { type: 'leaf', data: { views: ['monitor'], activeView: 'monitor', id: '4' }, size: 20 }
  ],
  direction: 'row',
  size: 100
});

// Layout for monitoring with emphasis on status displays
export const monitoringLayout = createLayout({
  type: 'branch',
  data: [
    { type: 'leaf', data: { views: ['control'], activeView: 'control', id: '1' }, size: 20 },
    {
      type: 'branch',
      data: [
        { type: 'leaf', data: { views: ['monitor'], activeView: 'monitor', id: '2' }, size: 50 },
        { type: 'leaf', data: { views: ['console'], activeView: 'console', id: '3' }, size: 50 }
      ],
      direction: 'column',
      size: 60
    },
    { type: 'leaf', data: { views: ['viewer', 'editor'], activeView: 'viewer', id: '4' }, size: 20 }
  ],
  direction: 'row',
  size: 100
});