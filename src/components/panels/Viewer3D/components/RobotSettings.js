import React, { useState, useEffect } from 'react';
import { Bot, Save, Upload, Plus, Trash2, Eye, EyeOff, Settings2 } from 'lucide-react';
import { getAvailableRobots, getPredefinedRobot, exportRobotConfig, importRobotConfig } from '../robot/predefinedRobots';

/**
 * Robot Settings Component
 * Provides UI for configuring DH robot parameters
 */
const RobotSettings = ({
  showRobot,
  setShowRobot,
  robotConfig,
  setRobotConfig,
  onConfigChange
}) => {
  const [editMode, setEditMode] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('cartesian-3dof');
  const [dhParameters, setDhParameters] = useState(robotConfig?.dhParameters || []);
  const [visualSettings, setVisualSettings] = useState({
    showJointAxes: true,
    showJointLabels: false,
    wireframe: false,
    opacity: 1.0
  });
  
  // Load initial robot configuration
  useEffect(() => {
    if (!robotConfig && selectedPreset) {
      const preset = getPredefinedRobot(selectedPreset);
      if (preset) {
        setDhParameters(preset.dhParameters);
        if (onConfigChange) {
          onConfigChange(preset);
        }
      }
    }
  }, []);

  // Handle preset selection
  const handlePresetChange = (e) => {
    const presetId = e.target.value;
    setSelectedPreset(presetId);
    
    const preset = getPredefinedRobot(presetId);
    if (preset) {
      setDhParameters(preset.dhParameters);
      if (onConfigChange) {
        onConfigChange(preset);
      }
    }
  };

  // Handle DH parameter changes
  const handleDHParamChange = (jointIndex, param, value) => {
    const newParams = [...dhParameters];
    newParams[jointIndex] = {
      ...newParams[jointIndex],
      [param]: parseFloat(value) || 0
    };
    setDhParameters(newParams);
    
    if (onConfigChange) {
      onConfigChange({
        ...robotConfig,
        dhParameters: newParams
      });
    }
  };

  // Add a new joint
  const handleAddJoint = () => {
    const newParams = [...dhParameters, { a: 100, alpha: 0, d: 0 }];
    setDhParameters(newParams);
    
    if (onConfigChange) {
      onConfigChange({
        ...robotConfig,
        dhParameters: newParams
      });
    }
  };

  // Remove a joint
  const handleRemoveJoint = (index) => {
    const newParams = dhParameters.filter((_, i) => i !== index);
    setDhParameters(newParams);
    
    if (onConfigChange) {
      onConfigChange({
        ...robotConfig,
        dhParameters: newParams
      });
    }
  };

  // Export configuration
  const handleExport = () => {
    const config = {
      name: robotConfig?.name || 'Custom Robot',
      dhParameters,
      visualSettings
    };
    
    const json = exportRobotConfig(config);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'robot-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import configuration
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = importRobotConfig(e.target.result);
      if (result.success) {
        setDhParameters(result.config.dhParameters);
        if (result.config.visualSettings) {
          setVisualSettings(result.config.visualSettings);
        }
        if (onConfigChange) {
          onConfigChange(result.config);
        }
      } else {
        alert('Failed to import configuration: ' + result.error);
      }
    };
    reader.readAsText(file);
  };

  // Handle visual settings changes
  const handleVisualSettingChange = (setting, value) => {
    const newSettings = { ...visualSettings, [setting]: value };
    setVisualSettings(newSettings);
    
    if (onConfigChange) {
      onConfigChange({
        ...robotConfig,
        visualSettings: newSettings
      });
    }
  };

  return (
    <div className="robot-settings">
      <div className="robot-settings-header">
        <label className="robot-checkbox-label">
          <input
            type="checkbox"
            checked={showRobot}
            onChange={(e) => setShowRobot(e.target.checked)}
            className="robot-checkbox"
          />
          <Bot size={14} style={{ marginRight: '6px' }} />
          <span>Show DH Robot</span>
        </label>
      </div>
      
      {showRobot && (
        <div className="robot-settings-content">
          {/* Preset Selection */}
          <div className="robot-preset-section">
            <label className="robot-setting-label">
              <Settings2 size={12} />
              <span>Robot Type:</span>
            </label>
            <select
              value={selectedPreset}
              onChange={handlePresetChange}
              className="robot-select"
            >
              {getAvailableRobots().map(robot => (
                <option key={robot.id} value={robot.id}>
                  {robot.name}
                </option>
              ))}
            </select>
          </div>

          {/* Visual Settings */}
          <div className="robot-visual-settings">
            <div className="robot-setting-row">
              <label className="robot-checkbox-label">
                <input
                  type="checkbox"
                  checked={visualSettings.showJointAxes}
                  onChange={(e) => handleVisualSettingChange('showJointAxes', e.target.checked)}
                />
                <span>Joint Axes</span>
              </label>
              
              <label className="robot-checkbox-label">
                <input
                  type="checkbox"
                  checked={visualSettings.showJointLabels}
                  onChange={(e) => handleVisualSettingChange('showJointLabels', e.target.checked)}
                />
                <span>Joint Labels</span>
              </label>
              
              <label className="robot-checkbox-label">
                <input
                  type="checkbox"
                  checked={visualSettings.wireframe}
                  onChange={(e) => handleVisualSettingChange('wireframe', e.target.checked)}
                />
                <span>Wireframe</span>
              </label>
            </div>
            
            <div className="robot-slider-container">
              <label className="robot-slider-label">Opacity:</label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={visualSettings.opacity}
                onChange={(e) => handleVisualSettingChange('opacity', parseFloat(e.target.value))}
                className="robot-slider"
              />
              <span className="robot-slider-value">{(visualSettings.opacity * 100).toFixed(0)}%</span>
            </div>
          </div>

          {/* DH Parameters Editor */}
          <div className="robot-dh-editor">
            <div className="dh-editor-header">
              <h4>DH Parameters</h4>
              <button
                onClick={() => setEditMode(!editMode)}
                className="edit-mode-btn"
                title={editMode ? "View Mode" : "Edit Mode"}
              >
                {editMode ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
            
            {editMode ? (
              <div className="dh-parameters-edit">
                <table className="dh-table">
                  <thead>
                    <tr>
                      <th>Joint</th>
                      <th>a (mm)</th>
                      <th>α (°)</th>
                      <th>d (mm)</th>
                      <th>θ (°)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dhParameters.map((params, index) => (
                      <tr key={index}>
                        <td>J{index + 1}</td>
                        <td>
                          <input
                            type="number"
                            value={params.a || 0}
                            onChange={(e) => handleDHParamChange(index, 'a', e.target.value)}
                            className="dh-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={params.alpha || 0}
                            onChange={(e) => handleDHParamChange(index, 'alpha', e.target.value)}
                            className="dh-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={params.d || 0}
                            onChange={(e) => handleDHParamChange(index, 'd', e.target.value)}
                            className="dh-input"
                            disabled={params.theta !== undefined}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={params.theta !== undefined ? params.theta * 180 / Math.PI : 'var'}
                            onChange={(e) => handleDHParamChange(index, 'theta', e.target.value * Math.PI / 180)}
                            className="dh-input"
                            disabled={params.theta === undefined}
                          />
                        </td>
                        <td>
                          <button
                            onClick={() => handleRemoveJoint(index)}
                            className="remove-joint-btn"
                            title="Remove Joint"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <button
                  onClick={handleAddJoint}
                  className="add-joint-btn"
                >
                  <Plus size={14} />
                  Add Joint
                </button>
              </div>
            ) : (
              <div className="dh-parameters-view">
                <div className="dh-summary">
                  <span className="dh-joint-count">{dhParameters.length} Joints</span>
                  <span className="dh-type">{selectedPreset}</span>
                </div>
              </div>
            )}
          </div>

          {/* Import/Export Buttons */}
          <div className="robot-io-buttons">
            <button
              onClick={handleExport}
              className="robot-btn export-btn"
              title="Export Configuration"
            >
              <Save size={14} />
              Export
            </button>
            
            <label className="robot-btn import-btn" title="Import Configuration">
              <Upload size={14} />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default RobotSettings;