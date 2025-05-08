import React, { useState } from 'react';

/**
 * Modern, IDE-like Transform Panel for G-code manipulation
 * Features a compact, responsive, and theme-aware design
 */
const TransformPanel = ({
  transformValues,
  handleTransformValueChange,
  previewTransformation,
  saveWithTransformations,
  resetTransformations,
  closePanel
}) => {
  // Track expanded sections to save vertical space
  const [expandedSections, setExpandedSections] = useState({
    scale: true,
    move: true,
    rotate: true,
    center: true 
  });

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  // Check if a value has been modified from default
  const isModified = (name, value) => {
    if (name.startsWith('center')) return false; // Don't highlight center point changes
    if (name.startsWith('scale')) return value !== 1.0;
    return value !== 0;
  };

  // Generate number input with label
  const renderInput = (label, name, value, step = 0.1, min = null) => {
    const modified = isModified(name, value);
    
    return (
      <div className={`transform-input-group ${modified ? 'modified' : ''}`}>
        <label htmlFor={name}>{label}</label>
        <div className="input-with-controls">
          <input
            id={name}
            type="number"
            name={name}
            value={value}
            onChange={handleTransformValueChange}
            step={step}
            min={min}
            className={modified ? 'modified' : ''}
          />
          {modified && <div className="modified-indicator" title="Modified from default"></div>}
        </div>
      </div>
    );
  };

  return (
    <div className="transform-panel">
      <div className="transform-header">
        <div className="transform-title">
          <h3>Transform G-code</h3>
          <span className="transform-subtitle">Apply geometric transformations</span>
        </div>
        <button className="close-btn" onClick={closePanel} title="Close transform panel">
          ×
        </button>
      </div>
      
      <div className="transform-controls-container">
        <div className="transform-controls">
          {/* Scale section */}
          <div className="transform-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('scale')}
            >
              <div className="section-title">
                <span className="section-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M21 3H3v18h18V3z"/>
                    <path d="M9 9h6v6H9z"/>
                  </svg>
                </span>
                <h4>Scale</h4>
              </div>
              <span className="expand-icon">
                {expandedSections.scale ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                )}
              </span>
            </div>
            
            {expandedSections.scale && (
              <div className="section-content">
                {renderInput('X Axis', 'scaleX', transformValues.scaleX, 0.1, 0.1)}
                {renderInput('Y Axis', 'scaleY', transformValues.scaleY, 0.1, 0.1)}
                {renderInput('Z Axis', 'scaleZ', transformValues.scaleZ, 0.1, 0.1)}
              </div>
            )}
          </div>

          {/* Move section */}
          <div className="transform-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('move')}
            >
              <div className="section-title">
                <span className="section-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <path d="M5 9l-3 3 3 3"/>
                    <path d="M9 5l3-3 3 3"/>
                    <path d="M15 19l3 3 3-3"/>
                    <path d="M19 9l3 3-3 3"/>
                    <path d="M2 12h20"/>
                    <path d="M12 2v20"/>
                  </svg>
                </span>
                <h4>Move</h4>
              </div>
              <span className="expand-icon">
                {expandedSections.move ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                )}
              </span>
            </div>
            
            {expandedSections.move && (
              <div className="section-content">
                {renderInput('X Offset', 'moveX', transformValues.moveX, 1)}
                {renderInput('Y Offset', 'moveY', transformValues.moveY, 1)}
                {renderInput('Z Offset', 'moveZ', transformValues.moveZ, 1)}
              </div>
            )}
          </div>

          {/* Rotate section */}
          <div className="transform-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('rotate')}
            >
              <div className="section-title">
                <span className="section-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                  </svg>
                </span>
                <h4>Rotate</h4>
              </div>
              <span className="expand-icon">
                {expandedSections.rotate ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                )}
              </span>
            </div>
            
            {expandedSections.rotate && (
              <div className="section-content">
                {renderInput('Angle (deg)', 'rotateAngle', transformValues.rotateAngle, 1)}
              </div>
            )}
          </div>

          {/* Center Point */}
          <div className="transform-section">
            <div 
              className="section-header" 
              onClick={() => toggleSection('center')}
            >
              <div className="section-title">
                <span className="section-icon">
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="1"/>
                    <line x1="12" y1="2" x2="12" y2="4"/>
                    <line x1="12" y1="20" x2="12" y2="22"/>
                    <line x1="2" y1="12" x2="4" y2="12"/>
                    <line x1="20" y1="12" x2="22" y2="12"/>
                  </svg>
                </span>
                <h4>Center Point</h4>
              </div>
              <span className="expand-icon">
                {expandedSections.center ? (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none">
                    <polyline points="9 6 15 12 9 18"/>
                  </svg>
                )}
              </span>
            </div>
            
            {expandedSections.center && (
              <div className="section-content">
                {renderInput('X Center', 'centerX', transformValues.centerX, 1)}
                {renderInput('Y Center', 'centerY', transformValues.centerY, 1)}
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="transform-actions">
          <button
            className="transform-btn apply-transf-btn"
            onClick={saveWithTransformations}
            title="Apply transformation to G-code"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" className="btn-icon">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Apply
          </button>
          <button
            className="transform-btn reset-transf-btn"
            onClick={resetTransformations}
            title="Reset all transformations"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" className="btn-icon">
              <path d="M3 2v6h6"/>
              <path d="M21 12A9 9 0 0 0 6 5.3L3 8"/>
              <path d="M21 22v-6h-6"/>
              <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/>
            </svg>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransformPanel;