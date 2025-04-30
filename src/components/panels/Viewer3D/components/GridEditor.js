import React, { useState } from 'react';

/**
 * Grid Editor component
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', marginTop: '8px' }}>
      <span>Workspace:</span>
      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>W:</span>
            <input
              type="number"
              name="width"
              value={tempDimensions.width}
              onChange={handleDimensionChange}
              style={{ width: '50px', padding: '2px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>H:</span>
            <input
              type="number"
              name="height"
              value={tempDimensions.height}
              onChange={handleDimensionChange}
              style={{ width: '50px', padding: '2px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>D:</span>
            <input
              type="number"
              name="depth"
              value={tempDimensions.depth}
              onChange={handleDimensionChange}
              style={{ width: '50px', padding: '2px', fontSize: '12px' }}
            />
          </div>
          <span>mm</span>
          <button
            onClick={applyDimensions}
            style={{ padding: '2px 5px', fontSize: '10px' }}
          >
            Apply
          </button>
          <button
            onClick={() => setIsEditing(false)}
            style={{ padding: '2px 5px', fontSize: '10px' }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          <span>
            {gridDimensions.width} × {gridDimensions.height} × {gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height)} mm
          </span>
          <button
            onClick={() => {
              setTempDimensions({
                width: gridDimensions.width,
                height: gridDimensions.height,
                depth: gridDimensions.depth || Math.min(gridDimensions.width, gridDimensions.height)
              });
              setIsEditing(true);
            }}
            style={{ padding: '2px 5px', fontSize: '10px' }}
          >
            Edit
          </button>
        </>
      )}
    </div>
  );
};

export default GridEditor;