/**
 * Default layout configuration for the dockview component.
 * This defines the initial arrangement of panels when the application starts.
 */
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
                  views: [
                    {
                      id: 'control',
                      component: 'controlPanel',
                      params: { showAdvanced: false }
                    }
                  ],
                  activeView: 'control'
                },
                size: 20
              },
              {
                type: 'leaf',
                data: {
                  views: [
                    {
                      id: 'viewer',
                      component: 'viewer3D',
                      params: { showAxes: true }
                    }
                  ],
                  activeView: 'viewer'
                },
                size: 60
              },
              {
                type: 'leaf',
                data: {
                  views: [
                    {
                      id: 'editor',
                      component: 'codeEditor',
                      params: { language: 'gcode' }
                    }
                  ],
                  activeView: 'editor'
                },
                size: 20
              }
            ],
            size: 80
          },
          {
            type: 'leaf',
            data: {
              views: [
                {
                  id: 'monitor',
                  component: 'monitor',
                  params: { refreshRate: 1000 }
                }
              ],
              activeView: 'monitor'
            },
            size: 20
          }
        ],
        direction: 'column'
      },
      width: 1200,
      height: 800,
      orientation: 'horizontal'
    },
    panels: {},
    activePanel: null
  };