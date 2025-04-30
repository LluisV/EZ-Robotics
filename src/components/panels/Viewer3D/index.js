import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGCode } from '../../../contexts/GCodeContext';
import Scene from './Scene';
import Controls from './Controls';
import PositionDisplay from './PositionDisplay';
import StlPanel from './components/StlPanel';
import Gizmo from './components/Gizmo';
import MouseCoordinatesPanel from './components/MouseCoordinatesPanel';

/**
 * Viewer3D Panel - Main component that integrates all 3D viewer functionality
 * 
 * @param {Object} props Component properties
 * @param {boolean} props.showAxes Whether to show axes by default
 */
const Viewer3DPanel = ({ showAxes: initialShowAxes = true }) => {
  // State
  const [isPerspective, setIsPerspective] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [showAxes, setShowAxes] = useState(initialShowAxes);
  const [showWorkAxes, setShowWorkAxes] = useState(true);
  const [showToolpath, setShowToolpath] = useState(true);
  const [showMousePosition, setShowMousePosition] = useState(true);
  const [stlFiles, setStlFiles] = useState([]);
  const [panelDimensions, setPanelDimensions] = useState({ width: 0, height: 0 });
  const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, z: 0 });
  const [workOffset, setWorkOffset] = useState({ x: 0, y: 0, z: 0 });
  
  // Updated gridDimensions to include depth
  const [gridDimensions, setGridDimensions] = useState({ 
    width: 240, 
    height: 350,
    depth: 150 // Default depth value
  });
  
  useEffect(() => {
    // Create a global scaling update function that the animation loop can call
    window.updateGridScaling = (distance) => {
      if (sceneRef.current && sceneRef.current.gridManagerRef && sceneRef.current.gridManagerRef.current) {
        // Update the grid manager's camera distance
        sceneRef.current.gridManagerRef.current.setCameraDistance(distance);
      }
    };
    
    return () => {
      // Clean up the global function when component unmounts
      delete window.updateGridScaling;
    };
  }, []);

  const [showWorldCoords, setShowWorldCoords] = useState(true);

  // References
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const sceneRef = useRef(null); // Add this ref for the Scene component

  // Get GCode context data
  const { parsedToolpath, selectedLine, transformValues } = useGCode();

  // Update when the initialShowAxes prop changes
  useEffect(() => {
    setShowAxes(initialShowAxes);
  }, [initialShowAxes]);

  // Track container dimensions
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setPanelDimensions({ width, height });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Handle gridDimensions changes
  const handleGridDimensionsChange = useCallback((newDimensions) => {
    console.log("Updating grid dimensions:", newDimensions);
    // Ensure depth is included
    setGridDimensions({
      width: newDimensions.width,
      height: newDimensions.height,
      depth: newDimensions.depth || Math.min(newDimensions.width, newDimensions.height)
    });
  }, []);

  // Toggle perspective projection
  const togglePerspective = () => {
    setIsPerspective(!isPerspective);
  };

  // Toggle mouse position display
  const toggleMousePosition = () => {
    setShowMousePosition(!showMousePosition);
  };

  // Handle view change from Gizmo
  const handleViewChange = useCallback((view) => {
    // Access the handleViewChange method in the Scene component through ref
    if (sceneRef.current && sceneRef.current.handleViewChange) {
      console.log(`Calling handleViewChange in Scene with view: ${view}`);
      sceneRef.current.handleViewChange(view);
    } else {
      console.warn("Scene ref or handleViewChange method not available");
    }
  }, []);

  // Common view props
  const viewProps = {
    isPerspective,
    isGridVisible,
    showAxes,
    showWorkAxes,
    showToolpath,
    showMousePosition,
    stlFiles,
    setStlFiles,
    workOffset,
    setWorkOffset,
    robotPosition,
    setRobotPosition,
    mousePosition,
    setMousePosition,
    gridDimensions,
    showWorldCoords,
    parsedToolpath,
    selectedLine,
    transformValues,
    fileInputRef,
    panelDimensions
  };

  // Styling for the main container
  const viewerContainerStyle = {
    position: 'relative',
    display: 'flex',
    height: 'calc(100% - 40px)',
    overflow: 'hidden'
  };

  return (
    <div className="panel-content">
      <Controls
        showAxes={showAxes}
        setShowAxes={setShowAxes}
        showWorkAxes={showWorkAxes}
        setShowWorkAxes={setShowWorkAxes}
        isGridVisible={isGridVisible}
        setIsGridVisible={setIsGridVisible}
        showToolpath={showToolpath}
        setShowToolpath={setShowToolpath}
        showMousePosition={showMousePosition}
        toggleMousePosition={toggleMousePosition}
        isPerspective={isPerspective}
        togglePerspective={togglePerspective}
        fileInputRef={fileInputRef}
        gridDimensions={gridDimensions}
        setGridDimensions={handleGridDimensionsChange}
      />

      <PositionDisplay
        robotPosition={robotPosition}
        workOffset={workOffset}
      />

      <div style={viewerContainerStyle}>
        <div 
          ref={containerRef}
          style={{
            position: 'relative',
            flex: '1 1 auto',
            height: '100%',
            minWidth: 0
          }}
        >
          <Scene 
            {...viewProps} 
            containerRef={containerRef} 
            ref={sceneRef} // Pass the ref to Scene component
          />
          <Gizmo onViewChange={handleViewChange} />
          
          {/* Add the new mouse coordinates panel */}
          <MouseCoordinatesPanel 
            mousePosition={mousePosition}
            workOffset={workOffset}
            visible={showMousePosition}
            key={`mouse-panel-${mousePosition.x.toFixed(1)}-${mousePosition.y.toFixed(1)}-${mousePosition.z.toFixed(1)}`}
          />
        </div>

        {/* STL Files Panel - Only visible when files exist */}
        {stlFiles.length > 0 && (
          <StlPanel 
            stlFiles={stlFiles}
            setStlFiles={setStlFiles}
          />
        )}
      </div>
    </div>
  );
};

export default Viewer3DPanel;