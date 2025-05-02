import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../styles/code-editor.css'; // Use the existing CSS file
import { useGCode } from '../../../contexts/GCodeContext';
import GCodeSender from '../../../utils/GCodeSender';
import gCodeSerialHelper from '../../../utils/GCodeSerialHelper';
import GCodeValidator from './services/GCodeValidator';
import GrblMetadata from './components/GrblMetadata';

// Import UI components
import EditorHeader from './components/EditorHeader';
import EditorFooter from './components/EditorFooter';
import TransformPanel from './components/TransformPanel';
import TransferProgress from './components/TransferProgress';
import CodeEditor from './components/CodeEditor';

/**
 * Enhanced G-Code Editor with GRBL/FluidNC format support
 * Shows G-code exactly as it is without format conversion
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
  const [codeFormat, setCodeFormat] = useState('unknown'); // 'grbl' or 'standard' (for display only)
  const [showMetadata, setShowMetadata] = useState(true);

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const validationTimeoutRef = useRef(null);
  const gcodeSender = new GCodeSender();
  const gCodeValidator = useRef(new GCodeValidator());

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

  // Detect the G-code format (for display purposes only, no conversion)
  useEffect(() => {
    if (!code) return;
    
    // Simple detection logic
    const sampleLines = code.split('\n').slice(0, 20);
    const grblStyleLines = sampleLines.filter(line => {
      // GRBL often has no spaces between commands (G0X10Y10)
      return /G[0-9][0-9]*[XYZ][0-9]/.test(line) || /\$[A-Z0-9]/.test(line);
    }).length;
    
    const standardStyleLines = sampleLines.filter(line => {
      // Standard G-code often has spaces between commands (G0 X10 Y10)
      return /G[0-9][0-9]*\s+[XYZ]/.test(line);
    }).length;
    
    // Set the format based on the prevalence of each style (for display only)
    if (grblStyleLines > standardStyleLines) {
      setCodeFormat('grbl');
    } else if (standardStyleLines > grblStyleLines) {
      setCodeFormat('standard');
    } else {
      // If equal, check for GRBL-specific commands
      const hasGrblCommands = sampleLines.some(line => line.startsWith('$'));
      setCodeFormat(hasGrblCommands ? 'grbl' : 'standard');
    }
  }, [code]);

  // Update line numbers and stats
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

      // Position cursor at the beginning of the line
      if (editorRef.current) {
        const lines = code.split('\n');
        let position = 0;

        for (let i = 0; i < selectedLine - 1; i++) {
          position += (lines[i] || '').length + 1; // +1 for newline
        }

        editorRef.current.focus();
        editorRef.current.setSelectionRange(position, position);

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

  // Validate G-code with real-time feedback using the enhanced validator
  const validateCode = (codeToValidate) => {
    if (!codeToValidate) {
      setErrors([]);
      setWarnings([]);
      return;
    }
    
    // Use the enhanced validator
    const validationResult = gCodeValidator.current.validate(codeToValidate);
    setErrors(validationResult.errors);
    setWarnings(validationResult.warnings);
    
    // Update status message if current line has errors/warnings
    const currentError = validationResult.errors.find(err => err.line === currentLine);
    const currentWarning = validationResult.warnings.find(warn => warn.line === currentLine);
    
    if (currentError) {
      setStatusMessage(`Error (Line ${currentLine}): ${currentError.message}`);
    } else if (currentWarning) {
      setStatusMessage(`Warning (Line ${currentLine}): ${currentWarning.message}`);
    } else {
      setStatusMessage('');
    }
  };

  // Format G-code to make it more readable without changing the format style
  const formatCode = () => {
    const lines = code.split('\n');
    const formattedLines = lines.map(line => {
      // Skip empty lines or pure comments
      if (!line.trim() || line.trim().startsWith(';') || line.trim().startsWith('(')) return line;

      // Separate commands and comments
      let commandPart = line;
      let commentPart = '';
      
      if (line.includes(';')) {
        [commandPart, commentPart] = line.split(';', 2);
        commentPart = ';' + commentPart;
      } else if (line.includes('(')) {
        const commentStart = line.indexOf('(');
        commandPart = line.substring(0, commentStart);
        commentPart = line.substring(commentStart);
      }
      
      // Clean up whitespace, but preserve the existing format
      commandPart = commandPart.trim();
      
      // Preserve the existing format - don't add or remove spaces
      // Just clean up excessive whitespace
      commandPart = commandPart.replace(/\s+/g, ' ');

      // Reconstruct the line with comment
      return commandPart + (commentPart ? ' ' + commentPart : '');
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

      // Extract X, Y, Z coordinates with regex that works for both formats
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

      // Replace coordinates in the line, preserving the formatting style
      if (x !== null) {
        transformedLine = transformedLine.replace(/X(-?\d+\.?\d*)/, `X${x.toFixed(4)}`);
      }

      if (y !== null) {
        transformedLine = transformedLine.replace(/Y(-?\d+\.?\d*)/, `Y${y.toFixed(4)}`);
      }

      if (z !== null) {
        transformedLine = transformedLine.replace(/Z(-?\d+\.?\d*)/, `Z${z.toFixed(4)}`);
      }

      return transformedLine;
    });

    return transformedLines.join('\n');
  };

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
            setSelectedLine(data.acknowledged);
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

  // Preview transformation
  const previewTransformation = () => {
    const transformedCode = generateTransformedGCode();
    setCode(transformedCode);
    setGCode(transformedCode); // Update context immediately
    setModified(true);
  };

  // Reset transformations
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

      {/* Header with toolbar */}
      <EditorHeader
        fileName={fileName}
        modified={modified}
        transformMode={transformMode}
        setTransformMode={setTransformMode}
        openFile={openFile}
        saveFile={saveFile}
        formatCode={formatCode}
        sendToRobot={sendToRobot}
        isPaused={isPaused}
        pauseTransfer={pauseTransfer}
        resumeTransfer={resumeTransfer}
        stopTransfer={stopTransfer}
        codeFormat={codeFormat}
        showMetadata={showMetadata}
        toggleMetadata={() => setShowMetadata(!showMetadata)}
      />
      
      {/* G-code Metadata Panel */}
      {showMetadata && (
        <GrblMetadata code={code} format={codeFormat} />
      )}

      {/* File transfer progress UI */}
      {isTransferring && (
        <TransferProgress
          statusMessage={statusMessage}
          transferProgress={transferProgress}
          isPaused={isPaused}
          pauseTransfer={pauseTransfer}
          resumeTransfer={resumeTransfer}
          stopTransfer={stopTransfer}
          transferError={transferError}
          retryTransfer={retryTransfer}
          fileName={fileName}
        />
      )}

      {/* Transformation panel */}
      {transformMode === 'transform' && (
        <TransformPanel
          transformValues={transformValues}
          handleTransformValueChange={handleTransformValueChange}
          previewTransformation={previewTransformation}
          saveWithTransformations={saveWithTransformations}
          resetTransformations={resetTransformations}
          closePanel={() => setTransformMode(null)}
        />
      )}

      {/* Code Editor */}
      <CodeEditor
        code={code}
        setCode={handleCodeChange}
        errors={errors}
        warnings={warnings}
        highlightedLine={highlightedLine}
        setHighlightedLine={setHighlightedLine}
        selectedLine={selectedLine}
        setSelectedLine={setSelectedLine}
        setStatusMessage={setStatusMessage}
        validateCode={validateCode}
        editorRef={editorRef}
      />

      {/* Status bar (footer) */}
      <EditorFooter
        currentLine={currentLine}
        currentColumn={currentColumn}
        statusMessage={statusMessage}
        totalLines={totalLines}
        fileSize={fileSize}
        errors={errors}
        warnings={warnings}
        modified={modified}
        codeFormat={codeFormat}
      />
    </div>
  );
};

export default CodeEditorPanel;