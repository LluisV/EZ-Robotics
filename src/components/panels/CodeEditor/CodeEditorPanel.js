import React, { useState, useEffect } from 'react';
import '../../../styles/code-editor.css';
import { useGCode } from '../../../contexts/GCodeContext';
import EditorHeader from './components/EditorHeader';
import EditorFooter from './components/EditorFooter';
import TransformPanel from './components/TransformPanel';
import TransferProgress from './components/TransferProgress';
import CodeEditor from './components/CodeEditor';
import useEditorState from './hooks/useEditorState';
import useFileOperations from './hooks/useFileOperations';
import useTransfer from './hooks/useTransfer';

/**
 * Enhanced G-Code Editor with transformation tools and auto-validation
 */
const CodeEditorPanel = () => {
  const { gcode, setGCode, transformValues, setTransformValues } = useGCode();
  
  // Load editor state and functionality from custom hooks
  const {
    code,
    setCode,
    originalCode,
    setOriginalCode,
    currentLine,
    currentColumn,
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
  } = useEditorState(gcode, setGCode);

  // File operations
  const {
    fileName,
    openFile,
    saveFile,
    fileInputRef,
    handleFileSelected
  } = useFileOperations(code, setCode, setGCode, setOriginalCode, setModified, validateCode, calculateBoundaries, setTransformValues);

  // G-code transfer functionality
  const {
    isPaused,
    isTransferring,
    transferProgress,
    transferError,
    sendToRobot,
    pauseTransfer,
    resumeTransfer,
    stopTransfer,
    retryTransfer
  } = useTransfer(code, fileName, setStatusMessage, setSelectedLine);

  // Transform mode state
  const [transformMode, setTransformMode] = useState(null);

  // Generate transformed G-Code based on current transformation parameters
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
      centerX: transformValues.centerX,
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
      />

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
        setCode={setCode}
        setGCode={setGCode}
        setModified={setModified}
        validateCode={validateCode}
        errors={errors}
        warnings={warnings}
        highlightedLine={highlightedLine}
        setHighlightedLine={setHighlightedLine}
        selectedLine={selectedLine}
        setSelectedLine={setSelectedLine}
        setStatusMessage={setStatusMessage}
        currentLine={currentLine}
        setCurrentLine={currentLine}
        currentColumn={currentColumn}
        setCurrentColumn={currentColumn}
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
      />
    </div>
  );
};

export default CodeEditorPanel;