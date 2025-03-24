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
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['control'],
                activeView: 'control',
                id: '1'
              },
              size: 60
            },
            {
              type: 'leaf',
              data: {
                views: ['monitor'],
                activeView: 'monitor',
                id: '2'
              },
              size: 40
            }
          ],
          direction: 'column',
          size: 15
        },
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['viewer'],
                activeView: 'viewer',
                id: '3'
              },
              size: 75
            },
            {
              type: 'leaf',
              data: {
                views: ['console'],
                activeView: 'console',
                id: '4'
              },
              size: 25
            }
          ],
          direction: 'column',
          size: 60
        },
        {
          type: 'leaf',
          data: {
            views: ['editor'],
            activeView: 'editor',
            id: '5'
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
      title: 'Robot Control'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: '3D Workspace Viewer'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'G-Code Editor'
    },
    console: {
      id: 'console',
      contentComponent: 'console',
      params: {},
      title: 'Command Console'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 1000 },
      title: 'Status Monitor'
    }
  },
  activeGroup: '2'
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
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['editor'],
                activeView: 'editor',
                id: '2'
              },
              size: 70
            },
            {
              type: 'leaf',
              data: {
                views: ['console'],
                activeView: 'console',
                id: '3'
              },
              size: 30
            }
          ],
          direction: 'column',
          size: 65
        },
        {
          type: 'leaf',
          data: {
            views: ['viewer', 'monitor'],
            activeView: 'viewer',
            id: '4'
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
      title: 'Robot Control'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'G-Code Editor'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: '3D Workspace Viewer'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 1000 },
      title: 'Status Monitor'
    },
    console: {
      id: 'console',
      contentComponent: 'console',
      params: {},
      title: 'Command Console'
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
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['viewer'],
                activeView: 'viewer',
                id: '2'
              },
              size: 70
            },
            {
              type: 'leaf',
              data: {
                views: ['console'],
                activeView: 'console',
                id: '3'
              },
              size: 30
            }
          ],
          direction: 'column',
          size: 60
        },
        {
          type: 'leaf',
          data: {
            views: ['monitor'],
            activeView: 'monitor',
            id: '4'
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
      title: 'Robot Control'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: '3D Workspace Viewer'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'G-Code Editor'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 1000 },
      title: 'Status Monitor'
    },
    console: {
      id: 'console',
      contentComponent: 'console',
      params: {},
      title: 'Command Console'
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
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: ['monitor'],
                activeView: 'monitor',
                id: '2'
              },
              size: 50
            },
            {
              type: 'leaf',
              data: {
                views: ['console'],
                activeView: 'console',
                id: '3'
              },
              size: 50
            }
          ],
          direction: 'column',
          size: 60
        },
        {
          type: 'leaf',
          data: {
            views: ['viewer', 'editor'],
            activeView: 'viewer',
            id: '4'
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
      title: 'Robot Control'
    },
    viewer: {
      id: 'viewer',
      contentComponent: 'viewer3D',
      params: { showAxes: true },
      title: '3D Workspace Viewer'
    },
    editor: {
      id: 'editor',
      contentComponent: 'codeEditor',
      params: { language: 'gcode' },
      title: 'G-Code Editor'
    },
    monitor: {
      id: 'monitor',
      contentComponent: 'monitor',
      params: { refreshRate: 500 },
      title: 'Status Monitor'
    },
    console: {
      id: 'console',
      contentComponent: 'console',
      params: {},
      title: 'Command Console'
    }
  },
  activeGroup: '2'
};