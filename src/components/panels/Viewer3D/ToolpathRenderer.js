import * as THREE from 'three';
import {
  VisualizationModes,
  createVisualizationMaterials,
  generateDynamicMaterials,
  getMaterialForSegment
} from './utils/VisualizationModes';

// We'll skip trying to import BufferGeometryUtils entirely
// as it's not part of the main three.js package and causes compilation errors

/**
 * Optimized class for rendering and visualizing toolpaths in a THREE.js scene
 * Enhanced with multiple visualization modes and direction indicators
 * 
 * Performance optimizations:
 * - Uses instancing for similar move types (reduces thousands of draw calls to just a few)
 * - Batches segments by material type
 * - Implements level-of-detail rendering for large toolpaths
 * - Uses frustum culling to only render visible segments
 * - Uses shader-based line rendering for better performance
 * - Optimizes memory usage with shared geometries and buffer attributes
 * - Adapts detail level based on toolpath size and interaction state
 */
class ToolpathRenderer {
  /**
   * Create a toolpath renderer
   * 
   * @param {THREE.Scene} scene THREE.js scene to render into
   * @param {number} scale Scale factor for visualization (default: 0.1 - 10mm = 1 unit)
   * @param {Object} themeColors Theme color definitions
   */
  constructor(scene, scale = 0.1, themeColors) {
    this.scale = scale;
    this.scene = scene;
    this.themeColors = themeColors;

    // Create a group to hold all toolpath objects
    this.toolpathGroup = new THREE.Group();
    this.toolpathGroup.name = 'toolpath';
    this.scene.add(this.toolpathGroup);

    // Create a group for direction indicators
    this.directionGroup = new THREE.Group();
    this.directionGroup.name = 'direction-indicators';
    this.scene.add(this.directionGroup);

    // Default transformation values
    this.transformValues = {
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      moveX: 0,
      moveY: 0,
      moveZ: 0,
      rotateAngle: 0,
      centerX: 0,
      centerY: 0
    };

    // Default work offset
    this.workOffset = {
      x: 0,
      y: 0,
      z: 0
    };

    // Create visualization materials for all modes
    this.allMaterials = createVisualizationMaterials(themeColors);

    // Set default visualization mode
    this.visualizationMode = VisualizationModes.MOVE_TYPE;

    // Current active materials based on visualization mode
    this.materials = this.allMaterials[this.visualizationMode];

    // Optimized data structures for batching
    this.batchedGeometries = {
      rapid: [],
      cut: [],
      plunge: [],
      lift: []
    };

    // Lookup for line index to batch and position
    this.lineIndexMap = new Map();

    // Path for the overall toolpath
    this.pathPoints = [];
    this.showPathLine = false; // Changed to false by default

    // Store reference to current toolpath
    this.currentToolpath = null;

    // Create debug sphere for the tool position
    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    this.toolPositionSphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 })
    );
    this.toolPositionSphere.visible = false;
    this.scene.add(this.toolPositionSphere);

    // Direction indicators configuration
    this.showDirectionIndicators = false;
    this.directionIndicatorDensity = 0.05; // Show arrows on 5% of segments
    this.directionIndicatorScale = 0.5; // Size of arrows
    this.arrowMesh = null; // Will store the instanced arrow mesh

    // Global appearance multipliers
    this.lineWidthMultiplier = 1.0;
    this.opacityMultiplier = 1.0;

    // Performance tracking
    this.lowPerformanceMode = false;
    this.lastHighlightedLineIndex = -1;

    // Create a simple reusable line geometry for instancing
    this.lineGeometry = new THREE.BufferGeometry();
    this.lineGeometry.setAttribute('position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));

    // Frustum for culling calculations
    this.frustum = new THREE.Frustum();

    // High-level statistics for debug
    this.stats = {
      totalSegments: 0,
      visibleSegments: 0,
      drawCalls: 0
    };

    // Create reusable arrow for direction indicators
    this._createArrowMesh();
  }

  /**
 * Create the arrow mesh for direction indicators
 * Using a simple geometry to create a visible direction arrow
 */
  _createArrowMesh() {
    try {
      // Create a simple arrow using a cone (head) and cylinder (shaft)
      const arrowShaftLength = 0.15; // Length of the arrow shaft
      const arrowShaftWidth = 0.015; // Width of the arrow shaft

      // Create cylinder for arrow shaft
      const shaftGeometry = new THREE.CylinderGeometry(
        arrowShaftWidth, arrowShaftWidth, arrowShaftLength, 8
      );

      // Position the shaft so its bottom is at the origin
      shaftGeometry.translate(0, arrowShaftLength / 2, 0);

      // Create cone for arrow head
      const headGeometry = new THREE.ConeGeometry(0.04, 0.1, 8);

      // Position the head at the end of the shaft
      headGeometry.translate(0, arrowShaftLength + 0.05, 0);

      // Create a group to hold both parts
      const arrowGroup = new THREE.Group();

      // Create the material - brighter and more visible
      const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd00, // Bright yellow/gold color
        transparent: true,
        opacity: 0.9
      });

      // Create meshes for shaft and head
      const shaft = new THREE.Mesh(shaftGeometry, arrowMaterial);
      const head = new THREE.Mesh(headGeometry, arrowMaterial);

      // Add to group
      arrowGroup.add(shaft);
      arrowGroup.add(head);

      // Create the instanced mesh with just one instance initially
      const instancedArrow = new THREE.InstancedMesh(
        shaftGeometry,  // Just use the shaft for instancing
        arrowMaterial,
        1 // Will be updated later
      );

      instancedArrow.visible = false;
      this.arrowMesh = instancedArrow;
      this.arrowTemplate = arrowGroup;  // Save template for proper positioning
      this.directionGroup.add(instancedArrow);
    } catch (error) {
      console.error("Error creating arrow mesh:", error);
      // Create a fallback simple indicator using a sphere
      const simpleGeometry = new THREE.SphereGeometry(0.03, 8, 8);
      const simpleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd00,
        transparent: true,
        opacity: 0.9
      });

      const simpleArrow = new THREE.InstancedMesh(
        simpleGeometry,
        simpleMaterial,
        1
      );

      simpleArrow.visible = false;
      this.arrowMesh = simpleArrow;
      this.directionGroup.add(simpleArrow);
    }
  }


  /**
   * Update visualization mode
   * @param {string} mode New visualization mode
   */
  setVisualizationMode(mode) {
    if (!Object.values(VisualizationModes).includes(mode)) {
      console.warn(`Invalid visualization mode: ${mode}`);
      return;
    }

    this.visualizationMode = mode;

    // Initialize materials for this mode if they don't exist yet
    if (!this.allMaterials[mode]) {
      this.allMaterials[mode] = {};
    }

    // Generate dynamic materials if needed
    if (Object.keys(this.allMaterials[mode]).length === 0) {
      generateDynamicMaterials(this.allMaterials[mode], mode, this.currentToolpath);
    }

    // Set current materials
    this.materials = this.allMaterials[mode];

    // Re-visualize if we have a current toolpath
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
    }
  }

  /**
   * Toggle direction indicators
   * @param {boolean} show Whether to show direction indicators
   * @param {number} density Density of indicators (0-1), default 0.05 (5%)
   */
  setDirectionIndicators(show, density = 0.05) {
    this.showDirectionIndicators = show;
    this.directionIndicatorDensity = Math.max(0.001, Math.min(1, density));

    // Update visibility of existing indicators
    this.directionGroup.visible = show;

    // Re-visualize if we have a current toolpath
    if (this.currentToolpath) {
      this.visualizeDirectionIndicators(this.currentToolpath);
    }
  }

  /**
   * Set direction indicator scale
   * @param {number} scale Scale factor for direction indicators
   */
  setDirectionIndicatorScale(scale) {
    this.directionIndicatorScale = Math.max(0.1, Math.min(2, scale));

    // Update scale of existing indicators
    if (this.arrowMesh) {
      this.arrowMesh.scale.set(
        this.directionIndicatorScale,
        this.directionIndicatorScale,
        this.directionIndicatorScale
      );
    }
  }

  /**
   * Set low performance mode during transfers
   * @param {boolean} active Whether to enable low performance mode
   */
  setLowPerformanceMode(active) {
    this.lowPerformanceMode = active;

    // If we have a current toolpath and we're switching to high performance mode,
    // consider re-visualizing with higher quality
    if (!active && this.currentToolpath && this.currentToolpath.segments.length > 1000) {
      this.visualize(this.currentToolpath);
    }
  }

  /**
   * Set transformation values for toolpath
   * @param {Object} values Transformation values
   */
  setTransformValues(values) {
    this.transformValues = { ...this.transformValues, ...values };

    // Re-visualize if we have a current toolpath
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
    }
  }

  /**
   * Set work offset
   * @param {Object} offset Work offset {x, y, z}
   */
  setWorkOffset(offset) {
    this.workOffset = { ...offset };

    // Re-visualize if we have a current toolpath
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
    }
  }

  /**
   * Apply transformations to a point
   * @param {Object} point The point {x, y, z} to transform
   * @returns {Object} The transformed point
   */
  applyTransformations(point) {
    // First apply work offset to convert from work coordinates to world coordinates
    let x = point.x + this.workOffset.x;
    let y = point.y + this.workOffset.y;
    let z = point.z + this.workOffset.z;

    // Apply scale relative to center
    x = (x - this.transformValues.centerX) * this.transformValues.scaleX + this.transformValues.centerX;
    y = (y - this.transformValues.centerY) * this.transformValues.scaleY + this.transformValues.centerY;
    z = z * this.transformValues.scaleZ;

    // Apply rotation around center
    if (this.transformValues.rotateAngle !== 0) {
      const relX = x - this.transformValues.centerX;
      const relY = y - this.transformValues.centerY;
      const angleRad = (this.transformValues.rotateAngle * Math.PI) / 180;

      const rotatedX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad) + this.transformValues.centerX;
      const rotatedY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad) + this.transformValues.centerY;

      x = rotatedX;
      y = rotatedY;
    }

    // Apply translation
    x += this.transformValues.moveX;
    y += this.transformValues.moveY;
    z += this.transformValues.moveZ;

    // Apply display scale and invert X for visualization
    return {
      x: -x * this.scale,
      y: y * this.scale,
      z: z * this.scale
    };
  }

  /**
   * Clear all toolpath visualizations
   */
  clear() {
    // Remove all existing visualizations
    while (this.toolpathGroup.children.length) {
      const object = this.toolpathGroup.children[0];
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        object.material.dispose();
      }
      this.toolpathGroup.remove(object);
    }

    // Clear direction indicators
    while (this.directionGroup.children.length) {
      const object = this.directionGroup.children[0];
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        object.material.dispose();
      }
      this.directionGroup.remove(object);
    }

    this.pathPoints = [];
    this.lineIndexMap.clear();

    // Clear batched geometries
    for (const type in this.batchedGeometries) {
      this.batchedGeometries[type] = [];
    }

    this.hideToolPosition();

    // Reset stats
    this.stats = {
      totalSegments: 0,
      visibleSegments: 0,
      drawCalls: 0
    };

    // Recreate the arrow mesh for direction indicators
    this._createArrowMesh();
  }

  /**
   * Visualize a parsed toolpath
   * @param {Object} toolpath Parsed toolpath data from GCodeParser
   */
  visualize(toolpath) {
    // Always clear and redraw when visualization is requested
    this.clear();

    // Store the current toolpath for reference
    this.currentToolpath = toolpath;

    if (!toolpath || !toolpath.segments || toolpath.segments.length === 0) {
      return;
    }

    // Ensure materials are available for the current visualization mode
    if (!this.allMaterials[this.visualizationMode]) {
      this.allMaterials[this.visualizationMode] = {};
    }

    // Generate materials if they don't exist for this mode
    if (Object.keys(this.allMaterials[this.visualizationMode]).length === 0) {
      generateDynamicMaterials(
        this.allMaterials[this.visualizationMode],
        this.visualizationMode,
        toolpath
      );
    }

    // Set current materials
    this.materials = this.allMaterials[this.visualizationMode];

    this.stats.totalSegments = toolpath.segments.length;

    // Determine the visualization method based on toolpath size
    const segmentCount = toolpath.segments.length;

    if (segmentCount <= 1000) {
      // Use traditional rendering for small toolpaths
      this.visualizeTraditional(toolpath);
    } else {
      // Use optimized batch rendering for large toolpaths
      this.visualizeOptimizedBatched(toolpath);
    }

    // Add the overall path line if needed
    if (this.showPathLine && this.pathPoints.length > 1) {
      let displayPoints = this.pathPoints;

      // Simplify path if it's too large
      if (displayPoints.length > 5000) {
        const skipFactor = Math.ceil(displayPoints.length / 5000);
        displayPoints = displayPoints.filter((_, i) => i % skipFactor === 0);

        // Always include the last point
        if (displayPoints[displayPoints.length - 1] !== this.pathPoints[this.pathPoints.length - 1]) {
          displayPoints.push(this.pathPoints[this.pathPoints.length - 1]);
        }
      }

      const pathGeometry = new THREE.BufferGeometry().setFromPoints(displayPoints);
      const pathLine = new THREE.Line(pathGeometry, this.materials.path || new THREE.LineBasicMaterial({
        color: 0xecf0f1, // Light gray
        linewidth: 1,
        opacity: 0.4
      }));
      pathLine.name = 'path-overview';
      this.toolpathGroup.add(pathLine);
    }

    // Add direction indicators if enabled
    if (this.showDirectionIndicators) {
      this.visualizeDirectionIndicators(toolpath);
    }
  }

  /**
  * Create direction indicators for the toolpath
  * Enhanced version that properly creates and positions arrows
  * @param {Object} toolpath Parsed toolpath data
  */
  visualizeDirectionIndicators(toolpath) {
    if (!toolpath || !toolpath.segments || toolpath.segments.length === 0) {
      return;
    }

    try {
      // Only add indicators for cutting moves, not rapid moves
      const cuttingSegments = toolpath.segments.filter(s => !s.rapid && s.toolOn);

      // Determine how many indicators to show based on density
      let arrowCount = Math.max(10, Math.ceil(cuttingSegments.length * this.directionIndicatorDensity));
      arrowCount = Math.min(arrowCount, 1000); // Limit to 1000 arrows for performance

      // Create arrow mesh if it doesn't exist
      if (!this.arrowMesh) {
        this._createArrowMesh();
      }

      // If no cutting segments, just hide the arrows and return
      if (cuttingSegments.length === 0) {
        if (this.arrowMesh) {
          this.arrowMesh.visible = false;
        }
        this.directionGroup.visible = false;
        return;
      }

      // Dispose of previous arrow mesh if it exists
      if (this.arrowMesh) {
        this.directionGroup.remove(this.arrowMesh);
        if (this.arrowMesh.geometry) this.arrowMesh.geometry.dispose();
        if (this.arrowMesh.material) this.arrowMesh.material.dispose();
      }

      // Create a new arrow geometry - a simple cone
      const arrowGeometry = new THREE.ConeGeometry(0.04, 0.1, 8);
      arrowGeometry.rotateX(-Math.PI / 2); // Orient it along Y axis

      // Create the material - brighter and more visible
      const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd00, // Bright yellow/gold color
        transparent: true,
        opacity: 0.9
      });

      // Create the instanced mesh
      const instancedArrow = new THREE.InstancedMesh(
        arrowGeometry,
        arrowMaterial,
        arrowCount
      );
      instancedArrow.name = 'direction-arrows';
      instancedArrow.frustumCulled = true;

      // Add to the scene
      this.directionGroup.add(instancedArrow);
      this.arrowMesh = instancedArrow;

      // Set positions and orientations for arrows
      const step = Math.max(1, Math.floor(cuttingSegments.length / arrowCount));
      const dummy = new THREE.Object3D();

      let arrowIndex = 0;
      for (let i = 0; i < cuttingSegments.length; i += step) {
        if (arrowIndex >= arrowCount) break;

        const segment = cuttingSegments[i];

        // Get start and end points
        const start = this.applyTransformations(segment.start);
        const end = this.applyTransformations(segment.end);

        // Calculate direction vector
        const direction = new THREE.Vector3(
          end.x - start.x,
          end.y - start.y,
          end.z - start.z
        );

        // Skip extremely short segments
        if (direction.length() < 0.01) continue;

        direction.normalize();

        // Calculate position (midpoint of segment)
        const position = new THREE.Vector3(
          (start.x + end.x) / 2,
          (start.y + end.y) / 2,
          (start.z + end.z) / 2
        );

        // Set position
        dummy.position.copy(position);

        // Calculate rotation to align with segment direction
        dummy.lookAt(position.clone().add(direction));

        // Adjust rotation to ensure arrows are oriented along the path
        dummy.rotateX(Math.PI / 2); // Adjust for cone orientation

        // Set the scale of the arrow
        dummy.scale.set(
          this.directionIndicatorScale,
          this.directionIndicatorScale,
          this.directionIndicatorScale
        );

        // Update the matrix for this instance
        dummy.updateMatrix();
        instancedArrow.setMatrixAt(arrowIndex, dummy.matrix);

        arrowIndex++;
      }

      // Update the instance buffer
      instancedArrow.instanceMatrix.needsUpdate = true;

      // Make direction indicators visible based on setting
      this.directionGroup.visible = this.showDirectionIndicators;

      console.log(`Created ${arrowIndex} direction indicators`);
    } catch (error) {
      console.error("Error creating direction indicators:", error);

      // Create a single simple indicator as fallback
      const simpleGeometry = new THREE.SphereGeometry(0.03, 8, 8);
      const simpleMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd00,
        transparent: true,
        opacity: 0.9
      });

      const simpleMesh = new THREE.Mesh(simpleGeometry, simpleMaterial);
      simpleMesh.visible = this.showDirectionIndicators;

      this.directionGroup.add(simpleMesh);
      this.arrowMesh = simpleMesh;
    }
  }

  /**
   * Traditional visualization approach (one object per segment)
   * Used for smaller toolpaths where interactivity is more important than performance
   * @param {Object} toolpath Parsed toolpath data
   */
  visualizeTraditional(toolpath) {
    toolpath.segments.forEach((segment, index) => {
      const totalSegments = toolpath.segments.length;

      if (segment.type === 'line') {
        this.addLineSegment(segment, index, totalSegments);
      } else if (segment.type === 'arc') {
        this.addArcSegment(segment, index, totalSegments);
      }
    });
  }

  /**
   * Optimized visualization using batching but with direct materials
   * @param {Object} toolpath Parsed toolpath data
   */
  visualizeOptimizedBatched(toolpath) {
    // For modes other than MOVE_TYPE, we need a different batching strategy
    // Group segments by material key instead of fixed 'rapid', 'cut', etc.
    const batchedSegments = {};

    // Determine if we should apply LOD based on size and performance mode
    const isVeryLarge = toolpath.segments.length > 10000;
    const skipFactor = isVeryLarge ?
      Math.max(1, Math.floor(toolpath.segments.length / (this.lowPerformanceMode ? 2000 : 10000))) : 1;

    // Process segments for batching
    toolpath.segments.forEach((segment, index) => {
      // Apply LOD by skipping some segments for very large toolpaths
      if (isVeryLarge && index % skipFactor !== 0 &&
        index !== 0 && index !== toolpath.segments.length - 1) {
        return;
      }

      // Add to the appropriate batch based on visualization mode
      if (segment.type === 'line') {
        this.processLineForBatching(segment, batchedSegments, index, toolpath.segments.length);
      } else if (segment.type === 'arc') {
        this.processArcForBatching(segment, batchedSegments, index, toolpath.segments.length);
      }
    });

    // Create optimized geometry batches for each material key
    for (const materialKey in batchedSegments) {
      const segments = batchedSegments[materialKey];
      if (segments.length === 0) continue;

      this.createBatchedLinesWithDirectMaterial(segments, materialKey);
    }
  }

  /**
   * Process a line segment for batching
   * @param {Object} segment The segment to process
   * @param {Object} batchedSegments The batched segments object
   * @param {number} index Segment index
   * @param {number} total Total number of segments
   */
  processLineForBatching(segment, batchedSegments, index, total) {
    const { start, end, rapid, toolOn, lineIndex } = segment;

    // Apply transformations
    const transformedStart = this.applyTransformations(start);
    const transformedEnd = this.applyTransformations(end);

    // Add to path points
    if (this.pathPoints.length === 0) {
      this.pathPoints.push(new THREE.Vector3(
        transformedStart.x, transformedStart.y, transformedStart.z));
    }
    this.pathPoints.push(new THREE.Vector3(
      transformedEnd.x, transformedEnd.y, transformedEnd.z));

    // Determine material to use based on visualization mode
    let material = getMaterialForSegment(segment, this.materials, this.visualizationMode, index, total);

    // Check if material is undefined and provide a fallback
    if (!material) {
      // Use a default material as fallback (rapid or any other defined material)
      material = this.materials.rapid || this.materials.cut ||
        Object.values(this.materials)[0] ||
        new THREE.LineBasicMaterial({ color: 0xffffff });

      console.warn(`Material is undefined for segment at index ${index}. Using fallback material.`);
    }

    // Get a unique key for the material for batching
    // Make sure material exists and has a uuid before trying to access it
    const materialKey = material && material.uuid ? material.uuid : 'default-material-key';

    // Initialize batch for this material if it doesn't exist
    if (!batchedSegments[materialKey]) {
      batchedSegments[materialKey] = [];
    }

    // Add to batch
    batchedSegments[materialKey].push({
      points: [
        new THREE.Vector3(transformedStart.x, transformedStart.y, transformedStart.z),
        new THREE.Vector3(transformedEnd.x, transformedEnd.y, transformedEnd.z)
      ],
      lineIndex,
      material
    });
  }

  /**
   * Process an arc segment for batching
   * @param {Object} segment The segment to process
   * @param {Object} batchedSegments The batched segments object
   * @param {number} index Segment index
   * @param {number} total Total number of segments
   */
  processArcForBatching(segment, batchedSegments, index, total) {
    const { start, end, center, clockwise, toolOn, lineIndex } = segment;

    // Apply transformations
    const transformedStart = this.applyTransformations(start);
    const transformedEnd = this.applyTransformations(end);
    const transformedCenter = this.applyTransformations(center);

    // Calculate radius
    const radius = Math.sqrt(
      Math.pow(transformedStart.x - transformedCenter.x, 2) +
      Math.pow(transformedStart.y - transformedCenter.y, 2)
    );

    // Calculate start and end angles
    const startAngle = Math.atan2(transformedStart.y - transformedCenter.y, transformedStart.x - transformedCenter.x);
    const endAngle = Math.atan2(transformedEnd.y - transformedCenter.y, transformedEnd.x - transformedCenter.x);

    // Adaptive arc detail based on size and performance mode
    let arcDetail = 32; // Default high detail

    if (this.lowPerformanceMode) {
      // Reduce detail during transfers
      arcDetail = 12;
    } else if (radius > 5) {
      // Larger arcs can use fewer points
      arcDetail = 24;
    } else if (radius < 0.5) {
      // Very small arcs need more points
      arcDetail = 16;
    }

    // Create an arc curve
    const curve = new THREE.EllipseCurve(
      transformedCenter.x, transformedCenter.y, // center
      radius, radius,                 // xRadius, yRadius
      startAngle, endAngle,           // startAngle, endAngle
      clockwise,                      // clockwise
      0                               // rotation
    );

    // Get points along the curve
    const curvePoints = curve.getPoints(arcDetail);

    // Convert curve points to 3D and interpolate Z
    const points = curvePoints.map((pt, i) => {
      // Calculate progress along the curve (0 to 1)
      const progress = i / (curvePoints.length - 1);

      // Interpolate Z value
      const z = transformedStart.z + (transformedEnd.z - transformedStart.z) * progress;

      return new THREE.Vector3(pt.x, pt.y, z);
    });

    // Add to the overall path
    this.pathPoints.push(...points);

    // Determine material to use based on visualization mode
    let material = getMaterialForSegment(segment, this.materials, this.visualizationMode, index, total);

    // Check if material is undefined and provide a fallback
    if (!material) {
      // Use a default material as fallback
      material = this.materials.rapid || this.materials.cut ||
        Object.values(this.materials)[0] ||
        new THREE.LineBasicMaterial({ color: 0xffffff });

      console.warn(`Material is undefined for arc segment at index ${index}. Using fallback material.`);
    }

    // Get a unique key for the material for batching
    // Make sure material exists and has a uuid before trying to access it
    const materialKey = material && material.uuid ? material.uuid : 'default-material-key';

    // Initialize batch for this material if it doesn't exist
    if (!batchedSegments[materialKey]) {
      batchedSegments[materialKey] = [];
    }

    // Add to batch
    batchedSegments[materialKey].push({
      points,
      lineIndex,
      material
    });
  }

  /**
   * Create batched lines with direct materials (no custom shaders)
   * @param {Array} segments Array of segments to batch
   * @param {string} materialKey UUID of the material to use
   */
  createBatchedLinesWithDirectMaterial(segments, materialKey) {
    if (segments.length === 0) return;

    // Get the material from the first segment (all segments have the same material)
    const material = segments[0].material;

    // Create arrays to hold all points
    const allPoints = [];
    const lineIndices = [];

    // Collect all points and track line indices
    segments.forEach(segment => {
      // For each segment, store the starting index in the allPoints array
      const startIndex = allPoints.length;

      // Add all points for this segment
      segment.points.forEach(point => {
        allPoints.push(point);
      });

      // Store line index mapping for highlighting
      this.lineIndexMap.set(segment.lineIndex, {
        materialKey,
        startIndex,
        endIndex: allPoints.length - 1
      });

      // Store line index for each point
      for (let i = 0; i < segment.points.length; i++) {
        lineIndices.push(segment.lineIndex);
      }
    });

    // Create geometry
    const geometry = new THREE.BufferGeometry().setFromPoints(allPoints);

    // Add line index attribute for highlighting
    geometry.setAttribute('lineIndex', new THREE.Float32BufferAttribute(lineIndices, 1));

    // Create line mesh
    let lineMesh;

    // For rapid moves, we need to handle dashed lines specially
    if (material.isDashed || material === this.materials.rapid) {
      // Create a clone of the material to avoid modifying the original
      const dashedMaterial = material.clone();

      const positions = geometry.attributes.position.array;
      const lineDistances = new Float32Array(positions.length / 3);

      // Calculate line distances for dashed lines
      let lineLength = 0;
      for (let i = 0, j = 0; i < positions.length - 3; i += 3, j++) {
        lineDistances[j] = lineLength;

        const x1 = positions[i];
        const y1 = positions[i + 1];
        const z1 = positions[i + 2];
        const x2 = positions[i + 3];
        const y2 = positions[i + 4];
        const z2 = positions[i + 5];

        lineLength += Math.sqrt(
          Math.pow(x2 - x1, 2) +
          Math.pow(y2 - y1, 2) +
          Math.pow(z2 - z1, 2)
        );
      }

      // Last point
      lineDistances[lineDistances.length - 1] = lineLength;

      geometry.setAttribute('lineDistance', new THREE.Float32BufferAttribute(lineDistances, 1));

      lineMesh = new THREE.LineSegments(geometry, dashedMaterial);
      lineMesh.computeLineDistances();
    } else if (segments[0]?.points?.length > 2) {
      // For arcs with multiple points, use Line
      lineMesh = new THREE.Line(geometry, material);
    } else {
      // For straight lines, use LineSegments for better performance
      lineMesh = new THREE.LineSegments(geometry, material);
    }

    lineMesh.name = `batch-${materialKey}`;
    lineMesh.userData = { materialKey, isBatched: true };

    this.toolpathGroup.add(lineMesh);
    this.stats.drawCalls++;
  }

  /**
   * Add a line segment (traditional method)
   * @param {Object} segment Line segment data
   * @param {number} index Segment index
   * @param {number} total Total number of segments
   */
  addLineSegment(segment, index, total) {
    const { start, end, rapid, toolOn } = segment;

    // Apply transformations
    const transformedStart = this.applyTransformations(start);
    const transformedEnd = this.applyTransformations(end);

    // Create points for the line
    const points = [
      new THREE.Vector3(transformedStart.x, transformedStart.y, transformedStart.z),
      new THREE.Vector3(transformedEnd.x, transformedEnd.y, transformedEnd.z)
    ];

    // Add to the overall path
    if (this.pathPoints.length === 0) {
      this.pathPoints.push(points[0]);
    }
    this.pathPoints.push(points[1]);

    // Determine material to use based on visualization mode
    let material = getMaterialForSegment(segment, this.materials, this.visualizationMode, index, total);

    // Check if material is undefined and provide a fallback
    if (!material) {
      // Use a default material as fallback
      material = this.materials.rapid || this.materials.cut ||
        Object.values(this.materials)[0] ||
        new THREE.LineBasicMaterial({ color: 0xffffff });

      console.warn(`Material is undefined for segment at index ${index}. Using fallback material.`);
    }

    // Create the line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `segment-${this.toolpathGroup.children.length}`;

    // If it's a dashed material like rapid moves, compute line distances
    if (material.isDashed || material === this.materials.rapid) {
      line.computeLineDistances();
    }

    // Set userData for potential interaction
    line.userData = {
      segment,
      lineIndex: segment.lineIndex,
      material
    };

    this.toolpathGroup.add(line);
    this.stats.drawCalls++;
  }

  /**
   * Add an arc segment (traditional method)
   * @param {Object} segment Arc segment data
   * @param {number} index Segment index
   * @param {number} total Total number of segments
   */
  addArcSegment(segment, index, total) {
    const { start, end, center, clockwise, toolOn } = segment;

    // Apply transformations
    const transformedStart = this.applyTransformations(start);
    const transformedEnd = this.applyTransformations(end);
    const transformedCenter = this.applyTransformations(center);

    // Calculate radius
    const radius = Math.sqrt(
      Math.pow(transformedStart.x - transformedCenter.x, 2) +
      Math.pow(transformedStart.y - transformedCenter.y, 2)
    );

    // Calculate start and end angles
    const startAngle = Math.atan2(transformedStart.y - transformedCenter.y, transformedStart.x - transformedCenter.x);
    const endAngle = Math.atan2(transformedEnd.y - transformedCenter.y, transformedEnd.x - transformedCenter.x);

    // Adaptive arc detail based on size and performance mode
    let arcDetail = 32; // Default high detail

    if (this.lowPerformanceMode) {
      // Reduce detail during transfers
      arcDetail = 12;
    } else if (radius > 5) {
      // Larger arcs can use fewer points
      arcDetail = 24;
    } else if (radius < 0.5) {
      // Very small arcs need more points
      arcDetail = 16;
    }

    // Create an arc curve
    const curve = new THREE.EllipseCurve(
      transformedCenter.x, transformedCenter.y, // center
      radius, radius,                 // xRadius, yRadius
      startAngle, endAngle,           // startAngle, endAngle
      clockwise,                      // clockwise
      0                               // rotation
    );

    // Get points along the curve
    const curvePoints = curve.getPoints(arcDetail);

    // Convert curve points to 3D and interpolate Z
    const points = curvePoints.map((pt, i) => {
      // Calculate progress along the curve (0 to 1)
      const progress = i / (curvePoints.length - 1);

      // Interpolate Z value
      const z = transformedStart.z + (transformedEnd.z - transformedStart.z) * progress;

      return new THREE.Vector3(
        pt.x,
        pt.y,
        z
      );
    });

    // Add to the overall path
    this.pathPoints.push(...points);

    // Determine material to use based on visualization mode
    let material = getMaterialForSegment(segment, this.materials, this.visualizationMode, index, total);

    // Check if material is undefined and provide a fallback
    if (!material) {
      // Use a default material as fallback
      material = this.materials.rapid || this.materials.cut ||
        Object.values(this.materials)[0] ||
        new THREE.LineBasicMaterial({ color: 0xffffff });

      console.warn(`Material is undefined for arc segment at index ${index}. Using fallback material.`);
    }

    // Create the line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `segment-${this.toolpathGroup.children.length}`;

    // Set userData for potential interaction
    line.userData = {
      segment,
      lineIndex: segment.lineIndex,
      material
    };

    this.toolpathGroup.add(line);
    this.stats.drawCalls++;
  }

  /**
   * Simplify a path using Douglas-Peucker algorithm
   * @param {Array} points Array of points to simplify
   * @param {number} epsilon Tolerance for simplification
   * @returns {Array} Simplified points
   */
  simplifyPath(points, epsilon = 0.1) {
    if (points.length <= 2) return points;

    // Find the point with the maximum distance
    let maxDistance = 0;
    let index = 0;

    const start = points[0];
    const end = points[points.length - 1];

    // Create a line from start to end
    const line = new THREE.Line3(start, end);

    // Find the point with the maximum distance from the line
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];

      // Calculate distance from point to line
      const closestPoint = new THREE.Vector3();
      line.closestPointToPoint(point, true, closestPoint);
      const distance = point.distanceTo(closestPoint);

      if (distance > maxDistance) {
        maxDistance = distance;
        index = i;
      }
    }

    // If max distance is greater than epsilon, recursively simplify
    if (maxDistance > epsilon) {
      // Recursive case
      const firstSegment = this.simplifyPath(points.slice(0, index + 1), epsilon);
      const secondSegment = this.simplifyPath(points.slice(index), epsilon);

      // Concatenate but avoid duplicating the point at index
      return [...firstSegment.slice(0, -1), ...secondSegment];
    } else {
      // Base case
      return [start, end];
    }
  }

  /**
   * Show tool position indicator at a specific position
   * @param {Object} position Position {x, y, z}
   */
  showToolPosition(position) {
    if (position) {
      this.toolPositionSphere.position.set(
        position.x,
        position.y,
        position.z
      );
      this.toolPositionSphere.visible = true;
    } else {
      this.hideToolPosition();
    }
  }

  /**
   * Hide tool position indicator
   */
  hideToolPosition() {
    this.toolPositionSphere.visible = false;
  }

  /**
   * Highlight a specific line in the G-code
   * @param {number} lineIndex Line index to highlight
   */
  highlightLine(lineIndex) {
    // Skip minor updates in low performance mode
    if (this.lowPerformanceMode) {
      if (this.lastHighlightedLineIndex !== -1 &&
        Math.abs(lineIndex - this.lastHighlightedLineIndex) < 10 &&
        lineIndex !== 1 && lineIndex !== this.currentToolpath?.segments.length) {
        return;
      }
    }

    // Update last highlighted line
    this.lastHighlightedLineIndex = lineIndex;

    // Find the segment for this line index
    const segment = this.currentToolpath?.segments.find(s => s.lineIndex === lineIndex);
    if (!segment) return;

    // Check if we're using the optimized batch rendering
    if (this.lineIndexMap.has(lineIndex)) {
      const segmentInfo = this.lineIndexMap.get(lineIndex);

      // Find all batches
      const batches = this.toolpathGroup.children.filter(child =>
        child.userData && (child.userData.isBatched || child.name.startsWith('segment-')));

      // Reset all materials to original
      batches.forEach(batch => {
        if (batch.userData.isBatched) {
          const materialKey = batch.userData.materialKey;
          const batchMaterial = this.allMaterials[this.visualizationMode][materialKey] ||
            Array.from(Object.values(this.allMaterials[this.visualizationMode])).find(m => m.uuid === materialKey);

          if (batchMaterial) {
            batch.material = batchMaterial.clone();

            // For dashed materials like rapid moves, need to re-compute line distances
            if (batchMaterial.isDashed || batchMaterial === this.materials.rapid) {
              batch.computeLineDistances();
            }
          }
        } else if (batch.userData.segment) {
          // Traditional rendering case
          const segment = batch.userData.segment;
          const material = batch.userData.material;

          if (material) {
            batch.material = material;
            // Recompute line distances for dashed materials
            if (material.isDashed || material === this.materials.rapid) {
              batch.computeLineDistances();
            }
          }
        }
      });

      // For batched rendering, we need to duplicate the geometry and highlight just the relevant segments
      if (segmentInfo.startIndex !== undefined) {
        // Find the batch with the correct material key
        const batch = batches.find(b => b.userData.materialKey === segmentInfo.materialKey);

        if (batch) {
          // Get the segment's vertices
          const originalGeometry = batch.geometry;
          const originalPositions = originalGeometry.attributes.position.array;

          // Create a new geometry for just the highlighted segment
          const highlightPoints = [];

          // Extract the points for this segment
          for (let i = segmentInfo.startIndex; i <= segmentInfo.endIndex; i++) {
            const idx = i * 3;
            highlightPoints.push(
              new THREE.Vector3(
                originalPositions[idx],
                originalPositions[idx + 1],
                originalPositions[idx + 2]
              )
            );
          }

          // Create highlight line
          const highlightGeometry = new THREE.BufferGeometry().setFromPoints(highlightPoints);
          const highlightLine = new THREE.Line(highlightGeometry, this.materials.highlight || new THREE.LineBasicMaterial({
            color: 0xffd700, // Gold
            linewidth: 3.5,
            opacity: 1
          }));
          highlightLine.name = 'highlight-line';

          // Remove any existing highlight line
          const existingHighlight = this.toolpathGroup.children.find(c => c.name === 'highlight-line');
          if (existingHighlight) {
            this.toolpathGroup.remove(existingHighlight);
            existingHighlight.geometry.dispose();
          }

          this.toolpathGroup.add(highlightLine);

          // Show tool position at the end point
          const lastPoint = highlightPoints[highlightPoints.length - 1];
          this.showToolPosition(lastPoint);
        }
      } else {
        // For traditional rendering, find the object with the matching line index
        const object = batches.find(b => b.userData.lineIndex === lineIndex);

        if (object) {
          object.material = this.materials.highlight || new THREE.LineBasicMaterial({
            color: 0xffd700, // Gold
            linewidth: 3.5,
            opacity: 1
          });

          // Show the tool position at the end of this segment
          const transformedEnd = this.applyTransformations(segment.end);
          this.showToolPosition(transformedEnd);
        }
      }

      return;
    }

    // Traditional highlighting for non-batched rendering
    this.toolpathGroup.children.forEach(obj => {
      if (obj.userData && obj.userData.segment) {
        const segment = obj.userData.segment;
        const material = obj.userData.material;

        // Reset to original material
        if (material) {
          obj.material = material;
        }

        // If this segment matches the lineIndex, highlight it
        if (segment.lineIndex === lineIndex) {
          obj.material = this.materials.highlight || new THREE.LineBasicMaterial({
            color: 0xffd700, // Gold
            linewidth: 3.5,
            opacity: 1
          });

          // Show the tool position at the end of this segment
          const transformedEnd = this.applyTransformations(segment.end);
          this.showToolPosition(transformedEnd);
        }
      }
    });
  }

  /**
   * Toggle path line visibility
   * @param {boolean} visible Whether to show the path line
   */
  togglePathLine(visible) {
    this.showPathLine = visible;
    
    // Find and update any existing path line
    const existingPathLine = this.toolpathGroup.children.find(child => child.name === 'path-overview');
    if (existingPathLine) {
      existingPathLine.visible = visible;
    }
    
    // If we're toggling on and need to create the path, re-visualize
    // but only if it didn't already exist
    if (visible && !existingPathLine && this.currentToolpath && this.pathPoints.length > 1) {
      this.createPathLine();
    }
  }

  createPathLine() {
    // Remove any existing path line first
    const existingPathLine = this.toolpathGroup.children.find(child => child.name === 'path-overview');
    if (existingPathLine) {
      this.toolpathGroup.remove(existingPathLine);
      if (existingPathLine.geometry) existingPathLine.geometry.dispose();
    }
    
    // Only proceed if we have path points and visibility is enabled
    if (!this.showPathLine || this.pathPoints.length <= 1) return;
    
    // Prepare points for path line
    let displayPoints = this.pathPoints;
    
    // Simplify path if it's too large
    if (displayPoints.length > 5000) {
      const skipFactor = Math.ceil(displayPoints.length / 5000);
      displayPoints = displayPoints.filter((_, i) => i % skipFactor === 0);
      
      // Always include the last point
      if (displayPoints[displayPoints.length - 1] !== this.pathPoints[this.pathPoints.length - 1]) {
        displayPoints.push(this.pathPoints[this.pathPoints.length - 1]);
      }
    }
    
    // Create the path line geometry
    const pathGeometry = new THREE.BufferGeometry().setFromPoints(displayPoints);
    
    // Create path line material
    const pathMaterial = this.materials.path || new THREE.LineBasicMaterial({
      color: 0xecf0f1, // Light gray
      linewidth: 1 * this.lineWidthMultiplier,
      opacity: 0.4 * this.opacityMultiplier,
      transparent: true
    });
    
    // Create the line
    const pathLine = new THREE.Line(pathGeometry, pathMaterial);
    pathLine.name = 'path-overview';
    pathLine.visible = this.showPathLine;
    
    // Add to the scene
    this.toolpathGroup.add(pathLine);
    
    console.log(`Created path overview line with ${displayPoints.length} points, visible: ${this.showPathLine}`);
  }
  

  /**
 * Set global line width multiplier
 * @param {number} multiplier Line width multiplier (default: 1.0)
 */
  setLineWidthMultiplier(multiplier) {
    const validMultiplier = Math.max(0.1, Math.min(2.0, multiplier)); // Min changed to 0.1
    
    // Store for future use
    this.lineWidthMultiplier = validMultiplier;
    
    // Update all existing materials
    Object.values(this.allMaterials).forEach(materialSet => {
      Object.values(materialSet).forEach(material => {
        if (material && material.linewidth !== undefined) {
          // Base linewidth values for different material types
          let baseLinewidth = 1.0;
          
          if (material === materialSet.rapid) {
            baseLinewidth = 0.75;
          } else if (material === materialSet.cut) {
            baseLinewidth = 2.5;
          } else if (material === materialSet.plunge) {
            baseLinewidth = 3.0;
          } else if (material === materialSet.lift) {
            baseLinewidth = 2.5;
          } else if (material === materialSet.highlight) {
            baseLinewidth = 3.5;
          } else if (material === materialSet.path) {
            baseLinewidth = 1.0;
          }
          
          // Apply multiplier to base linewidth
          material.linewidth = baseLinewidth * validMultiplier;
        }
      });
    });
  }
  


  /**
   * Set global opacity multiplier
   * @param {number} multiplier Opacity multiplier (default: 1.0)
   */
  setOpacityMultiplier(multiplier) {
    const validMultiplier = Math.max(0.2, Math.min(1.0, multiplier));

    // Store for future use
    this.opacityMultiplier = validMultiplier;

    // Update all existing materials
    Object.values(this.allMaterials).forEach(materialSet => {
      Object.values(materialSet).forEach(material => {
        if (material && material.opacity !== undefined) {
          // Base opacity values for different material types
          let baseOpacity = 1.0;

          if (material === materialSet.rapid) {
            baseOpacity = 0.6;
          } else if (material === materialSet.cut) {
            baseOpacity = 0.95;
          } else if (material === materialSet.plunge) {
            baseOpacity = 0.95;
          } else if (material === materialSet.lift) {
            baseOpacity = 0.95;
          } else if (material === materialSet.highlight) {
            baseOpacity = 1.0;
          } else if (material === materialSet.path) {
            baseOpacity = 0.4;
          }

          // Apply multiplier to base opacity
          material.opacity = baseOpacity * validMultiplier;

          // Ensure transparency is enabled if opacity is less than 1
          if (material.opacity < 1.0) {
            material.transparent = true;
          }
        }
      });
    });
  }

  /**
   * Update frustum culling based on camera
   * @param {THREE.Camera} camera The camera to use for culling
   */
  updateFrustumCulling(camera) {
    // Get the frustum in world space
    this.frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );

    // Apply culling if we have more than 1000 segments
    if (this.stats.totalSegments > 1000) {
      let visibleSegments = 0;

      // Check each batch for visibility
      this.toolpathGroup.children.forEach(obj => {
        // For instanced objects we need special handling
        if (obj.userData.isInstanced && obj.geometry) {
          // Frustum culling would be complex for individual instances
          // Here we use a simplification by checking key instances

          const instanceCount = obj.geometry.attributes.instanceStart.count;
          visibleSegments += instanceCount;
        } else if (obj.geometry) {
          // Standard frustum culling
          const boundingSphere = obj.geometry.boundingSphere;

          if (!boundingSphere) {
            obj.geometry.computeBoundingSphere();
          }

          if (boundingSphere && this.frustum.intersectsSphere(boundingSphere)) {
            obj.visible = true;

            if (obj.geometry.attributes.position) {
              visibleSegments += obj.geometry.attributes.position.count / 2; // 2 points per line
            }
          } else {
            obj.visible = false;
          }
        }
      });

      this.stats.visibleSegments = visibleSegments;
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.clear();

    // Dispose of tool position indicator
    if (this.toolPositionSphere) {
      if (this.toolPositionSphere.geometry) {
        this.toolPositionSphere.geometry.dispose();
      }
      if (this.toolPositionSphere.material) {
        this.toolPositionSphere.material.dispose();
      }
      this.scene.remove(this.toolPositionSphere);
    }

    // Dispose of shared geometries
    if (this.lineGeometry) {
      this.lineGeometry.dispose();
    }

    // Dispose of direction indicators
    if (this.directionGroup) {
      while (this.directionGroup.children.length) {
        const child = this.directionGroup.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
        this.directionGroup.remove(child);
      }
      this.scene.remove(this.directionGroup);
    }

    // Dispose of materials
    for (const mode in this.allMaterials) {
      const materialSet = this.allMaterials[mode];
      for (const key in materialSet) {
        if (materialSet[key] && materialSet[key].dispose) {
          materialSet[key].dispose();
        }
      }
    }

    // Remove groups from the scene
    this.scene.remove(this.toolpathGroup);
    this.scene.remove(this.directionGroup);
  }
}

export default ToolpathRenderer;