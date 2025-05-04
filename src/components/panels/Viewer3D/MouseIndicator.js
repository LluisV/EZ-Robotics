import * as THREE from 'three';

/**
 * Class to create and manage a crosshair mouse indicator in a THREE.js scene
 * Simplified version without animation and size options
 */
export class MouseIndicator {
  /**
   * Create a mouse position indicator
   * 
   * @param {THREE.Scene} scene THREE.js scene to render into
   * @param {Object} themeColors Theme color definitions
   * @param {number} sceneScale Scale factor (default: 0.1 - 10mm = 1 unit)
   * @param {Object} gridDimensions Grid dimensions {width, height, depth}
   */
  constructor(scene, themeColors, sceneScale = 0.1, gridDimensions = { width: 240, height: 350, depth: 150 }) {
    this.scene = scene;
    this.themeColors = themeColors;
    this.sceneScale = sceneScale;
    this.gridDimensions = gridDimensions;
    
    // Create a group to hold all indicator parts
    this.indicatorGroup = new THREE.Group();
    this.indicatorGroup.name = 'mouse-indicator';
    this.indicatorGroup.visible = false;
    this.scene.add(this.indicatorGroup);
    
    // Projection lines group - will be added to the main scene, not the indicator group
    // This allows the projection lines to extend to the grid plane
    this.projectionGroup = new THREE.Group();
    this.projectionGroup.name = 'mouse-indicator-projections';
    this.projectionGroup.visible = false;
    this.scene.add(this.projectionGroup);

    // Track projection lines visibility
    this.showProjectionLines = true;
    
    // Last position tracking
    this.lastPosition = new THREE.Vector3();
    
    // Create the indicator elements
    this.createCrosshair();
    this.createAxisLines();
    this.createCircle();
    this.createProjectionLines();
  }
  
  /**
   * Create the crosshair at the indicator point
   */
  createCrosshair() {
    // Create crosshair lines
    const crosshairSize = 0.05; // Size in scene units
    const crosshairMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      linewidth: 2
    });
    
    // Horizontal line
    const horizontalGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-crosshairSize, 0, 0),
      new THREE.Vector3(crosshairSize, 0, 0)
    ]);
    const horizontalLine = new THREE.Line(horizontalGeometry, crosshairMaterial);
    horizontalLine.renderOrder = 999; // Ensure it renders on top
    
    // Vertical line
    const verticalGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -crosshairSize, 0),
      new THREE.Vector3(0, crosshairSize, 0)
    ]);
    const verticalLine = new THREE.Line(verticalGeometry, crosshairMaterial);
    verticalLine.renderOrder = 999; // Ensure it renders on top
    
    // Add to group
    this.indicatorGroup.add(horizontalLine);
    this.indicatorGroup.add(verticalLine);
    
    // Store references
    this.horizontalLine = horizontalLine;
    this.verticalLine = verticalLine;
  }
  
  /**
   * Create colored axis lines extending from the indicator
   */
  createAxisLines() {
    // Line length in scene units
    const lineLength = 0.15;
    const lineWidth = 2.0;
    
    // X axis line (red)
    const xLineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.themeColors.yAxis),
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      linewidth: lineWidth
    });
    const xLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-lineLength, 0, 0)
    ]);
    const xLine = new THREE.Line(xLineGeometry, xLineMaterial);
    xLine.renderOrder = 998; // Ensure it renders on top
    
    // Y axis line (green)
    const yLineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.themeColors.xAxis),
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      linewidth: lineWidth
    });
    const yLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, lineLength, 0)
    ]);
    const yLine = new THREE.Line(yLineGeometry, yLineMaterial);
    yLine.renderOrder = 998; // Ensure it renders on top
    
    // Z axis line (blue)
    const zLineMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(this.themeColors.zAxis),
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      linewidth: lineWidth
    });
    const zLineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, lineLength)
    ]);
    const zLine = new THREE.Line(zLineGeometry, zLineMaterial);
    zLine.renderOrder = 998; // Ensure it renders on top
    
    // Add to group
    this.indicatorGroup.add(xLine);
    this.indicatorGroup.add(yLine);
    this.indicatorGroup.add(zLine);
    
    // Store references
    this.xLine = xLine;
    this.yLine = yLine;
    this.zLine = zLine;
  }
  
  /**
   * Create a circle around the indicator point
   */
  createCircle() {
    // Create a circle
    const circleRadius = 0.08;
    const circleSegments = 32;
    const circleGeometry = new THREE.BufferGeometry();
    
    // Generate circle points
    const circlePoints = [];
    for (let i = 0; i <= circleSegments; i++) {
      const theta = (i / circleSegments) * Math.PI * 2;
      circlePoints.push(
        new THREE.Vector3(
          Math.cos(theta) * circleRadius,
          Math.sin(theta) * circleRadius,
          0
        )
      );
    }
    
    circleGeometry.setFromPoints(circlePoints);
    
    const circleMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.4,
      depthTest: false
    });
    
    const circle = new THREE.Line(circleGeometry, circleMaterial);
    circle.renderOrder = 997; // Ensure it renders on top
    
    // Add to group
    this.indicatorGroup.add(circle);
    this.circle = circle;
  }
  
  /**
   * Create projection lines to the grid planes
   */
  createProjectionLines() {
    // Create dashed materials for projection lines
    const xProjectionMaterial = new THREE.LineDashedMaterial({
      color: new THREE.Color(this.themeColors.yAxis),
      transparent: true,
      opacity: 0.5,
      dashSize: 0.3,
      gapSize: 0.3,
      depthTest: true,
      linewidth: 3
    });
    
    const yProjectionMaterial = new THREE.LineDashedMaterial({
      color: new THREE.Color(this.themeColors.xAxis),
      transparent: true,
      opacity: 0.5,
      dashSize: 0.3,
      gapSize: 0.3,
      depthTest: true,
      linewidth: 3
    });
    
    const zProjectionMaterial = new THREE.LineDashedMaterial({
      color: new THREE.Color(this.themeColors.zAxis),
      transparent: true,
      opacity: 0.5,
      dashSize: 0.3,
      gapSize: 0.3,
      depthTest: true,
      linewidth: 3
    });
    
    // Create initial geometries (will be updated later with actual positions)
    const xProjectionGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    
    const yProjectionGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    
    const zProjectionGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    
    // Create projection lines
    const xProjectionLine = new THREE.Line(xProjectionGeometry, xProjectionMaterial);
    const yProjectionLine = new THREE.Line(yProjectionGeometry, yProjectionMaterial);
    const zProjectionLine = new THREE.Line(zProjectionGeometry, zProjectionMaterial);
    
    // Compute line distances for dashed lines
    xProjectionLine.computeLineDistances();
    yProjectionLine.computeLineDistances();
    zProjectionLine.computeLineDistances();
    
    // Add to projection group
    this.projectionGroup.add(xProjectionLine);
    this.projectionGroup.add(yProjectionLine);
    this.projectionGroup.add(zProjectionLine);
    
    // Store references
    this.xProjectionLine = xProjectionLine;
    this.yProjectionLine = yProjectionLine;
    this.zProjectionLine = zProjectionLine;
    
    // Create small dots at projection intersections
    const dotGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    
    const xDotMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.themeColors.yAxis),
      transparent: true,
      opacity: 0.7,
      depthTest: true
    });
    
    const yDotMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.themeColors.xAxis),
      transparent: true,
      opacity: 0.7,
      depthTest: true
    });
    
    const zDotMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.themeColors.zAxis),
      transparent: true,
      opacity: 0.7,
      depthTest: true
    });
    
    const xDot = new THREE.Mesh(dotGeometry, xDotMaterial);
    const yDot = new THREE.Mesh(dotGeometry, yDotMaterial);
    const zDot = new THREE.Mesh(dotGeometry, zDotMaterial);
    
    // Add to projection group
    this.projectionGroup.add(xDot);
    this.projectionGroup.add(yDot);
    this.projectionGroup.add(zDot);
    
    // Store references
    this.xDot = xDot;
    this.yDot = yDot;
    this.zDot = zDot;
  }
  
  /**
   * Set the position of the indicator
   * @param {THREE.Vector3|Object} position Position to set indicator
   */
  setPosition(position) {
    // Check if the position has changed significantly
    const newPos = new THREE.Vector3(position.x, position.y, position.z);
    const distance = this.lastPosition.distanceTo(newPos);
    
    if (distance > 0.001 || !this.indicatorGroup.visible) {
      // Position has changed or indicator was hidden
      this.lastPosition.copy(newPos);
      this.indicatorGroup.position.copy(newPos);
      
      // Update projection lines
      this.updateProjectionLines(newPos);
    }
    
    // Always ensure it's visible
    this.show();
  }
  
  /**
   * Update projection lines to the grid
   * @param {THREE.Vector3} position Current indicator position
   */
  updateProjectionLines(position) {
    // X projection to fixed negative position based on grid dimensions
    const fixedXPosition = -this.gridDimensions.width / 10;
    const xProjectPoint = new THREE.Vector3(fixedXPosition, position.y, position.z);
    
    // Update X projection line
    const xPoints = [
      position,
      xProjectPoint
    ];
    this.xProjectionLine.geometry.dispose();
    this.xProjectionLine.geometry = new THREE.BufferGeometry().setFromPoints(xPoints);
    this.xProjectionLine.computeLineDistances();
    
    // Update X dot position
    this.xDot.position.copy(xProjectPoint);
    
    // Y projection (to XZ plane)
    // Projected point is at (position.x, 0, position.z)
    const yProjectPoint = new THREE.Vector3(position.x, 0, position.z);
    
    // Update Y projection line
    const yPoints = [
      position,
      yProjectPoint
    ];
    this.yProjectionLine.geometry.dispose();
    this.yProjectionLine.geometry = new THREE.BufferGeometry().setFromPoints(yPoints);
    this.yProjectionLine.computeLineDistances();
    
    // Update Y dot position
    this.yDot.position.copy(yProjectPoint);
    
    // Z projection (to XY plane)
    // Projected point is at (position.x, position.y, 0)
    const zProjectPoint = new THREE.Vector3(position.x, position.y, 0);
    
    // Update Z projection line
    const zPoints = [
      position,
      zProjectPoint
    ];
    this.zProjectionLine.geometry.dispose();
    this.zProjectionLine.geometry = new THREE.BufferGeometry().setFromPoints(zPoints);
    this.zProjectionLine.computeLineDistances();
    
    // Update Z dot position
    this.zDot.position.copy(zProjectPoint);
  }
  
  /**
   * Update grid dimensions
   * @param {Object} dimensions New grid dimensions {width, height, depth}
   */
  setGridDimensions(dimensions) {
    this.gridDimensions = dimensions;
    // Update the projection lines if the indicator is visible
    if (this.indicatorGroup.visible) {
      this.updateProjectionLines(this.lastPosition);
    }
  }
  
  /**
   * Update the indicator's opacity
   * @param {number} opacity Opacity value from 0.0 to 1.0
   */
  updateOpacity(opacity) {
    // Update crosshair and axis lines opacity
    this.indicatorGroup.children.forEach(child => {
      if (child.material && child.material.opacity !== undefined) {
        const baseOpacity = child === this.circle ? 0.4 : 0.7;
        child.material.opacity = baseOpacity * opacity;
      }
    });
    
    // Update projection lines opacity
    this.projectionGroup.children.forEach(child => {
      if (child.material && child.material.opacity !== undefined) {
        const baseOpacity = child.type === 'Mesh' ? 0.7 : 0.5; // Dots vs lines
        child.material.opacity = baseOpacity * opacity;
      }
    });
  }
  
  /**
   * Show the indicator
   */
  show() {
    this.indicatorGroup.visible = true;
    // Only show projection lines if they're enabled
    this.projectionGroup.visible = this.showProjectionLines;
  }
  
  /**
   * Hide the indicator
   */
  hide() {
    this.indicatorGroup.visible = false;
    this.projectionGroup.visible = false;
  }
  
  /**
   * Set projection lines visibility
   * @param {boolean} visible Whether projection lines should be visible
   */
  setProjectionLinesVisible(visible) {
    this.showProjectionLines = visible;
    this.projectionGroup.visible = visible && this.indicatorGroup.visible;
  }
  
  /**
   * Update the scene (called on every animation frame)
   * No animation in this simplified version
   */
  update(deltaTime) {
    // No animations in simplified version
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    // Remove the indicator groups from scene
    if (this.scene) {
      if (this.indicatorGroup) {
        this.scene.remove(this.indicatorGroup);
      }
      if (this.projectionGroup) {
        this.scene.remove(this.projectionGroup);
      }
    }
    
    // Dispose all geometries and materials in the indicator group
    if (this.indicatorGroup) {
      this.indicatorGroup.children.forEach(child => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          child.material.dispose();
        }
      });
    }
    
    // Dispose all geometries and materials in the projection group
    if (this.projectionGroup) {
      this.projectionGroup.children.forEach(child => {
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          child.material.dispose();
        }
      });
    }
  }
}

export default MouseIndicator;