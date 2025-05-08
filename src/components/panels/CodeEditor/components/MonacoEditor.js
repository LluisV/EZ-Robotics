// src/components/panels/CodeEditor/components/MonacoEditor.js
import React, { useRef, useEffect } from 'react';
import { initializeMonaco, disposeMonacoEditor } from '../../../../utils/setupMonaco';
import { applyMonacoTheme } from '../../../../utils/MonacoThemeAdapter';

/**
 * Monaco Editor component for G-code
 * Enhanced with proper error handling, resource management, and theme support
 */
const MonacoEditor = ({
  code,
  onChange,
  onEditorDidMount,
  options = {},
  selectedLine = -1,
  executedLine = 0,
  errors = [],
  warnings = [],
  currentTheme = 'dracula' // Add theme prop
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
    
    let isMounted = true;
    
    // Delay editor creation slightly to avoid React rendering conflicts
    const initTimeout = setTimeout(() => {
      if (!isMounted || !containerRef.current) return;
      
      try {
        // Initialize Monaco with the current app theme
        const monaco = initializeMonaco(currentTheme);
        monacoRef.current = monaco;
        
        // Create editor with enhanced error handling
        const editorInstance = monaco.editor.create(containerRef.current, {
          value: code || '',
          language: 'gcode',
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
        if (onEditorDidMount && isMounted) {
          onEditorDidMount(editorInstance, monaco);
        }
        
        // Register change handler
        const changeDisposable = editorInstance.onDidChangeModelContent(() => {
          if (onChange && isMounted) {
            onChange(editorInstance.getValue());
          }
        });
        
        // Store the disposable on the instance for cleanup
        editorInstance._changeDisposable = changeDisposable;
      } catch (err) {
        console.warn("Error creating Monaco editor:", err);
      }
    }, 50); // Small delay to avoid React rendering conflicts
    
    // Cleanup on unmount - CRITICAL for preventing memory leaks
    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      
      if (editorRef.current) {
        // Make sure to dispose of any stored disposables first
        if (editorRef.current._changeDisposable) {
          try {
            editorRef.current._changeDisposable.dispose();
          } catch (err) {
            // Silently ignore disposal errors
          }
        }
        
        if (editorRef.current._cursorDisposable) {
          try {
            editorRef.current._cursorDisposable.dispose();
          } catch (err) {
            // Silently ignore disposal errors
          }
        }
        
        // Then dispose of the editor cleanly
        disposeMonacoEditor(editorRef.current);
        editorRef.current = null;
      }
    };
  }, []);
  
  // Update theme when the app theme changes
  useEffect(() => {
    // Only update if we have both monaco and an editor instance
    if (monacoRef.current && editorRef.current) {
      applyMonacoTheme(monacoRef.current, currentTheme);
    }
  }, [currentTheme]);
  
  // Add custom methods to the editor instance
  const enhanceEditorInstance = (editor, monaco) => {
    if (!editor || !monaco) return;
    
    // Method to set editor value safely
    editor.setValue = function(value) {
      try {
        const model = this.getModel();
        if (model) {
          model.setValue(value || '');
        }
      } catch (err) {
        console.warn("Error setting editor value:", err);
      }
    };
    
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
    
    // Method to reveal a line in the editor safely
    editor.revealLineInCenter = function(lineNumber) {
      try {
        if (this.getModel() && lineNumber > 0) {
          this.revealLineInCenterIfOutsideViewport(lineNumber);
        }
      } catch (err) {
        console.warn("Error revealing line:", err);
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
  
  // Update when selected line changes - wrapped in try/catch for safety
  useEffect(() => {
    if (selectedLine > 0 && editorRef.current) {
      try {
        editorRef.current.revealLineInCenter(selectedLine);
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