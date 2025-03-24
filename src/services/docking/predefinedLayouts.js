/**
 * Predefined layouts that match the exact format expected by Dockview
 */

// Default layout with balanced panels
export const defaultLayout = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['control'],
            activeView: 'control',
            id: '1'
          },
          size: 20
        },
        {
          type: 'leaf',
          data: {
            views: ['viewer'],
            activeView: 'viewer',
            id: '2'
          },
          size: 60
        },
        {
          type: 'leaf',
          data: {
            views: ['editor'],
            activeView: 'editor',
            id: '3'
          },
          size: 20
        }
      ],
      direction: 'row',
      size: 80
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL'
  },
  panels: {
    control: {
      id: 'control',
      contentComponent: 'controlPanel',
      params: { showAdvanced: false },
      title: 'control'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: 'viewer'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'editor'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 1000 },
      title: 'monitor'
    }
  },
  activeGroup: '1'
};

// Code-focused layout with larger editor area
export const codingLayout = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['control'],
            activeView: 'control',
            id: '1'
          },
          size: 15
        },
        {
          type: 'leaf',
          data: {
            views: ['editor'],
            activeView: 'editor',
            id: '2'
          },
          size: 65
        },
        {
          type: 'leaf',
          data: {
            views: ['viewer', 'monitor'],
            activeView: 'monitor',
            id: '3'
          },
          size: 20
        }
      ],
      direction: 'row',
      size: 100
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL'
  },
  panels: {
    control: {
      id: 'control',
      contentComponent: 'controlPanel',
      params: { showAdvanced: true },
      title: 'control'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'editor'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: 'viewer'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 1000 },
      title: 'monitor'
    }
  },
  activeGroup: '2'
};

// 3D view focused layout for modeling and visualization
export const visualizationLayout = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['control', 'editor'],
            activeView: 'control',
            id: '1'
          },
          size: 20
        },
        {
          type: 'leaf',
          data: {
            views: ['viewer'],
            activeView: 'viewer',
            id: '2'
          },
          size: 60
        },
        {
          type: 'leaf',
          data: {
            views: ['monitor'],
            activeView: 'monitor',
            id: '3'
          },
          size: 20
        }
      ],
      direction: 'row',
      size: 100
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL'
  },
  panels: {
    control: {
      id: 'control',
      contentComponent: 'controlPanel',
      params: { showAdvanced: false },
      title: 'control'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: 'viewer'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'editor'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 1000 },
      title: 'monitor'
    }
  },
  activeGroup: '2'
};

// Layout for monitoring with emphasis on status displays
export const monitoringLayout = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: ['control'],
            activeView: 'control',
            id: '1'
          },
          size: 20
        },
        {
          type: 'leaf',
          data: {
            views: ['monitor'],
            activeView: 'monitor',
            id: '2'
          },
          size: 60
        },
        {
          type: 'leaf',
          data: {
            views: ['viewer', 'editor'],
            activeView: 'viewer',
            id: '3'
          },
          size: 20
        }
      ],
      direction: 'row',
      size: 100
    },
    width: 1200,
    height: 800,
    orientation: 'HORIZONTAL'
  },
  panels: {
    control: {
      id: 'control',
      contentComponent: 'controlPanel',
      params: { showAdvanced: true },
      title: 'control'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: 'viewer'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'editor'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 500 },
      title: 'monitor'
    }
  },
  activeGroup: '2'
};