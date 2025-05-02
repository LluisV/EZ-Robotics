import * as THREE from 'three';

/**
 * Class to manage grid and axes in the 3D scene
 */
export class GridManager {
  /**
   * Create a grid manager
   * 
   * @param {THREE.Scene} scene THREE.js scene to render into
   * @param {Object} gridDimensions Grid dimensions {width, height, depth}
   * @param {number} sceneScale Scale factor (default: 0.1 - 10mm = 1 unit)
   * @param {Object} themeColors Theme color definitions
   * @param {Object} workOffset Work coordinate offset {x, y, z}
   */
  constructor(scene, gridDimensions, sceneScale = 0.1, themeColors, workOffset = { x: 0, y: 0, z: 0 }) {
    this.scene = scene;
    // Ensure depth is explicitly defined (not undefined or null)
    this.gridDimensions = {
      width: gridDimensions.width || 240,
      height: gridDimensions.height || 350,
      depth: gridDimensions.depth || Math.min(gridDimensions.width || 240, gridDimensions.height || 350)
    };
    
    console.log("GridManager initialized with dimensions:", this.gridDimensions);
    
    this.sceneScale = sceneScale;
    this.themeColors = themeColors;
    this.workOffset = { ...workOffset };
    this.cameraDistance = 10; // Default camera distance for text scaling
    
    // References to scene objects
    this.gridHelperRef = null;
    this.axesHelperRef = null;
    this.workAxesHelperRef = null;
    this.gridPlaneRef = null;
    this.workspaceBoxRef = null;
  
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
   * @param {Object} options.gridDimensions Grid dimensions {width, height, depth}
   * @param {Object} options.workOffset Work offset {x, y, z}
   * @param {boolean} options.showWorldCoords Whether to show world coordinates
   * @param {number} options.cameraDistance Current camera distance for text scaling
   */
  updateGridAndAxes({
    isGridVisible = this.isGridVisible,
    showAxes = this.showAxes,
    showWorkAxes = this.showWorkAxes,
    gridDimensions = this.gridDimensions,
    workOffset = this.workOffset,
    showWorldCoords = this.showWorldCoords,
    cameraDistance = this.cameraDistance
  } = {}) {
    console.log("updateGridAndAxes called with dimensions:", JSON.stringify(gridDimensions));
    console.log("Current dimensions:", JSON.stringify(this.gridDimensions));
    
    // Update internal state
    this.isGridVisible = isGridVisible;
    this.showAxes = showAxes;
    this.showWorkAxes = showWorkAxes;
    
    // Check if grid dimensions have changed - important for box update
    const dimensionsChanged = 
      this.gridDimensions.width !== gridDimensions.width ||
      this.gridDimensions.height !== gridDimensions.height ||
      (this.gridDimensions.depth !== gridDimensions.depth && gridDimensions.depth !== undefined);
    
    // Explicitly handle depth to ensure it's never undefined
    const newDepth = gridDimensions.depth !== undefined ? 
      gridDimensions.depth : 
      this.gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height);
    
    // Update dimensions
    this.gridDimensions = {
      width: gridDimensions.width,
      height: gridDimensions.height,
      depth: newDepth
    };
    
    console.log("Updated dimensions:", JSON.stringify(this.gridDimensions));
    console.log("Dimensions changed:", dimensionsChanged);
    
    this.workOffset = { ...workOffset };
    this.showWorldCoords = showWorldCoords;
    this.cameraDistance = cameraDistance;
  
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
    
    // Create workspace box wireframe
    console.log("Creating workspace box with dimensions:", JSON.stringify(this.gridDimensions));
    this.createWorkspaceBox();
    
    // Log if dimensions changed
    if (dimensionsChanged) {
      console.log("Grid dimensions updated:", JSON.stringify(this.gridDimensions));
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
    
    // Remove existing workspace box
    if (this.workspaceBoxRef) {
      this.scene.remove(this.workspaceBoxRef);
      this.workspaceBoxRef = null;
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

    // Materials for grid lines - make them slightly thicker but not too thick
    const primaryMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(this.themeColors.gridPrimary),
      linewidth: 1.75 // Moderately thicker primary lines
    });
    const secondaryMaterial = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(this.themeColors.gridSecondary),
      linewidth: 1.25 // Slightly thicker secondary lines 
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
      opacity: 0.01,
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
   * Add a label for an axis end point (X, Y, or Z)
   * @param {THREE.Group} group Group to add the label to
   * @param {string} text Label text (X, Y, or Z)
   * @param {number} x Position X
   * @param {number} y Position Y
   * @param {number} z Position Z
   * @param {string} color Text color
   * @param {number} scaleFactor Text scale factor
   */
  addAxisLabel(group, text, x, y, z, color, scaleFactor) {
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 256;
    const ctx = labelCanvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'Bold 200px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 128);

    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelMaterial = new THREE.SpriteMaterial({
      map: labelTexture,
      transparent: true
    });

    const label = new THREE.Sprite(labelMaterial);
    label.position.set(x, y, z);
    label.scale.set(
      4.0 * this.sceneScale * scaleFactor,
      4.0 * this.sceneScale * scaleFactor,
      1
    );
    group.add(label);
  }

  /**
   * Create world coordinate axes with rulers
   */
  createWorldAxes() {
    const axesGroup = new THREE.Group();
    axesGroup.name = 'world-axes';

    // Base dimensions for the axes - MAKE THEM SMALLER
    const origin = new THREE.Vector3(0, 0, 0);
    const length = 60 * this.sceneScale; // Shorter axes (was 100)
    const headLength = 3.5 * this.sceneScale; // Smaller head (was 5.0)
    const headWidth = 2.0 * this.sceneScale; // Smaller width (was 3.0)
    
    // Store the camera distance for use in the animation loop
    window.lastCameraDistance = this.cameraDistance;

    const textScaleFactor = 2;
    
    // Define tick dimensions - MAKE THEM BIGGER and OUTSIDE the workspace
    const tickSpacing = 10 * this.sceneScale; // 10mm spacing
    const majorTickEvery = 5; // Major tick with label every 50mm
    const minorTickLength = 3.0 * this.sceneScale * textScaleFactor; // Scale with zoom - increased from 2.0
    const majorTickLength = 6.0 * this.sceneScale * textScaleFactor; // Scale with zoom - increased from 4.0
    
    // Place ticks outside of workspace - move them outward by an offset
    const xRulerOffset = 0.5; 
    const yRulerOffset = 0.5; 
    const zRulerOffset = 0.5;

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


    // Add "World" label - SIZE SCALES WITH ZOOM
    if (this.showWorldCoords) {
      const canvas = document.createElement('canvas');
      canvas.width = 512; // Half the original size
      canvas.height = 256;
      const context = canvas.getContext('2d');
      context.fillStyle = this.themeColors.worldCoord;
      context.font = 'Bold 192px Arial';
      context.fillText('World', 20, 192);

      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
      });
      const label = new THREE.Sprite(labelMaterial);
      label.position.set(-length - 2.0 * this.sceneScale, 0, 0);
      // Scale text based on camera distance
      label.scale.set(
        6.0 * this.sceneScale * textScaleFactor, // Increased from 5.0
        3.0 * this.sceneScale * textScaleFactor, // Increased from 2.5
        1
      );
      axesGroup.add(label);
    }

    // Add ruler tick marks and labels along X axis
    // The full length of the X axis ruler will match the grid width
    const rulerLength = this.gridDimensions.width * this.sceneScale;

    // X-axis ruler (aligned with the grid, facing down, OUTSIDE THE WORKSPACE)
    for (let i = 0; i <= Math.floor(rulerLength / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Create tick mark - POSITIONED BELOW THE WORKSPACE
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-distance, -xRulerOffset, 0),
        new THREE.Vector3(-distance, -xRulerOffset - currentTickLength, 0)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.xAxis),
        linewidth: isMajorTick ? 2.5 : 1.5 // Moderately thicker lines
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      axesGroup.add(tick);

      // Add label for major ticks 
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm (10mm per tick)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 1024; // Larger canvas for bigger text
        labelCanvas.height = 512;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.xAxis;
        ctx.font = 'Bold 384px Arial'; // Much larger font
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 512, 384);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        // Position below the workspace and tick
        label.position.set(
          -distance, 
          -xRulerOffset - currentTickLength - (6.0 * this.sceneScale * textScaleFactor), // Increased from 5.0
          0
        );
        // Scale based on camera distance - made larger
        label.scale.set(
          12.0 * this.sceneScale * textScaleFactor, // Increased from 6.0
          6.0 * this.sceneScale * textScaleFactor, // Increased from 3.0
          1
        );
        axesGroup.add(label);
      }
    }

    // Y-axis ruler (aligned with the grid, facing left, OUTSIDE THE WORKSPACE)
    for (let i = 0; i <= Math.floor(this.gridDimensions.height * this.sceneScale / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Create tick mark - POSITIONED LEFT OF THE WORKSPACE
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-this.gridDimensions.width * this.sceneScale - yRulerOffset, distance, 0),
        new THREE.Vector3(-this.gridDimensions.width * this.sceneScale - yRulerOffset - currentTickLength, distance, 0)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.yAxis),
        linewidth: isMajorTick ? 2.5 : 1.5 // Moderately thicker lines
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      axesGroup.add(tick);

      // Add label for major ticks - OUTSIDE THE WORKSPACE, SIZE SCALES WITH ZOOM
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm (10mm per tick)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 1024; // Larger canvas for bigger text
        labelCanvas.height = 512;
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.yAxis;
        ctx.font = 'Bold 384px Arial'; // Much larger font
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 512, 384);

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        // Position left of the workspace and tick
        label.position.set(
          -this.gridDimensions.width * this.sceneScale - yRulerOffset - currentTickLength - (6.0 * this.sceneScale * textScaleFactor), // Increased from 5.0
          distance, 
          0
        );
        // Scale based on camera distance - made larger
        label.scale.set(
          12.0 * this.sceneScale * textScaleFactor, // Increased from 6.0
          6.0 * this.sceneScale * textScaleFactor, // Increased from 3.0
          1
        );
        axesGroup.add(label);
      }
    }

    // Z-axis ruler (extending upward, outside the workspace)
    for (let i = 0; i <= Math.floor(this.gridDimensions.depth * this.sceneScale / tickSpacing); i++) {
      const distance = i * tickSpacing;
      const isMajorTick = i % majorTickEvery === 0;

      // Create tick mark - POSITIONED BEHIND THE WORKSPACE
      const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
      const tickGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-this.gridDimensions.width * this.sceneScale - zRulerOffset, -zRulerOffset, distance),
        new THREE.Vector3(-this.gridDimensions.width * this.sceneScale - zRulerOffset - currentTickLength, -zRulerOffset, distance)
      ]);

      const tickMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(this.themeColors.zAxis),
        linewidth: isMajorTick ? 2.5 : 1.5 // Moderately thicker lines
      });

      const tick = new THREE.Line(tickGeometry, tickMaterial);
      axesGroup.add(tick);

      // Add label for major ticks - OUTSIDE THE WORKSPACE, SIZE SCALES WITH ZOOM
      if (isMajorTick) {
        const mmValue = i * 10; // Convert to mm (10mm per tick)
        const labelCanvas = document.createElement('canvas');
        labelCanvas.width = 1024; // Larger canvas for bigger text - increased from 512
        labelCanvas.height = 512; // Larger canvas - increased from 256
        const ctx = labelCanvas.getContext('2d');
        ctx.fillStyle = this.themeColors.zAxis;
        ctx.font = 'Bold 384px Arial'; // Much larger font - increased from 192px
        ctx.textAlign = 'center';
        ctx.fillText(mmValue.toString(), 512, 384); // Adjusted positions

        const labelTexture = new THREE.CanvasTexture(labelCanvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: labelTexture,
          transparent: true
        });

        const label = new THREE.Sprite(labelMaterial);
        // Position behind the workspace and tick
        label.position.set(
          -this.gridDimensions.width * this.sceneScale - zRulerOffset - currentTickLength - (6.0 * this.sceneScale * textScaleFactor), // Increased from 4.0
          -zRulerOffset, 
          distance
        );
        // Scale based on camera distance - made larger
        label.scale.set(
          12.0 * this.sceneScale * textScaleFactor, // Increased from 6.0
          6.0 * this.sceneScale * textScaleFactor, // Increased from 3.0
          1
        );
        axesGroup.add(label);
      }
    }

    this.scene.add(axesGroup);
    this.axesHelperRef = axesGroup;
  }

  /**
   * Set camera distance for text scaling
   * @param {number} distance Camera distance
   */
  setCameraDistance(distance) {
    // Only update if the camera distance has changed significantly (>10%)
    // This prevents unnecessary updates when camera distance changes slightly
    if (Math.abs(this.cameraDistance - distance) / this.cameraDistance > 0.1) {
      console.log(`Camera distance changed significantly: ${this.cameraDistance} -> ${distance}`);
      this.cameraDistance = distance;
      window.lastCameraDistance = distance;
      
      // Update rulers and text to scale with the new distance
      this.updateGridAndAxes({
        cameraDistance: distance
      });
    } else {
      // Still update stored value but don't regenerate
      this.cameraDistance = distance;
      window.lastCameraDistance = distance;
    }
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

    // Calculate scale factor for text based on camera distance
    // Now INVERSELY proportional to zoom level
    const textScaleFactor = 2;//;this.calculateTextScaleFactor();

    // Main axes dimensions - MAKE SMALLER
    const length = 50 * this.sceneScale; // Shorter axes (was 80)
    const headLength = 3.0 * this.sceneScale; // Smaller head (was 4.0)
    const headWidth = 2.0 * this.sceneScale; // Smaller width (was 2.5)

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

    // Add "Work" label - SCALE WITH ZOOM
    if (this.showWorldCoords) {
      const canvas = document.createElement('canvas');
      canvas.width = 512; // Half the original size
      canvas.height = 256;
      const context = canvas.getContext('2d');
      context.fillStyle = this.themeColors.workCoord;
      context.font = 'Bold 200px Arial';
      context.fillText('Work', 20, 200);

      const texture = new THREE.CanvasTexture(canvas);
      const labelMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
      });
      const label = new THREE.Sprite(labelMaterial);
      label.position.set(
        workOrigin.x - length - 2.0 * this.sceneScale,
        workOrigin.y,
        workOrigin.z
      );
      // Scale text based on camera distance
      label.scale.set(
        6.0 * this.sceneScale * textScaleFactor, // Increased from 5.0
        3.0 * this.sceneScale * textScaleFactor, // Increased from 2.5
        1
      );
      workAxesGroup.add(label);
    }


    this.scene.add(workAxesGroup);
    this.workAxesHelperRef = workAxesGroup;
  }
  
  /**
   * Create a wireframe box to represent the 3D workspace
   */
  createWorkspaceBox() {
    // If already exists, remove it
    if (this.workspaceBoxRef) {
      this.scene.remove(this.workspaceBoxRef);
      this.workspaceBoxRef = null;
    }
    
    const boxGroup = new THREE.Group();
    boxGroup.name = 'workspace-box';
    
    // Get dimensions from grid - ensure depth is valid
    const width = this.gridDimensions.width * this.sceneScale;
    const height = this.gridDimensions.height * this.sceneScale;
    
    // Explicitly log dimensions to debug depth issues
    console.log("Creating workspace box with grid dimensions:", {
      width: this.gridDimensions.width,
      height: this.gridDimensions.height,
      depth: this.gridDimensions.depth
    });
    
    // Make sure depth is properly defined
    const depth = this.gridDimensions.depth 
      ? this.gridDimensions.depth * this.sceneScale
      : Math.min(width, height); // Fallback
    
    console.log("Workspace box scene units:", { width, height, depth });
    
    // Create box edges as lines
    const material = new THREE.LineBasicMaterial({ 
      color: new THREE.Color(this.themeColors.gridPrimary),
      transparent: true,
      opacity: 0.7,
      linewidth: 1.75 // Slightly thicker for visibility but not too thick
    });
    
    // Bottom rectangle (same as the grid)
    const bottomGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-width, 0, 0),
      new THREE.Vector3(-width, height, 0),
      new THREE.Vector3(0, height, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    const bottomEdges = new THREE.Line(bottomGeometry, material);
    boxGroup.add(bottomEdges);
    
    // Top rectangle
    const topGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, depth),
      new THREE.Vector3(-width, 0, depth),
      new THREE.Vector3(-width, height, depth),
      new THREE.Vector3(0, height, depth),
      new THREE.Vector3(0, 0, depth)
    ]);
    const topEdges = new THREE.Line(topGeometry, material);
    boxGroup.add(topEdges);
    
    // Vertical connecting edges
    const verticalEdges = new THREE.Group();
    
    // Corner 1 (origin)
    const edge1 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, depth)
      ]),
      material
    );
    verticalEdges.add(edge1);
    
    // Corner 2 (X edge)
    const edge2 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width, 0, 0),
        new THREE.Vector3(-width, 0, depth)
      ]),
      material
    );
    verticalEdges.add(edge2);
    
    // Corner 3 (opposite corner)
    const edge3 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-width, height, 0),
        new THREE.Vector3(-width, height, depth)
      ]),
      material
    );
    verticalEdges.add(edge3);
    
    // Corner 4 (Y edge)
    const edge4 = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, height, 0),
        new THREE.Vector3(0, height, depth)
      ]),
      material
    );
    verticalEdges.add(edge4);
    
    boxGroup.add(verticalEdges);
    
    this.scene.add(boxGroup);
    this.workspaceBoxRef = boxGroup;
    
    console.log("Workspace box created with dimensions:", { width, height, depth });
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