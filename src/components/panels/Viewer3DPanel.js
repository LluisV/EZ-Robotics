import React, { useState, useRef, useEffect, useCallback, useContext } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Gizmo from './Gizmo';

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
    zAxis: '#0077cc'
  };
  
  // Adjust colors based on theme
  if (themeClass.includes('theme-light') || themeClass.includes('theme-light-spaced')) {
    colors.background = '#f0f0f0';
    colors.gridPrimary = '#cccccc';
    colors.gridSecondary = '#aaaaaa';
    colors.xAxis = '#aa0000';
    colors.yAxis = '#007700';
    colors.zAxis = '#0000aa';
  } else if (themeClass.includes('theme-visual-studio')) {
    colors.background = '#1e1e1e';
    colors.gridPrimary = '#3f3f3f';
    colors.gridSecondary = '#2d2d2d';
  } else if (themeClass.includes('theme-abyss') || themeClass.includes('theme-abyss-spaced')) {
    colors.background = '#000c18';
    colors.gridPrimary = '#144d77';
    colors.gridSecondary = '#093254';
    colors.xAxis = '#ff628c';
    colors.yAxis = '#3ad900';
    colors.zAxis = '#5ccfe6';
  } else if (themeClass.includes('theme-dracula')) {
    colors.background = '#282a36';
    colors.gridPrimary = '#44475a';
    colors.gridSecondary = '#383a4c';
    colors.xAxis = '#ff5555';
    colors.yAxis = '#50fa7b';
    colors.zAxis = '#8be9fd';
  } else if (themeClass.includes('theme-replit')) {
    colors.background = '#f5f9fc';
    colors.gridPrimary = '#c2c8cc';
    colors.gridSecondary = '#dbe1e6';
    colors.xAxis = '#e91e63';
    colors.yAxis = '#13c2c2';
    colors.zAxis = '#1890ff';
  }
  
  return colors;
};

const Viewer3DPanel = ({ showAxes = true }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const gridHelperRef = useRef(null);
  const axesHelperRef = useRef(null);

  // State for view and projection
  const [isPerspective, setIsPerspective] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [themeColors, setThemeColors] = useState(getThemeColors());

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

  // Create and set up the scene
  const initializeScene = useCallback(() => {
    if (!mountRef.current) return;

    // Clean up existing scene if it exists
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

    // Set initial camera based on projection type
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

    // Set top view as default
    const distance = 5;
    perspectiveCamera.position.set(0, 0, distance);
    orthographicCamera.position.set(0, 0, distance);
    perspectiveCamera.lookAt(0, 0, 0);
    orthographicCamera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

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
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isGridVisible, showAxes, isPerspective, themeColors]);

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
          backgroundColor: themeColors.background,
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