/**
 * Central exports file for Viewer3D components.
 * Makes importing components and utilities more organized and consistent.
 */

// Main components
export { default } from './index'; // Export the main component as default
export { default as Viewer3DPanel } from './index';
export { default as Scene } from './Scene';
export { default as Controls } from './Controls';
export { default as PositionDisplay } from './PositionDisplay';
export { GridManager } from './GridManager';
export { default as ToolpathRenderer } from './ToolpathRenderer';
export { default as StlManager } from './StlManager';

// Sub-components
export { default as Gizmo } from './components/Gizmo';
export { default as GridEditor } from './components/GridEditor';
export { default as StlPanel } from './components/StlPanel';
export { default as MouseCoordinatesPanel } from './components/MouseCoordinatesPanel';

// Hooks
export { default as useThreeScene } from './hooks/useThreeScene';
export { default as useMouseTracking } from './hooks/useMouseTracking';

// Utilities
export { getThemeColors, addThemeChangeListener } from './utils/themeColors';