import React, { useState, useRef, useEffect } from 'react';

/**
 * Core editor component with syntax highlighting and line numbers
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
  validateCode
}) => {
  const editorRef = useRef(null);
  const lineNumbersRef = useRef(null);

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

  // Update line numbers when code changes
  useEffect(() => {
    if (!code) return;

    const lines = code.split('\n');

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

    // Ensure the editor and line numbers have the same scroll position
    if (editorRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = editorRef.current.scrollTop;
    }
  }, [code, highlightedLine, errors, warnings]);

  // Handle cursor position and update error status
  const handleCursorPosition = () => {
    if (!editorRef.current) return;

    const pos = editorRef.current.selectionStart;
    const codeUpToCursor = code.substring(0, pos);
    const linesUpToCursor = codeUpToCursor.split('\n');

    const line = linesUpToCursor.length;
    const col = linesUpToCursor[linesUpToCursor.length - 1].length + 1;

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

  return (
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
          onChange={handleCodeChange}
          onScroll={syncScroll}
          onKeyUp={handleCursorPosition}
          onClick={handleCursorPosition}
          spellCheck="false"
          className="editor-textarea"
        />
        <pre className="editor-highlighting" dangerouslySetInnerHTML={{ __html: getHighlightedCode(code) }}></pre>
      </div>
    </div>
  );
};

export default CodeEditor;