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
    rapid: new THREE.LineDashedMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 1.5,
      transparent: true,
      opacity: 0.7,
      dashSize: 2,
      gapSize: 2
    }),
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
  
  // For feed rate visualization
  if (mode === VisualizationModes.FEED_RATE) {
    // Find min and max feed rates
    let minFeedRate = Infinity;
    let maxFeedRate = 0;
    
    for (const segment of segments) {
      if (segment.feedRate && segment.feedRate > 0) {
        minFeedRate = Math.min(minFeedRate, segment.feedRate);
        maxFeedRate = Math.max(maxFeedRate, segment.feedRate);
      }
    }
    
    // Create gradient materials based on feed rate range
    const numSteps = 10;
    // Store range information
    materials.metaData = {
      min: minFeedRate,
      max: maxFeedRate,
      unit: 'mm/min'
    };
    
    // Create materials for different feed rate ranges
    for (let i = 0; i < numSteps; i++) {
      const feedRate = minFeedRate + (maxFeedRate - minFeedRate) * (i / (numSteps - 1));
      const normalizedValue = (i / (numSteps - 1)); // 0 to 1
      const color = getHeatMapColor(normalizedValue);
      
      materials[`feed-${i}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2.5,
        opacity: 0.95
      });
    }
    
    // Add rapid move material
    materials['rapid'] = new THREE.LineDashedMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 1.5,
      transparent: true,
      opacity: 0.7,
      dashSize: 2,
      gapSize: 2
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
    // Find min and max Z values
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    for (const segment of segments) {
      if (segment.start && segment.end) {
        minZ = Math.min(minZ, segment.start.z, segment.end.z);
        maxZ = Math.max(maxZ, segment.start.z, segment.end.z);
      }
    }
    
    // Store range information
    materials.metaData = {
      min: minZ,
      max: maxZ,
      unit: 'mm'
    };
    
    // Create gradient materials based on Z-height range
    const numSteps = 20;
    
    for (let i = 0; i < numSteps; i++) {
      const z = minZ + (maxZ - minZ) * (i / (numSteps - 1));
      const normalizedValue = (i / (numSteps - 1)); // 0 to 1
      const color = getRainbowColor(normalizedValue);
      
      materials[`z-${i}`] = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        linewidth: 2.5,
        opacity: 0.95
      });
    }
    
    // Add rapid move material
    materials['rapid'] = new THREE.LineDashedMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 1.5,
      transparent: true,
      opacity: 0.7,
      dashSize: 2,
      gapSize: 2
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
    materials['rapid'] = new THREE.LineDashedMaterial({ 
      color: 0x3498db, // Blue
      linewidth: 1.5,
      transparent: true,
      opacity: 0.7,
      dashSize: 2,
      gapSize: 2
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
    
    for (const segment of segments) {
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
    
    // Store range information
    materials.metaData = {
      min: minDistance,
      max: maxDistance,
      unit: 'mm'
    };
    
    // Create gradient materials based on distance range
    const numSteps = 10;
    
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
    const numSteps = 20;
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
    if (segment.rapid) {
      return materials.rapid;
    } else if (segment.toolOn) {
      if (segment.end.z < segment.start.z) {
        return materials.plunge;
      } else if (segment.end.z > segment.start.z) {
        return materials.lift;
      } else {
        return materials.cut;
      }
    } else {
      return materials.rapid;
    }
  }
  
  // For feed rate visualization
  else if (mode === VisualizationModes.FEED_RATE) {
    // If it's a rapid move, use the rapid material
    if (segment.rapid) {
      return materials.rapid;
    }
    
    // Get feed rate and normalize
    const feedRate = segment.feedRate || 0;
    if (feedRate <= 0) return materials.rapid;
    
    const { min, max } = materials.metaData;
    const normalizedFeedRate = (feedRate - min) / (max - min);
    
    // Map to material index
    const materialIndex = Math.min(9, Math.max(0, Math.floor(normalizedFeedRate * 10)));
    return materials[`feed-${materialIndex}`];
  }
  
  // For Z-height visualization
  else if (mode === VisualizationModes.Z_HEIGHT) {
    // For rapid moves, use the rapid material
    if (segment.rapid) {
      return materials.rapid;
    }
    
    // Get Z-height (use end Z as the reference)
    const z = segment.end.z;
    const { min, max } = materials.metaData;
    const normalizedZ = (z - min) / (max - min);
    
    // Map to material index
    const materialIndex = Math.min(19, Math.max(0, Math.floor(normalizedZ * 20)));
    return materials[`z-${materialIndex}`];
  }
  
  // For tool number visualization
  else if (mode === VisualizationModes.TOOL_NUMBER) {
    // For rapid moves, use the rapid material
    if (segment.rapid) {
      return materials.rapid;
    }
    
    // Get tool number
    const toolNumber = segment.toolNumber !== undefined ? segment.toolNumber : 0;
    return materials[`tool-${toolNumber}`] || materials.rapid;
  }
  
  // For move distance visualization
  else if (mode === VisualizationModes.MOVE_DISTANCE) {
    // Get move distance
    if (!segment.start || !segment.end) return materials['distance-0'];
    
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const dz = segment.end.z - segment.start.z;
    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    const { min, max } = materials.metaData;
    const normalizedDistance = (distance - min) / (max - min);
    
    // Map to material index
    const materialIndex = Math.min(9, Math.max(0, Math.floor(normalizedDistance * 10)));
    return materials[`distance-${materialIndex}`];
  }
  
  // For sequence visualization
  else if (mode === VisualizationModes.SEQUENCE) {
    // Normalize by position in the sequence
    const normalizedIndex = index / (total - 1);
    
    // Map to material index
    const materialIndex = Math.min(19, Math.max(0, Math.floor(normalizedIndex * 20)));
    return materials[`seq-${materialIndex}`];
  }
  
  // Default fallback to rapid material
  return materials.rapid;
}