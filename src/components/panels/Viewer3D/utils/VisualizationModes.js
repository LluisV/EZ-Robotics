import * as THREE from 'three';

/**
 * VisualizationModes
 * 
 * Defines different visualization modes for toolpath rendering
 * Each mode has a unique set of materials and corresponding metadata
 */
export const VisualizationModes = {
  // Standard visualization by move type (default mode)
  MOVE_TYPE: 'move-type',
  
  // Visualize by feed rate
  FEED_RATE: 'feed-rate',
  
  // Visualize by Z-height (layers)
  Z_HEIGHT: 'z-height',
  
  // Visualize by tool number
  TOOL_NUMBER: 'tool-number',

  // Visualize by move distance
  MOVE_DISTANCE: 'move-distance',
  
  // Visualize by segment index/sequence
  SEQUENCE: 'sequence'
};

/**
 * Create a gradient from one color to another
 * 
 * @param {string} color1 Start color in hex format
 * @param {string} color2 End color in hex format
 * @param {number} steps Number of steps in the gradient
 * @returns {Array} Array of color strings
 */
export function createColorGradient(color1, color2, steps) {
  const start = new THREE.Color(color1);
  const end = new THREE.Color(color2);
  const colors = [];
  
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const color = new THREE.Color();
    color.r = start.r + (end.r - start.r) * t;
    color.g = start.g + (end.g - start.g) * t;
    color.b = start.b + (end.b - start.b) * t;
    colors.push('#' + color.getHexString());
  }
  
  return colors;
}

/**
 * Create a heat map color based on value
 * Blue (cold) -> Green -> Yellow -> Red (hot)
 * 
 * @param {number} value Value between 0 and 1
 * @returns {string} Hex color string
 */
export function getHeatMapColor(value) {
  // Clamp value between 0 and 1
  const t = Math.max(0, Math.min(1, value));
  
  let r, g, b;
  
  // Blue to green to yellow to red gradient
  if (t < 0.25) {
    // Blue to cyan
    const v = t / 0.25;
    r = 0;
    g = Math.round(255 * v);
    b = 255;
  } else if (t < 0.5) {
    // Cyan to green
    const v = (t - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - v));
  } else if (t < 0.75) {
    // Green to yellow
    const v = (t - 0.5) / 0.25;
    r = Math.round(255 * v);
    g = 255;
    b = 0;
  } else {
    // Yellow to red
    const v = (t - 0.75) / 0.25;
    r = 255;
    g = Math.round(255 * (1 - v));
    b = 0;
  }
  
  // Convert to hex
  const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  return `#${hex}`;
}

/**
 * Create a rainbow color based on value
 * 
 * @param {number} value Value between 0 and 1
 * @returns {string} Hex color string
 */
export function getRainbowColor(value) {
  // Clamp value between 0 and 1
  const t = Math.max(0, Math.min(1, value));
  
  // Create a hue based on the value (0-1)
  const hue = t * 360;
  
  // Convert HSL to RGB
  const color = new THREE.Color();
  color.setHSL(hue / 360, 1.0, 0.5);
  
  return '#' + color.getHexString();
}

/**
 * Create materials for different visualization modes
 * 
 * @param {Object} themeColors Theme color definitions
 * @returns {Object} Materials for different visualization modes
 */
export function createVisualizationMaterials(themeColors) {
  // Standard move type materials (default)
  const moveTypeMaterials = {
    rapid:  new THREE.LineBasicMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 0.75,
      transparent: true,
      opacity: 0.6,
    }) ,
    cut: new THREE.LineBasicMaterial({ 
      color: 0xf39c12, // Orange
      linewidth: 2.5, 
      opacity: 0.95
    }),
    plunge: new THREE.LineBasicMaterial({ 
      color: 0xe74c3c, // Red
      linewidth: 3,
      opacity: 0.95
    }),
    lift: new THREE.LineBasicMaterial({ 
      color: 0x2ecc71, // Green
      linewidth: 2.5,
      opacity: 0.95
    }),
    path: new THREE.LineBasicMaterial({ 
      color: 0xecf0f1, // Light gray
      linewidth: 1,
      opacity: 0.4
    }),
    highlight: new THREE.LineBasicMaterial({ 
      color: 0xffd700, // Gold
      linewidth: 3.5,
      opacity: 1
    })
  };
  
  // Create feed rate gradient materials - will be populated dynamically
  const feedRateMaterials = {};
  
  // Z-height gradient materials - will be populated dynamically
  const zHeightMaterials = {};
  
  // Tool number materials - will be assigned dynamically
  const toolNumberMaterials = {};
  
  // Move distance gradient materials
  const moveDistanceMaterials = {};
  
  // Sequence gradient materials
  const sequenceMaterials = {};
  
  return {
    [VisualizationModes.MOVE_TYPE]: moveTypeMaterials,
    [VisualizationModes.FEED_RATE]: feedRateMaterials,
    [VisualizationModes.Z_HEIGHT]: zHeightMaterials,
    [VisualizationModes.TOOL_NUMBER]: toolNumberMaterials,
    [VisualizationModes.MOVE_DISTANCE]: moveDistanceMaterials,
    [VisualizationModes.SEQUENCE]: sequenceMaterials
  };
}

/**
 * Dynamically create materials for a visualization mode based on toolpath data
 * Optimized for better performance with large toolpaths
 * 
 * @param {Object} materials Materials object to update
 * @param {string} mode Visualization mode
 * @param {Object} toolpath Toolpath data
 * @param {Object} options Options for material creation
 * @returns {Object} Updated materials object
 */
export function generateDynamicMaterials(materials, mode, toolpath, options = {}) {
  if (!toolpath || !toolpath.segments || toolpath.segments.length === 0) {
    return materials;
  }
  
  const segments = toolpath.segments;
  
  // For feed rate visualization - heavily optimized for performance with large toolpaths
  if (mode === VisualizationModes.FEED_RATE) {
    // Find min and max feed rates - scan only a sample of segments for very large toolpaths
    let minFeedRate = Infinity;
    let maxFeedRate = 0;
    
    const sampleSize = Math.min(segments.length, 1000); // Limit sample size for large toolpaths
    const step = Math.max(1, Math.floor(segments.length / sampleSize));
    
    for (let i = 0; i < segments.length; i += step) {
      const segment = segments[i];
      if (segment.feedRate && segment.feedRate > 0) {
        minFeedRate = Math.min(minFeedRate, segment.feedRate);
        maxFeedRate = Math.max(maxFeedRate, segment.feedRate);
      }
    }
    
    // If no valid feed rates found, use defaults
    if (minFeedRate === Infinity || maxFeedRate === 0) {
      minFeedRate = 100;
      maxFeedRate = 1000;
    }
    
    // Store range information
    materials.metaData = {
      min: minFeedRate,
      max: maxFeedRate,
      unit: 'mm/min'
    };
    
    // Create a FIXED number of materials - USE FEWER MATERIALS for better performance
    // 5 discrete feed rate ranges instead of 10
    const numSteps = 5; 
    
    // Create materials for different feed rate ranges
    for (let i = 0; i < numSteps; i++) {
      const normalizedValue = i / (numSteps - 1); // 0 to 1
      const color = getHeatMapColor(normalizedValue);
      
      materials[`feed-${i}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2.5,
        opacity: 0.95
      });
    }
    
    // Add rapid move material
    materials['rapid'] = new THREE.LineBasicMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 0.75,
      transparent: true,
      opacity: 0.6,
    });
    
    // Add highlight material
    materials['highlight'] = new THREE.LineBasicMaterial({ 
      color: 0xffd700, // Gold
      linewidth: 3.5,
      opacity: 1
    });
  }
  
  // For Z-height visualization
  else if (mode === VisualizationModes.Z_HEIGHT) {
    // Find min and max Z values - optimize by sampling for large toolpaths
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    const sampleSize = Math.min(segments.length, 1000);
    const step = Math.max(1, Math.floor(segments.length / sampleSize));
    
    for (let i = 0; i < segments.length; i += step) {
      const segment = segments[i];
      if (segment.start && segment.end) {
        minZ = Math.min(minZ, segment.start.z, segment.end.z);
        maxZ = Math.max(maxZ, segment.start.z, segment.end.z);
      }
    }
    
    // If no valid Z values found, use defaults
    if (minZ === Infinity || maxZ === -Infinity) {
      minZ = 0;
      maxZ = 10;
    }
    
    // Store range information
    materials.metaData = {
      min: minZ,
      max: maxZ,
      unit: 'mm'
    };
    
    // Create gradient materials - fewer steps for better performance
    const numSteps = 10; // Reduced from 20
    
    for (let i = 0; i < numSteps; i++) {
      const normalizedValue = (i / (numSteps - 1)); // 0 to 1
      const color = getRainbowColor(normalizedValue);
      
      materials[`z-${i}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2.5,
        opacity: 0.95
      });
    }
    
    // Add rapid move material
    materials['rapid'] = new THREE.LineBasicMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 0.75,
      transparent: true,
      opacity: 0.6,
    });
    
    // Add highlight material
    materials['highlight'] = new THREE.LineBasicMaterial({ 
      color: 0xffd700, // Gold
      linewidth: 3.5,
      opacity: 1
    });
  }
  
  // For tool number visualization
  else if (mode === VisualizationModes.TOOL_NUMBER) {
    // Find all unique tool numbers
    const toolNumbers = new Set();
    
    for (const segment of segments) {
      if (segment.toolNumber !== undefined) {
        toolNumbers.add(segment.toolNumber);
      }
    }
    
    // Convert to array and sort
    const uniqueTools = Array.from(toolNumbers).sort((a, b) => a - b);
    
    // Store metadata
    materials.metaData = {
      tools: uniqueTools
    };
    
    // Predefined colors for tools (can be extended)
    const toolColors = [
      '#e74c3c', // Red
      '#3498db', // Blue
      '#2ecc71', // Green
      '#f39c12', // Orange
      '#9b59b6', // Purple
      '#1abc9c', // Teal
      '#d35400', // Pumpkin
      '#34495e', // Dark Blue
      '#27ae60', // Nephritis
      '#e67e22'  // Carrot
    ];
    
    // Create materials for each tool
    uniqueTools.forEach((toolNumber, index) => {
      const colorIndex = index % toolColors.length;
      
      materials[`tool-${toolNumber}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(toolColors[colorIndex]),
        linewidth: 2.5,
        opacity: 0.95
      });
    });
    
    // Add rapid move material
    materials['rapid'] = new THREE.LineBasicMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 0.75,
      transparent: true,
      opacity: 0.6,
    });
    
    // Add highlight material
    materials['highlight'] = new THREE.LineBasicMaterial({ 
      color: 0xffd700, // Gold
      linewidth: 3.5,
      opacity: 1
    });
  }
  
  // For move distance visualization
  else if (mode === VisualizationModes.MOVE_DISTANCE) {
    // Find min and max move distances
    let minDistance = Infinity;
    let maxDistance = 0;
    
    // Use sampling for large toolpaths
    const sampleSize = Math.min(segments.length, 1000);
    const step = Math.max(1, Math.floor(segments.length / sampleSize));
    
    for (let i = 0; i < segments.length; i += step) {
      const segment = segments[i];
      if (segment.start && segment.end) {
        const dx = segment.end.x - segment.start.x;
        const dy = segment.end.y - segment.start.y;
        const dz = segment.end.z - segment.start.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        if (distance > 0) {
          minDistance = Math.min(minDistance, distance);
          maxDistance = Math.max(maxDistance, distance);
        }
      }
    }
    
    // If no valid distances found, use defaults
    if (minDistance === Infinity || maxDistance === 0) {
      minDistance = 0.1;
      maxDistance = 10;
    }
    
    // Store range information
    materials.metaData = {
      min: minDistance,
      max: maxDistance,
      unit: 'mm'
    };
    
    // Create gradient materials based on distance range - reduced steps for performance
    const numSteps = 8; // Reduced from 10
    
    for (let i = 0; i < numSteps; i++) {
      const normalizedValue = i / (numSteps - 1); // 0 to 1
      const color = getHeatMapColor(normalizedValue);
      
      materials[`distance-${i}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2.5,
        opacity: 0.95
      });
    }
    
    // Add highlight material
    materials['highlight'] = new THREE.LineBasicMaterial({ 
      color: 0xffd700, // Gold
      linewidth: 3.5,
      opacity: 1
    });
  }
  
  // For sequence visualization
  else if (mode === VisualizationModes.SEQUENCE) {
    // Create a gradient across the entire toolpath
    // Reduce number of materials for better performance
    const numSteps = 12; // Reduced from 20
    const totalSegments = segments.length;
    
    // Store metadata
    materials.metaData = {
      totalSegments
    };
    
    for (let i = 0; i < numSteps; i++) {
      const normalizedValue = i / (numSteps - 1); // 0 to 1
      const color = getRainbowColor(normalizedValue);
      
      materials[`seq-${i}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2.5,
        opacity: 0.95
      });
    }
    
    // Add highlight material
    materials['highlight'] = new THREE.LineBasicMaterial({ 
      color: 0xffd700, // Gold
      linewidth: 3.5,
      opacity: 1
    });
  }
  
  return materials;
}

/**
 * Get material for a segment based on visualization mode
 * Optimized for better performance with large toolpaths
 * 
 * @param {Object} segment Segment data
 * @param {Object} materials Materials object for the current mode
 * @param {string} mode Visualization mode
 * @param {number} index Segment index
 * @param {number} total Total number of segments
 * @returns {Object} Material to use for this segment
 */
export function getMaterialForSegment(segment, materials, mode, index, total) {
  // For standard move type visualization
  if (mode === VisualizationModes.MOVE_TYPE) {
    // FIX: Properly differentiate G0 (rapid) from G1 (feed) moves
    // Check the 'rapid' flag which should be set for G0 moves
    if (segment.rapid === true) {
      return materials.rapid;
    } 
    // If not rapid, we have a feed move (G1, G2, G3)
    else if (segment.toolOn) {
      if (segment.end.z < segment.start.z) {
        return materials.plunge;
      } else if (segment.end.z > segment.start.z) {
        return materials.lift;
      } else {
        return materials.cut;
      }
    } 
    // Backup check - if no tool state is specified but we have a feed rate, it's a cut
    else if (segment.feedRate && segment.feedRate > 0 && !segment.rapid) {
      return materials.cut;
    }
    // Default to rapid if we couldn't determine the move type
    else {
      return materials.rapid;
    }
  }
  
  // For feed rate visualization - OPTIMIZED VERSION
  else if (mode === VisualizationModes.FEED_RATE) {
    // If it's a rapid move, use the rapid material
    if (segment.rapid === true) {
      return materials.rapid;
    }
    
    // Get feed rate and normalize - with bounds checking
    const feedRate = segment.feedRate || 0;
    if (feedRate <= 0) return materials.rapid;
    
    // Get metadata with bounds checking
    const meta = materials.metaData || { min: 100, max: 1000 };
    const min = meta.min || 100;
    const max = meta.max || 1000;
    
    // Normalize feed rate to 0-1 range
    let normalizedFeedRate = (feedRate - min) / (max - min);
    normalizedFeedRate = Math.min(1, Math.max(0, normalizedFeedRate)); // Clamp to 0-1
    
    // Map to material index - FEWER STEPS for better performance
    const materialIndex = Math.min(4, Math.max(0, Math.floor(normalizedFeedRate * 5)));
    return materials[`feed-${materialIndex}`] || materials.rapid; // Fallback to rapid
  }
  
  // For Z-height visualization - OPTIMIZED VERSION
  else if (mode === VisualizationModes.Z_HEIGHT) {
    // For rapid moves, use the rapid material
    if (segment.rapid === true) {
      return materials.rapid;
    }
    
    // Get Z-height (use end Z as the reference)
    const z = segment.end.z;
    
    // Get metadata with bounds checking
    const meta = materials.metaData || { min: 0, max: 10 };
    const min = meta.min || 0;
    const max = meta.max || 10;
    
    // Normalize Z value
    let normalizedZ = (z - min) / (max - min);
    normalizedZ = Math.min(1, Math.max(0, normalizedZ)); // Clamp to 0-1
    
    // Map to material index - FEWER STEPS for better performance
    const materialIndex = Math.min(9, Math.max(0, Math.floor(normalizedZ * 10)));
    return materials[`z-${materialIndex}`] || materials.rapid; // Fallback to rapid
  }
  
  // For tool number visualization
  else if (mode === VisualizationModes.TOOL_NUMBER) {
    // For rapid moves, use the rapid material
    if (segment.rapid === true) {
      return materials.rapid;
    }
    
    // Get tool number
    const toolNumber = segment.toolNumber !== undefined ? segment.toolNumber : 0;
    return materials[`tool-${toolNumber}`] || materials.rapid;
  }
  
  // For move distance visualization - OPTIMIZED VERSION
  else if (mode === VisualizationModes.MOVE_DISTANCE) {
    // Get move distance with bounds checking
    if (!segment.start || !segment.end) return materials['distance-0'];
    
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const dz = segment.end.z - segment.start.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // Get metadata with bounds checking
    const meta = materials.metaData || { min: 0.1, max: 10 };
    const min = meta.min || 0.1;
    const max = meta.max || 10;
    
    // Normalize distance value
    let normalizedDistance = (distance - min) / (max - min);
    normalizedDistance = Math.min(1, Math.max(0, normalizedDistance)); // Clamp to 0-1
    
    // Map to material index - FEWER STEPS for better performance
    const materialIndex = Math.min(7, Math.max(0, Math.floor(normalizedDistance * 8)));
    return materials[`distance-${materialIndex}`] || materials['distance-0']; // Fallback
  }
  
  // For sequence visualization - OPTIMIZED VERSION
  else if (mode === VisualizationModes.SEQUENCE) {
    // Normalize by position in the sequence
    let normalizedIndex = index / (total - 1);
    normalizedIndex = Math.min(1, Math.max(0, normalizedIndex)); // Clamp to 0-1
    
    // Map to material index - FEWER STEPS for better performance
    const materialIndex = Math.min(11, Math.max(0, Math.floor(normalizedIndex * 12)));
    return materials[`seq-${materialIndex}`] || materials[`seq-0`]; // Fallback
  }
  
  // Default fallback to rapid material
  return materials.rapid;
}