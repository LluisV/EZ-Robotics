import React, { useCallback, useEffect, useState } from 'react';
import { getThemeColors } from '../utils/themeColors';

/**
 * Enhanced StlPanel component with a more compact UI
 * Provides controls for managing imported STL files
 * 
 * @param {Object} props Component properties
 * @param {Array} props.stlFiles Array of STL file objects
 * @param {Function} props.setStlFiles Function to update stlFiles state
 * @param {Object} props.sceneRef Reference to the Scene component
 */
const StlPanel = ({ stlFiles, setStlFiles, sceneRef }) => {
  const themeColors = getThemeColors();
  const [stlManager, setStlManager] = useState(null);

  // Initialize stlManager from sceneRef when it's available
  useEffect(() => {
    if (sceneRef?.current?.stlManagerRef?.current) {
      setStlManager(sceneRef.current.stlManagerRef.current);
    }
  }, [sceneRef]);

  // Toggle file visibility
  const toggleStlVisibility = useCallback((fileId) => {
    if (stlManager && stlManager.toggleStlVisibility) {
      stlManager.toggleStlVisibility(fileId);
    } else {
      setStlFiles(prevFiles => prevFiles.map(file =>
        file.id === fileId ? { ...file, visible: !file.visible } : file
      ));
    }
  }, [setStlFiles, stlManager]);

  // Remove file
  const removeStlFile = useCallback((fileId) => {
    if (stlManager && stlManager.removeStlFile) {
      stlManager.removeStlFile(fileId);
    } else {
      setStlFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    }
  }, [setStlFiles, stlManager]);

  // Update position
  const updateStlPosition = useCallback((fileId, axis, value) => {
    if (stlManager && stlManager.updateStlPosition) {
      stlManager.updateStlPosition(fileId, axis, value);
    } else {
      setStlFiles(prevFiles => prevFiles.map(file => {
        if (file.id === fileId) {
          const newPosition = [...file.position];
          const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
          newPosition[axisIndex] = parseFloat(value);
          return { ...file, position: newPosition };
        }
        return file;
      }));
    }
  }, [setStlFiles, stlManager]);

  // Update rotation
  const updateStlRotation = useCallback((fileId, axis, value) => {
    if (stlManager && stlManager.updateStlRotation) {
      stlManager.updateStlRotation(fileId, axis, value);
    } else {
      setStlFiles(prevFiles => prevFiles.map(file => {
        if (file.id === fileId) {
          const newRotation = [...file.rotation];
          const axisIndex = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
          newRotation[axisIndex] = parseFloat(value);
          return { ...file, rotation: newRotation };
        }
        return file;
      }));
    }
  }, [setStlFiles, stlManager]);

  // Update scale
  const updateStlScale = useCallback((fileId, value) => {
    if (stlManager && stlManager.updateStlScale) {
      stlManager.updateStlScale(fileId, value);
    } else {
      setStlFiles(prevFiles => prevFiles.map(file => {
        if (file.id === fileId) {
          return { 
            ...file, 
            scale: parseFloat(value),
            manualScale: true
          };
        }
        return file;
      }));
    }
  }, [setStlFiles, stlManager]);

  // Reset scale
  const resetStlScale = useCallback((fileId) => {
    if (stlManager && stlManager.resetStlScale) {
      stlManager.resetStlScale(fileId);
    } else {
      setStlFiles(prevFiles => {
        const file = prevFiles.find(f => f.id === fileId);
        if (!file) return prevFiles;
        
        return prevFiles.map(f => {
          if (f.id === fileId) {
            return {
              ...f,
              scale: f.autoScale,
              manualScale: false
            };
          }
          return f;
        });
      });
    }
  }, [setStlFiles, stlManager]);

  // Center geometry
  const centerGeometryAtOrigin = useCallback((fileId) => {
    if (stlManager && stlManager.centerGeometryAtOrigin) {
      stlManager.centerGeometryAtOrigin(fileId);
    } else {
      setStlFiles(prevFiles => prevFiles.map(file => {
        if (file.id === fileId) {
          return { ...file, position: [0, 0, 0] };
        }
        return file;
      }));
    }
  }, [setStlFiles, stlManager]);

  // File panel styling
  const stlPanelStyle = {
    width: '230px',
    minWidth: '230px',
    flex: '0 0 230px',
    borderLeft: '1px solid var(--border-color)',
    overflow: 'auto',
    backgroundColor: 'var(--bg-light)',
    borderRadius: 'var(--border-radius)',
    marginLeft: '8px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s ease'
  };

  // Compact form styling
  const compactInputStyle = {
    width: '35px',
    fontSize: '10px',
    padding: '3px 4px',
    borderRadius: '4px',
    border: '1px solid var(--border-color)',
    textAlign: 'left',
    background: 'var(--bg-light)',
    color: 'var(--text-color)',
    appearance: 'textfield', /* Hide spinner for Firefox */
    WebkitAppearance: 'none', /* Hide spinner for Chrome/Safari */
    MozAppearance: 'textfield' /* Hide spinner for Firefox */
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 'bold',
    marginBottom: '4px',
    display: 'block'
  };

  const inlineLabel = {
    fontSize: '10px',
    fontWeight: 'bold',
    marginRight: '4px'
  };

  const axisLabelStyle = {
    fontSize: '10px',
    width: '12px',
    display: 'inline-block',
    textAlign: 'center',
    fontWeight: 'bold',
    marginBottom: '2px'
  };

  const sectionStyle = {
    marginBottom: '8px',
    padding: '8px',
    backgroundColor: 'var(--bg-medium)',
    borderRadius: '4px',
  };
  
  const customCheckboxStyle = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    backgroundColor: 'var(--bg-light)',
    border: '1px solid var(--border-color)',
    borderRadius: '3px',
    cursor: 'pointer',
    margin: 0
  };
  
  const checkmarkStyle = {
    color: themeColors.yAxis,
    fontSize: '12px',
    fontWeight: 'bold'
  };

  // Enhanced button styles with more visible text for the Center button
  const centerButtonStyle = { 
    padding: '4px 8px', 
    fontSize: '11px', 
    flex: 1,
    backgroundColor: 'var(--bg-light)',
    border: '1px solid var(--border-color)',
    borderRadius: '4px',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.95)', // Whiter text for better visibility
    fontWeight: '500' // Slightly bolder
  };

  const removeButtonStyle = { 
    padding: '4px 8px', 
    fontSize: '11px', 
    flex: 1,
    backgroundColor: 'rgba(255,70,70,0.1)',
    border: '1px solid rgba(255,70,70,0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    color: 'rgba(255,70,70,0.9)'
  };

  return (
    <div style={stlPanelStyle}>
      <div style={{ 
        padding: '10px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-medium)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>STL Files</h3>
        <span style={{ 
          fontSize: '11px', 
          padding: '2px 6px', 
          backgroundColor: 'var(--bg-light)', 
          borderRadius: '12px',
          color: 'var(--text-secondary)'
        }}>
          {stlFiles.length}
        </span>
      </div>
      <div style={{ padding: '10px', flexGrow: 1, overflowY: 'auto' }}>
        {stlFiles.length === 0 && (
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-secondary)', 
            textAlign: 'center', 
            padding: '20px',
            backgroundColor: 'var(--bg-medium)',
            borderRadius: '5px',
            marginTop: '10px' 
          }}>
            No STL files imported
          </div>
        )}
        {stlFiles.map((file) => (
          <div
            key={file.id}
            style={{
              marginBottom: '8px',
              padding: '4px 6px',
              borderRadius: 'var(--border-radius)',
              backgroundColor: 'var(--bg-medium)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{
                fontWeight: 'bold',
                fontSize: '11px',
                maxWidth: '170px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {file.name}
              </div>
              
              {/* Custom styled checkbox */}
              <div 
                style={customCheckboxStyle}
                onClick={() => toggleStlVisibility(file.id)}
                role="checkbox"
                aria-checked={file.visible}
                tabIndex={0}
              >
                {file.visible && <span style={checkmarkStyle}>✓</span>}
              </div>
            </div>

            {/* Position Controls - compact layout with labels above groups */}
            <div style={sectionStyle}>
              <div style={{ marginBottom: '8px' }}>
                <span style={labelStyle}>Position (mm)</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{...axisLabelStyle, color: themeColors.xAxis, marginRight: '2px'}}>X</span>
                    <input
                      type="number"
                      value={parseFloat(file.position[0].toFixed(3))}
                      onChange={(e) => updateStlPosition(file.id, 'x', e.target.value)}
                      style={compactInputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{...axisLabelStyle, color: themeColors.yAxis, marginRight: '2px'}}>Y</span>
                    <input
                      type="number"
                      value={parseFloat(file.position[1].toFixed(3))}
                      onChange={(e) => updateStlPosition(file.id, 'y', e.target.value)}
                      style={compactInputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{...axisLabelStyle, color: themeColors.zAxis, marginRight: '2px'}}>Z</span>
                    <input
                      type="number"
                      value={parseFloat(file.position[2].toFixed(3))}
                      onChange={(e) => updateStlPosition(file.id, 'z', e.target.value)}
                      style={compactInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Rotation Controls - compact layout with labels above groups */}
              <div style={{ marginBottom: '8px' }}>
                <span style={labelStyle}>Rotation (degrees)</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{...axisLabelStyle, color: themeColors.xAxis, marginRight: '2px'}}>X</span>
                    <input
                      type="number"
                      value={parseFloat(file.rotation[0].toFixed(3))}
                      onChange={(e) => updateStlRotation(file.id, 'x', e.target.value)}
                      step="1"
                      min="-180"
                      max="180"
                      style={compactInputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{...axisLabelStyle, color: themeColors.yAxis, marginRight: '2px'}}>Y</span>
                    <input
                      type="number"
                      value={parseFloat(file.rotation[1].toFixed(3))}
                      onChange={(e) => updateStlRotation(file.id, 'y', e.target.value)}
                      step="1"
                      min="-180"
                      max="180"
                      style={compactInputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{...axisLabelStyle, color: themeColors.zAxis, marginRight: '2px'}}>Z</span>
                    <input
                      type="number"
                      value={parseFloat(file.rotation[2].toFixed(3))}
                      onChange={(e) => updateStlRotation(file.id, 'z', e.target.value)}
                      step="1"
                      min="-180"
                      max="180"
                      style={compactInputStyle}
                    />
                  </div>
                </div>
              </div>

              {/* Scale Controls - compact layout */}
              <div>
                <span style={labelStyle}>Scale</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <input
                    type="number"
                    value={parseFloat(file.scale.toFixed(3))}
                    onChange={(e) => updateStlScale(file.id, e.target.value)}
                    step="0.1"
                    min="0.001"
                    style={{...compactInputStyle, width: '45px'}}
                  />
                  <button
                    onClick={() => resetStlScale(file.id)}
                    disabled={!file.manualScale}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      backgroundColor: 'var(--bg-light)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '3px',
                      cursor: file.manualScale ? 'pointer' : 'default',
                      opacity: file.manualScale ? 1 : 0.5
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', fontSize: '11px', marginTop: '8px' }}>
              <button
                className="toolbar-button"
                onClick={() => centerGeometryAtOrigin(file.id)}
                style={centerButtonStyle} // Using the enhanced button style
              >
                Center
              </button>
              <button
                className="toolbar-button danger"
                onClick={() => removeStlFile(file.id)}
                style={removeButtonStyle}
              >
                Remove
              </button>
            </div>

            {/* Size info in a more compact format */}
            {file.dimensions && (
              <div style={{ 
                marginTop: '6px', 
                fontSize: '10px', 
                opacity: 0.75, 
                textAlign: 'center',
                padding: '3px',
                backgroundColor: 'var(--bg-light)',
                borderRadius: '3px' 
              }}>
                Size: {(file.dimensions[0] * file.scale).toFixed(1)} × {(file.dimensions[1] * file.scale).toFixed(1)} × {(file.dimensions[2] * file.scale).toFixed(1)} mm
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StlPanel;