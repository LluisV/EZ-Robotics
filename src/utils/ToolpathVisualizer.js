import * as THREE from 'three';

/**
 * Class for rendering and visualizing toolpaths in a THREE.js scene with optimizations for large point sets
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
        color: 0x00AAFF, 
        linewidth: 1,
        transparent: true,
        opacity: 0.6,
        dashSize: 1,
        gapSize: 1
      }),
      cut: new THREE.LineBasicMaterial({ 
        color: 0xFFAA00, 
        linewidth: 2, 
        opacity: 0.9
      }),
      plunge: new THREE.LineBasicMaterial({ 
        color: 0xFF0000, 
        linewidth: 2,
        opacity: 0.9
      }),
      lift: new THREE.LineBasicMaterial({ 
        color: 0x00FF00, 
        linewidth: 2,
        opacity: 0.9
      }),
      path: new THREE.LineBasicMaterial({ 
        color: 0xFFFFFF,
        linewidth: 1,
        opacity: 0.5
      }),
      highlight: new THREE.LineBasicMaterial({ 
        color: 0xFFFF00, 
        linewidth: 3,
        opacity: 1
      })
    };

    // Path for the overall toolpath
    this.pathPoints = [];
    this.showPathLine = true;
    
    // Store reference to current toolpath
    this.currentToolpath = null;

    // Create buffers for each move type
    this.buffers = {
      rapid: [],
      cut: [],
      plunge: [],
      lift: []
    };
    
    // Store segment metadata for interaction
    this.segmentMetadata = [];
    
    // Create debug sphere for the tool position
    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    this.toolPositionSphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 })
    );
    this.toolPositionSphere.visible = false;
    this.scene.add(this.toolPositionSphere);

    // For level of detail handling
    this.lodDistanceThreshold = 100;
    this.arcDetail = {
      near: 32,  // points for arcs when close to camera
      medium: 16, // medium distance
      far: 8     // far from camera
    };
    
    // For highlighting
    this.highlightedSegments = new Map();
    this.currentHighlightedIndex = -1;
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
    this.hideToolPosition();
    
    // Clear the buffers
    this.resetBuffers();
    
    // Clear segment metadata
    this.segmentMetadata = [];
    
    // Clear highlight data
    this.highlightedSegments.clear();
    this.currentHighlightedIndex = -1;
  }
  
  /**
   * Reset buffers for different move types
   */
  resetBuffers() {
    this.buffers = {
      rapid: [],
      cut: [],
      plunge: [],
      lift: []
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
    
    // Get number of segments
    const segmentCount = toolpath.segments.length;
    console.log(`Processing ${segmentCount} segments`);
    
    // Use optimized processing when there are many segments
    const useBuffering = segmentCount > 100;
    
    if (useBuffering) {
      // Pre-process all segments first
      toolpath.segments.forEach((segment, index) => {
        if (segment.type === 'line') {
          this.processLineSegment(segment, index);
        } else if (segment.type === 'arc') {
          this.processArcSegment(segment, index);
        }
      });
      
      // Create merged geometries for each move type
      this.createMergedGeometries();
    } else {
      // For smaller toolpaths, use the original approach for better interactivity
      toolpath.segments.forEach(segment => {
        if (segment.type === 'line') {
          this.addLineSegment(segment);
        } else if (segment.type === 'arc') {
          this.addArcSegment(segment);
        }
      });
    }
    
    // Add the overall path line if needed
    if (this.showPathLine && this.pathPoints.length > 1) {
      // Use decimation for very large paths
      let displayPoints = this.pathPoints;
      if (this.pathPoints.length > 5000) {
        displayPoints = this.decimatePath(this.pathPoints, 5000);
      }
      
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(displayPoints);
      const pathLine = new THREE.Line(pathGeometry, this.materials.path);
      pathLine.name = 'path-overview';
      this.toolpathGroup.add(pathLine);
    }
  }
  
  /**
   * Decimate a path to reduce point count
   * @param {Array} points Array of points to decimate
   * @param {number} targetCount Target number of points
   * @returns {Array} Decimated points
   */
  decimatePath(points, targetCount) {
    if (points.length <= targetCount) return points;
    
    // Use simple stride-based decimation
    const stride = Math.ceil(points.length / targetCount);
    
    const result = [];
    for (let i = 0; i < points.length; i += stride) {
      result.push(points[i]);
    }
    
    // Always include the last point
    if (result[result.length - 1] !== points[points.length - 1]) {
      result.push(points[points.length - 1]);
    }
    
    return result;
  }
  
  /**
   * Process a line segment and add to appropriate buffer
   * @param {Object} segment Line segment data
   * @param {number} index Index of the segment
   */
  processLineSegment(segment, index) {
    const { start, end, rapid, toolOn } = segment;
    
    // Apply transformations
    const transformedStart = this.applyTransformations(start);
    const transformedEnd = this.applyTransformations(end);
    
    // Create points for the line
    const startVec = new THREE.Vector3(transformedStart.x, transformedStart.y, transformedStart.z);
    const endVec = new THREE.Vector3(transformedEnd.x, transformedEnd.y, transformedEnd.z);
    
    // Add to the overall path
    if (this.pathPoints.length === 0) {
      this.pathPoints.push(startVec);
    }
    this.pathPoints.push(endVec);
    
    // Add points to the appropriate buffer based on the move type
    let bufferType;
    
    if (rapid) {
      bufferType = 'rapid';
    } else if (toolOn) {
      if (end.z < start.z) {
        bufferType = 'plunge';
      } else if (end.z > start.z) {
        bufferType = 'lift';
      } else {
        bufferType = 'cut';
      }
    } else {
      bufferType = 'rapid';
    }
    
    this.buffers[bufferType].push(startVec, endVec);
    
    // Store segment metadata for interaction (start index in the buffer)
    this.segmentMetadata.push({
      type: bufferType,
      startIndex: this.buffers[bufferType].length - 2,
      endIndex: this.buffers[bufferType].length - 1,
      segment
    });
  }
  
  /**
   * Process an arc segment and add to appropriate buffer
   * @param {Object} segment Arc segment data
   * @param {number} index Index of the segment
   */
  processArcSegment(segment, index) {
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
    
    // Use adaptive detail level based on arc size
    let arcDetail = this.arcDetail.medium;
    if (radius < 1) {
      arcDetail = this.arcDetail.near;
    } else if (radius > this.lodDistanceThreshold) {
      arcDetail = this.arcDetail.far;
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
    
    // Determine the buffer type based on the move
    let bufferType;
    
    if (toolOn) {
      // If the tool is on, this is a cutting move
      
      // Check if this is a plunge (Z decreasing)
      if (end.z < start.z) {
        bufferType = 'plunge';
      } 
      // Check if this is a lift (Z increasing)
      else if (end.z > start.z) {
        bufferType = 'lift';
      } 
      // Normal cut
      else {
        bufferType = 'cut';
      }
    } else {
      // Non-cutting moves
      bufferType = 'rapid';
    }
    
    // Store the starting index of this arc segment in the buffer
    const startIndex = this.buffers[bufferType].length;
    
    // Add all points to the buffer
    for (let i = 0; i < points.length - 1; i++) {
      this.buffers[bufferType].push(points[i], points[i + 1]);
    }
    
    // Store segment metadata
    this.segmentMetadata.push({
      type: bufferType,
      startIndex,
      endIndex: this.buffers[bufferType].length - 1,
      isArc: true,
      segment
    });
  }
  
  /**
   * Create merged geometries from the collected buffer points
   */
  createMergedGeometries() {
    // Create a line for each type of move
    for (const [moveType, points] of Object.entries(this.buffers)) {
      if (points.length > 0) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Set up the line based on move type
        let line;
        if (moveType === 'rapid') {
          line = new THREE.LineSegments(geometry, this.materials[moveType]);
          line.computeLineDistances();
        } else {
          line = new THREE.LineSegments(geometry, this.materials[moveType]);
        }
        
        line.name = `merged-${moveType}`;
        
        // Add to the group
        this.toolpathGroup.add(line);
      }
    }
  }

  /**
   * Add a line segment to the visualization (used for small toolpaths)
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
  }

  /**
   * Add an arc segment to the visualization (used for small toolpaths)
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
    
    // Create an arc curve
    const curve = new THREE.EllipseCurve(
      transformedCenter.x, transformedCenter.y, // center
      radius, radius,                 // xRadius, yRadius
      startAngle, endAngle,           // startAngle, endAngle
      clockwise,                      // clockwise
      0                               // rotation
    );
    
    // Get points along the curve
    const curvePoints = curve.getPoints(32);
    
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
  }

  /**
   * Show tool position indicator at a specific position
   * @param {Object} position Position {x, y, z}
   */
  showToolPosition(position) {
    return;
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
    return;
    // If using merged geometries, we need a different approach
    if (this.segmentMetadata.length > 0) {
      // Find the segment that corresponds to this line index
      const targetSegment = this.segmentMetadata.find(meta => 
        meta.segment.lineIndex === lineIndex
      );
      
      if (targetSegment) {
        this.highlightSegmentInMergedGeometry(targetSegment);
        
        // Show the tool position at the end of this segment
        const transformedEnd = this.applyTransformations(targetSegment.segment.end);
        this.showToolPosition(new THREE.Vector3(transformedEnd.x, transformedEnd.y, transformedEnd.z));
      } else {
        this.hideToolPosition();
      }
      
      return;
    }
    
    // Original approach for smaller toolpaths
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
   * Highlight a segment in merged geometry
   * @param {Object} targetSegment Segment metadata to highlight
   */
  highlightSegmentInMergedGeometry(targetSegment) {
    // Clear any previous highlights
    if (this.currentHighlightedIndex !== -1) {
      this.clearHighlights();
    }
    
    this.currentHighlightedIndex = targetSegment.segment.lineIndex;
    
    // Create a separate line for the highlighted segment
    const type = targetSegment.type;
    const startIdx = targetSegment.startIndex;
    const endIdx = targetSegment.endIndex;
    
    // Get the points for this segment
    const points = [];
    for (let i = startIdx; i <= endIdx; i++) {
      points.push(this.buffers[type][i]);
    }
    
    // Create a highlighted line
    if (points.length > 0) {
      const highlightGeometry = new THREE.BufferGeometry().setFromPoints(points);
      const highlightLine = new THREE.Line(highlightGeometry, this.materials.highlight);
      highlightLine.name = `highlight-segment`;
      
      // Store for later cleanup
      this.highlightedSegments.set(targetSegment.segment.lineIndex, highlightLine);
      
      this.toolpathGroup.add(highlightLine);
    }
  }
  
  /**
   * Clear any active highlights
   */
  clearHighlights() {
    // Remove all highlighted segments
    this.highlightedSegments.forEach(line => {
      if (line.geometry) {
        line.geometry.dispose();
      }
      this.toolpathGroup.remove(line);
    });
    
    this.highlightedSegments.clear();
    this.currentHighlightedIndex = -1;
    this.hideToolPosition();
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
   * Set the level of detail parameters for rendering
   * @param {Object} params LOD parameters
   */
  setLODParams(params) {
    if (params.distanceThreshold !== undefined) {
      this.lodDistanceThreshold = params.distanceThreshold;
    }
    
    if (params.arcDetail) {
      this.arcDetail = {...this.arcDetail, ...params.arcDetail};
    }
    
    // Re-visualize if we have a current toolpath
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
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
    
    // Dispose of materials
    Object.values(this.materials).forEach(material => {
      material.dispose();
    });
    
    // Remove the toolpath group from the scene
    this.scene.remove(this.toolpathGroup);
  }
}

export default ToolpathRenderer;