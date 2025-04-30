import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import useThreeScene from './hooks/useThreeScene';
import useMouseTracking from './hooks/useMouseTracking';
import { GridManager } from './GridManager';
import ToolpathRenderer from './ToolpathRenderer';
import StlManager from './StlManager';
import { getThemeColors } from './utils/themeColors';

/**
 * Scene component for the 3D Viewer
 * Handles creation and management of the THREE.js scene
 */
const Scene = ({
    containerRef,
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
    setMousePosition,
    gridDimensions,
    showWorldCoords,
    parsedToolpath,
    selectedLine,
    transformValues,
    panelDimensions
}) => {
    // Scene scale - conversion factor from mm to scene units
    const sceneScale = 0.1; // 10mm = 1 unit

    // Refs for THREE.js objects
    const sceneRef = useRef(null);
    const rendererRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const raycasterRef = useRef(new THREE.Raycaster());
    const mouseRef = useRef(new THREE.Vector2());
    const gridManagerRef = useRef(null);
    const toolpathRendererRef = useRef(null);
    const stlManagerRef = useRef(null);
    const robotToolRef = useRef(null);
    const mouseIndicatorRef = useRef(null);
    const gridPlaneRef = useRef(null);

    // Theme colors
    const themeColors = getThemeColors();

    // Initialize the THREE scene, camera, renderer, and controls
    const { cleanup } = useThreeScene({
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
    });

    // Mouse tracking for coordinate display and object hover
    useMouseTracking({
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
    });

    // Create robot position indicator
    const createRobotTool = useCallback(() => {
        if (!sceneRef.current) return;

        // Remove existing tool if any
        if (robotToolRef.current) {
            sceneRef.current.remove(robotToolRef.current);
            robotToolRef.current = null;
        }

        // Create a group for the robot tool
        const toolGroup = new THREE.Group();
        toolGroup.name = 'robot-tool';

        // Create a cylindrical body
        const bodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 16);
        const bodyMaterial = new THREE.MeshBasicMaterial({
            color: themeColors.robotPosition,
            transparent: false,
            opacity: 1.0
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2; // Align with Z axis
        body.position.z = 0.5; // Move up half of its height

        // Create a conical tip
        const tipGeometry = new THREE.ConeGeometry(0.1, 0.2, 16);
        const tipMaterial = new THREE.MeshBasicMaterial({
            color: themeColors.robotPosition,
            transparent: false,
            opacity: 1.0
        });
        const tip = new THREE.Mesh(tipGeometry, tipMaterial);
        tip.rotation.x = -Math.PI / 2; // Align with Z axis, point forward
        tip.position.z = 0.1; // Position at the top of the body

        // Add body and tip to the group
        toolGroup.add(body);
        toolGroup.add(tip);

        // Set initial position
        toolGroup.position.set(
            robotPosition.x * sceneScale,
            robotPosition.y * sceneScale,
            robotPosition.z * sceneScale
        );

        // Add to the scene
        sceneRef.current.add(toolGroup);
        robotToolRef.current = toolGroup;
    }, [robotPosition, themeColors, sceneScale]);

    // Update position of the robot tool
    const updateRobotToolPosition = useCallback((worldPos) => {
        if (!robotToolRef.current) {
            createRobotTool();
            return;
        }

        // Update position
        robotToolRef.current.position.set(
            worldPos.x * sceneScale,
            worldPos.y * sceneScale,
            worldPos.z * sceneScale
        );

        // Update rotation based on A axis if available
        if (worldPos.a !== undefined) {
            robotToolRef.current.rotation.z = worldPos.a * Math.PI / 180;
        }
    }, [sceneScale, createRobotTool]);

    // Initialize managers for grid, toolpath, and STL
    useEffect(() => {
        console.log("Initializing scene managers");
        if (!sceneRef.current) {
            console.warn("sceneRef is null when trying to initialize managers");
            return;
        }

        // Don't initialize if we already have instances
        if (gridManagerRef.current && toolpathRendererRef.current && stlManagerRef.current) {
            console.log("Managers already exist, skipping initialization");
            return;
        }

        // Create Grid Manager
        if (!gridManagerRef.current) {
            gridManagerRef.current = new GridManager(
                sceneRef.current,
                gridDimensions,
                sceneScale,
                themeColors,
                workOffset
            );
        }

        // Create Toolpath Renderer
        if (!toolpathRendererRef.current) {
            toolpathRendererRef.current = new ToolpathRenderer(
                sceneRef.current,
                sceneScale,
                themeColors
            );
        }

        // Create STL Manager
        if (!stlManagerRef.current) {
            stlManagerRef.current = new StlManager(
                sceneRef.current,
                themeColors,
                setStlFiles
            );
        }

        // Create robot tool
        createRobotTool();
        console.log("Scene managers initialized successfully");

        return () => {
            console.log("Cleaning up scene managers");
            // Only clean up if we're really unmounting the component
            const unmounting = !document.body.contains(containerRef.current);
            if (unmounting) {
                console.log("Component is unmounting, disposing managers");
                // Clean up managers
                if (gridManagerRef.current) {
                    gridManagerRef.current.dispose();
                    gridManagerRef.current = null;
                }

                if (toolpathRendererRef.current) {
                    toolpathRendererRef.current.dispose();
                    toolpathRendererRef.current = null;
                }

                if (stlManagerRef.current) {
                    stlManagerRef.current.dispose();
                    stlManagerRef.current = null;
                }
            } else {
                console.log("Component is not unmounting, keeping managers");
            }
        };
    }, []);

    // Update grid and axes visibility
    useEffect(() => {
        console.log("Updating grid and axes visibility");
        if (!gridManagerRef.current) {
            console.warn("gridManagerRef is null when trying to update grid/axes");
            return;
        }

        try {
            // Create a stable reference to current values to prevent unnecessary updates
            const updateObj = {
                isGridVisible,
                showAxes,
                showWorkAxes,
                gridDimensions: { ...gridDimensions },
                workOffset: { ...workOffset },
                showWorldCoords
            };

            // Store the update object for comparison
            const lastUpdateStr = gridManagerRef.current.lastUpdateStr || '';
            const currentUpdateStr = JSON.stringify(updateObj);

            // Only update if actual values changed
            if (lastUpdateStr !== currentUpdateStr) {
                gridManagerRef.current.lastUpdateStr = currentUpdateStr;
                gridManagerRef.current.updateGridAndAxes(updateObj);
                console.log("Grid and axes updated successfully");
            } else {
                console.log("Grid update values unchanged, skipping update");
            }
        } catch (error) {
            console.error("Error updating grid and axes:", error);
        }
    }, [
        isGridVisible,
        showAxes,
        showWorkAxes,
        gridDimensions,
        workOffset,
        showWorldCoords
    ]);

    // Update toolpath visualization
    useEffect(() => {
        if (!toolpathRendererRef.current || !parsedToolpath) return;

        if (showToolpath) {
            toolpathRendererRef.current.setTransformValues(transformValues);
            toolpathRendererRef.current.setWorkOffset(workOffset);
            toolpathRendererRef.current.visualize(parsedToolpath);

            if (selectedLine >= 0) {
                toolpathRendererRef.current.highlightLine(selectedLine);
            }
        } else {
            toolpathRendererRef.current.clear();
        }
    }, [parsedToolpath, showToolpath, transformValues, workOffset, selectedLine]);

    // Subscribe to position telemetry events
    useEffect(() => {
        // Handler for position telemetry
        const handlePositionTelemetry = (event) => {
            const data = event.detail;

            if (!data || !data.type === 'response' || !data.data) return;

            // Check if this is a status message in GRBL format: <status|MPos:x,y,z|...>
            if (data.data.startsWith('<') && data.data.includes('|MPos:')) {
                try {
                    // Parse machine position (MPos)
                    const mPosMatch = data.data.match(/MPos:([^,|]+),([^,|]+),([^,|]+)/);
                    // Parse work coordinate offset (WCO)
                    const wcoMatch = data.data.match(/WCO:([^,|]+),([^,|]+),([^,|]+)/);

                    if (mPosMatch) {
                        // Extract machine positions
                        const worldX = parseFloat(mPosMatch[1]) || 0;
                        const worldY = parseFloat(mPosMatch[2]) || 0;
                        const worldZ = parseFloat(mPosMatch[3]) || 0;

                        // For 3D viewer, invert X as needed by the coordinate system
                        const newWorldPosition = {
                            x: -worldX, // X is inverted in the 3D view
                            y: worldY,
                            z: worldZ,
                            a: 0 // Default A axis
                        };

                        // Extract work coordinate offsets if available
                        if (wcoMatch) {
                            const wcoX = parseFloat(wcoMatch[1]) || 0;
                            const wcoY = parseFloat(wcoMatch[2]) || 0;
                            const wcoZ = parseFloat(wcoMatch[3]) || 0;

                            // Update work offset
                            const newWorkOffset = {
                                x: wcoX,
                                y: wcoY,
                                z: wcoZ
                            };

                            // Only update if work offset has changed
                            const hasWorkOffsetChanged =
                                newWorkOffset.x !== workOffset.x ||
                                newWorkOffset.y !== workOffset.y ||
                                newWorkOffset.z !== workOffset.z;

                            if (hasWorkOffsetChanged) {
                                setWorkOffset(newWorkOffset);
                            }
                        }

                        // Only update if position has changed
                        const hasPositionChanged =
                            newWorldPosition.x !== robotPosition.x ||
                            newWorldPosition.y !== robotPosition.y ||
                            newWorldPosition.z !== robotPosition.z;

                        if (hasPositionChanged) {
                            setRobotPosition(newWorldPosition);

                            // Update the robot tool position in the 3D scene
                            updateRobotToolPosition(newWorldPosition);
                        }
                    }
                } catch (error) {
                    console.error("Error parsing position telemetry:", error);
                }
            }
        };

        // Listen for telemetry data
        document.addEventListener('serialdata', handlePositionTelemetry);

        return () => {
            document.removeEventListener('serialdata', handlePositionTelemetry);
        };
    }, [
        robotPosition,
        setRobotPosition,
        workOffset,
        setWorkOffset,
        updateRobotToolPosition
    ]);

    // Cleanup on unmount
    useEffect(() => {
        // This is important: Only clean up when the component is actually unmounting
        return () => {
            // Check if the component is truly unmounting by checking if it's still in the DOM
            const unmounting = !document.body.contains(containerRef.current);
            if (unmounting) {
                console.log("Scene component is truly unmounting, running cleanup");
                cleanup && cleanup();
            } else {
                console.log("Scene component state update only, skipping cleanup");
            }
        };
    }, []); // Empty dependency array means it only runs on mount/unmount

    return null; // This component doesn't render anything directly
};

export default Scene;