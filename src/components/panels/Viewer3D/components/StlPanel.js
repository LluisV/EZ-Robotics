import React, { useCallback } from 'react';
import { getThemeColors } from '../utils/themeColors';

/**
 * Component for displaying and managing imported STL files
 */
const StlPanel = ({ stlFiles, setStlFiles }) => {
  const themeColors = getThemeColors();

  // File panel styling
  const stlPanelStyle = {
    width: '250px',
    minWidth: '250px',
    flex: '0 0 250px',
    borderLeft: '1px solid var(--border-color)',
    overflow: 'auto',
    backgroundColor: 'var(--bg-light)',
    borderRadius: 'var(--border-radius)',
    marginLeft: '8px',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s ease'
  };

  // References to the external StlManager component methods
  // For now we'll just use state-based methods
  const stlManager = {};

  // Toggle file visibility
  const toggleStlVisibility = useCallback((fileId) => {
    // Use stlManager if available, otherwise fall back to direct state manipulation
    if (stlManager.toggleStlVisibility) {
      stlManager.toggleStlVisibility(fileId);
    } else {
      setStlFiles(prevFiles => prevFiles.map(file =>
        file.id === fileId ? { ...file, visible: !file.visible } : file
      ));
    }
  }, [setStlFiles, stlManager]);

  // Remove file
  const removeStlFile = useCallback((fileId) => {
    if (stlManager.removeStlFile) {
      stlManager.removeStlFile(fileId);
    } else {
      setStlFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    }
  }, [setStlFiles, stlManager]);

  // Update position
  const updateStlPosition = useCallback((fileId, axis, value) => {
    if (stlManager.updateStlPosition) {
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
    if (stlManager.updateStlRotation) {
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
    if (stlManager.updateStlScale) {
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
    if (stlManager.resetStlScale) {
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
    if (stlManager.centerGeometryAtOrigin) {
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

  return (
    <div style={stlPanelStyle}>
      <div style={{ padding: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Imported STL Files</h3>
      </div>
      <div style={{ padding: '8px', flexGrow: 1, overflowY: 'auto' }}>
        {stlFiles.map((file) => (
          <div
            key={file.id}
            style={{
              marginBottom: '8px',
              padding: '8px',
              borderRadius: 'var(--border-radius)',
              backgroundColor: 'var(--bg-medium)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{
                fontWeight: 'bold',
                fontSize: '12px',
                maxWidth: '180px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {file.name}
              </div>
              <input
                type="checkbox"
                checked={file.visible}
                onChange={() => toggleStlVisibility(file.id)}
                style={{ margin: 0 }}
              />
            </div>

            {/* Position Controls */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Position (mm)</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ width: '12px', fontSize: '10px', color: themeColors.xAxis }}>X:</label>
                <input
                  type="number"
                  value={file.position[0]}
                  onChange={(e) => updateStlPosition(file.id, 'x', e.target.value)}
                  step="1"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ width: '12px', fontSize: '10px', color: themeColors.yAxis }}>Y:</label>
                <input
                  type="number"
                  value={file.position[1]}
                  onChange={(e) => updateStlPosition(file.id, 'y', e.target.value)}
                  step="1"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <label style={{ width: '12px', fontSize: '10px', color: themeColors.zAxis }}>Z:</label>
                <input
                  type="number"
                  value={file.position[2]}
                  onChange={(e) => updateStlPosition(file.id, 'z', e.target.value)}
                  step="1"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
              </div>
            </div>

            {/* Rotation Controls */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Rotation (degrees)</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ width: '12px', fontSize: '10px', color: themeColors.xAxis }}>X:</label>
                <input
                  type="number"
                  value={file.rotation[0]}
                  onChange={(e) => updateStlRotation(file.id, 'x', e.target.value)}
                  step="5"
                  min="-180"
                  max="180"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ width: '12px', fontSize: '10px', color: themeColors.yAxis }}>Y:</label>
                <input
                  type="number"
                  value={file.rotation[1]}
                  onChange={(e) => updateStlRotation(file.id, 'y', e.target.value)}
                  step="5"
                  min="-180"
                  max="180"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <label style={{ width: '12px', fontSize: '10px', color: themeColors.zAxis }}>Z:</label>
                <input
                  type="number"
                  value={file.rotation[2]}
                  onChange={(e) => updateStlRotation(file.id, 'z', e.target.value)}
                  step="5"
                  min="-180"
                  max="180"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
              </div>
            </div>

            {/* Scale Controls */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>Scale</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                <input
                  type="number"
                  value={file.scale}
                  onChange={(e) => updateStlScale(file.id, e.target.value)}
                  step="0.1"
                  min="0.1"
                  style={{
                    flex: 1,
                    fontSize: '10px',
                    padding: '2px 4px',
                    borderRadius: '2px',
                    border: '1px solid var(--border-color)'
                  }}
                />
                <button
                  onClick={() => resetStlScale(file.id)}
                  disabled={!file.manualScale}
                  style={{
                    padding: '2px 4px',
                    fontSize: '10px',
                    opacity: file.manualScale ? 1 : 0.5
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between', fontSize: '11px' }}>
              <button
                className="toolbar-button"
                onClick={() => centerGeometryAtOrigin(file.id)}
                style={{ padding: '2px 4px', fontSize: '10px', flex: 1 }}
              >
                Center
              </button>
              <button
                className="toolbar-button danger"
                onClick={() => removeStlFile(file.id)}
                style={{ padding: '2px 4px', fontSize: '10px', flex: 1 }}
              >
                Remove
              </button>
            </div>

            {/* Size info */}
            {file.dimensions && (
              <div style={{ marginTop: '6px', fontSize: '10px', opacity: 0.8 }}>
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