import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../styles/code-editor.css';
import { useGCode } from '../../contexts/GCodeContext';
import GCodeSender from '../../utils/GCodeSender';
import gCodeSerialHelper from '../../utils/GCodeSerialHelper';

/**
 * Enhanced G-Code Editor with transformation tools and auto-validation
 */
const CodeEditorPanel = () => {
  // Default basic G-code example
  const DEFAULT_GCODE = '; Basic G-code Example\nG28 ; Home all axes\nG90 ; Set absolute positioning\nG1 Z5 F1000 ; Raise head\nG1 X10 Y10 F2000 ; Move to start position\nG1 Z0.5 ; Lower to working height\nG1 X50 Y10 ; Draw line\nG1 X50 Y50 ; Draw line\nG1 X10 Y50 ; Draw line\nG1 X10 Y10 ; Return to start\nG1 Z5 ; Raise head';

  const { gcode, setGCode, selectedLine, setSelectedLine, transformValues, setTransformValues } = useGCode();

  // Initialize using the context value or default
  const [originalCode, setOriginalCode] = useState(() => gcode || DEFAULT_GCODE);
  const [code, setCode] = useState(() => gcode || DEFAULT_GCODE);
  const [fileName, setFileName] = useState('untitled.gcode');
  const [currentLine, setCurrentLine] = useState(1);
  const [currentColumn, setCurrentColumn] = useState(1);
  const [highlightedLine, setHighlightedLine] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [fileSize, setFileSize] = useState('0 B');
  const [modified, setModified] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [transformMode, setTransformMode] = useState(null); // 'scale', 'move', 'rotate'
  const [statusMessage, setStatusMessage] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferError, setTransferError] = useState(null);
  const [lastProgress, setLastProgress] = useState(0); // Progress tracking for logging

  const editorRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const fileInputRef = useRef(null);
  const validationTimeoutRef = useRef(null);
  const gcodeSender = new GCodeSender();

  // Initialize the editor with the current gcode from context
  useEffect(() => {
    if (!code && gcode) {
      setCode(gcode);
    } else if (!gcode && code) {
      setGCode(code);
    }
  }, [code, gcode, setGCode]);

  useEffect(() => {
    if (window.serialService) {
      gCodeSerialHelper.initialize(window.serialService);
    }
    
    // Clean up when the component unmounts
    return () => {
      gCodeSerialHelper.cleanup();
      
      // Also stop any ongoing transfer
      if (gcodeSender.current) {
        gcodeSender.current.stop();
      }
    };
  }, []);

  // Handle code changes with auto-validation
  const handleCodeChange = (newCode) => {
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
  };

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

  // Initialize transform values when opening a new file
  useEffect(() => {
    if (code) {
      const boundaries = calculateBoundaries(code);
      setTransformValues(prev => ({
        ...prev,
        centerX: boundaries.centerX,
        centerY: boundaries.centerY
      }));
    }
  }, [code, calculateBoundaries, setTransformValues]);

  useEffect(() => {
    if (!code) return;

    const lines = code.split('\n');
    setTotalLines(lines.length);

    // Update line numbers
    if (lineNumbersRef.current) {
      lineNumbersRef.current.innerHTML = lines
        .map((_, i) => {
          const lineNum = i + 1;
          const hasError = errors.some(err => err.line === lineNum);
          const hasWarning = warnings.some(warn => warn.line === lineNum);
          const errorMsg = errors.find(err => err.line === lineNum)?.message || '';
          const warningMsg = warnings.find(warn => warn.line === lineNum)?.message || '';
          const tooltipMsg = errorMsg || warningMsg;

          let className = "line-number";

          if (lineNum === highlightedLine) className += ' active';
          if (hasError) className += ' error';
          if (hasWarning) className += ' warning';

          const tooltipAttr = tooltipMsg ? ` data-tooltip="${tooltipMsg}"` : '';

          return `<div class="${className}"${tooltipAttr} title="${tooltipMsg || ''}">${lineNum}</div>`;
        })
        .join('');
    }

    // Calculate approximate file size
    const sizeInBytes = new Blob([code]).size;
    if (sizeInBytes < 1024) {
      setFileSize(`${sizeInBytes} B`);
    } else if (sizeInBytes < 1024 * 1024) {
      setFileSize(`${(sizeInBytes / 1024).toFixed(1)} KB`);
    } else {
      setFileSize(`${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`);
    }

    // Ensure the editor and line numbers have the same scroll position
    if (editorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
    }
  }, [code, highlightedLine, errors, warnings]);

  // Update when selected line in context changes
  useEffect(() => {
    if (selectedLine >= 0 && selectedLine !== highlightedLine) {
      setHighlightedLine(selectedLine);

      // Position cursor at the beginning of the line
      if (editorRef.current) {
        const lines = code.split('\n');
        let position = 0;

        for (let i = 0; i < selectedLine - 1; i++) {
          position += (lines[i] || '').length + 1; // +1 for newline
        }

        editorRef.current.focus();
        editorRef.current.setSelectionRange(position, position);

        // Also scroll to the line
        const lineHeight = 20; // Approximate line height in pixels
        if (lineNumbersRef.current) {
          lineNumbersRef.current.scrollTop = (selectedLine - 5) * lineHeight; // -5 to show some context
        }

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
    }
  }, [selectedLine, highlightedLine, code, errors, warnings]);

  // Synchronize scrolling between editor and line numbers
  const syncScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Handle clicking on line numbers
  const handleLineNumberClick = (lineNumber) => {
    setHighlightedLine(lineNumber);
    setSelectedLine(lineNumber);

    // Place cursor at the beginning of the selected line
    const lines = code.split('\n');
    let position = 0;

    for (let i = 0; i < lineNumber - 1; i++) {
      position += lines[i].length + 1; // +1 for newline
    }

    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.setSelectionRange(position, position);
    }
  };

  // Apply syntax highlighting for G-code
  const getHighlightedCode = (text) => {
    if (!text) return '';
  
    const lines = text.split('\n');
  
    // Highlight each line
    const highlightedLines = lines.map((line, i) => {
      const lineNum = i + 1;
      const hasError = errors.some(err => err.line === lineNum);
      const hasWarning = warnings.some(warn => warn.line === lineNum);
  
      // Get specific error/warning message
      const errorMsg = errors.find(err => err.line === lineNum)?.message || '';
      const warningMsg = warnings.find(warn => warn.line === lineNum)?.message || '';
      const tooltipMsg = errorMsg || warningMsg;
  
      // Highlight comments
      let highlightedLine = line.replace(/;(.*)$/, '<span class="code-comment">;$1</span>');
  
      // Highlight G and M commands (with or without spaces)
      highlightedLine = highlightedLine.replace(/([GMT]\d+\.?\d*)/g, '<span class="code-command">$1</span>');
  
      // Highlight parameters (X100, Y50, Z10, F1000) without spaces
      highlightedLine = highlightedLine.replace(/([XYZFIJKRPQSE])(-?\d+\.?\d*)/g, 
        '<span class="code-param">$1</span><span class="code-value">$2</span>');
  
      let lineClass = "code-line";
      if (lineNum === highlightedLine) lineClass += ' highlighted-line';
      if (hasError) lineClass += ' error-line';
      if (hasWarning) lineClass += ' warning-line';
  
      // Add tooltip with error/warning message
      const tooltipAttr = tooltipMsg ? ` data-tooltip="${tooltipMsg}"` : '';
  
      // Ensure consistent content for empty lines
      return `<div class="${lineClass}"${tooltipAttr}>${highlightedLine || ' '}</div>`;
    });
  
    return highlightedLines.join('');
  };

  // Handle cursor position and update error status
  const handleCursorPosition = () => {
    if (!editorRef.current) return;

    const pos = editorRef.current.selectionStart;
    const codeUpToCursor = code.substring(0, pos);
    const linesUpToCursor = codeUpToCursor.split('\n');

    const line = linesUpToCursor.length;
    const col = linesUpToCursor[linesUpToCursor.length - 1].length + 1;

    setCurrentLine(line);
    setCurrentColumn(col);
    setHighlightedLine(line);
    setSelectedLine(line);

    // Update status message if current line has errors/warnings
    const lineError = errors.find(err => err.line === line);
    const lineWarning = warnings.find(warn => warn.line === line);

    if (lineError) {
      setStatusMessage(`Error (Line ${line}): ${lineError.message}`);
    } else if (lineWarning) {
      setStatusMessage(`Warning (Line ${line}): ${lineWarning.message}`);
    } else {
      setStatusMessage('');
    }
  };

  // Validate G-code with real-time feedback
  const validateCode = (codeToValidate) => {
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
  };

  // Format G-code
  const formatCode = () => {
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
  };

  // Save file
  const saveFile = () => {
    // Create a blob and download link
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setModified(false);
  };

  // Open file using the browser's file API
  const openFile = () => {
    fileInputRef.current.click();
  };

  // Handle file selection
  const handleFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      setCode(content);
      setOriginalCode(content);  // Store the original code
      setGCode(content);         // Update the global context immediately
      setModified(false);
      validateCode(content);

      // Update file size based on actual file size
      if (file.size < 1024) {
        setFileSize(`${file.size} B`);
      } else if (file.size < 1024 * 1024) {
        setFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      } else {
        setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      }

      // Update line count
      setTotalLines(content.split('\n').length);

      // Calculate G-code boundaries for transformations
      const boundaries = calculateBoundaries(content);
      setTransformValues(prev => ({
        ...prev,
        centerX: boundaries.centerX,
        centerY: boundaries.centerY
      }));

      // Reset transformations
      setTransformValues(prev => ({
        ...prev,
        scaleX: 1.0,
        scaleY: 1.0,
        scaleZ: 1.0,
        moveX: 0,
        moveY: 0,
        moveZ: 0,
        rotateAngle: 0,
        centerX: boundaries.centerX,  // Keep the same center
        centerY: boundaries.centerY
      }));
    };
    reader.readAsText(file);

    // Reset the file input to allow selecting the same file again
    e.target.value = null;
  };

  // Generate transformed G-code based on current transformation parameters
  const generateTransformedGCode = () => {
    if (!originalCode) return '';

    const lines = originalCode.split('\n');
    const transformedLines = lines.map(line => {
      // Skip comments and non-movement commands
      if (line.trim().startsWith(';') || !line.trim()) return line;
      if (!/G[0-1]/.test(line)) return line;

      // Extract X, Y, Z coordinates
      let transformedLine = line;
      const xMatch = line.match(/X(-?\d+\.?\d*)/);
      const yMatch = line.match(/Y(-?\d+\.?\d*)/);
      const zMatch = line.match(/Z(-?\d+\.?\d*)/);

      let x = xMatch ? parseFloat(xMatch[1]) : null;
      let y = yMatch ? parseFloat(yMatch[1]) : null;
      let z = zMatch ? parseFloat(zMatch[1]) : null;

      // Apply transformations in sequence: scale, rotate, then move
      if (x !== null && y !== null) {
        // First apply scaling relative to center
        if (transformValues.scaleX !== 1.0 && x !== null) {
          x = (x - transformValues.centerX) * transformValues.scaleX + transformValues.centerX;
        }

        if (transformValues.scaleY !== 1.0 && y !== null) {
          y = (y - transformValues.centerY) * transformValues.scaleY + transformValues.centerY;
        }

        // Then apply rotation around center
        if (transformValues.rotateAngle !== 0 && x !== null && y !== null) {
          const relX = x - transformValues.centerX;
          const relY = y - transformValues.centerY;
          const angleRad = (transformValues.rotateAngle * Math.PI) / 180;

          const rotatedX = relX * Math.cos(angleRad) - relY * Math.sin(angleRad) + transformValues.centerX;
          const rotatedY = relX * Math.sin(angleRad) + relY * Math.cos(angleRad) + transformValues.centerY;

          x = rotatedX;
          y = rotatedY;
        }

        // Finally apply translation
        if (transformValues.moveX !== 0 && x !== null) {
          x += transformValues.moveX;
        }

        if (transformValues.moveY !== 0 && y !== null) {
          y += transformValues.moveY;
        }
      }

      // Apply Z scaling and movement
      if (z !== null) {
        if (transformValues.scaleZ !== 1.0) {
          z = z * transformValues.scaleZ;
        }

        if (transformValues.moveZ !== 0) {
          z += transformValues.moveZ;
        }
      }

      // Replace coordinates in the line
      if (x !== null) {
        transformedLine = transformedLine.replace(/X(-?\d+\.?\d*)/, `X${x.toFixed(3)}`);
      }

      if (y !== null) {
        transformedLine = transformedLine.replace(/Y(-?\d+\.?\d*)/, `Y${y.toFixed(3)}`);
      }

      if (z !== null) {
        transformedLine = transformedLine.replace(/Z(-?\d+\.?\d*)/, `Z${z.toFixed(3)}`);
      }

      return transformedLine;
    });

    return transformedLines.join('\n');
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper function to log messages to the console panel
  const logToConsole = (type, message) => {
    // Create a custom event to log to console panel
    const event = new CustomEvent('consoleEntry', { 
      detail: { type, content: message }
    });
    document.dispatchEvent(event);
  };

  /**
   * Send G-code to robot using GRBL protocol with improved reliability
   */
  const sendToRobot = async () => {
    // Check if the serialService is available and connected
    if (!window.serialService || !window.serialService.getConnectionStatus()) {
      const errorMsg = "Cannot send G-code: Not connected to machine";
      logToConsole('error', errorMsg);
      setStatusMessage(errorMsg);
      setTransferError(errorMsg);
      return;
    }
  
    const gCodeToSend = code;
    if (!gCodeToSend.trim()) {
      const emptyMsg = "No G-code content to send";
      logToConsole('error', emptyMsg);
      setStatusMessage(emptyMsg);
      return;
    }
  
    try {
      // Start file transfer UI updates
      setIsTransferring(true);
      setTransferProgress(0);
      setTransferError(null);
      setIsPaused(false);
      setLastProgress(0); // Reset last logged progress
      
      // Load the G-code
      const totalLines = gcodeSender.loadGCode(gCodeToSend);
      const totalBytes = new Blob([gCodeToSend]).size;
      
      // Log to console panel that we're starting transfer
      logToConsole('system', `Starting transfer: ${fileName} (${totalBytes} bytes, ${totalLines} lines)`);
      
      // Set up the callbacks for simplified sender
      gcodeSender.setCallbacks({
        onProgress: (data) => {
          // Update progress UI
          setTransferProgress(data.progress);
          
          // Format progress message with line information
          setStatusMessage(
            `Transferring: ${data.progress.toFixed(1)}% (${data.acknowledged}/${data.total} lines)`
          );
          
          // Log progress occasionally (every 5%)
          const currentProgressFloor = Math.floor(data.progress);
          if (currentProgressFloor % 5 === 0 && 
              currentProgressFloor !== Math.floor(lastProgress)) {
            logToConsole('info', 
              `Transfer progress: ${data.progress.toFixed(1)}% (${data.acknowledged}/${data.total} lines)`
            );
            setLastProgress(data.progress);
          }
          
          // Highlight current line in editor
          if (data.acknowledged > 0 && data.acknowledged <= totalLines) {
            //setSelectedLine(data.acknowledged);
          }
        },
        
        onComplete: (data) => {
          // Update UI for completion
          setTransferProgress(100);
          setIsTransferring(false);
          
          const completeMsg = `Transfer completed: ${fileName} (${data.total} lines)`;
          logToConsole('system', completeMsg);
          setStatusMessage(completeMsg);
          
          // Clear line highlight after transfer
          setTimeout(() => {
            setSelectedLine(-1);
          }, 2000);
        },
        
        onError: (error) => {
          // Log error
          logToConsole('error', `Transfer error: ${error}`);
          
          // Update error message in UI
          setTransferError(error);
        },
        
        onLineSuccess: (lineIndex, lineContent) => {
          // Log each successful line (more detailed logging for line-by-line mode)
          logToConsole('debug', `Sent line ${lineIndex+1}: ${lineContent}`);
        },
        
        onLineError: (lineIndex, lineContent, errorMessage) => {
          // Always log line errors
          logToConsole('error', `Error at line ${lineIndex+1}: ${errorMessage} - ${lineContent}`);
          
          // Highlight the line with error
          setSelectedLine(lineIndex + 1);
          
          // Add retry information to status
          const status = gcodeSender.getStatus();
          setStatusMessage(`Error at line ${lineIndex+1} - Retry ${status.retryCount}/${status.maxRetries}`);
        },
        
        onPause: (reason) => {
          logToConsole('warning', `Transfer paused: ${reason || 'User requested'}`);
          setStatusMessage(`Transfer paused: ${reason || 'User requested'}`);
          setIsPaused(true);
        },
        
        onResume: () => {
          logToConsole('info', 'Transfer resumed');
          setIsPaused(false);
          setStatusMessage(`Transfer resumed`);
        },
        
        onStatusUpdate: (status) => {
          // Update machine status display with controller state
          const statusText = `Machine state: ${status.state} | Position: X${status.position[0].toFixed(3)} Y${status.position[1].toFixed(3)} Z${status.position[2].toFixed(3)} | Feed rate: ${status.feedRate}`;
          
          // Update status display in UI
          document.dispatchEvent(new CustomEvent('machineStatus', { 
            detail: status 
          }));
        }
      });
      
      // Start the transfer - the 'false' parameter means not to use check mode
      const success = await gcodeSender.start(window.serialService, false);
      
      if (!success) {
        throw new Error("Failed to start G-code transfer");
      }
      
      // The transfer is now running asynchronously line-by-line
      
    } catch (error) {
      const errorMsg = `Error sending G-code to machine: ${error.message}`;
      console.error(errorMsg);
      logToConsole('error', errorMsg);
      setTransferError(`Error: ${error.message}`);
      setIsTransferring(false);
      
      // Make sure to stop the sender
      gcodeSender.stop();
    }
  };

  /**
   * Pause the current transfer
   */
  const pauseTransfer = () => {
    if (gcodeSender && gcodeSender.pause) {
      const success = gcodeSender.pause();
      if (success) {
        setIsPaused(true);
        setStatusMessage('Transfer paused - machine feed hold active');
        
        // Log to console panel
        logToConsole('warning', 'Transfer paused by user');
      }
    }
  };

  /**
   * Resume the current transfer
   */
  const resumeTransfer = () => {
    if (gcodeSender && gcodeSender.resume) {
      const success = gcodeSender.resume();
      if (success) {
        setIsPaused(false);
        setStatusMessage('Transfer resumed - continuing from paused position');
        
        // Log to console panel
        logToConsole('info', 'Transfer resumed by user');
      }
    }
  };

  /**
   * Stop/cancel the current transfer
   */
  const stopTransfer = () => {
    if (gcodeSender && gcodeSender.stop) {
      const success = gcodeSender.stop();
      if (success) {
        setIsPaused(false);
        setIsTransferring(false);
        setTransferProgress(0);
        setStatusMessage('Transfer stopped - machine operation cancelled');
        
        // Log to console panel
        logToConsole('error', 'Transfer stopped by user');
        
      }
    }
  };

  /**
   * Retry the transfer after an error
   */
  const retryTransfer = () => {
    if (!isTransferring && transferError) {
      setTransferError(null);
      sendToRobot();
    }
  };

  /**
   * Display detailed status information for the transfer
   */
  const showDetailedStatus = () => {
    const status = gcodeSender.getStatus();
    const statusMsg = `
      Progress: ${status.progress.toFixed(1)}%
      Lines sent: ${status.linesSent}/${status.totalLines}
      Lines acknowledged: ${status.linesAcknowledged}/${status.totalLines}
      Buffer usage: ${status.bufferUsed}/${status.bufferSize} bytes (${status.bufferUsagePercent.toFixed(1)}%)
      Remaining lines: ${status.remainingLines}
      Unacknowledged lines: ${status.unacknowledgedLines}
    `;
    
    // This could show in a modal or status panel
    logToConsole('info', statusMsg);
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };


  // Preview transformation - shows what the transformed G-code would look like
  const previewTransformation = () => {
    const transformedCode = generateTransformedGCode();
    setCode(transformedCode);
    setGCode(transformedCode); // Update context immediately
    setModified(true);
  };

  // Reset transformations and restore original code
  const resetTransformations = () => {
    setTransformValues({
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      moveX: 0,
      moveY: 0,
      moveZ: 0,
      rotateAngle: 0,
      centerX: transformValues.centerX,  // Keep the same center
      centerY: transformValues.centerY
    });

    // Restore original code
    setCode(originalCode);
    setGCode(originalCode); // Update context immediately
    setModified(false);
  };

  // Update transform values without modifying the code
  const handleTransformValueChange = (e) => {
    const { name, value } = e.target;
    const newValues = {
      ...transformValues,
      [name]: parseFloat(value)
    };

    // Update the context with new transform values
    setTransformValues(newValues);

    // Generate preview code without updating the editor
    // This allows the toolpath to update immediately
    const previewCode = generateTransformedGCode();
    setGCode(previewCode);
  };

  // Cancel transformation
  const cancelTransform = () => {
    setTransformMode(null);
  };

  // Save the code with transformations applied
  const saveWithTransformations = () => {
    const transformedCode = generateTransformedGCode();
    setCode(transformedCode);
    setOriginalCode(transformedCode);  // This becomes the new original code
    setGCode(transformedCode);        // Update context immediately

    // Reset transformations since they're now part of the code
    setTransformValues({
      scaleX: 1.0,
      scaleY: 1.0,
      scaleZ: 1.0,
      moveX: 0,
      moveY: 0,
      moveZ: 0,
      rotateAngle: 0,
      centerX: transformValues.centerX,
      centerY: transformValues.centerY
    });

    setModified(true);
  };

  return (
    <div className="gcode-editor-panel">
      {/* Hidden file input for file opening */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelected}
        accept=".gcode,.nc,.ngc"
      />

      {/* Toolbar at the top */}
      <div className="editor-toolbar">
        <div className="toolbar-section">
          {/* File operations */}
          <button className="toolbar-btn" onClick={openFile}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h6"/>
              <path d="M14 15v4M12 17h4"/>
            </svg>
          </button>
          <button className="toolbar-btn" onClick={saveFile}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
          </button>
          
          <span className="toolbar-divider"></span>
          
          {/* Code operations */}
          <button className="toolbar-btn" onClick={formatCode}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10H3M21 6H3M21 14H3M21 18H3"/>
            </svg>
          </button>
          
          {/* Single transform button */}
          <button
            className={`toolbar-btn ${transformMode ? 'active' : ''}`}
            onClick={() => transformMode ? setTransformMode(null) : setTransformMode('transform')}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          
          <span className="toolbar-divider"></span>
          
          {/* Execution controls with colored icons */}
          <button 
            className="toolbar-btn action-btn" 
            onClick={sendToRobot}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--play-color, #4CAF50)" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          
          <button 
            className="toolbar-btn action-btn" 
            onClick={isPaused ? resumeTransfer : pauseTransfer}
          >
            {isPaused ? (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--resume-color, #2196F3)" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--pause-color, #FF9800)" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            )}
          </button>
          
          <button 
            className="toolbar-btn action-btn" 
            onClick={stopTransfer}
          >
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--stop-color, #F44336)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
          </button>
        </div>

        <div className="file-info">
          <div className="file-name">
            <span className="file-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </span>
            <span className="name">{fileName}</span>
            {modified && <span className="modified-indicator">●</span>}
          </div>
        </div>
      </div>

      {/* File Transfer Progress UI */}
      {isTransferring && (
  <div className="transfer-container">
    <div className="transfer-progress-container">
      <div className="transfer-status">
        <div className="status-indicator-wrapper">
          <div className="status-indicator"></div>
          <span className="status-text">{statusMessage || `Transferring: ${fileName}`}</span>
        </div>

        {/* Control buttons - fixed position on right */}
        <div className="transfer-controls">
          {isPaused ? (
            <button
              className="toolbar-btn resume-btn"
              onClick={resumeTransfer}
              title="Resume transfer"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--resume-color, #2196F3)" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          ) : (
            <button
              className="toolbar-btn pause-btn"
              onClick={pauseTransfer}
              title="Pause transfer"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--pause-color, #FF9800)" strokeWidth="2">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          )}

          <button
            className="toolbar-btn stop-btn"
            onClick={stopTransfer}
            title="Stop transfer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--stop-color, #F44336)" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            </svg>
          </button>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${transferProgress}%` }}
        ></div>
      </div>

      <div className="progress-text">
        {`${transferProgress.toFixed(1)}% completed`}
      </div>

      {transferError && (
        <div className="transfer-error">
          <div className="error-message">{transferError}</div>
          <button onClick={retryTransfer} className="retry-btn">Retry</button>
        </div>
      )}
    </div>
  </div>
)}

      {/* Transformation panel - combined into one unified interface */}
      {transformMode === 'transform' && (
        <div className="transform-panel">
          <div className="transform-header">
            <h3>Transform G-code</h3>
            <button className="close-btn" onClick={() => setTransformMode(null)}>×</button>
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
      )}

      {/* Editor container */}
      <div className="editor-container">
        <div
          className="line-numbers"
          ref={lineNumbersRef}
          onClick={(e) => {
            const lineNum = parseInt(e.target.textContent);
            if (!isNaN(lineNum)) {
              handleLineNumberClick(lineNum);
            }
          }}
        ></div>
        <div className="editor-wrapper">
          <textarea
            ref={editorRef}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onScroll={syncScroll}
            onKeyUp={handleCursorPosition}
            onClick={handleCursorPosition}
            spellCheck="false"
            className="editor-textarea"
          />
          <pre className="editor-highlighting" dangerouslySetInnerHTML={{ __html: getHighlightedCode(code) }}></pre>
        </div>
      </div>

      {/* Status bar (footer) */}
      <div className="editor-footer">
        <div className="editor-status-bar">
          <div className="status-section cursor-position">
            <span className="position-text">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
              Ln {currentLine}, Col {currentColumn}
            </span>
          </div>

          {statusMessage && (
            <div className="status-section message-section">
              <span className={`status-message ${errors.some(e => e.line === currentLine) ? 'error' : 'warning'}`}>
                {statusMessage}
              </span>
            </div>
          )}

          <div className="status-section editor-info">
            <span className="info-item">{totalLines} lines</span>
            <span className="status-divider">|</span>
            <span className="info-item">G-code</span>
            <span className="status-divider">|</span>
            <span className="info-item">UTF-8</span>
            <span className="status-divider">|</span>
            <span className="info-item">{fileSize}</span>
            {errors.length > 0 && (
              <>
                <span className="status-divider">|</span>
                <span className="info-item error">{errors.length} error{errors.length !== 1 ? 's' : ''}</span>
              </>
            )}
            {warnings.length > 0 && (
              <>
                <span className="status-divider">|</span>
                <span className="info-item warning">{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
              </>
            )}
          </div>

          <div className="status-section editor-mode">
            <span className={`mode-indicator ${modified ? 'modified' : ''}`}>
              {modified ? 'Modified' : 'Saved'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorPanel;