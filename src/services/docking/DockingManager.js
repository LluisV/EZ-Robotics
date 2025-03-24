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

    // Add the panel
    this.api.addPanel({
      id: panelId,
      component: panelDef.component,
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
      this.api.fromJSON(layout);
      return true;
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

    this.api.fromJSON(defaultLayout);
  }
}

// Create a singleton instance
const dockingManager = new DockingManager();

export default dockingManager;