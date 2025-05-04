/**
 * Enhanced G-code syntax highlighter with support for GRBL/FluidNC format
 * Handles consecutive coordinate-only moves without affecting cursor position
 * 
 * PERFORMANCE OPTIMIZATION: Added low performance mode for faster rendering
 */
class GCodeHighlighter {
  constructor() {
    // Keep track of active G-code mode across lines
    this.activeGMode = null;
  }

  /**
   * Highlight multiple lines of G-code
   * @param {string} code - G-code text to highlight
   * @param {Array} errors - Array of error objects
   * @param {Array} warnings - Array of warning objects 
   * @param {number} highlightedLine - Currently highlighted line number
   * @returns {string} HTML with syntax highlighting
   */
  static highlightCode(code, errors, warnings, highlightedLine) {
    return;
    if (!code) return '';
    
    const lines = code.split('\n');
    let activeGMode = null; // Track the active G mode across lines
    
    const highlightedLines = lines.map((line, i) => {
      const lineNum = i + 1;
      
      // Clean the line to analyze tokens without comments
      const cleanedLine = this.cleanLine(line);
      
      // Extract tokens to check for G commands
      const tokens = this.extractTokens(cleanedLine);
      
      // Check if this line has a G command or just coordinates
      const gCommands = tokens.filter(token => token.startsWith('G'));
      const hasCoordinates = tokens.some(token => /^[XYZ]-?\d+(\.\d+)?$/.test(token));
      
      // Update active G mode if present
      if (gCommands.length > 0) {
        const gCommand = gCommands[0];
        // Only update for movement commands
        if (gCommand.startsWith('G0') || gCommand.startsWith('G1') || 
            gCommand.startsWith('G2') || gCommand.startsWith('G3')) {
          activeGMode = gCommand;
        }
      }
      
      // Check if this is a coordinate-only line that needs implied G-command highlighting
      const isImpliedMove = hasCoordinates && gCommands.length === 0 && activeGMode;
      
      // Apply highlighting
      return this.highlightLine(line, lineNum, errors, warnings, highlightedLine, isImpliedMove, activeGMode);
    });
    
    return highlightedLines.join('');
  }
  
  /**
   * PERFORMANCE OPTIMIZATION: Simplified highlighting for low performance mode
   * @param {string} code - G-code text to highlight 
   * @param {number} highlightedLine - Currently highlighted line number
   * @returns {string} HTML with minimal highlighting
   */
  static highlightCodeLowPerf(code, highlightedLine) {
    if (!code) return '';
    
    const lines = code.split('\n');
    
    // Only handle basic line highlighting, and use simplified content
    const highlightedLines = lines.map((line, i) => {
      const lineNum = i + 1;
      const isHighlighted = lineNum === highlightedLine;
      
      // Very minimal highlighting - just comments and highlighted lines
      let content = line.replace(/;(.*)$/, '<span class="code-comment">;$1</span>');
      if (/\(.*?\)/.test(content)) {
        content = content.replace(/\((.*?)\)/g, '<span class="code-comment">($1)</span>');
      }
      
      return `<div class="code-line${isHighlighted ? ' highlighted-line' : ''}">${content || ' '}</div>`;
    });
    
    return highlightedLines.join('');
  }
  
  /**
   * Highlight a single line of G-code
   * @param {string} line - Line of G-code to highlight
   * @param {number} lineNum - Line number
   * @param {Array} errors - Array of error objects
   * @param {Array} warnings - Array of warning objects
   * @param {number} highlightedLine - Currently highlighted line number
   * @param {boolean} isImpliedMove - Whether this line is a coordinate-only implied move
   * @param {string} activeGMode - The active G mode (G0, G1, etc.)
   * @returns {string} HTML with syntax highlighting
   */
  static highlightLine(line, lineNum, errors, warnings, highlightedLine, isImpliedMove = false, activeGMode = null) {
    return;
    // Check if this line has errors or warnings
    const hasError = errors.some(err => err.line === lineNum);
    const hasWarning = warnings.some(warn => warn.line === lineNum);
    
    // Get error/warning message for tooltip
    const errorMsg = errors.find(err => err.line === lineNum)?.message || '';
    const warningMsg = warnings.find(warn => warn.line === lineNum)?.message || '';
    const tooltipMsg = errorMsg || warningMsg;
    
    // Set line class based on state
    let lineClass = "code-line";
    if (lineNum === highlightedLine) lineClass += ' highlighted-line';
    if (hasError) lineClass += ' error-line';
    if (hasWarning) lineClass += ' warning-line';
    if (isImpliedMove) lineClass += ' implied-move';
    
    // Add tooltip with error/warning message
    const tooltipAttr = tooltipMsg ? ` data-tooltip="${tooltipMsg}"` : '';
    
    // Add data attribute for implied G command if applicable
    const impliedCommandAttr = isImpliedMove && activeGMode ? 
        ` data-implied-command="${activeGMode}"` : '';
    
    // Apply syntax highlighting
    let highlightedContent = line;
    
    // Highlight comments first
    highlightedContent = this.highlightComments(highlightedContent);
    
    // Highlight GRBL $ commands
    highlightedContent = this.highlightGrblCommands(highlightedContent);
    
    // Highlight G and M commands
    highlightedContent = this.highlightGMCommands(highlightedContent);
    
    // Highlight parameters
    highlightedContent = this.highlightParameters(highlightedContent);
    
    // Ensure non-empty content for empty lines
    if (!highlightedContent.trim()) highlightedContent = ' ';
    
    return `<div class="${lineClass}"${tooltipAttr}${impliedCommandAttr}>${highlightedContent}</div>`;
  }
  
  /**
   * Clean a line by removing comments and trimming whitespace
   */
  static cleanLine(line) {
    // Handle parentheses comments
    let cleanedLine = line.replace(/\(.*?\)/g, '');
    
    // Handle semicolon comments
    if (cleanedLine.includes(';')) {
      cleanedLine = cleanedLine.split(';')[0];
    }
    
    return cleanedLine.trim();
  }
  
  /**
   * Extract tokens from a line of G-code
   */
  static extractTokens(line) {
    // This regex matches G-code tokens like G0, X100, Y-23.5, etc.
    const tokenRegex = /([A-Z])(-?\d+\.?\d*)/g;
    const tokens = [];
    let match;
    
    while ((match = tokenRegex.exec(line)) !== null) {
      tokens.push(match[0]);
    }
    
    return tokens;
  }
  
  /**
   * Highlight comments in G-code
   */
  static highlightComments(line) {
    // Highlight semicolon comments (;comment)
    let result = line.replace(/;(.*)$/, '<span class="code-comment">;$1</span>');
    
    // Highlight parentheses comments ((comment))
    let openIndex = result.indexOf('(');
    while (openIndex !== -1) {
      const closeIndex = result.indexOf(')', openIndex);
      if (closeIndex === -1) break;
      
      const beforeComment = result.substring(0, openIndex);
      const comment = result.substring(openIndex, closeIndex + 1);
      const afterComment = result.substring(closeIndex + 1);
      
      result = beforeComment + 
               '<span class="code-comment">' + comment + '</span>' + 
               afterComment;
      
      openIndex = result.indexOf('(', beforeComment.length + comment.length + 30);
    }
    
    return result;
  }
  
  /**
   * Highlight GRBL-specific commands
   */
  static highlightGrblCommands(line) {
    // Highlight $ commands
    let result = line.replace(/(\$[A-Za-z0-9=#?\[\]]+)/g, '<span class="code-grbl-command">$1</span>');
    
    // Highlight realtime commands
    result = result.replace(/(\?|~|!)/g, '<span class="code-grbl-realtime">$1</span>');
    
    return result;
  }
  
  /**
   * Highlight G and M commands
   */
  static highlightGMCommands(line) {
    // This regex matches G and M codes with their numbers
    return line.replace(/\b([GMT])(-?\d+\.?\d*)/g, '<span class="code-command">$1$2</span>');
  }
  
  /**
   * Highlight parameters and their values
   */
  static highlightParameters(line) {
    // This handles parameters like X100, Y-23.5, etc.
    return line.replace(/([XYZABCIJKRFSDPQE])(-?\d+\.?\d*)/g, 
      '<span class="code-param">$1</span><span class="code-value">$2</span>');
  }
}

export default GCodeHighlighter;