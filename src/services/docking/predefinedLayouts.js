/**
 * Predefined layouts that mimic common IDE layouts for different workflows
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

// Code-focused layout with larger editor area
export const codingLayout = {
  grid: {
    root: {
      type: 'branch',
      data: [
        {
          type: 'leaf',
          data: {
            views: [
              {
                id: 'control',
                component: 'controlPanel',
                params: { showAdvanced: true }
              }
            ],
            activeView: 'control'
          },
          size: 15
        },
        {
          type: 'branch',
          data: [
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
              size: 70
            },
            {
              type: 'branch',
              data: [
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
                  size: 50
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
                  size: 50
                }
              ],
              direction: 'column',
              size: 30
            }
          ],
          direction: 'row',
          size: 85
        }
      ],
      direction: 'row'
    },
    width: 1200,
    height: 800,
    orientation: 'horizontal'
  },
  panels: {},
  activePanel: null
};

// 3D view focused layout for modeling and visualization
export const visualizationLayout = {
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
              size: 100
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
              size: 100
            }
          ],
          direction: 'column',
          size: 20
        },
        {
          type: 'branch',
          data: [
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
          direction: 'column',
          size: 80
        }
      ],
      direction: 'row'
    },
    width: 1200,
    height: 800,
    orientation: 'horizontal'
  },
  panels: {},
  activePanel: null
};

// Layout for monitoring with emphasis on status displays
export const monitoringLayout = {
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
                    id: 'viewer',
                    component: 'viewer3D',
                    params: { showAxes: true }
                  }
                ],
                activeView: 'viewer'
              },
              size: 50
            },
            {
              type: 'leaf',
              data: {
                views: [
                  {
                    id: 'control',
                    component: 'controlPanel',
                    params: { showAdvanced: true }
                  }
                ],
                activeView: 'control'
              },
              size: 50
            }
          ],
          direction: 'column',
          size: 40
        },
        {
          type: 'branch',
          data: [
            {
              type: 'leaf',
              data: {
                views: [
                  {
                    id: 'monitor',
                    component: 'monitor',
                    params: { refreshRate: 500 }
                  }
                ],
                activeView: 'monitor'
              },
              size: 70
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
              size: 30
            }
          ],
          direction: 'column',
          size: 60
        }
      ],
      direction: 'row'
    },
    width: 1200,
    height: 800,
    orientation: 'horizontal'
  },
  panels: {},
  activePanel: null
};