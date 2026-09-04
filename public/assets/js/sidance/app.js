/**
 * SIDANCE ✕ FUTURE YOU - Main Application Controller
 * Glues together MultiPoseTracker, MultiCreatureEngine, Polyphonic AudioEngine, and Exhibition UI.
 * Features live camera preview in PIP, full-screen background overlay, and pure artwork exhibition mode.
 */

import { MultiPoseTracker } from './pose-tracker.js';
import { CreatureEngine } from './creature-engine.js';
import { AudioEngine } from './audio-engine.js';

class SidanceApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.videoElement = document.getElementById('webcam-video');
    this.pipVideo = document.getElementById('pip-video');
    this.pipContainer = document.getElementById('pip-container');
    this.bgVideo = document.getElementById('camera-bg-video');
    this.bgDimmer = document.getElementById('camera-bg-dimmer');

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
    this.camModeSelect = document.getElementById('cam-mode-select');
    this.bgOpacitySlider = document.getElementById('bg-opacity-slider');
    this.bgOpacityVal = document.getElementById('bg-opacity-val');
    this.scaleSlider = document.getElementById('scale-slider');
    this.scaleVal = document.getElementById('scale-val');
    this.offsetSlider = document.getElementById('offset-slider');
    this.offsetVal = document.getElementById('offset-val');
    this.sensSlider = document.getElementById('sens-slider');
    this.sensVal = document.getElementById('sens-val');
    this.volSlider = document.getElementById('vol-slider');
    this.volVal = document.getElementById('vol-val');
    this.testModeBtn = document.getElementById('btn-test-mode');
    this.hudModeBadge = document.getElementById('hud-mode-badge');
    this.camViewBtn = document.getElementById('btn-cam-view');
    this.soundBtn = document.getElementById('btn-sound');
    this.mirrorBtn = document.getElementById('btn-mirror');
    this.demoBtn = document.getElementById('btn-demo');
    this.presenceToast = document.getElementById('presence-toast');

    // Submodules
    this.tracker = null;
    this.creature = null;
    this.audio = null;

    // State
    this.isUiVisible = true;
    this.isMirror = true;
    this.isDemo = false;
    this.isTestFitMode = true; // Enabled by default for direct 1:1 real person alignment
    this.camViewMode = 'overlay'; // 'pip' | 'overlay' | 'off'
    this.bgOpacity = 0.65;
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

    // 5. Initialize Test Fit Mode (1:1 Real Body Overlay)
    this.setTestFitMode(true);

    // 6. Auto-start Camera Stream
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

    this.statusBadge.textContent = 'CONNECTING CAMERA...';
    this.statusBadge.className = 'status-badge status-init';

    const success = await this.tracker.startCamera(deviceId, resolution);

    if (success) {
      this.statusBadge.textContent = '카메라 활성 // 2D MULTI-POSE 60FPS';
      this.statusBadge.className = 'status-badge status-active';
      this.isDemo = false;
      this.demoBtn.classList.remove('active');

      // Bind stream to PIP preview and background mirror video
      if (this.tracker.stream) {
        if (this.pipVideo) {
          this.pipVideo.srcObject = this.tracker.stream;
          this.pipVideo.play().catch(e => console.warn(e));
        }
        if (this.bgVideo) {
          this.bgVideo.srcObject = this.tracker.stream;
          this.bgVideo.play().catch(e => console.warn(e));
        }
      }
      this.setupCameras();
      this.applyCamViewMode();
    } else {
      this.statusBadge.textContent = '듀엣 데모 안무';
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
    const count = collectiveMetrics ? (collectiveMetrics.dancerCount || 0) : 0;
    if (this.dancersVal) {
      this.dancersVal.textContent = count === 0 ? '0명 감지' : `${count}인 감지 (${count === 1 ? '솔로' : count === 2 ? '듀엣' : '앙상블'})`;
    }

    if (this.isUiVisible && collectiveMetrics) {
      const energyPct = count === 0 ? 0 : Math.min(Math.round((collectiveMetrics.totalEnergy || 0) * 45), 100);
      this.energyMeter.style.width = `${energyPct}%`;
      this.energyText.textContent = `${energyPct}%`;
    }

    // Toast on dancer count changes
    if (count !== this.lastDancerCount) {
      if (count > this.lastDancerCount) {
        if (count === 1) this.showToast('// 댄서 1인 감지 완료');
        else if (count === 2) this.showToast('// 2인 듀엣 동기화 완료');
        else this.showToast(`// ${count}인 앙상블 동기화 완료`);
      } else if (count === 0 && this.lastDancerCount > 0) {
        this.showToast('// 모든 댄서 이탈 — 스테이지 리셋');
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

  toggleTestFitMode(force) {
    const next = force !== undefined ? force : !this.isTestFitMode;
    this.setTestFitMode(next);
  }

  setTestFitMode(enable) {
    this.isTestFitMode = Boolean(enable);
    this.creature.setTestOverlayMode(this.isTestFitMode);

    if (this.testModeBtn) {
      this.testModeBtn.classList.toggle('active', this.isTestFitMode);
      this.testModeBtn.querySelector('.btn-label').textContent = this.isTestFitMode ? '⚡ 1:1 피팅: ON' : '⚡ 1:1 피팅: OFF';
    }

    if (this.hudModeBadge) {
      this.hudModeBadge.style.display = this.isTestFitMode ? 'flex' : 'none';
    }

    if (this.isTestFitMode) {
      this.setCamViewMode('overlay');
      this.showToast('// ⚡ 1:1 바디 매칭 활성화');
    } else {
      this.setCamViewMode('off');
      this.showToast('// 순수 전시 모드 (VOID STAGE)');
    }
  }

  setCamViewMode(mode) {
    this.camViewMode = mode;
    this.applyCamViewMode();

    const modeLabels = {
      pip: 'CAM: PIP (CORNER PREVIEW)',
      overlay: 'CAM: OVERLAY (BODY ALIGNMENT)',
      off: 'CAM: OFF (PURE EXHIBITION)'
    };
    this.showToast(`// ${modeLabels[mode]}`);
  }

  cycleCamViewMode() {
    const cycle = {
      pip: 'overlay',
      overlay: 'off',
      off: 'pip'
    };
    this.setCamViewMode(cycle[this.camViewMode] || 'pip');
  }

  applyCamViewMode() {
    if (this.camModeSelect) {
      this.camModeSelect.value = this.camViewMode;
    }

    if (this.camViewMode === 'pip') {
      if (this.pipContainer) this.pipContainer.classList.remove('hidden');
      if (this.bgVideo) this.bgVideo.classList.remove('active');
      if (this.bgDimmer) this.bgDimmer.classList.remove('active');
      this.creature.setCameraBackground(false);

      if (this.camViewBtn) {
        this.camViewBtn.classList.add('active');
        this.camViewBtn.querySelector('.btn-label').textContent = '📷 카메라: PIP';
      }
    } else if (this.camViewMode === 'overlay') {
      if (this.pipContainer) this.pipContainer.classList.add('hidden');
      if (this.bgVideo) {
        this.bgVideo.classList.add('active');
        this.bgVideo.style.opacity = this.bgOpacity;
      }
      if (this.bgDimmer) this.bgDimmer.classList.add('active');
      this.creature.setCameraBackground(true);

      if (this.camViewBtn) {
        this.camViewBtn.classList.add('active');
        this.camViewBtn.querySelector('.btn-label').textContent = '📷 카메라: 오버레이';
      }
    } else { // 'off'
      if (this.pipContainer) this.pipContainer.classList.add('hidden');
      if (this.bgVideo) this.bgVideo.classList.remove('active');
      if (this.bgDimmer) this.bgDimmer.classList.remove('active');
      this.creature.setCameraBackground(false);

      if (this.camViewBtn) {
        this.camViewBtn.classList.remove('active');
        this.camViewBtn.querySelector('.btn-label').textContent = '📷 카메라: OFF';
      }
    }
  }

  bindEvents() {
    // 1. Form Switching
    this.formButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const formId = Number(btn.dataset.formBtn);
        this.selectForm(formId);
      });
    });

    // 2. Test Fit Mode Button (1:1 Real Body Overlay)
    if (this.testModeBtn) {
      this.testModeBtn.addEventListener('click', () => {
        this.toggleTestFitMode();
      });
    }

    // 3. Camera View Mode Button
    if (this.camViewBtn) {
      this.camViewBtn.addEventListener('click', () => {
        this.cycleCamViewMode();
      });
    }

    // 4. Sound Toggle
    this.soundBtn.addEventListener('click', () => {
      const enabled = this.audio.toggle();
      this.soundBtn.classList.toggle('active', enabled);
      this.soundBtn.querySelector('.btn-label').textContent = enabled ? '🔊 사운드: ON' : '🔊 사운드: OFF';
      this.showToast(enabled ? '// 사운드 활성화' : '// 사운드 음소거');
    });

    // 4-1. Dedicated Clean Stage UI Hide Button
    const hideBtn = document.getElementById('btn-hide-ui');
    if (hideBtn) {
      hideBtn.addEventListener('click', () => {
        this.hideAllUi();
      });
    }

    // 4-2. Double-Click Anywhere to Toggle/Restore UI
    window.addEventListener('dblclick', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('#settings-drawer')) return;
      if (!this.isUiVisible) {
        this.showAllUi();
      } else {
        if (!e.target.closest('.controls-bar')) {
          this.hideAllUi();
        }
      }
    });

    // 4-3. Touch Double-Tap Anywhere for Touch/Kiosk Displays
    let lastTapTime = 0;
    window.addEventListener('touchend', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.closest('#settings-drawer')) return;
      const now = Date.now();
      if (now - lastTapTime < 350) {
        if (!this.isUiVisible) {
          this.showAllUi();
        } else if (!e.target.closest('.controls-bar')) {
          this.hideAllUi();
        }
      }
      lastTapTime = now;
    });

    // 5. Mirror Toggle
    this.mirrorBtn.addEventListener('click', () => {
      this.isMirror = !this.isMirror;
      this.tracker.setMirror(this.isMirror);
      this.updateMirrorState();
      this.showToast(this.isMirror ? '// 미러 모드: ON' : '// 미러 모드: OFF');
    });

    // 6. Demo Mode Toggle
    this.demoBtn.addEventListener('click', () => {
      this.isDemo = !this.isDemo;
      if (this.isDemo) {
        this.tracker.startDemoMode();
        this.demoBtn.classList.add('active');
        this.statusBadge.textContent = '듀엣 데모 안무';
        this.statusBadge.className = 'status-badge status-demo';
        this.showToast('// 듀엣 데모 안무 활성화');
      } else {
        this.startCameraStream();
      }
    });

    // 7. Settings Drawer Toggle
    document.getElementById('btn-settings').addEventListener('click', () => {
      this.toggleSettings();
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      this.toggleSettings(false);
    });

    // 8. Fullscreen Toggle
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // 8. Camera Mode Select (in Drawer)
    if (this.camModeSelect) {
      this.camModeSelect.addEventListener('change', (e) => {
        this.setCamViewMode(e.target.value);
      });
    }

    // 9. Background Opacity Slider
    if (this.bgOpacitySlider) {
      this.bgOpacitySlider.addEventListener('input', (e) => {
        this.bgOpacity = parseFloat(e.target.value);
        if (this.bgOpacityVal) {
          this.bgOpacityVal.textContent = `${Math.round(this.bgOpacity * 100)}%`;
        }
        if (this.camViewMode === 'overlay' && this.bgVideo) {
          this.bgVideo.style.opacity = this.bgOpacity;
        }
      });
    }

    // 10. Max Dancers Selection
    if (this.maxDancersSelect) {
      this.maxDancersSelect.addEventListener('change', (e) => {
        this.tracker.setMaxDancers(e.target.value);
        this.showToast(`// MAX DANCERS SET TO ${e.target.value}`);
      });
    }

    // 11. Calibration Sliders
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

    // 12. Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const key = e.key.toUpperCase();

      if (key === 'T') {
        this.toggleTestFitMode();
      } else if (key === 'V') {
        this.cycleCamViewMode();
      } else if (key === 'F') {
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
      1: '01 실크 플로우',
      2: '02 오로라 베일',
      3: '03 수묵 키네틱',
      4: '04 코스믹 얀'
    };
    this.showToast(`// 무용 폼 전환: ${formNames[formId]}`);
  }

  updateMirrorState() {
    this.mirrorBtn.classList.toggle('active', this.isMirror);
    this.mirrorBtn.querySelector('.btn-label').textContent = this.isMirror ? '⟳ 미러: ON' : '⟳ 미러: OFF';
    const transformVal = this.isMirror ? 'scaleX(-1)' : 'none';

    if (this.videoElement) this.videoElement.style.transform = transformVal;
    if (this.pipVideo) this.pipVideo.style.transform = transformVal;
    if (this.bgVideo) this.bgVideo.style.transform = transformVal;
  }

  toggleUI(force) {
    this.isUiVisible = force !== undefined ? force : !this.isUiVisible;
    if (this.uiContainer) {
      this.uiContainer.classList.toggle('ui-hidden', !this.isUiVisible);
    }
    if (!this.isUiVisible) {
      this.toggleSettings(false);
      this.showToast('// 전시 모드: 화면을 더블 클릭하면 UI가 복원됩니다');
    } else {
      this.showToast('// UI 복원 완료');
    }
  }

  hideAllUi() {
    this.toggleUI(false);
  }

  showAllUi() {
    this.toggleUI(true);
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
