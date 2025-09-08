import * as THREE from 'three';
import { 
  roomConnections, 
  hotspotData, 
  modelToPanoramaMapping, 
  availablePanoramas 
} from './TaskID_0001/hotspot-config.js';

// Re-export configurations for other modules
export { roomConnections, hotspotData } from './TaskID_0001/hotspot-config.js';

export class HotspotManager {
  constructor(scene) {
    this.scene = scene;
    this.rotHotspots = [];
    this.labels = []; // Store HTML label elements
  }

  // Create blue circle texture with white arrow
  createArrowTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Clear canvas with transparent background
    ctx.clearRect(0, 0, size, size);

    // Draw blue circle
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1249ff';
    ctx.fill();

    // Add subtle border
    ctx.strokeStyle = '#2E5D8F';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw white upward arrow
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Arrow path
    const centerX = size/2;
    const centerY = size/2;
    const arrowSize = size/4;

    ctx.beginPath();
    // Arrow shaft
    ctx.moveTo(centerX, centerY + arrowSize/2);
    ctx.lineTo(centerX, centerY - arrowSize/2);
    
    // Arrow head
    ctx.moveTo(centerX - arrowSize/3, centerY - arrowSize/6);
    ctx.lineTo(centerX, centerY - arrowSize/2);
    ctx.lineTo(centerX + arrowSize/3, centerY - arrowSize/6);
    
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Cylinder hotspots at ROT empties with alpha map + camera-facing text + rectangle
	  createRotHotspots(rotNodes) {
		// Clear old cylinders
		this.rotHotspots.forEach(h => {
		  if (h.parent) h.parent.remove(h);
		  h.geometry.dispose();
		  h.material.dispose();
		});
		this.rotHotspots = [];

		// Remove old HTML labels
		this.labels.forEach(label => {
		  if (label.element && label.element.parentNode) {
			label.element.parentNode.removeChild(label.element);
		  }
		});
		this.labels = [];

		const loader = new THREE.TextureLoader();
		const alphaMap = loader.load('textures/transparent.png'); // grayscale alpha map

  // Cylinder geometry - made larger for testing
   rotNodes.forEach((node, index) => {
	  
	  const geometry = new THREE.CylinderGeometry(0.3, 0.3, 2.0, 16, 1, true);
	  const material = new THREE.MeshLambertMaterial({
		color: 0x003cff,
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 0.9,
		emissive: 0x0000ff,
		alphaMap: alphaMap
	  });

	  const cylinder = new THREE.Mesh(geometry, material);
	  node.add(cylinder);
	  cylinder.position.set(0, 0, 0.28);
	  cylinder.rotation.set(-Math.PI / 2, 0, 0);
	  cylinder.name = `rot-hotspot-${index}`;

	  // Store floor information
	  cylinder.userData.floor = node.userData.floor;

	  // Node name and display name
	  const nodeName = node.name.toLowerCase();
	  const displayName = node.name.replace(/_/g, ' ');
	  let panoramaImagePath = '';

	  // Try pattern mapping
	  const mapping = modelToPanoramaMapping.find(config =>
		config.nodeNamePatterns.some(pattern => nodeName.includes(pattern))
	  );

	  if (mapping) {
		panoramaImagePath = mapping.panoramaImage; // Use same TaskID for all floors
		console.log(`✓ Pattern matched - Node "${displayName}" -> Panorama: ${panoramaImagePath}`);
	  } else {
		// Fallback by index
		const fallbackMapping = modelToPanoramaMapping.find(config => config.fallbackIndex === index);
		if (fallbackMapping) {
		  panoramaImagePath = fallbackMapping.panoramaImage; // same for all floors
		  console.log(`✓ Fallback index matched - Node "${displayName}" -> Panorama: ${panoramaImagePath}`);
		} else {
		  // Final fallback
		  panoramaImagePath = availablePanoramas[index % availablePanoramas.length]; // same for all floors
		  console.log(`⚠ Using final fallback - Node "${displayName}" -> Panorama: ${panoramaImagePath}`);
		}
	  }

	  cylinder.userData.panoramaImage = panoramaImagePath;
	  this.rotHotspots.push(cylinder);

	  // HTML label
	  const div = document.createElement('div');
	  div.className = 'hotspot-label';
	  div.textContent = displayName;
	  div.style.position = 'absolute';
	  div.style.background = 'rgba(255, 255, 255, 0.8)';
	  div.style.backdropFilter = 'blur(10px)';
	  div.style.padding = '0.5rem 1rem';
	  div.style.borderRadius = '0.5rem';
	  div.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
	  div.style.color = 'black';
	  div.style.fontSize = '12px';
	  div.style.fontWeight = 'bold';
	  div.style.textAlign = 'center';
	  div.style.whiteSpace = 'nowrap';
	  div.style.transform = 'translate(-50%, -50%)';
	  div.style.pointerEvents = 'none';
	  div.style.zIndex = '100';

	  // Floor indicator
	  div.style.borderLeft = '4px solid #4ecdc4';

	  document.body.appendChild(div);

	  // Label reference point above cylinder
	  const labelPosition = new THREE.Vector3(0, 1, 0);
	  const referencePoint = new THREE.Object3D();
	  referencePoint.position.copy(labelPosition);
	  cylinder.add(referencePoint);

	  this.labels.push({
		position: labelPosition,
		element: div,
		parent: cylinder,
		floor: node.userData.floor
	  });

	  console.log(`Created 3D hotspot for node "${displayName}" (${node.userData.floor}, index ${index}) -> ${panoramaImagePath}`);
	});
}

  // Update HTML label positions using 3D-to-2D projection
  updateRotTextFacing(camera) {
    if (!this.labels) return;

    const tempVector = new THREE.Vector3();

    this.labels.forEach(label => {
      // Only update visible labels
      if (label.element.style.display === 'none') return;

      // Get the world position of the label
      const worldPosition = new THREE.Vector3();
      label.parent.getWorldPosition(worldPosition);
      worldPosition.add(label.position);

      // Project to screen space
      tempVector.copy(worldPosition);
      tempVector.project(camera);

      // Calculate screen coordinates
      const x = (tempVector.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-tempVector.y * 0.5 + 0.5) * window.innerHeight;

      // Update the HTML element position
      label.element.style.left = `${x}px`;
      label.element.style.top = `${y}px`;

      // Hide labels that are behind the camera
      if (tempVector.z > 1) {
        label.element.style.display = 'none';
      } else {
        label.element.style.display = 'block';
      }
    });
  }

  // Clear existing panorama hotspots
  clearPanoramaHotspots() {
    if (this.hotspots) {
      this.hotspots.forEach(group => {
        // Dispose of all children in the group
        group.children.forEach(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
        // Remove the group from the scene
        this.scene.remove(group);
      });
    }
    this.hotspots = [];
  }

  // Panorama hotspots (inside pano spheres) - Updated to use hotspot.png texture
  createPanoramaHotspots(hotspotData) {
    // Clear existing panorama hotspots
    this.clearPanoramaHotspots();

    // Load the hotspot texture
    const loader = new THREE.TextureLoader();
    const hotspotTexture = loader.load('textures/hotspot.png');

    hotspotData.forEach((data, index) => {
      const x = data.radius * Math.sin(data.phi) * Math.cos(data.theta);
      const y = data.radius * Math.cos(data.phi);
      const z = data.radius * Math.sin(data.phi) * Math.sin(data.theta);

      // Create a group to hold both the circle and the text
      const hotspotGroup = new THREE.Group();

      // Create hotspot using PNG texture
      const circleGeometry = new THREE.PlaneGeometry(40, 40);
      const circleMaterial = new THREE.MeshBasicMaterial({
        map: hotspotTexture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
		depthTest: false,   // 👈 stops flickering
		depthWrite: false   // 👈 prevents writing to depth buffer
      });
      const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial);
      
      // Create text label using canvas texture
      const textTexture = this.createTextTexture(data.name, 1024);
      const textGeometry = new THREE.PlaneGeometry(120, 60);
      const textMaterial = new THREE.MeshBasicMaterial({
        map: textTexture,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
		depthTest: false,   // 👈 stops flickering
		depthWrite: false   // 👈 prevents writing to depth buffer
      });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      
      // Position text above the circle
      textMesh.position.set(0, 30, 0);

      // Add both to the group
      hotspotGroup.add(circleMesh);
      hotspotGroup.add(textMesh);
      
      // Position the group
      hotspotGroup.position.set(x, y, z);
      hotspotGroup.name = `pano-hotspot-${index}`;

      // Make the hotspot always face the camera
      hotspotGroup.lookAt(0, 0, 0);

      hotspotGroup.userData = {
        originalScale: 1.4,
        pulseSpeed: 0.015,
        info: data,
        circleMesh: circleMesh,
        textMesh: textMesh
      };

      this.scene.add(hotspotGroup);
      this.hotspots.push(hotspotGroup);
    });
  }

  // Create text texture for labels
  createTextTexture(text, size = 1024) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size / 2; // Rectangular canvas to match text geometry (60x30)
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set text properties
    ctx.font = 'bold 120px Arial'; // Slightly larger font for better visibility
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw text with stroke for better visibility
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.strokeText(text, centerX, centerY);
    ctx.fillText(text, centerX, centerY);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  animateHotspots() {
    if (!this.hotspots) return;
    this.hotspots.forEach(group => {
      const userData = group.userData;
      const time = Date.now() * userData.pulseSpeed;
      
      // Only animate the circle/icon, not the text
      if (userData.circleMesh) {
        const scale = userData.originalScale + Math.sin(time) * 0.1;
        userData.circleMesh.scale.setScalar(scale);
      }
      
      // Make sure hotspots always face the center (camera position in panorama)
      group.lookAt(0, 0, 0);
    });
  }

  getRotHotspots() { return this.rotHotspots; }
  getPanoramaHotspots() { return this.hotspots || []; }

  // Hide/show HTML labels
  hideLabels() {
    console.log('Hiding labels, count:', this.labels.length);
    this.labels.forEach((label, index) => {
      if (label.element) {
        label.element.style.display = 'none';
        console.log(`Hidden label ${index}`);
      }
    });
  }

  showLabels() {
    console.log('Showing labels, count:', this.labels.length);
    this.labels.forEach((label, index) => {
      if (label.element) {
        label.element.style.display = 'block';
        console.log(`Shown label ${index}`);
      }
    });
  }

  // Show labels only for specific floor
  showLabelsForFloor(floorKey) {
    console.log(`Showing labels for floor: ${floorKey}, count:`, this.labels.length);
    this.labels.forEach((label, index) => {
      if (label.element) {
        if (label.floor === floorKey) {
          label.element.style.display = 'block';
          console.log(`Shown label ${index} for floor ${floorKey}`);
        } else {
          label.element.style.display = 'none';
          console.log(`Hidden label ${index} (different floor: ${label.floor})`);
        }
      }
    });
  }
}