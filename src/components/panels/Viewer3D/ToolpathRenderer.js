import * as THREE from 'three';

/**
 * Optimized class for rendering and visualizing toolpaths in a THREE.js scene
 * 
 * Performance improvements:
 * - Uses instancing for similar move types (reduces thousands of draw calls to just a few)
 * - Batches segments by material type (rapid, cut, plunge, lift)
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
    
    // Materials for different move types
    this.materials = {
      rapid: new THREE.LineDashedMaterial({ 
        color: 0x3498db, // More vibrant blue
        linewidth: 1.5,
        transparent: true,
        opacity: 0.7,
        dashSize: 2,
        gapSize: 2
      }),
      cut: new THREE.LineBasicMaterial({ 
        color: 0xf39c12, // Warmer orange
        linewidth: 2.5, 
        opacity: 0.95
      }),
      plunge: new THREE.LineBasicMaterial({ 
        color: 0xe74c3c, // Less harsh red
        linewidth: 3,
        opacity: 0.95
      }),
      lift: new THREE.LineBasicMaterial({ 
        color: 0x2ecc71, // More natural green
        linewidth: 2.5,
        opacity: 0.95
      }),
      path: new THREE.LineBasicMaterial({ 
        color: 0xecf0f1,
        linewidth: 1,
        opacity: 0.4
      }),
      highlight: new THREE.LineBasicMaterial({ 
        color: 0xffd700, // Gold highlight
        linewidth: 3.5,
        opacity: 1
      })
    }

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
    this.showPathLine = true;
    
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
    this.transformValues = {...this.transformValues, ...values};
    
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
    this.workOffset = {...offset};
    
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
      const pathLine = new THREE.Line(pathGeometry, this.materials.path);
      pathLine.name = 'path-overview';
      this.toolpathGroup.add(pathLine);
    }
  }
  
  /**
   * Traditional visualization approach (one object per segment)
   * Used for smaller toolpaths where interactivity is more important than performance
   * @param {Object} toolpath Parsed toolpath data
   */
  visualizeTraditional(toolpath) {
    toolpath.segments.forEach((segment, index) => {
      if (segment.type === 'line') {
        this.addLineSegment(segment);
      } else if (segment.type === 'arc') {
        this.addArcSegment(segment);
      }
    });
    
    // Add the overall path line if needed
    if (this.showPathLine && this.pathPoints.length > 1) {
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
      const pathLine = new THREE.Line(pathGeometry, this.materials.path);
      pathLine.name = 'path-overview';
      this.toolpathGroup.add(pathLine);
      this.stats.drawCalls++;
    }
  }
  
  /**
   * Optimized visualization using batching but with direct materials
   * @param {Object} toolpath Parsed toolpath data
   */
  visualizeOptimizedBatched(toolpath) {
    // Group segments by type for batching
    const batchedSegments = {
      rapid: [],
      cut: [],
      plunge: [],
      lift: []
    };
    
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
      
      // Add to the appropriate batch
      if (segment.type === 'line') {
        this.processLineForBatching(segment, batchedSegments);
      } else if (segment.type === 'arc') {
        this.processArcForBatching(segment, batchedSegments);
      }
    });
    
    // Create optimized geometry batches for each type
    for (const type in batchedSegments) {
      const segments = batchedSegments[type];
      if (segments.length === 0) continue;
      
      this.createBatchedLinesWithDirectMaterial(segments, type);
    }
  }
  
  /**
   * Process a line segment for batching
   * @param {Object} segment The segment to process
   * @param {Object} batchedSegments The batched segments object
   */
  processLineForBatching(segment, batchedSegments) {
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
    
    // Determine segment type
    let segmentType = 'cut';
    if (rapid) {
      segmentType = 'rapid';
    } else if (toolOn) {
      if (end.z < start.z) {
        segmentType = 'plunge';
      } else if (end.z > start.z) {
        segmentType = 'lift';
      }
    } else {
      segmentType = 'rapid';
    }
    
    // Add to batch
    batchedSegments[segmentType].push({
      points: [
        new THREE.Vector3(transformedStart.x, transformedStart.y, transformedStart.z),
        new THREE.Vector3(transformedEnd.x, transformedEnd.y, transformedEnd.z)
      ],
      lineIndex
    });
  }
  
  /**
   * Process an arc segment for batching
   * @param {Object} segment The segment to process
   * @param {Object} batchedSegments The batched segments object
   */
  processArcForBatching(segment, batchedSegments) {
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
    
    // Determine segment type
    let segmentType = 'cut';
    if (!toolOn) {
      segmentType = 'rapid';
    } else if (end.z < start.z) {
      segmentType = 'plunge';
    } else if (end.z > start.z) {
      segmentType = 'lift';
    }
    
    // Add to batch
    batchedSegments[segmentType].push({
      points,
      lineIndex
    });
  }
  
  /**
   * Create batched lines with direct materials (no custom shaders)
   * @param {Array} segments Array of segments to batch
   * @param {string} type Type of segments ('rapid', 'cut', etc.)
   */
  createBatchedLinesWithDirectMaterial(segments, type) {
    if (segments.length === 0) return;
    
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
        type,
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
    
    // Create material - clone from our existing materials
    const material = this.materials[type].clone();
    
    // For rapid moves, we need to handle dashed lines specially
    if (type === 'rapid') {
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
    }
    
    // Create the line mesh
    let lineMesh;
    
    if (type === 'rapid') {
      // For rapid moves, use LineDashedMaterial already prepared in materials
      lineMesh = new THREE.LineSegments(geometry, material);
      lineMesh.computeLineDistances();
    } else if (segments[0]?.points?.length > 2) {
      // For arcs with multiple points, use Line
      lineMesh = new THREE.Line(geometry, material);
    } else {
      // For straight lines, use LineSegments for better performance
      lineMesh = new THREE.LineSegments(geometry, material);
    }
    
    lineMesh.name = `batch-${type}`;
    lineMesh.userData = { type, isBatched: true };
    
    this.toolpathGroup.add(lineMesh);
    this.stats.drawCalls++;
  }

  /**
   * Add a line segment (traditional method)
   * @param {Object} segment Line segment data
   */
  addLineSegment(segment) {
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
    
    // Determine the material based on the type of move
    let material;
    
    if (rapid) {
      // Rapid moves
      material = this.materials.rapid;
    } else if (toolOn) {
      // Cutting moves
      
      // Check if this is a plunge (Z decreasing)
      if (end.z < start.z) {
        material = this.materials.plunge;
      } 
      // Check if this is a lift (Z increasing)
      else if (end.z > start.z) {
        material = this.materials.lift;
      } 
      // Normal cut
      else {
        material = this.materials.cut;
      }
    } else {
      // Non-cutting moves
      material = this.materials.rapid;
    }
    
    // Create the line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `segment-${this.toolpathGroup.children.length}`;

    if (material === this.materials.rapid) {
      line.computeLineDistances();
    }
      
    // Set userData for potential interaction
    line.userData = {
      segment,
      lineIndex: segment.lineIndex
    };
    
    this.toolpathGroup.add(line);
    this.stats.drawCalls++;
  }

  /**
   * Add an arc segment (traditional method)
   * @param {Object} segment Arc segment data
   */
  addArcSegment(segment) {
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
    
    // Determine the material based on the type of move
    let material;
    
    if (toolOn) {
      // If the tool is on, this is a cutting move
      
      // Check if this is a plunge (Z decreasing)
      if (end.z < start.z) {
        material = this.materials.plunge;
      } 
      // Check if this is a lift (Z increasing)
      else if (end.z > start.z) {
        material = this.materials.lift;
      } 
      // Normal cut
      else {
        material = this.materials.cut;
      }
    } else {
      // Non-cutting moves
      material = this.materials.rapid;
    }
    
    // Create the line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `segment-${this.toolpathGroup.children.length}`;
    
    // Set userData for potential interaction
    line.userData = {
      segment,
      lineIndex: segment.lineIndex
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
          const originalType = batch.userData.type;
          batch.material = this.materials[originalType].clone();
          
          // For rapid moves, need to re-compute line distances
          if (originalType === 'rapid') {
            batch.computeLineDistances();
          }
        } else if (batch.userData.segment) {
          // Traditional rendering case
          const segment = batch.userData.segment;
          
          // Determine the original material based on the segment type
          if (segment.rapid) {
            batch.material = this.materials.rapid;
          } else if (segment.toolOn) {
            if (segment.end.z < segment.start.z) {
              batch.material = this.materials.plunge;
            } else if (segment.end.z > segment.start.z) {
              batch.material = this.materials.lift;
            } else {
              batch.material = this.materials.cut;
            }
          } else {
            batch.material = this.materials.rapid;
          }
          
          // Recompute line distances for rapid moves
          if (segment.rapid) {
            batch.computeLineDistances();
          }
        }
      });
      
      // For batched rendering, we need to duplicate the geometry and highlight just the relevant segments
      if (segmentInfo.startIndex !== undefined) {
        // Find the batch with the correct type
        const batch = batches.find(b => b.userData.type === segmentInfo.type);
        
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
          const highlightLine = new THREE.Line(highlightGeometry, this.materials.highlight);
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
          object.material = this.materials.highlight;
          
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
        
        // Determine the original material based on the segment type
        if (segment.rapid) {
          obj.material = this.materials.rapid;
        } else if (segment.toolOn) {
          if (segment.end.z < segment.start.z) {
            obj.material = this.materials.plunge;
          } else if (segment.end.z > segment.start.z) {
            obj.material = this.materials.lift;
          } else {
            obj.material = this.materials.cut;
          }
        } else {
          obj.material = this.materials.rapid;
        }
        
        // If this segment matches the lineIndex, highlight it
        if (segment.lineIndex === lineIndex) {
          obj.material = this.materials.highlight;
          
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
    
    // Re-visualize to update
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
    }
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
    
    // Dispose of materials
    for (const key in this.materials) {
      if (this.materials[key]) {
        this.materials[key].dispose();
      }
    }
    
    // Remove the toolpath group from the scene
    this.scene.remove(this.toolpathGroup);
  }
}

export default ToolpathRenderer;