import React, { useState, useRef, useEffect } from 'react';
import '../../styles/code-editor.css';
import { useGCode } from '../../contexts/GCodeContext';
// Sample G-Code examples
const EXAMPLE_CODES = {
  'example.gcode': '; Example G-code\nG28 ; Home all axes\nG1 X100 Y100 Z10 F1000 ; Move to position\nG1 Z2 ; Lower to working height\nG1 X150 Y150 ; Draw diagonal line\nG1 X100 Y150 ; Draw horizontal line\nG1 X100 Y100 ; Return to start\nG1 Z10 ; Raise head',
  'square.gcode': '; Square pattern\nG28 ; Home all axes\nG1 Z5 F1000 ; Raise head\nG1 X10 Y10 F2000 ; Move to start\nG1 Z0.5 ; Lower to work height\nG1 X10 Y110 ; Draw line\nG1 X110 Y110 ; Draw line\nG1 X110 Y10 ; Draw line\nG1 X10 Y10 ; Draw line\nG1 Z5 ; Raise head',
  'spiral.gcode': '; Spiral pattern\nG28 ; Home all axes\nG1 Z5 F1000 ; Raise head\nG1 X50 Y50 F2000 ; Move to center\nG1 Z0.5 ; Lower to work height\nG3 X60 Y50 I5 J0 F1000 ; Arc 1\nG3 X70 Y50 I5 J0 F1000 ; Arc 2\nG3 X80 Y50 I5 J0 F1000 ; Arc 3\nG3 X90 Y50 I5 J0 F1000 ; Arc 4\nG3 X100 Y50 I5 J0 F1000 ; Arc 5\nG1 Z5 ; Raise head',
  'calibration.gcode': '; Calibration pattern\nG28 ; Home all axes\nG1 Z5 F1000 ; Raise head\nG1 X20 Y20 F2000 ; Move to start\nG1 Z0.2 ; Lower to work height\nG1 X20 Y100 E10 F1000 ; Line 1\nG1 X40 Y100 E20 F1000 ; Line 2\nG1 X60 Y100 E30 F1000 ; Line 3\nG1 X80 Y100 E40 F1000 ; Line 4\nG1 Z5 ; Raise head'
};

/**
 * Editor de G-Code moderno con características profesionales
 */
const CodeEditorPanel = ({ language = 'gcode' }) => {
  const { gcode, setGCode, selectedLine, setSelectedLine } = useGCode();
  const [code, setCode] = useState(
    gcode || EXAMPLE_CODES['example.gcode']
  );
  const [fileName, setFileName] = useState('example.gcode');
  const [currentLine, setCurrentLine] = useState(1);
  const [currentColumn, setCurrentColumn] = useState(1);
  const [highlightedLine, setHighlightedLine] = useState(1);
  const [totalLines, setTotalLines] = useState(0);
  const [fileSize, setFileSize] = useState('0.2 KB');
  const [modified, setModified] = useState(false);
  
  const editorRef = useRef(null);
  const lineNumbersRef = useRef(null);

  // Initialize the editor with the current gcode from context
  useEffect(() => {
    if (!code && gcode) {
      setCode(gcode);
    } else if (!gcode && code) {
      setGCode(code);
    }
  }, [code, gcode, setGCode]);

  // Handle code changes
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    setGCode(newCode);
    setModified(true);
  };

  // Cálculo de número de líneas y actualización de la barra de desplazamiento
  useEffect(() => {
    if (!code) return;
    
    const lines = code.split('\n');
    setTotalLines(lines.length);
    
    // Actualizar números de línea
    if (lineNumbersRef.current) {
      lineNumbersRef.current.innerHTML = lines
        .map((_, i) => `<div class="line-number${i + 1 === highlightedLine ? ' active' : ''}">${i + 1}</div>`)
        .join('');
    }
  
    // Calcular tamaño del archivo (aproximado)
    const sizeInBytes = new Blob([code]).size;
    if (sizeInBytes < 1024) {
      setFileSize(`${sizeInBytes} B`);
    } else if (sizeInBytes < 1024 * 1024) {
      setFileSize(`${(sizeInBytes / 1024).toFixed(1)} KB`);
    } else {
      setFileSize(`${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`);
    }
  }, [code, highlightedLine]);

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
          }
        }
      }, [selectedLine, highlightedLine, code]);

  // Sincronizar desplazamiento entre el editor y los números de línea
  const syncScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Manejar click en los números de línea
  const handleLineNumberClick = (lineNumber) => {
    setHighlightedLine(lineNumber);
    setSelectedLine(lineNumber);
    
    // Poner el cursor al principio de la línea seleccionada
    const lines = code.split('\n');
    let position = 0;
    
    for (let i = 0; i < lineNumber - 1; i++) {
      position += lines[i].length + 1; // +1 por el salto de línea
    }
    
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.setSelectionRange(position, position);
    }
  };

  // Función para aplicar resaltado de sintaxis para G-code
  const getHighlightedCode = (text) => {
    if (!text) return '';
    
    const lines = text.split('\n');
    
    // Resaltado de cada línea
    const highlightedLines = lines.map((line, i) => {
      // Resaltar comentarios
      let highlightedLine = line.replace(/;(.*)$/, '<span class="code-comment">;$1</span>');
      
      // Resaltar comandos G y M
      highlightedLine = highlightedLine.replace(/\b([GM]\d+)\b/g, '<span class="code-command">$1</span>');
      
      // Resaltar parámetros (como X100, Y50, Z10, F1000)
      highlightedLine = highlightedLine.replace(/\b([XYZFIJKRPQ])(-?\d+\.?\d*)/g, '<span class="code-param">$1</span><span class="code-value">$2</span>');
      
      return `<div class="code-line${i + 1 === highlightedLine ? ' highlighted-line' : ''}">${highlightedLine || ' '}</div>`;
    });
    
    return highlightedLines.join('\n');
  };

  // Actualizar posición del cursor
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
  };

  // Validar el G-code
  const validateCode = () => {
    // Simulación de validación
    const errors = [];
    const warnings = [];
    
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      // Ignorar líneas vacías o comentarios
      if (!line.trim() || line.trim().startsWith(';')) return;
      
      // Verificar que la línea comienza con un comando G o M
      if (!/^\s*([GM]\d+)/.test(line)) {
        errors.push(`Línea ${i + 1}: Formato de comando inválido`);
      }
      
      // Verificar parámetros numéricos válidos
      if (/[XYZFIJKRPQ]([^0-9.-])/.test(line)) {
        errors.push(`Línea ${i + 1}: Valor numérico inválido`);
      }
      
      // Advertencia para velocidades muy altas
      if (/F(\d+)/.test(line)) {
        const match = line.match(/F(\d+)/);
        if (match && parseInt(match[1]) > 5000) {
          warnings.push(`Línea ${i + 1}: Velocidad muy alta (F > 5000)`);
        }
      }
    });
    
    // Mostrar resultados de validación
    if (errors.length === 0 && warnings.length === 0) {
      alert('¡Código validado correctamente!');
    } else {
      alert(`Validación completada:\n${errors.length} errores\n${warnings.length} advertencias\n\n${errors.join('\n')}\n${warnings.join('\n')}`);
    }
  };

  // Formatear el G-code
  const formatCode = () => {
    const lines = code.split('\n');
    const formattedLines = lines.map(line => {
      // Ignorar líneas vacías o comentarios puros
      if (!line.trim() || line.trim().startsWith(';')) return line;
      
      let formattedLine = line;
      
      // Separar comandos y comentarios
      const parts = line.split(';');
      const command = parts[0].trim();
      const comment = parts.length > 1 ? parts.slice(1).join(';') : '';
      
      // Formatear comando
      let formattedCommand = command;
      
      // Alinear espaciado entre parámetros
      formattedCommand = formattedCommand.replace(/([GM]\d+)/, '$1 ');
      formattedCommand = formattedCommand.replace(/([XYZFIJKRPQ])(-?\d+\.?\d*)(?!\S)/g, '$1$2 ');
      
      // Reconstruir línea con comentario
      formattedLine = formattedCommand.trim();
      if (comment) {
        formattedLine += ' ; ' + comment.trim();
      }
      
      return formattedLine;
    });
    
    setCode(formattedLines.join('\n'));
    setModified(true);
  };

  // Guardar el archivo
  const saveFile = () => {
    // Simulación de guardado
    alert(`Archivo guardado: ${fileName}`);
    setModified(false);
  };

  // Function to handle file opening
const openFile = () => {
  const files = [
    'example1.gcode',
    'example2.gcode',
    'spiral.gcode',
    'calibration.gcode'
  ];
  const randomFile = files[Math.floor(Math.random() * files.length)];
  setFileName(randomFile);
  setModified(false);
  alert(`Opened ${randomFile}`);
  
  // In a real implementation, you would:
  // 1. Open a file picker dialog
  // 2. Read the selected file
  // 3. Set the content in the editor
  
  // Mock different G-code content for each file
  const fileContents = {
    'example1.gcode': '; Example G-code\nG28 ; Home all axes\nG1 X100 Y100 Z10 F1000 ; Move to position\nG1 Z2 ; Lower to working height\nG1 X150 Y150 ; Draw diagonal line',
    'example2.gcode': '; Square pattern\nG28 ; Home all axes\nG1 Z5 F1000 ; Raise head\nG1 X10 Y10 F2000 ; Move to start\nG1 Z0.5 ; Lower to work height\nG1 X10 Y110 ; Draw line\nG1 X110 Y110 ; Draw line\nG1 X110 Y10 ; Draw line\nG1 X10 Y10 ; Draw line',
    'spiral.gcode': '; Spiral pattern\nG28 ; Home all axes\nG1 Z5 F1000 ; Raise head\nG1 X50 Y50 F2000 ; Move to center\nG1 Z0.5 ; Lower to work height\nG3 X60 Y50 I5 J0 F1000 ; Arc 1\nG3 X70 Y50 I5 J0 F1000 ; Arc 2\nG3 X80 Y50 I5 J0 F1000 ; Arc 3',
    'calibration.gcode': '; Calibration pattern\nG28 ; Home all axes\nM104 S200 ; Set extruder temp\nM140 S60 ; Set bed temp\nG1 Z5 F1000 ; Raise head\nG1 X20 Y20 F2000 ; Move to start\nG1 Z0.2 ; Lower to work height\nG1 X20 Y100 E10 F1000 ; Extrude line\nG1 X40 Y100 E20 F1000 ; Extrude line'
  };
  
  // Set the content for the selected file
  setCode(fileContents[randomFile] || '');
  
  // Update file size based on content length
  const contentSize = (fileContents[randomFile] || '').length;
  if (contentSize < 1024) {
    setFileSize(`${contentSize} B`);
  } else {
    setFileSize(`${(contentSize / 1024).toFixed(1)} KB`);
  }
  
  // Update line count
  setTotalLines((fileContents[randomFile] || '').split('\n').length);
 };

  // Enviar al robot
  const sendToRobot = () => {
    // Simulación de envío
    alert('Código enviado al robot');
  };

  return (
    <div className="gcode-editor-panel">
      {/* Toolbar at the top */}
      <div className="editor-toolbar">
        <div className="toolbar-section">
        <button className="toolbar-btn" onClick={openFile} title="Open file (Ctrl+O)">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"></path>
            <path d="M14 2v6h6"></path>
            <polyline points="14 2 20 8 14 8"></polyline>
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
          <button className="toolbar-btn" onClick={validateCode} title="Validate G-code">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
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
          
          <div className="status-section editor-info">
            <span className="info-item">{totalLines} lines</span>
            <span className="status-divider">|</span>
            <span className="info-item">G-code</span>
            <span className="status-divider">|</span>
            <span className="info-item">UTF-8</span>
            <span className="status-divider">|</span>
            <span className="info-item">{fileSize}</span>
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