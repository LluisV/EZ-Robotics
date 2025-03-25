import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Gizmo from './Gizmo';

const Viewer3DPanel = ({ showAxes = true }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);

  // State for view and projection (start with orthographic by setting isPerspective to false)
  const [isPerspective, setIsPerspective] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);

  // Create and set up the scene
  const initializeScene = useCallback(() => {
    if (!mountRef.current) return;

    // Clean up existing scene if it exists
    if (rendererRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1a1a');
    sceneRef.current = scene;

    // Calculate dimensions
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const aspect = width / height;

    // Create perspective camera
    const perspectiveCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    perspectiveCamera.position.set(0, 0, 5);
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
    orthographicCamera.position.set(0, 0, 5);
    orthographicCamera.up.set(0, 0, 1); // Z is up
    orthographicCamera.lookAt(0, 0, 0);

    // Set initial camera based on projection type (orthographic by default)
    cameraRef.current = isPerspective ? perspectiveCamera : orthographicCamera;
    window.parentCamera = cameraRef.current;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

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
    const addGrid = () => {
      // Remove existing grid
      const existingGrid = scene.getObjectByName('grid');
      if (existingGrid) {
        scene.remove(existingGrid);
      }

      if (isGridVisible) {
        const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
        gridHelper.rotation.x = Math.PI / 2; // Rotate to XY plane
        gridHelper.name = 'grid';
        scene.add(gridHelper);
      }
    };

    // Add axes helper
    const addAxesHelper = () => {
      // Remove existing axes helper
      const existingAxes = scene.getObjectByName('axes');
      if (existingAxes) {
        scene.remove(existingAxes);
      }

      if (showAxes) {
        const axesHelper = new THREE.AxesHelper(5);
        axesHelper.name = 'axes';
        scene.add(axesHelper);
      }
    };

    // Initial setup
    addGrid();
    addAxesHelper();

    // Set top view as default
    const distance = 5;
    perspectiveCamera.position.set(0, 0, distance);
    orthographicCamera.position.set(0, 0, distance);
    perspectiveCamera.lookAt(0, 0, 0);
    orthographicCamera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Update controls
      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Render scene
      if (rendererRef.current) {
        rendererRef.current.render(scene, cameraRef.current);
      }
    };
    animate();

    return () => {
      // Cleanup
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isGridVisible, showAxes, isPerspective]);

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
    }

    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
  }, []);

  // Trigger scene initialization 
  useEffect(() => {
    const cleanup = initializeScene();
    return cleanup;
  }, [initializeScene]);

  // Handle perspective toggle
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

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div className="panel-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"></path>
            <path d="M8 2v16"></path>
            <path d="M16 6v16"></path>
          </svg>
          3D Workspace
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input 
                type="checkbox" 
                checked={showAxes} 
                onChange={() => {}} 
                style={{ margin: 0 }}
              /> 
              Axes
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input 
                type="checkbox" 
                checked={isGridVisible} 
                onChange={(e) => setIsGridVisible(e.target.checked)}
                style={{ margin: 0 }}
              /> 
              Grid
            </label>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
            <button 
              className={`toolbar-button ${!isPerspective ? 'primary' : ''}`} 
              onClick={togglePerspective}
              title="Projection View"
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
      </div>
      
      <div 
        ref={mountRef} 
        style={{ 
          width: '100%', 
          height: 'calc(100% - 40px)', 
          backgroundColor: '#1a1a1a',
          borderRadius: 'var(--border-radius)',
          overflow: 'hidden',
          position: 'relative'
        }} 
      />
      
      <Gizmo onViewChange={handleViewChange} />
    </div>
  );
};

export default Viewer3DPanel;