/**
 * Predefined robot configurations using DH parameters
 * Each configuration includes DH parameters and metadata
 */

export const predefinedRobots = {
  // 2-DOF Planar Robot (SCARA-like in XY plane)
  'planar-2dof': {
    name: '2-DOF Planar Robot',
    description: 'Simple 2-link planar robot for XY movement',
    dhParameters: [
      { a: 100, alpha: 0, d: 0 },    // Joint 1: Revolute, 100mm link
      { a: 80, alpha: 0, d: 0 }      // Joint 2: Revolute, 80mm link
    ],
    jointLimits: [
      { min: -180, max: 180 },
      { min: -180, max: 180 }
    ],
    homePosition: [0, 0],
    workspace: {
      radius: 180,
      height: 0
    }
  },

  // 3-DOF Cartesian Robot
  'cartesian-3dof': {
    name: '3-DOF Cartesian Robot',
    description: 'XYZ Cartesian gantry robot',
    dhParameters: [
      { a: 0, alpha: 90, theta: 0 },   // Joint 1: Prismatic X
      { a: 0, alpha: 90, theta: 90 },  // Joint 2: Prismatic Y
      { a: 0, alpha: 0, theta: 0 }     // Joint 3: Prismatic Z
    ],
    jointLimits: [
      { min: 0, max: 200 },    // X: 0-200mm
      { min: 0, max: 200 },    // Y: 0-200mm
      { min: 0, max: 100 }     // Z: 0-100mm
    ],
    jointTypes: ['prismatic', 'prismatic', 'prismatic'],
    homePosition: [100, 100, 50],
    workspace: {
      x: [0, 200],
      y: [0, 200],
      z: [0, 100]
    }
  },

  // 4-DOF SCARA Robot
  'scara-4dof': {
    name: '4-DOF SCARA Robot',
    description: 'Selective Compliance Assembly Robot Arm',
    dhParameters: [
      { a: 150, alpha: 0, d: 0 },      // Joint 1: Revolute
      { a: 100, alpha: 0, d: 0 },      // Joint 2: Revolute
      { a: 0, alpha: 0, theta: 0 },    // Joint 3: Prismatic Z
      { a: 0, alpha: 0, d: 0 }         // Joint 4: Revolute (wrist)
    ],
    jointLimits: [
      { min: -180, max: 180 },
      { min: -180, max: 180 },
      { min: 0, max: 100 },      // Z: 0-100mm travel
      { min: -180, max: 180 }
    ],
    jointTypes: ['revolute', 'revolute', 'prismatic', 'revolute'],
    homePosition: [0, 0, 50, 0],
    workspace: {
      radius: 250,
      zRange: [0, 100]
    }
  },

  // 5-DOF Articulated Robot
  'articulated-5dof': {
    name: '5-DOF Articulated Robot',
    description: 'Industrial articulated robot arm',
    dhParameters: [
      { a: 0, alpha: 90, d: 100 },     // Joint 1: Base rotation
      { a: 150, alpha: 0, d: 0 },      // Joint 2: Shoulder
      { a: 100, alpha: 0, d: 0 },      // Joint 3: Elbow
      { a: 0, alpha: 90, d: 0 },       // Joint 4: Wrist pitch
      { a: 0, alpha: 0, d: 80 }        // Joint 5: Wrist roll
    ],
    jointLimits: [
      { min: -180, max: 180 },
      { min: -90, max: 90 },
      { min: -135, max: 135 },
      { min: -90, max: 90 },
      { min: -180, max: 180 }
    ],
    homePosition: [0, 0, 0, 0, 0],
    workspace: {
      reach: 330,
      height: 430
    }
  },

  // 6-DOF Industrial Robot (similar to UR5)
  'industrial-6dof': {
    name: '6-DOF Industrial Robot',
    description: 'Universal robot configuration',
    dhParameters: [
      { a: 0, alpha: 90, d: 89.2 },    // Joint 1: Base
      { a: -425, alpha: 0, d: 0 },     // Joint 2: Shoulder
      { a: -392, alpha: 0, d: 0 },     // Joint 3: Elbow
      { a: 0, alpha: 90, d: 109.3 },   // Joint 4: Wrist 1
      { a: 0, alpha: -90, d: 94.75 },  // Joint 5: Wrist 2
      { a: 0, alpha: 0, d: 82.5 }      // Joint 6: Wrist 3
    ],
    jointLimits: [
      { min: -360, max: 360 },
      { min: -360, max: 360 },
      { min: -360, max: 360 },
      { min: -360, max: 360 },
      { min: -360, max: 360 },
      { min: -360, max: 360 }
    ],
    homePosition: [0, -90, 0, -90, 0, 0],
    workspace: {
      reach: 850,
      payload: 5  // kg
    }
  },

  // Delta Robot (simplified parameters)
  'delta-3dof': {
    name: 'Delta Robot',
    description: 'Parallel delta robot for pick and place',
    dhParameters: [
      { a: 200, alpha: 0, d: 0 },      // Simplified representation
      { a: 200, alpha: 0, d: 0 },
      { a: 0, alpha: 0, d: 0 }
    ],
    jointLimits: [
      { min: -45, max: 45 },
      { min: -45, max: 45 },
      { min: -45, max: 45 }
    ],
    homePosition: [0, 0, 0],
    workspace: {
      diameter: 300,
      height: 200
    },
    note: 'Simplified DH representation - actual delta kinematics are more complex'
  },

  // Custom Template
  'custom': {
    name: 'Custom Robot',
    description: 'User-defined robot configuration',
    dhParameters: [
      { a: 100, alpha: 0, d: 50 }      // Single joint template
    ],
    jointLimits: [
      { min: -180, max: 180 }
    ],
    homePosition: [0],
    workspace: {
      custom: true
    }
  }
};

/**
 * Get a predefined robot configuration
 * @param {string} robotId Robot configuration ID
 * @returns {Object} Robot configuration or null
 */
export function getPredefinedRobot(robotId) {
  return predefinedRobots[robotId] || null;
}

/**
 * Get list of available robot configurations
 * @returns {Array} Array of {id, name, description}
 */
export function getAvailableRobots() {
  return Object.entries(predefinedRobots).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description
  }));
}

/**
 * Validate a robot configuration
 * @param {Object} config Robot configuration to validate
 * @returns {Object} {valid, errors}
 */
export function validateRobotConfig(config) {
  const errors = [];

  if (!config.name) {
    errors.push('Robot configuration must have a name');
  }

  if (!config.dhParameters || !Array.isArray(config.dhParameters)) {
    errors.push('Robot configuration must have DH parameters array');
  } else if (config.dhParameters.length === 0) {
    errors.push('Robot must have at least one joint');
  } else {
    // Validate each DH parameter
    config.dhParameters.forEach((param, index) => {
      if (param.a === undefined || param.a === null) {
        errors.push(`Joint ${index + 1}: Missing 'a' parameter`);
      }
      if (param.alpha === undefined || param.alpha === null) {
        errors.push(`Joint ${index + 1}: Missing 'alpha' parameter`);
      }
    });
  }

  if (config.jointLimits) {
    if (!Array.isArray(config.jointLimits)) {
      errors.push('Joint limits must be an array');
    } else if (config.jointLimits.length !== config.dhParameters.length) {
      errors.push('Number of joint limits must match number of joints');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Export robot configuration to JSON
 * @param {Object} config Robot configuration
 * @returns {string} JSON string
 */
export function exportRobotConfig(config) {
  return JSON.stringify(config, null, 2);
}

/**
 * Import robot configuration from JSON
 * @param {string} jsonString JSON string
 * @returns {Object} {success, config, error}
 */
export function importRobotConfig(jsonString) {
  try {
    const config = JSON.parse(jsonString);
    const validation = validateRobotConfig(config);
    
    if (validation.valid) {
      return { success: true, config, error: null };
    } else {
      return { 
        success: false, 
        config: null, 
        error: validation.errors.join(', ') 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      config: null, 
      error: 'Invalid JSON format: ' + error.message 
    };
  }
}

export default {
  predefinedRobots,
  getPredefinedRobot,
  getAvailableRobots,
  validateRobotConfig,
  exportRobotConfig,
  importRobotConfig
};