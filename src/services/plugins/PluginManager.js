import { panelDefinitions } from '../docking/panelRegistry';

/**
 * Service class to manage plugins
 */
class PluginManager {
  constructor() {
    this.plugins = [];
    this.loadedPlugins = {};
  }

  /**
   * Register a plugin
   * @param {Object} plugin Plugin metadata
   */
  registerPlugin(plugin) {
    if (!plugin.id || !plugin.name) {
      throw new Error('Plugin must have id and name properties');
    }

    if (this.plugins.some(p => p.id === plugin.id)) {
      throw new Error(`Plugin with id ${plugin.id} already registered`);
    }

    this.plugins.push(plugin);
  }

  /**
   * Get all registered plugins
   * @returns {Array} Array of registered plugins
   */
  getPlugins() {
    return [...this.plugins];
  }

  /**
   * Load a plugin
   * @param {string} pluginId The ID of the plugin to load
   * @returns {Promise} Promise resolving to the loaded plugin
   */
  async loadPlugin(pluginId) {
    const plugin = this.plugins.find(p => p.id === pluginId);
    if (!plugin) {
      throw new Error(`Plugin with id ${pluginId} not found`);
    }

    if (this.loadedPlugins[pluginId]) {
      return this.loadedPlugins[pluginId];
    }

    // In a real implementation, this would dynamically import or fetch the plugin
    // For now, we'll just return a mock plugin instance
    const pluginInstance = {
      id: plugin.id,
      name: plugin.name,
      version: plugin.version,
      panels: [],
      initialize: () => console.log(`Initializing plugin: ${plugin.name}`),
      cleanup: () => console.log(`Cleaning up plugin: ${plugin.name}`)
    };

    // Store the loaded plugin
    this.loadedPlugins[pluginId] = pluginInstance;
    
    return pluginInstance;
  }

  /**
   * Unload a plugin
   * @param {string} pluginId The ID of the plugin to unload
   */
  unloadPlugin(pluginId) {
    const pluginInstance = this.loadedPlugins[pluginId];
    if (pluginInstance) {
      // Call cleanup if available
      if (typeof pluginInstance.cleanup === 'function') {
        pluginInstance.cleanup();
      }
      
      // Remove from loaded plugins
      delete this.loadedPlugins[pluginId];
    }
  }

  /**
   * Get panel definitions from all loaded plugins
   * @returns {Array} Array of panel definitions from plugins
   */
  getPluginPanelDefinitions() {
    const pluginPanels = [];
    
    Object.values(this.loadedPlugins).forEach(plugin => {
      if (Array.isArray(plugin.panels)) {
        pluginPanels.push(...plugin.panels);
      }
    });
    
    return pluginPanels;
  }

  /**
   * Register example plugins
   */
  registerExamplePlugins() {
    this.registerPlugin({
      id: 'image-to-gcode',
      name: 'Image to G-Code Converter',
      version: '1.0.0',
      description: 'Converts images to G-Code for drawing or engraving',
      author: 'Example Author',
      panels: [
        {
          id: 'imageConverter',
          title: 'Image Converter',
          component: 'imageConverter',
          defaultLocation: 'right'
        }
      ]
    });

    this.registerPlugin({
      id: 'maze-solver',
      name: 'Maze Solver',
      version: '1.0.0',
      description: 'Detects and solves mazes using computer vision',
      author: 'Example Author',
      panels: [
        {
          id: 'mazeSolver',
          title: 'Maze Solver',
          component: 'mazeSolver',
          defaultLocation: 'bottom'
        }
      ]
    });

    this.registerPlugin({
      id: 'object-palletizer',
      name: 'Object Palletizer',
      version: '1.0.0',
      description: 'Automatically arranges objects for picking and placing',
      author: 'Example Author',
      panels: [
        {
          id: 'objectPalletizer',
          title: 'Object Palletizer',
          component: 'objectPalletizer',
          defaultLocation: 'right'
        }
      ]
    });
  }
}

// Create a singleton instance
const pluginManager = new PluginManager();

// Register example plugins
pluginManager.registerExamplePlugins();

export default pluginManager;