import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
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
    robotPosition: '#ffaa00',
    stlDefault: '#d9eaff',
    stlSelected: '#ffcc66'
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
  } else if (themeClass.includes('theme-visual-studio')) {
    colors.background = '#1e1e1e';
    colors.gridPrimary = '#3f3f3f';
    colors.gridSecondary = '#2d2d2d';
    colors.stlDefault = '#569cd6';
    colors.stlSelected = '#ce9178';
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
  const fileInputRef = useRef(null);
  
  // Get toolpath data from the GCode context
  const { parsedToolpath, selectedLine, transformValues } = useGCode();

  // State for view and projection
  const [isPerspective, setIsPerspective] = useState(true);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [showAxes, setShowAxes] = useState(initialShowAxes);
  const [themeColors, setThemeColors] = useState(getThemeColors());
  const [showToolpath, setShowToolpath] = useState(true);
  const [showMousePosition, setShowMousePosition] = useState(true);
  const [panelDimensions, setPanelDimensions] = useState({ width: 0, height: 0 });

  // State for robot position
  const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, z: 0 });
  
  // State for STL files
  const [stlFiles, setStlFiles] = useState([]);
  const [hoveredStl, setHoveredStl] = useState(null);
  const stlObjectsRef = useRef({});

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
    
    // Update grid visibility
    if (gridHelperRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      gridHelperRef.current = null;
    }
    
    if (isGridVisible) {
      const gridHelper = new THREE.GridHelper(10, 10, 
        new THREE.Color(themeColors.gridPrimary), 
        new THREE.Color(themeColors.gridSecondary)
      );
      gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
      gridHelper.name = 'grid';
      sceneRef.current.add(gridHelper);
      gridHelperRef.current = gridHelper;
    }
    
    // Update axes visibility
    if (axesHelperRef.current) {
      sceneRef.current.remove(axesHelperRef.current);
      axesHelperRef.current = null;
    }
    
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
      
      sceneRef.current.add(axesGroup);
      axesHelperRef.current = axesGroup;
    }
  }, [isGridVisible, showAxes, themeColors]);

  // Update toolpath visualization when parsedToolpath changes
  useEffect(() => {
    if (!toolpathVisualizerRef.current || !sceneRef.current || !parsedToolpath) return;
    
    if (showToolpath) {
      // Set transformation values to the visualizer
      toolpathVisualizerRef.current.setTransformValues(transformValues);
      
      // Visualize the toolpath
      toolpathVisualizerRef.current.visualize(parsedToolpath);
    } else {
      // Clear the toolpath visualization
      toolpathVisualizerRef.current.clear();
    }
  }, [parsedToolpath, showToolpath, transformValues]); // Add transformValues to dependencies
  
  // Sync mesh positions and rotations with state
  useEffect(() => {
    console.log("STL files updated:", stlFiles.length);
    
    // Update mesh positions and rotations
    stlFiles.forEach(file => {
      const mesh = stlObjectsRef.current[file.id];
      if (mesh) {
        // Update position
        mesh.position.set(file.position[0], file.position[1], file.position[2]);
        
        // Update rotation - convert degrees to radians
        mesh.rotation.set(
          THREE.MathUtils.degToRad(file.rotation[0]),
          THREE.MathUtils.degToRad(file.rotation[1]),
          THREE.MathUtils.degToRad(file.rotation[2])
        );
      }
    });
    
    // Force re-render when stlFiles changes to ensure panel visibility
    if (stlFiles.length > 0) {
      // Ensure highlighting is reset
      if (hoveredStl && stlObjectsRef.current[hoveredStl]) {
        stlObjectsRef.current[hoveredStl].material.color = new THREE.Color(themeColors.stlDefault);
        stlObjectsRef.current[hoveredStl].material.emissive = new THREE.Color(0x000000);
        setHoveredStl(null);
      }
    }
  }, [stlFiles, hoveredStl, themeColors]);

  // Highlight specific line in the toolpath
  useEffect(() => {
    if (!toolpathVisualizerRef.current || selectedLine < 0) return;
    
    toolpathVisualizerRef.current.highlightLine(selectedLine);
  }, [selectedLine]);

  // Subscribe to position telemetry events
  useEffect(() => {
    // Handler for position telemetry
    const handlePositionTelemetry = (data) => {
      if (typeof data.response === 'string' && data.response.startsWith('[TELEMETRY]')) {
        try {
          // Check if it's the new JSON format
          if (data.response.includes('{"work":') || data.response.includes('{"world":')) {
            // Extract the JSON part
            const jsonStart = data.response.indexOf('{');
            if (jsonStart === -1) return;
            
            const jsonString = data.response.substring(jsonStart);
            const parsedData = JSON.parse(jsonString);
            
            // Use work coordinates by default
            if (parsedData.work) {
              const newPosition = {
                x: parseFloat(parsedData.work.X) || 0,
                y: parseFloat(parsedData.work.Y) || 0,
                z: parseFloat(parsedData.work.Z) || 0,
                a: parseFloat(parsedData.work.A) || 0
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
          } else {
            // Handle old format with regex
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
        } catch (error) {
          console.error("Error parsing position telemetry:", error);
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
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 5) { // if larger than 5 units
        const scale = 5 / maxDim;
        mesh.scale.set(scale, scale, scale);
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
        scale: maxDim > 5 ? 5 / maxDim : 1,
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
    switch(axis) {
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
    switch(axis) {
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
      
      // Scale the intersection point back to world units
      const x = intersectionPoint.x * 10;
      const y = intersectionPoint.y * 10;
      const z = intersectionPoint.z * 10;
      
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
    
    // Clear hover state if we're not hovering any STL object
    if (shouldClearHover && hoveredStl) {
      if (stlObjectsRef.current[hoveredStl]) {
        stlObjectsRef.current[hoveredStl].material.color = new THREE.Color(themeColors.stlDefault);
        stlObjectsRef.current[hoveredStl].material.emissive = new THREE.Color(0x000000);
      }
      setHoveredStl(null);
    }
    
    // If we didn't hit an STL object, check for grid plane intersection
    if (shouldClearHover && showMousePosition) {
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
    }
  }, [showMousePosition, hoveredStl, themeColors, panelDimensions]);

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
  }, [isPerspective, handleMouseMove, handleMouseOut, createRobotTool, clearAllHighlights]);

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
                    <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Position</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ width: '12px', fontSize: '10px', color: themeColors.xAxis }}>X:</label>
                      <input 
                        type="number" 
                        value={file.position[0]} 
                        onChange={(e) => updateStlPosition(file.id, 'x', e.target.value)}
                        step="0.1"
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
                        step="0.1"
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
                        step="0.1"
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
                      Size: {file.dimensions[0].toFixed(1)} x {file.dimensions[1].toFixed(1)} x {file.dimensions[2].toFixed(1)}
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