/**
 * Class for visualizing toolpaths in a THREE.js scene
 */
import * as THREE from 'three';

class ToolpathVisualizer {
  constructor(scene) {
    this.scale = 0.1; // Scale factor for visualization (0.1 means 10mm = 1 unit)
    this.scene = scene;
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
      })
    };

    // Path for the overall toolpath
    this.pathPoints = [];
    this.showPathLine = true;
    
    // Store reference to current gcode
    this.currentGCode = '';
    
    // Create debug sphere for the tool position
    const sphereGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    this.toolPositionSphere = new THREE.Mesh(
      sphereGeometry,
      new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 })
    );
    this.toolPositionSphere.visible = false;
    this.scene.add(this.toolPositionSphere);
  }

  /**
   * Set transformation values
   * @param {Object} values - The transformation values
   */
  setTransformValues(values) {
    this.transformValues = {...this.transformValues, ...values};
    // Visualize again if we have a current toolpath
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
    }
  }

  /**
   * Set work offset
   * @param {Object} offset - The work offset {x, y, z}
   */
  setWorkOffset(offset) {
    this.workOffset = {...offset};
    // Visualize again if we have a current toolpath
    if (this.currentToolpath) {
      this.visualize(this.currentToolpath);
    }
  }

  /**
   * Apply transformations to a point
   * @param {Object} point - The point {x, y, z} to transform
   * @returns {Object} - The transformed point
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
    
    // Apply display scale
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
  }

  /**
   * Visualize a parsed toolpath
   * @param {Object} toolpath - Parsed toolpath data from GCodeParser
   */
  visualize(toolpath) {
    // Always clear and redraw when visualization is requested
    this.clear();
    
    // Store the current toolpath for reference
    this.currentToolpath = toolpath;
    
    if (!toolpath || !toolpath.segments || toolpath.segments.length === 0) {
      return;
    }
    
    // Visualize each segment
    toolpath.segments.forEach(segment => {
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
    }
  }

  /**
   * Add a line segment to the visualization
   * @param {Object} segment - Line segment data
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
   * @param {Object} segment - Arc segment data
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
   * Show a debug sphere at a specific tool position
   * @param {Object} position - The position {x, y, z}
   */
  showToolPosition(position) {
    if (position) {
      // Position is already transformed if coming from highlightLine
      this.toolPositionSphere.position.set(
        position.x, 
        position.y, 
        position.z
      );
      this.toolPositionSphere.visible = true;
    } else {
      this.toolPositionSphere.visible = false;
    }
  }

  /**
   * Highlight a specific line in the G-code
   * @param {number} lineIndex - The line index to highlight
   */
  highlightLine(lineIndex) {
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
          obj.material = new THREE.LineBasicMaterial({ 
            color: 0xFFFF00, 
            linewidth: 3,
            opacity: 1
          });
          
          // Also show the tool position at the end of this segment
          const transformedEnd = this.applyTransformations(segment.end);
          this.showToolPosition(transformedEnd);
        }
      }
    });
  }

  /**
   * Set the current G-code
   * @param {string} gcode - The current G-code
   */
  setCurrentGCode(gcode) {
    this.currentGCode = gcode;
  }
}

export default ToolpathVisualizer;