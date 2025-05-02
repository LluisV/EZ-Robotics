import React from 'react';

/**
 * Transform panel component for G-code manipulations
 */
const TransformPanel = ({
  transformValues,
  handleTransformValueChange,
  previewTransformation,
  saveWithTransformations,
  resetTransformations,
  closePanel
}) => {
  return (
    <div className="transform-panel">
      <div className="transform-header">
        <h3>Transform G-code</h3>
        <button className="close-btn" onClick={closePanel}>×</button>
      </div>
      
      <div className="transform-controls">
        {/* Scale section */}
        <div className="transform-section">
          <h4>Scale</h4>
          <div className="control-group">
            <label>X Axis:</label>
            <input
              type="number"
              name="scaleX"
              value={transformValues.scaleX}
              onChange={handleTransformValueChange}
              step="0.1"
              min="0.1"
            />
          </div>
          <div className="control-group">
            <label>Y Axis:</label>
            <input
              type="number"
              name="scaleY"
              value={transformValues.scaleY}
              onChange={handleTransformValueChange}
              step="0.1"
              min="0.1"
            />
          </div>
          <div className="control-group">
            <label>Z Axis:</label>
            <input
              type="number"
              name="scaleZ"
              value={transformValues.scaleZ}
              onChange={handleTransformValueChange}
              step="0.1"
              min="0.1"
            />
          </div>
        </div>

        {/* Move section */}
        <div className="transform-section">
          <h4>Move</h4>
          <div className="control-group">
            <label>X Offset:</label>
            <input
              type="number"
              name="moveX"
              value={transformValues.moveX}
              onChange={handleTransformValueChange}
              step="1"
            />
          </div>
          <div className="control-group">
            <label>Y Offset:</label>
            <input
              type="number"
              name="moveY"
              value={transformValues.moveY}
              onChange={handleTransformValueChange}
              step="1"
            />
          </div>
          <div className="control-group">
            <label>Z Offset:</label>
            <input
              type="number"
              name="moveZ"
              value={transformValues.moveZ}
              onChange={handleTransformValueChange}
              step="1"
            />
          </div>
        </div>

        {/* Rotate section */}
        <div className="transform-section">
          <h4>Rotate</h4>
          <div className="control-group">
            <label>Angle (degrees):</label>
            <input
              type="number"
              name="rotateAngle"
              value={transformValues.rotateAngle}
              onChange={handleTransformValueChange}
              step="1"
            />
          </div>
        </div>

        {/* Center Point */}
        <div className="transform-section">
          <h4>Center Point</h4>
          <div className="control-group">
            <label>X Center:</label>
            <input
              type="number"
              name="centerX"
              value={transformValues.centerX}
              onChange={handleTransformValueChange}
              step="1"
            />
          </div>
          <div className="control-group">
            <label>Y Center:</label>
            <input
              type="number"
              name="centerY"
              value={transformValues.centerY}
              onChange={handleTransformValueChange}
              step="1"
            />
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="transform-actions">
          <button
            className="transform-btn preview-btn"
            onClick={previewTransformation}
          >
            Preview
          </button>
          <button
            className="transform-btn apply-btn"
            onClick={saveWithTransformations}
          >
            Apply
          </button>
          <button
            className="transform-btn reset-btn"
            onClick={resetTransformations}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransformPanel;