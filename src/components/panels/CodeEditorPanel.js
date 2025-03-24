import React, { useState } from 'react';

/**
 * Code Editor Panel component for editing G-code and other scripts.
 * 
 * @param {Object} props Component properties
 * @param {string} props.language The language mode for the editor
 */
const CodeEditorPanel = ({ language = 'gcode' }) => {
  const [code, setCode] = useState(
    '; Example G-code\nG28 ; Home all axes\nG1 X100 Y100 Z10 F1000 ; Move to position\nG1 Z2 ; Lower to working height\nG1 X150 Y150 ; Draw diagonal line\nG1 X100 Y150 ; Draw horizontal line\nG1 X100 Y100 ; Return to start\nG1 Z10 ; Raise head'
  );

  const [fileName, setFileName] = useState('example.gcode');

  return (
    <div className="panel-content">
      <div className="panel-header">
        <div className="panel-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          {fileName} - G-Code Editor
        </div>
        <div>
          <select 
            className="toolbar-select"
            value={language} 
            onChange={(e) => {}}
          >
            <option value="gcode">G-Code</option>
            <option value="python">Python</option>
          </select>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 40px)' }}>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="code-editor"
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px',
            fontSize: '14px',
          }}
          spellCheck="false"
        />
        
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
          <button className="toolbar-button">Validate</button>
          <button className="toolbar-button">Format</button>
          <button className="toolbar-button primary">Send to Robot</button>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorPanel;