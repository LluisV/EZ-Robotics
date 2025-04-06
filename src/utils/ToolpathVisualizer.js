/**
 * Class for visualizing toolpaths in a THREE.js scene
 */
import * as THREE from 'three';

class ToolpathVisualizer {
  constructor(scene) {
    this.scale = 0.1;
    this.scene = scene;
    this.toolpathGroup = new THREE.Group();
    this.toolpathGroup.name = 'toolpath';
    this.scene.add(this.toolpathGroup);
    
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
    // Check if we actually need to update
    if (!this.needsUpdate(toolpath)) {
        return;
    }
    
    // Store the current toolpath for comparison later
    this.currentToolpath = toolpath;
    this.clear();
    
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
    
    // Scale the bounds before returning them
    const scaledBounds = {
      min: {
        x: toolpath.bounds.min.x * this.scale,
        y: toolpath.bounds.min.y * this.scale,
        z: toolpath.bounds.min.z * this.scale
      },
      max: {
        x: toolpath.bounds.max.x * this.scale,
        y: toolpath.bounds.max.y * this.scale,
        z: toolpath.bounds.max.z * this.scale
      }
    };
    
    // Return the scaled bounds for camera adjustment
    return scaledBounds;
  }

  /**
   * Add a line segment to the visualization
   * @param {Object} segment - Line segment data
   */
  addLineSegment(segment) {
    const { start, end, rapid, toolOn } = segment;
    
    // Create points for the line
    const points = [
        new THREE.Vector3(
          start.x * this.scale, 
          start.z * this.scale,  // Z becomes Y (up)
          start.y * this.scale   // Y becomes Z
        ),
        new THREE.Vector3(
          end.x * this.scale, 
          end.z * this.scale,    // Z becomes Y (up)
          end.y * this.scale     // Y becomes Z
        )
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
    
    // Calculate radius
    const radius = Math.sqrt(
        Math.pow(start.x - center.x, 2) + 
        Math.pow(start.y - center.y, 2)
      ) * this.scale;
    
    // Calculate start and end angles
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    
    // Create an arc curve
    const curve = new THREE.EllipseCurve(
      center.x, center.y,             // center
      radius, radius,                 // xRadius, yRadius
      startAngle, endAngle,           // startAngle, endAngle
      clockwise,                      // clockwise
      0                               // rotation
    );
    
    // Get points along the curve
    const points = curve.getPoints(32).map(pt => 
        new THREE.Vector3(
          pt.x * this.scale, 
          ((start.z + (end.z - start.z) * (curve.getLength(0, points.length) / curve.getLength())) * this.scale),
          pt.y * this.scale
        )
      );
    
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
      this.toolPositionSphere.position.set(
        position.x * this.scale, 
        position.z * this.scale,  // Z becomes Y
        position.y * this.scale   // Y becomes Z
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
          this.showToolPosition(segment.end);
        }
      }
    });
  }

  /**
   * Check if the visualizer needs to update
   * @param {string} gcode - The current G-code
   * @returns {boolean} Whether the visualizer needs to update
   */
  needsUpdate(parsedToolpath) {
    // Compare the current toolpath with the new one
    if (!this.currentToolpath || !parsedToolpath) {
      return true;
    }
    
    // Simple check: compare number of segments
    if (this.currentToolpath.segments?.length !== parsedToolpath.segments?.length) {
      return true;
    }
    
    // More thorough check could be implemented if needed
    
    return false;
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