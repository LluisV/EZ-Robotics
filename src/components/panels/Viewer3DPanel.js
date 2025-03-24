import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

/**
 * 3D Viewer Panel component for visualizing the robot workspace using Three.js.
 * 
 * @param {Object} props Component properties
 * @param {boolean} props.showAxes Whether to show coordinate axes
 */
const Viewer3DPanel = ({ showAxes = true }) => {
  const mountRef = useRef(null);
  const gizmoRef = useRef(null);
  const [viewMode, setViewMode] = useState('3d');
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [isPerspective, setIsPerspective] = useState(true);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const cameraOrthoRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const controlsOrthoRef = useRef(null);
  const requestRef = useRef(null);
  const gizmoSceneRef = useRef(null);
  const gizmoCameraRef = useRef(null);
  const gizmoRendererRef = useRef(null);
  const gizmoCubeRef = useRef(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Function to update gizmo rotation based on main camera
  const updateGizmo = useCallback(() => {
    const gizmoScene = gizmoSceneRef.current;
    const gizmoCamera = gizmoCameraRef.current;
    const gizmoRenderer = gizmoRendererRef.current;
    const gizmoCube = gizmoCubeRef.current;
    
    if (!gizmoScene || !gizmoCamera || !gizmoRenderer || !gizmoCube || !cameraRef.current) {
      return;
    }
    
    // Get the camera's current quaternion
    const quaternion = cameraRef.current.quaternion.clone();
    
    // Apply the inverse quaternion to the gizmo cube
    const inverseQuaternion = quaternion.clone().invert();
    gizmoCube.quaternion.copy(inverseQuaternion);
    
    // Render the updated gizmo
    gizmoRenderer.render(gizmoScene, gizmoCamera);
  }, []);
  
  // Function to add/remove grid
  const addGrid = (visible) => {
    if (!sceneRef.current) return;
    
    // Remove existing grid
    const existingGrid = sceneRef.current.getObjectByName('grid');
    if (existingGrid) {
      sceneRef.current.remove(existingGrid);
    }
    
    if (visible) {
      // In robotics Z is up, so grid is in the XY plane
      const size = 10;
      const divisions = 10;
      
      // Create a GridHelper
      const gridHelper = new THREE.GridHelper(size, divisions, 0x888888, 0x444444);
      
      // Rotate grid to be in XY plane since Z is up
      gridHelper.rotation.x = Math.PI / 2;
      gridHelper.name = 'gridHelper';
      
      // Add small coordinate indicator at origin
      const originIndicator = new THREE.Group();
      originIndicator.name = 'originIndicator';
      
      // X axis (red)
      const xGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
      xGeometry.rotateZ(Math.PI / 2);
      const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const xAxis = new THREE.Mesh(xGeometry, xMaterial);
      xAxis.position.x = 0.5;
      originIndicator.add(xAxis);
      
      // Y axis (green)
      const yGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
      yGeometry.rotateZ(0);
      const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const yAxis = new THREE.Mesh(yGeometry, yMaterial);
      yAxis.position.y = 0.5;
      originIndicator.add(yAxis);
      
      // Z axis (blue)
      const zGeometry = new THREE.CylinderGeometry(0.03, 0.03, 1, 8);
      zGeometry.rotateX(Math.PI / 2);
      const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
      const zAxis = new THREE.Mesh(zGeometry, zMaterial);
      zAxis.position.z = 0.5;
      originIndicator.add(zAxis);
      
      const gridGroup = new THREE.Group();
      gridGroup.name = 'grid';
      gridGroup.add(gridHelper);
      gridGroup.add(originIndicator);
      
      sceneRef.current.add(gridGroup);
    }
  };

  // Function to add/remove axes helper
  const addAxesHelper = (visible) => {
    if (!sceneRef.current) return;
    
    // Remove existing axes helper
    const existingAxes = sceneRef.current.getObjectByName('axes');
    if (existingAxes) {
      sceneRef.current.remove(existingAxes);
    }
    
    if (visible) {
      const axesHelper = new THREE.AxesHelper(5);
      axesHelper.name = 'axes';
      sceneRef.current.add(axesHelper);
    }
  };
  
  // Reset controls after switching cameras or views
  const resetControls = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
    if (controlsOrthoRef.current) {
      controlsOrthoRef.current.reset();
    }
  };

  // Handle perspective/orthographic toggle
  const toggleProjection = (usePerspective) => {
    setIsPerspective(usePerspective);
    
    // Synchronize camera positions if cameras are initialized
    if (cameraRef.current && cameraOrthoRef.current) {
      if (usePerspective) {
        cameraRef.current.position.copy(cameraOrthoRef.current.position);
        cameraRef.current.lookAt(0, 0, 0);
      } else {
        cameraOrthoRef.current.position.copy(cameraRef.current.position);
        cameraOrthoRef.current.lookAt(0, 0, 0);
      }
      
      // Ensure rotation controls work properly if initialized
      if (controlsRef.current && controlsOrthoRef.current) {
        controlsRef.current.enabled = usePerspective;
        controlsOrthoRef.current.enabled = !usePerspective;
        
        // Update controls
        controlsRef.current.update();
        controlsOrthoRef.current.update();
      }
    }
  };
  
  // Handle view mode changes without resetting position
  const changeView = (mode) => {
    if (!cameraRef.current || !cameraOrthoRef.current) return;
    
    // Set Z as up for all cameras for consistency
    cameraRef.current.up.set(0, 0, 1);
    cameraOrthoRef.current.up.set(0, 0, 1);
    
    // Preserve the current distance from center
    const distance = cameraRef.current.position.length();
    
    // Get relative position based on view mode
    let newPosition;
    switch(mode) {
      case 'top':
        newPosition = new THREE.Vector3(0, 0, 1);
        break;
      case 'front':
        newPosition = new THREE.Vector3(0, -1, 0);
        break;
      case 'side':
        newPosition = new THREE.Vector3(1, 0, 0);
        break;
      case '3d':
      default:
        newPosition = new THREE.Vector3(1, -1, 1).normalize();
        break;
    }
    
    // Scale the position vector to maintain the same distance
    newPosition.multiplyScalar(distance);
    
    // Apply the new position to both cameras
    cameraRef.current.position.copy(newPosition);
    cameraOrthoRef.current.position.copy(newPosition);
    
    // Make sure cameras look at the origin
    cameraRef.current.lookAt(0, 0, 0);
    cameraOrthoRef.current.lookAt(0, 0, 0);
    
    // Update the controls
    if (controlsRef.current) controlsRef.current.update();
    if (controlsOrthoRef.current) controlsOrthoRef.current.update();
  };
  
  // Function to create and set up the 3D scene
  const initializeScene = () => {
    if (!mountRef.current || isInitialized) return;
    
    // Clean up any existing scene
    if (rendererRef.current && mountRef.current.contains(rendererRef.current.domElement)) {
      mountRef.current.removeChild(rendererRef.current.domElement);
      cancelAnimationFrame(requestRef.current);
    }

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1a1a1a');
    sceneRef.current = scene;

    // Camera setup
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const aspect = width / height;
    
    // Perspective camera
    const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.set(5, -5, 5);
    camera.up.set(0, 0, 1); // Z is up for robotics
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    // Orthographic camera
    const frustumSize = 10;
    const orthoCamera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2, 
      frustumSize * aspect / 2, 
      frustumSize / 2, 
      frustumSize / -2, 
      0.1, 
      1000
    );
    orthoCamera.position.set(5, -5, 5);
    orthoCamera.up.set(0, 0, 1); // Z is up for robotics
    orthoCamera.lookAt(0, 0, 0);
    cameraOrthoRef.current = orthoCamera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls setup for both cameras
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    // Set up vector to Z-up for robotics convention
    controls.object.up.set(0, 0, 1);
    controlsRef.current = controls;
    
    const controlsOrtho = new OrbitControls(orthoCamera, renderer.domElement);
    controlsOrtho.enableDamping = true;
    controlsOrtho.dampingFactor = 0.25;
    // Set up vector to Z-up for robotics convention
    controlsOrtho.object.up.set(0, 0, 1);
    controlsOrtho.enabled = false; // Disable initially
    controlsOrthoRef.current = controlsOrtho;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // Grid
    addGrid(isGridVisible);

    // Axes helper
    addAxesHelper(showAxes);

    // Animation loop
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      
      // Update active controls
      if (isPerspective) {
        controlsRef.current.update();
        renderer.render(scene, cameraRef.current);
      } else {
        controlsOrthoRef.current.update();
        renderer.render(scene, cameraOrthoRef.current);
      }
      
      // Update the gizmo to follow camera orientation
      updateGizmo();
    };
    animate();

    // Mark as initialized
    setIsInitialized(true);
    
    console.log("3D viewer initialized successfully");
  };
  
  // Initialize the 3D gizmo
  useEffect(() => {
    if (!gizmoRef.current) return;
    
    // Create a separate scene for the gizmo
    const gScene = new THREE.Scene();
    gScene.background = new THREE.Color(0x000000);
    gScene.background.alpha = 0;
    gizmoSceneRef.current = gScene;
    
    // Create a camera for the gizmo
    const gCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    gCamera.position.set(0, 0, 5);
    gCamera.lookAt(0, 0, 0);
    gizmoCameraRef.current = gCamera;
    
    // Create a renderer for the gizmo
    const gRenderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true 
    });
    gRenderer.setSize(90, 90);
    gRenderer.setClearColor(0x1a1a1a, 1);
    gizmoRendererRef.current = gRenderer;
    
    // Clear existing content
    if (gizmoRef.current.firstChild) {
      gizmoRef.current.removeChild(gizmoRef.current.firstChild);
    }
    gizmoRef.current.appendChild(gRenderer.domElement);
    
    // Create the gizmo cube
    const cubeSize = 1.5;
    
    // Create a group for the cube
    const cubeGroup = new THREE.Group();
    cubeGroup.name = 'gizmoCube';
    gizmoCubeRef.current = cubeGroup;
    
    // Create materials with different colors for each face (more subtle)
    const materials = [
      new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.4 }), // right - red (X+)
      new THREE.MeshBasicMaterial({ color: 0xbb3333, transparent: true, opacity: 0.4 }), // left - dark red (X-)
      new THREE.MeshBasicMaterial({ color: 0x55ff55, transparent: true, opacity: 0.4 }), // top - green (Y+)
      new THREE.MeshBasicMaterial({ color: 0x33bb33, transparent: true, opacity: 0.4 }), // bottom - dark green (Y-)
      new THREE.MeshBasicMaterial({ color: 0x5555ff, transparent: true, opacity: 0.4 }), // front - blue (Z+)
      new THREE.MeshBasicMaterial({ color: 0x3333bb, transparent: true, opacity: 0.4 })  // back - dark blue (Z-)
    ];
    
    // Create cube geometry
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cube = new THREE.Mesh(cubeGeometry, materials);
    cubeGroup.add(cube);
    
    // Add wireframe
    const edgesGeometry = new THREE.EdgesGeometry(cubeGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, linewidth: 1, transparent: true, opacity: 0.7 });
    const wireframe = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cubeGroup.add(wireframe);
    
    // Add axis arrows (more subtle)
    // X axis (red)
    const xArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), 
      new THREE.Vector3(0, 0, 0), 
      cubeSize * 0.8, 
      0xff5555,
      0.2,
      0.1
    );
    cubeGroup.add(xArrow);
    
    // Y axis (green)
    const yArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), 
      new THREE.Vector3(0, 0, 0), 
      cubeSize * 0.8, 
      0x55ff55,
      0.2,
      0.1
    );
    cubeGroup.add(yArrow);
    
    // Z axis (blue) - should be up in robotics convention
    const zArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), 
      new THREE.Vector3(0, 0, 0), 
      cubeSize * 0.8, 
      0x5555ff,
      0.2,
      0.1
    );
    cubeGroup.add(zArrow);
    
    // Add axis labels (using canvas textures since loading fonts is complex)
    const createTextMesh = (text, position, color) => {
      // Create a canvas texture for the text
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      context.fillStyle = color;
      context.font = 'Bold 50px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 32, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      });
      
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(0.5, 0.5, 0.5);
      return sprite;
    };
    
    // Add the sprite text labels
    const xLabel = createTextMesh('X', new THREE.Vector3(cubeSize + 0.3, 0, 0), '#ff5555');
    const yLabel = createTextMesh('Y', new THREE.Vector3(0, cubeSize + 0.3, 0), '#55ff55');
    const zLabel = createTextMesh('Z', new THREE.Vector3(0, 0, cubeSize + 0.3), '#5555ff');
    
    cubeGroup.add(xLabel);
    cubeGroup.add(yLabel);
    cubeGroup.add(zLabel);
    
    // Set initial rotation
    cubeGroup.rotation.set(Math.PI / 5, Math.PI / 5, 0);
    
    // Add to scene
    gScene.add(cubeGroup);
    
    // Add click handlers for faces
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleGizmoClick = (event) => {
      const bounds = gizmoRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, gCamera);
      const intersects = raycaster.intersectObjects([cube]);
      
      if (intersects.length > 0) {
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        
        // Determine which view to set based on the face index
        switch (faceIndex) {
          case 0: // right face (X+)
            setViewMode('side');
            changeView('side');
            break;
          case 1: // left face (X-)
            // Inverse side view
            setViewMode('side');
            changeView('side');
            break;
          case 2: // top face (Y+) - in robotics, this is not the top view
            setViewMode('front');
            changeView('front');
            break;
          case 3: // bottom face (Y-)
            // Inverse front view
            setViewMode('front');
            changeView('front');
            break;
          case 4: // front face (Z+) - in robotics, this is the top view
            setViewMode('top');
            changeView('top');
            break;
          case 5: // back face (Z-)
            // Inverse top view
            setViewMode('top');
            changeView('top');
            break;
          default:
            setViewMode('3d');
            changeView('3d');
        }
      } else {
        // Clicked on the gizmo but not on a face - set to 3D view
        setViewMode('3d');
        changeView('3d');
      }
    };
    
    gizmoRef.current.addEventListener('click', handleGizmoClick);
    
    // Render the gizmo initially
    gRenderer.render(gScene, gCamera);
    
    // Cleanup
    return () => {
      if (gizmoRef.current) {
        gizmoRef.current.removeEventListener('click', handleGizmoClick);
        if (gizmoRef.current.firstChild) {
          gizmoRef.current.removeChild(gizmoRef.current.firstChild);
        }
      }
    };
  }, [updateGizmo]);

  // Initialize Three.js scene when the component mounts or remounts
  useEffect(() => {
    // Slight delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializeScene();
    }, 100);

    return () => {
      clearTimeout(timer);
      
      // Clean up resources
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      
      if (rendererRef.current && mountRef.current) {
        if (mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      
      if (controlsRef.current) {
        controlsRef.current.dispose();
      }
      
      if (controlsOrthoRef.current) {
        controlsOrthoRef.current.dispose();
      }
      
      if (sceneRef.current) {
        // Clear all objects from scene
        while(sceneRef.current.children.length > 0) { 
          sceneRef.current.remove(sceneRef.current.children[0]); 
        }
      }
      
      setIsInitialized(false);
    };
  }, []);

  // Monitor resize events
  useEffect(() => {
    if (!mountRef.current || !rendererRef.current) return;
    
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      const aspect = width / height;
      
      // Update perspective camera
      if (cameraRef.current) {
        cameraRef.current.aspect = aspect;
        cameraRef.current.updateProjectionMatrix();
      }
      
      // Update orthographic camera
      if (cameraOrthoRef.current) {
        const frustumSize = 10;
        cameraOrthoRef.current.left = frustumSize * aspect / -2;
        cameraOrthoRef.current.right = frustumSize * aspect / 2;
        cameraOrthoRef.current.top = frustumSize / 2;
        cameraOrthoRef.current.bottom = frustumSize / -2;
        cameraOrthoRef.current.updateProjectionMatrix();
      }
      
      // Update renderer size
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    
    // Set up ResizeObserver to monitor container size changes
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }
    
    // Force a resize after mounting
    handleResize();
    
    // Force another resize after a delay to handle any layout adjustments
    const resizeTimer = setTimeout(() => {
      handleResize();
    }, 500);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      clearTimeout(resizeTimer);
    };
  }, [isInitialized]);

  // Add/remove grid based on visibility setting
  useEffect(() => {
    if (!sceneRef.current || !isInitialized) return;
    addGrid(isGridVisible);
  }, [isGridVisible, isInitialized]);

  // Add/remove axes helper based on visibility setting
  useEffect(() => {
    if (!sceneRef.current || !isInitialized) return;
    addAxesHelper(showAxes);
  }, [showAxes, isInitialized]);

  // Handle perspective/orthographic toggle
  useEffect(() => {
    if (!controlsRef.current || !controlsOrthoRef.current || !isInitialized) return;
    
    controlsRef.current.enabled = isPerspective;
    controlsOrthoRef.current.enabled = !isPerspective;
  }, [isPerspective, isInitialized]);

  // Handle view mode changes
  useEffect(() => {
    if (!cameraRef.current || !cameraOrthoRef.current || !isInitialized) return;
    changeView(viewMode);
  }, [viewMode, isInitialized]);

  // Force re-initialization when the component becomes visible
  useEffect(() => {
    if (!mountRef.current) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isInitialized) {
          initializeScene();
        }
      });
    }, { threshold: 0.1 });
    
    observer.observe(mountRef.current);
    
    return () => {
      observer.disconnect();
    };
  }, [isInitialized]);

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
          <select 
            className="toolbar-select"
            value={viewMode}
            onChange={(e) => {
              setViewMode(e.target.value);
              changeView(e.target.value);
            }}
          >
            <option value="3d">3D View</option>
            <option value="top">Top View</option>
            <option value="front">Front View</option>
            <option value="side">Side View</option>
          </select>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
              <input 
                type="checkbox" 
                checked={showAxes} 
                onChange={(e) => {}}
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
              className={`toolbar-button ${isPerspective ? 'primary' : ''}`} 
              onClick={() => toggleProjection(true)}
              title="Perspective View"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Persp
            </button>
            <button 
              className={`toolbar-button ${!isPerspective ? 'primary' : ''}`} 
              onClick={() => toggleProjection(false)}
              title="Orthographic View"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Ortho
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
      
      {/* 3D View Gizmo */}
      <div
        ref={gizmoRef}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          width: '90px',
          height: '90px',
          cursor: 'pointer',
          borderRadius: '50%',
          overflow: 'hidden',
          opacity: 0.8,
          transition: 'opacity 0.2s ease',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
          background: '#1a1a1a'  // Same as the viewer background
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1.0'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
      />
    </div>
  );
};

export default Viewer3DPanel;