import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useGCode } from '../../../contexts/GCodeContext';
import Scene from './Scene';
import Controls from './Controls';
import PositionDisplay from './PositionDisplay';
import StlPanel from './components/StlPanel';
import Gizmo from './components/Gizmo';
import MouseCoordinatesPanel from './components/MouseCoordinatesPanel';
import { processStlFiles } from './utils/fileHandler';
import { VisualizationModes } from './utils/VisualizationModes';

/**
 * Viewer3D Panel - Main component that integrates all 3D viewer functionality
 * Enhanced with multiple visualization modes and direction indicators
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
  const [indicatorSettings, setIndicatorSettings] = useState({
    showProjectionLines: true,
    pulseAnimation: true,
    size: 'medium'
  });
  
  // New visualization states
  const [visualizationMode, setVisualizationMode] = useState(VisualizationModes.MOVE_TYPE);
  const [showDirectionIndicators, setShowDirectionIndicators] = useState(false);
  const [directionIndicatorDensity, setDirectionIndicatorDensity] = useState(0.05); // 5%
  const [directionIndicatorScale, setDirectionIndicatorScale] = useState(0.5); // 50%
  const [showPathLine, setShowPathLine] = useState(true);
  
  const [stlFiles, setStlFiles] = useState([]);
  const [panelDimensions, setPanelDimensions] = useState({ width: 0, height: 0 });
  const [robotPosition, setRobotPosition] = useState({ x: 0, y: 0, z: 0, a: 0 });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0, z: 0 });
  const [isMouseOverWorkspace, setIsMouseOverWorkspace] = useState(false);
  const [workOffset, setWorkOffset] = useState({ x: 0, y: 0, z: 0 });

  // Updated gridDimensions to include depth
  const [gridDimensions, setGridDimensions] = useState({
    width: 240,
    height: 350,
    depth: 150 // Default depth value
  });

  const handleStlFileSelection = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    try {
      // Access the StlManager from the scene component
      if (sceneRef.current && sceneRef.current.stlManagerRef && sceneRef.current.stlManagerRef.current) {
        const stlManager = sceneRef.current.stlManagerRef.current;
        
        // Read and process each file
        for (const file of Array.from(files)) {
          // Only process STL files
          if (!file.name.toLowerCase().endsWith('.stl')) {
            console.warn(`File ${file.name} is not an STL file and will be skipped.`);
            continue;
          }
          
          // Read the file as ArrayBuffer
          const fileContent = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error(`Error reading file ${file.name}`));
            reader.readAsArrayBuffer(file);
          });
          
          // Use the StlManager to load the model
          const fileId = stlManager.loadStlModel(file.name, fileContent);
          
          if (fileId) {
            console.log(`Loaded STL file ${file.name} with ID: ${fileId}`);
          }
        }
      } else {
        console.error("STL Manager is not available");
        
        // Fallback: At least update the state so the StlPanel displays
        for (const file of Array.from(files)) {
          if (!file.name.toLowerCase().endsWith('.stl')) continue;
          
          // Generate a unique ID
          const fileId = `stl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          
          // Create new file entry for the state
          const newFile = {
            id: fileId,
            name: file.name,
            visible: true,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            dimensions: [10, 10, 10], // Default dimensions
            scale: 1.0,
            autoScale: 1.0,
            manualScale: false
          };
          
          // Update state
          setStlFiles(prevFiles => [...prevFiles, newFile]);
        }
      }
      
      // Reset the file input to allow selecting the same file again
      event.target.value = null;
      
    } catch (error) {
      console.error("Error processing STL files:", error);
    }
  };

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
  const sceneRef = useRef(null);
  const toolpathRendererRef = useRef(null);

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

  // Handle mouse position updates
  const handleMousePositionUpdate = useCallback((position) => {
    // Apply sign inversion if needed to match workspace coordinate system
    setMousePosition(position);
  }, []);

  // Handle mouse over workspace status updates
  const handleMouseOverWorkspaceUpdate = useCallback((isOver) => {
    setIsMouseOverWorkspace(isOver);
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

  // Apply visualization changes to the ToolpathRenderer
  const applyVisualizationSettings = useCallback(() => {
    if (sceneRef.current && sceneRef.current.toolpathRendererRef && sceneRef.current.toolpathRendererRef.current) {
      const toolpathRenderer = sceneRef.current.toolpathRendererRef.current;
      
      // Set visualization mode
      toolpathRenderer.setVisualizationMode(visualizationMode);
      
      // Set direction indicators
      toolpathRenderer.setDirectionIndicators(showDirectionIndicators, directionIndicatorDensity);
      toolpathRenderer.setDirectionIndicatorScale(directionIndicatorScale);
      
      // Set path line visibility
      toolpathRenderer.togglePathLine(showPathLine);
      
      // Reapply visualization
      if (parsedToolpath) {
        toolpathRenderer.visualize(parsedToolpath);
      }
    }
  }, [
    visualizationMode, 
    showDirectionIndicators, 
    directionIndicatorDensity, 
    directionIndicatorScale, 
    showPathLine,
    parsedToolpath
  ]);

  // Reapply visualization settings when they change
  useEffect(() => {
    applyVisualizationSettings();
  }, [
    visualizationMode, 
    showDirectionIndicators, 
    directionIndicatorDensity, 
    directionIndicatorScale, 
    showPathLine,
    applyVisualizationSettings
  ]);

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

  // Store toolpath renderer reference from Scene
  const setToolpathRendererRef = useCallback((renderer) => {
    toolpathRendererRef.current = renderer;
  }, []);

  // Common view props
  const viewProps = {
    isPerspective,
    isGridVisible,
    showAxes,
    showWorkAxes,
    showToolpath,
    showMousePosition,
    indicatorSettings,
    stlFiles,
    setStlFiles,
    workOffset,
    setWorkOffset,
    robotPosition,
    setRobotPosition,
    mousePosition,
    setMousePosition: handleMousePositionUpdate,
    setIsMouseOverWorkspace: handleMouseOverWorkspaceUpdate,
    gridDimensions,
    showWorldCoords,
    parsedToolpath,
    selectedLine,
    transformValues,
    fileInputRef,
    panelDimensions,
    // New visualization props
    visualizationMode,
    showDirectionIndicators,
    directionIndicatorDensity,
    directionIndicatorScale,
    showPathLine,
    setToolpathRendererRef // Pass callback to get reference to the toolpath renderer
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
        indicatorSettings={indicatorSettings}
        setIndicatorSettings={setIndicatorSettings}
        onFileSelect={handleStlFileSelection}
        // New visualization props
        visualizationMode={visualizationMode}
        setVisualizationMode={setVisualizationMode}
        showDirectionIndicators={showDirectionIndicators}
        setShowDirectionIndicators={setShowDirectionIndicators}
        directionIndicatorDensity={directionIndicatorDensity}
        setDirectionIndicatorDensity={setDirectionIndicatorDensity}
        directionIndicatorScale={directionIndicatorScale}
        setDirectionIndicatorScale={setDirectionIndicatorScale}
        showPathLine={showPathLine}
        setShowPathLine={setShowPathLine}
        reapplyVisualization={applyVisualizationSettings}
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
            ref={sceneRef}
          />

          {/* Mouse coordinates panel with reactive visibility */}
          <MouseCoordinatesPanel
            mousePosition={mousePosition}
            workOffset={workOffset}
            visible={showMousePosition}
            isMouseOverWorkspace={isMouseOverWorkspace}
          />
        </div>
        <Gizmo onViewChange={handleViewChange} />

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