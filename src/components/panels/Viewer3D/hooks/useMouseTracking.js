import { useEffect, useCallback, useState, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hook to handle mouse tracking and intersection detection in the 3D scene
 * Provides accurate workspace coordinates through raycasting
 * Simplified version with only projection lines setting
 * 
 * @param {Object} props Configuration options
 * @param {React.RefObject} props.containerRef Reference to container element
 * @param {React.RefObject} props.raycasterRef Reference to THREE.Raycaster
 * @param {React.RefObject} props.mouseRef Reference to mouse position
 * @param {React.RefObject} props.cameraRef Reference to camera
 * @param {React.RefObject} props.mouseIndicatorRef Reference to mouse indicator sphere
 * @param {React.RefObject} props.sceneRef Reference to THREE scene
 * @param {Array} props.stlFiles Array of STL file objects
 * @param {Function} props.setMousePosition Function to update mouse position state
 * @param {number} props.sceneScale Scene scale factor
 * @param {boolean} props.showMousePosition Whether to show mouse position
 * @param {React.RefObject} props.gridPlaneRef Reference to grid plane for intersection
 * @param {Object} props.indicatorSettings Indicator appearance settings
 * @returns {Object} Mouse tracking utilities
 */
const useMouseTracking = ({
  containerRef,
  raycasterRef,
  mouseRef,
  cameraRef,
  mouseIndicatorRef,
  sceneRef,
  stlFiles,
  setMousePosition,
  sceneScale,
  showMousePosition,
  gridPlaneRef,
  indicatorSettings
}) => {
  const [hoveredStl, setHoveredStl] = useState(null);
  const [stlObjects, setStlObjects] = useState({});
  const [lastGridPosition, setLastGridPosition] = useState({ x: 0, y: 0, z: 0 });
  const [isMouseOverScene, setIsMouseOverScene] = useState(false);
  const [isMouseOverWorkspace, setIsMouseOverWorkspace] = useState(false);
  const debugMode = false; // Set to true for troubleshooting
  
  // Keep track of previous settings to detect changes
  const prevSettings = useRef(null);

  // Create our own raycaster and mouse position vector if not provided
  const internalRaycasterRef = useRef(new THREE.Raycaster());
  const internalMouseRef = useRef(new THREE.Vector2());
  
  // Use provided refs or internal refs
  const activeRaycaster = raycasterRef?.current || internalRaycasterRef.current;
  const activeMouseRef = mouseRef?.current || internalMouseRef.current;

  // Get STL objects from scene
  useEffect(() => {
    if (!sceneRef?.current) return;
    
    // Find all STL objects in the scene
    const objects = {};
    
    sceneRef.current.traverse((object) => {
      if (object.type === 'Mesh' && object.userData && object.userData.fileId) {
        objects[object.userData.fileId] = object;
      }
    });
    
    setStlObjects(objects);
  }, [sceneRef, stlFiles]);

  // Update MouseIndicator projection lines setting when it changes
  useEffect(() => {
    if (!mouseIndicatorRef?.current || !indicatorSettings) return;

    // Skip if settings haven't changed
    if (
      prevSettings.current &&
      prevSettings.current.showProjectionLines === indicatorSettings.showProjectionLines
    ) {
      return;
    }

    // Update the projection lines setting
    if (typeof mouseIndicatorRef.current.setProjectionLinesVisible === 'function') {
      mouseIndicatorRef.current.setProjectionLinesVisible(indicatorSettings.showProjectionLines);
    }
    
    // Store current settings for comparison
    prevSettings.current = { ...indicatorSettings };
    
    if (debugMode) {
      console.log("Applied indicator settings:", indicatorSettings);
    }
  }, [mouseIndicatorRef, indicatorSettings]);

  // Handle mousemove event for position tracking
  const handleMouseMove = useCallback((event) => {
    if (!containerRef.current || !cameraRef?.current) return;

    setIsMouseOverScene(true);

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = containerRef.current.getBoundingClientRect();
    
    // Force a small delay to ensure camera and renderer have been updated properly
    setTimeout(() => {
      // Now calculate mouse position in normalized device coordinates (-1 to +1)
      activeMouseRef.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      activeMouseRef.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Only update the picking ray if we have valid coordinates
      if (isFinite(activeMouseRef.x) && isFinite(activeMouseRef.y) && 
          !isNaN(activeMouseRef.x) && !isNaN(activeMouseRef.y)) {
        activeRaycaster.setFromCamera(activeMouseRef, cameraRef.current);
        
        if (debugMode) {
          console.log('Recalculated mouse position:', activeMouseRef.x, activeMouseRef.y);
          console.log('Container bounds:', rect.left, rect.top, rect.width, rect.height);
        }
        
        // Objects that can be intersected
        const allSTLObjects = Object.values(stlObjects);

        // Calculate intersections with STL objects
        const stlIntersections = allSTLObjects.length > 0 ? 
          activeRaycaster.intersectObjects(allSTLObjects, false) : [];

        // Track if we've found an intersection to update mouse position
        let intersectionFound = false;

        // Check for STL object intersections first
        if (stlIntersections.length > 0) {
          // We have intersected with an STL object
          const firstIntersection = stlIntersections[0];
          const intersectionPoint = firstIntersection.point;

          // Convert from THREE.js coordinate system to CNC workspace coordinates
          // Note: in THREE scene, X is inverted compared to CNC coordinates
          const x = -intersectionPoint.x / sceneScale;
          const y = intersectionPoint.y / sceneScale;
          const z = intersectionPoint.z / sceneScale;

          // Update mouse position display
          if (showMousePosition) {
            setMousePosition({ x, y, z });
            setLastGridPosition({ x, y, z });
            setIsMouseOverWorkspace(true);
            intersectionFound = true;
            
            if (debugMode) {
              console.log('STL intersection detected', { x, y, z });
            }
          }

          // Update mouse indicator sphere position
          if (mouseIndicatorRef?.current) {
            if (showMousePosition) {
              mouseIndicatorRef.current.setPosition(intersectionPoint);
            } else {
              mouseIndicatorRef.current.hide();
            }
          }

          // Handle STL hover effects
          const object = firstIntersection.object;
          const fileId = object.userData.fileId;

          if (fileId) {
            // Only update if hovering a different object
            if (fileId !== hoveredStl) {
              // Reset previous hover styling
              if (hoveredStl && stlObjects[hoveredStl]) {
                stlObjects[hoveredStl].material.color.set(0xd9eaff);
                stlObjects[hoveredStl].material.emissive.set(0x000000);
              }

              // Apply hover styling
              if (stlObjects[fileId]) {
                stlObjects[fileId].material.color.set(0xffcc66);
                stlObjects[fileId].material.emissive.set(0x222222);
              }

              setHoveredStl(fileId);
            }
          }
        } else {
          // Reset hover state if no STL object is being hovered
          if (hoveredStl && stlObjects[hoveredStl]) {
            stlObjects[hoveredStl].material.color.set(0xd9eaff);
            stlObjects[hoveredStl].material.emissive.set(0x000000);
            setHoveredStl(null);
          }
        }

        // If we didn't hit an STL object, check for grid plane intersection
        if (!intersectionFound && showMousePosition) {
          // First, check if we have a grid plane ref passed in
          const gridPlane = gridPlaneRef?.current;
          
          if (gridPlane) {
            if (debugMode) {
              console.log('Attempting to raycast against grid plane');
            }
            
            const gridIntersections = activeRaycaster.intersectObject(gridPlane, false);

            if (gridIntersections.length > 0) {
              const intersectionPoint = gridIntersections[0].point;

              // Convert from THREE.js coordinate system to CNC workspace coordinates
              const x = -intersectionPoint.x / sceneScale;
              const y = intersectionPoint.y / sceneScale;
              const z = intersectionPoint.z / sceneScale;

              // Update position state
              setMousePosition({ x, y, z });
              setLastGridPosition({ x, y, z });
              setIsMouseOverWorkspace(true);
              
              if (debugMode) {
                console.log('Grid plane intersection detected', { x, y, z });
              }

              // Update the mouse indicator sphere
              if (mouseIndicatorRef?.current) {
                mouseIndicatorRef.current.setPosition(intersectionPoint);
              }
            } else {
              // No grid plane intersection - don't show any coordinates or indicator
              setIsMouseOverWorkspace(false);
              
              if (mouseIndicatorRef?.current) {
                mouseIndicatorRef.current.hide();
              }
            }
          } else {
            // If there's no grid plane, we can use a fallback, but for the current requirements,
            // we should only show coordinates on valid workspace surfaces
            setIsMouseOverWorkspace(false);
            
            if (mouseIndicatorRef?.current) {
              mouseIndicatorRef.current.hide();
            }
          }
        }
      }
    }, 0);
  }, [
    containerRef,
    activeRaycaster,
    activeMouseRef,
    cameraRef,
    mouseIndicatorRef,
    setMousePosition,
    sceneScale,
    showMousePosition,
    gridPlaneRef,
    hoveredStl,
    stlObjects
  ]);

  // Handle mouseout event
  const handleMouseOut = useCallback(() => {
    // When mouse leaves the scene, we hide the indicator and reset workspace status
    setIsMouseOverScene(false);
    setIsMouseOverWorkspace(false);
    
    if (mouseIndicatorRef?.current) {
      mouseIndicatorRef.current.hide();
    }

    // Reset hover state
    if (hoveredStl && stlObjects[hoveredStl]) {
      stlObjects[hoveredStl].material.color.set(0xd9eaff);
      stlObjects[hoveredStl].material.emissive.set(0x000000);
      setHoveredStl(null);
    }
  }, [hoveredStl, mouseIndicatorRef, stlObjects]);

  // Force clear all highlights - utility function
  const clearAllHighlights = useCallback(() => {
    if (hoveredStl && stlObjects[hoveredStl]) {
      stlObjects[hoveredStl].material.color.set(0xd9eaff);
      stlObjects[hoveredStl].material.emissive.set(0x000000);
      setHoveredStl(null);
    }

    // Also check all objects to ensure nothing remains highlighted
    Object.values(stlObjects).forEach(obj => {
      if (obj && obj.material) {
        obj.material.color.set(0xd9eaff);
        obj.material.emissive.set(0x000000);
      }
    });
  }, [hoveredStl, stlObjects]);

  // Add a resize handler to handle resize events
  useEffect(() => {
    // Add a resize handler to clear mouse position temporarily during resize
    const handleResize = () => {
      if (mouseIndicatorRef?.current) {
        mouseIndicatorRef.current.hide();
      }
      setIsMouseOverWorkspace(false);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [mouseIndicatorRef]);

  // Set up event listeners
  useEffect(() => {
    if (!containerRef.current) {
      if (debugMode) console.log('Container ref is null, cannot set up event listeners');
      return;
    }
    
    // Find the canvas element inside the container
    const rendererElement = containerRef.current.querySelector('canvas');
    if (!rendererElement) {
      if (debugMode) console.log('Canvas element not found in container');
      return;
    }
    
    if (debugMode) {
      console.log('Setting up mouse event listeners on canvas element');
    }
    
    // Clean up any existing listeners to prevent duplicates
    rendererElement.removeEventListener('mousemove', handleMouseMove);
    rendererElement.removeEventListener('mouseout', handleMouseOut);
    rendererElement.removeEventListener('mouseleave', handleMouseOut);
    
    // Add the event listeners
    rendererElement.addEventListener('mousemove', handleMouseMove);
    rendererElement.addEventListener('mouseout', handleMouseOut);
    rendererElement.addEventListener('mouseleave', handleMouseOut);
    rendererElement.addEventListener('click', clearAllHighlights);
    
    // Add a click handler to document to clear highlights when clicking outside
    const handleDocumentClick = (e) => {
      // If click is outside the 3D canvas
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        clearAllHighlights();
      }
    };
    
    document.addEventListener('click', handleDocumentClick);
    
    if (debugMode) {
      console.log('Mouse event listeners successfully attached');
    }
    
    return () => {
      if (rendererElement) {
        rendererElement.removeEventListener('mousemove', handleMouseMove);
        rendererElement.removeEventListener('mouseout', handleMouseOut);
        rendererElement.removeEventListener('mouseleave', handleMouseOut);
        rendererElement.removeEventListener('click', clearAllHighlights);
      }
      document.removeEventListener('click', handleDocumentClick);
      
      if (debugMode) {
        console.log('Mouse event listeners cleaned up');
      }
    };
  }, [
    containerRef,
    handleMouseMove,
    handleMouseOut,
    clearAllHighlights
  ]);

  return {
    hoveredStl,
    lastGridPosition,
    clearAllHighlights,
    isMouseOverScene,
    isMouseOverWorkspace
  };
};

export default useMouseTracking;