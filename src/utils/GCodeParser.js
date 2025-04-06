/**
 * Utility for parsing G-code and extracting toolpath information
 */
class GCodeParser {
    constructor() {
      this.reset();
    }
  
    /**
     * Reset the parser state
     */
    reset() {
      // Current position state
      this.position = { x: 0, y: 0, z: 0 };
      this.previousPosition = { x: 0, y: 0, z: 0 };
      
      // Default settings
      this.feedRate = 1000;
      this.rapidFeedRate = 3000;
      this.absolutePositioning = true; // G90 is default for most machines
      
      // Collection of toolpath segments
      this.segments = [];
  
      // Collection of all points
      this.points = [];
      
      // Tool state
      this.toolOn = false;
    }
  
    /**
     * Parse G-code string and extract toolpath information
     * @param {string} gcode - The G-code to parse
     * @returns {Object} Toolpath information
     */
    parse(gcode) {
      if (!gcode) return { segments: [], bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } } };
      
      this.reset();
      
      // Split by lines and process each line
      const lines = gcode.split('\n');
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex].trim();
        
        // Skip empty lines and comments
        if (!line || line.startsWith(';')) continue;
        
        // Extract command and comment
        const commentIndex = line.indexOf(';');
        const commandPart = commentIndex >= 0 ? line.substring(0, commentIndex).trim() : line.trim();
        
        // Skip if there's no command after removing comments
        if (!commandPart) continue;
        
        // Process the command
        this.processCommand(commandPart, lineIndex);
      }
      
      // Calculate bounds for the toolpath
      const bounds = this.calculateBounds();
      
      return {
        segments: this.segments,
        points: this.points,
        bounds
      };
    }
  
    /**
     * Process a single G-code command
     * @param {string} command - The command to process
     * @param {number} lineIndex - Line number in the original G-code
     */
    processCommand(command, lineIndex) {
      // Save previous position
      this.previousPosition = { ...this.position };
      
      // Extract tokens (command + parameters)
      const tokens = command.split(/\s+/);
      const commandType = tokens[0].toUpperCase();
      
      // Extract parameters (like X100 Y200 Z10 F1000)
      const params = {};
      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const paramName = token.charAt(0).toUpperCase();
        const paramValue = parseFloat(token.substring(1));
        
        if (!isNaN(paramValue)) {
          params[paramName] = paramValue;
        }
      }
      
      // Process based on command type
      switch (commandType) {
        case 'G0': // Rapid move
        case 'G1': // Linear move
          this.processMove(commandType, params, lineIndex);
          break;
        
        case 'G2': // Clockwise arc
        case 'G3': // Counter-clockwise arc
          this.processArc(commandType, params, lineIndex);
          break;
        
        case 'G28': // Home
          this.processHome(params);
          break;
        
        case 'G90': // Absolute positioning
          this.absolutePositioning = true;
          break;
        
        case 'G91': // Relative positioning
          this.absolutePositioning = false;
          break;
        
        case 'M3': // Spindle on (tool on)
        case 'M4': // Spindle on (tool on, other direction)
          this.toolOn = true;
          break;
        
        case 'M5': // Spindle off (tool off)
          this.toolOn = false;
          break;
        
        // Add more command handlers as needed
      }
      
      // Update feed rate if specified
      if (params.F) {
        this.feedRate = params.F;
      }
    }
  
    /**
     * Process a linear move (G0/G1)
     * @param {string} command - The command (G0/G1)
     * @param {Object} params - Command parameters
     * @param {number} lineIndex - Line number in the original G-code
     */
    processMove(command, params, lineIndex) {
      // Calculate new position
      const newX = params.X !== undefined
        ? (this.absolutePositioning ? params.X : this.position.x + params.X)
        : this.position.x;
        
      const newY = params.Y !== undefined
        ? (this.absolutePositioning ? params.Y : this.position.y + params.Y)
        : this.position.y;
        
      const newZ = params.Z !== undefined
        ? (this.absolutePositioning ? params.Z : this.position.z + params.Z)
        : this.position.z;
      
      // Create a new segment if the position actually changes
      if (newX !== this.position.x || newY !== this.position.y || newZ !== this.position.z) {
        const isRapid = command === 'G0';
        
        this.segments.push({
          type: 'line',
          start: { ...this.position },
          end: { x: newX, y: newY, z: newZ },
          rapid: isRapid,
          toolOn: this.toolOn && !isRapid, // Typically G0 moves don't cut
          feedRate: isRapid ? this.rapidFeedRate : this.feedRate,
          lineIndex
        });
        
        // Add point to the list
        this.points.push({ x: newX, y: newY, z: newZ });
        
        // Update position
        this.position = { x: newX, y: newY, z: newZ };
      }
    }
  
    /**
     * Process an arc move (G2/G3)
     * @param {string} command - The command (G2/G3)
     * @param {Object} params - Command parameters
     * @param {number} lineIndex - Line number in the original G-code
     */
    processArc(command, params, lineIndex) {
      // Calculate end position
      const endX = params.X !== undefined
        ? (this.absolutePositioning ? params.X : this.position.x + params.X)
        : this.position.x;
        
      const endY = params.Y !== undefined
        ? (this.absolutePositioning ? params.Y : this.position.y + params.Y)
        : this.position.y;
        
      const endZ = params.Z !== undefined
        ? (this.absolutePositioning ? params.Z : this.position.z + params.Z)
        : this.position.z;
      
      // Calculate center offset
      const centerX = this.position.x + (params.I || 0);
      const centerY = this.position.y + (params.J || 0);
      
      // For simplicity, we'll approximate arc as a line segment
      // In a real implementation, you'd want to generate intermediate points along the arc
      // or use the ThreeJS arc/curve primitives
      this.segments.push({
        type: 'arc',
        start: { ...this.position },
        end: { x: endX, y: endY, z: endZ },
        center: { x: centerX, y: centerY },
        clockwise: command === 'G2',
        toolOn: this.toolOn,
        feedRate: this.feedRate,
        lineIndex
      });
      
      // Add point to the list
      this.points.push({ x: endX, y: endY, z: endZ });
      
      // Update position
      this.position = { x: endX, y: endY, z: endZ };
    }
  
    /**
     * Process a home command (G28)
     * @param {Object} params - Command parameters
     */
    processHome(params) {
      // If no axes specified, home all axes
      if (Object.keys(params).length === 0 || params.X === 0 || params.Y === 0 || params.Z === 0) {
        this.segments.push({
          type: 'line',
          start: { ...this.position },
          end: { x: 0, y: 0, z: 0 },
          rapid: true,
          toolOn: false,
          feedRate: this.rapidFeedRate
        });
        
        this.position = { x: 0, y: 0, z: 0 };
      } 
      // Otherwise home only specified axes
      else {
        const newX = params.X !== undefined ? 0 : this.position.x;
        const newY = params.Y !== undefined ? 0 : this.position.y;
        const newZ = params.Z !== undefined ? 0 : this.position.z;
        
        this.segments.push({
          type: 'line',
          start: { ...this.position },
          end: { x: newX, y: newY, z: newZ },
          rapid: true,
          toolOn: false,
          feedRate: this.rapidFeedRate
        });
        
        this.position = { x: newX, y: newY, z: newZ };
      }
      
      // Add point to the list
      this.points.push({ ...this.position });
    }
  
    /**
     * Calculate the bounding box of the toolpath
     * @returns {Object} Bounds object with min and max positions
     */
    calculateBounds() {
      const bounds = {
        min: { x: Infinity, y: Infinity, z: Infinity },
        max: { x: -Infinity, y: -Infinity, z: -Infinity }
      };
      
      // If no points, return default bounds
      if (this.points.length === 0) {
        return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
      }
      
      // Calculate actual bounds
      for (const point of this.points) {
        bounds.min.x = Math.min(bounds.min.x, point.x);
        bounds.min.y = Math.min(bounds.min.y, point.y);
        bounds.min.z = Math.min(bounds.min.z, point.z);
        
        bounds.max.x = Math.max(bounds.max.x, point.x);
        bounds.max.y = Math.max(bounds.max.y, point.y);
        bounds.max.z = Math.max(bounds.max.z, point.z);
      }
      
      return bounds;
    }
  }
  
  export default GCodeParser;