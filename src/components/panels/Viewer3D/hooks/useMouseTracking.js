import { useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';

/**
 * Hook to handle mouse tracking and intersection detection in the 3D scene
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
  gridPlaneRef
}) => {
  const [hoveredStl, setHoveredStl] = useState(null);
  const [stlObjects, setStlObjects] = useState({});

  // Get STL objects from scene
  useEffect(() => {
    if (!sceneRef.current) return;
    
    // Find all STL objects in the scene
    const objects = {};
    
    sceneRef.current.traverse((object) => {
      if (object.type === 'Mesh' && object.userData && object.userData.fileId) {
        objects[object.userData.fileId] = object;
      }
    });
    
    setStlObjects(objects);
  }, [sceneRef, stlFiles]);

  // Handle mousemove event for position tracking
  const handleMouseMove = useCallback((event) => {
    if (!containerRef.current || !raycasterRef.current || !cameraRef.current) return;

    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update the picking ray
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    // Objects that can be intersected
    const allSTLObjects = Object.values(stlObjects);

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
      if (stlObjects[hoveredStl]) {
        stlObjects[hoveredStl].material.color.set(0xd9eaff);
        stlObjects[hoveredStl].material.emissive.set(0x000000);
      }
      setHoveredStl(null);
    }
  }, [
    containerRef,
    raycasterRef,
    cameraRef,
    mouseRef,
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
    // Clear mouse position when leaving the 3D view
    setMousePosition({ x: 0, y: 0, z: 0 });

    // Hide the mouse indicator
    if (mouseIndicatorRef.current) {
      mouseIndicatorRef.current.visible = false;
    }

    // Reset hover state
    if (hoveredStl && stlObjects[hoveredStl]) {
      stlObjects[hoveredStl].material.color.set(0xd9eaff);
      stlObjects[hoveredStl].material.emissive.set(0x000000);
      setHoveredStl(null);
    }
  }, [hoveredStl, mouseIndicatorRef, setMousePosition, stlObjects]);

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

  // Set up event listeners
  // Set up event listeners
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Find the canvas element inside the container
    const rendererElement = containerRef.current.querySelector('canvas');
    if (!rendererElement) return;
    
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
    
    return () => {
      rendererElement.removeEventListener('mousemove', handleMouseMove);
      rendererElement.removeEventListener('mouseout', handleMouseOut);
      rendererElement.removeEventListener('mouseleave', handleMouseOut);
      rendererElement.removeEventListener('click', clearAllHighlights);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [
    containerRef,
    handleMouseMove,
    handleMouseOut,
    clearAllHighlights
  ]);

  return {
    hoveredStl,
    clearAllHighlights
  };
};

export default useMouseTracking;