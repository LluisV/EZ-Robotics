import React, { useState } from 'react';
import { 
  Edit, 
  Check, 
  X, 
  Box, 
  MoveHorizontal, 
  MoveVertical, 
  ArrowDown
} from 'lucide-react';

/**
 * Enhanced GridEditor component with improved UI and icons
 * Allows editing the workspace grid dimensions (width, height, and depth)
 */
const GridEditor = ({ gridDimensions, setGridDimensions }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempDimensions, setTempDimensions] = useState({ 
    width: gridDimensions.width, 
    height: gridDimensions.height,
    depth: gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height) // Default if not set
  });

  // Handle grid dimension changes
  const handleDimensionChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);

    if (isNaN(numValue) || numValue <= 0) return;

    setTempDimensions(prev => ({
      ...prev,
      [name]: numValue
    }));
  };

  // Apply new grid dimensions
  const applyDimensions = () => {
    setGridDimensions(tempDimensions);
    setIsEditing(false);
  };
  
  // Cancel editing
  const cancelEditing = () => {
    setTempDimensions({
      width: gridDimensions.width,
      height: gridDimensions.height,
      depth: gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height)
    });
    setIsEditing(false);
  };

  return (
    <div className="grid-editor">
      {!isEditing ? (
        <div className="grid-dimensions-display">
          <div className="dimensions-value">
            <Box size={14} style={{ marginRight: '6px', opacity: 0.7, display: 'inline-block', verticalAlign: 'middle' }} />
            {gridDimensions.width} × {gridDimensions.height} × {gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height)} mm
          </div>
          <button
            onClick={() => {
              setTempDimensions({
                width: gridDimensions.width,
                height: gridDimensions.height,
                depth: gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height)
              });
              setIsEditing(true);
            }}
            className="edit-dimensions-btn"
          >
            <Edit size={14} />
            Edit
          </button>
        </div>
      ) : (
        <div className="grid-dimensions-editor">
          <div className="dimensions-inputs">
            <div className="dimension-input-group">
              <label className="dimension-label">
                <MoveHorizontal size={12} style={{ opacity: 0.8 }} />
              </label>
              <input
                type="number"
                name="width"
                value={tempDimensions.width}
                onChange={handleDimensionChange}
                className="dimension-input"
                min="1"
              />
            </div>
            <div className="dimension-input-group">
              <label className="dimension-label">
                <MoveVertical size={12} style={{ opacity: 0.8 }} />
              </label>
              <input
                type="number"
                name="height"
                value={tempDimensions.height}
                onChange={handleDimensionChange}
                className="dimension-input"
                min="1"
              />
            </div>
            <div className="dimension-input-group">
              <label className="dimension-label">
                <ArrowDown size={12} style={{ opacity: 0.8 }} />
              </label>
              <input
                type="number"
                name="depth"
                value={tempDimensions.depth}
                onChange={handleDimensionChange}
                className="dimension-input"
                min="1"
              />
            </div>
            <div className="dimension-unit">mm</div>
          </div>
          <div className="dimension-actions">
            <button
              onClick={applyDimensions}
              className="apply-dimensions-btn"
            >
              <Check size={14} />
              Apply
            </button>
            <button
              onClick={cancelEditing}
              className="cancel-dimensions-btn"
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GridEditor;