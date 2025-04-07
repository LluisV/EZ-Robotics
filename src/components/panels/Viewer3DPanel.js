import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { useGCode } from '../../contexts/GCodeContext';
import ToolpathVisualizer from '../../utils/ToolpathVisualizer';
import Gizmo from './Gizmo';
import communicationService from '../../services/communication/CommunicationService';

// Theme colors object with theme-specific hardcoded values
const getThemeColors = () => {
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
    robotPosition: '#ffaa00'
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
  } else if (themeClass.includes('theme-visual-studio')) {
    colors.background = '#1e1e1e';
    colors.gridPrimary = '#3f3f3f';
    colors.gridSecondary = '#2d2d2d';
  } else if (themeClass.includes('theme-dracula')) {
    colors.background = '#282a36';
    colors.gridPrimary = '#44475a';
    colors.gridSecondary = '#383a4c';
    colors.xAxis = '#ff5555';
    colors.yAxis = '#50fa7b';
    colors.zAxis = '#8be9fd';
    colors.robotPosition = '#ffb86c';
  }
  
  return colors;
};

const Viewer3DPanel = ({ showAxes: initialShowAxes = true }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const gridHelperRef = useRef(null);
  const axesHelperRef = useRef(null);
  const toolpathVisualizerRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const robotToolRef = useRef(null);
  const mouseIndicatorRef = useRef(null);

  // Get toolpath data from the GCode context
  const { parsedToolpath, selectedLine } = useGCode();

  // State for view and projection
  const [isPerspective, setIsPerspective] = useState(true);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [showAxes, setShowAxes] = useState(initialShowAxes);
  const [themeColors, setThemeColors] = useState(getThemeColors());
  const [showToolpath, setShowToolpath] = useState(true);
  const [showMousePosition, setShowMousePosition] = useState(true);
  
  // State for robot position
  const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, z: 0 });

  // Update when the initialShowAxes prop changes
  useEffect(() => {
    setShowAxes(initialShowAxes);
  }, [initialShowAxes]);

  // Theme change observer
  useEffect(() => {
    // Function to update colors when theme changes
    const updateThemeColors = () => {
      const newColors = getThemeColors();
      setThemeColors(newColors);
      
      // Update scene background if it exists
      if (sceneRef.current) {
        sceneRef.current.background = new THREE.Color(newColors.background);
      }
      
      // Update grid helper if it exists
      if (gridHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(gridHelperRef.current);
        
        if (isGridVisible) {
          const gridHelper = new THREE.GridHelper(10, 10, 
            new THREE.Color(newColors.gridPrimary), 
            new THREE.Color(newColors.gridSecondary)
          );
          gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
          gridHelper.name = 'grid';
          sceneRef.current.add(gridHelper);
          gridHelperRef.current = gridHelper;
        }
      }
      
      // Update axes helper if it exists
      if (axesHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(axesHelperRef.current);
        
        if (showAxes) {
          // Create custom axes with themed colors
          const origin = new THREE.Vector3(0, 0, 0);
          const length = 5;
          
          const axesGroup = new THREE.Group();
          axesGroup.name = 'axes';
          
          // X axis (red)
          const xAxis = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            origin,
            length,
            new THREE.Color(newColors.xAxis),
            0.2,
            0.1
          );
          
          // Y axis (green)
          const yAxis = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            origin,
            length,
            new THREE.Color(newColors.yAxis),
            0.2,
            0.1
          );
          
          // Z axis (blue)
          const zAxis = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            origin,
            length,
            new THREE.Color(newColors.zAxis),
            0.2,
            0.1
          );
          
          axesGroup.add(xAxis);
          axesGroup.add(yAxis);
          axesGroup.add(zAxis);
          
          sceneRef.current.add(axesGroup);
          axesHelperRef.current = axesGroup;
        }
      }
      
      // Update robot position indicator if it exists
      if (robotToolRef.current) {
        if (robotToolRef.current.material) {
          robotToolRef.current.material.color = new THREE.Color(newColors.robotPosition);
        }
      }
    };

    // Create a MutationObserver to watch for class changes on document.documentElement
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class' || mutation.attributeName === 'style') {
          updateThemeColors();
        }
      });
    });

    // Start observing the document with the configured parameters
    observer.observe(document.documentElement, { attributes: true });

    // Initial update
    updateThemeColors();

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [isGridVisible, showAxes]);

  // Update toolpath visualization when parsedToolpath changes
  useEffect(() => {
    if (!toolpathVisualizerRef.current || !sceneRef.current || !parsedToolpath) return;
    
    if (showToolpath) {
      // Visualize the toolpath
      const bounds = toolpathVisualizerRef.current.visualize(parsedToolpath);
      
      // Focus camera on the toolpath if we have bounds
      if (bounds && controlsRef.current && cameraRef.current) {
        // centerCameraOnBounds(bounds);
      }
    } else {
      // Clear the toolpath visualization
      toolpathVisualizerRef.current.clear();
    }
  }, [parsedToolpath, showToolpath]);

  // Highlight specific line in the toolpath
  useEffect(() => {
    if (!toolpathVisualizerRef.current || selectedLine < 0) return;
    
    toolpathVisualizerRef.current.highlightLine(selectedLine);
  }, [selectedLine]);

  // Subscribe to position telemetry events
  useEffect(() => {
    // Handler for position telemetry
    const handlePositionTelemetry = (data) => {
      if (typeof data.response === 'string' && data.response.startsWith('[TELEMETRY][POS]')) {
        // Parse the telemetry data
        const posRegex = /\[TELEMETRY\]\[POS\]\s*X:?\s*([-+]?\d+\.?\d*)\s*Y:?\s*([-+]?\d+\.?\d*)\s*Z:?\s*([-+]?\d+\.?\d*)(?:\s*A:?\s*([-+]?\d+\.?\d*))?/i;
        const match = data.response.match(posRegex);
        
        if (match) {
          // Extract the position data
          const newPosition = {
            x: parseFloat(match[1]),
            y: parseFloat(match[2]),
            z: parseFloat(match[3]),
            a: match[4] !== undefined ? parseFloat(match[4]) : 0
          };
          
          // Update the state
          setRobotPosition(newPosition);
          
          // Update the robot tool position in the 3D scene
          if (robotToolRef.current) {
            robotToolRef.current.position.x = newPosition.x * 0.1; // Apply scale factor
            robotToolRef.current.position.y = newPosition.y * 0.1;
            robotToolRef.current.position.z = newPosition.z * 0.1;
            
            // Update rotation based on A axis
            if (newPosition.a !== undefined) {
              robotToolRef.current.rotation.z = newPosition.a * Math.PI / 180;
            }
          }
        }
      }
    };
    
    // Register event listener
    communicationService.on('position-telemetry', handlePositionTelemetry);
    
    // Cleanup
    return () => {
      communicationService.removeListener('position-telemetry', handlePositionTelemetry);
    };
  }, []);

  // Create robot position indicator
  const createRobotTool = useCallback(() => {
    if (!sceneRef.current) return;
    
    // Remove existing tool if any
    if (robotToolRef.current) {
      sceneRef.current.remove(robotToolRef.current);
    }
    
    // Create a group for the robot tool
    const toolGroup = new THREE.Group();
    toolGroup.name = 'robot-tool';
    
    // Create a cylindrical body
    const bodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16);
    const bodyMaterial = new THREE.MeshBasicMaterial({ color: themeColors.robotPosition });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.x = Math.PI / 2; // Align with Z axis
    body.position.z = 0.3; // Move up half of its height
    
    // Create a conical tip
    const tipGeometry = new THREE.ConeGeometry(0.08, 0.15, 16);
    const tipMaterial = new THREE.MeshBasicMaterial({ color: themeColors.robotPosition });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.rotation.x = -Math.PI / 2; // Align with Z axis, point forward
    tip.position.z = 0.075; // Position at the top of the body
    
    // Add body and tip to the group
    toolGroup.add(body);
    toolGroup.add(tip);
    
    // Set initial position
    toolGroup.position.set(
      robotPosition.x * 0.1, 
      robotPosition.y * 0.1, 
      robotPosition.z * 0.1
    );
    
    // Add to the scene
    sceneRef.current.add(toolGroup);
    robotToolRef.current = toolGroup;
    
  }, [robotPosition, themeColors]);

  // Handle mousemove event for position tracking
  const handleMouseMove = useCallback((event) => {
    if (!mountRef.current || !raycasterRef.current || !cameraRef.current || !showMousePosition) return;
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update the picking ray
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    
    // Calculate objects intersecting the ray - we're only interested in the grid plane
    const gridPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // XY plane
    const intersection = new THREE.Vector3();
    
    // Check if the ray intersects the plane
    if (raycasterRef.current.ray.intersectPlane(gridPlane, intersection)) {
      // Scale the intersection point back to world units
      const scale = 10; // Assuming grid is 10x10
      const x = intersection.x * scale;
      const y = intersection.y * scale;
      const z = intersection.z * scale;
      
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
  }, [showMousePosition]);

  // Handle mouseout event
  const handleMouseOut = useCallback(() => {
    // Clear mouse position when leaving the 3D view
    setMousePosition({ x: 0, y: 0, z: 0 });
    
    // Hide the mouse indicator
    if (mouseIndicatorRef.current) {
      mouseIndicatorRef.current.visible = false;
    }
  }, []);

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
          -10, 
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

  // Create and set up the scene
  const initializeScene = useCallback(() => {
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
    const frustumSize = 10;
    const orthographicCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, 
      frustumSize * aspect / 2, 
      frustumSize / 2, 
      frustumSize / -2, 
      -10, 
      1000
    );
    orthographicCamera.position.set(5, 5, 5);
    orthographicCamera.up.set(0, 0, 1); // Z is up
    orthographicCamera.lookAt(0, 0, 0);

    // Set initial camera based on projection type
    cameraRef.current = isPerspective ? perspectiveCamera : orthographicCamera;
    window.parentCamera = cameraRef.current;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add mouse move event listener to the renderer domElement
    renderer.domElement.addEventListener('mousemove', handleMouseMove);
    renderer.domElement.addEventListener('mouseout', handleMouseOut);

    // Orbit controls
    const controls = new OrbitControls(cameraRef.current, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.object.up.set(0, 0, 1);
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Add grid
    if (isGridVisible) {
      const gridHelper = new THREE.GridHelper(10, 10, 
        new THREE.Color(themeColors.gridPrimary), 
        new THREE.Color(themeColors.gridSecondary)
      );
      gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
      gridHelper.name = 'grid';
      scene.add(gridHelper);
      gridHelperRef.current = gridHelper;
    }

    // Add axes helper
    if (showAxes) {
      // Create custom axes with themed colors
      const origin = new THREE.Vector3(0, 0, 0);
      const length = 5;
      
      const axesGroup = new THREE.Group();
      axesGroup.name = 'axes';
      
      // X axis (red)
      const xAxis = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0),
        origin,
        length,
        new THREE.Color(themeColors.xAxis),
        0.2,
        0.1
      );
      
      // Y axis (green)
      const yAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        origin,
        length,
        new THREE.Color(themeColors.yAxis),
        0.2,
        0.1
      );
      
      // Z axis (blue)
      const zAxis = new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1),
        origin,
        length,
        new THREE.Color(themeColors.zAxis),
        0.2,
        0.1
      );
      
      axesGroup.add(xAxis);
      axesGroup.add(yAxis);
      axesGroup.add(zAxis);
      
      scene.add(axesGroup);
      axesHelperRef.current = axesGroup;
    }

    // Create robot position indicator
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
    
    // If we already have a toolpath, visualize it
    if (parsedToolpath && showToolpath) {
      toolpathVisualizerRef.current.visualize(parsedToolpath);
    }

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
      }
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isGridVisible, showAxes, isPerspective, themeColors, parsedToolpath, showToolpath, handleMouseMove, handleMouseOut, createRobotTool]);

  // Trigger scene initialization 
  useEffect(() => {
    const cleanup = initializeScene();
    return cleanup;
  }, [initializeScene]);

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input 
                type="checkbox" 
                checked={showAxes} 
                onChange={() => setShowAxes(!showAxes)} 
                style={{ margin: 0 }}
              /> 
              Axes
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
          </div>
        </div>
        
        <div className="robot-position-display" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
      </div>
      
      <div style={{ position: 'relative', height: 'calc(100% - 40px)' }}>
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
    </div>
  );
};

export default Viewer3DPanel;