import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';

/**
 * Class to manage STL files in the 3D scene
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
  }

  /**
   * Load an STL file into the scene
   * 
   * @param {string} fileName The name of the file
   * @param {ArrayBuffer} fileContent The binary content of the STL file
   * @returns {string} The ID of the loaded file
   */
  loadStlModel(fileName, fileContent) {
    if (!this.scene) return null;

    const loader = new STLLoader();

    try {
      // Parse the STL file
      const geometry = loader.parse(fileContent);

      // Calculate original bounds before any transformations
      geometry.computeBoundingBox();
      const originalBoundingBox = geometry.boundingBox.clone();
      const size = originalBoundingBox.getSize(new THREE.Vector3());

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
        dimensions: size.toArray(),
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
    if (!this.stlObjects[fileId]) return false;

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
    if (!this.stlObjects[fileId] || !this.scene) return false;

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
    if (!this.stlObjects[fileId]) return false;

    const mesh = this.stlObjects[fileId];
    const floatValue = parseFloat(value);

    if (isNaN(floatValue)) return false;

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
    if (!this.stlObjects[fileId]) return false;

    const mesh = this.stlObjects[fileId];
    const floatValue = parseFloat(value);

    if (isNaN(floatValue)) return false;

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
    if (!this.stlObjects[fileId]) return false;

    const mesh = this.stlObjects[fileId];
    const floatValue = parseFloat(newScale);

    if (isNaN(floatValue) || floatValue <= 0) return false;

    // Update mesh scale
    mesh.scale.set(floatValue, floatValue, floatValue);

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
    if (!this.stlObjects[fileId]) return false;

    // Find the file info
    this.setStlFiles(prevFiles => {
      const file = prevFiles.find(f => f.id === fileId);
      if (!file) return prevFiles;

      // Get the mesh
      const mesh = this.stlObjects[fileId];

      // Reset to auto scale
      mesh.scale.set(file.autoScale, file.autoScale, file.autoScale);

      // Update the file info
      return prevFiles.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            scale: f.autoScale,
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
    if (!this.stlObjects[fileId]) return false;

    const mesh = this.stlObjects[fileId];

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
   * Clean up resources
   */
  dispose() {
    // Remove all STL objects
    Object.keys(this.stlObjects).forEach(fileId => {
      this.removeStlFile(fileId);
    });

    this.stlObjects = {};
  }
}

export default StlManager;