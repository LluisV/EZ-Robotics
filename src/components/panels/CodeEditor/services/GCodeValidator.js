/**
 * Simplified G-code validator class - placeholder with minimal functionality
 * to maintain compatibility while reducing processing overhead
 */
class GCodeValidator {
  constructor() {
    // No initialization needed for simplified version
  }

  /**
   * Validate G-code - simplified to return empty arrays (no validation)
   * @param {string} gcode - The G-code to validate
   * @returns {Object} Validation results with errors and warnings
   */
  validate(gcode) {
    // Return empty arrays for errors and warnings
    return { 
      errors: [],
      warnings: []
    };
  }
}

export default GCodeValidator;