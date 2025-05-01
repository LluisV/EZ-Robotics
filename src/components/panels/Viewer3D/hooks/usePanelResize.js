import { useEffect, useCallback } from 'react';

/**
 * Hook to handle panel resize events specifically for THREE.js scene
 * Ensures proper updating of camera, renderer, and raycasting on container resize
 * 
 * @param {Object} props Configuration options
 * @param {React.RefObject} props.containerRef Reference to container element
 * @param {React.RefObject} props.sceneRef Reference to THREE.js scene
 * @param {React.RefObject} props.cameraRef Reference to THREE.js camera
 * @param {React.RefObject} props.rendererRef Reference to THREE.js renderer
 * @param {React.RefObject} props.controlsRef Reference to orbit controls
 * @param {React.RefObject} props.gridManagerRef Reference to grid manager
 * @param {boolean} props.isPerspective Whether using perspective camera
 * @param {Object} props.gridDimensions Grid dimensions {width, height, depth}
 * @param {number} props.sceneScale Scene scale factor
 * @returns {Object} Panel dimensions and resize handler
 */
const usePanelResize = ({
  containerRef,
  sceneRef,
  cameraRef,
  rendererRef,
  controlsRef,
  gridManagerRef,
  isPerspective,
  gridDimensions,
  sceneScale = 0.1
}) => {
  // Handle panel resize
  const handlePanelResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current || !sceneRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    // Skip if dimensions are zero (can happen during initial render or unmounting)
    if (width === 0 || height === 0) return;
    
    const aspect = width / height;

    console.log(`Panel resized to: ${width}x${height}, aspect: ${aspect}`);

    // Calculate the grid midpoint for camera targeting
    const gridWidth = gridDimensions.width * sceneScale;
    const gridHeight = gridDimensions.height * sceneScale;
    const gridMidpointX = -gridWidth / 2;
    const gridMidpointY = gridHeight / 2;
    const gridMidpoint = { x: gridMidpointX, y: gridMidpointY, z: 0 };

    // Update camera projection matrix based on type
    if (isPerspective) {
      const perspCamera = cameraRef.current;
      perspCamera.aspect = aspect;
      perspCamera.updateProjectionMatrix();
    } else {
      // For orthographic camera, calculate proper frustum size based on grid dimensions
      const orthoCamera = cameraRef.current;
      
      // Calculate frustum size based on the larger grid dimension to ensure it's visible
      // Add a margin factor to ensure the entire grid is visible
      const marginFactor = 1.2;
      const frustumSize = Math.max(gridWidth, gridHeight) * marginFactor;
      
      // Update orthographic camera frustum
      orthoCamera.left = frustumSize * aspect / -2;
      orthoCamera.right = frustumSize * aspect / 2;
      orthoCamera.top = frustumSize / 2;
      orthoCamera.bottom = frustumSize / -2;
      orthoCamera.updateProjectionMatrix();
    }

    // Critical: update renderer size to match container
    rendererRef.current.setSize(width, height);
    rendererRef.current.setPixelRatio(window.devicePixelRatio);

    // Update orbit controls if available
    if (controlsRef.current) {
      // Update controls target if needed
      if (gridMidpoint) {
        controlsRef.current.target.set(gridMidpoint.x, gridMidpoint.y, gridMidpoint.z);
      }
      controlsRef.current.update();
    }

    // Update grid manager with new camera distance if available
    if (gridManagerRef?.current) {
      // Calculate current camera distance
      let cameraDistance = 0;
      if (cameraRef.current) {
        if (gridMidpoint) {
          // Calculate distance from camera to grid midpoint
          const dx = cameraRef.current.position.x - gridMidpoint.x;
          const dy = cameraRef.current.position.y - gridMidpoint.y;
          const dz = cameraRef.current.position.z - gridMidpoint.z;
          cameraDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        } else {
          // Fallback to camera position length
          cameraDistance = cameraRef.current.position.length();
        }
      }

      // Update grid manager with new camera distance
      gridManagerRef.current.setCameraDistance(cameraDistance);
    }

    // Force a render to update the scene with new dimensions
    // Use sceneRef.current instead of cameraRef.current.parent
    if (rendererRef.current && cameraRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  }, [containerRef, sceneRef, cameraRef, rendererRef, controlsRef, isPerspective, gridDimensions, sceneScale, gridManagerRef]);

  // Set up ResizeObserver for the container
  useEffect(() => {
    if (!containerRef.current) return;

    // Create the ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      // Wrap in try/catch to prevent uncaught errors from crashing the app
      try {
        handlePanelResize();
      } catch (error) {
        console.error("Error handling panel resize:", error);
      }
    });

    // Start observing container size changes
    resizeObserver.observe(containerRef.current);

    // Clean up the observer on unmount
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, [containerRef, handlePanelResize]);

  // Also handle window resize events
  useEffect(() => {
    const handleWindowResize = () => {
      // Wrap in try/catch to prevent uncaught errors
      try {
        handlePanelResize();
      } catch (error) {
        console.error("Error handling window resize:", error);
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [handlePanelResize]);

  // Handle initial sizing - important for first render
  useEffect(() => {
    // Small delay to ensure container dimensions are properly set
    const timer = setTimeout(() => {
      try {
        handlePanelResize();
      } catch (error) {
        console.error("Error handling initial panel resize:", error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [handlePanelResize]);

  return {
    handlePanelResize
  };
};

export default usePanelResize;