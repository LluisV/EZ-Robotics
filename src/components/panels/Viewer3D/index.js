import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGCode } from '../../../contexts/GCodeContext';
import Scene from './Scene';
import Controls from './Controls';
import PositionDisplay from './PositionDisplay';
import StlPanel from './components/StlPanel';
import Gizmo from './components/Gizmo';

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
  const [gridDimensions, setGridDimensions] = useState({ width: 240, height: 350 });
  const [showWorldCoords, setShowWorldCoords] = useState(true);

  // References
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Toggle perspective projection
  const togglePerspective = () => {
    setIsPerspective(!isPerspective);
  };

  // Toggle mouse position display
  const toggleMousePosition = () => {
    setShowMousePosition(!showMousePosition);
  };

  // Handle view change from gizmo
  const handleViewChange = useCallback((view) => {
    // This would directly communicate with Scene to change the view
    // In a real implementation, we would use a ref or context to call scene methods
    console.log(`Changing view to: ${view}`);
    // For now just log, this would be handled by Scene in real implementation
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
        setGridDimensions={setGridDimensions}
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
          <Scene {...viewProps} containerRef={containerRef} />
          <Gizmo onViewChange={handleViewChange} />
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