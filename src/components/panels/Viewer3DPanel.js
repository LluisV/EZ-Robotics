import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { useGCode } from '../../contexts/GCodeContext';
import ToolpathVisualizer from '../../utils/ToolpathVisualizer';
import Gizmo from './Gizmo';

const Viewer3DPanel = ({ showAxes: initialShowAxes = true }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const gridHelperRef = useRef(null);
  const axesHelperRef = useRef(null);
  const workAxesHelperRef = useRef(null);
  const toolpathVisualizerRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const robotToolRef = useRef(null);
  const mouseIndicatorRef = useRef(null);
  const fileInputRef = useRef(null);
  const gridPlaneRef = useRef(null);

  // Get toolpath data from the GCode context
  const { parsedToolpath, selectedLine, transformValues } = useGCode();

  // State for view and projection
  const [isPerspective, setIsPerspective] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [showAxes, setShowAxes] = useState(initialShowAxes);
  const [showWorkAxes, setShowWorkAxes] = useState(true);
  const [themeColors, setThemeColors] = useState(getThemeColors());
  const [showToolpath, setShowToolpath] = useState(true);
  const [showMousePosition, setShowMousePosition] = useState(true);
  const [panelDimensions, setPanelDimensions] = useState({ width: 0, height: 0 });

  // State for robot position
  const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, z: 0 });
  const [workOffset, setWorkOffset] = useState({ x: 0, y: 0, z: 0 });

  // State for STL files
  const [stlFiles, setStlFiles] = useState([]);
  const [hoveredStl, setHoveredStl] = useState(null);
  const stlObjectsRef = useRef({});

  // New state for grid dimensions (in mm)
  const [gridDimensions, setGridDimensions] = useState({ width: 240, height: 350 });
  const [isEditingGridDimensions, setIsEditingGridDimensions] = useState(false);
  const [tempGridDimensions, setTempGridDimensions] = useState({ width: 240, height: 350 });
  const [showWorldCoords, setShowWorldCoords] = useState(true);


  // Conversion factor from mm to scene units (0.1 means 10mm = 1 unit)
  const sceneScale = 0.1;

  // Theme colors object with theme-specific hardcoded values
  function getThemeColors() {
    // Check the current theme class on document.documentElement
    const themeClass = document.documentElement.className || '';

    // Default dark theme colors
    const colors = {
      background: '#1a1a1a',
      gridPrimary: '#444444',
      gridSecondary: '#333333',
      xAxis: '#cc3333',
      yAxis: '#00aa55',
      zAxis: '#0077cc',
      robotPosition: '#ffaa00',
      stlDefault: '#d9eaff',
      stlSelected: '#ffcc66',
      worldCoord: '#888888',
      workCoord: '#ffaa33'
    };

    // Adjust colors based on theme
    if (themeClass.includes('theme-light') || themeClass.includes('theme-light-spaced')) {
      colors.background = '#f0f0f0';
      colors.gridPrimary = '#cccccc';
      colors.gridSecondary = '#aaaaaa';
      colors.xAxis = '#aa0000';
      colors.yAxis = '#007700';
      colors.zAxis = '#0000aa';
      colors.robotPosition = '#ff8800';
      colors.stlDefault = '#7088aa';
      colors.stlSelected = '#ee9944';
      colors.worldCoord = '#666666';
      colors.workCoord = '#ee8800';
    } else if (themeClass.includes('theme-visual-studio')) {
      colors.background = '#1e1e1e';
      colors.gridPrimary = '#3f3f3f';
      colors.gridSecondary = '#2d2d2d';
      colors.stlDefault = '#569cd6';
      colors.stlSelected = '#ce9178';
      colors.worldCoord = '#777777';
      colors.workCoord = '#d7ba7d';
    } else if (themeClass.includes('theme-dracula')) {
      colors.background = '#282a36';
      colors.gridPrimary = '#44475a';
      colors.gridSecondary = '#383a4c';
      colors.xAxis = '#ff5555';
      colors.yAxis = '#50fa7b';
      colors.zAxis = '#8be9fd';
      colors.robotPosition = '#ffb86c';
      colors.stlDefault = '#bd93f9';
      colors.stlSelected = '#ffb86c';
      colors.worldCoord = '#6272a4';
      colors.workCoord = '#ffb86c';
    }

    return colors;
  }

  // Create robot position indicator with much larger size for visibility
  const createRobotTool = useCallback(() => {
    if (!sceneRef.current) return;

    // Remove existing tool if any to ensure clean state
    if (robotToolRef.current) {
      sceneRef.current.remove(robotToolRef.current);
      robotToolRef.current = null;
    }

    // Create a group for the robot tool
    const toolGroup = new THREE.Group();
    toolGroup.name = 'robot-tool';

    // Create a cylindrical body with larger size
    const bodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 16);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: themeColors.robotPosition,
      transparent: false,
      opacity: 1.0
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2; // Align with Z axis
    body.position.z = 0.5; // Move up half of its height

    // Create a larger conical tip
    const tipGeometry = new THREE.ConeGeometry(0.1, 0.2, 16);
    const tipMaterial = new THREE.MeshBasicMaterial({
      color: themeColors.robotPosition,
      transparent: false,
      opacity: 1.0
    });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.rotation.x = -Math.PI / 2; // Align with Z axis, point forward
    tip.position.z = 0.1; // Position at the top of the body

    // Add body and tip to the group
    toolGroup.add(body);
    toolGroup.add(tip);

    // Set initial position - always use world coordinates
    toolGroup.position.set(
      robotPosition.x * sceneScale,
      robotPosition.y * sceneScale,
      robotPosition.z * sceneScale
    );

    // Add to the scene
    sceneRef.current.add(toolGroup);
    robotToolRef.current = toolGroup;

    console.log("Robot tool created at position:", robotPosition);
  }, [robotPosition, themeColors, sceneScale]);


  // Update position of the robot tool without recreating it
  const updateRobotToolPosition = useCallback((worldPos) => {
    if (!robotToolRef.current) {
      // If the tool doesn't exist, create it
      createRobotTool();
      return;
    }

    // Smoothly update position
    robotToolRef.current.position.set(
      worldPos.x * sceneScale,
      worldPos.y * sceneScale,
      worldPos.z * sceneScale
    );

    // Update rotation based on A axis if available
    if (worldPos.a !== undefined) {
      robotToolRef.current.rotation.z = worldPos.a * Math.PI / 180;
    }

  }, [sceneScale, createRobotTool]);

  // Fix the flex layout for the main container and STL panel
  const viewerContainerStyle = {
    position: 'relative',
    display: 'flex',
    height: 'calc(100% - 40px)',
    overflow: 'hidden'
  };

  // Style for main 3D viewport - should shrink when panel appears
  const viewportStyle = {
    position: 'relative',
    flex: '1 1 auto',
    height: '100%',
    minWidth: 0 // Important to allow shrinking below content size
  };

  // Style for STL panel
  const stlPanelStyle = {
    width: '250px',
    minWidth: '250px',
    flex: '0 0 250px',
    borderLeft: '1px solid var(--border-color)',
    overflow: 'auto',
    backgroundColor: 'var(--panel-bg-color)',
    borderRadius: 'var(--border-radius)',
    marginLeft: '8px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s ease' // Smooth transition
  };

  useEffect(() => {
    if (!mountRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setPanelDimensions({ width, height });
      }
    });

    observer.observe(mountRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Update when the initialShowAxes prop changes
  useEffect(() => {
    setShowAxes(initialShowAxes);
  }, [initialShowAxes]);



  // Theme change observer
  useEffect(() => {
    if (!sceneRef.current) return;

    updateAxesAndGrid();
  }, [isGridVisible, showAxes, themeColors, gridDimensions, showWorkAxes]);

  // Update grid and axes based on current state
  const updateAxesAndGrid = useCallback(() => {
    if (!sceneRef.current) return;

    // Remove existing grid and axes
    if (gridHelperRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      gridHelperRef.current = null;
    }

    if (axesHelperRef.current) {
      sceneRef.current.remove(axesHelperRef.current);
      axesHelperRef.current = null;
    }

    if (workAxesHelperRef.current) {
      sceneRef.current.remove(workAxesHelperRef.current);
      workAxesHelperRef.current = null;
    }

    // Create new grid with updated dimensions
    if (isGridVisible) {
      const gridWidth = gridDimensions.width * sceneScale;
      const gridHeight = gridDimensions.height * sceneScale;

      // Create a custom grid with proper dimensions that's rectangular
      const gridGroup = new THREE.Group();
      gridGroup.name = 'custom-grid';

      // Create the main grid lines along X and Y
      // Use 10mm spacing for consistent grid cells
      const gridSpacing = 10.0 * sceneScale; // 10mm spacing
      const xLinesCount = Math.ceil(gridWidth / gridSpacing) + 1;
      const yLinesCount = Math.ceil(gridHeight / gridSpacing) + 1;

      // Materials for grid lines
      const primaryMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(themeColors.gridPrimary) });
      const secondaryMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(themeColors.gridSecondary) });

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
      sceneRef.current.add(gridGroup);
      gridHelperRef.current = gridGroup;

      // Create a plane for the grid surface for raycasting
      if (gridPlaneRef.current) {
        sceneRef.current.remove(gridPlaneRef.current);
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
      sceneRef.current.add(plane);
      gridPlaneRef.current = plane;
    }

    // Create enhanced axes with rulers if needed
    if (showAxes) {
      const axesGroup = new THREE.Group();
      axesGroup.name = 'world-axes';

      // Base dimensions for the axes - MASSIVELY INCREASED SIZE
      const origin = new THREE.Vector3(0, 0, 0);
      const length = 100 * sceneScale; // 5x original length
      const headLength = 5.0 * sceneScale; // 5x original head length
      const headWidth = 3.0 * sceneScale; // 5x original head width

      // Define tick dimensions first - MASSIVELY INCREASED SIZE
      const tickSpacing = 10 * sceneScale; // 10mm spacing (keep this consistent for correct measurements)
      const majorTickEvery = 5; // Major tick with label every 50mm
      const minorTickLength = 1.5 * sceneScale; // 7.5x original length
      const majorTickLength = 3.0 * sceneScale; // 7.5x original length
      const tickOffset = 1.0 * sceneScale; // 5x original offset

      // Create the main axes arrows
      // X axis (red)
      const xAxis = new THREE.ArrowHelper(
        new THREE.Vector3(-1, 0, 0),
        origin,
        length,
        new THREE.Color(themeColors.xAxis),
        headLength,
        headWidth
      );

      // Y axis (green)
      const yAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        origin,
        length,
        new THREE.Color(themeColors.yAxis),
        headLength,
        headWidth
      );

      // Z axis (blue)
      const zAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        origin,
        length,
        new THREE.Color(themeColors.zAxis),
        headLength,
        headWidth
      );

      axesGroup.add(xAxis);
      axesGroup.add(yAxis);
      axesGroup.add(zAxis);

      // Add "World" label - MASSIVELY INCREASED SIZE
      if (showWorldCoords) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; // 4x original width
        canvas.height = 512; // 4x original height
        const context = canvas.getContext('2d');
        context.fillStyle = themeColors.worldCoord;
        context.font = 'Bold 384px Arial'; // 4x original font size
        context.fillText('World', 40, 384); // Adjusted positions

        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true
        });
        const label = new THREE.Sprite(labelMaterial);
        label.position.set(-length - 4.0 * sceneScale, 0, 0);
        label.scale.set(10.0 * sceneScale, 5.0 * sceneScale, 1); // 6x previous scale
        axesGroup.add(label);
      }

      // Add ruler tick marks and labels along X axis
      // The full length of the X axis ruler will match the grid width
      const rulerLength = gridDimensions.width * sceneScale;

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
          color: new THREE.Color(themeColors.xAxis),
          linewidth: isMajorTick ? 2 : 1
        });

        const tick = new THREE.Line(tickGeometry, tickMaterial);
        axesGroup.add(tick);

        // Add label for major ticks
        if (isMajorTick) {
          const mmValue = i * 10; // Convert to mm (10mm per tick)
          const labelCanvas = document.createElement('canvas');
          labelCanvas.width = 512; // 8x original width
          labelCanvas.height = 256; // 8x original height
          const ctx = labelCanvas.getContext('2d');
          ctx.fillStyle = themeColors.xAxis;
          ctx.font = 'Bold 192px Arial'; // 8x original font size
          ctx.textAlign = 'center';
          ctx.fillText(mmValue.toString(), 256, 192); // Adjusted center positions

          const labelTexture = new THREE.CanvasTexture(labelCanvas);
          const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
          });

          const label = new THREE.Sprite(labelMaterial);
          label.position.set(-distance, -tickOffset - currentTickLength - 2.0 * sceneScale, 0);
          label.scale.set(4.0 * sceneScale, 2.0 * sceneScale, 1); // 8x original scale
          axesGroup.add(label);
        }
      }

      // Y-axis ruler (aligned with the grid, facing right)
      for (let i = 0; i <= Math.floor(gridDimensions.height * sceneScale / tickSpacing); i++) {
        const distance = i * tickSpacing;
        const isMajorTick = i % majorTickEvery === 0;

        // Create tick mark
        const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
        const tickGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-tickOffset, distance, 0),
          new THREE.Vector3(-tickOffset - currentTickLength, distance, 0)
        ]);

        const tickMaterial = new THREE.LineBasicMaterial({
          color: new THREE.Color(themeColors.yAxis),
          linewidth: isMajorTick ? 2 : 1
        });

        const tick = new THREE.Line(tickGeometry, tickMaterial);
        axesGroup.add(tick);

        // Add label for major ticks
        if (isMajorTick) {
          const mmValue = i * 10; // Convert to mm (10mm per tick)
          const labelCanvas = document.createElement('canvas');
          labelCanvas.width = 512; // 8x original width
          labelCanvas.height = 256; // 8x original height
          const ctx = labelCanvas.getContext('2d');
          ctx.fillStyle = themeColors.yAxis;
          ctx.font = 'Bold 192px Arial'; // 8x original font size
          ctx.textAlign = 'center';
          ctx.fillText(mmValue.toString(), 256, 192); // Adjusted center positions

          const labelTexture = new THREE.CanvasTexture(labelCanvas);
          const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
          });

          const label = new THREE.Sprite(labelMaterial);
          label.position.set(-tickOffset - currentTickLength - 2.0 * sceneScale, distance, 0);
          label.scale.set(4.0 * sceneScale, 2.0 * sceneScale, 1); // 8x original scale
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
          color: new THREE.Color(themeColors.zAxis),
          linewidth: isMajorTick ? 2 : 1
        });

        const tick = new THREE.Line(tickGeometry, tickMaterial);
        axesGroup.add(tick);

        // Add label for major ticks
        if (isMajorTick) {
          const mmValue = i * 10; // Convert to mm (10mm per tick)
          const labelCanvas = document.createElement('canvas');
          labelCanvas.width = 128; // Doubled canvas width
          labelCanvas.height = 64; // Doubled canvas height
          const ctx = labelCanvas.getContext('2d');
          ctx.fillStyle = themeColors.zAxis;
          ctx.font = 'Bold 48px Arial'; // Doubled font size
          ctx.textAlign = 'center';
          ctx.fillText(mmValue.toString(), 64, 48); // Adjusted center positions

          const labelTexture = new THREE.CanvasTexture(labelCanvas);
          const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
          });

          const label = new THREE.Sprite(labelMaterial);
          label.position.set(-tickOffset - currentTickLength - 2.0 * sceneScale, -tickOffset, distance);
          label.scale.set(4.0 * sceneScale, 2.0 * sceneScale, 1); // 8x original scale
          axesGroup.add(label);
        }
      }

      sceneRef.current.add(axesGroup);
      axesHelperRef.current = axesGroup;
    }

    // Work axes with ruler markings (similar to world axes but at work offset position)
    if (showWorkAxes) {
      const workOrigin = new THREE.Vector3(
        -workOffset.x * sceneScale,
        workOffset.y * sceneScale,
        workOffset.z * sceneScale
      );

      const workAxesGroup = new THREE.Group();
      workAxesGroup.name = 'work-axes';

      // Main axes dimensions - MASSIVELY INCREASED SIZE
      const length = 80 * sceneScale; // 5x original length
      const headLength = 4.0 * sceneScale; // 5x original head length
      const headWidth = 2.5 * sceneScale; // 5x original head width

      // Define tick dimensions here to avoid variable shadowing - MASSIVELY INCREASED SIZE
      const tickSpacing = 10 * sceneScale; // 10mm spacing (keep this consistent for correct measurements)
      const majorTickEvery = 5; // Major tick every 50mm
      const minorTickLength = 1.5 * sceneScale; // 7.5x original length
      const majorTickLength = 3.0 * sceneScale; // 7.5x original length
      const tickOffset = 1.0 * sceneScale; // 5x original offset

      // X axis (red)
      const xAxis = new THREE.ArrowHelper(
        new THREE.Vector3(-1, 0, 0),
        workOrigin,
        length,
        new THREE.Color(themeColors.workCoord),
        headLength,
        headWidth
      );

      // Y axis (green)
      const yAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        workOrigin,
        length,
        new THREE.Color(themeColors.workCoord),
        headLength,
        headWidth
      );

      // Z axis (blue)
      const zAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        workOrigin,
        length,
        new THREE.Color(themeColors.workCoord),
        headLength,
        headWidth
      );

      workAxesGroup.add(xAxis);
      workAxesGroup.add(yAxis);
      workAxesGroup.add(zAxis);

      // Add "Work" label - MASSIVELY INCREASED SIZE
      if (showWorldCoords) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024; // 4x original width
        canvas.height = 512; // 4x original height
        const context = canvas.getContext('2d');
        context.fillStyle = themeColors.workCoord;
        context.font = 'Bold 384px Arial'; // 4x original font size
        context.fillText('Work', 40, 384); // Adjusted positions

        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({
          map: texture,
          transparent: true
        });
        const label = new THREE.Sprite(labelMaterial);
        label.position.set(
          workOrigin.x - length - 4.0 * sceneScale,
          workOrigin.y,
          workOrigin.z
        );
        label.scale.set(10.0 * sceneScale, 5.0 * sceneScale, 1); // 6x previous scale
        workAxesGroup.add(label);
      }

      // Add ruler tick marks for work axes (similar to world axes but with work colors)

      // X-axis ruler ticks for work axes
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
          color: new THREE.Color(themeColors.workCoord),
          linewidth: isMajorTick ? 2 : 1
        });

        const tick = new THREE.Line(tickGeometry, tickMaterial);
        workAxesGroup.add(tick);

        // Add label for major ticks
        if (isMajorTick) {
          const mmValue = i * 10; // Convert to mm
          const labelCanvas = document.createElement('canvas');
          labelCanvas.width = 512; // 8x original width
          labelCanvas.height = 256; // 8x original height
          const ctx = labelCanvas.getContext('2d');
          ctx.fillStyle = themeColors.workCoord;
          ctx.font = 'Bold 192px Arial'; // 8x original font size
          ctx.textAlign = 'center';
          ctx.fillText(mmValue.toString(), 256, 192); // Adjusted center positions

          const labelTexture = new THREE.CanvasTexture(labelCanvas);
          const labelMaterial = new THREE.SpriteMaterial({
            map: labelTexture,
            transparent: true
          });

          const label = new THREE.Sprite(labelMaterial);
          label.position.set(
            workOrigin.x - distance,
            workOrigin.y - tickOffset - currentTickLength - 2.0 * sceneScale,
            workOrigin.z
          );
          label.scale.set(4.0 * sceneScale, 2.0 * sceneScale, 1); // 8x original scale
          workAxesGroup.add(label);
        }
      }

      // Y-axis ruler ticks for work axes
      for (let i = 0; i <= Math.floor(length / tickSpacing); i++) {
        const distance = i * tickSpacing;
        const isMajorTick = i % majorTickEvery === 0;

        const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
        const tickGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(workOrigin.x - tickOffset, workOrigin.y + distance, workOrigin.z),
          new THREE.Vector3(workOrigin.x - tickOffset - currentTickLength, workOrigin.y + distance, workOrigin.z)
        ]);

        const tickMaterial = new THREE.LineBasicMaterial({
          color: new THREE.Color(themeColors.workCoord),
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
          ctx.fillStyle = themeColors.workCoord;
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
            workOrigin.x - tickOffset - currentTickLength - 0.3 * sceneScale,
            workOrigin.y + distance,
            workOrigin.z
          );
          label.scale.set(0.5 * sceneScale, 0.25 * sceneScale, 1);
          workAxesGroup.add(label);
        }
      }

      // Z-axis ruler ticks for work axes
      for (let i = 0; i <= Math.floor(length / tickSpacing); i++) {
        const distance = i * tickSpacing;
        const isMajorTick = i % majorTickEvery === 0;

        const currentTickLength = isMajorTick ? majorTickLength : minorTickLength;
        const tickGeometry = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(workOrigin.x - tickOffset, workOrigin.y - tickOffset, workOrigin.z + distance),
          new THREE.Vector3(workOrigin.x - tickOffset - currentTickLength, workOrigin.y - tickOffset, workOrigin.z + distance)
        ]);

        const tickMaterial = new THREE.LineBasicMaterial({
          color: new THREE.Color(themeColors.workCoord),
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
          ctx.fillStyle = themeColors.workCoord;
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
            workOrigin.x - tickOffset - currentTickLength - 0.3 * sceneScale,
            workOrigin.y - tickOffset,
            workOrigin.z + distance
          );
          label.scale.set(0.5 * sceneScale, 0.25 * sceneScale, 1);
          workAxesGroup.add(label);
        }
      }

      sceneRef.current.add(workAxesGroup);
      workAxesHelperRef.current = workAxesGroup;
    }
  }, [isGridVisible, showAxes, showWorkAxes, themeColors, gridDimensions, workOffset, sceneScale, showWorldCoords]);

  // Update toolpath visualization when parsedToolpath changes
  useEffect(() => {
    if (!toolpathVisualizerRef.current || !sceneRef.current || !parsedToolpath) return;

    if (showToolpath) {
      // Set transformation values to the visualizer
      toolpathVisualizerRef.current.setTransformValues(transformValues);

      // Set work offset to visualizer
      toolpathVisualizerRef.current.setWorkOffset(workOffset);

      // Visualize the toolpath
      toolpathVisualizerRef.current.visualize(parsedToolpath);
    } else {
      // Clear the toolpath visualization
      toolpathVisualizerRef.current.clear();
    }
  }, [parsedToolpath, showToolpath, transformValues, workOffset]);

  // Subscribe to position telemetry events
  useEffect(() => {
    // Handler for position telemetry
    const handlePositionTelemetry = (event) => {
      const data = event.detail;

      if (data && data.type === 'response' && data.data) {
        // Check if this is a status message in GRBL format: <status|MPos:x,y,z|...>
        if (data.data.startsWith('<') && data.data.includes('|MPos:')) {
          try {
            // Parse machine position (MPos)
            const mPosMatch = data.data.match(/MPos:([^,|]+),([^,|]+),([^,|]+)/);
            // Parse work coordinate offset (WCO)
            const wcoMatch = data.data.match(/WCO:([^,|]+),([^,|]+),([^,|]+)/);

            if (mPosMatch) {
              // Extract machine positions
              const worldX = parseFloat(mPosMatch[1]) || 0;
              const worldY = parseFloat(mPosMatch[2]) || 0;
              const worldZ = parseFloat(mPosMatch[3]) || 0;

              // For 3D viewer, invert X as needed by the coordinate system
              const newWorldPosition = {
                x: -worldX, // X is inverted in the 3D view
                y: worldY,
                z: worldZ,
                a: 0 // Default A axis
              };

              // Extract work coordinate offsets if available
              let wcoX = 0, wcoY = 0, wcoZ = 0;
              if (wcoMatch) {
                wcoX = parseFloat(wcoMatch[1]) || 0;
                wcoY = parseFloat(wcoMatch[2]) || 0;
                wcoZ = parseFloat(wcoMatch[3]) || 0;

                // Update work offset
                const newWorkOffset = {
                  x: wcoX,
                  y: wcoY,
                  z: wcoZ
                };

                // Only update if work offset has changed
                const hasWorkOffsetChanged =
                  newWorkOffset.x !== workOffset.x ||
                  newWorkOffset.y !== workOffset.y ||
                  newWorkOffset.z !== workOffset.z;

                if (hasWorkOffsetChanged) {
                  setWorkOffset(newWorkOffset);

                  // Update work axes position
                  updateAxesAndGrid();
                }
              }

              // Only update if position has changed
              const hasPositionChanged =
                newWorldPosition.x !== robotPosition.x ||
                newWorldPosition.y !== robotPosition.y ||
                newWorldPosition.z !== robotPosition.z;

              if (hasPositionChanged) {
                setRobotPosition(newWorldPosition);

                // Update the robot tool position in the 3D scene
                if (robotToolRef.current) {
                  updateRobotToolPosition(newWorldPosition);
                } else {
                  createRobotTool();
                }
              }
            }
          } catch (error) {
            console.error("Error parsing position telemetry:", error);
          }
        }
      }
    };

    // Listen for telemetry data
    document.addEventListener('serialdata', handlePositionTelemetry);

    return () => {
      document.removeEventListener('serialdata', handlePositionTelemetry);
    };
  }, [createRobotTool, updateRobotToolPosition, updateAxesAndGrid, robotPosition, workOffset]);

  // STL file import functions
  const handleImportClick = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileSelected = useCallback((event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Convert FileList to Array for easy manipulation
    const fileArray = Array.from(files);

    // Process each STL file
    fileArray.forEach(file => {
      // Only process STL files
      if (!file.name.toLowerCase().endsWith('.stl')) {
        console.warn(`File ${file.name} is not an STL file and will be skipped.`);
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        const fileContent = e.target.result;
        loadStlModel(file.name, fileContent);
      };

      reader.onerror = (e) => {
        console.error(`Error reading file ${file.name}:`, e);
      };

      // Read the file as an ArrayBuffer
      reader.readAsArrayBuffer(file);
    });

    // Reset the file input
    event.target.value = null;
  }, []);

  const loadStlModel = useCallback((fileName, fileContent) => {
    if (!sceneRef.current) return;

    const loader = new STLLoader();

    try {
      // Parse the STL file
      const geometry = loader.parse(fileContent);

      // Calculate original bounds before any transformations
      geometry.computeBoundingBox();
      const originalBoundingBox = geometry.boundingBox.clone();
      const size = originalBoundingBox.getSize(new THREE.Vector3());

      // Center the geometry at origin by calculating and applying center offset
      const center = new THREE.Vector3();
      originalBoundingBox.getCenter(center);
      geometry.translate(-center.x, -center.y, -center.z);

      // Create material for the STL model
      const material = new THREE.MeshStandardMaterial({
        color: themeColors.stlDefault,
        metalness: 0.2,
        roughness: 0.5,
        flatShading: true
      });

      // Create mesh from geometry and material
      const mesh = new THREE.Mesh(geometry, material);

      // Scale the model to fit in scene if needed
      let autoScale = 1.0;
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 5) { // if larger than 5 units
        autoScale = 5 / maxDim;
        mesh.scale.set(autoScale, autoScale, autoScale);
      }

      // Generate a unique ID for this STL file
      const fileId = `stl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      mesh.userData.fileId = fileId;
      mesh.userData.fileName = fileName;
      mesh.userData.originalSize = size.clone();

      // Position at origin since we've already centered the geometry
      mesh.position.set(0, 0, 0);

      // Add the mesh to the scene
      sceneRef.current.add(mesh);

      // Store reference to the mesh
      stlObjectsRef.current[fileId] = mesh;

      // Update the state with the new STL file info
      const newFile = {
        id: fileId,
        name: fileName,
        visible: true,
        position: [0, 0, 0], // Centered at origin
        rotation: [0, 0, 0], // Euler angles in degrees
        dimensions: size.toArray(),
        scale: autoScale,
        autoScale: autoScale, // Store the auto scale
        manualScale: false, // Flag for whether scale was manually adjusted
        boundingBox: {
          min: originalBoundingBox.min.toArray(),
          max: originalBoundingBox.max.toArray()
        }
      };

      // Update state with new file
      setStlFiles(prevFiles => [...prevFiles, newFile]);

      console.log(`Added STL file: ${fileName} with ID: ${fileId}`);

    } catch (error) {
      console.error(`Error loading STL model ${fileName}:`, error);
    }
  }, [themeColors]);

  // STL file management functions
  const toggleStlVisibility = useCallback((fileId) => {
    if (!stlObjectsRef.current[fileId]) return;

    // Toggle visibility
    const mesh = stlObjectsRef.current[fileId];
    mesh.visible = !mesh.visible;

    // Update state
    setStlFiles(prevFiles => prevFiles.map(file =>
      file.id === fileId
        ? { ...file, visible: mesh.visible }
        : file
    ));
  }, []);

  const removeStlFile = useCallback((fileId) => {
    if (!stlObjectsRef.current[fileId] || !sceneRef.current) return;

    // Remove from scene
    const mesh = stlObjectsRef.current[fileId];
    sceneRef.current.remove(mesh);

    // Dispose of geometry and material
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();

    // Remove from references
    delete stlObjectsRef.current[fileId];

    // Update state
    setStlFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));

    // If this was the hovered STL, clear the hover state
    if (hoveredStl === fileId) {
      setHoveredStl(null);
    }
  }, [hoveredStl]);

  const centerOnStl = useCallback((fileId) => {
    if (!stlObjectsRef.current[fileId] || !cameraRef.current || !controlsRef.current) return;

    const mesh = stlObjectsRef.current[fileId];
    const position = new THREE.Vector3();

    // Get world position
    mesh.getWorldPosition(position);

    // Set controls target to mesh position
    controlsRef.current.target.copy(position);
    controlsRef.current.update();
  }, []);

  const updateStlPosition = useCallback((fileId, axis, value) => {
    if (!stlObjectsRef.current[fileId]) return;

    const mesh = stlObjectsRef.current[fileId];
    const floatValue = parseFloat(value);

    if (isNaN(floatValue)) return;

    // Update the corresponding axis
    switch (axis) {
      case 'x':
        mesh.position.x = floatValue;
        break;
      case 'y':
        mesh.position.y = floatValue;
        break;
      case 'z':
        mesh.position.z = floatValue;
        break;
      default:
        break;
    }

    // Update state
    setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        const newPosition = [...file.position];
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        newPosition[axisIndex] = floatValue;
        return { ...file, position: newPosition };
      }
      return file;
    }));
  }, []);

  const updateStlRotation = useCallback((fileId, axis, value) => {
    if (!stlObjectsRef.current[fileId]) return;

    const mesh = stlObjectsRef.current[fileId];
    const floatValue = parseFloat(value);

    if (isNaN(floatValue)) return;

    // Convert degrees to radians for the corresponding axis
    const angleRad = THREE.MathUtils.degToRad(floatValue);

    // Update the corresponding axis
    switch (axis) {
      case 'x':
        mesh.rotation.x = angleRad;
        break;
      case 'y':
        mesh.rotation.y = angleRad;
        break;
      case 'z':
        mesh.rotation.z = angleRad;
        break;
      default:
        break;
    }

    // Update state
    setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        const newRotation = [...file.rotation];
        const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
        newRotation[axisIndex] = floatValue;
        return { ...file, rotation: newRotation };
      }
      return file;
    }));
  }, []);

  // New function to update STL scale
  const updateStlScale = useCallback((fileId, newScale) => {
    if (!stlObjectsRef.current[fileId]) return;

    const mesh = stlObjectsRef.current[fileId];
    const floatValue = parseFloat(newScale);

    if (isNaN(floatValue) || floatValue <= 0) return;

    // Update mesh scale
    mesh.scale.set(floatValue, floatValue, floatValue);

    // Update state
    setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        return {
          ...file,
          scale: floatValue,
          manualScale: true
        };
      }
      return file;
    }));
  }, []);

  const centerGeometryAtOrigin = useCallback((fileId) => {
    if (!stlObjectsRef.current[fileId]) return;

    const mesh = stlObjectsRef.current[fileId];

    // Store current rotation
    const currentRotation = new THREE.Euler().copy(mesh.rotation);

    // Reset rotation temporarily to compute accurate bounding box
    mesh.rotation.set(0, 0, 0);

    // Compute bounding box with zero rotation
    mesh.geometry.computeBoundingBox();
    const boundingBox = mesh.geometry.boundingBox;
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    // Translate geometry to center it at origin
    mesh.geometry.translate(-center.x, -center.y, -center.z);

    // Reset position to origin
    mesh.position.set(0, 0, 0);

    // Restore original rotation
    mesh.rotation.copy(currentRotation);

    // Update state
    setStlFiles(prevFiles => prevFiles.map(file => {
      if (file.id === fileId) {
        return {
          ...file,
          position: [0, 0, 0]
        };
      }
      return file;
    }));
  }, []);

  // Reset STL scale to original
  const resetStlScale = useCallback((fileId) => {
    if (!stlObjectsRef.current[fileId]) return;

    const file = stlFiles.find(f => f.id === fileId);
    if (!file) return;

    const mesh = stlObjectsRef.current[fileId];

    // Reset to auto scale
    mesh.scale.set(file.autoScale, file.autoScale, file.autoScale);

    // Update state
    setStlFiles(prevFiles => prevFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          scale: f.autoScale,
          manualScale: false
        };
      }
      return f;
    }));
  }, [stlFiles]);

  // Handle mousemove event for position tracking
  const handleMouseMove = useCallback((event) => {
    if (!mountRef.current || !raycasterRef.current || !cameraRef.current) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    // Objects that can be intersected
    const allSTLObjects = Object.values(stlObjectsRef.current);

    // Calculate intersections with STL objects
    const stlIntersections = raycasterRef.current.intersectObjects(allSTLObjects, false);

    // Clear hover state by default
    let shouldClearHover = true;

    if (stlIntersections.length > 0) {
      // We have intersected with an STL object
      const firstIntersection = stlIntersections[0];
      const intersectionPoint = firstIntersection.point;

      // Scale the intersection point back to world units (mm)
      const x = intersectionPoint.x / sceneScale;
      const y = intersectionPoint.y / sceneScale;
      const z = intersectionPoint.z / sceneScale;

      // Update mouse position display
      if (showMousePosition) {
        setMousePosition({ x, y, z });
      }

      // Update mouse indicator sphere position
      if (mouseIndicatorRef.current) {
        mouseIndicatorRef.current.position.copy(intersectionPoint);
        mouseIndicatorRef.current.visible = showMousePosition;
      }

      // Get the intersected object and its file ID
      const object = firstIntersection.object;
      const fileId = object.userData.fileId;

      if (fileId) {
        shouldClearHover = false; // Don't clear hover if we found a valid intersection

        // Only update if hovering a different object
        if (fileId !== hoveredStl) {
          // Reset previous hover styling
          if (hoveredStl && stlObjectsRef.current[hoveredStl]) {
            stlObjectsRef.current[hoveredStl].material.color = new THREE.Color(themeColors.stlDefault);
            stlObjectsRef.current[hoveredStl].material.emissive = new THREE.Color(0x000000);
          }

          // Apply hover styling
          if (stlObjectsRef.current[fileId]) {
            stlObjectsRef.current[fileId].material.color = new THREE.Color(themeColors.stlSelected);
            stlObjectsRef.current[fileId].material.emissive = new THREE.Color(0x222222);
          }

          setHoveredStl(fileId);
        }
      }
    }

    // If we didn't hit an STL object, check for grid plane intersection
    if (shouldClearHover && showMousePosition) {
      // Try to intersect with the grid plane
      if (gridPlaneRef.current) {
        const gridIntersections = raycasterRef.current.intersectObject(gridPlaneRef.current, false);

        if (gridIntersections.length > 0) {
          const intersectionPoint = gridIntersections[0].point;

          // Scale the intersection point back to world units (mm)
          const x = intersectionPoint.x / sceneScale;
          const y = intersectionPoint.y / sceneScale;
          const z = intersectionPoint.z / sceneScale;

          // Update position state
          setMousePosition({ x, y, z });

          // Update the mouse indicator sphere
          if (mouseIndicatorRef.current) {
            mouseIndicatorRef.current.position.copy(intersectionPoint);
            mouseIndicatorRef.current.visible = true;
          }
        } else if (mouseIndicatorRef.current) {
          // Hide the indicator if not intersecting
          mouseIndicatorRef.current.visible = false;
        }
      } else {
        // If there's no grid plane, try a fallback XY plane at Z=0
        const gridPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // XY plane
        const intersection = new THREE.Vector3();

        // Check if the ray intersects the plane
        if (raycasterRef.current.ray.intersectPlane(gridPlane, intersection)) {
          // Scale the intersection point back to world units (mm)
          const x = intersection.x / sceneScale;
          const y = intersection.y / sceneScale;
          const z = intersection.z / sceneScale;

          // Update position state
          setMousePosition({ x, y, z });

          // Update the mouse indicator sphere
          if (mouseIndicatorRef.current) {
            mouseIndicatorRef.current.position.copy(intersection);
            mouseIndicatorRef.current.visible = true;
          }
        } else if (mouseIndicatorRef.current) {
          // Hide the indicator if not intersecting
          mouseIndicatorRef.current.visible = false;
        }
      }
    }

    // Clear hover state if we're not hovering any STL object
    if (shouldClearHover && hoveredStl) {
      if (stlObjectsRef.current[hoveredStl]) {
        stlObjectsRef.current[hoveredStl].material.color = new THREE.Color(themeColors.stlDefault);
        stlObjectsRef.current[hoveredStl].material.emissive = new THREE.Color(0x000000);
      }
      setHoveredStl(null);
    }
  }, [showMousePosition, hoveredStl, themeColors, panelDimensions, sceneScale]);

  // Handle mouseout event
  const handleMouseOut = useCallback(() => {
    // Clear mouse position when leaving the 3D view
    setMousePosition({ x: 0, y: 0, z: 0 });

    // Hide the mouse indicator
    if (mouseIndicatorRef.current) {
      mouseIndicatorRef.current.visible = false;
    }

    // Reset hover state
    if (hoveredStl && stlObjectsRef.current[hoveredStl]) {
      stlObjectsRef.current[hoveredStl].material.color = new THREE.Color(themeColors.stlDefault);
      stlObjectsRef.current[hoveredStl].material.emissive = new THREE.Color(0x000000);
      setHoveredStl(null);
    }
  }, [hoveredStl, themeColors]);

  // Force clear all highlights - utility function
  const clearAllHighlights = useCallback(() => {
    if (hoveredStl && stlObjectsRef.current[hoveredStl]) {
      stlObjectsRef.current[hoveredStl].material.color = new THREE.Color(themeColors.stlDefault);
      stlObjectsRef.current[hoveredStl].material.emissive = new THREE.Color(0x000000);
      setHoveredStl(null);
    }

    // Also check all objects to ensure nothing remains highlighted
    Object.values(stlObjectsRef.current).forEach(obj => {
      if (obj && obj.material) {
        obj.material.color = new THREE.Color(themeColors.stlDefault);
        obj.material.emissive = new THREE.Color(0x000000);
      }
    });
  }, [hoveredStl, themeColors]);

  // Toggle mouse position display
  const toggleMousePosition = useCallback(() => {
    setShowMousePosition(!showMousePosition);
  }, [showMousePosition]);

  // Function to toggle perspective
  const togglePerspective = useCallback(() => {
    if (!cameraRef.current || !mountRef.current || !rendererRef.current) return;

    const currentCamera = cameraRef.current;
    const renderer = rendererRef.current;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const aspect = width / height;

    // Calculate distance from camera to origin
    const distance = currentCamera.position.length();

    // Toggle between perspective and orthographic cameras
    const newCamera = isPerspective
      ? new THREE.OrthographicCamera(
        -distance * aspect,
        distance * aspect,
        distance,
        -distance,
        -1000,
        1000
      )
      : new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

    // Copy position and lookAt
    newCamera.position.copy(currentCamera.position);
    newCamera.up.set(0, 0, 1);
    newCamera.lookAt(0, 0, 0);

    // Update global window camera
    window.parentCamera = newCamera;

    // Update controls
    const controls = new OrbitControls(newCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.object.up.set(0, 0, 1);
    controls.target.set(0, 0, 0);
    controls.update();

    // Update references
    cameraRef.current = newCamera;
    controlsRef.current = controls;

    // Toggle state
    setIsPerspective(!isPerspective);
  }, [isPerspective]);

  // Handle view changes from gizmo
  const handleViewChange = useCallback((view) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Reset camera
    const distance = 5;

    switch (view) {
      case 'top':
        camera.position.set(0, 0, distance);
        break;
      case 'front':
        camera.position.set(0, -distance, 0);
        break;
      case 'side':
        camera.position.set(distance, 0, 0);
        break;
      default:
        break;
    }

    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  }, []);

  // Handle grid dimension changes
  const handleGridDimensionChange = useCallback((e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue <= 0) return;

    setTempGridDimensions(prev => ({
      ...prev,
      [name]: numValue
    }));
  }, []);

  const applyGridDimensions = useCallback(() => {
    setGridDimensions(tempGridDimensions);
    setIsEditingGridDimensions(false);
  }, [tempGridDimensions]);

  useEffect(() => {
    // Trigger a resize event whenever stlFiles changes
    if (rendererRef.current && mountRef.current) {
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      // Update renderer size
      rendererRef.current.setSize(width, height);

      // Update camera aspect ratio
      if (cameraRef.current) {
        if (isPerspective) {
          cameraRef.current.aspect = width / height;
        } else {
          // For orthographic camera
          const frustumSize = 10;
          cameraRef.current.left = frustumSize * (width / height) / -2;
          cameraRef.current.right = frustumSize * (width / height) / 2;
          cameraRef.current.top = frustumSize / 2;
          cameraRef.current.bottom = frustumSize / -2;
        }
        cameraRef.current.updateProjectionMatrix();
      }

      // Force a window resize event to help Three.js recalculate
      window.dispatchEvent(new Event('resize'));
    }
  }, [stlFiles, isPerspective]);


  // Create and set up the scene
  const createScene = () => {
    if (!mountRef.current) return;

    // Clean up existing scene
    if (rendererRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeColors.background);
    sceneRef.current = scene;

    // Calculate dimensions
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const aspect = width / height;

    // Create perspective camera
    const perspectiveCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    perspectiveCamera.position.set(5, 5, 5);
    perspectiveCamera.up.set(0, 0, 1); // Z is up
    perspectiveCamera.lookAt(0, 0, 0);

    // Create orthographic camera
    const frustumSize = gridDimensions.width > gridDimensions.height
      ? gridDimensions.width * sceneScale * 1.1
      : gridDimensions.height * sceneScale * 1.1;

    const gridMidpointX = -gridDimensions.width * sceneScale / 2;
    const gridMidpointY = gridDimensions.height * sceneScale / 2;
    const gridMidpoint = new THREE.Vector3(gridMidpointX, gridMidpointY, 0);

    const orthographicCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      -10,
      1000
    );
    orthographicCamera.position.copy(gridMidpoint).add(new THREE.Vector3(0, 0.0001, 10));
    orthographicCamera.up.set(0, 0, 1);
    orthographicCamera.lookAt(gridMidpoint);

    // Set initial camera based on projection type
    cameraRef.current = isPerspective ? perspectiveCamera : orthographicCamera;
    window.parentCamera = cameraRef.current;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add mouse event listeners to the renderer domElement
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseout', handleMouseOut);
    renderer.domElement.addEventListener('mouseleave', handleMouseOut);

    // Add clear highlight on click
    renderer.domElement.addEventListener('click', clearAllHighlights);

    // Orbit controls
    const controls = new OrbitControls(cameraRef.current, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.object.up.set(0, 0, 1);
    controls.target.copy(gridMidpoint);
    controls.update();

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Add grid and axes
    updateAxesAndGrid();

    // Explicitly force robot tool creation regardless of position data
    // to ensure it's always visible
    robotToolRef.current = null; // Reset in case it exists
    createRobotTool();

    // Create mouse position indicator sphere
    const sphereGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      depthTest: true
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.visible = false; // Hidden by default
    scene.add(sphere);
    mouseIndicatorRef.current = sphere;

    // Initialize toolpath visualizer
    toolpathVisualizerRef.current = new ToolpathVisualizer(scene);
    toolpathVisualizerRef.current.scale = sceneScale; // Set proper scale
    toolpathVisualizerRef.current.setWorkOffset(workOffset);

    // If we already have a toolpath, visualize it
    if (parsedToolpath && showToolpath) {
      toolpathVisualizerRef.current.visualize(parsedToolpath);
    }

    return scene;
  };

  const initializeScene = useCallback(() => {
    const scene = createScene();
    if (!scene || !mountRef.current) return;

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      const aspect = width / height;

      if (isPerspective) {
        const perspCamera = cameraRef.current;
        perspCamera.aspect = aspect;
        perspCamera.updateProjectionMatrix();
      } else {
        const orthoCamera = cameraRef.current;
        const frustumSize = 10;
        orthoCamera.left = frustumSize * aspect / -2;
        orthoCamera.right = frustumSize * aspect / 2;
        orthoCamera.top = frustumSize / 2;
        orthoCamera.bottom = frustumSize / -2;
        orthoCamera.updateProjectionMatrix();
      }

      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Force create robot tool to ensure it exists
    setTimeout(() => {
      if (!robotToolRef.current) {
        createRobotTool();
        console.log("Forced creation of robot tool on scene init");
      }
    }, 100);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Render scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      // Cleanup
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current?.domElement) {
        rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove);
        rendererRef.current.domElement.removeEventListener('mouseout', handleMouseOut);
        rendererRef.current.domElement.removeEventListener('mouseleave', handleMouseOut);
        rendererRef.current.domElement.removeEventListener('click', clearAllHighlights);
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isPerspective, handleMouseMove, handleMouseOut, createRobotTool, clearAllHighlights, updateAxesAndGrid, workOffset, sceneScale, parsedToolpath, showToolpath]);

  // Trigger scene initialization only once on mount
  useEffect(() => {
    const cleanup = initializeScene();

    // Add a click handler to document to clear highlights when clicking outside
    const handleDocumentClick = (e) => {
      // If click is outside the 3D canvas
      if (mountRef.current && !mountRef.current.contains(e.target)) {
        clearAllHighlights();
      }
    };

    document.addEventListener('click', handleDocumentClick);

    return () => {
      if (cleanup) cleanup();
      document.removeEventListener('click', handleDocumentClick);
    };
  }, []); // Empty dependency array to only run once on mount

  // Update when grid dimensions change
  useEffect(() => {
    if (updateAxesAndGrid) {
      updateAxesAndGrid();
    }
  }, [gridDimensions, updateAxesAndGrid]);

  return (
    <div className="panel-content">
      <div className="panel-header" style={{ flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={showAxes}
                onChange={() => setShowAxes(!showAxes)}
                style={{ margin: 0 }}
              />
              World Axes
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={showWorkAxes}
                onChange={() => setShowWorkAxes(!showWorkAxes)}
                style={{ margin: 0 }}
              />
              Work Axes
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={isGridVisible}
                onChange={() => setIsGridVisible(!isGridVisible)}
                style={{ margin: 0 }}
              />
              Grid
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={showToolpath}
                onChange={() => setShowToolpath(!showToolpath)}
                style={{ margin: 0 }}
              />
              Toolpath
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={showMousePosition}
                onChange={toggleMousePosition}
                style={{ margin: 0 }}
              />
              Show Coordinates
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
            <button
              className={`toolbar-button ${!isPerspective ? 'primary' : ''}`}
              onClick={togglePerspective}
              title="Orthographic View"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Ortho
            </button>
            <button
              className={`toolbar-button ${isPerspective ? 'primary' : ''}`}
              onClick={togglePerspective}
              title="Perspective View"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Persp
            </button>
            <button
              className="toolbar-button"
              onClick={handleImportClick}
              title="Import STL file"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Import STL
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".stl"
              multiple
              onChange={handleFileSelected}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
          {/* Workspace size controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <span>Workspace:</span>
            {isEditingGridDimensions ? (
              <>
                <input
                  type="number"
                  name="width"
                  value={tempGridDimensions.width}
                  onChange={handleGridDimensionChange}
                  style={{ width: '60px', padding: '2px', fontSize: '12px' }}
                />
                <span>×</span>
                <input
                  type="number"
                  name="height"
                  value={tempGridDimensions.height}
                  onChange={handleGridDimensionChange}
                  style={{ width: '60px', padding: '2px', fontSize: '12px' }}
                />
                <span>mm</span>
                <button
                  onClick={applyGridDimensions}
                  style={{ padding: '2px 5px', fontSize: '10px' }}
                >
                  Apply
                </button>
                <button
                  onClick={() => setIsEditingGridDimensions(false)}
                  style={{ padding: '2px 5px', fontSize: '10px' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span>{gridDimensions.width} × {gridDimensions.height} mm</span>
                <button
                  onClick={() => {
                    setTempGridDimensions(gridDimensions);
                    setIsEditingGridDimensions(true);
                  }}
                  style={{ padding: '2px 5px', fontSize: '10px' }}
                >
                  Edit
                </button>
              </>
            )}
          </div>
        </div>

        <div className="robot-position-display" style={{
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '8px',
          marginTop: '8px',
          width: '100%'
        }}>
          {/* World coordinates */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0,0,0,0.1)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            <span style={{ color: themeColors.worldCoord, fontWeight: 'bold' }}>World:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: themeColors.xAxis }}>X:</span>
              <span>{robotPosition.x.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: themeColors.yAxis }}>Y:</span>
              <span>{robotPosition.y.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: themeColors.zAxis }}>Z:</span>
              <span>{robotPosition.z.toFixed(2)}</span>
            </div>
            {robotPosition.a !== undefined && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ color: themeColors.robotPosition }}>A:</span>
                <span>{robotPosition.a.toFixed(2)}°</span>
              </div>
            )}
          </div>

          {/* Work coordinates */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0,0,0,0.1)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            <span style={{ color: themeColors.workCoord, fontWeight: 'bold' }}>Work:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: themeColors.xAxis }}>X:</span>
              <span>{(robotPosition.x - workOffset.x).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: themeColors.yAxis }}>Y:</span>
              <span>{(robotPosition.y - workOffset.y).toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ color: themeColors.zAxis }}>Z:</span>
              <span>{(robotPosition.z - workOffset.z).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={viewerContainerStyle}>
        {/* Main 3D viewport */}
        <div style={viewportStyle}>
          <div
            ref={mountRef}
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: themeColors.background,
              borderRadius: 'var(--border-radius)',
              overflow: 'hidden',
              position: 'relative'
            }}
          />

          {showMousePosition && (
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                right: '10px',
                padding: '8px 12px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: 'var(--border-radius)',
                color: 'white',
                fontSize: '12px',
                fontFamily: 'monospace',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <span style={{ color: themeColors.xAxis }}>X:</span>
                <span>{mousePosition.x.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <span style={{ color: themeColors.yAxis }}>Y:</span>
                <span>{mousePosition.y.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                <span style={{ color: themeColors.zAxis }}>Z:</span>
                <span>{mousePosition.z.toFixed(2)}</span>
              </div>
            </div>
          )}

          <Gizmo onViewChange={handleViewChange} />
        </div>

        {/* STL Files Panel - Only visible when files exist */}
        {stlFiles.length > 0 && (
          <div style={stlPanelStyle}>
            <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>Imported STL Files</h3>
            </div>
            <div style={{ padding: '8px', flexGrow: 1, overflowY: 'auto' }}>
              {stlFiles.map((file) => (
                <div
                  key={file.id}
                  style={{
                    marginBottom: '8px',
                    padding: '8px',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: hoveredStl === file.id ? 'var(--hover-bg-color)' : 'transparent',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{
                      fontWeight: 'bold',
                      fontSize: '12px',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.name}
                    </div>
                    <input
                      type="checkbox"
                      checked={file.visible}
                      onChange={() => toggleStlVisibility(file.id)}
                      style={{ margin: 0 }}
                    />
                  </div>

                  {/* Position Controls */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Position (mm)</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.xAxis }}>X:</label>
                      <input
                        type="number"
                        value={file.position[0]}
                        onChange={(e) => updateStlPosition(file.id, 'x', e.target.value)}
                        step="1"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.yAxis }}>Y:</label>
                      <input
                        type="number"
                        value={file.position[1]}
                        onChange={(e) => updateStlPosition(file.id, 'y', e.target.value)}
                        step="1"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.zAxis }}>Z:</label>
                      <input
                        type="number"
                        value={file.position[2]}
                        onChange={(e) => updateStlPosition(file.id, 'z', e.target.value)}
                        step="1"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Rotation Controls */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Rotation (degrees)</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.xAxis }}>X:</label>
                      <input
                        type="number"
                        value={file.rotation[0]}
                        onChange={(e) => updateStlRotation(file.id, 'x', e.target.value)}
                        step="5"
                        min="-180"
                        max="180"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.yAxis }}>Y:</label>
                      <input
                        type="number"
                        value={file.rotation[1]}
                        onChange={(e) => updateStlRotation(file.id, 'y', e.target.value)}
                        step="5"
                        min="-180"
                        max="180"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.zAxis }}>Z:</label>
                      <input
                        type="number"
                        value={file.rotation[2]}
                        onChange={(e) => updateStlRotation(file.id, 'z', e.target.value)}
                        step="5"
                        min="-180"
                        max="180"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Scale Controls */}
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Scale</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <input
                        type="number"
                        value={file.scale}
                        onChange={(e) => updateStlScale(file.id, e.target.value)}
                        step="0.1"
                        min="0.1"
                        style={{
                          flex: 1,
                          fontSize: '10px',
                          padding: '2px 4px',
                          borderRadius: '2px',
                          border: '1px solid var(--border-color)'
                        }}
                      />
                      <button
                        onClick={() => resetStlScale(file.id)}
                        disabled={!file.manualScale}
                        style={{
                          padding: '2px 4px',
                          fontSize: '10px',
                          opacity: file.manualScale ? 1 : 0.5
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', fontSize: '11px' }}>
                    <button
                      className="toolbar-button"
                      onClick={() => centerOnStl(file.id)}
                      style={{ padding: '2px 4px', fontSize: '10px', flex: 1 }}
                    >
                      Center View
                    </button>
                    <button
                      className="toolbar-button"
                      onClick={() => centerGeometryAtOrigin(file.id)}
                      style={{ padding: '2px 4px', fontSize: '10px', flex: 1 }}
                    >
                      Center Object
                    </button>
                    <button
                      className="toolbar-button danger"
                      onClick={() => removeStlFile(file.id)}
                      style={{ padding: '2px 4px', fontSize: '10px', flex: 1 }}
                    >
                      Remove
                    </button>
                  </div>

                  {/* Size info */}
                  {file.dimensions && (
                    <div style={{ marginTop: '6px', fontSize: '10px', opacity: 0.8 }}>
                      Size: {(file.dimensions[0] * file.scale).toFixed(1)} × {(file.dimensions[1] * file.scale).toFixed(1)} × {(file.dimensions[2] * file.scale).toFixed(1)} mm
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Viewer3DPanel;