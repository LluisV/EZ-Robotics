import React from 'react';
import { Grid3x3, Box } from 'lucide-react';

/**
 * ViewToggle component with more descriptive icons
 * for orthographic and perspective views and matching divider
 */
const ViewToggle = ({ isPerspective, togglePerspective }) => {
  return (
    <div className="view-buttons-group">
      <label className="toggle-switch active-toggle" title="Orthographic View (Parallel projection)">
        <input
          type="checkbox"
          checked={!isPerspective}
          onChange={togglePerspective}
        />
        <span className="toggle-label">
          <span className="toggle-icon">
            <Grid3x3 size={14} />
          </span>
          Ortho
        </span>
        <span className={`toggle-indicator ${!isPerspective ? 'on' : 'off'}`}></span>
      </label>
      
      <div className="controls-divider"></div>
      
      <label className="toggle-switch active-toggle" title="Perspective View (3D projection)">
        <input
          type="checkbox"
          checked={isPerspective}
          onChange={togglePerspective}
        />
        <span className="toggle-label">
          <span className="toggle-icon">
            <Box size={14} />
          </span>
          Persp
        </span>
        <span className={`toggle-indicator ${isPerspective ? 'on' : 'off'}`}></span>
      </label>
    </div>
  );
};

export default ViewToggle;