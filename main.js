import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HotspotManager } from './hotspots.js';
import { PanoramaManager } from './panorama.js';

class RoomViewer {
  constructor() {
    this.initScene();
    this.initLights();
    this.initBackground();
    this.initManagers();
    this.initFloorSystem();
    this.loadRoomModels();
    this.setupEventListeners();
    this.setupCameraViews();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
    
    // Create orthographic camera for floor plan view
    const aspect = window.innerWidth / window.innerHeight;
    const size = 8; // Orthographic camera size
    this.orthoCamera = new THREE.OrthographicCamera(
      -size * aspect, size * aspect, size, -size, 0.1, 1000
    );
    
    // Set better default camera position - further back from model
    this.camera.position.set(8, 5, 8); // Moved further back and higher
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 1, 0);

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Track which camera is active
    this.activeCamera = this.camera;
  }

  initLights() {
    const light1 = new THREE.AmbientLight(0xffffff, 8);
    this.scene.add(light1);

    const light2 = new THREE.DirectionalLight(0xffffff, 2);
    light2.position.set(5,5,5);
    light2.castShadow = true;
    this.scene.add(light2);
  }

  initBackground() {
    this.gradientTexture = this.createRadialGradientTexture(window.innerWidth, window.innerHeight);
    this.scene.background = this.gradientTexture;
  }

  createRadialGradientTexture(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width,height)/1.2);
    gradient.addColorStop(0,'#cce0ff');
    gradient.addColorStop(1,'#4a6fa5');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,width,height);
    return new THREE.CanvasTexture(canvas);
  }

  initManagers() {
    this.hotspotManager = new HotspotManager(this.scene);
    this.panoramaManager = new PanoramaManager(this.scene, this.camera, this.controls, this.hotspotManager, this.renderer);
  }

  initFloorSystem() {
    this.floors = {
      'floor1': {
        model: null,
        wireframe: null,
        hotspotNodes: [],
        modelPath: 'TaskID_0001/floor1.glb',
        position: { x: 0, y: 0, z: 0 },
        loaded: false
      },
      'floor2': {
        model: null,
        wireframe: null,
        hotspotNodes: [],
        modelPath: 'TaskID_0001/floor2.glb', // Assuming you have this file
        position: { x: 0, y: 2.2, z: 0 }, // Position floor 2 above floor 1
        loaded: false
      }
    };
    
    this.currentFloorView = 'all'; // 'all', 'floor1', 'floor2'
    this.allRotNodes = []; // Store all hotspot nodes across floors
  }

  loadRoomModels() {
    const loader = new GLTFLoader();
    
    // Load Floor 1
    loader.load(this.floors.floor1.modelPath, (gltf) => {
      this.floors.floor1.model = gltf.scene;
      this.floors.floor1.model.position.set(
        this.floors.floor1.position.x,
        this.floors.floor1.position.y,
        this.floors.floor1.position.z
      );
      
      this.processFloorModel('floor1');
      this.floors.floor1.loaded = true;
      this.checkAllFloorsLoaded();
    }, undefined, err => console.error('Error loading floor1:', err));

    // Load Floor 2
    loader.load(this.floors.floor2.modelPath, (gltf) => {
      this.floors.floor2.model = gltf.scene;
      this.floors.floor2.model.position.set(
        this.floors.floor2.position.x,
        this.floors.floor2.position.y,
        this.floors.floor2.position.z
      );
      
      this.processFloorModel('floor2');
      this.floors.floor2.loaded = true;
      this.checkAllFloorsLoaded();
    }, undefined, err => console.error('Error loading floor2:', err));
  }

  processFloorModel(floorKey) {
    const floor = this.floors[floorKey];
    const rotNodes = [];

    floor.model.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material.side = THREE.BackSide;
      }

      if (child.name) {
        const lower = child.name.toLowerCase();

        // skip helper and root objects
        if (
          lower !== "scene" &&
          !lower.includes("empty") &&
          !lower.includes("plane")
        ) {
          // Add floor identifier to node for tracking
          child.userData.floor = floorKey;
          rotNodes.push(child);
        }
      }
    });

    floor.hotspotNodes = rotNodes;
    this.allRotNodes = this.allRotNodes.concat(rotNodes);
    this.scene.add(floor.model);

    // Create wireframe for this floor
    this.createWireframeForFloor(floorKey);
  }

  createWireframeForFloor(floorKey) {
    const floor = this.floors[floorKey];
    if (!floor.model) return;

    floor.wireframe = new THREE.Group();
    
    floor.model.traverse(child => {
      if (child.isMesh && child.geometry) {
        // Create wireframe geometry
        const wireframeGeometry = new THREE.EdgesGeometry(child.geometry);
        const wireframeMaterial = new THREE.LineBasicMaterial({
          color: 0x000000,
          linewidth: 2,
        });
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        
        // Apply the same transform as the original mesh
        wireframe.position.copy(child.position);
        wireframe.rotation.copy(child.rotation);
        wireframe.scale.copy(child.scale);
        
        floor.wireframe.add(wireframe);
      }
    });
    
    // Position the wireframe group same as the floor model
    floor.wireframe.position.copy(floor.model.position);
    this.scene.add(floor.wireframe);
    floor.wireframe.visible = false; // Initially hidden
  }

  checkAllFloorsLoaded() {
    const allLoaded = Object.values(this.floors).every(floor => floor.loaded);
    if (allLoaded) {
      console.log('All floors loaded, creating hotspots...');
      // Create hotspots for all floors when everything is loaded
      this.hotspotManager.createRotHotspots(this.allRotNodes);
      this.updateFloorVisibility();
    }
  }

  updateFloorVisibility() {
    Object.keys(this.floors).forEach(floorKey => {
      const floor = this.floors[floorKey];
      if (floor.model && floor.wireframe) {
        switch (this.currentFloorView) {
          case 'all':
            floor.model.visible = true;
            floor.wireframe.visible = this.floorPlanView;
            break;
          case floorKey:
            floor.model.visible = true;
            floor.wireframe.visible = this.floorPlanView;
            break;
          default:
            floor.model.visible = false;
            floor.wireframe.visible = false;
            break;
        }
      }
    });

    // Update hotspot visibility based on current floor view
    this.updateHotspotVisibility();
  }

  updateHotspotVisibility() {
    // Hide all hotspot labels first
    this.hotspotManager.hideLabels();

    // Show labels only for visible floors after a short delay
    setTimeout(() => {
      if (this.currentFloorView === 'all') {
        this.hotspotManager.showLabels();
      } else {
        // Show labels only for the selected floor
        this.hotspotManager.showLabelsForFloor(this.currentFloorView);
      }
    }, 100);
  }

  setFloorView(view) {
    if (this.panoramaManager.isActive()) return; // Don't change floors while in panorama
    
    this.currentFloorView = view;
    this.updateFloorVisibility();
    
    // Update the dropdown display
    this.updateFloorDropdown();

    // Adjust camera position based on floor view
    this.adjustCameraForFloorView();
  }

  updateFloorDropdown() {
    const currentFloorText = document.getElementById('currentFloorText');
    const dropdownItems = document.querySelectorAll('.floor-dropdown-item');
    
    // Update the text in the dropdown toggle
    let displayText = 'All Floors';
    let displayIcon = '';
    
    switch(this.currentFloorView) {
      case 'floor1':
        displayText = 'Floor 1';
        displayIcon = '';
        break;
      case 'floor2':
        displayText = 'Floor 2';
        displayIcon = '';
        break;
      case 'all':
      default:
        displayText = 'All Floors';
        displayIcon = '';
        break;
    }
    
    currentFloorText.innerHTML = `<span class="floor-icon">${displayIcon}</span><span>${displayText}</span>`;
    
    // Update active state of dropdown items
    dropdownItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.floor === this.currentFloorView) {
        item.classList.add('active');
      }
    });
  }

  adjustCameraForFloorView() {
    if (this.currentFloorView === 'floor2') {
      // Adjust camera to better view floor 2
      this.camera.position.set(8, 9, 8); // Higher position for floor 2
      this.controls.target.set(0, 4, 0); // Look at floor 2 level
    } else if (this.currentFloorView === 'floor1') {
      // Standard position for floor 1
      this.camera.position.set(8, 5, 8);
      this.controls.target.set(0, 1, 0);
    } else {
      // All floors view - position to see both
      this.camera.position.set(10, 7, 10);
      this.controls.target.set(0, 2, 0); // Look at middle point between floors
    }
    this.controls.update();
  }

  setupEventListeners() {
    this.renderer.domElement.addEventListener('mousemove', (event) => {
      this.panoramaManager.handleMouseMove(event, this.raycaster, this.mouse, this.renderer);
    });

    this.renderer.domElement.addEventListener('click', (event) => {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left)/rect.width)*2-1;
      this.mouse.y = -((event.clientY - rect.top)/rect.height)*2+1;
      this.raycaster.setFromCamera(this.mouse, this.activeCamera);

      if(this.panoramaManager.isActive()){
        const hotspotMeshes = this.hotspotManager.getPanoramaHotspots();
        const intersects = this.raycaster.intersectObjects(hotspotMeshes, true);
        this.panoramaManager.handleClick(intersects);
      } else {
        const intersects = this.raycaster.intersectObjects(this.hotspotManager.getRotHotspots(), true);
        if(intersects.length>0){
          let obj = intersects[0].object;
          while(obj && !obj.userData.panoramaImage) obj = obj.parent;
          if(obj && obj.userData.panoramaImage) {
            // Add click animation to the cylinder
            this.animateCylinderClick(obj);
            // Zoom camera to the clicked cylinder before opening panorama
            this.zoomToCylinder(obj, () => {
              this.panoramaManager.openPanorama(obj.userData.panoramaImage);
            });
          }
        }
      }
    });

    // Bottom control buttons
    document.getElementById('homeBtn').addEventListener('click', () => this.goHome());
    document.getElementById('dollhouseBtn').addEventListener('click', () => this.toggleDollhouseView());
    document.getElementById('floorPlanBtn').addEventListener('click', () => this.toggleFloorPlanView());

    // Floor dropdown functionality
    const floorDropdownToggle = document.getElementById('floorDropdownToggle');
    const floorDropdownMenu = document.getElementById('floorDropdownMenu');
    const floorDropdownArrow = floorDropdownToggle.querySelector('.floor-dropdown-arrow');
    
    // Toggle dropdown
    floorDropdownToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = floorDropdownMenu.classList.contains('open');
      
      if (isOpen) {
        this.closeFloorDropdown();
      } else {
        this.openFloorDropdown();
      }
    });

    // Floor dropdown item clicks
    document.querySelectorAll('.floor-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const floor = item.dataset.floor;
        this.setFloorView(floor);
        this.closeFloorDropdown();
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.floor-selector')) {
        this.closeFloorDropdown();
      }
    });

    // Fullscreen button
    document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());

    // Info panel
    document.getElementById('infoBtn').addEventListener('click', () => this.showInfoPanel());
    document.getElementById('closeInfoBtn').addEventListener('click', () => this.hideInfoPanel());

    // Keyboard shortcuts
    window.addEventListener('keydown', (event) => {
      switch(event.key.toLowerCase()) {
        case 'h':
          this.goHome();
          break;
        case 'd':
          this.toggleDollhouseView();
          break;
        case 'f':
          this.toggleFloorPlanView();
          break;
        case '1':
          this.setFloorView('floor1');
          break;
        case '2':
          this.setFloorView('floor2');
          break;
        case 'a':
          this.setFloorView('all');
          break;
        case 'escape':
          if (this.panoramaManager.isActive()) {
            this.panoramaManager.exitPanorama();
          } else {
            this.goHome();
          }
          break;
      }
    });

    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      
      // Update perspective camera
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
      
      // Update orthographic camera
      const size = 8;
      this.orthoCamera.left = -size * aspect;
      this.orthoCamera.right = size * aspect;
      this.orthoCamera.top = size;
      this.orthoCamera.bottom = -size;
      this.orthoCamera.updateProjectionMatrix();
      
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.gradientTexture = this.createRadialGradientTexture(window.innerWidth, window.innerHeight);
      this.scene.background = this.gradientTexture;
    });

    window.addEventListener('hideRoomModel', () => {
      Object.values(this.floors).forEach(floor => {
        if(floor.model) floor.model.visible = false;
        if(floor.wireframe) floor.wireframe.visible = false;
      });
    });

    window.addEventListener('showRoomModel', () => {
      this.updateFloorVisibility();
    });
  }

  openFloorDropdown() {
    const floorDropdownMenu = document.getElementById('floorDropdownMenu');
    const floorDropdownToggle = document.getElementById('floorDropdownToggle');
    const floorDropdownArrow = floorDropdownToggle.querySelector('.floor-dropdown-arrow');
    
    floorDropdownMenu.classList.add('open');
    floorDropdownToggle.classList.add('active');
    floorDropdownArrow.classList.add('expanded');
  }

  closeFloorDropdown() {
    const floorDropdownMenu = document.getElementById('floorDropdownMenu');
    const floorDropdownToggle = document.getElementById('floorDropdownToggle');
    const floorDropdownArrow = floorDropdownToggle.querySelector('.floor-dropdown-arrow');
    
    floorDropdownMenu.classList.remove('open');
    floorDropdownToggle.classList.remove('active');
    floorDropdownArrow.classList.remove('expanded');
  }

  setupCameraViews() {
    this.autoRotate = true;
    this.dollhouseView = false;
    this.floorPlanView = false;
    // Updated home position - further back
    this.homePosition = { pos: new THREE.Vector3(10, 7, 10), target: new THREE.Vector3(0, 2, 0) };
  }

  goHome() {
    if (this.panoramaManager.isActive()) {
      this.panoramaManager.exitPanorama();
    }
    
    // Switch back to perspective camera
    this.activeCamera = this.camera;
    this.controls.object = this.camera;
    
    this.camera.position.copy(this.homePosition.pos);
    this.controls.target.copy(this.homePosition.target);
    this.controls.update();
    this.dollhouseView = false;
    this.floorPlanView = false;
    this.updateViewMode();
  }

  toggleDollhouseView() {
    if (this.panoramaManager.isActive()) return;
    this.dollhouseView = !this.dollhouseView;
    this.floorPlanView = false;
    
    // Switch back to perspective camera
    this.activeCamera = this.camera;
    this.controls.object = this.camera;
    
    this.updateViewMode();
  }

  toggleFloorPlanView() {
    if (this.panoramaManager.isActive()) return;
    this.floorPlanView = !this.floorPlanView;
    this.dollhouseView = false;
    
    if (this.floorPlanView) {
      // Switch to orthographic camera
      this.activeCamera = this.orthoCamera;
      this.controls.object = this.orthoCamera;
    } else {
      // Switch back to perspective camera
      this.activeCamera = this.camera;
      this.controls.object = this.camera;
    }
    
    this.updateViewMode();
  }

 updateViewMode() {
  if (this.dollhouseView) {
    // Dollhouse view: higher camera position for overview
    this.camera.position.set(12, 15, 12);
    this.controls.target.set(0, 2, 0);
    this.autoRotate = false;
    
    // Enable all controls for dollhouse view
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    
    this.updateFloorVisibility();

    // Reset model rotation for dollhouse view
    Object.values(this.floors).forEach(floor => {
      if (floor.model) {
        floor.model.rotation.set(0, 0, 0);
      }
    });

  } else if (this.floorPlanView) {
    // Top view: position camera above looking straight down
    const yPosition = this.currentFloorView === 'floor2' ? 20 : 
                     this.currentFloorView === 'floor1' ? 8 : 15;
    
    this.orthoCamera.position.set(0, yPosition, 0.001); // Tiny Z offset to avoid gimbal lock
    this.controls.target.set(
      0,
      this.currentFloorView === 'floor2' ? 4 : 
      this.currentFloorView === 'floor1' ? 0 : 2,
      0
    );
    this.autoRotate = false;
    
    // Lock tilting in top view - only allow Y-axis rotation (spinning)
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    
    // Lock polar angle to exactly straight down (0 degrees from Y-axis)
    this.controls.minPolarAngle = 0.0; // Almost exactly 0 - straight down
    this.controls.maxPolarAngle = 0.0; // Almost exactly 0 - straight down
    
    // Allow full azimuth rotation (spinning around Y-axis)
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    
    this.updateFloorVisibility();

    // Reset model rotation for side view
    Object.values(this.floors).forEach(floor => {
      if (floor.model) {
        floor.model.rotation.set(0, 0, 0);
      }
    });

  } else {
    // Normal view
    this.adjustCameraForFloorView();
    this.autoRotate = true;
    
    // Enable all controls for normal view
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
    this.controls.minPolarAngle = 0;
    this.controls.maxPolarAngle = Math.PI;
    this.controls.minAzimuthAngle = -Infinity;
    this.controls.maxAzimuthAngle = Infinity;
    
    this.updateFloorVisibility();

    // Reset model rotation when returning to normal view
    Object.values(this.floors).forEach(floor => {
      if (floor.model) {
        floor.model.rotation.set(0, 0, 0);
      }
    });
  }

  this.controls.update();
}
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  showInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.style.display = 'block';
  }

  hideInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.style.display = 'none';
  }

  animateCylinderClick(cylinder) {
    // Store original scale
    const originalScale = cylinder.scale.clone();

    // Animate scale up
    cylinder.scale.setScalar(1.3);

    // Animate back to original scale after a short delay
    setTimeout(() => {
      cylinder.scale.copy(originalScale);
    }, 150);
  }

  zoomToCylinder(cylinder, callback) {
    // Get cylinder world position
    const targetPosition = new THREE.Vector3();
    cylinder.getWorldPosition(targetPosition);

    // Calculate zoom position (closer to cylinder)
    const direction = new THREE.Vector3();
    direction.subVectors(this.camera.position, targetPosition).normalize();

    const zoomDistance = 5; // Distance to zoom to
    const zoomPosition = new THREE.Vector3();
    zoomPosition.copy(targetPosition).add(direction.multiplyScalar(zoomDistance));

    // Store current camera state
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();

    // Animate camera zoom
    const duration = 800; // 800ms animation
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing function
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // Interpolate camera position
      this.camera.position.lerpVectors(startPosition, zoomPosition, easeProgress);

      // Update controls target to look at cylinder
      this.controls.target.lerpVectors(startTarget, targetPosition, easeProgress);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete, call callback
        setTimeout(callback, 100); // Small delay before opening panorama
      }
    };

    animate();
  }

  animate() {
    requestAnimationFrame(()=>this.animate());

    // Only auto-rotate when in normal view mode and not in panorama
    if(this.autoRotate && !this.panoramaManager.isActive() && !this.dollhouseView && !this.floorPlanView) {
      Object.values(this.floors).forEach(floor => {
        if (floor.model && floor.model.visible) {
          floor.model.rotation.y += 0.002;
        }
      });
    }

    if(this.panoramaManager.isActive())
      this.hotspotManager.animateHotspots();

    // Only update labels when not in panorama mode
    if (!this.panoramaManager.isActive()) {
      this.hotspotManager.updateRotTextFacing(this.activeCamera);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.activeCamera);
  }
}

// Initialize
new RoomViewer();