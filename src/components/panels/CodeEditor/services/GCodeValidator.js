/**
 * Enhanced G-code validator with special support for GRBL/FluidNC formats
 * With support for consecutive coordinate-only moves
 */
class GCodeValidator {
  constructor() {
    // Define common valid commands and parameters for validation
    this.VALID_G_CODES = [
      '0', '1', '2', '3', '4', '17', '18', '19', '20', '21', 
      '28', '90', '91', '92'
    ];
    
    this.VALID_M_CODES = [
      '0', '1', '2', '3', '4', '5', '6', '30'
    ];
    
    this.VALID_PARAMS = ['X', 'Y', 'Z', 'A', 'B', 'C', 'I', 'J', 'K', 'R', 'F', 'S', 'P', 'Q', 'E', 'T'];
    
    // Keep track of the active G-code mode
    this.activeGMode = null;
  }

  /**
   * Validate G-code with support for GRBL/FluidNC format
   * @param {string} gcode - The G-code to validate
   * @returns {Object} Validation results with errors and warnings
   */
  validate(gcode) {
    const errors = [];
    const warnings = [];
    
    if (!gcode) return { errors, warnings };
    
    const lines = gcode.split('\n');
    this.activeGMode = null; // Reset active G mode
    
    lines.forEach((line, i) => {
      const lineNum = i + 1;
      
      // First clean the line - remove comments and trim whitespace
      let cleanedLine = this.cleanLine(line);
      if (!cleanedLine) return; // Skip empty lines or pure comments
      
      // Check for GRBL-specific commands first ($ commands)
      if (cleanedLine.startsWith('$')) {
        // We'll accept all $ commands for now
        return;
      }
      
      // Now extract all command tokens (G0, X100, Y100, etc.)
      // GRBL format often has no spaces between tokens, e.g., G0X10Y10
      const tokens = this.extractTokens(cleanedLine);
      
      // Check if this is a coordinate-only line (just X, Y, Z with no G command)
      const hasGCommand = tokens.some(token => token.startsWith('G'));
      const hasCoordinates = tokens.some(token => /^[XYZ]-?\d+(\.\d+)?$/.test(token));
      
      // If this line has coordinates but no G command, it uses the previous active mode
      if (hasCoordinates && !hasGCommand && this.activeGMode) {
        // This is a continued move in the active G mode
        // No need to validate the G mode as it's implied
      } else {
        // Update active G mode if present
        const gCommands = tokens.filter(token => token.startsWith('G'));
        if (gCommands.length > 0) {
          const gValue = gCommands[0].substring(1);
          if (this.isValidGCode(gValue)) {
            // Only update active mode for movement commands
            if (gValue === '0' || gValue === '1' || gValue === '2' || gValue === '3') {
              this.activeGMode = gCommands[0];
            }
          }
        }
      }
      
      // Validate each token
      tokens.forEach(token => {
        const prefix = token.charAt(0).toUpperCase();
        const value = token.substring(1);
        
        // Validate token based on its type
        switch (prefix) {
          case 'G':
            if (!this.isValidGCode(value)) {
              errors.push({
                line: lineNum,
                message: `Invalid G-code '${token}'`
              });
            }
            break;
            
          case 'M':
            if (!this.isValidMCode(value)) {
              errors.push({
                line: lineNum,
                message: `Invalid M-code '${token}'`
              });
            }
            break;
            
          case 'F':
            if (!this.isValidNumber(value)) {
              errors.push({
                line: lineNum,
                message: `Invalid feed rate '${token}'`
              });
            } else if (parseFloat(value) > 5000) {
              warnings.push({
                line: lineNum,
                message: `Very high feed rate (${value}) may cause issues`
              });
            }
            break;
            
          case 'S':
            if (!this.isValidNumber(value)) {
              errors.push({
                line: lineNum,
                message: `Invalid spindle speed '${token}'`
              });
            }
            break;
            
          default:
            // Check if it's a valid parameter
            if (this.VALID_PARAMS.includes(prefix)) {
              if (!this.isValidNumber(value)) {
                errors.push({
                  line: lineNum,
                  message: `Invalid value for parameter ${prefix}: '${value}'`
                });
              }
            } else {
              // Only report errors for non-whitespace issues
              if (prefix.trim()) {
                errors.push({
                  line: lineNum,
                  message: `Unknown parameter '${token}'`
                });
              }
            }
        }
      });
      
      // Command specific validations
      
      // For lines with only coordinates, use active G mode for validation
      const effectiveGMode = hasGCommand ? null : this.activeGMode;
      
      // G0/G1 should have at least one axis (check both explicit and implied modes)
      if (this.hasCommand(tokens, 'G0') || this.hasCommand(tokens, 'G1') || 
          (!hasGCommand && (effectiveGMode === 'G0' || effectiveGMode === 'G1'))) {
        if (!this.hasAnyAxis(tokens)) {
          warnings.push({
            line: lineNum,
            message: 'Movement command has no axis specified'
          });
        }
      }
      
      // G2/G3 arcs need center point or radius
      if (this.hasCommand(tokens, 'G2') || this.hasCommand(tokens, 'G3') ||
          (!hasGCommand && (effectiveGMode === 'G2' || effectiveGMode === 'G3'))) {
        if (!this.hasArcParameters(tokens)) {
          errors.push({
            line: lineNum,
            message: 'Arc command missing I/J or R parameter'
          });
        }
      }
    });
    
    return { errors, warnings };
  }
  
  /**
   * Clean a line by removing comments and trimming whitespace
   */
  cleanLine(line) {
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
  extractTokens(line) {
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
   * Check if a G-code value is valid
   */
  isValidGCode(value) {
    return this.VALID_G_CODES.includes(value) || 
           this.VALID_G_CODES.some(code => code === value.replace(/\.0+$/, ''));
  }
  
  /**
   * Check if an M-code value is valid
   */
  isValidMCode(value) {
    return this.VALID_M_CODES.includes(value) ||
           this.VALID_M_CODES.some(code => code === value.replace(/\.0+$/, ''));
  }
  
  /**
   * Check if a value is a valid number
   */
  isValidNumber(value) {
    return /^-?\d+(\.\d+)?$/.test(value);
  }
  
  /**
   * Check if tokens contain a specific command
   */
  hasCommand(tokens, cmd) {
    return tokens.some(token => token === cmd);
  }
  
  /**
   * Check if tokens contain any axis parameter
   */
  hasAnyAxis(tokens) {
    return tokens.some(token => /^[XYZABC]-?\d+(\.\d+)?$/.test(token));
  }
  
  /**
   * Check if tokens contain arc parameters
   */
  hasArcParameters(tokens) {
    return tokens.some(token => /^[IJR]-?\d+(\.\d+)?$/.test(token));
  }
}

export default GCodeValidator;