import * as THREE from 'three';

/**
 * Class for rendering and visualizing toolpaths in a THREE.js scene
 * 
 * PERFORMANCE OPTIMIZATION: Added low performance mode during transfers
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
    
    // Create debug sphere for the tool position
    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    this.toolPositionSphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 })
    );
    this.toolPositionSphere.visible = false;
    this.scene.add(this.toolPositionSphere);
    
    // PERFORMANCE OPTIMIZATION: Track performance mode
    this.lowPerformanceMode = false;
    this.lastHighlightedLineIndex = -1;
  }

  /**
   * PERFORMANCE OPTIMIZATION: Set low performance mode during transfers
   * @param {boolean} active Whether to enable low performance mode
   */
  setLowPerformanceMode(active) {
    this.lowPerformanceMode = active;
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
    
    // PERFORMANCE OPTIMIZATION: Reduce detail level for large toolpaths
    const segmentCount = toolpath.segments.length;
    const useSimplifiedRendering = segmentCount > 1000;
    const sampleRate = useSimplifiedRendering ? 
      Math.max(1, Math.floor(segmentCount / 1000)) : 1;
      
    // Visualize each segment with potential sampling
    toolpath.segments.forEach((segment, index) => {
      // Skip some segments for very large toolpaths when in low performance mode
      if (useSimplifiedRendering && this.lowPerformanceMode && index % sampleRate !== 0) {
        return;
      }
      
      if (segment.type === 'line') {
        this.addLineSegment(segment);
      } else if (segment.type === 'arc') {
        this.addArcSegment(segment);
      }
    });
    
    // Add the overall path line if needed
    if (this.showPathLine && this.pathPoints.length > 1) {
      // PERFORMANCE OPTIMIZATION: Reduce path points for large toolpaths
      let displayPoints = this.pathPoints;
      if (displayPoints.length > 5000) {
        // Simplified decimation - just take every Nth point
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
   * Add a line segment to the visualization
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
   * Add an arc segment to the visualization
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
    
    // PERFORMANCE OPTIMIZATION: Adaptive arc detail based on size and performance mode
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
    // PERFORMANCE OPTIMIZATION: Skip minor updates in low performance mode
    if (this.lowPerformanceMode) {
      // Only update highlighting for significant changes
      if (this.lastHighlightedLineIndex !== -1 && 
          Math.abs(lineIndex - this.lastHighlightedLineIndex) < 10 &&
          lineIndex !== 1 && lineIndex !== this.currentToolpath?.segments.length) {
        return; // Skip this update
      }
    }
    
    // Update last highlighted line
    this.lastHighlightedLineIndex = lineIndex;
    
    // Reset all materials
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
    
    // Remove the toolpath group from the scene
    this.scene.remove(this.toolpathGroup);
  }
}

export default ToolpathRenderer;