import { useState, useRef } from 'react';

/**
 * Custom hook for file operations in the editor
 */
const useFileOperations = (
  code, 
  setCode, 
  setGCode, 
  setOriginalCode, 
  setModified, 
  validateCode, 
  calculateBoundaries, 
  setTransformValues
) => {
  const [fileName, setFileName] = useState('untitled.gcode');
  const fileInputRef = useRef(null);

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
      setCode(content);  // This will trigger handleCodeChange in useEditorState
      setOriginalCode(content);
      setGCode(content);
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
        centerX: boundaries.centerX,
        centerY: boundaries.centerY
      }));
    };
    reader.readAsText(file);

    // Reset the file input to allow selecting the same file again
    e.target.value = null;
  };

  return {
    fileName,
    setFileName,
    openFile,
    saveFile,
    fileInputRef,
    handleFileSelected
  };
};

export default useFileOperations;