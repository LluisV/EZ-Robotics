import React, { useRef, useEffect } from 'react';
import { initializeMonaco, disposeMonacoEditor } from '../../../../utils/setupMonaco';

/**
 * Monaco Editor component for G-code
 * Enhanced with proper worker configuration and memory management
 */
const MonacoEditor = ({
  code,
  onChange,
  onEditorDidMount,
  options = {},
  selectedLine = -1,
  executedLine = 0,
  errors = [],
  warnings = []
}) => {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const executionDecorationsRef = useRef([]);
  const errorDecorationsRef = useRef([]);
  const warningDecorationsRef = useRef([]);
  
  // Initialize Monaco editor once and clean up properly on unmount
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize Monaco with proper configuration
    const monaco = initializeMonaco();
    monacoRef.current = monaco;
    
    // Create editor with enhanced error handling
    try {
      const editorInstance = monaco.editor.create(containerRef.current, {
        value: code || '',
        language: 'gcode',
        theme: 'gcode-theme',
        automaticLayout: true,
        folding: true,
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        minimap: { 
          enabled: true,
          maxColumn: 80,
          showSlider: "always"
        },
        // Performance options
        wordWrap: 'on',
        wrappingStrategy: 'advanced',
        renderWhitespace: 'none',
        renderControlCharacters: false,
        renderIndentGuides: false,
        renderValidationDecorations: 'on',
        ...options
      });
      
      editorRef.current = editorInstance;
      
      // Add additional functionality to the editor instance
      enhanceEditorInstance(editorInstance, monaco);
      
      // Call the onEditorDidMount callback if provided
      if (onEditorDidMount) {
        onEditorDidMount(editorInstance, monaco);
      }
      
      // Register change handler
      const changeDisposable = editorInstance.onDidChangeModelContent(() => {
        if (onChange) {
          onChange(editorInstance.getValue());
        }
      });
      
      // Cleanup on unmount - CRITICAL for preventing memory leaks
      return () => {
        // First dispose of our custom subscriptions
        if (changeDisposable) {
          try {
            changeDisposable.dispose();
          } catch (err) {
            console.warn("Error disposing editor subscription:", err);
          }
        }
        
        // Then dispose of the editor cleanly
        disposeMonacoEditor(editorRef.current);
        editorRef.current = null;
      };
    } catch (err) {
      console.error("Error creating Monaco editor:", err);
      return () => {};
    }
  }, []);
  
  // Add custom methods to the editor instance
  const enhanceEditorInstance = (editor, monaco) => {
    if (!editor || !monaco) return;
    
    // Method to set diagnostics (errors/warnings)
    editor.setDiagnostics = (errors = [], warnings = []) => {
      if (!editor.getModel()) return;
      
      try {
        const model = editor.getModel();
        const errorMarkers = errors.map(err => ({
          severity: monaco.MarkerSeverity.Error,
          message: err.message,
          startLineNumber: err.line,
          startColumn: 1,
          endLineNumber: err.line,
          endColumn: model.getLineMaxColumn(err.line) || 100
        }));
        
        const warningMarkers = warnings.map(warn => ({
          severity: monaco.MarkerSeverity.Warning,
          message: warn.message,
          startLineNumber: warn.line,
          startColumn: 1,
          endLineNumber: warn.line,
          endColumn: model.getLineMaxColumn(warn.line) || 100
        }));
        
        // Set markers on the model
        monaco.editor.setModelMarkers(model, 'gcode-validation', [...errorMarkers, ...warningMarkers]);
      } catch (err) {
        console.warn("Error setting diagnostics:", err);
      }
    };
    
    // Method to decorate the executed line
    editor.decorateExecutedLine = (lineNumber) => {
      if (!editor.getModel()) return;
      
      try {
        // Clear previous decorations
        editor.clearExecutionDecorations();
        
        // Create new decorations
        const decorations = [{
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className: 'executing-line',
            glyphMarginClassName: 'executing-line-glyph',
            overviewRuler: {
              color: { id: 'editorOverviewRuler.executingForeground' },
              position: monaco.editor.OverviewRulerLane.Left
            }
          }
        }];
        
        // Apply decorations
        executionDecorationsRef.current = editor.deltaDecorations(executionDecorationsRef.current, decorations);
        
        // Reveal the line in the editor - only if not visible
        const visibleRanges = editor.getVisibleRanges();
        const isLineVisible = visibleRanges.some(range => 
          range.startLineNumber <= lineNumber && lineNumber <= range.endLineNumber
        );
        
        if (!isLineVisible) {
          editor.revealLineInCenter(lineNumber);
        }
      } catch (err) {
        console.warn("Error decorating executed line:", err);
      }
    };
    
    // Method to clear execution decorations
    editor.clearExecutionDecorations = () => {
      if (!editor.getModel()) return;
      
      try {
        executionDecorationsRef.current = editor.deltaDecorations(executionDecorationsRef.current, []);
      } catch (err) {
        console.warn("Error clearing execution decorations:", err);
      }
    };
  };
  
  // Update when selected line changes
  useEffect(() => {
    if (selectedLine > 0 && editorRef.current) {
      try {
        const visibleRanges = editorRef.current.getVisibleRanges();
        const isLineVisible = visibleRanges.some(range => 
          range.startLineNumber <= selectedLine && selectedLine <= range.endLineNumber
        );
        
        if (!isLineVisible) {
          editorRef.current.revealLineInCenter(selectedLine);
        }
      } catch (err) {
        console.warn("Error revealing selected line:", err);
      }
    }
  }, [selectedLine]);
  
  // Update execution highlighting
  useEffect(() => {
    if (executedLine > 0 && editorRef.current) {
      try {
        editorRef.current.decorateExecutedLine(executedLine);
      } catch (err) {
        console.warn("Error highlighting executed line:", err);
      }
    }
  }, [executedLine]);
  
  // Update errors and warnings
  useEffect(() => {
    if (editorRef.current) {
      try {
        editorRef.current.setDiagnostics(errors, warnings);
      } catch (err) {
        console.warn("Error setting diagnostics:", err);
      }
    }
  }, [errors, warnings]);

  return (
    <div 
      ref={containerRef} 
      className="monaco-editor-wrapper" 
      style={{ width: '100%', height: '100%', minHeight: '300px' }}
    />
  );
};

export default React.memo(MonacoEditor);