/**
 * Enhanced G-code validator with optimized performance
 * Uses chunk processing for large files
 * 
 * NOTES:
 * - Workers are disabled due to CORS issues with blob URLs in some environments
 * - Instead, uses non-blocking chunked processing on the main thread
 */
class GCodeValidator {
  constructor() {
    this.workerSupported = false; // Disabled for reliability
    this.worker = null;
    this.CHUNK_SIZE = 5000; // Number of lines to process in a chunk
    this.validationInProgress = false;
    this.validationQueue = [];
    this.validationResults = { errors: [], warnings: [] };
  }

  /**
   * Validate G-code synchronously or using chunked processing for large files
   * @param {string} gcode - The G-code to validate
   * @returns {Object} Validation results with errors and warnings
   */
  validate(gcode) {
    if (!gcode) {
      return { errors: [], warnings: [] };
    }
    
    const lines = gcode.split('\n');
    
    // For large files, use chunked validation
    if (lines.length > this.CHUNK_SIZE) {
      return this.validateLargeFile(gcode, lines);
    }
    
    // For smaller files, validate synchronously
    return this.validateSmallFile(lines);
  }
  
  /**
   * Validate a large G-code file using chunked processing
   * This is suitable for files with thousands of lines
   * @param {string} gcode - The full G-code content
   * @param {Array} lines - Array of lines in the G-code
   * @returns {Object} Validation results with errors and warnings
   */
  validateLargeFile(gcode, lines) {
    // Process only the first chunk for immediate feedback
    const totalChunks = Math.ceil(lines.length / this.CHUNK_SIZE);
    let errors = [];
    let warnings = [];
    
    // Process the first chunk synchronously
    const firstChunkEnd = Math.min(this.CHUNK_SIZE, lines.length);
    
    for (let i = 0; i < firstChunkEnd; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const result = this.validateLine(line, lineNum);
      errors = errors.concat(result.errors);
      warnings = warnings.concat(result.warnings);
    }
    
    // Process remaining chunks in the background using setTimeout
    if (totalChunks > 1) {
      setTimeout(() => {
        this.processRemainingChunks(lines, 1, totalChunks);
      }, 100);
    }
    
    return { errors, warnings };
  }
  
  /**
   * Validate a small G-code file synchronously
   * @param {Array} lines - Array of lines in the G-code
   * @returns {Object} Validation results with errors and warnings
   */
  validateSmallFile(lines) {
    let errors = [];
    let warnings = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const result = this.validateLine(line, lineNum);
      errors = errors.concat(result.errors);
      warnings = warnings.concat(result.warnings);
    }
    
    return { errors, warnings };
  }
  
  /**
   * Process remaining chunks of a large file in the background
   * @param {Array} lines - Array of lines in the G-code
   * @param {number} startChunk - The chunk index to start with
   * @param {number} totalChunks - Total number of chunks
   */
  processRemainingChunks(lines, startChunk, totalChunks) {
    let errors = [];
    let warnings = [];
    
    // Process one chunk at a time
    const startLine = startChunk * this.CHUNK_SIZE;
    const endLine = Math.min(startLine + this.CHUNK_SIZE, lines.length);
    
    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const result = this.validateLine(line, lineNum);
      errors = errors.concat(result.errors);
      warnings = warnings.concat(result.warnings);
    }
    
    // Dispatch an event with the results for this chunk
    document.dispatchEvent(new CustomEvent('gcode-validation-chunk', {
      detail: { errors, warnings, chunkIndex: startChunk }
    }));
    
    // Process the next chunk if not done
    if (startChunk + 1 < totalChunks) {
      setTimeout(() => {
        this.processRemainingChunks(lines, startChunk + 1, totalChunks);
      }, 50); // Small delay to allow UI to respond
    } else {
      // All chunks have been processed
      document.dispatchEvent(new CustomEvent('gcode-validation-complete'));
    }
  }
  
  /**
   * Validate a single line of G-code
   * @param {string} line - The line of G-code to validate
   * @param {number} lineNum - The line number
   * @returns {Object} Validation results for this line
   */
  validateLine(line, lineNum) {
    const errors = [];
    const warnings = [];
    
    // Clean the line (remove comments)
    let cleanedLine = line.replace(/\(.*?\)/g, '');
    cleanedLine = cleanedLine.split(';')[0].trim();
    
    if (!cleanedLine) return { errors, warnings };
    
    const VALID_PREFIXES = ['G', 'M', 'T', 'X', 'Y', 'Z', 'F', 'I', 'J', 'K', 'R', 'P', 'Q', 'E', 'S'];
    
    // Extract commands with regex
    const commands = cleanedLine.match(/[A-Z]-?\d+(\.\d+)?/g) || [];
    
    for (const command of commands) {
      const prefix = command.charAt(0).toUpperCase();
      const value = command.slice(1);
      
      if (!VALID_PREFIXES.includes(prefix)) {
        errors.push({
          line: lineNum,
          message: `Unknown command or parameter '${command}'`
        });
      } else if ((prefix === 'G' || prefix === 'M') && !/^\d+(\.\d+)?$/.test(value)) {
        errors.push({
          line: lineNum,
          message: `Invalid ${prefix}-code '${command}' — expected a number after ${prefix}`
        });
      } else if (!['G', 'M', 'T'].includes(prefix) && !/^-?\d+(\.\d+)?$/.test(value)) {
        errors.push({
          line: lineNum,
          message: `Invalid value for parameter ${prefix}: '${value}' is not numeric`
        });
      }
    }
    
    // G0/G1 checks
    if (/G0/.test(cleanedLine) || /G1/.test(cleanedLine)) {
      if (!/[XYZ]/.test(cleanedLine)) {
        warnings.push({
          line: lineNum,
          message: 'G0/G1 command has no axis movement specified'
        });
      }
    }
    
    // High speed warning
    const speedMatch = cleanedLine.match(/F(\d+(\.\d+)?)/);
    if (speedMatch) {
      const speed = parseFloat(speedMatch[1]);
      if (speed > 5000) {
        warnings.push({
          line: lineNum,
          message: `Very high speed (F${speed}) may cause issues`
        });
      }
    }
    
    // G2/G3 arc parameter check
    if (/G2/.test(cleanedLine) || /G3/.test(cleanedLine)) {
      if (!/[IJR]/.test(cleanedLine)) {
        errors.push({
          line: lineNum,
          message: 'Arc command missing I/J or R parameter'
        });
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Clean up resources when the validator is no longer needed
   */
  dispose() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (err) {
        console.warn("Error terminating worker:", err);
      }
      this.worker = null;
    }
    
    // Clear any stored validation results
    this.validationResults = { errors: [], warnings: [] };
    this.validationQueue = [];
    this.validationInProgress = false;
    
    // Remove any event listeners
    try {
      document.removeEventListener('gcode-validation-results', this.validationResultsHandler);
      document.removeEventListener('gcode-validation-chunk', this.validationChunkHandler);
      document.removeEventListener('gcode-validation-complete', this.validationCompleteHandler);
    } catch (err) {
      console.warn("Error removing event listeners:", err);
    }
  }
}

export default GCodeValidator;