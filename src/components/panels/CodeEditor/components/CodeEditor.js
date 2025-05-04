import React, { useState, useRef, useEffect, useCallback } from 'react';
import GCodeHighlighter from '../services/GCodeHighlighter';

/**
 * Enhanced code editor component with support for consecutive coordinate-only moves
 * Fixed to prevent cursor position issues with implied moves
 * 
 * PERFORMANCE OPTIMIZATION: Added debounced updates and low performance mode
 */
const CodeEditor = ({
  code,
  setCode,
  errors,
  warnings,
  highlightedLine,
  setHighlightedLine,
  selectedLine,
  setSelectedLine,
  setStatusMessage,
  validateCode,
  editorRef,
  lowPerformanceMode = false // PERFORMANCE OPTIMIZATION: New prop to signal active transfer
}) => {
  const lineNumbersRef = useRef(null);
  const localEditorRef = useRef(null);
  const lastHighlightedLineRef = useRef(-1);
  const highlightTimeoutRef = useRef(null);
  
  // Use the provided ref or create our own
  const effectiveEditorRef = editorRef || localEditorRef;

  // Handle code changes
  const handleCodeChange = (e) => {
    setCode(e.target.value);
  };

  // Synchronize scrolling between editor and line numbers
  const syncScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // PERFORMANCE OPTIMIZATION: Debounced line highlighting function
  const debounceHighlight = useCallback((lineNum, delay = 100) => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedLine(lineNum);
      lastHighlightedLineRef.current = lineNum;
    }, delay);
  }, [setHighlightedLine]);

  // Handle clicking on line numbers
  const handleLineNumberClick = (lineNumber) => {
    // PERFORMANCE OPTIMIZATION: Don't process clicks during low performance mode
    if (lowPerformanceMode) return;
    
    // Use debounced update for highlighting
    debounceHighlight(lineNumber);
    setSelectedLine(lineNumber);

    // Place cursor at the beginning of the selected line
    const lines = code.split('\n');
    let position = 0;

    for (let i = 0; i < lineNumber - 1; i++) {
      position += lines[i].length + 1; // +1 for newline
    }

    if (effectiveEditorRef.current) {
      effectiveEditorRef.current.focus();
      effectiveEditorRef.current.setSelectionRange(position, position);
    }
  };

  // Track implied move lines and their active G command
  const [impliedMoveInfo, setImpliedMoveInfo] = useState([]); // [{line: number, gCommand: string}]

  // Detect implied moves when code changes
  useEffect(() => {
    if (!code) return;

    // Analyze code for implied moves
    const lines = code.split('\n');
    const impliedInfo = [];
    let activeGMode = null;

    lines.forEach((line, i) => {
      // Clean the line (remove comments)
      const cleanedLine = line.replace(/\(.*?\)/g, '').split(';')[0].trim();
      if (!cleanedLine) return;

      // Check for G commands
      const gCommandMatch = cleanedLine.match(/G[0-3][0-9]*/);
      const hasCoordinates = /[XYZ]-?\d+(\.\d+)?/.test(cleanedLine);

      if (gCommandMatch) {
        // Update active G mode
        activeGMode = gCommandMatch[0];
      } else if (hasCoordinates && activeGMode) {
        // This is an implied move
        impliedInfo.push({
          line: i + 1,
          gCommand: activeGMode
        });
      }
    });

    setImpliedMoveInfo(impliedInfo);
  }, [code]);

  // PERFORMANCE OPTIMIZATION: Improve line numbers rendering with memoization
  const createLineNumbers = useCallback(() => {
    if (!code || !lineNumbersRef.current) return '';

    const lines = code.split('\n');
    let lineNumbersHtml = '';

    // Create line numbers with the correct data attributes for implied commands
    lines.forEach((_, i) => {
      const lineNum = i + 1;
      const hasError = errors.some(err => err.line === lineNum);
      const hasWarning = warnings.some(warn => warn.line === lineNum);
      
      // Find if this is an implied move line
      const impliedMove = impliedMoveInfo.find(info => info.line === lineNum);
      const isImpliedMove = !!impliedMove;
      
      const errorMsg = errors.find(err => err.line === lineNum)?.message || '';
      const warningMsg = warnings.find(warn => warn.line === lineNum)?.message || '';
      let tooltipMsg = errorMsg || warningMsg;
      
      if (isImpliedMove) {
        tooltipMsg = tooltipMsg || `Using previous ${impliedMove.gCommand} command`;
      }

      let className = "line-number";

      if (lineNum === highlightedLine) className += ' active';
      if (hasError) className += ' error';
      if (hasWarning) className += ' warning';
      if (isImpliedMove) className += ' implied-hint';

      const tooltipAttr = tooltipMsg ? ` data-tooltip="${tooltipMsg}"` : '';
      
      // This is the key attribute for displaying the G command
      const impliedCommandAttr = isImpliedMove ? ` data-implied-command="${impliedMove.gCommand}"` : '';

      lineNumbersHtml += `<div class="${className}"${tooltipAttr}${impliedCommandAttr}>${lineNum}</div>`;
    });
    
    return lineNumbersHtml;
  }, [code, highlightedLine, errors, warnings, impliedMoveInfo]);

  // Update line numbers when code changes or highlighting changes
  useEffect(() => {
    // PERFORMANCE OPTIMIZATION: Skip minor updates during transfers
    if (lowPerformanceMode && lastHighlightedLineRef.current !== -1) {
      // Only update for significant changes in highlighted line
      if (highlightedLine === lastHighlightedLineRef.current || 
         (Math.abs(highlightedLine - lastHighlightedLineRef.current) < 10 &&
          highlightedLine !== 1 && 
          highlightedLine !== code.split('\n').length)) {
        return;
      }
    }
    
    // Generate the line numbers HTML
    const lineNumbersHtml = createLineNumbers();
    
    // Update the DOM if needed
    if (lineNumbersRef.current && lineNumbersHtml) {
      lineNumbersRef.current.innerHTML = lineNumbersHtml;
      
      // Ensure the editor and line numbers have the same scroll position
      if (effectiveEditorRef.current && lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = effectiveEditorRef.current.scrollTop;
      }
    }
    
    // Save the current highlighted line for comparison
    lastHighlightedLineRef.current = highlightedLine;
  }, [code, highlightedLine, errors, warnings, impliedMoveInfo, createLineNumbers, effectiveEditorRef, lowPerformanceMode]);

  // Handle cursor position and update error status
  const handleCursorPosition = useCallback(() => {
    // Skip in low performance mode
    if (lowPerformanceMode) return;
    
    if (!effectiveEditorRef.current) return;

    const pos = effectiveEditorRef.current.selectionStart;
    const codeUpToCursor = code.substring(0, pos);
    const linesUpToCursor = codeUpToCursor.split('\n');

    const line = linesUpToCursor.length;
    const col = linesUpToCursor[linesUpToCursor.length - 1].length + 1;

    // Debounce the highlight and selection updates
    debounceHighlight(line);
    setSelectedLine(line);

    // Update status message if current line has errors/warnings
    const lineError = errors.find(err => err.line === line);
    const lineWarning = warnings.find(warn => warn.line === line);
    const impliedMove = impliedMoveInfo.find(info => info.line === line);

    if (lineError) {
      setStatusMessage(`Error (Line ${line}): ${lineError.message}`);
    } else if (lineWarning) {
      setStatusMessage(`Warning (Line ${line}): ${lineWarning.message}`);
    } else if (impliedMove) {
      setStatusMessage(`Info: Using previous ${impliedMove.gCommand} command (implied move)`);
    } else {
      setStatusMessage('');
    }
  }, [code, errors, warnings, impliedMoveInfo, setHighlightedLine, setSelectedLine, setStatusMessage, effectiveEditorRef, debounceHighlight, lowPerformanceMode]);

  // PERFORMANCE OPTIMIZATION: Memoize the highlighted code
  const memoizedHighlightedCode = useCallback((text) => {
    if (!text) return '';
    
    // In low performance mode, we can reduce the highlighting complexity
    if (lowPerformanceMode) {
      // Simpler highlighting in low performance mode
      return GCodeHighlighter.highlightCodeLowPerf(text, highlightedLine);
    }
    
    // Use the enhanced GCodeHighlighter with implied moves support
    return GCodeHighlighter.highlightCode(text, errors, warnings, highlightedLine);
  }, [errors, warnings, highlightedLine, lowPerformanceMode]);

  // Force validate the G-code now
  const validateNow = () => {
    if (code && validateCode) {
      validateCode(code);
    }
  };

  // PERFORMANCE OPTIMIZATION: Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
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
            ref={effectiveEditorRef}
            value={code}
            onChange={handleCodeChange}
            onScroll={syncScroll}
            onKeyUp={handleCursorPosition}
            onClick={handleCursorPosition}
            spellCheck="false"
            className="editor-textarea"
          />
          <pre className="editor-highlighting" dangerouslySetInnerHTML={{ 
            __html: memoizedHighlightedCode(code) 
          }}></pre>
        </div>
      </div>
    </>
  );
};

// Add this method to GCodeHighlighter (needs to be added to the actual file)
// GCodeHighlighter.highlightCodeLowPerf = (text, highlightedLine) => {
//   // Simpler highlighting during transfers - only handle line highlights
//   const lines = text.split('\n');
//   return lines.map((line, i) => {
//     const lineNum = i + 1;
//     const isHighlighted = lineNum === highlightedLine;
//     return `<div class="code-line${isHighlighted ? ' highlighted-line' : ''}">${line || ' '}</div>`;
//   }).join('');
// };

export default React.memo(CodeEditor); // PERFORMANCE OPTIMIZATION: Memo the component