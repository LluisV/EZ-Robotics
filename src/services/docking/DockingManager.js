import { panelDefinitions } from './panelRegistry';
import { 
  defaultLayout, 
  codingLayout, 
  visualizationLayout, 
  monitoringLayout 
} from './predefinedLayouts';

/**
 * Service class to manage the dockable layout
 */
class DockingManager {
  constructor() {
    this.api = null;
    this.layouts = {};
    
    // Initialize with predefined layouts
    this.predefinedLayouts = {
      'default': defaultLayout,
      'coding': codingLayout,
      'visualization': visualizationLayout,
      'monitoring': monitoringLayout
    };
  }

  /**
   * Initialize the docking manager with the dockview API
   * @param {Object} api Dockview API instance
   */
  initialize(api) {
    this.api = api;
    
    // Save default layout if not already saved
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('layout_default')) {
      localStorage.setItem('layout_default', JSON.stringify(defaultLayout));
    }
    
    // Automatically load the default layout
    try {
      this.api.fromJSON(defaultLayout);
    } catch (error) {
      console.error('Error loading default layout:', error);
      // If default layout fails, create a basic layout manually
      this.resetLayout();
    }
  }

  /**
   * Check if the docking manager is initialized
   * @returns {boolean} Whether the manager is initialized
   */
  isInitialized() {
    return this.api !== null;
  }

  /**
   * Add a new panel to the layout
   * @param {string} panelType The type of panel to add
   * @param {Object} params Optional parameters for the panel
   * @param {string|Object} location Where to add the panel (location name or position object)
   * @returns {string} The ID of the created panel
   */
  addPanel(panelType, params = {}, location = 'center') {
    if (!this.isInitialized()) {
      throw new Error('DockingManager not initialized');
    }

    const panelDef = panelDefinitions.find(def => def.id === panelType);
    if (!panelDef) {
      throw new Error(`Unknown panel type: ${panelType}`);
    }

    const panelId = `${panelType}_${Date.now()}`;
    
    // Handle different location formats
    let position = {};
    
    if (typeof location === 'string') {
      // Convert string location to position object
      const referencePanel = this.api.activePanel;
      
      switch (location) {
        case 'left':
          position = { referencePanel, direction: 'left' };
          break;
        case 'right':
          position = { referencePanel, direction: 'right' };
          break;
        case 'above':
        case 'top':
          position = { referencePanel, direction: 'above' };
          break;
        case 'below':
        case 'bottom':
          position = { referencePanel, direction: 'below' };
          break;
        case 'center':
        case 'within':
        default:
          position = { referencePanel, direction: 'within' };
          break;
      }
    } else if (typeof location === 'object') {
      // Use location object directly
      position = location;
    }

    // Get the actual component from panelComponents
    const ComponentFunction = window.panelComponents && window.panelComponents[panelDef.component];
    
    if (!ComponentFunction) {
      throw new Error(`Component for panel type ${panelType} not found in registry`);
    }

    // Debug: Check what type of component we have
    console.log(`Adding panel ${panelType}:`);
    console.log('Component type:', typeof ComponentFunction);
    console.log('Component name:', ComponentFunction.name || 'unnamed');
    console.log('Is React.memo?:', ComponentFunction.$$typeof === Symbol.for('react.memo'));
    console.log('Display name:', ComponentFunction.displayName);
    console.log('Component:', ComponentFunction);

    // Add the panel
    this.api.addPanel({
      id: panelId,
      component: panelDef.component,  // Pass the component ID string, not the function
      params: { ...panelDef.params, ...params },
      position: position
    });

    return panelId;
  }

  /**
   * Remove a panel from the layout
   * @param {string} panelId The ID of the panel to remove
   */
  removePanel(panelId) {
    if (!this.isInitialized()) {
      throw new Error('DockingManager not initialized');
    }

    const panel = this.api.getPanel(panelId);
    if (panel) {
      panel.close();
    }
  }

  /**
   * Save the current layout with a name
   * @param {string} name The name to save the layout under
   */
  saveLayout(name) {
    if (!this.isInitialized()) {
      throw new Error('DockingManager not initialized');
    }

    const layout = this.api.toJSON();
    this.layouts[name] = layout;
    
    // Also save to localStorage if available
    try {
      localStorage.setItem(`layout_${name}`, JSON.stringify(layout));
    } catch (e) {
      console.warn('Failed to save layout to localStorage', e);
    }
    
    return layout;
  }

  /**
   * Load a saved layout by name
   * @param {string} name The name of the layout to load
   * @returns {boolean} Whether the layout was loaded successfully
   */
  loadLayout(name) {
    if (!this.isInitialized()) {
      throw new Error('DockingManager not initialized');
    }

    let layout;
    
    // First check if it's a predefined layout
    if (this.predefinedLayouts[name]) {
      layout = this.predefinedLayouts[name];
    }
    // Otherwise try to get from memory
    else if (this.layouts[name]) {
      layout = this.layouts[name];
    }
    // If not in memory, try localStorage
    else if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(`layout_${name}`);
        if (stored) {
          layout = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed to load layout from localStorage', e);
      }
    }
    
    if (layout) {
      try {
        this.api.fromJSON(layout);
        return true;
      } catch (error) {
        console.error('Error loading layout:', error);
        // Try to recover
        this.resetLayout();
        return false;
      }
    }
    
    return false;
  }

  /**
   * Get all available predefined layouts
   * @returns {Object} Object with layout names as keys
   */
  getPredefinedLayouts() {
    return Object.keys(this.predefinedLayouts).map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1) + ' Layout',
      isPredefined: true
    }));
  }

  /**
   * Reset the layout to the default configuration
   */
  resetLayout() {
    if (!this.isInitialized()) {
      throw new Error('DockingManager not initialized');
    }

    try {
      // Use the default layout
      this.api.fromJSON(defaultLayout);
    } catch (error) {
      console.error('Error resetting layout:', error);
      
      // Last resort: clear and add panels manually
      this.api.clear();
      
      // Add panels with delays to ensure they load properly
      setTimeout(() => {
        this.addPanel('controlPanel', { showAdvanced: false });
        setTimeout(() => {
          this.addPanel('viewer3D', { showAxes: true }, 'right');
          setTimeout(() => {
            this.addPanel('codeEditor', { language: 'gcode' }, 'right');
            setTimeout(() => {
              this.addPanel('monitor', { refreshRate: 1000 }, 'bottom');
            }, 50);
          }, 50);
        }, 50);
      }, 50);
    }
  }
}

// Create a singleton instance
const dockingManager = new DockingManager();

export default dockingManager;