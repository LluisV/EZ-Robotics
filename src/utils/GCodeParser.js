/**
 * Enhanced G-code parser with GRBL/FluidNC format support
 * 
 * This parser handles:
 * - Traditional G-code with spaces between commands
 * - GRBL/FluidNC format with no spaces
 * - Extracts toolpath information for visualization
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
    
    // GRBL-specific state
    this.spindleSpeed = 0;
    this.toolNumber = 0;
    this.workOffset = { x: 0, y: 0, z: 0 }; // For G54-G59
    
    // Stats about the code
    this.stats = {
      rapidMoves: 0,
      feedMoves: 0,
      arcMoves: 0,
      totalDistance: 0,
      rapidDistance: 0,
      feedDistance: 0,
      estimatedTime: 0,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }
    };
  }

  /**
   * Parse G-code string and extract toolpath information
   * @param {string} gcode - The G-code to parse
   * @returns {Object} Toolpath information and metadata
   */
  parse(gcode) {
    if (!gcode) return { 
      segments: [], 
      points: [],
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      stats: this.stats
    };
    
    this.reset();
    const startTime = performance.now();
    
    // Split by lines and process each line
    const lines = gcode.split('\n');
    
    // Extract GRBL format type if possible
    const format = this.detectFormat(lines);
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith(';') || line.startsWith('(')) continue;
      
      // Extract command and comment
      const commentIndex = Math.min(
        line.indexOf(';') >= 0 ? line.indexOf(';') : Infinity,
        line.indexOf('(') >= 0 ? line.indexOf('(') : Infinity
      );
      
      const commandPart = commentIndex !== Infinity 
        ? line.substring(0, commentIndex).trim() 
        : line.trim();
      
      // Skip if there's no command after removing comments
      if (!commandPart) continue;
      
      // Process the command
      this.processCommand(commandPart, lineIndex);
    }
    
    // Calculate bounds for the toolpath
    const bounds = this.calculateBounds();
    
    // Calculate estimated time
    this.calculateEstimatedTime();
    
    // Store bounds in stats
    this.stats.bounds = bounds;
    
    const endTime = performance.now();
    console.log(`Parsed G-code in ${(endTime - startTime).toFixed(2)}ms`);
    
    return {
      segments: this.segments,
      points: this.points,
      bounds,
      stats: this.stats,
      format
    };
  }
  
  /**
   * Detect the format of the G-code (Standard, GRBL, etc.)
   */
  detectFormat(lines) {
    // Sample the first 20 lines or all lines if fewer
    const sampleSize = Math.min(20, lines.length);
    const sampleLines = lines.slice(0, sampleSize);
    
    // Filter out comments and empty lines
    const filteredLines = sampleLines.filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('(');
    });
    
    if (filteredLines.length === 0) return 'unknown';
    
    // Check for GRBL/FluidNC format indicators
    const grblFormatCount = filteredLines.filter(line => {
      // GRBL often has no spaces between commands like G0X10Y10
      return /[GMT][0-9]+[XYZ]-?[0-9]/.test(line) || 
             line.startsWith('$') || 
             line === '?' || 
             line === '~' ||
             line === '!';
    }).length;
    
    const standardFormatCount = filteredLines.filter(line => {
      // Standard G-code often has spaces between commands like G0 X10 Y10
      return /[GMT][0-9]+\s+[XYZ]/.test(line);
    }).length;
    
    // Determine format based on prevalence
    if (grblFormatCount > standardFormatCount) {
      return 'grbl';
    } else if (standardFormatCount > grblFormatCount) {
      return 'standard';
    } else {
      // Check for other indicators
      const hasGrblCommands = filteredLines.some(line => line.startsWith('$'));
      return hasGrblCommands ? 'grbl' : 'standard';
    }
  }

  /**
   * Process a single G-code command (traditional or GRBL format)
   * @param {string} command - The command to process
   * @param {number} lineIndex - Line number in the original G-code
   */
  processCommand(command, lineIndex) {
    // Save previous position
    this.previousPosition = { ...this.position };
    
    // Extract tokens (command + parameters)
    // Handle both standard format (G0 X10 Y10) and GRBL format (G0X10Y10)
    const tokens = {};
    
    // Regex to match both formats:
    // Standard: letter followed by numeric value, separated by spaces
    // GRBL: letters directly followed by numeric values without spaces
    const regex = /([A-Z])(-?\d+\.?\d*)/g;
    let match;
    
    while ((match = regex.exec(command)) !== null) {
      const [, letter, value] = match;
      tokens[letter] = parseFloat(value);
    }
    
    // Process modal G-codes
    if (tokens.G !== undefined) {
      switch (tokens.G) {
        case 0: // Rapid move
          this.processMove('G0', tokens, lineIndex);
          break;
          
        case 1: // Linear move
          this.processMove('G1', tokens, lineIndex);
          break;
          
        case 2: // Clockwise arc
        case 3: // Counter-clockwise arc
          this.processArc(tokens.G === 2 ? 'G2' : 'G3', tokens, lineIndex);
          break;
          
        case 17: // XY plane selection
        case 18: // ZX plane selection
        case 19: // YZ plane selection
          // Just track the current plane, affects arcs
          break;
          
        case 20: // Inch units
          // For simplicity we don't convert units here
          break;
          
        case 21: // Millimeter units
          // Default is mm, no change needed
          break;
          
        case 28: // Home axes
          this.processHome(tokens);
          break;
          
        case 90: // Absolute positioning
          this.absolutePositioning = true;
          break;
          
        case 91: // Relative positioning
          this.absolutePositioning = false;
          break;
          
        case 92: // Set position
          this.setPosition(tokens);
          break;
      }
    }
    
    // Process M-codes
    if (tokens.M !== undefined) {
      switch (tokens.M) {
        case 0: // Program stop
        case 1: // Optional stop
          break;
          
        case 2: // Program end
        case 30: // Program end and rewind
          break;
          
        case 3: // Spindle on clockwise
        case 4: // Spindle on counter-clockwise
          this.toolOn = true;
          if (tokens.S !== undefined) {
            this.spindleSpeed = tokens.S;
          }
          break;
          
        case 5: // Spindle off
          this.toolOn = false;
          break;
          
        case 6: // Tool change
          if (tokens.T !== undefined) {
            this.toolNumber = tokens.T;
          }
          break;
      }
    }
    
    // Process T code (Tool select)
    if (tokens.T !== undefined && tokens.M === undefined) {
      this.toolNumber = tokens.T;
    }
    
    // Process S code (Spindle speed)
    if (tokens.S !== undefined && tokens.M === undefined) {
      this.spindleSpeed = tokens.S;
    }
    
    // Update feed rate if specified
    if (tokens.F !== undefined) {
      this.feedRate = tokens.F;
    }
  }

  /**
   * Process a linear move (G0/G1)
   * @param {string} command - The command (G0/G1)
   * @param {Object} tokens - Parsed tokens
   * @param {number} lineIndex - Line number in the original G-code
   */
  processMove(command, tokens, lineIndex) {
    // Calculate new position
    const newX = tokens.X !== undefined
      ? (this.absolutePositioning ? tokens.X : this.position.x + tokens.X)
      : this.position.x;
      
    const newY = tokens.Y !== undefined
      ? (this.absolutePositioning ? tokens.Y : this.position.y + tokens.Y)
      : this.position.y;
      
    const newZ = tokens.Z !== undefined
      ? (this.absolutePositioning ? tokens.Z : this.position.z + tokens.Z)
      : this.position.z;
    
    // Create a new segment if the position actually changes
    if (newX !== this.position.x || newY !== this.position.y || newZ !== this.position.z) {
      const isRapid = command === 'G0';
      
      // Calculate distance
      const dx = newX - this.position.x;
      const dy = newY - this.position.y;
      const dz = newZ - this.position.z;
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      // Update statistics
      this.stats.totalDistance += distance;
      if (isRapid) {
        this.stats.rapidDistance += distance;
        this.stats.rapidMoves++;
      } else {
        this.stats.feedDistance += distance;
        this.stats.feedMoves++;
      }
      
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
   * @param {Object} tokens - Parsed tokens
   * @param {number} lineIndex - Line number in the original G-code
   */
  processArc(command, tokens, lineIndex) {
    // Calculate end position
    const endX = tokens.X !== undefined
      ? (this.absolutePositioning ? tokens.X : this.position.x + tokens.X)
      : this.position.x;
      
    const endY = tokens.Y !== undefined
      ? (this.absolutePositioning ? tokens.Y : this.position.y + tokens.Y)
      : this.position.y;
      
    const endZ = tokens.Z !== undefined
      ? (this.absolutePositioning ? tokens.Z : this.position.z + tokens.Z)
      : this.position.z;
    
    // Calculate center offset
    let centerX, centerY;
    
    if (tokens.R !== undefined) {
      // Use radius mode (R parameter)
      const radius = tokens.R;
      const dx = endX - this.position.x;
      const dy = endY - this.position.y;
      const chord = Math.sqrt(dx*dx + dy*dy);
      
      // Cannot calculate center if chord is too small
      if (chord < 0.001) {
        console.warn(`Warning: Arc chord too small at line ${lineIndex}`);
        return;
      }
      
      // Cannot calculate center if radius is too small
      if (Math.abs(radius) < chord/2) {
        console.warn(`Warning: Arc radius too small at line ${lineIndex}`);
        return;
      }
      
      // Calculate height of arc
      const h = Math.sqrt(radius*radius - (chord/2)*(chord/2));
      
      // Calculate center
      const clockwise = command === 'G2';
      const sign = clockwise ? -1 : 1;
      
      centerX = this.position.x + dx/2 - sign * h * dy / chord;
      centerY = this.position.y + dy/2 + sign * h * dx / chord;
    } else {
      // Use center offset mode (I, J parameters)
      // I and J are relative to current position
      centerX = this.position.x + (tokens.I || 0);
      centerY = this.position.y + (tokens.J || 0);
    }
    
    // Calculate arc segment properties
    const startAngle = Math.atan2(
      this.position.y - centerY,
      this.position.x - centerX
    );
    
    const endAngle = Math.atan2(
      endY - centerY,
      endX - centerX
    );
    
    // Calculate distance (approximate)
    const radius = Math.sqrt(
      Math.pow(this.position.x - centerX, 2) + 
      Math.pow(this.position.y - centerY, 2)
    );
    
    let angleDistance = endAngle - startAngle;
    const clockwise = command === 'G2';
    
    // Adjust angle distance based on arc direction
    if (clockwise && angleDistance > 0) {
      angleDistance -= 2 * Math.PI;
    } else if (!clockwise && angleDistance < 0) {
      angleDistance += 2 * Math.PI;
    }
    
    // Calculate arc length
    const arcLength = Math.abs(angleDistance * radius);
    
    // Update statistics
    this.stats.totalDistance += arcLength;
    this.stats.feedDistance += arcLength;
    this.stats.arcMoves++;
    
    // Add the arc segment
    this.segments.push({
      type: 'arc',
      start: { ...this.position },
      end: { x: endX, y: endY, z: endZ },
      center: { x: centerX, y: centerY },
      clockwise,
      toolOn: this.toolOn,
      feedRate: this.feedRate,
      lineIndex
    });
    
    // Add several intermediate points along the arc for better visualization
    const numPoints = Math.max(2, Math.floor(arcLength / 5)); // One point every 5mm
    
    for (let i = 1; i <= numPoints; i++) {
      const fraction = i / numPoints;
      const angle = startAngle + fraction * angleDistance;
      
      const pointX = centerX + radius * Math.cos(angle);
      const pointY = centerY + radius * Math.sin(angle);
      
      // Linear interpolation for Z axis
      const pointZ = this.position.z + fraction * (endZ - this.position.z);
      
      this.points.push({ x: pointX, y: pointY, z: pointZ });
    }
    
    // Add end point
    this.points.push({ x: endX, y: endY, z: endZ });
    
    // Update position
    this.position = { x: endX, y: endY, z: endZ };
  }

  /**
   * Process a home command (G28)
   * @param {Object} tokens - Parsed tokens
   */
  processHome(tokens) {
    // If no axes specified, home all axes
    if (Object.keys(tokens).length <= 1 || tokens.X === 0 || tokens.Y === 0 || tokens.Z === 0) {
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
      const newX = tokens.X !== undefined ? 0 : this.position.x;
      const newY = tokens.Y !== undefined ? 0 : this.position.y;
      const newZ = tokens.Z !== undefined ? 0 : this.position.z;
      
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
   * Set position (G92)
   * @param {Object} tokens - Parsed tokens
   */
  setPosition(tokens) {
    // G92 sets the current position to specified values
    // It's a way to set work offsets without changing the actual position
    if (tokens.X !== undefined) {
      this.workOffset.x = this.position.x - tokens.X;
    }
    
    if (tokens.Y !== undefined) {
      this.workOffset.y = this.position.y - tokens.Y;
    }
    
    if (tokens.Z !== undefined) {
      this.workOffset.z = this.position.z - tokens.Z;
    }
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
  
  /**
   * Calculate estimated time based on speeds and distances
   */
  calculateEstimatedTime() {
    // Simple time estimation based on distances and speeds
    let totalTime = 0;
    
    // Time for rapid moves
    if (this.rapidFeedRate > 0) {
      totalTime += this.stats.rapidDistance / this.rapidFeedRate * 60; // Convert to seconds
    }
    
    // Time for feed moves
    if (this.feedRate > 0) {
      totalTime += this.stats.feedDistance / this.feedRate * 60; // Convert to seconds
    }
    
    // Add some time for acceleration/deceleration
    const movesCount = this.stats.rapidMoves + this.stats.feedMoves + this.stats.arcMoves;
    totalTime += movesCount * 0.1; // 100ms per move for acceleration/deceleration
    
    this.stats.estimatedTime = totalTime;
  }
}

export default GCodeParser;