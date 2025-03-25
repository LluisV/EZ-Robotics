import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

const Gizmo = ({ onViewChange }) => {
  const gizmoRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const cubeRef = useRef(null);
  const [hoveredFace, setHoveredFace] = useState(null);

  useEffect(() => {
    if (!gizmoRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true 
    });
    renderer.setSize(90, 90);
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    // Clear existing content
    if (gizmoRef.current.firstChild) {
      gizmoRef.current.removeChild(gizmoRef.current.firstChild);
    }
    gizmoRef.current.appendChild(renderer.domElement);

    // Create the gizmo cube
    const cubeSize = 1.5;
    const cubeGroup = new THREE.Group();
    cubeRef.current = cubeGroup;

    // Create materials with opacity and hover effect
    const createMaterials = () => {
      return [
        new THREE.MeshBasicMaterial({ color: 0xff5555, transparent: true, opacity: 0.4 }), // right - red (X+)
        new THREE.MeshBasicMaterial({ color: 0xbb3333, transparent: true, opacity: 0.4 }), // left - dark red (X-)
        new THREE.MeshBasicMaterial({ color: 0x55ff55, transparent: true, opacity: 0.4 }), // top - green (Y+)
        new THREE.MeshBasicMaterial({ color: 0x33bb33, transparent: true, opacity: 0.4 }), // bottom - dark green (Y-)
        new THREE.MeshBasicMaterial({ color: 0x5555ff, transparent: true, opacity: 0.4 }), // front - blue (Z+)
        new THREE.MeshBasicMaterial({ color: 0x3333bb, transparent: true, opacity: 0.4 })  // back - dark blue (Z-)
      ];
    };

    const materials = createMaterials();
    const highlightedMaterials = materials.map(mat => {
      const highlightedMat = mat.clone();
      highlightedMat.opacity = 0.7;
      return highlightedMat;
    });

    // Create cube geometry
    const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cube = new THREE.Mesh(cubeGeometry, materials);
    cubeGroup.add(cube);

    // Add wireframe
    const edgesGeometry = new THREE.EdgesGeometry(cubeGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa, linewidth: 1, transparent: true, opacity: 0.7 });
    const wireframe = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    cubeGroup.add(wireframe);

    // Add axis arrows
    const createAxisArrow = (direction, color) => {
      return new THREE.ArrowHelper(
        direction, 
        new THREE.Vector3(0, 0, 0), 
        cubeSize * 0.8, 
        color,
        0.2,
        0.1
      );
    };

    const xArrow = createAxisArrow(new THREE.Vector3(1, 0, 0), 0xff5555);
    const yArrow = createAxisArrow(new THREE.Vector3(0, 1, 0), 0x55ff55);
    const zArrow = createAxisArrow(new THREE.Vector3(0, 0, 1), 0x5555ff);
    
    cubeGroup.add(xArrow);
    cubeGroup.add(yArrow);
    cubeGroup.add(zArrow);

    // Add axis labels
    const createTextSprite = (text, color) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext('2d');
      if (!context) return null;

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
      sprite.scale.set(0.5, 0.5, 0.5);
      return sprite;
    };

    const xLabel = createTextSprite('X', '#ff5555');
    const yLabel = createTextSprite('Y', '#55ff55');
    const zLabel = createTextSprite('Z', '#5555ff');
    
    if (xLabel) {
      xLabel.position.set(cubeSize + 0.3, 0, 0);
      cubeGroup.add(xLabel);
    }
    if (yLabel) {
      yLabel.position.set(0, cubeSize + 0.3, 0);
      cubeGroup.add(yLabel);
    }
    if (zLabel) {
      zLabel.position.set(0, 0, cubeSize + 0.3);
      cubeGroup.add(zLabel);
    }
    
    // Add to scene
    scene.add(cubeGroup);

    // Raycaster for interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Render function
    const animate = () => {
      if (renderer && window.parentCamera) {
        // Update cube rotation to match the parent camera's current orientation
        cubeGroup.quaternion.setFromRotationMatrix(window.parentCamera.matrixWorldInverse);
      }
      
      if (renderer) {
        renderer.render(scene, camera);
      }
      requestAnimationFrame(animate);
    };
    animate();

    // Mouse interaction
    const handleMouseMove = (event) => {
      if (!gizmoRef.current || !cube) return;

      const bounds = gizmoRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([cube]);
      
      if (intersects.length > 0) {
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        setHoveredFace(faceIndex);
        
        // Update materials to show highlight
        cube.material = materials.map((mat, index) => 
          index === faceIndex ? highlightedMaterials[index] : mat
        );
      } else {
        setHoveredFace(null);
        cube.material = materials;
      }
    };

    const handleMouseLeave = () => {
      setHoveredFace(null);
      if (cube) {
        cube.material = materials;
      }
    };

    const handleClick = (event) => {
      if (!gizmoRef.current || !cube) return;

      const bounds = gizmoRef.current.getBoundingClientRect();
      mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([cube]);
      
      if (intersects.length > 0) {
        const faceIndex = Math.floor(intersects[0].faceIndex / 2);
        
        // Determine which view to set based on the face index
        switch (faceIndex) {
          case 0: // right face (X+)
            onViewChange('side');
            break;
          case 1: // left face (X-)
            onViewChange('side');
            break;
          case 2: // top face (Y+)
            onViewChange('front');
            break;
          case 3: // bottom face (Y-)
            onViewChange('front');
            break;
          case 4: // front face (Z+)
            onViewChange('top');
            break;
          case 5: // back face (Z-)
            onViewChange('top');
            break;
        }
      }
    };

    // Add event listeners
    gizmoRef.current.addEventListener('mousemove', handleMouseMove);
    gizmoRef.current.addEventListener('mouseleave', handleMouseLeave);
    gizmoRef.current.addEventListener('click', handleClick);

    // Cleanup
    return () => {
      if (gizmoRef.current) {
        gizmoRef.current.removeEventListener('mousemove', handleMouseMove);
        gizmoRef.current.removeEventListener('mouseleave', handleMouseLeave);
        gizmoRef.current.removeEventListener('click', handleClick);
      }
      renderer.dispose();
      cubeGeometry.dispose();
      edgesGeometry.dispose();
      materials.forEach(mat => mat.dispose());
      highlightedMaterials.forEach(mat => mat.dispose());
      edgesMaterial.dispose();
    };
  }, [onViewChange]);

  return (
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
        background: 'transparent'
      }}
      onMouseEnter={(e) => e.currentTarget.style.opacity = '1.0'}
      onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
    />
  );
};

export default Gizmo;