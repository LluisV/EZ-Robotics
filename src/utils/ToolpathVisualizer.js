import * as THREE from 'three';

/**
 * Enhanced class for rendering and visualizing toolpaths in a THREE.js scene
 * Supports all G-code move types with distinct visual styling
 * Now with support for implicit moves
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
    
    // Materials for different move types with distinctive styling
    this.materials = {
      // Rapid moves (G0) - blue dashed lines
      rapid: new THREE.LineDashedMaterial({ 
        color: 0x00AAFF, 
        linewidth: 1.5,
        transparent: true,
        opacity: 0.7,
        dashSize: 2,
        gapSize: 1
      }),
      
      // Normal cutting moves (G1) - orange solid lines
      cut: new THREE.LineBasicMaterial({ 
        color: 0xFFAA00, 
        linewidth: 2.5, 
        opacity: 0.9
      }),
      
      // Plunge moves (Z going down) - red solid lines
      plunge: new THREE.LineBasicMaterial({ 
        color: 0xFF3333, 
        linewidth: 2.5,
        opacity: 0.9
      }),
      
      // Retract/lift moves (Z going up) - green solid lines
      lift: new THREE.LineBasicMaterial({ 
        color: 0x33CC33, 
        linewidth: 2.5,
        opacity: 0.9
      }),
      
      // Clockwise arc moves (G2) - purple solid lines
      arcCW: new THREE.LineBasicMaterial({
        color: 0xCC66FF,
        linewidth: 2.5,
        opacity: 0.9
      }),
      
      // Counter-clockwise arc moves (G3) - teal solid lines
      arcCCW: new THREE.LineBasicMaterial({
        color: 0x33CCCC,
        linewidth: 2.5,
        opacity: 0.9
      }),
      
      // Overall path when showing complete toolpath
      path: new THREE.LineBasicMaterial({ 
        color: 0xCCCCCC,
        linewidth: 1,
        opacity: 0.3,
        transparent: true
      }),
      
      // Highlighted path segment
      highlight: new THREE.LineBasicMaterial({ 
        color: 0xFFFF00, 
        linewidth: 3.5,
        opacity: 1
      }),
      
      // Implicit moves - same colors but with a brighter highlight
      implicitRapid: new THREE.LineDashedMaterial({ 
        color: 0x55CCFF, 
        linewidth: 2.0,
        transparent: true,
        opacity: 0.8,
        dashSize: 2,
        gapSize: 1
      }),
      
      implicitCut: new THREE.LineBasicMaterial({ 
        color: 0xFFCC33, 
        linewidth: 3.0, 
        opacity: 0.95
      }),
      
      implicitPlunge: new THREE.LineBasicMaterial({ 
        color: 0xFF6666, 
        linewidth: 3.0,
        opacity: 0.95
      }),
      
      implicitLift: new THREE.LineBasicMaterial({ 
        color: 0x66FF66, 
        linewidth: 3.0,
        opacity: 0.95
      }),
      
      implicitArcCW: new THREE.LineBasicMaterial({
        color: 0xDD88FF,
        linewidth: 3.0,
        opacity: 0.95
      }),
      
      implicitArcCCW: new THREE.LineBasicMaterial({
        color: 0x66DDDD,
        linewidth: 3.0,
        opacity: 0.95
      }),
      
      // Starts and endpoints
      start: new THREE.MeshBasicMaterial({
        color: 0x22FF22,
        opacity: 0.9
      }),
      end: new THREE.MeshBasicMaterial({
        color: 0xFF2222,
        opacity: 0.9
      })
    };

    // Path for the overall toolpath
    this.pathPoints = [];
    this.showPathLine = true;
    
    // Store reference to current toolpath
    this.currentToolpath = null;
    
    // For showing the toolpath hierarchy - segments grouped by tool and operation
    this.showStructuredView = false;
    
    // Create debug sphere for the tool position
    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    this.toolPositionSphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.8 })
    );
    this.toolPositionSphere.visible = false;
    this.scene.add(this.toolPositionSphere);
    
    // Start and end markers
    this.startMarker = null;
    this.endMarker = null;
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
    
    // Hide tool position marker
    this.hideToolPosition();
    
    // Remove start/end markers if they exist
    if (this.startMarker) {
      this.scene.remove(this.startMarker);
      if (this.startMarker.geometry) this.startMarker.geometry.dispose();
      if (this.startMarker.material) this.startMarker.material.dispose();
      this.startMarker = null;
    }
    
    if (this.endMarker) {
      this.scene.remove(this.endMarker);
      if (this.endMarker.geometry) this.endMarker.geometry.dispose();
      if (this.endMarker.material) this.endMarker.material.dispose();
      this.endMarker = null;
    }
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
    
    // Create groups to organize toolpath by tool and operation
    if (this.showStructuredView) {
      this.organizeToolpathByOperation(toolpath);
    } else {
      // Visualize each segment individually
      toolpath.segments.forEach((segment, index) => {
        if (segment.type === 'line') {
          this.addLineSegment(segment);
        } else if (segment.type === 'arc') {
          this.addArcSegment(segment);
        }
      });
    }
    
    // Add the overall path line if needed
    if (this.showPathLine && this.pathPoints.length > 1) {
      const pathGeometry = new THREE.BufferGeometry().setFromPoints(this.pathPoints);
      const pathLine = new THREE.Line(pathGeometry, this.materials.path);
      pathLine.name = 'path-overview';
      this.toolpathGroup.add(pathLine);
    }
    
    // Add start and end markers
    if (toolpath.segments.length > 0) {
      // Start marker at the beginning of the first segment
      const firstSegment = toolpath.segments[0];
      const transformedStart = this.applyTransformations(firstSegment.start);
      
      // End marker at the end of the last segment
      const lastSegment = toolpath.segments[toolpath.segments.length - 1];
      const transformedEnd = this.applyTransformations(lastSegment.end);
      
      // Create markers
      this.createMarkers(transformedStart, transformedEnd);
    }
  }

  /**
   * Create start and end markers
   * @param {Object} start Start position
   * @param {Object} end End position
   */
  createMarkers(start, end) {
    const startGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const endGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    
    this.startMarker = new THREE.Mesh(startGeometry, this.materials.start);
    this.endMarker = new THREE.Mesh(endGeometry, this.materials.end);
    
    this.startMarker.position.set(start.x, start.y, start.z);
    this.endMarker.position.set(end.x, end.y, end.z);
    
    this.scene.add(this.startMarker);
    this.scene.add(this.endMarker);
  }

  /**
   * Organize toolpath by tool and operation type for clearer visualization
   * @param {Object} toolpath Parsed toolpath data
   */
  organizeToolpathByOperation(toolpath) {
    // Group segments by tool number and operation type
    const operations = new Map();
    
    toolpath.segments.forEach((segment, index) => {
      // Create a key based on operation characteristics
      // Use tool number, rapid/cut/plunge/etc, and Z value to distinguish operations
      const toolNum = segment.toolNumber || 0;
      let moveType = segment.rapid ? 'rapid' : 
                   segment.type === 'arc' ? (segment.clockwise ? 'arcCW' : 'arcCCW') :
                   segment.end.z < segment.start.z ? 'plunge' :
                   segment.end.z > segment.start.z ? 'lift' : 'cut';
                   
      // Add "implicit" prefix for implicit moves
      if (segment.isImplicit) {
        moveType = 'implicit' + moveType.charAt(0).toUpperCase() + moveType.slice(1);
      }
                   
      const zLayer = segment.end.z.toFixed(2); // Group by Z height for layers
      const key = `tool_${toolNum}_${moveType}_${zLayer}`;
      
      if (!operations.has(key)) {
        operations.set(key, []);
      }
      
      operations.get(key).push(segment);
    });
    
    // Process each operation group
    operations.forEach((segments, key) => {
      // Create a subgroup for this operation
      const operationGroup = new THREE.Group();
      operationGroup.name = key;
      
      // Now add all segments in this operation
      segments.forEach(segment => {
        if (segment.type === 'line') {
          this.addLineSegment(segment, operationGroup);
        } else if (segment.type === 'arc') {
          this.addArcSegment(segment, operationGroup);
        }
      });
      
      // Add the operation group to the main toolpath group
      this.toolpathGroup.add(operationGroup);
    });
  }

  /**
   * Add a line segment to the visualization
   * @param {Object} segment Line segment data
   * @param {THREE.Group} [targetGroup] Optional target group to add to
   */
  addLineSegment(segment, targetGroup = this.toolpathGroup) {
    const { start, end, rapid, toolOn, isImplicit } = segment;
    
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
      // Rapid moves - use implicit variant if needed
      material = isImplicit ? this.materials.implicitRapid : this.materials.rapid;
    } else if (toolOn) {
      // Cutting moves
      
      // Check if this is a plunge (Z decreasing)
      if (end.z < start.z) {
        material = isImplicit ? this.materials.implicitPlunge : this.materials.plunge;
      } 
      // Check if this is a lift (Z increasing)
      else if (end.z > start.z) {
        material = isImplicit ? this.materials.implicitLift : this.materials.lift;
      } 
      // Normal cut
      else {
        material = isImplicit ? this.materials.implicitCut : this.materials.cut;
      }
    } else {
      // Non-cutting moves - use implicit variant if needed
      material = isImplicit ? this.materials.implicitRapid : this.materials.rapid;
    }
    
    // Create the line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `segment-${targetGroup.children.length}`;

    // For dashed lines like rapids, we need to compute line distances
    if (material === this.materials.rapid || material === this.materials.implicitRapid) {
      line.computeLineDistances();
    }
      
    // Set userData for potential interaction and highlighting
    line.userData = {
      segment,
      lineIndex: segment.lineIndex,
      isImplicit: segment.isImplicit
    };
    
    targetGroup.add(line);
  }

  /**
   * Add an arc segment to the visualization
   * @param {Object} segment Arc segment data
   * @param {THREE.Group} [targetGroup] Optional target group to add to
   */
  addArcSegment(segment, targetGroup = this.toolpathGroup) {
    const { start, end, center, clockwise, toolOn, isImplicit } = segment;
    
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
    
    // Get points along the curve - higher resolution for arcs
    const numPoints = Math.max(16, Math.floor(radius * 10));
    const curvePoints = curve.getPoints(numPoints);
    
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
      
      // Check if this is a plunge or lift while also an arc
      if (end.z < start.z) {
        material = isImplicit ? this.materials.implicitPlunge : this.materials.plunge;
      } 
      else if (end.z > start.z) {
        material = isImplicit ? this.materials.implicitLift : this.materials.lift;
      } 
      // Otherwise use arc-specific material based on direction
      else if (clockwise) {
        material = isImplicit ? this.materials.implicitArcCW : this.materials.arcCW;
      }
      else {
        material = isImplicit ? this.materials.implicitArcCCW : this.materials.arcCCW;
      }
    } else {
      // Non-cutting moves - probably won't be arcs, but just in case
      material = isImplicit ? this.materials.implicitRapid : this.materials.rapid;
    }
    
    // Create the line
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    line.name = `segment-${targetGroup.children.length}`;
    
    // Set userData for potential interaction
    line.userData = {
      segment,
      lineIndex: segment.lineIndex,
      isImplicit: segment.isImplicit
    };
    
    targetGroup.add(line);
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
    // Reset all materials
    this.toolpathGroup.traverse(obj => {
      if (obj.userData && obj.userData.segment) {
        const segment = obj.userData.segment;
        const isImplicit = obj.userData.isImplicit;
        
        // Determine the original material based on the segment type
        if (segment.rapid) {
          obj.material = isImplicit ? this.materials.implicitRapid : this.materials.rapid;
        } else if (segment.toolOn) {
          // Arcs
          if (segment.type === 'arc') {
            if (segment.end.z < segment.start.z) {
              obj.material = isImplicit ? this.materials.implicitPlunge : this.materials.plunge;
            } else if (segment.end.z > segment.start.z) {
              obj.material = isImplicit ? this.materials.implicitLift : this.materials.lift;
            } else if (segment.clockwise) {
              obj.material = isImplicit ? this.materials.implicitArcCW : this.materials.arcCW;
            } else {
              obj.material = isImplicit ? this.materials.implicitArcCCW : this.materials.arcCCW;
            }
          } 
          // Lines
          else {
            if (segment.end.z < segment.start.z) {
              obj.material = isImplicit ? this.materials.implicitPlunge : this.materials.plunge;
            } else if (segment.end.z > segment.start.z) {
              obj.material = isImplicit ? this.materials.implicitLift : this.materials.lift;
            } else {
              obj.material = isImplicit ? this.materials.implicitCut : this.materials.cut;
            }
          }
        } else {
          obj.material = isImplicit ? this.materials.implicitRapid : this.materials.rapid;
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
   * Toggle structured view of the toolpath
   * @param {boolean} enabled Whether to organize toolpath by operation
   */
  toggleStructuredView(enabled) {
    this.showStructuredView = enabled;
    
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
    
    // Dispose material resources
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