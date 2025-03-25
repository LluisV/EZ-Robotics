import React, { useState, useRef, useEffect } from 'react';
import '../../styles/code-editor.css';

/**
 * Editor de G-Code moderno con características profesionales
 */
const CodeEditorPanel = ({ language = 'gcode' }) => {
  const [code, setCode] = useState(
    '; Example G-code\nG28 ; Home all axes\nG1 X100 Y100 Z10 F1000 ; Move to position\nG1 Z2 ; Lower to working height\nG1 X150 Y150 ; Draw diagonal line\nG1 X100 Y150 ; Draw horizontal line\nG1 X100 Y100 ; Return to start\nG1 Z10 ; Raise head'
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
    
    // Marcar como modificado
    setModified(true);
  }, [code, highlightedLine]);

  // Sincronizar desplazamiento entre el editor y los números de línea
  const syncScroll = (e) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Manejar click en los números de línea
  const handleLineNumberClick = (lineNumber) => {
    setHighlightedLine(lineNumber);
    
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

  // Enviar al robot
  const sendToRobot = () => {
    // Simulación de envío
    alert('Código enviado al robot');
  };

  return (
    <div className={`gcode-editor-panel`}>
      {/* Encabezado del editor */}
      <div className="editor-header">
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
          <div className="file-meta">
            <span className="meta-item">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="17" y1="10" x2="3" y2="10"></line>
                <line x1="21" y1="6" x2="3" y2="6"></line>
                <line x1="21" y1="14" x2="3" y2="14"></line>
                <line x1="17" y1="18" x2="3" y2="18"></line>
              </svg>
              <span>{totalLines} lines</span>
            </span>
            <span className="meta-item">
            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 50 50">
            <path d="M 7 2 L 7 48 L 43 48 L 43 14.59375 L 42.71875 14.28125 L 30.71875 2.28125 L 30.40625 2 Z M 9 4 L 29 4 L 29 16 L 41 16 L 41 46 L 9 46 Z M 31 5.4375 L 39.5625 14 L 31 14 Z"></path>
            </svg>
            <span>{fileSize}</span>
            </span>


          </div>
        </div>
      </div>
      
      {/* Área del editor */}
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
            onChange={(e) => setCode(e.target.value)}
            onScroll={syncScroll}
            onKeyUp={handleCursorPosition}
            onClick={handleCursorPosition}
            spellCheck="false"
            className="editor-textarea"
          />
          <pre className="editor-highlighting" dangerouslySetInnerHTML={{ __html: getHighlightedCode(code) }}></pre>
        </div>
      </div>
      
      {/* Footer del editor */}
      <div className="editor-footer">
        <div className="cursor-position">
          <span className="position-text">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="3" x2="9" y2="21"></line>
            </svg>
            Line {currentLine}, Column {currentColumn}
          </span>
        </div>
        <div className="editor-actions">
          <button className="editor-action-btn" onClick={validateCode}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            Validate
          </button>
          <button className="editor-action-btn" onClick={formatCode}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="21" y1="10" x2="3" y2="10"></line>
              <line x1="21" y1="6" x2="3" y2="6"></line>
              <line x1="21" y1="14" x2="3" y2="14"></line>
              <line x1="21" y1="18" x2="3" y2="18"></line>
            </svg>
            Format
          </button>
          <button className="editor-action-btn" onClick={saveFile}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
              <polyline points="17 21 17 13 7 13 7 21"></polyline>
              <polyline points="7 3 7 8 15 8"></polyline>
            </svg>
            Save
          </button>
          <button className="editor-action-btn primary" onClick={sendToRobot}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V6"></path>
            <path d="M5 13L12 6l7 7"></path>
          </svg>
          Send G-Code
        </button>
        </div>
      </div>
    </div>
  );
};

export default CodeEditorPanel;