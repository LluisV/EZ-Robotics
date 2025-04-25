import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../styles/code-editor.css';
import { useGCode } from '../../contexts/GCodeContext';
import communicationService from '../../services/communication/CommunicationService';

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
  
  const editorRef = useRef(null);
  const lineNumbersRef = useRef(null);
  const fileInputRef = useRef(null);
  const validationTimeoutRef = useRef(null);

  // Initialize the editor with the current gcode from context
  useEffect(() => {
    if (!code && gcode) {
      setCode(gcode);
    } else if (!gcode && code) {
      setGCode(code);
    }
  }, [code, gcode, setGCode]);

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
      
      // Highlight G and M commands
      highlightedLine = highlightedLine.replace(/\b([GM]\d+)\b/g, '<span class="code-command">$1</span>');
      
      // Highlight parameters (X100, Y50, Z10, F1000)
      highlightedLine = highlightedLine.replace(/\b([XYZFIJKRPQ])(-?\d+\.?\d*)/g, '<span class="code-param">$1</span><span class="code-value">$2</span>');
      
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
  
    const VALID_PREFIXES = ['G', 'M', 'X', 'Y', 'Z', 'F', 'I', 'J', 'K', 'R', 'P', 'Q', 'E'];
  
    const lines = codeToValidate.split('\n');
    lines.forEach((line, i) => {
      const lineNum = i + 1;
  
      // Remove inline comments
      let cleanedLine = line.replace(/\(.*?\)/g, ''); // remove (comment)
      cleanedLine = cleanedLine.split(';')[0];        // remove ;comment
      cleanedLine = cleanedLine.trim();
  
      if (!cleanedLine) return;
  
      // Tokenize and validate
      const tokens = cleanedLine.split(/\s+/);
      tokens.forEach(token => {
        const prefix = token.charAt(0).toUpperCase();
        const value = token.slice(1);
  
        if (!VALID_PREFIXES.includes(prefix)) {
          validationErrors.push({
            line: lineNum,
            message: `Unknown command or parameter '${token}'`
          });
        } else if ((prefix === 'G' || prefix === 'M') && !/^\d+$/.test(value)) {
          validationErrors.push({
            line: lineNum,
            message: `Invalid ${prefix}-code '${token}' — expected a number after ${prefix}`
          });
        } else if (!['G', 'M'].includes(prefix) && !/^-?\d+(\.\d+)?$/.test(value)) {
          validationErrors.push({
            line: lineNum,
            message: `Invalid value for parameter ${prefix}: '${value}' is not numeric`
          });
        }
      });
  
      // G0/G1 checks
      if (/\bG0\b/.test(cleanedLine) || /\bG1\b/.test(cleanedLine)) {
        if (!/[XYZE]/.test(cleanedLine)) {
          validationWarnings.push({ 
            line: lineNum, 
            message: 'G0/G1 command has no axis movement specified' 
          });
        }
      }
  
      // High speed warning
      const speedMatch = cleanedLine.match(/F(\d+)/);
      if (speedMatch) {
        const speed = parseInt(speedMatch[1]);
        if (speed > 5000) {
          validationWarnings.push({ 
            line: lineNum, 
            message: `Very high speed (F${speed}) may cause issues` 
          });
        }
      }
  
      // G2/G3 arc parameter check
      if (/\bG2\b/.test(cleanedLine) || /\bG3\b/.test(cleanedLine)) {
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

  // Send G-code to robot
  // Replace just the sendToRobot method in the CodeEditorPanel.js
// This updated version will work with GRBL protocol

/**
 * Send G-code to robot using GRBL protocol
 */
const sendToRobot = async () => {
  try {
    // Check connection
    const connectionInfo = communicationService.getConnectionInfo();
    if (connectionInfo.status !== 'connected') {
      setStatusMessage('Error: Not connected to robot. Please connect first.');
      return;
    }

    // Generate and normalize code
    const transformedCode = generateTransformedGCode();
    const normalizedCode = transformedCode.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
    
    // Set up transfer tracking
    setIsTransferring(true);
    setTransferProgress(0);
    setTransferError(null);
    setStatusMessage('Starting G-code transfer...');
    
    // Send the G-code file with progress tracking
    await communicationService.sendGCodeFile(normalizedCode, (progressData) => {
      // Handle progress updates
      switch (progressData.status) {
        case 'started':
          setStatusMessage(`Starting transfer of ${progressData.totalLines} lines...`);
          setTransferProgress(0);
          break;
        
        case 'progress':
          setStatusMessage(`Sending line ${progressData.line}/${progressData.totalLines} (${progressData.progress}%)`);
          setTransferProgress(progressData.progress);
          break;
        
        case 'completed':
          setStatusMessage(`Transfer completed: ${progressData.totalLines} lines`);
          setTransferProgress(100);
          setTimeout(() => setIsTransferring(false), 2000); // Hide progress after 2 seconds
          break;
        
        case 'error':
          setTransferError(progressData.error || 'Unknown error');
          setStatusMessage(`Transfer failed: ${progressData.error || 'Unknown error'}`);
          setIsTransferring(false);
          break;
      }
    });
  } catch (error) {
    console.error('Error during G-code transfer:', error);
    setStatusMessage(`Transfer failed: ${error.message}`);
    setTransferError(error.message);
    setIsTransferring(false);
  }
};

  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferError, setTransferError] = useState(null);
  
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const retryTransfer = () => {
    if (!isTransferring && transferError) {
      sendToRobot();
    }
  };

  // Handler for file transfer progress events
  const handleFileTransferProgress = (data) => {
    switch (data.status) {
      case 'started':
        setStatusMessage(`Starting transfer of ${data.fileName}...`);
        setTransferProgress(0);
        break;
      
      case 'progress':
        setStatusMessage(`Transferring: ${data.progress}% (${formatBytes(data.bytesTransferred)} / ${formatBytes(data.bytesTotal)})`);
        setTransferProgress(data.progress);
        break;
      
      case 'completed':
        setStatusMessage(`Transfer completed: ${data.fileName}`);
        setTransferProgress(100);
        break;
      
      case 'error':
      case 'cancelled':
        setTransferError(data.error || data.reason || 'Unknown error');
        setStatusMessage(`Transfer failed: ${data.error || data.reason || 'Unknown error'}`);
        break;
    }
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
          <button className="toolbar-btn" onClick={openFile} title="Open file (Ctrl+O)">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
          </button>
          <button className="toolbar-btn" onClick={saveFile} title="Save file (Ctrl+S)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
          </button>
          <span className="toolbar-divider"></span>
          <button className="toolbar-btn" onClick={formatCode} title="Format code (Shift+Alt+F)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="10" x2="3" y2="10"></line>
              <line x1="21" y1="6" x2="3" y2="6"></line>
              <line x1="21" y1="14" x2="3" y2="14"></line>
              <line x1="21" y1="18" x2="3" y2="18"></line>
            </svg>
          </button>
          <span className="toolbar-divider"></span>
          {/* Transform Tools */}
          <button 
            className={`toolbar-btn ${transformMode === 'scale' ? 'active' : ''}`} 
            onClick={() => setTransformMode(transformMode === 'scale' ? null : 'scale')}
            title="Scale G-code"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11V5a2 2 0 0 0-2-2H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h6"></path>
              <path d="M16 21h6v-6"></path>
              <path d="M16 16l6 6"></path>
            </svg>
          </button>
          <button 
            className={`toolbar-btn ${transformMode === 'move' ? 'active' : ''}`} 
            onClick={() => setTransformMode(transformMode === 'move' ? null : 'move')}
            title="Move G-code"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 9l-3 3 3 3"></path>
              <path d="M9 5l3-3 3 3"></path>
              <path d="M15 19l3 3 3-3"></path>
              <path d="M19 9l3 3-3 3"></path>
              <path d="M2 12h20"></path>
              <path d="M12 2v20"></path>
            </svg>
          </button>
          <button 
            className={`toolbar-btn ${transformMode === 'rotate' ? 'active' : ''}`} 
            onClick={() => setTransformMode(transformMode === 'rotate' ? null : 'rotate')}
            title="Rotate G-code"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6"></path>
              <path d="M2.5 12a10 10 0 0 1 10-10c4.8 0 8.4 3.3 9.5 8"></path>
              <path d="M2.5 12a10 10 0 0 0 10 10c4.8 0 8.9-3.8 9.8-8.5"></path>
              <path d="M12 7v5l4 2"></path>
            </svg>
          </button>
          <span className="toolbar-divider"></span>
          <button className="toolbar-btn primary" onClick={sendToRobot} title="Run G-code (F5)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
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
  <div className="transfer-progress-container">
    <div className="transfer-status">
      <div className="status-indicator"></div>
      <span>{statusMessage || `Transferring: ${fileName}`}</span>
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
)}
      
      {/* Transformation panel */}
      {transformMode && (
        <div className="transform-panel">
          <div className="transform-header">
            <h3>{transformMode === 'scale' ? 'Scale' : transformMode === 'move' ? 'Move' : 'Rotate'} G-code</h3>
            <button className="close-btn" onClick={cancelTransform}>×</button>
          </div>
          <div className="transform-controls">
            {transformMode === 'scale' && (
              <>
                <div className="control-group">
                  <label>Scale X:</label>
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
                  <label>Scale Y:</label>
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
                  <label>Scale Z:</label>
                  <input 
                    type="number" 
                    name="scaleZ" 
                    value={transformValues.scaleZ} 
                    onChange={handleTransformValueChange} 
                    step="0.1"
                    min="0.1"
                  />
                </div>
                <div className="control-group">
                  <label>Center X:</label>
                  <input 
                    type="number" 
                    name="centerX" 
                    value={transformValues.centerX} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
                <div className="control-group">
                  <label>Center Y:</label>
                  <input 
                    type="number" 
                    name="centerY" 
                    value={transformValues.centerY} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
              </>
            )}
            
            {transformMode === 'move' && (
              <>
                <div className="control-group">
                  <label>Move X:</label>
                  <input 
                    type="number" 
                    name="moveX" 
                    value={transformValues.moveX} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
                <div className="control-group">
                  <label>Move Y:</label>
                  <input 
                    type="number" 
                    name="moveY" 
                    value={transformValues.moveY} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
                <div className="control-group">
                  <label>Move Z:</label>
                  <input 
                    type="number" 
                    name="moveZ" 
                    value={transformValues.moveZ} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
              </>
            )}
            
            {transformMode === 'rotate' && (
              <>
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
                <div className="control-group">
                  <label>Center X:</label>
                  <input 
                    type="number" 
                    name="centerX" 
                    value={transformValues.centerX} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
                <div className="control-group">
                  <label>Center Y:</label>
                  <input 
                    type="number" 
                    name="centerY" 
                    value={transformValues.centerY} 
                    onChange={handleTransformValueChange} 
                    step="1"
                  />
                </div>
              </>
            )}
            
            <div className="transform-actions">
              <button 
                className="preview-transform-btn" 
                onClick={previewTransformation}
                title="Preview transformations in the editor"
              >
                Preview
              </button>
              <button 
                className="apply-transform-btn" 
                onClick={saveWithTransformations}
                title="Apply transformations permanently to the code"
              >
                Apply
              </button>
              <button 
                className="reset-transform-btn" 
                onClick={resetTransformations}
                title="Reset to original code"
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