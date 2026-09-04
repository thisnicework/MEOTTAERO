/**
 * SIDANCE ✕ FUTURE YOU - Main Application Controller
 * Glues together MultiPoseTracker, MultiCreatureEngine, Polyphonic AudioEngine, and Exhibition UI.
 */

import { MultiPoseTracker } from './pose-tracker.js';
import { CreatureEngine } from './creature-engine.js';
import { AudioEngine } from './audio-engine.js';

class SidanceApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.videoElement = document.getElementById('webcam-video');
    this.pipVideo = document.getElementById('pip-video');

    // UI Elements
    this.uiContainer = document.getElementById('exhibition-ui');
    this.settingsDrawer = document.getElementById('settings-drawer');
    this.fpsDisplay = document.getElementById('hud-fps');
    this.dancersBadge = document.getElementById('hud-dancers-badge');
    this.dancersVal = document.getElementById('hud-dancers-val');
    this.energyMeter = document.getElementById('hud-energy-bar');
    this.energyText = document.getElementById('hud-energy-val');
    this.statusBadge = document.getElementById('hud-status');
    this.formButtons = document.querySelectorAll('[data-form-btn]');
    this.cameraSelect = document.getElementById('camera-select');
    this.resolutionSelect = document.getElementById('resolution-select');
    this.maxDancersSelect = document.getElementById('max-dancers-select');
    this.scaleSlider = document.getElementById('scale-slider');
    this.scaleVal = document.getElementById('scale-val');
    this.offsetSlider = document.getElementById('offset-slider');
    this.offsetVal = document.getElementById('offset-val');
    this.sensSlider = document.getElementById('sens-slider');
    this.sensVal = document.getElementById('sens-val');
    this.volSlider = document.getElementById('vol-slider');
    this.volVal = document.getElementById('vol-val');
    this.soundBtn = document.getElementById('btn-sound');
    this.mirrorBtn = document.getElementById('btn-mirror');
    this.demoBtn = document.getElementById('btn-demo');
    this.pipToggle = document.getElementById('pip-toggle');
    this.pipContainer = document.getElementById('pip-container');
    this.presenceToast = document.getElementById('presence-toast');

    // Submodules
    this.tracker = null;
    this.creature = null;
    this.audio = null;

    // State
    this.isUiVisible = true;
    this.isMirror = true;
    this.isDemo = false;
    this.lastDancerCount = 0;
    this.calibration = {
      scale: 1.0,
      yOffset: -0.1,
      sensitivity: 1.2
    };

    this.init();
  }

  async init() {
    // 1. Initialize Multi-Avatar 3D Creature Engine
    this.creature = new CreatureEngine(this.container, {
      activeForm: 1,
      scale: this.calibration.scale,
      yOffset: this.calibration.yOffset,
      sensitivity: this.calibration.sensitivity
    });

    // 2. Initialize Polyphonic Audio Engine
    this.audio = new AudioEngine();

    // 3. Initialize Multi-Person MoveNet Tracker
    this.tracker = new MultiPoseTracker({
      mirror: this.isMirror,
      resolution: '4k',
      maxDancers: 4,
      onMultiPose: (dancers, metrics) => this.onMultiPoseUpdate(dancers, metrics),
      onFps: (fps) => this.onFpsUpdate(fps)
    });

    await this.tracker.init(this.videoElement);

    // 4. Setup Cameras & UI Event Listeners
    await this.setupCameras();
    this.bindEvents();

    // 5. Auto-start Camera Stream
    this.startCameraStream();
  }

  async setupCameras() {
    const cameras = await this.tracker.getAvailableCameras();
    this.cameraSelect.innerHTML = '';

    if (cameras.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Default Camera (Auto)';
      this.cameraSelect.appendChild(opt);
    } else {
      cameras.forEach((cam, idx) => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${idx + 1}`;
        this.cameraSelect.appendChild(opt);
      });
    }
  }

  async startCameraStream() {
    const deviceId = this.cameraSelect.value || null;
    const resolution = this.resolutionSelect.value || '4k';

    this.statusBadge.textContent = 'LOADING MULTIPOSE AI...';
    this.statusBadge.className = 'status-badge status-init';

    const success = await this.tracker.startCamera(deviceId, resolution);

    if (success) {
      this.statusBadge.textContent = 'SYSTEM ACTIVE // 4K MULTI-POSE';
      this.statusBadge.className = 'status-badge status-active';
      this.isDemo = false;
      this.demoBtn.classList.remove('active');

      if (this.pipVideo && this.tracker.stream) {
        this.pipVideo.srcObject = this.tracker.stream;
        this.pipVideo.play().catch(e => console.warn(e));
      }
      this.setupCameras();
    } else {
      this.statusBadge.textContent = 'DEMO DUET CHOREO';
      this.statusBadge.className = 'status-badge status-demo';
      this.isDemo = true;
      this.demoBtn.classList.add('active');
    }

    this.updateMirrorState();
  }

  onMultiPoseUpdate(trackedDancersMap, collectiveMetrics) {
    // 1. Pass multi-person poses to 3D creature engine
    this.creature.updateMultiDancers(trackedDancersMap, collectiveMetrics);

    // 2. Pass multi-person poses to polyphonic audio engine
    this.audio.updateMultiDancers(trackedDancersMap, collectiveMetrics);

    // 3. Update HUD metrics
    const count = collectiveMetrics.dancerCount;
    if (this.dancersVal) {
      this.dancersVal.textContent = count === 0 ? '0 DANCERS' : `${count} DANCER${count > 1 ? 'S ACTIVE' : ' ACTIVE'}`;
    }

    if (this.isUiVisible && collectiveMetrics) {
      const energyPct = Math.min(Math.round((collectiveMetrics.totalEnergy || 0) * 45), 100);
      this.energyMeter.style.width = `${energyPct}%`;
      this.energyText.textContent = `${energyPct}%`;
    }

    // Toast on dancer count changes
    if (count !== this.lastDancerCount) {
      if (count > this.lastDancerCount) {
        if (count === 1) this.showToast('// DANCER 1 SYNCHRONIZED');
        else if (count === 2) this.showToast('// 2 DANCERS SYNCHRONIZED (DUET)');
        else this.showToast(`// ${count} DANCERS SYNCHRONIZED (ENSEMBLE)`);
      } else if (count === 0 && this.lastDancerCount > 0) {
        this.showToast('// ALL DANCERS EXITED — COLLAPSING');
      }
      this.lastDancerCount = count;
    }
  }

  onFpsUpdate(fps) {
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = `${fps} FPS`;
    }
  }

  showToast(message) {
    if (!this.presenceToast) return;
    this.presenceToast.textContent = message;
    this.presenceToast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.presenceToast.classList.remove('show');
    }, 2400);
  }

  bindEvents() {
    // 1. Form Switching
    this.formButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const formId = Number(btn.dataset.formBtn);
        this.selectForm(formId);
      });
    });

    // 2. Sound Toggle
    this.soundBtn.addEventListener('click', () => {
      const enabled = this.audio.toggle();
      this.soundBtn.classList.toggle('active', enabled);
      this.soundBtn.querySelector('.btn-label').textContent = enabled ? 'SOUND: ON' : 'SOUND: OFF';
      this.showToast(enabled ? '// POLYPHONIC SOUNDSCAPE ON' : '// AUDIO MUTED');
    });

    // 3. Mirror Toggle
    this.mirrorBtn.addEventListener('click', () => {
      this.isMirror = !this.isMirror;
      this.tracker.setMirror(this.isMirror);
      this.updateMirrorState();
      this.showToast(this.isMirror ? '// MIRROR ON' : '// MIRROR OFF');
    });

    // 4. Demo Mode Toggle
    this.demoBtn.addEventListener('click', () => {
      this.isDemo = !this.isDemo;
      if (this.isDemo) {
        this.tracker.startDemoMode();
        this.demoBtn.classList.add('active');
        this.statusBadge.textContent = 'DEMO DUET CHOREO';
        this.statusBadge.className = 'status-badge status-demo';
        this.showToast('// DEMO DUET CHOREOGRAPHY ACTIVE');
      } else {
        this.startCameraStream();
      }
    });

    // 5. Settings Drawer Toggle
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.toggleSettings();
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.toggleSettings(false);
    });

    // 6. Fullscreen Toggle
    const fsBtn = document.getElementById('btn-fullscreen');
    fsBtn.addEventListener('click', () => this.toggleFullscreen());
    window.addEventListener('dblclick', (e) => {
      if (!e.target.closest('#settings-drawer') && !e.target.closest('.ui-controls')) {
        this.toggleFullscreen();
      }
    });

    // 7. PIP Webcam Toggle
    this.pipToggle.addEventListener('change', (e) => {
      this.pipContainer.classList.toggle('hidden', !e.target.checked);
    });

    // 8. Max Dancers Selection
    if (this.maxDancersSelect) {
      this.maxDancersSelect.addEventListener('change', (e) => {
        this.tracker.setMaxDancers(e.target.value);
        this.showToast(`// MAX DANCERS SET TO ${e.target.value}`);
      });
    }

    // 9. Calibration Sliders
    this.scaleSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.calibration.scale = val;
      this.scaleVal.textContent = `${val.toFixed(2)}x`;
      this.creature.setCalibration(this.calibration);
    });

    this.offsetSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.calibration.yOffset = val;
      this.offsetVal.textContent = `${val.toFixed(2)}m`;
      this.creature.setCalibration(this.calibration);
    });

    this.sensSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.calibration.sensitivity = val;
      this.sensVal.textContent = `${val.toFixed(1)}x`;
      this.creature.setCalibration(this.calibration);
    });

    this.volSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.audio.setVolume(val);
      this.volVal.textContent = `${Math.round(val * 100)}%`;
    });

    this.cameraSelect.addEventListener('change', () => this.startCameraStream());
    this.resolutionSelect.addEventListener('change', () => this.startCameraStream());

    // 10. Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const key = e.key.toUpperCase();

      if (key === 'F') {
        this.toggleFullscreen();
      } else if (key === 'H') {
        this.toggleUI();
      } else if (key === 'M') {
        this.mirrorBtn.click();
      } else if (key === 'S') {
        this.soundBtn.click();
      } else if (key === 'D') {
        this.demoBtn.click();
      } else if (key === 'C') {
        this.toggleSettings();
      } else if (['1', '2', '3', '4'].includes(key)) {
        this.selectForm(Number(key));
      } else if (key === 'ESCAPE') {
        this.toggleSettings(false);
      }
    });
  }

  selectForm(formId) {
    this.creature.setForm(formId);
    this.formButtons.forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.formBtn) === formId);
    });

    const formNames = {
      1: '01 CYBER SPINETRON',
      2: '02 BIO-LUMEN BRISTLE',
      3: '03 LIQUID MERCURY RIBBON',
      4: '04 QUANTUM POLYHEDRA'
    };
    this.showToast(`// ALL AVATARS MORPHED: ${formNames[formId]}`);
  }

  updateMirrorState() {
    this.mirrorBtn.classList.toggle('active', this.isMirror);
    this.mirrorBtn.querySelector('.btn-label').textContent = this.isMirror ? 'MIRROR: ON' : 'MIRROR: OFF';
    if (this.videoElement) {
      this.videoElement.style.transform = this.isMirror ? 'scaleX(-1)' : 'none';
    }
    if (this.pipVideo) {
      this.pipVideo.style.transform = this.isMirror ? 'scaleX(-1)' : 'none';
    }
  }

  toggleUI(force) {
    this.isUiVisible = force !== undefined ? force : !this.isUiVisible;
    this.uiContainer.classList.toggle('ui-hidden', !this.isUiVisible);
    if (!this.isUiVisible) {
      this.toggleSettings(false);
      this.showToast('// CLEAN EXHIBITION MODE (PRESS "H" TO RESTORE UI)');
    }
  }

  toggleSettings(force) {
    const isOpen = this.settingsDrawer.classList.contains('open');
    const newState = force !== undefined ? force : !isOpen;
    this.settingsDrawer.classList.toggle('open', newState);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new SidanceApp();
});
