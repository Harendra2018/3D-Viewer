import * as THREE from 'three';
import { hotspotData } from './TaskID_0001/hotspot-config.js';

export class PanoramaManager {
  constructor(scene, camera, controls, hotspotManager, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.hotspotManager = hotspotManager;
    this.renderer = renderer;
    this.panoramaMesh = null;
    this.panoramaActive = false;
    this.savedView = this.saveCurrentView();

    this.panoHint = document.getElementById('panoHint');
    this.hotspotTooltip = document.getElementById('hotspotTooltip');
    this.loadingIndicator = document.getElementById('loadingIndicator');

    this.autoRotateTimeout = null;
    this.wheelHandler = null; // keep reference for cleanup

    this.setupEventListeners();
  }

  saveCurrentView() {
    return {
      pos: this.camera.position.clone(),
      target: this.controls.target.clone(),
      enableZoom: this.controls.enableZoom,
      enablePan: this.controls.enablePan,
      minDistance: this.controls.minDistance,
      maxDistance: this.controls.maxDistance,
      minPolarAngle: this.controls.minPolarAngle,
      maxPolarAngle: this.controls.maxPolarAngle,
      zoomSpeed: this.controls.zoomSpeed
    };
  }

  setupEventListeners() {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.panoramaActive) {
        this.exitPanorama();
      }
    });
  }

  openPanorama(imageUrl) {
    console.log('Opening panorama:', imageUrl);
    this.loadingIndicator.style.display = 'block';

    this.hotspotManager.hideLabels();

    const loader = new THREE.TextureLoader();
    loader.load(
      imageUrl,
      (texture) => {
        this.loadingIndicator.style.display = 'none';

        if (this.panoramaMesh) {
          this.scene.remove(this.panoramaMesh);
          this.panoramaMesh.geometry.dispose();
          this.panoramaMesh.material.dispose();
        }

        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);
        const material = new THREE.MeshBasicMaterial({ map: texture });
        this.panoramaMesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.panoramaMesh);

        const currentPanoramaName = imageUrl.split('/').pop().replace('.jpg', '');
        const filteredHotspots = hotspotData.filter(h => h.fromRoom === currentPanoramaName);

        this.hotspotManager.createPanoramaHotspots(filteredHotspots);

        this.hideRoomElements();
        if (!this.panoramaActive) this.savedView = this.saveCurrentView();
        this.setPanoramaCameraSettings();

        this.panoHint.style.display = 'block';
        this.panoramaActive = true;
      },
      undefined,
      (err) => {
        this.loadingIndicator.style.display = 'none';
        console.error('Panorama load error:', err);
        alert(`Failed to load panorama: ${imageUrl}.`);
        this.hotspotManager.showLabels();
      }
    );
  }

  exitPanorama() {
    console.log('Exiting panorama, cleaning up...');

    // remove pano hotspots
    this.hotspotManager.getPanoramaHotspots().forEach(group => {
      group.children.forEach(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      this.scene.remove(group);
    });

    // remove pano mesh
    if (this.panoramaMesh) {
      this.scene.remove(this.panoramaMesh);
      this.panoramaMesh.geometry?.dispose();
      if (this.panoramaMesh.material) {
        this.panoramaMesh.material.map?.dispose();
        this.panoramaMesh.material.dispose();
      }
      this.panoramaMesh = null;
    }

    this.showRoomElements();
    this.restoreCameraSettings();

    this.panoHint.style.display = 'none';
    this.hotspotTooltip.style.display = 'none';
    document.querySelector('canvas').style.cursor = 'grab';
    this.panoramaActive = false;

    // cleanup events
    if (this.wheelHandler) {
      window.removeEventListener('wheel', this.wheelHandler);
      this.wheelHandler = null;
    }
    clearTimeout(this.autoRotateTimeout);

    setTimeout(() => this.hotspotManager.showLabels(), 200);
  }

  hideRoomElements() {
    window.dispatchEvent(new CustomEvent('hideRoomModel'));
  }

  showRoomElements() {
    window.dispatchEvent(new CustomEvent('showRoomModel'));
  }

  setPanoramaCameraSettings() {
    this.camera.position.set(0, 0, 0);
    this.controls.target.set(0, 0, -1);

    this.controls.enablePan = false;
    this.controls.enableZoom = false;

    this.controls.minPolarAngle = 0.01;
    this.controls.maxPolarAngle = Math.PI - 0.01;

    this.camera.fov = 75;
    this.camera.minFov = 30;
    this.camera.maxFov = 90;
    this.camera.updateProjectionMatrix();

    // zoom with wheel
    this.wheelHandler = (event) => {
      const zoomSpeed = 1;
      if (event.deltaY < 0) {
        this.camera.fov = Math.max(this.camera.minFov, this.camera.fov - zoomSpeed);
      } else {
        this.camera.fov = Math.min(this.camera.maxFov, this.camera.fov + zoomSpeed);
      }
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('wheel', this.wheelHandler);

    // enable auto rotate
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.9;

    // pause on interaction
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
    });
    this.controls.addEventListener('end', () => {
      clearTimeout(this.autoRotateTimeout);
      this.autoRotateTimeout = setTimeout(() => {
        if (this.panoramaActive) this.controls.autoRotate = true;
      }, 3000);
    });
  }

  restoreCameraSettings() {
    this.controls.autoRotate = false;

    this.camera.position.copy(this.savedView.pos);
    this.controls.target.copy(this.savedView.target);
    this.controls.enablePan = this.savedView.enablePan;
    this.controls.enableZoom = this.savedView.enableZoom;
    this.controls.minDistance = this.savedView.minDistance;
    this.controls.maxDistance = this.savedView.maxDistance;
    this.controls.minPolarAngle = this.savedView.minPolarAngle;
    this.controls.maxPolarAngle = this.savedView.maxPolarAngle;
    this.controls.zoomSpeed = this.savedView.zoomSpeed;

    this.controls.update();
    console.log('Camera settings restored, auto-rotate disabled');
  }

  handleMouseMove(event, raycaster, mouse, renderer) {
    if (!this.panoramaActive) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, this.camera);
    const intersects = raycaster.intersectObjects(this.hotspotManager.getPanoramaHotspots(), true);

    if (intersects.length > 0) {
      let hotspotGroup = intersects[0].object;
      while (hotspotGroup.parent && !hotspotGroup.userData.info) {
        hotspotGroup = hotspotGroup.parent;
      }
      if (hotspotGroup.userData.info) {
        const info = hotspotGroup.userData.info;
        this.hotspotTooltip.textContent = `${info.name}: ${info.description}`;
        this.hotspotTooltip.style.left = event.clientX + 10 + 'px';
        this.hotspotTooltip.style.top = event.clientY - 10 + 'px';
        this.hotspotTooltip.style.display = 'block';
        renderer.domElement.style.cursor = 'pointer';
      }
    } else {
      this.hotspotTooltip.style.display = 'none';
      renderer.domElement.style.cursor = 'grab';
    }
  }

  handleClick(intersects) {
    if (!this.panoramaActive || intersects.length === 0) return false;

    let hotspotGroup = intersects[0].object;
    while (hotspotGroup.parent && !hotspotGroup.userData.info) {
      hotspotGroup = hotspotGroup.parent;
    }

    if (hotspotGroup.userData.info) {
      const info = hotspotGroup.userData.info;
      this.openPanorama(info.panoramaImage);
      return true;
    }

    return false;
  }

  isActive() {
    return this.panoramaActive;
  }
}
