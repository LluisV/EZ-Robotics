import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../../../styles/code-editor.css';
import { useGCode } from '../../../contexts/GCodeContext';
import EnhancedGCodeSender from '../../../utils/GCodeSender';
import gCodeSerialHelper from '../../../utils/GCodeSerialHelper';
import GCodeValidator from './services/GCodeValidator';
import GrblMetadata from './components/GrblMetadata';
import { disposeMonacoEditor } from '../../../utils/setupMonaco';

// Import UI components
import EditorHeader from './components/EditorHeader';
import EditorFooter from './components/EditorFooter';
import TransformPanel from './components/TransformPanel';
import TransferProgress from './components/TransferProgress';
import ExecutionTracker from './components/ExecutionTracker';
import MonacoEditor from './components/MonacoEditor'; // Monaco-based editor

/**
 * Enhanced G-Code Editor with GRBL/FluidNC format support and execution tracking
 * PERFORMANCE OPTIMIZATION: Uses Monaco Editor for efficient rendering of large files
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
  const [totalLines, setTotalLines] = useState(0);
  const [fileSize, setFileSize] = useState('0 B');
  const [modified, setModified] = useState(false);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [transformMode, setTransformMode] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferError, setTransferError] = useState(null);
  const [lastProgress, setLastProgress] = useState(0);
  const [codeFormat, setCodeFormat] = useState('unknown');
  const [showMetadata, setShowMetadata] = useState(true);
  
  // Execution tracking state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executedLine, setExecutedLine] = useState(0);
  const [executionProgress, setExecutionProgress] = useState(0);

  const fileInputRef = useRef(null);
  const monacoRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const validationTimeoutRef = useRef(null);
  const gcodeSender = useRef(new EnhancedGCodeSender());
  const gCodeValidator = useRef(new GCodeValidator());
  const resizeObserverRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // Initialize the editor with the current gcode from context
  useEffect(() => {
    if (!code && gcode) {
      setCode(gcode);
    } else if (!gcode && code) {
      setGCode(code);
    }
  }, [code, gcode, setGCode]);

  // Initialize services and cleanup properly on unmount
  useEffect(() => {
    if (window.serialService) {
      gCodeSerialHelper.initialize(window.serialService);
    }
    
    // Return cleanup function
    return () => {
      // Cleanup serial communication
      gCodeSerialHelper.cleanup();
      
      // Stop any ongoing transfer
      if (gcodeSender.current) {
        gcodeSender.current.stop();
      }
      
      // Cleanup resize observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      
      // Clear any pending timeouts
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }
      
      // Properly dispose of Monaco editor to prevent memory leaks
      if (editorInstanceRef.current) {
        disposeMonacoEditor(editorInstanceRef.current);
        editorInstanceRef.current = null;
      }
      
      // Reset state variables that might cause re-renders
      setIsTransferring(false);
      setIsExecuting(false);
      setTransferProgress(0);
      setExecutionProgress(0);
      setExecutedLine(0);
      setTransferError(null);
      
      // Dispose of validator resources
      if (gCodeValidator.current) {
        gCodeValidator.current.dispose && gCodeValidator.current.dispose();
      }
    };
  }, []);

  // Set up a custom resize handler for the Monaco editor
  const setupEditorResizeHandling = useCallback(() => {
    // First clean up any existing observer
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    
    if (!editorInstanceRef.current) return;
    
    // Find the container element
    const editorContainer = document.querySelector('.monaco-editor-container');
    if (!editorContainer) return;
    
    // Create a new ResizeObserver with throttling to avoid loop errors
    resizeObserverRef.current = new ResizeObserver((entries) => {
      // Clear any pending timeout to implement throttling
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      // Set a new timeout to delay the resize handling
      resizeTimeoutRef.current = setTimeout(() => {
        if (!editorInstanceRef.current) return;
        
        // Call layout() to resize the editor
        try {
          editorInstanceRef.current.layout();
        } catch (err) {
          console.warn("Error resizing editor:", err);
        }
      }, 100); // 100ms throttle
    });
    
    // Start observing the container
    resizeObserverRef.current.observe(editorContainer);
  }, []);

  // Handle code changes with auto-validation
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    setOriginalCode(newCode);
    setGCode(newCode);
    setModified(true);

    // Debounced validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    validationTimeoutRef.current = setTimeout(() => {
      validateCode(newCode);
      updateFileStats(newCode);
      detectCodeFormat(newCode);
    }, 500);
  };

  // Update line numbers and stats
  const updateFileStats = useCallback((content) => {
    if (!content) return;

    const lines = content.split('\n');
    setTotalLines(lines.length);

    // Calculate approximate file size
    const sizeInBytes = new Blob([content]).size;
    if (sizeInBytes < 1024) {
      setFileSize(`${sizeInBytes} B`);
    } else if (sizeInBytes < 1024 * 1024) {
      setFileSize(`${(sizeInBytes / 1024).toFixed(1)} KB`);
    } else {
      setFileSize(`${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`);
    }
  }, []);

  // Detect the G-code format
  const detectCodeFormat = useCallback((content) => {
    if (!content) return;
    
    // For performance, only check the first 50 lines
    const sampleLines = content.split('\n').slice(0, 50);
    
    const grblStyleLines = sampleLines.filter(line => {
      return /G[0-9][0-9]*[XYZ][0-9]/.test(line) || /\$[A-Z0-9]/.test(line);
    }).length;
    
    const standardStyleLines = sampleLines.filter(line => {
      return /G[0-9][0-9]*\s+[XYZ]/.test(line);
    }).length;
    
    if (grblStyleLines > standardStyleLines) {
      setCodeFormat('grbl');
    } else if (standardStyleLines > grblStyleLines) {
      setCodeFormat('standard');
    } else {
      const hasGrblCommands = sampleLines.some(line => line.startsWith('$'));
      setCodeFormat(hasGrblCommands ? 'grbl' : 'standard');
    }
  }, []);

  // Calculate boundary dimensions of the G-code for transformations
  const calculateBoundaries = useCallback((codeToAnalyze) => {
    if (!codeToAnalyze) return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0, centerX: 0, centerY: 0 };

    // For large files, only analyze a subset of lines for performance
    const lines = codeToAnalyze.split('\n');
    const maxLinesToAnalyze = Math.min(lines.length, 5000);
    const step = Math.max(1, Math.floor(lines.length / maxLinesToAnalyze));
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let hasCoordinates = false;

    for (let i = 0; i < lines.length; i += step) {
      const line = lines[i];
      // Skip comments and non-movement commands
      if (line.trim().startsWith(';') || !line.trim()) continue;
      if (!/G[0-1]/.test(line)) continue;

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
    }

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

  // Update when selected line changes
  useEffect(() => {
    if (selectedLine >= 0 && editorInstanceRef.current) {
      // Monaco handles line highlighting more efficiently
      editorInstanceRef.current.revealLineInCenter(selectedLine);
    }
  }, [selectedLine]);

  // Update when executed line changes
  useEffect(() => {
    if (executedLine > 0 && editorInstanceRef.current) {
      setSelectedLine(executedLine);
      editorInstanceRef.current.decorateExecutedLine(executedLine);
    }
  }, [executedLine, setSelectedLine]);

  // Validate G-code with real-time feedback using the validator
  const validateCode = (codeToValidate) => {
    if (!codeToValidate || !editorInstanceRef.current) {
      setErrors([]);
      setWarnings([]);
      return;
    }
    
    // Use the worker-based validator for large files
    const validationResult = gCodeValidator.current.validate(codeToValidate);
    setErrors(validationResult.errors);
    setWarnings(validationResult.warnings);
    
    // Apply diagnostics to Monaco editor
    editorInstanceRef.current.setDiagnostics(validationResult.errors, validationResult.warnings);
    
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

  // Format G-code to make it more readable
  const formatCode = () => {
    if (!editorInstanceRef.current) return;
    
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
      commandPart = commandPart.replace(/\s+/g, ' ');

      // Reconstruct the line with comment
      return commandPart + (commentPart ? ' ' + commentPart : '');
    });

    const formattedCode = formattedLines.join('\n');
    editorInstanceRef.current.setValue(formattedCode);
    setCode(formattedCode);
    setGCode(formattedCode);
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

    // For large files, use a chunk-based approach
    if (file.size > 10 * 1024 * 1024) { // 10MB
      // Show loading message
      setStatusMessage('Loading large file...');
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        if (editorInstanceRef.current) {
          editorInstanceRef.current.setValue(content);
        }
        setCode(content);
        setOriginalCode(content);
        setGCode(content);
        setModified(false);
        updateFileStats(content);
        detectCodeFormat(content);
        
        // Delayed validation for large files
        setTimeout(() => {
          validateCode(content);
          
          // Calculate boundaries in background
          setTimeout(() => {
            const boundaries = calculateBoundaries(content);
            setTransformValues(prev => ({
              ...prev,
              centerX: boundaries.centerX,
              centerY: boundaries.centerY,
              scaleX: 1.0,
              scaleY: 1.0,
              scaleZ: 1.0,
              moveX: 0,
              moveY: 0,
              moveZ: 0,
              rotateAngle: 0
            }));
            
            setStatusMessage('');
          }, 100);
        }, 500);
      };
      
      reader.readAsText(file);
    } else {
      // Standard approach for smaller files
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        if (editorInstanceRef.current) {
          editorInstanceRef.current.setValue(content);
        }
        setCode(content);
        setOriginalCode(content);
        setGCode(content);
        setModified(false);
        validateCode(content);
        updateFileStats(content);
        detectCodeFormat(content);

        // Calculate G-code boundaries for transformations
        const boundaries = calculateBoundaries(content);
        setTransformValues(prev => ({
          ...prev,
          centerX: boundaries.centerX,
          centerY: boundaries.centerY,
          scaleX: 1.0,
          scaleY: 1.0,
          scaleZ: 1.0,
          moveX: 0,
          moveY: 0,
          moveZ: 0,
          rotateAngle: 0
        }));
      };
      reader.readAsText(file);
    }

    // Reset the file input to allow selecting the same file again
    e.target.value = null;
  };

  // Generate transformed G-code based on current transformation parameters
  const generateTransformedGCode = () => {
    if (!originalCode) return '';

    // For large files, use a web worker or chunk-based approach
    if (originalCode.length > 1000000) { // ~1MB
      setStatusMessage('Processing large file transformation...');
      
      // Process in chunks to avoid freezing the UI
      setTimeout(() => {
        const transformedCode = transformGCode(originalCode);
        if (editorInstanceRef.current) {
          editorInstanceRef.current.setValue(transformedCode);
        }
        setCode(transformedCode);
        setGCode(transformedCode);
        setModified(true);
        setStatusMessage('');
      }, 100);
      
      return '';
    }
    
    // For smaller files, transform synchronously
    return transformGCode(originalCode);
  };
  
  // Helper function to transform G-code (extracted for potential worker use)
  const transformGCode = (sourceCode) => {
    const lines = sourceCode.split('\n');
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
   * and execution tracking
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
      setIsExecuting(true);
      setTransferProgress(0);
      setExecutionProgress(0);
      setExecutedLine(0);
      setTransferError(null);
      setIsPaused(false);
      setLastProgress(0);
      
      // Load the G-code
      const totalLines = gcodeSender.current.loadGCode(gCodeToSend);
      const totalBytes = new Blob([gCodeToSend]).size;
      
      // Log to console panel that we're starting transfer
      logToConsole('system', `Starting transfer: ${fileName} (${totalBytes} bytes, ${totalLines} lines)`);
      
      // Set up the callbacks
      gcodeSender.current.setCallbacks({
        // Send progress callback
        onProgress: (data) => {
          // Update transfer progress UI
          setTransferProgress(data.progress);
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
        },
        
        // Execution progress callback
        onExecutionProgress: (data) => {
          // Update execution progress
          setExecutionProgress(data.progress);
          setExecutedLine(data.executed);
        },
        
        // Transfer complete callback
        onComplete: (data) => {
          // Update UI for completion
          setTransferProgress(100);
          setIsTransferring(false);
          
          const completeMsg = `Transfer completed: ${fileName} (${data.total} lines)`;
          logToConsole('system', completeMsg);
          setStatusMessage(completeMsg);
        },
        
        // Execution complete callback
        onExecutionComplete: (data) => {
          // Update UI for execution completion
          setExecutionProgress(100);
          setIsExecuting(false);
          
          const completeMsg = `Execution completed: ${fileName}`;
          logToConsole('system', completeMsg);
          setStatusMessage(completeMsg);
          
          // Clear line highlight after execution
          setTimeout(() => {
            setSelectedLine(-1);
            setExecutedLine(0);
            if (editorInstanceRef.current) {
              editorInstanceRef.current.clearExecutionDecorations();
            }
          }, 2000);
        },
        
        // Error callback
        onError: (error) => {
          // Log error
          logToConsole('error', `Transfer error: ${error}`);
          
          // Update error message in UI
          setTransferError(error);
        },
        
        // Line success callback
        onLineSuccess: (lineIndex, lineContent) => {
          // Only log detailed line info for smaller files
          if (totalLines < 100) {
            logToConsole('debug', `Sent line ${lineIndex+1}: ${lineContent}`);
          }
        },
        
        // Line error callback
        onLineError: (lineIndex, lineContent, errorMessage) => {
          // Always log line errors
          logToConsole('error', `Error at line ${lineIndex+1}: ${errorMessage} - ${lineContent}`);
          
          // Highlight the line with error
          setSelectedLine(lineIndex + 1);
          
          // Add retry information to status
          const status = gcodeSender.current.getStatus();
          setStatusMessage(`Error at line ${lineIndex+1} - Retry ${status.retryCount}/${status.maxRetries}`);
        },
        
        // Pause callback
        onPause: (reason) => {
          logToConsole('warning', `Transfer paused: ${reason || 'User requested'}`);
          setStatusMessage(`Transfer paused: ${reason || 'User requested'}`);
          setIsPaused(true);
        },
        
        // Resume callback
        onResume: () => {
          logToConsole('info', 'Transfer resumed');
          setIsPaused(false);
          setStatusMessage(`Transfer resumed`);
        },
        
        // Status update callback
        onStatusUpdate: (status) => {
          // Update machine status display with controller state
          // Extract executed line from status
          if (status.executedLine !== undefined && status.executedLine >= 0) {
            setExecutedLine(status.executedLine);
          }
          
          // Update machine status display
          document.dispatchEvent(new CustomEvent('machineStatus', { 
            detail: {
              state: status.state,
              position: status.position,
              feedRate: status.feedRate,
              executedLine: status.executedLine
            }
          }));
        }
      });
      
      // Start the transfer - the 'false' parameter means not to use check mode
      const success = await gcodeSender.current.start(window.serialService, false);
      
      if (!success) {
        throw new Error("Failed to start G-code transfer");
      }
      
    } catch (error) {
      const errorMsg = `Error sending G-code to machine: ${error.message}`;
      console.error(errorMsg);
      logToConsole('error', errorMsg);
      setTransferError(`Error: ${error.message}`);
      setIsTransferring(false);
      setIsExecuting(false);
      
      // Make sure to stop the sender
      gcodeSender.current.stop();
    }
  };

  /**
   * Pause the current transfer
   */
  const pauseTransfer = () => {
    if (gcodeSender.current && gcodeSender.current.pause) {
      const success = gcodeSender.current.pause();
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
    if (gcodeSender.current && gcodeSender.current.resume) {
      const success = gcodeSender.current.resume();
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
    if (gcodeSender.current && gcodeSender.current.stop) {
      const success = gcodeSender.current.stop();
      if (success) {
        setIsPaused(false);
        setIsTransferring(false);
        setIsExecuting(false);
        setTransferProgress(0);
        setExecutionProgress(0);
        setExecutedLine(0);
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
    if (!isTransferring && !isExecuting && transferError) {
      setTransferError(null);
      sendToRobot();
    }
  };

  // Preview transformation
  const previewTransformation = () => {
    const transformedCode = generateTransformedGCode();
    if (transformedCode && editorInstanceRef.current) {
      editorInstanceRef.current.setValue(transformedCode);
      setCode(transformedCode);
      setGCode(transformedCode);
      setModified(true);
    }
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
      centerX: transformValues.centerX,
      centerY: transformValues.centerY
    });

    // Restore original code
    if (editorInstanceRef.current) {
      editorInstanceRef.current.setValue(originalCode);
    }
    setCode(originalCode);
    setGCode(originalCode);
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
  };

  // Save the code with transformations applied
  const saveWithTransformations = () => {
    const transformedCode = generateTransformedGCode();
    if (transformedCode && editorInstanceRef.current) {
      editorInstanceRef.current.setValue(transformedCode);
      setCode(transformedCode);
      setOriginalCode(transformedCode);
      setGCode(transformedCode);

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
    }
  };

  // Handle cursor position change in Monaco editor
  const handleCursorPositionChange = (line, column) => {
    setCurrentLine(line);
    setCurrentColumn(column);
    
    // Check for errors/warnings at current position
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

  // Handle editor mount with better error handling
  const handleEditorDidMount = (editor, monaco) => {
    if (!editor || !monaco) {
      console.warn("Editor or Monaco instance is null in handleEditorDidMount");
      return;
    }
    
    try {
      // Store references
      editorInstanceRef.current = editor;
      monacoRef.current = monaco;
      
      // Initialize editor with current code (if provided)
      if (code) {
        editor.setValue(code);
        updateFileStats(code);
        
        // Use setTimeout to avoid blocking the UI
        setTimeout(() => {
          validateCode(code);
          detectCodeFormat(code);
        }, 50);
      }
      
      // Add cursor position change listener with error handling
      const cursorDisposable = editor.onDidChangeCursorPosition(e => {
        try {
          handleCursorPositionChange(e.position.lineNumber, e.position.column);
        } catch (err) {
          console.warn("Error handling cursor position change:", err);
        }
      });
      
      // Store the disposable to clean it up later
      editor._cursorDisposable = cursorDisposable;
      
      // Content change is handled in the component itself
      
      // Set initial cursor position
      editor.setPosition({ lineNumber: 1, column: 1 });
      
      // Set up custom resize handling
      setupEditorResizeHandling();
      
      console.log("Monaco editor initialized successfully");
    } catch (err) {
      console.error("Error in handleEditorDidMount:", err);
    }
  };

  // Get editor options
  const getEditorOptions = () => {
    return {
      selectOnLineNumbers: true,
      roundedSelection: false,
      cursorStyle: 'line',
      automaticLayout: false, // Set to false to avoid ResizeObserver errors
      folding: true,
      renderLineHighlight: 'all',
      scrollBeyondLastLine: false,
      minimap: {
        enabled: true,
        maxColumn: 80
      },
      lineNumbers: true
    };
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
  <GrblMetadata 
    code={code} 
    format={codeFormat} 
    fileName={fileName}
    modified={modified}
  />
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

      {/* Execution tracking UI */}
      {isExecuting && (
        <ExecutionTracker
          isExecuting={isExecuting}
          executedLine={executedLine}
          executionProgress={executionProgress}
          totalLines={totalLines}
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

      {/* Monaco-Based Code Editor */}
      <div className="monaco-editor-container">
        <MonacoEditor
          code={code}
          onEditorDidMount={handleEditorDidMount}
          options={getEditorOptions()}
          onChange={handleCodeChange}
          selectedLine={selectedLine}
          executedLine={executedLine}
          errors={errors}
          warnings={warnings}
        />
      </div>

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