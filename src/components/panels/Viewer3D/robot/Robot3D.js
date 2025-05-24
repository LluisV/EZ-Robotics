import * as THREE from 'three';
import { DHKinematics } from './DHKinematics';

/**
 * 3D Robot visualization based on DH parameters
 * Creates and manages the 3D representation of a robotic arm
 */
export class Robot3D {
  /**
   * Create a 3D robot visualization
   * @param {THREE.Scene} scene THREE.js scene to render into
   * @param {Array} dhParameters DH parameters for the robot
   * @param {number} scale Scale factor for the robot
   * @param {Object} themeColors Theme colors for rendering
   */
  constructor(scene, dhParameters, scale = 0.1, themeColors = {}) {
    this.scene = scene;
    this.scale = scale;
    this.themeColors = themeColors;
    
    // Robot group to hold all components
    this.robotGroup = new THREE.Group();
    this.robotGroup.name = 'dh-robot';
    
    // Initialize kinematics
    this.kinematics = new DHKinematics(dhParameters);
    
    // Joint groups and meshes
    this.jointGroups = [];
    this.linkMeshes = [];
    this.jointMeshes = [];
    
    // Current joint angles
    this.jointAngles = new Array(dhParameters.length).fill(0);
    
    // Robot appearance settings
    this.linkColor = new THREE.Color(themeColors.robotLink || '#4a90e2');
    this.jointColor = new THREE.Color(themeColors.robotJoint || '#f39c12');
    this.endEffectorColor = new THREE.Color(themeColors.robotEndEffector || '#e74c3c');
    
    // Visual settings
    this.showJointAxes = true;
    this.showJointLabels = false;
    this.wireframe = false;
    this.opacity = 1.0;
    
    // Create the robot geometry
    this.createRobot();
    
    // Add to scene
    this.scene.add(this.robotGroup);
  }

  /**
   * Create the robot geometry based on DH parameters
   */
  createRobot() {
    const dhParams = this.kinematics.dhParameters;
    
    // Clear existing geometry
    this.clearRobot();
    
    // Create base
    this.createBase();
    
    // Create joints and links
    let parentGroup = this.robotGroup;
    
    for (let i = 0; i < dhParams.length; i++) {
      const params = dhParams[i];
      
      // Create joint group
      const jointGroup = new THREE.Group();
      jointGroup.name = `joint-${i + 1}`;
      parentGroup.add(jointGroup);
      this.jointGroups.push(jointGroup);
      
      // Create joint visual
      const jointMesh = this.createJoint(i);
      jointGroup.add(jointMesh);
      this.jointMeshes.push(jointMesh);
      
      // Create link if there's a length
      if (params.a > 0) {
        const linkMesh = this.createLink(params.a, i);
        jointGroup.add(linkMesh);
        this.linkMeshes.push(linkMesh);
      }
      
      // Add joint axes if enabled
      if (this.showJointAxes) {
        const axes = this.createJointAxes(i);
        jointGroup.add(axes);
      }
      
      // Add joint label if enabled
      if (this.showJointLabels) {
        const label = this.createJointLabel(i);
        jointGroup.add(label);
      }
      
      // Set parent for next joint
      parentGroup = jointGroup;
    }
    
    // Create end effector
    this.createEndEffector(parentGroup);
    
    // Apply initial joint configuration
    this.updateJointPositions(this.jointAngles);
  }

  /**
   * Create the robot base
   */
  createBase() {
    const baseRadius = 50 * this.scale;
    const baseHeight = 20 * this.scale;
    
    const baseGeometry = new THREE.CylinderGeometry(
      baseRadius, 
      baseRadius * 1.2, 
      baseHeight, 
      32
    );
    
    const baseMaterial = new THREE.MeshPhongMaterial({
      color: this.jointColor,
      transparent: this.opacity < 1,
      opacity: this.opacity,
      wireframe: this.wireframe
    });
    
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = baseHeight / 2;
    baseMesh.rotation.x = Math.PI / 2;
    baseMesh.name = 'robot-base';
    
    this.robotGroup.add(baseMesh);
    
    // Add base axes
    if (this.showJointAxes) {
      const baseAxes = new THREE.AxesHelper(baseRadius * 1.5);
      this.robotGroup.add(baseAxes);
    }
  }

  /**
   * Create a joint visual
   * @param {number} jointIndex Joint index
   * @returns {THREE.Mesh} Joint mesh
   */
  createJoint(jointIndex) {
    const jointRadius = 30 * this.scale;
    const jointLength = 40 * this.scale;
    
    // Use different geometries for different joint types
    let geometry;
    if (jointIndex % 2 === 0) {
      // Cylindrical joint
      geometry = new THREE.CylinderGeometry(
        jointRadius,
        jointRadius,
        jointLength,
        32
      );
    } else {
      // Spherical joint
      geometry = new THREE.SphereGeometry(jointRadius * 1.2, 32, 16);
    }
    
    const material = new THREE.MeshPhongMaterial({
      color: this.jointColor,
      transparent: this.opacity < 1,
      opacity: this.opacity,
      wireframe: this.wireframe
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `joint-mesh-${jointIndex + 1}`;
    
    return mesh;
  }

  /**
   * Create a link between joints
   * @param {number} length Link length (DH parameter 'a')
   * @param {number} linkIndex Link index
   * @returns {THREE.Mesh} Link mesh
   */
  createLink(length, linkIndex) {
    const linkRadius = 15 * this.scale;
    const scaledLength = length * this.scale;
    
    // Create a tapered cylinder for the link
    const geometry = new THREE.CylinderGeometry(
      linkRadius,
      linkRadius * 0.8,
      scaledLength,
      16
    );
    
    const material = new THREE.MeshPhongMaterial({
      color: this.linkColor,
      transparent: this.opacity < 1,
      opacity: this.opacity,
      wireframe: this.wireframe
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = scaledLength / 2;
    mesh.rotation.z = -Math.PI / 2;
    mesh.name = `link-mesh-${linkIndex + 1}`;
    
    return mesh;
  }

  /**
   * Create axes for a joint
   * @param {number} jointIndex Joint index
   * @returns {THREE.Group} Axes group
   */
  createJointAxes(jointIndex) {
    const axesSize = 50 * this.scale;
    const axes = new THREE.AxesHelper(axesSize);
    axes.name = `joint-axes-${jointIndex + 1}`;
    return axes;
  }

  /**
   * Create a label for a joint
   * @param {number} jointIndex Joint index
   * @returns {THREE.Sprite} Label sprite
   */
  createJointLabel(jointIndex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    
    context.fillStyle = '#ffffff';
    context.font = 'Bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`J${jointIndex + 1}`, 128, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(50 * this.scale, 25 * this.scale, 1);
    sprite.position.y = 40 * this.scale;
    sprite.name = `joint-label-${jointIndex + 1}`;
    
    return sprite;
  }

  /**
   * Create the end effector
   * @param {THREE.Group} parentGroup Parent group to attach to
   */
  createEndEffector(parentGroup) {
    // Create a group for the end effector
    const effectorGroup = new THREE.Group();
    effectorGroup.name = 'end-effector';
    
    // Create a cone for the tool
    const coneRadius = 20 * this.scale;
    const coneHeight = 60 * this.scale;
    
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
    const coneMaterial = new THREE.MeshPhongMaterial({
      color: this.endEffectorColor,
      transparent: this.opacity < 1,
      opacity: this.opacity,
      wireframe: this.wireframe
    });
    
    const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
    coneMesh.position.x = coneHeight / 2;
    coneMesh.rotation.z = -Math.PI / 2;
    
    effectorGroup.add(coneMesh);
    
    // Add tool axes
    if (this.showJointAxes) {
      const toolAxes = new THREE.AxesHelper(coneHeight);
      effectorGroup.add(toolAxes);
    }
    
    // Store reference
    this.endEffectorGroup = effectorGroup;
    
    parentGroup.add(effectorGroup);
  }

  /**
   * Update joint positions based on joint angles
   * @param {Array} jointAngles Array of joint angles in radians
   */
  updateJointPositions(jointAngles) {
    if (jointAngles.length !== this.jointAngles.length) {
      console.error('Invalid number of joint angles');
      return;
    }
    
    this.jointAngles = [...jointAngles];
    
    // Calculate forward kinematics
    const fkResult = this.kinematics.forwardKinematics(jointAngles);
    
    // Update each joint group transform
    for (let i = 0; i < this.jointGroups.length; i++) {
      const jointGroup = this.jointGroups[i];
      const params = this.kinematics.dhParameters[i];
      
      // Apply DH transformations
      const theta = params.theta !== undefined ? params.theta : jointAngles[i];
      const d = params.d !== undefined ? params.d : 0;
      
      // Apply translations
      jointGroup.position.x = (params.a || 0) * this.scale;
      jointGroup.position.z = d * this.scale;
      
      // Apply rotations
      jointGroup.rotation.z = theta;
      jointGroup.rotation.x = (params.alpha || 0) * Math.PI / 180;
    }
  }

  /**
   * Update robot to match a target position
   * @param {Object} position Target position {x, y, z}
   * @param {Object} orientation Target orientation (optional)
   * @returns {boolean} Success status
   */
  updateToPosition(position, orientation = null) {
    // Convert position to robot coordinate system
    const targetPos = new THREE.Vector3(
      position.x * this.scale,
      position.y * this.scale,
      position.z * this.scale
    );
    
    // Calculate inverse kinematics
    const ikResult = this.kinematics.inverseKinematics(
      targetPos,
      orientation,
      this.jointAngles
    );
    
    if (ikResult.success) {
      this.updateJointPositions(ikResult.jointAngles);
      return true;
    } else {
      console.warn('IK failed to converge:', ikResult.error);
      return false;
    }
  }

  /**
   * Set DH parameters and rebuild robot
   * @param {Array} dhParameters New DH parameters
   */
  setDHParameters(dhParameters) {
    this.kinematics.setDHParameters(dhParameters);
    this.jointAngles = new Array(dhParameters.length).fill(0);
    this.createRobot();
  }

  /**
   * Set visual properties
   * @param {Object} properties Visual properties to set
   */
  setVisualProperties(properties) {
    if (properties.showJointAxes !== undefined) {
      this.showJointAxes = properties.showJointAxes;
    }
    if (properties.showJointLabels !== undefined) {
      this.showJointLabels = properties.showJointLabels;
    }
    if (properties.wireframe !== undefined) {
      this.wireframe = properties.wireframe;
    }
    if (properties.opacity !== undefined) {
      this.opacity = properties.opacity;
    }
    
    // Rebuild robot with new properties
    this.createRobot();
  }

  /**
   * Set robot colors
   * @param {Object} colors Color configuration
   */
  setColors(colors) {
    if (colors.link) this.linkColor = new THREE.Color(colors.link);
    if (colors.joint) this.jointColor = new THREE.Color(colors.joint);
    if (colors.endEffector) this.endEffectorColor = new THREE.Color(colors.endEffector);
    
    // Update existing materials
    this.linkMeshes.forEach(mesh => {
      if (mesh.material) mesh.material.color = this.linkColor;
    });
    
    this.jointMeshes.forEach(mesh => {
      if (mesh.material) mesh.material.color = this.jointColor;
    });
    
    // Update end effector color
    if (this.endEffectorGroup) {
      this.endEffectorGroup.traverse(child => {
        if (child.isMesh && child.material) {
          child.material.color = this.endEffectorColor;
        }
      });
    }
  }

  /**
   * Clear the robot geometry
   */
  clearRobot() {
    // Remove all children from robot group
    while (this.robotGroup.children.length > 0) {
      const child = this.robotGroup.children[0];
      
      // Dispose of geometries and materials
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
      
      this.robotGroup.remove(child);
    }
    
    // Clear arrays
    this.jointGroups = [];
    this.linkMeshes = [];
    this.jointMeshes = [];
  }

  /**
   * Show or hide the robot
   * @param {boolean} visible Visibility state
   */
  setVisible(visible) {
    this.robotGroup.visible = visible;
  }

  /**
   * Get the current end effector position
   * @returns {Object} Position in workspace coordinates
   */
  getEndEffectorPosition() {
    const fk = this.kinematics.forwardKinematics(this.jointAngles);
    return {
      x: fk.position.x / this.scale,
      y: fk.position.y / this.scale,
      z: fk.position.z / this.scale
    };
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    this.clearRobot();
    
    if (this.scene && this.robotGroup) {
      this.scene.remove(this.robotGroup);
    }
  }
}

export default Robot3D;