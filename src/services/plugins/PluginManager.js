/**
 * Plugin Manager for loading and managing plugins
 * Handles ZIP file extraction, validation, and plugin lifecycle
 */
import PluginAPI from './PluginAPI';
import React from 'react';

class PluginManager {
  constructor() {
    this.loadedPlugins = new Map();
    this.pluginAPIs = new Map();
    this.pluginComponents = new Map();
    this.eventBus = new EventTarget();
    this.panelRegistry = null;
  }

  /**
   * Initialize the plugin manager with panel registry
   * @param {Object} panelRegistry - The panel registry to use
   */
  initialize(panelRegistry) {
    this.panelRegistry = panelRegistry;
    console.log('PluginManager initialized');
  }

  /**
   * Load a plugin from a ZIP file
   * @param {File} zipFile - The ZIP file containing the plugin
   * @returns {Promise<Object>} The loaded plugin metadata
   */
  async loadPluginFromZip(zipFile) {
    try {
      console.log('Loading plugin from ZIP:', zipFile.name);
      
      // Dynamically import JSZip only when needed
      const JSZip = await import('jszip').then(module => module.default);
      
      // Parse the ZIP file
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipFile);
      
      // Load and validate manifest
      const manifestFile = contents.file('manifest.json');
      if (!manifestFile) {
        throw new Error('Plugin missing manifest.json');
      }
      
      const manifestText = await manifestFile.async('text');
      const manifest = JSON.parse(manifestText);
      
      // Validate manifest
      this.validateManifest(manifest);
      
      // Check if plugin already loaded
      if (this.loadedPlugins.has(manifest.id)) {
        throw new Error(`Plugin ${manifest.id} is already loaded`);
      }
      
      // Create plugin container
      const plugin = {
        id: manifest.id,
        manifest,
        files: new Map(),
        loaded: false
      };
      
      // Extract all files
      for (const [path, file] of Object.entries(contents.files)) {
        if (!file.dir) {
          const content = await file.async('text');
          plugin.files.set(path, content);
        }
      }
      
      // Load the plugin
      await this.initializePlugin(plugin);
      
      // Store the loaded plugin
      this.loadedPlugins.set(manifest.id, plugin);
      
      // Emit load event
      this.eventBus.dispatchEvent(new CustomEvent('pluginLoaded', {
        detail: { pluginId: manifest.id, manifest }
      }));
      
      console.log(`Plugin ${manifest.id} loaded successfully`);
      return manifest;
      
    } catch (error) {
      console.error('Failed to load plugin:', error);
      throw error;
    }
  }

  /**
   * Initialize a plugin
   * @param {Object} plugin - The plugin object
   */
  async initializePlugin(plugin) {
    const { manifest, files } = plugin;
    
    console.log(`Initializing plugin: ${manifest.id}`);
    
    // Create plugin API instance
    const api = new PluginAPI(manifest.id, manifest.permissions || []);
    this.pluginAPIs.set(manifest.id, api);
    
    // Load CSS if present
    const cssPath = manifest.styles || 'styles/plugin.css';
    if (files.has(cssPath)) {
      console.log(`Loading CSS for plugin ${manifest.id}`);
      this.injectCSS(manifest.id, files.get(cssPath));
    }
    
    // Load the main module
    const mainCode = files.get(manifest.main);
    if (!mainCode) {
      throw new Error(`Main file ${manifest.main} not found`);
    }
    
    // Create a sandboxed environment for the plugin
    const PluginComponent = await this.loadPluginModule(manifest.id, mainCode, api);
    
    // Register the component
    this.pluginComponents.set(manifest.id, PluginComponent);
    
    // Register with panel registry
    this.registerPanel(manifest, PluginComponent);
    
    plugin.loaded = true;
  }

  /**
 * Load plugin module in a sandboxed environment
 * @param {string} pluginId - Plugin ID
 * @param {string} code - Plugin code
 * @param {PluginAPI} api - Plugin API instance
 * @returns {Promise<React.Component>} The plugin component
 */
async loadPluginModule(pluginId, code, api) {
  console.log(`Loading module for plugin: ${pluginId}`);
  
  // Store API in global scope temporarily
  if (!window.__pluginAPIs) window.__pluginAPIs = {};
  window.__pluginAPIs[pluginId] = api;
  
  if (!window.__pluginComponents) window.__pluginComponents = {};
  
  try {
    // Create a wrapper that provides React and the API
    const wrappedCode = `
      (function() {
        const React = window.React;
        const { useState, useEffect, useRef, useCallback, useMemo } = React;
        const api = window.__pluginAPIs['${pluginId}'];
        
        ${code}
        
        // The plugin should export a PluginPanel component
        if (typeof PluginPanel !== 'undefined') {
          // Create a proper functional component for Dockview
          const DockviewComponent = (props) => {
            // Extract params from Dockview props structure
            const params = props?.params || props || {};
            // Ensure api is passed to the plugin
            return React.createElement(PluginPanel, { ...params, api: api });
          };
          
          // Mark it as a functional component
          DockviewComponent.displayName = 'Plugin_${pluginId}';
          
          window.__pluginComponents['${pluginId}'] = DockviewComponent;
        } else {
          throw new Error('Plugin must export a PluginPanel component');
        }
      })();
    `;
    
    // Execute the wrapped code
    const moduleFunction = new Function(wrappedCode);
    moduleFunction();
    
    // Get the component
    const PluginComponent = window.__pluginComponents[pluginId];
    
    if (!PluginComponent) {
      throw new Error('Plugin component not found after loading');
    }
    
    // Clean up temporary storage
    delete window.__pluginComponents[pluginId];
    
    // Return the component directly - it's already wrapped properly
    return PluginComponent;
    
  } catch (error) {
    console.error(`Error loading plugin module ${pluginId}:`, error);
    // Clean up on error
    delete window.__pluginAPIs[pluginId];
    delete window.__pluginComponents[pluginId];
    throw error;
  }
}

/**
 * Register panel with the docking system
 * @param {Object} manifest - Plugin manifest
 * @param {React.Component} component - Plugin component
 */
registerPanel(manifest, component) {
  console.log(`Registering panel for plugin: ${manifest.id}`);
  
  // Register with the existing panel components registry
  if (window.panelComponents) {
    // The component from loadPluginModule is already a proper React component
    // that's been wrapped correctly for Dockview, so use it directly
    window.panelComponents[manifest.id] = component;
    
    console.log(`Registered plugin component ${manifest.id} in window.panelComponents`);
  }
  
  // Add to panel definitions if the array exists
  if (window.panelDefinitions && Array.isArray(window.panelDefinitions)) {
    const panelDef = {
      id: manifest.id,
      title: manifest.panel.title,
      component: manifest.id,
      params: manifest.panel.params || {},
      defaultLocation: manifest.panel.defaultLocation || 'right'
    };
    
    // Only add if not already present
    if (!window.panelDefinitions.find(p => p.id === manifest.id)) {
      window.panelDefinitions.push(panelDef);
    }
  }
}

  /**
   * Register a built-in plugin
   * @param {Object} manifest - Plugin manifest
   * @param {Function} componentLoader - Function that returns the component
   */
  async registerBuiltInPlugin(manifest, componentLoader) {
    try {
      // Validate manifest
      this.validateManifest(manifest);
      
      // Check if already loaded
      if (this.loadedPlugins.has(manifest.id)) {
        console.log(`Built-in plugin ${manifest.id} already loaded`);
        return;
      }
      
      // Create plugin API
      const api = new PluginAPI(manifest.id, manifest.permissions || []);
      this.pluginAPIs.set(manifest.id, api);
      
      // Load the component
      const component = await componentLoader();
      
      // Create wrapper that provides API
      const WrappedComponent = (props) => {
        return React.createElement(component.default || component, { ...props, api });
      };
      
      // Register the component
      this.pluginComponents.set(manifest.id, WrappedComponent);
      this.registerPanel(manifest, WrappedComponent);
      
      // Store the plugin
      this.loadedPlugins.set(manifest.id, {
        id: manifest.id,
        manifest: { ...manifest, builtIn: true },
        loaded: true
      });
      
      console.log(`Built-in plugin ${manifest.id} registered`);
      
    } catch (error) {
      console.error(`Failed to register built-in plugin ${manifest.id}:`, error);
      throw error;
    }
  }

  /**
   * Inject CSS into the page
   * @param {string} pluginId - Plugin ID
   * @param {string} css - CSS content
   */
  injectCSS(pluginId, css) {
    // Remove existing style if present
    const existingStyle = document.getElementById(`plugin-style-${pluginId}`);
    if (existingStyle) {
      existingStyle.remove();
    }
    
    // Create new style element
    const style = document.createElement('style');
    style.id = `plugin-style-${pluginId}`;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * Validate plugin manifest
   * @param {Object} manifest - Plugin manifest
   */
  validateManifest(manifest) {
    const required = ['id', 'name', 'version', 'main', 'panel'];
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Manifest missing required field: ${field}`);
      }
    }
    
    // Validate ID format (letters, numbers, hyphens only)
    if (!/^[a-z0-9-]+$/.test(manifest.id)) {
      throw new Error('Plugin ID must only contain lowercase letters, numbers, and hyphens');
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
      throw new Error('Version must follow semantic versioning (x.y.z)');
    }
    
    // Validate panel configuration
    if (!manifest.panel.title) {
      throw new Error('Panel must have a title');
    }
  }

  /**
   * Unload a plugin
   * @param {string} pluginId - Plugin ID to unload
   */
  async unloadPlugin(pluginId) {
    const plugin = this.loadedPlugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin ${pluginId} not found`);
    }
    
    // Don't allow unloading built-in plugins
    if (plugin.manifest.builtIn) {
      throw new Error('Cannot unload built-in plugins');
    }
    
    console.log(`Unloading plugin: ${pluginId}`);
    
    // Clean up API
    const api = this.pluginAPIs.get(pluginId);
    if (api) {
      api.destroy();
      this.pluginAPIs.delete(pluginId);
    }
    
    // Remove CSS
    const styleElement = document.getElementById(`plugin-style-${pluginId}`);
    if (styleElement) {
      styleElement.remove();
    }
    
    // Remove from component registries
    if (window.panelComponents) {
      delete window.panelComponents[pluginId];
    }
    
    if (window.panelDefinitions && Array.isArray(window.panelDefinitions)) {
      const index = window.panelDefinitions.findIndex(p => p.id === pluginId);
      if (index !== -1) {
        window.panelDefinitions.splice(index, 1);
      }
    }
    
    // Remove from internal registries
    this.pluginComponents.delete(pluginId);
    this.loadedPlugins.delete(pluginId);
    
    // Clean up global API reference
    if (window.__pluginAPIs && window.__pluginAPIs[pluginId]) {
      delete window.__pluginAPIs[pluginId];
    }
    
    // Emit unload event
    this.eventBus.dispatchEvent(new CustomEvent('pluginUnloaded', {
      detail: { pluginId }
    }));
    
    console.log(`Plugin ${pluginId} unloaded`);
  }

  /**
   * Get loaded plugins
   * @returns {Array} Array of loaded plugin manifests
   */
  getLoadedPlugins() {
    return Array.from(this.loadedPlugins.values()).map(p => p.manifest);
  }

  /**
   * Check if a plugin is loaded
   * @param {string} pluginId - Plugin ID
   * @returns {boolean} Whether the plugin is loaded
   */
  isPluginLoaded(pluginId) {
    return this.loadedPlugins.has(pluginId);
  }

  /**
   * Get plugin API instance
   * @param {string} pluginId - Plugin ID
   * @returns {PluginAPI|null} Plugin API instance
   */
  getPluginAPI(pluginId) {
    return this.pluginAPIs.get(pluginId);
  }

  /**
   * Get plugin component
   * @param {string} pluginId - Plugin ID
   * @returns {React.Component|null} Plugin component
   */
  getPluginComponent(pluginId) {
    return this.pluginComponents.get(pluginId);
  }
}

// Create singleton instance
const pluginManager = new PluginManager();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.pluginManager = pluginManager;
}

export default pluginManager;