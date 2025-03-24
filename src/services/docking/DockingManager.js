import { panelDefinitions } from './panelRegistry';

/**
 * Service class to manage the dockable layout
 */
class DockingManager {
  constructor() {
    this.api = null;
    this.layouts = {};
  }

  /**
   * Initialize the docking manager with the dockview API
   * @param {Object} api Dockview API instance
   */
  initialize(api) {
    this.api = api;
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
   * @param {string} location Where to add the panel (left, right, bottom, etc.)
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
    this.api.addPanel({
      id: panelId,
      component: panelDef.component,
      params: { ...panelDef.params, ...params },
      position: { referencePanel: this.api.activePanel, direction: location }
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

    // Try to get from memory first
    let layout = this.layouts[name];
    
    // If not in memory, try localStorage
    if (!layout && typeof localStorage !== 'undefined') {
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
   * Reset the layout to the default configuration
   */
  resetLayout() {
    if (!this.isInitialized()) {
      throw new Error('DockingManager not initialized');
    }

    // Import the default layout dynamically to avoid circular dependencies
    import('./defaultLayout').then(module => {
      this.api.fromJSON(module.defaultLayout);
    });
  }
}

// Create a singleton instance
const dockingManager = new DockingManager();

export default dockingManager;