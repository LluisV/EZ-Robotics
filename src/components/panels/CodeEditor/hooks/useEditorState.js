import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Custom hook for managing editor state
 */
const useEditorState = (initialGcode, setGCode) => {
  // Default basic G-code example
  const DEFAULT_GCODE = '; Basic G-code Example\nG28 ; Home all axes\nG90 ; Set absolute positioning\nG1 Z5 F1000 ; Raise head\nG1 X10 Y10 F2000 ; Move to start position\nG1 Z0.5 ; Lower to working height\nG1 X50 Y10 ; Draw line\nG1 X50 Y50 ; Draw line\nG1 X10 Y50 ; Draw line\nG1 X10 Y10 ; Return to start\nG1 Z5 ; Raise head';

  // Initialize using the context value or default
  const [originalCode, setOriginalCode] = useState(() => initialGcode || DEFAULT_GCODE);
  const [code, setCode] = useState(() => initialGcode || DEFAULT_GCODE);
  const [currentLine, setCurrentLine] = useState(1);
  const [currentColumn, setCurrentColumn] = useState(1);
  const [highlightedLine, setHighlightedLine] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [fileSize, setFileSize] = useState('0 B');
  const [modified, setModified] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedLine, setSelectedLine] = useState(-1);

  const validationTimeoutRef = useRef(null);

  // Initialize the editor with the current gcode from context
  useEffect(() => {
    if (!code && initialGcode) {
      setCode(initialGcode);
    } else if (!initialGcode && code) {
      setGCode(code);
    }
  }, [code, initialGcode, setGCode]);

  // Update when code changes
  useEffect(() => {
    if (!code) return;

    const lines = code.split('\n');
    setTotalLines(lines.length);

    // Calculate approximate file size
    const sizeInBytes = new Blob([code]).size;
    if (sizeInBytes < 1024) {
      setFileSize(`${sizeInBytes} B`);
    } else if (sizeInBytes < 1024 * 1024) {
      setFileSize(`${(sizeInBytes / 1024).toFixed(1)} KB`);
    } else {
      setFileSize(`${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`);
    }
  }, [code]);

  // Update when selected line changes
  useEffect(() => {
    if (selectedLine >= 0 && selectedLine !== highlightedLine) {
      setHighlightedLine(selectedLine);

      // Show error message for the selected line if it has an error
      const error = errors.find(err => err.line === selectedLine);
      const warning = warnings.find(warn => warn.line === selectedLine);

      if (error) {
        setStatusMessage(`Error (Line ${selectedLine}): ${error.message}`);
      } else if (warning) {
        setStatusMessage(`Warning (Line ${selectedLine}): ${warning.message}`);
      } else {
        setStatusMessage('');
      }
    }
  }, [selectedLine, highlightedLine, errors, warnings]);

  // Handle code changes with auto-validation
  const handleCodeChange = useCallback((newCode) => {
    setCode(newCode);
    setOriginalCode(newCode);  // Update the original code
    setGCode(newCode);         // Update the global context immediately
    setModified(true);

    // Debounced validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      validateCode(newCode);
    }, 500); // 500ms debounce to avoid excessive validation
  }, [setGCode]);

  // Validate G-code with real-time feedback
  const validateCode = useCallback((codeToValidate) => {
    const validationErrors = [];
    const validationWarnings = [];
  
    const VALID_PREFIXES = ['G', 'M', 'T', 'X', 'Y', 'Z', 'F', 'I', 'J', 'K', 'R', 'P', 'Q', 'E', 'S'];
  
    const lines = codeToValidate.split('\n');
    lines.forEach((line, i) => {
      const lineNum = i + 1;
  
      // Remove inline comments
      let cleanedLine = line.replace(/\(.*?\)/g, ''); // remove (comment)
      cleanedLine = cleanedLine.split(';')[0];        // remove ;comment
      cleanedLine = cleanedLine.trim();
  
      if (!cleanedLine) return;
  
      // For GRBL format, we need to extract commands differently
      // We'll use regex to find all valid commands in the format of letter followed by numbers
      const commands = cleanedLine.match(/[A-Z]-?\d+(\.\d+)?/g) || [];
      
      commands.forEach(command => {
        const prefix = command.charAt(0).toUpperCase();
        const value = command.slice(1);
  
        if (!VALID_PREFIXES.includes(prefix)) {
          validationErrors.push({
            line: lineNum,
            message: `Unknown command or parameter '${command}'`
          });
        } else if ((prefix === 'G' || prefix === 'M') && !/^\d+(\.\d+)?$/.test(value)) {
          validationErrors.push({
            line: lineNum,
            message: `Invalid ${prefix}-code '${command}' — expected a number after ${prefix}`
          });
        } else if (!['G', 'M', 'T'].includes(prefix) && !/^-?\d+(\.\d+)?$/.test(value)) {
          validationErrors.push({
            line: lineNum,
            message: `Invalid value for parameter ${prefix}: '${value}' is not numeric`
          });
        }
      });
  
      // G0/G1 checks - modified for GRBL format
      if (/G0/.test(cleanedLine) || /G1/.test(cleanedLine)) {
        if (!/[XYZ]/.test(cleanedLine)) {
          validationWarnings.push({
            line: lineNum,
            message: 'G0/G1 command has no axis movement specified'
          });
        }
      }
  
      // High speed warning
      const speedMatch = cleanedLine.match(/F(\d+(\.\d+)?)/);
      if (speedMatch) {
        const speed = parseFloat(speedMatch[1]);
        if (speed > 5000) {
          validationWarnings.push({
            line: lineNum,
            message: `Very high speed (F${speed}) may cause issues`
          });
        }
      }
  
      // G2/G3 arc parameter check - modified for GRBL format
      if (/G2/.test(cleanedLine) || /G3/.test(cleanedLine)) {
        if (!/[IJR]/.test(cleanedLine)) {
          validationErrors.push({
            line: lineNum,
            message: 'Arc command missing I/J or R parameter'
          });
        }
      }
    });
  
    setErrors(validationErrors);
    setWarnings(validationWarnings);
  
    const currentError = validationErrors.find(err => err.line === currentLine);
    const currentWarning = validationWarnings.find(warn => warn.line === currentLine);
  
    if (currentError) {
      setStatusMessage(`Error (Line ${currentLine}): ${currentError.message}`);
    } else if (currentWarning) {
      setStatusMessage(`Warning (Line ${currentLine}): ${currentWarning.message}`);
    } else {
      setStatusMessage('');
    }
  }, [currentLine]);

  // Format G-code
  const formatCode = useCallback(() => {
    const lines = code.split('\n');
    const formattedLines = lines.map(line => {
      // Skip empty lines or pure comments
      if (!line.trim() || line.trim().startsWith(';')) return line;

      // Separate commands and comments
      const parts = line.split(';');
      const command = parts[0].trim();
      const comment = parts.length > 1 ? parts.slice(1).join(';') : '';

      // Format command with consistent spacing
      let formattedCommand = command;
      formattedCommand = formattedCommand.replace(/([GM]\d+)/, '$1 ');
      formattedCommand = formattedCommand.replace(/([XYZFIJKRPQ])(-?\d+\.?\d*)(?!\S)/g, '$1$2 ');

      // Reconstruct the line with comment
      let formattedLine = formattedCommand.trim();
      if (comment) {
        formattedLine += ' ; ' + comment.trim();
      }

      return formattedLine;
    });

    const formattedCode = formattedLines.join('\n');
    setCode(formattedCode);
    setGCode(formattedCode); // Update context immediately
    setModified(true);
  }, [code, setGCode]);

  // Calculate boundary dimensions of the G-code for transformations
  const calculateBoundaries = useCallback((codeToAnalyze) => {
    if (!codeToAnalyze) return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, centerX: 0, centerY: 0 };

    const lines = codeToAnalyze.split('\n');
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let hasCoordinates = false;

    lines.forEach(line => {
      // Skip comments and non-movement commands
      if (line.trim().startsWith(';') || !line.trim()) return;
      if (!/G[0-1]/.test(line)) return;

      // Extract X, Y, Z coordinates
      const xMatch = line.match(/X(-?\d+\.?\d*)/);
      const yMatch = line.match(/Y(-?\d+\.?\d*)/);
      const zMatch = line.match(/Z(-?\d+\.?\d*)/);

      if (xMatch) {
        const x = parseFloat(xMatch[1]);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        hasCoordinates = true;
      }

      if (yMatch) {
        const y = parseFloat(yMatch[1]);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        hasCoordinates = true;
      }

      if (zMatch) {
        const z = parseFloat(zMatch[1]);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
        hasCoordinates = true;
      }
    });

    // If no coordinates found, return default values
    if (!hasCoordinates) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, centerX: 0, centerY: 0 };
    }

    // Calculate the geometric center
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return { minX, maxX, minY, maxY, minZ, maxZ, centerX, centerY };
  }, []);

  return {
    code,
    setCode: handleCodeChange,
    originalCode,
    setOriginalCode,
    currentLine,
    setCurrentLine,
    currentColumn,
    setCurrentColumn,
    highlightedLine,
    setHighlightedLine,
    totalLines,
    fileSize,
    modified,
    setModified,
    errors,
    warnings,
    statusMessage,
    setStatusMessage,
    selectedLine,
    setSelectedLine,
    validateCode,
    formatCode,
    calculateBoundaries
  };
};

export default useEditorState;