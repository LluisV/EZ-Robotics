import * as THREE from 'three';

/**
 * Denavit-Hartenberg Kinematics Calculator
 * Handles forward and inverse kinematics for robotic arms
 */
export class DHKinematics {
  /**
   * Create a DH kinematics calculator
   * @param {Array} dhParameters Array of DH parameter objects [{a, alpha, d, theta}]
   */
  constructor(dhParameters = []) {
    this.dhParameters = dhParameters;
    this.numJoints = dhParameters.length;
    
    // Cache for transformation matrices
    this.transformCache = new Map();
    
    // Joint limits (radians)
    this.jointLimits = dhParameters.map(() => ({
      min: -Math.PI,
      max: Math.PI
    }));
  }

  /**
   * Set DH parameters
   * @param {Array} dhParameters Array of DH parameter objects
   */
  setDHParameters(dhParameters) {
    this.dhParameters = dhParameters;
    this.numJoints = dhParameters.length;
    this.transformCache.clear();
    
    // Initialize joint limits if not already set
    if (this.jointLimits.length !== this.numJoints) {
      this.jointLimits = dhParameters.map(() => ({
        min: -Math.PI,
        max: Math.PI
      }));
    }
  }

  /**
   * Set joint limits
   * @param {number} jointIndex Joint index
   * @param {number} min Minimum angle (radians)
   * @param {number} max Maximum angle (radians)
   */
  setJointLimits(jointIndex, min, max) {
    if (jointIndex >= 0 && jointIndex < this.numJoints) {
      this.jointLimits[jointIndex] = { min, max };
    }
  }

  /**
   * Create DH transformation matrix for a single joint
   * @param {number} a Link length
   * @param {number} alpha Link twist (radians)
   * @param {number} d Link offset
   * @param {number} theta Joint angle (radians)
   * @returns {THREE.Matrix4} Transformation matrix
   */
  createDHMatrix(a, alpha, d, theta) {
    const ct = Math.cos(theta);
    const st = Math.sin(theta);
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);

    const matrix = new THREE.Matrix4();
    matrix.set(
      ct,        -st * ca,    st * sa,     a * ct,
      st,        ct * ca,     -ct * sa,    a * st,
      0,         sa,          ca,          d,
      0,         0,           0,           1
    );

    return matrix;
  }

  /**
   * Calculate forward kinematics
   * @param {Array} jointAngles Array of joint angles (radians)
   * @returns {Object} {position, rotation, transformations}
   */
  forwardKinematics(jointAngles) {
    if (jointAngles.length !== this.numJoints) {
      throw new Error(`Expected ${this.numJoints} joint angles, got ${jointAngles.length}`);
    }

    const transformations = [];
    let cumulativeTransform = new THREE.Matrix4();

    // Calculate transformation for each joint
    for (let i = 0; i < this.numJoints; i++) {
      const params = this.dhParameters[i];
      const theta = params.theta !== undefined ? params.theta : jointAngles[i];
      const d = params.d !== undefined ? params.d : 0;
      
      const jointTransform = this.createDHMatrix(
        params.a || 0,
        (params.alpha || 0) * Math.PI / 180, // Convert to radians if in degrees
        d,
        theta
      );

      cumulativeTransform.multiplyMatrices(cumulativeTransform, jointTransform);
      transformations.push(cumulativeTransform.clone());
    }

    // Extract position and rotation from final transformation
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    
    cumulativeTransform.decompose(position, quaternion, scale);

    // Convert quaternion to Euler angles
    const euler = new THREE.Euler();
    euler.setFromQuaternion(quaternion);

    return {
      position,
      rotation: {
        quaternion,
        euler,
        matrix: new THREE.Matrix3().setFromMatrix4(cumulativeTransform)
      },
      transformations,
      endEffectorMatrix: cumulativeTransform
    };
  }

  /**
   * Calculate inverse kinematics using numerical methods
   * @param {THREE.Vector3} targetPosition Target end effector position
   * @param {THREE.Euler} targetOrientation Target orientation (optional)
   * @param {Array} initialJointAngles Initial guess for joint angles
   * @returns {Object} {jointAngles, success, error}
   */
  inverseKinematics(targetPosition, targetOrientation = null, initialJointAngles = null) {
    // Use current joint angles or zeros as initial guess
    let jointAngles = initialJointAngles || new Array(this.numJoints).fill(0);
    
    const maxIterations = 100;
    const positionTolerance = 0.001; // 1mm
    const orientationTolerance = 0.01; // ~0.57 degrees
    const learningRate = 0.1;
    
    let posError = new THREE.Vector3(); // Declare posError outside the loop
    
    for (let iter = 0; iter < maxIterations; iter++) {
      // Calculate current position with forward kinematics
      const fk = this.forwardKinematics(jointAngles);
      const currentPos = fk.position;
      
      // Calculate position error
      posError = targetPosition.clone().sub(currentPos);
      const posErrorMagnitude = posError.length();
      
      // Check if we've reached the target
      if (posErrorMagnitude < positionTolerance) {
        // Check orientation if specified
        if (targetOrientation) {
          const orientError = this.calculateOrientationError(
            fk.rotation.euler,
            targetOrientation
          );
          
          if (orientError < orientationTolerance) {
            return {
              jointAngles,
              success: true,
              error: posErrorMagnitude,
              iterations: iter
            };
          }
        } else {
          return {
            jointAngles,
            success: true,
            error: posErrorMagnitude,
            iterations: iter
          };
        }
      }
      
      // Calculate Jacobian matrix
      const jacobian = this.calculateJacobian(jointAngles);
      
      // Use pseudo-inverse to calculate joint angle changes
      const deltaQ = this.calculateDeltaQ(jacobian, posError, targetOrientation, fk.rotation.euler);
      
      // Update joint angles
      for (let i = 0; i < this.numJoints; i++) {
        jointAngles[i] += learningRate * deltaQ[i];
        
        // Apply joint limits
        jointAngles[i] = Math.max(
          this.jointLimits[i].min,
          Math.min(this.jointLimits[i].max, jointAngles[i])
        );
      }
    }
    
    // Failed to converge
    return {
      jointAngles,
      success: false,
      error: posError.length(),
      iterations: maxIterations
    };
  }

  /**
   * Calculate the Jacobian matrix
   * @param {Array} jointAngles Current joint angles
   * @returns {Array} Jacobian matrix
   */
  calculateJacobian(jointAngles) {
    const epsilon = 0.0001;
    const jacobian = [];
    
    // Get current end effector position
    const fk = this.forwardKinematics(jointAngles);
    const currentPos = fk.position;
    
    // Calculate partial derivatives for each joint
    for (let i = 0; i < this.numJoints; i++) {
      const perturbedAngles = [...jointAngles];
      perturbedAngles[i] += epsilon;
      
      const perturbedFK = this.forwardKinematics(perturbedAngles);
      const perturbedPos = perturbedFK.position;
      
      // Calculate derivative
      const derivative = perturbedPos.sub(currentPos).multiplyScalar(1 / epsilon);
      
      jacobian.push([derivative.x, derivative.y, derivative.z]);
    }
    
    return jacobian;
  }

  /**
   * Calculate joint angle changes using pseudo-inverse
   * @param {Array} jacobian Jacobian matrix
   * @param {THREE.Vector3} positionError Position error vector
   * @param {THREE.Euler} targetOrientation Target orientation (optional)
   * @param {THREE.Euler} currentOrientation Current orientation
   * @returns {Array} Joint angle changes
   */
  calculateDeltaQ(jacobian, positionError, targetOrientation, currentOrientation) {
    // For now, we'll use a simple transpose method
    // In a production system, you'd want to use proper pseudo-inverse
    const deltaQ = new Array(this.numJoints).fill(0);
    
    for (let i = 0; i < this.numJoints; i++) {
      deltaQ[i] = jacobian[i][0] * positionError.x +
                  jacobian[i][1] * positionError.y +
                  jacobian[i][2] * positionError.z;
    }
    
    return deltaQ;
  }

  /**
   * Calculate orientation error between two Euler angles
   * @param {THREE.Euler} current Current orientation
   * @param {THREE.Euler} target Target orientation
   * @returns {number} Error magnitude
   */
  calculateOrientationError(current, target) {
    const errorX = target.x - current.x;
    const errorY = target.y - current.y;
    const errorZ = target.z - current.z;
    
    return Math.sqrt(errorX * errorX + errorY * errorY + errorZ * errorZ);
  }

  /**
   * Simple analytical IK for 2-link planar robot (for testing)
   * @param {number} x Target X position
   * @param {number} y Target Y position
   * @param {number} l1 Length of link 1
   * @param {number} l2 Length of link 2
   * @returns {Object} {theta1, theta2, success}
   */
  static solveTwoLinkPlanar(x, y, l1, l2) {
    const distSquared = x * x + y * y;
    const dist = Math.sqrt(distSquared);
    
    // Check if target is reachable
    if (dist > l1 + l2 || dist < Math.abs(l1 - l2)) {
      return { theta1: 0, theta2: 0, success: false };
    }
    
    // Calculate theta2 using law of cosines
    const cosTheta2 = (distSquared - l1 * l1 - l2 * l2) / (2 * l1 * l2);
    const theta2 = Math.acos(cosTheta2);
    
    // Calculate theta1
    const k1 = l1 + l2 * Math.cos(theta2);
    const k2 = l2 * Math.sin(theta2);
    const theta1 = Math.atan2(y, x) - Math.atan2(k2, k1);
    
    return { theta1, theta2, success: true };
  }

  /**
   * Validate DH parameters
   * @param {Array} params DH parameters to validate
   * @returns {Object} {valid, errors}
   */
  static validateDHParameters(params) {
    const errors = [];
    
    if (!Array.isArray(params)) {
      return { valid: false, errors: ['Parameters must be an array'] };
    }
    
    params.forEach((param, index) => {
      if (typeof param !== 'object') {
        errors.push(`Joint ${index + 1}: Parameters must be an object`);
        return;
      }
      
      // Check required parameters
      if (param.a === undefined || param.a === null) {
        errors.push(`Joint ${index + 1}: Missing 'a' parameter`);
      }
      if (param.alpha === undefined || param.alpha === null) {
        errors.push(`Joint ${index + 1}: Missing 'alpha' parameter`);
      }
      
      // Check that either d or theta is variable
      if (param.d === undefined && param.theta === undefined) {
        errors.push(`Joint ${index + 1}: Must specify either 'd' or 'theta'`);
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default DHKinematics;