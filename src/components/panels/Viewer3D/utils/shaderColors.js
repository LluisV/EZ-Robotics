/**
 * Shader-based optimized parameter coloring.
 * This approach maintains high performance while allowing per-segment colors.
 */

import * as THREE from 'three';

// Color maps for different parameter types
const COLOR_MAPS = {
  // Feed rate - blue to red
  feedRate: {
    colors: [0x0088ff, 0x00ccff, 0x00ffcc, 0xffcc00, 0xff3300], 
    positions: [0.0, 0.25, 0.5, 0.75, 1.0]
  },
  // Layer height - green to purple
  layerHeight: {
    colors: [0x00cc66, 0x00dd99, 0x99dd00, 0xcc99ff, 0x9933cc],
    positions: [0.0, 0.25, 0.5, 0.75, 1.0]
  },
  // Tool number - distinct colors
  toolNumber: {
    colors: [0x3366cc, 0xdc3912, 0xff9900, 0x109618, 0x990099, 0x0099c6, 0xdd4477],
    positions: [0.0, 0.17, 0.34, 0.51, 0.68, 0.84, 1.0]
  },
  // Line number - rainbow
  lineNumber: {
    colors: [0x0000ff, 0x00ffff, 0x00ff00, 0xffff00, 0xff0000, 0xff00ff],
    positions: [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
  }
};

/**
 * Create a vertex color shader material for parameter-based coloring
 * This maintains batching while allowing individual segment colors
 * 
 * @param {string} parameterType The parameter type ('feedRate', 'layerHeight', etc.)
 * @param {object} options Additional material options
 * @returns {THREE.ShaderMaterial} A shader material with parameter coloring
 */
export function createParameterShaderMaterial(parameterType, options = {}) {
  // Get the color map for this parameter
  const colorMap = COLOR_MAPS[parameterType] || COLOR_MAPS.lineNumber;
  
  // Convert colors to vec3 format for the shader
  const colorStops = colorMap.colors.map(color => {
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    return `vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`;
  });
  
  // Build color mapping function in GLSL
  const colorStopsStr = colorStops.map((color, i) => 
    `    vec3 color${i} = ${color};`
  ).join('\n');
  
  const positionsStr = colorMap.positions.map(pos => 
    pos.toFixed(3)
  ).join(', ');
  
  // Vertex shader - handles parameter to color mapping
  const vertexShader = `
  attribute float parameter;
  varying vec3 vColor;

  // Color mapping function
  vec3 getColorForParameter(float param) {
    // Define color stops
    ${colorStopsStr}
    
    // Define positions for the color stops
    float positions[${colorMap.positions.length}];
    ${colorMap.positions.map((pos, i) => `positions[${i}] = ${pos.toFixed(3)};`).join('\n      ')}
    
    // Find the correct segment to interpolate
    for(int i = 0; i < ${colorMap.positions.length - 1}; i++) {
      if(param >= positions[i] && param <= positions[i+1]) {
        float t = (param - positions[i]) / (positions[i+1] - positions[i]);
        vec3 startColor = colors[i];
        vec3 endColor = colors[i+1];
        return mix(startColor, endColor, t);
      }
    }
    
    // Fallback for values outside the range
    return colors[0];
  }

  void main() {
    vColor = getColorForParameter(parameter);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

  // Fragment shader - uses the calculated color
  const fragmentShader = `
    varying vec3 vColor;
    
    void main() {
      gl_FragColor = vec4(vColor, ${options.opacity || 1.0});
    }
  `;

  // Create the shader material
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: options.transparent || false,
    opacity: options.opacity || 1.0,
    side: THREE.DoubleSide,
    wireframe: options.wireframe || false
  });
}

/**
 * Create a dashed shader material for parameter-based coloring of rapid moves
 * 
 * @param {string} parameterType The parameter type ('feedRate', 'layerHeight', etc.)
 * @param {object} options Additional material options
 * @returns {THREE.ShaderMaterial} A dashed shader material with parameter coloring
 */
export function createParameterDashedShaderMaterial(parameterType, options = {}) {
  // Get the color map for this parameter
  const colorMap = COLOR_MAPS[parameterType] || COLOR_MAPS.lineNumber;
  
  // Convert colors to vec3 format for the shader
  const colorStops = colorMap.colors.map(color => {
    const r = ((color >> 16) & 255) / 255;
    const g = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    return `vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`;
  });
  
  // Vertex shader with dashed line support
  const vertexShader = `
    attribute float parameter;
    attribute float lineDistance;
    
    varying vec3 vColor;
    varying float vLineDistance;

    // Color mapping function (same as before)
    vec3 getColorForParameter(float param) {
      // Colors defined here...
      vec3 color0 = vec3(0.0, 0.533, 1.0);  // Default blue
      vec3 color1 = vec3(0.0, 0.8, 1.0);
      vec3 color2 = vec3(0.0, 1.0, 0.8);
      vec3 color3 = vec3(1.0, 0.8, 0.0);
      vec3 color4 = vec3(1.0, 0.2, 0.0);
      
      // Simplified implementation
      return mix(color0, color4, param);
    }

    void main() {
      vColor = getColorForParameter(parameter);
      vLineDistance = lineDistance;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  // Fragment shader with dashing
  const fragmentShader = `
    varying vec3 vColor;
    varying float vLineDistance;
    
    void main() {
      float dashSize = ${options.dashSize || 2.0};
      float gapSize = ${options.gapSize || 2.0};
      float dashGapLength = dashSize + gapSize;
      
      // Calculate dash pattern
      float modulo = mod(vLineDistance, dashGapLength);
      if (modulo > dashSize) {
        discard; // Create the gap by discarding fragments
      }
      
      gl_FragColor = vec4(vColor, ${options.opacity || 0.7});
    }
  `;

  // Create the shader material
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    opacity: options.opacity || 0.7,
    side: THREE.DoubleSide
  });
}

/**
 * Get color legend data for a parameter
 * 
 * @param {string} parameter Parameter type
 * @param {number} min Minimum value
 * @param {number} max Maximum value
 * @returns {object} Legend data with steps
 */
export function getShaderColorLegend(parameter, min, max) {
  const colorMap = COLOR_MAPS[parameter];
  if (!colorMap || min === undefined || max === undefined) {
    return null;
  }
  
  // Create steps for the legend
  const steps = [];
  
  for (let i = 0; i < colorMap.colors.length; i++) {
    const normalizedPos = colorMap.positions[i];
    const value = min + (max - min) * normalizedPos;
    const color = colorMap.colors[i];
    
    // Format the value based on parameter type
    let formattedValue;
    switch (parameter) {
      case 'feedRate':
        formattedValue = `${value.toFixed(1)} mm/min`;
        break;
      case 'layerHeight':
        formattedValue = `${value.toFixed(2)} mm`;
        break;
      case 'toolNumber':
        formattedValue = `Tool ${Math.round(value)}`;
        break;
      case 'lineNumber':
        formattedValue = `Line ${Math.round(value)}`;
        break;
      default:
        formattedValue = value.toFixed(2);
    }
    
    steps.push({
      color,
      label: formattedValue
    });
  }
  
  return {
    title: parameter,
    steps
  };
}