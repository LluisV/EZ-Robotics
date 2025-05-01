import { useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import MouseIndicator from '../MouseIndicator';

/**
 * Hook to setup and manage a THREE.js scene
 * 
 * @param {Object} props Configuration options
 * @param {React.RefObject} props.containerRef Reference to container element
 * @param {boolean} props.isPerspective Whether to use perspective projection
 * @param {React.RefObject} props.sceneRef Reference to store scene object
 * @param {React.RefObject} props.rendererRef Reference to store renderer
 * @param {React.RefObject} props.cameraRef Reference to store camera
 * @param {React.RefObject} props.controlsRef Reference to store orbit controls
 * @param {React.RefObject} props.mouseIndicatorRef Reference to store mouse indicator
 * @param {Object} props.themeColors Theme color definitions
 * @param {React.RefObject} props.gridPlaneRef Reference to grid plane
 * @param {Object} props.gridDimensions Grid dimensions {width, height}
 * @param {number} props.sceneScale Scene scale factor
 * @returns {Object} Scene management functions
 */
const useThreeScene = ({
  containerRef,
  isPerspective,
  sceneRef,
  rendererRef,
  cameraRef,
  controlsRef,
  mouseIndicatorRef,
  themeColors,
  gridPlaneRef,
  gridDimensions,
  sceneScale
}) => {
  const [initialized, setInitialized] = useState(false);
  const [animationFrameId, setAnimationFrameId] = useState(null);

  // Create the THREE.js scene and all dependencies
  const createScene = useCallback(() => {
    console.log("Creating THREE.js scene");
    if (!containerRef.current) {
      console.warn("Container ref is null when creating scene");
      return null;
    }

    // Clean up existing scene
    if (rendererRef.current && containerRef.current.contains(rendererRef.current.domElement)) {
      console.log("Removing existing renderer DOM element");
      containerRef.current.removeChild(rendererRef.current.domElement);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(themeColors.background);
    sceneRef.current = scene;
    console.log("Scene created");

    // Calculate dimensions
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    console.log("Container dimensions:", width, height);

    if (width === 0 || height === 0) {
      console.warn("Container has zero width or height!");
    }

    const aspect = width / height || 1; // Avoid division by zero

    // Create perspective camera
    const perspectiveCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    perspectiveCamera.position.set(5, 5, 5);
    perspectiveCamera.up.set(0, 0, 1); // Z is up
    perspectiveCamera.lookAt(0, 0, 0);
    console.log("Perspective camera created");

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
    console.log("Orthographic camera created");

    // Set initial camera based on projection type
    cameraRef.current = isPerspective ? perspectiveCamera : orthographicCamera;
    window.parentCamera = cameraRef.current;

    // Renderer setup
    try {
      const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio);
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
      console.log("Renderer created and attached to DOM");
    } catch (error) {
      console.error("Error creating WebGL renderer:", error);
      return null;
    }

    // Orbit controls
    try {
      const controls = new OrbitControls(cameraRef.current, rendererRef.current.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.25;
      controls.object.up.set(0, 0, 1);
      controls.target.copy(gridMidpoint);
      controls.update();
      controlsRef.current = controls;
      console.log("Orbit controls created");
    } catch (error) {
      console.error("Error creating orbit controls:", error);
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);
    console.log("Scene lights added");

    // Create grid plane for raycasting
    const planeGeometry = new THREE.PlaneGeometry(
      gridDimensions.width * sceneScale,
      gridDimensions.height * sceneScale
    );
    // Adjust the plane's position to match the grid (origin at bottom-left)
    planeGeometry.translate(
      -gridDimensions.width * sceneScale / 2,
      gridDimensions.height * sceneScale / 2,
      0
    );

    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      opacity: 0.05,
      transparent: true,
      side: THREE.DoubleSide
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.z = -0.01; // Just slightly below the grid
    plane.name = 'grid-plane';
    scene.add(plane);
    gridPlaneRef.current = plane;
    console.log("Grid plane created");

    // Create enhanced mouse position indicator
    try {
      // Create new mouse indicator
      const mouseIndicator = new MouseIndicator(scene, themeColors, sceneScale);
      mouseIndicatorRef.current = mouseIndicator;
      console.log("Enhanced mouse indicator created");
    } catch (error) {
      console.error("Error creating mouse indicator:", error);
      
      // Fallback to simple sphere if there's an error
      const sphereGeometry = new THREE.SphereGeometry(0.03, 16, 16);
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.75,
        depthTest: true
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.visible = false;
      scene.add(sphere);
      
      // Add API methods to the sphere for compatibility
      sphere.setPosition = function(position) {
        this.position.copy(position);
        this.visible = true;
      };
      
      sphere.hide = function() {
        this.visible = false;
      };
      
      sphere.show = function() {
        this.visible = true;
      };
      
      mouseIndicatorRef.current = sphere;
      console.log("Fallback to simple sphere indicator");
    }

    console.log("Scene creation complete");
    return scene;
  }, [
    containerRef,
    isPerspective,
    themeColors,
    gridDimensions,
    sceneScale
  ]);

  // Handle window resizing
  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
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
  }, [containerRef, isPerspective]);

  // Animation loop
  const startAnimationLoop = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    let lastFrameTime = null;

    const animate = () => {
      const id = requestAnimationFrame(animate);
      setAnimationFrameId(id);
      
      // Calculate delta time for animations
      const now = performance.now();
      const deltaTime = lastFrameTime ? now - lastFrameTime : 16.7; // Default to ~60fps
      lastFrameTime = now;

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      // Update mouse indicator animations if it exists
      if (mouseIndicatorRef.current && typeof mouseIndicatorRef.current.update === 'function') {
        mouseIndicatorRef.current.update(deltaTime);
      }

      // Render scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animate();
  }, []);

  // Initialize scene
  useEffect(() => {
    if (initialized) {
      return;
    }

    // Don't initialize if container size is 0
    if (containerRef.current) {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width === 0 || height === 0) {
        console.log("Container has zero dimensions, waiting for resize:", width, height);

        // Set up a one-time resize observer to initialize when dimensions are available
        const observer = new ResizeObserver(entries => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width > 0 && height > 0 && !initialized) {
              console.log("Container now has dimensions, initializing:", width, height);
              const scene = createScene();
              if (scene) {
                window.addEventListener('resize', handleResize);
                startAnimationLoop();
                setInitialized(true);
              }
              observer.disconnect();
            }
          }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
      }
    }

    console.log("Initializing THREE.js scene normally");
    const scene = createScene();
    if (!scene || !containerRef.current) {
      console.warn("Could not create scene or container ref is null");
      return;
    }

    window.addEventListener('resize', handleResize);
    console.log("Starting animation loop");
    startAnimationLoop();

    setInitialized(true);
    console.log("Scene initialized successfully");

    // Don't return cleanup here to prevent premature cleanup
  }, [
    initialized,
    createScene,
    startAnimationLoop,
    handleResize,
    containerRef
  ]);

  // Cleanup only on unmount
  useEffect(() => {
    // This will only run when the component unmounts
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Empty dependency array means it only runs on mount/unmount

  // Update when projection mode changes
  useEffect(() => {
    if (!initialized || !cameraRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const aspect = width / height;

    // Calculate distance from camera to origin
    const distance = cameraRef.current.position.length();

    // Get current target from orbit controls
    const target = controlsRef.current ? controlsRef.current.target.clone() : new THREE.Vector3(0, 0, 0);
    const currentPosition = cameraRef.current.position.clone();

    // Create new camera based on projection type
    const newCamera = isPerspective
      ? new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
      : new THREE.OrthographicCamera(
        -distance * aspect,
        distance * aspect,
        distance,
        -distance,
        -1000,
        1000
      );

    // Copy position and orientation
    newCamera.position.copy(currentPosition);
    newCamera.up.set(0, 0, 1);
    newCamera.lookAt(target);

    // Update camera reference
    cameraRef.current = newCamera;
    window.parentCamera = newCamera;

    // Update controls
    if (controlsRef.current) {
      controlsRef.current.dispose();
    }

    const controls = new OrbitControls(newCamera, rendererRef.current.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.object.up.set(0, 0, 1);
    controls.target.copy(target);
    controls.update();

    controlsRef.current = controls;
  }, [isPerspective, initialized]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log("Cleaning up THREE.js scene");

    if (animationFrameId) {
      console.log("Canceling animation frame:", animationFrameId);
      cancelAnimationFrame(animationFrameId);
    }

    window.removeEventListener('resize', handleResize);

    if (controlsRef.current) {
      console.log("Disposing controls");
      controlsRef.current.dispose();
    }

    if (rendererRef.current) {
      console.log("Disposing renderer");
      rendererRef.current.dispose();
      // Only try to remove the renderer's domElement if it's still a child of the container
      if (containerRef.current && rendererRef.current.domElement &&
        containerRef.current.contains(rendererRef.current.domElement)) {
        console.log("Removing renderer DOM element from container");
        containerRef.current.removeChild(rendererRef.current.domElement);
      } else {
        console.log("Renderer DOM element is not a child of container, skipping removal");
      }
    }

    if (mouseIndicatorRef.current) {
      console.log("Removing mouse indicator from scene");
      if (typeof mouseIndicatorRef.current.dispose === 'function') {
        // New MouseIndicator class
        mouseIndicatorRef.current.dispose();
      } else {
        // Legacy sphere indicator
        if (sceneRef.current) {
          sceneRef.current.remove(mouseIndicatorRef.current);
        }
        if (mouseIndicatorRef.current.geometry) {
          mouseIndicatorRef.current.geometry.dispose();
        }
        if (mouseIndicatorRef.current.material) {
          mouseIndicatorRef.current.material.dispose();
        }
      }
    }

    if (gridPlaneRef.current && sceneRef.current) {
      console.log("Removing grid plane from scene");
      sceneRef.current.remove(gridPlaneRef.current);
      if (gridPlaneRef.current.geometry) {
        gridPlaneRef.current.geometry.dispose();
      }
      if (gridPlaneRef.current.material) {
        gridPlaneRef.current.material.dispose();
      }
    }

    console.log("THREE.js scene cleanup complete");
  }, [animationFrameId, handleResize, containerRef]);

  return {
    cleanup
  };
};

export default useThreeScene;