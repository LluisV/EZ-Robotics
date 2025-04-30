import * as THREE from 'three';

/**
 * Class to manage grid and axes in the 3D scene
 */
export class GridManager {
  /**
   * Create a grid manager
   * 
   * @param {THREE.Scene} scene THREE.js scene to render into
   * @param {Object} gridDimensions Grid dimensions {width, height}
   * @param {number} sceneScale Scale factor (default: 0.1 - 10mm = 1 unit)
   * @param {Object} themeColors Theme color definitions
   * @param {Object} workOffset Work coordinate offset {x, y, z}
   */
  constructor(scene, gridDimensions, sceneScale = 0.1, themeColors, workOffset = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    this.gridDimensions = gridDimensions;
    this.sceneScale = sceneScale;
    this.themeColors = themeColors;
    this.workOffset = { ...workOffset };
    
    // References to scene objects
    this.gridHelperRef = null;
    this.axesHelperRef = null;
    this.workAxesHelperRef = null;
    this.gridPlaneRef = null;

    // Initial state
    this.isGridVisible = true;
    this.showAxes = true;
    this.showWorkAxes = true;
    this.showWorldCoords = true;
  }

  /**
   * Update grid and axes based on current settings
   * 
   * @param {Object} options Configuration options
   * @param {boolean} options.isGridVisible Whether to show the grid
   * @param {boolean} options.showAxes Whether to show world axes
   * @param {boolean} options.showWorkAxes Whether to show work axes
   * @param {Object} options.gridDimensions Grid dimensions {width, height}
   * @param {Object} options.workOffset Work offset {x, y, z}
   * @param {boolean} options.showWorldCoords Whether to show world coordinates
   */
  updateGridAndAxes({
    isGridVisible = this.isGridVisible,
    showAxes = this.showAxes,
    showWorkAxes = this.showWorkAxes,
    gridDimensions = this.gridDimensions,
    workOffset = this.workOffset,
    showWorldCoords = this.showWorldCoords
  } = {}) {
    // Update internal state
    this.isGridVisible = isGridVisible;
    this.showAxes = showAxes;
    this.showWorkAxes = showWorkAxes;
    this.gridDimensions = gridDimensions;
    this.workOffset = { ...workOffset };
    this.showWorldCoords = showWorldCoords;

    // Remove existing grid and axes
    this.removeObjects();

    // Create new grid with updated dimensions
    if (isGridVisible) {
      this.createGrid();
    }

    // Create axes if needed
    if (showAxes) {
      this.createWorldAxes();
    }

    // Create work axes if needed
    if (showWorkAxes) {
      this.createWorkAxes();
    }
  }

  /**
   * Remove existing grid and axes from the scene
   */
  removeObjects() {
    // Remove existing grid
    if (this.gridHelperRef) {
      this.scene.remove(this.gridHelperRef);
      this.gridHelperRef = null;
    }

    // Remove existing axes
    if (this.axesHelperRef) {
      this.scene.remove(this.axesHelperRef);
      this.axesHelperRef = null;
    }

    // Remove existing work axes
    if (this.workAxesHelperRef) {
      this.scene.remove(this.workAxesHelperRef);
      this.workAxesHelperRef = null;
    }
  }

  /**
   * Create the custom grid
   */
  createGrid() {
    const gridWidth = this.gridDimensions.width * this.sceneScale;
    const gridHeight = this.gridDimensions.height * this.sceneScale;

    // Create a custom grid with proper dimensions that's rectangular
    const gridGroup = new THREE.Group();
    gridGroup.name = 'custom-grid';

    // Create the main grid lines along X and Y
    // Use 10mm spacing for consistent grid cells
    const gridSpacing = 10.0 * this.sceneScale; // 10mm spacing
    const xLinesCount = Math.ceil(gridWidth / gridSpacing) + 1;
    const yLinesCount = Math.ceil(gridHeight / gridSpacing) + 1;

    // Materials for grid lines
    const primaryMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(this.themeColors.gridPrimary) 
    });
    const secondaryMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(this.themeColors.gridSecondary) 
    });

    // Create X grid lines (vertical lines running along Y-axis)
    for (let i = 0; i < xLinesCount; i++) {
      const x = i * gridSpacing; // Start from 0 (left edge)
      const points = [
        new THREE.Vector3(-x, 0, 0), // Bottom point (at y=0)
        new THREE.Vector3(-x, gridHeight, 0) // Top point
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = i % 5 === 0 ? primaryMaterial : secondaryMaterial; // Major line every 50mm
      const line = new THREE.Line(geometry, material);
      gridGroup.add(line);
    }

    // Create Y grid lines (horizontal lines running along X-axis)
    for (let i = 0; i < yLinesCount; i++) {
      const y = i * gridSpacing; // Start from 0 (bottom edge)
      const points = [
        new THREE.Vector3(0, y, 0), // Left point (at x=0)
        new THREE.Vector3(-gridWidth, y, 0) // Right point
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = i % 5 === 0 ? primaryMaterial : secondaryMaterial; // Major line every 50mm
      const line = new THREE.Line(geometry, material);
      gridGroup.add(line);
    }

    // Add grid to scene
    this.scene.add(gridGroup);
    this.gridHelperRef = gridGroup;

    // Create a plane for the grid surface for raycasting
    if (this.gridPlaneRef) {
      this.scene.remove(this.gridPlaneRef);
    }

    const planeGeometry = new THREE.PlaneGeometry(gridWidth, gridHeight);
    // Adjust the plane's position to match the grid (origin at bottom-left)
    planeGeometry.translate(-gridWidth / 2, gridHeight / 2, 0);

    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.05,
      transparent: true,
      side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = -0.01; // Just slightly below the grid
    plane.name = 'grid-plane';
    this.scene.add(plane);
    this.gridPlaneRef = plane;
  }

  /**
   * Create world coordinate axes with rulers
   */
  createWorldAxes() {
    const axesGroup = new THREE.Group();
    axesGroup.name = 'world-axes';

    // Base dimensions for the axes
    const origin = new THREE.Vector3(0, 0, 0);
    const length = 100 * this.sceneScale; // Long axes
    const headLength = 5.0 * this.sceneScale;
    const headWidth = 3.0 * this.sceneScale;

    // Define tick dimensions
    const tickSpacing = 10 * this.sceneScale; // 10mm spacing
    const majorTickEvery = 5; // Major tick with label every 50mm
    const minorTickLength = 1.5 * this.sceneScale;
    const majorTickLength = 3.0 * this.sceneScale;
    const tickOffset = 1.0 * this.sceneScale;

    // Create the main axes arrows
    // X axis (red)
    const xAxis = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      origin,
      length,
      new THREE.Color(this.themeColors.xAxis),
      headLength,
      headWidth
    );

    // Y axis (green)
    const yAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      origin,
      length,
      new THREE.Color(this.themeColors.yAxis),
      headLength,
      headWidth
    );

    // Z axis (blue)
    const zAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      origin,
      length,
      new THREE.Color(this.themeColors.zAxis),
      headLength,
      headWidth
    );

    axesGroup.add(xAxis);
    axesGroup.add(yAxis);
    axesGroup.add(zAxis);

    // Add "World" label
    if (this.showWorldCoords) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      context.fillStyle = this.themeColors.worldCoord;
      context.font = 'Bold 384px Arial';
      context.fillText('World', 40, 384);

      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
      });
      const label = new THREE.Sprite(labelMaterial);
      label.position.set(-length - 4.0 * this.sceneScale, 0, 0);
      label.scale.set(10.0 * this.sceneScale, 5.0 * this.sceneScale, 1);
      axesGroup.add(label);
    }

    // Add ruler tick marks and labels along X axis
    // The full length of the X axis ruler will match the grid width
    const rulerLength = this.gridDimensions.width * this.sceneScale;

    // X-axis ruler (aligned with the grid, facing up in Z direction)
    for (let i = 0; i <= Math.floor(rulerLength / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Create tick mark
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-distance, -tickOffset, 0),
        new THREE.Vector3(-distance, -tickOffset - currentTickLength, 0)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.xAxis),
        linewidth: isMajorTick ? 2 : 1
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      axesGroup.add(tick);

      // Add label for major ticks
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm (10mm per tick)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 512;
        labelCanvas.height = 256;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.xAxis;
        ctx.font = 'Bold 192px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 256, 192);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        label.position.set(-distance, -tickOffset - currentTickLength - 2.0 * this.sceneScale, 0);
        label.scale.set(4.0 * this.sceneScale, 2.0 * this.sceneScale, 1);
        axesGroup.add(label);
      }
    }

    // Y-axis ruler (aligned with the grid, facing right)
    for (let i = 0; i <= Math.floor(this.gridDimensions.height * this.sceneScale / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Create tick mark
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-tickOffset, distance, 0),
        new THREE.Vector3(-tickOffset - currentTickLength, distance, 0)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.yAxis),
        linewidth: isMajorTick ? 2 : 1
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      axesGroup.add(tick);

      // Add label for major ticks
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm (10mm per tick)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 512;
        labelCanvas.height = 256;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.yAxis;
        ctx.font = 'Bold 192px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 256, 192);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        label.position.set(-tickOffset - currentTickLength - 2.0 * this.sceneScale, distance, 0);
        label.scale.set(4.0 * this.sceneScale, 2.0 * this.sceneScale, 1);
        axesGroup.add(label);
      }
    }

    // Z-axis ruler (extending upward, labels facing forward)
    for (let i = 0; i <= Math.floor(length / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Create tick mark
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-tickOffset, -tickOffset, distance),
        new THREE.Vector3(-tickOffset - currentTickLength, -tickOffset, distance)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.zAxis),
        linewidth: isMajorTick ? 2 : 1
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      axesGroup.add(tick);

      // Add label for major ticks
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm (10mm per tick)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 128;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.zAxis;
        ctx.font = 'Bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 64, 48);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        label.position.set(-tickOffset - currentTickLength - 2.0 * this.sceneScale, -tickOffset, distance);
        label.scale.set(4.0 * this.sceneScale, 2.0 * this.sceneScale, 1);
        axesGroup.add(label);
      }
    }

    this.scene.add(axesGroup);
    this.axesHelperRef = axesGroup;
  }

  /**
   * Create work coordinate axes with rulers
   */
  createWorkAxes() {
    const workOrigin = new THREE.Vector3(
      -this.workOffset.x * this.sceneScale,
      this.workOffset.y * this.sceneScale,
      this.workOffset.z * this.sceneScale
    );

    const workAxesGroup = new THREE.Group();
    workAxesGroup.name = 'work-axes';

    // Main axes dimensions
    const length = 80 * this.sceneScale;
    const headLength = 4.0 * this.sceneScale;
    const headWidth = 2.5 * this.sceneScale;

    // Define tick dimensions
    const tickSpacing = 10 * this.sceneScale; // 10mm spacing
    const majorTickEvery = 5; // Major tick every 50mm
    const minorTickLength = 1.5 * this.sceneScale;
    const majorTickLength = 3.0 * this.sceneScale;
    const tickOffset = 1.0 * this.sceneScale;

    // X axis (red)
    const xAxis = new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),
      workOrigin,
      length,
      new THREE.Color(this.themeColors.workCoord),
      headLength,
      headWidth
    );

    // Y axis (green)
    const yAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      workOrigin,
      length,
      new THREE.Color(this.themeColors.workCoord),
      headLength,
      headWidth
    );

    // Z axis (blue)
    const zAxis = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      workOrigin,
      length,
      new THREE.Color(this.themeColors.workCoord),
      headLength,
      headWidth
    );

    workAxesGroup.add(xAxis);
    workAxesGroup.add(yAxis);
    workAxesGroup.add(zAxis);

    // Add "Work" label
    if (this.showWorldCoords) {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const context = canvas.getContext('2d');
      context.fillStyle = this.themeColors.workCoord;
      context.font = 'Bold 384px Arial';
      context.fillText('Work', 40, 384);

      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
      });
      const label = new THREE.Sprite(labelMaterial);
      label.position.set(
        workOrigin.x - length - 4.0 * this.sceneScale,
        workOrigin.y,
        workOrigin.z
      );
      label.scale.set(10.0 * this.sceneScale, 5.0 * this.sceneScale, 1);
      workAxesGroup.add(label);
    }

    // Add simplified tick marks for work axes
    // X-axis ruler ticks
    for (let i = 0; i <= Math.floor(length / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Position relative to work origin
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(workOrigin.x - distance, workOrigin.y - tickOffset, workOrigin.z),
        new THREE.Vector3(workOrigin.x - distance, workOrigin.y - tickOffset - currentTickLength, workOrigin.z)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.workCoord),
        linewidth: isMajorTick ? 2 : 1
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      workAxesGroup.add(tick);

      // Add label for major ticks
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 64;
        labelCanvas.height = 32;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.workCoord;
        ctx.font = 'Bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 32, 24);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        label.position.set(
          workOrigin.x - distance,
          workOrigin.y - tickOffset - currentTickLength - 0.3 * this.sceneScale,
          workOrigin.z
        );
        label.scale.set(0.5 * this.sceneScale, 0.25 * this.sceneScale, 1);
        workAxesGroup.add(label);
      }
    }

    this.scene.add(workAxesGroup);
    this.workAxesHelperRef = workAxesGroup;
  }

  /**
   * Get the grid plane for raycasting
   * @returns {THREE.Mesh} The grid plane
   */
  getGridPlane() {
    return this.gridPlaneRef;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.removeObjects();
    
    // Remove the grid plane
    if (this.gridPlaneRef) {
      if (this.gridPlaneRef.geometry) {
        this.gridPlaneRef.geometry.dispose();
      }
      if (this.gridPlaneRef.material) {
        this.gridPlaneRef.material.dispose();
      }
      this.scene.remove(this.gridPlaneRef);
      this.gridPlaneRef = null;
    }
  }
}