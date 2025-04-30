import React, { useState } from 'react';

/**
 * Grid Editor component
 * Allows editing the workspace grid dimensions
 */
const GridEditor = ({ gridDimensions, setGridDimensions }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempDimensions, setTempDimensions] = useState({ width: gridDimensions.width, height: gridDimensions.height });

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
        <>
          <input
            type="number"
            name="width"
            value={tempDimensions.width}
            onChange={handleDimensionChange}
            style={{ width: '60px', padding: '2px', fontSize: '12px' }}
          />
          <span>×</span>
          <input
            type="number"
            name="height"
            value={tempDimensions.height}
            onChange={handleDimensionChange}
            style={{ width: '60px', padding: '2px', fontSize: '12px' }}
          />
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
        </>
      ) : (
        <>
          <span>{gridDimensions.width} × {gridDimensions.height} mm</span>
          <button
            onClick={() => {
              setTempDimensions(gridDimensions);
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