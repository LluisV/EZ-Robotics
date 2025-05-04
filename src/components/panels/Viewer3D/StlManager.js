import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

/**
 * Enhanced class to manage STL files in the 3D scene
 * Improved with better error handling and debugging
 */
class StlManager {
  /**
   * Create an STL file manager
   * 
   * @param {THREE.Scene} scene THREE.js scene to render into
   * @param {Object} themeColors Theme color definitions
   * @param {Function} setStlFiles Function to update stlFiles state in React
   */
  constructor(scene, themeColors, setStlFiles) {
    this.scene = scene;
    this.themeColors = themeColors;
    this.setStlFiles = setStlFiles;
    this.stlObjects = {};
    
    console.log("StlManager initialized");
  }

  /**
   * Load an STL file into the scene
   * 
   * @param {string} fileName The name of the file
   * @param {ArrayBuffer} fileContent The binary content of the STL file
   * @returns {string} The ID of the loaded file
   */
  loadStlModel(fileName, fileContent) {
    if (!this.scene) {
      console.error("Scene is not available for STL loading");
      return null;
    }

    console.log(`Attempting to load STL file: ${fileName}`);
    const loader = new STLLoader();

    try {
      // Parse the STL file
      const geometry = loader.parse(fileContent);

      // Calculate original bounds before any transformations
      geometry.computeBoundingBox();
      const originalBoundingBox = geometry.boundingBox.clone();
      const size = originalBoundingBox.getSize(new THREE.Vector3());

      console.log(`STL dimensions: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);

      // Center the geometry at origin by calculating and applying center offset
      const center = new THREE.Vector3();
      originalBoundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // Create material for the STL model
      const material = new THREE.MeshStandardMaterial({
        color: this.themeColors.stlDefault,
        metalness: 0.2,
        roughness: 0.5,
        flatShading: true
      });

      // Create mesh from geometry and material
      const mesh = new THREE.Mesh(geometry, material);

      // Scale the model to fit in scene if needed
      let autoScale = 1.0;
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 5) { // if larger than 5 units
        autoScale = 5 / maxDim;
        mesh.scale.set(autoScale, autoScale, autoScale);
        console.log(`Auto-scaling STL to ${autoScale.toFixed(2)}`);
      }

      // Generate a unique ID for this STL file
      const fileId = `stl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      mesh.userData.fileId = fileId;
      mesh.userData.fileName = fileName;
      mesh.userData.originalSize = size.clone();

      // Position at origin since we've already centered the geometry
      mesh.position.set(0, 0, 0);

      // Add the mesh to the scene
      this.scene.add(mesh);

      // Store reference to the mesh
      this.stlObjects[fileId] = mesh;

      // Create the new file info object
      const newFile = {
        id: fileId,
        name: fileName,
        visible: true,
        position: [0, 0, 0], // Centered at origin
        rotation: [0, 0, 0], // Euler angles in degrees
        dimensions: [size.x, size.y, size.z],
        scale: autoScale,
        autoScale: autoScale, // Store the auto scale
        manualScale: false, // Flag for whether scale was manually adjusted
        boundingBox: {
          min: originalBoundingBox.min.toArray(),
          max: originalBoundingBox.max.toArray()
        }
      };

      // Update state with new file
      this.setStlFiles(prevFiles => [...prevFiles, newFile]);

      console.log(`Added STL file: ${fileName} with ID: ${fileId}`);
      return fileId;

    } catch (error) {
      console.error(`Error loading STL model ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Toggle the visibility of an STL file
   * 
   * @param {string} fileId The ID of the file to toggle
   * @returns {boolean} The new visibility state
   */
  toggleStlVisibility(fileId) {
    console.log(`Toggling visibility for STL ${fileId}`);
    if (!this.stlObjects[fileId]) {
      console.warn(`STL object with ID ${fileId} not found`);
      return false;
    }

    // Toggle visibility
    const mesh = this.stlObjects[fileId];
    mesh.visible = !mesh.visible;

    // Update state
    this.setStlFiles(prevFiles => prevFiles.map(file =>
      file.id === fileId
        ? { ...file, visible: mesh.visible }
        : file
    ));

    return mesh.visible;
  }

  /**
   * Remove an STL file from the scene
   * 
   * @param {string} fileId The ID of the file to remove
   * @returns {boolean} Whether the file was removed
   */
  removeStlFile(fileId) {
    console.log(`Removing STL file with ID: ${fileId}`);
    if (!this.stlObjects[fileId] || !this.scene) {
      console.warn(`STL object with ID ${fileId} not found or scene is unavailable`);
      return false;
    }

    // Remove from scene
    const mesh = this.stlObjects[fileId];
    this.scene.remove(mesh);

    // Dispose of geometry and material
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();

    // Remove from references
    delete this.stlObjects[fileId];

    // Update state
    this.setStlFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));

    console.log(`STL file ${fileId} successfully removed`);
    return true;
  }

  /**
   * Update the position of an STL file
   * 
   * @param {string} fileId The ID of the file to update
   * @param {string} axis The axis to update ('x', 'y', or 'z')
   * @param {number} value The new value for the axis
   * @returns {boolean} Whether the update was successful
   */
  updateStlPosition(fileId, axis, value) {
    if (!this.stlObjects[fileId]) {
      console.warn(`Cannot update position: STL object with ID ${fileId} not found`);
      return false;
    }

    const mesh = this.stlObjects[fileId];
    const floatValue = parseFloat(value);

    if (isNaN(floatValue)) {
      console.warn(`Invalid position value for ${axis} axis: ${value}`);
      return false;
    }

    // Update the corresponding axis
    switch (axis) {
      case 'x':
        mesh.position.x = floatValue;
        break;
      case 'y':
        mesh.position.y = floatValue;
        break;
      case 'z':
        mesh.position.z = floatValue;
        break;
      default:
        console.warn(`Invalid axis specified: ${axis}`);
        return false;
    }

    // Update state
    this.setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        const newPosition = [...file.position];
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        newPosition[axisIndex] = floatValue;
        return { ...file, position: newPosition };
      }
      return file;
    }));

    return true;
  }

  /**
   * Update the rotation of an STL file
   * 
   * @param {string} fileId The ID of the file to update
   * @param {string} axis The axis to update ('x', 'y', or 'z')
   * @param {number} value The new value for the axis in degrees
   * @returns {boolean} Whether the update was successful
   */
  updateStlRotation(fileId, axis, value) {
    if (!this.stlObjects[fileId]) {
      console.warn(`Cannot update rotation: STL object with ID ${fileId} not found`);
      return false;
    }

    const mesh = this.stlObjects[fileId];
    const floatValue = parseFloat(value);

    if (isNaN(floatValue)) {
      console.warn(`Invalid rotation value for ${axis} axis: ${value}`);
      return false;
    }

    // Convert degrees to radians for the corresponding axis
    const angleRad = THREE.MathUtils.degToRad(floatValue);

    // Update the corresponding axis
    switch (axis) {
      case 'x':
        mesh.rotation.x = angleRad;
        break;
      case 'y':
        mesh.rotation.y = angleRad;
        break;
      case 'z':
        mesh.rotation.z = angleRad;
        break;
      default:
        console.warn(`Invalid axis specified: ${axis}`);
        return false;
    }

    // Update state
    this.setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        const newRotation = [...file.rotation];
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        newRotation[axisIndex] = floatValue;
        return { ...file, rotation: newRotation };
      }
      return file;
    }));

    return true;
  }

  /**
   * Update the scale of an STL file
   * 
   * @param {string} fileId The ID of the file to update
   * @param {number} newScale The new scale value
   * @returns {boolean} Whether the update was successful
   */
  updateStlScale(fileId, newScale) {
    if (!this.stlObjects[fileId]) {
      console.warn(`Cannot update scale: STL object with ID ${fileId} not found`);
      return false;
    }

    const mesh = this.stlObjects[fileId];
    const floatValue = parseFloat(newScale);

    if (isNaN(floatValue) || floatValue <= 0) {
      console.warn(`Invalid scale value: ${newScale}`);
      return false;
    }

    // Update mesh scale
    mesh.scale.set(floatValue, floatValue, floatValue);
    console.log(`Updated scale of ${fileId} to ${floatValue}`);

    // Update state
    this.setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        return {
          ...file,
          scale: floatValue,
          manualScale: true
        };
      }
      return file;
    }));

    return true;
  }

  /**
   * Reset the scale of an STL file to its original auto-calculated scale
   * 
   * @param {string} fileId The ID of the file to reset
   * @returns {boolean} Whether the reset was successful
   */
  resetStlScale(fileId) {
    if (!this.stlObjects[fileId]) {
      console.warn(`Cannot reset scale: STL object with ID ${fileId} not found`);
      return false;
    }

    // Update state and then update the mesh scale
    this.setStlFiles(prevFiles => {
      const file = prevFiles.find(f => f.id === fileId);
      if (!file) return prevFiles;

      // Get the mesh
      const mesh = this.stlObjects[fileId];
      if (!mesh) return prevFiles;

      // Reset to auto scale
      const autoScale = file.autoScale || 1.0;
      mesh.scale.set(autoScale, autoScale, autoScale);
      console.log(`Reset scale of ${fileId} to auto scale ${autoScale}`);

      // Update the file info
      return prevFiles.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            scale: autoScale,
            manualScale: false
          };
        }
        return f;
      });
    });

    return true;
  }

  /**
   * Center the geometry of an STL file at the origin
   * 
   * @param {string} fileId The ID of the file to center
   * @returns {boolean} Whether the centering was successful
   */
  centerGeometryAtOrigin(fileId) {
    if (!this.stlObjects[fileId]) {
      console.warn(`Cannot center geometry: STL object with ID ${fileId} not found`);
      return false;
    }

    const mesh = this.stlObjects[fileId];
    console.log(`Centering STL ${fileId} at origin`);

    // Store current rotation
    const currentRotation = new THREE.Euler().copy(mesh.rotation);

    // Reset rotation temporarily to compute accurate bounding box
    mesh.rotation.set(0, 0, 0);

    // Compute bounding box with zero rotation
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox;
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    // Translate geometry to center it at origin
    mesh.geometry.translate(-center.x, -center.y, -center.z);

    // Reset position to origin
    mesh.position.set(0, 0, 0);

    // Restore original rotation
    mesh.rotation.copy(currentRotation);

    // Update state
    this.setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        return {
          ...file,
          position: [0, 0, 0]
        };
      }
      return file;
    }));

    return true;
  }

  /**
   * Get the object for a specific file ID
   * 
   * @param {string} fileId The ID of the file to get
   * @returns {THREE.Mesh|null} The mesh object or null if not found
   */
  getStlObject(fileId) {
    return this.stlObjects[fileId] || null;
  }

  /**
   * Get all STL objects
   * 
   * @returns {Object} Map of file IDs to mesh objects
   */
  getAllStlObjects() {
    return { ...this.stlObjects };
  }

  /**
   * Check if an STL object with the given ID exists
   * 
   * @param {string} fileId The ID to check
   * @returns {boolean} Whether the object exists
   */
  hasStlObject(fileId) {
    return fileId in this.stlObjects;
  }

  /**
   * Refresh all STL objects based on current React state
   * Useful when restoring from saved state
   * 
   * @param {Array} stlFiles Array of STL file objects from React state
   */
  refreshFromState(stlFiles) {
    if (!Array.isArray(stlFiles)) return;

    // Update existing objects with state values
    stlFiles.forEach(file => {
      if (this.hasStlObject(file.id)) {
        const mesh = this.stlObjects[file.id];
        
        // Update visibility
        mesh.visible = file.visible;
        
        // Update position
        mesh.position.set(file.position[0], file.position[1], file.position[2]);
        
        // Update rotation (convert degrees to radians)
        mesh.rotation.set(
          THREE.MathUtils.degToRad(file.rotation[0]),
          THREE.MathUtils.degToRad(file.rotation[1]),
          THREE.MathUtils.degToRad(file.rotation[2])
        );
        
        // Update scale
        mesh.scale.set(file.scale, file.scale, file.scale);
      }
    });
  }

  /**
   * Clean up resources
   */
  dispose() {
    console.log("Disposing StlManager and all STL objects");
    
    // Remove all STL objects
    Object.keys(this.stlObjects).forEach(fileId => {
      this.removeStlFile(fileId);
    });

    this.stlObjects = {};
  }
}

export default StlManager;