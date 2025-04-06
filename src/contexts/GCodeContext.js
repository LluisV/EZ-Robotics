import React, { createContext, useContext, useState, useEffect } from 'react';
import GCodeParser from '../utils/GCodeParser';

// Create the context
const GCodeContext = createContext({
  gcode: '',
  setGCode: () => {},
  parsedToolpath: null,
  selectedLine: -1,
  setSelectedLine: () => {},
  highlightLine: () => {},
});

/**
 * GCode Provider component to manage GCode state and parsing
 */
export const GCodeProvider = ({ children }) => {
  const [gcode, setGCode] = useState('');
  const [parsedToolpath, setParsedToolpath] = useState(null);
  const [selectedLine, setSelectedLine] = useState(-1);
  const [parser] = useState(() => new GCodeParser());
  
  // Update parsed toolpath when gcode changes
  useEffect(() => {
    if (!gcode) {
      setParsedToolpath(null);
      return;
    }
    
    // Parse the GCode
    const toolpath = parser.parse(gcode);
    setParsedToolpath(toolpath);
  }, [gcode, parser]);
  
  // Function to highlight a specific line in the GCode
  const highlightLine = (lineIndex) => {
    setSelectedLine(lineIndex);
  };
  
  // Context value
  const contextValue = {
    gcode,
    setGCode,
    parsedToolpath,
    selectedLine,
    setSelectedLine,
    highlightLine,
  };
  
  return (
    <GCodeContext.Provider value={contextValue}>
      {children}
    </GCodeContext.Provider>
  );
};

/**
 * Hook to use the GCode context
 */
export const useGCode = () => {
  const context = useContext(GCodeContext);
  if (!context) {
    throw new Error('useGCode must be used within a GCodeProvider');
  }
  return context;
};

export default GCodeContext;