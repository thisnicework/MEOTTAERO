/**
 * SIDANCE ✕ FUTURE YOU - 2D HTML5 Canvas Generative Graphics Engine
 * Ultra-low-latency 60+ FPS generative creature renderer replacing heavy 3D WebGL.
 * Features 4 kinetic morphing forms (Cyber Spine, Bio Bristle, Liquid Ribbon, Quantum),
 * multi-dancer color palettes, additive neon glow blending, and 1:1 camera body overlay.
 */

const DANCER_PALETTES = [
  {
    name: 'CYAN_MAGENTA',
    primary: '#00f0ff',
    secondary: '#ff0077',
    core: '#ffffff',
    glow: 'rgba(0, 240, 255, 0.55)',
    metal: '#e2e8f0'
  },
  {
    name: 'BIO_LIME_GOLD',
    primary: '#00ff66',
    secondary: '#ffe600',
    core: '#ffffff',
    glow: 'rgba(0, 255, 102, 0.55)',
    metal: '#f1f5f9'
  },
  {
    name: 'VIOLET_AMBER',
    primary: '#a855f7',
    secondary: '#ff5400',
    core: '#ffffff',
    glow: 'rgba(168, 85, 247, 0.55)',
    metal: '#fed7aa'
  },
  {
    name: 'WHITE_AZURE',
    primary: '#ffffff',
    secondary: '#0099ff',
    core: '#00f0ff',
    glow: 'rgba(0, 153, 255, 0.55)',
    metal: '#e0f2fe'
  }
];

export class CreatureEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      activeForm: 1,
      scale: 1.0,
      yOffset: 0.0,
      sensitivity: 1.2,
      isTestOverlayMode: true,
      hasCameraBg: true
    }, options);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sidance-2d-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '1';
    this.canvas.style.pointerEvents = 'none';

    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.avatars = new Map(); // slotId -> AvatarInstance
    this.lastTime = performance.now();
    this.elapsedTime = 0;

    this.onResize();
    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    const sw = window.innerWidth || 1080;
    const sh = window.innerHeight || 1920;
    this.width = sw;
    this.height = sh;

    this.canvas.width = Math.floor(sw * this.dpr);
    this.canvas.height = Math.floor(sh * this.dpr);
  }

  setForm(formId) {
    this.options.activeForm = Number(formId);
    for (const avatar of this.avatars.values()) {
      avatar.setForm(this.options.activeForm);
    }
  }

  setSensitivity(val) {
    this.options.sensitivity = Math.max(0.2, Math.min(3.0, Number(val) || 1.2));
  }

  setScale(scale) {
    this.options.scale = Math.max(0.5, Math.min(2.0, Number(scale) || 1.0));
  }

  setCalibration(cal = {}) {
    if (cal.scale !== undefined) this.setScale(cal.scale);
    if (cal.yOffset !== undefined) this.setYOffset(cal.yOffset);
    if (cal.sensitivity !== undefined) this.setSensitivity(cal.sensitivity);
  }

  setCameraBackground(show) {
    this.options.hasCameraBg = Boolean(show);
  }

  setTestOverlayMode(isTest) {
    this.options.isTestOverlayMode = Boolean(isTest);
    this.setCameraBackground(this.options.isTestOverlayMode);
  }

  updateMultiDancers(trackedDancersMap, collectiveMetrics) {
    const now = performance.now();
    const delta = Math.min((now - this.lastTime) * 0.001, 0.1);
    this.lastTime = now;
    this.elapsedTime += delta;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Reset canvas transform to handle DPR
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Canvas background clearing
    if (this.options.hasCameraBg || this.options.isTestOverlayMode) {
      // Clear transparently so camera video feeds through underneath
      ctx.clearRect(0, 0, w, h);
    } else {
      // Void Stage: Deep exhibition pitch black with subtle motion persistence trail
      ctx.fillStyle = 'rgba(4, 5, 7, 0.35)';
      ctx.fillRect(0, 0, w, h);
    }

    const activeIds = new Set();

    if (trackedDancersMap) {
      for (const [id, dancer] of trackedDancersMap.entries()) {
        const isConfirmed = dancer.isConfirmed !== false;
        const isPresent = dancer.metrics && dancer.metrics.isPresent && !dancer.isExiting;

        if (isConfirmed && isPresent) {
          activeIds.add(id);

          let avatar = this.avatars.get(id);
          if (!avatar) {
            const paletteIndex = ((dancer.colorIndex || 1) - 1) % DANCER_PALETTES.length;
            avatar = new AvatarInstance(id, DANCER_PALETTES[paletteIndex]);
            avatar.setForm(this.options.activeForm);
            this.avatars.set(id, avatar);
          }

          avatar.update(dancer.landmarks, dancer.metrics, {
            time: this.elapsedTime,
            delta,
            sensitivity: this.options.sensitivity,
            scale: this.options.scale,
            yOffset: this.options.isTestOverlayMode ? 0 : this.options.yOffset * 100,
            isTestMode: this.options.isTestOverlayMode
          });

          // Draw avatar
          avatar.render(ctx);
        }
      }
    }

    // Clean up leaving or unconfirmed avatars
    for (const [id, avatar] of this.avatars.entries()) {
      if (!activeIds.has(id)) {
        avatar.collapse(delta);
        if (avatar.isDead()) {
          this.avatars.delete(id);
        } else {
          avatar.render(ctx);
        }
      }
    }
  }
}


/**
 * AVATAR INSTANCE CLASS
 * Manages one discrete dancer's kinetic creature avatar, smoothing, and form switching.
 */
class AvatarInstance {
  constructor(id, palette) {
    this.id = id;
    this.palette = palette;
    this.awakeFactor = 0.0;
    this.currentFormId = 1;

    this.forms = {
      1: new CyberSpine2D(this.palette),
      2: new BioBristle2D(this.palette),
      3: new LiquidRibbon2D(this.palette),
      4: new QuantumLattice2D(this.palette)
    };
  }

  setForm(formId) {
    this.currentFormId = formId;
  }

  update(landmarks, metrics, options) {
    // Smooth wake-up: 0 -> 1 in ~0.2s
    this.awakeFactor += (1.0 - this.awakeFactor) * Math.min(options.delta * 5.0, 1.0);

    const form = this.forms[this.currentFormId];
    if (form && landmarks) {
      form.update(landmarks, metrics, {
        ...options,
        awakeFactor: this.awakeFactor
      });
    }
  }

  collapse(delta) {
    // Fast collapse: 1 -> 0 in ~0.35s
    this.awakeFactor -= delta * 3.2;
  }

  isDead() {
    return this.awakeFactor <= 0.01;
  }

  render(ctx) {
    if (this.awakeFactor <= 0.01) return;
    const form = this.forms[this.currentFormId];
    if (form) {
      ctx.save();
      // Additive blending for vivid, blooming neon aesthetics
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, Math.min(1, this.awakeFactor));
      form.render(ctx);
      ctx.restore();
    }
  }
}


/**
 * FORM 1: CYBER SPINE & RIBS (2D HTML Canvas)
 * Symmetrical mechanical vertebrae column with articulated ribs, kinetic struts, and neon glow.
 */
class CyberSpine2D {
  constructor(palette) {
    this.palette = palette;
    this.spinePoints = [];
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
    this.pulsePhase = 0;
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;
    this.spinePoints = metrics.spinePoints || [];
    this.pulsePhase += params.delta * 4.0;
  }

  render(ctx) {
    const lm = this.landmarks;
    const spine = this.spinePoints;
    if (!lm || lm.length < 33 || !spine || spine.length === 0) return;

    const { time, awakeFactor, sensitivity, isTestMode, yOffset } = this.params;
    const energy = (this.metrics.energy || 0) * sensitivity;
    const pal = this.palette;

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // 1. Draw Mechanical Limbs (Shoulder -> Elbow -> Wrist, Hip -> Knee -> Ankle)
    const limbPairs = [
      [11, 13], [13, 15], // Left Arm
      [12, 14], [14, 16], // Right Arm
      [23, 25], [25, 27], // Left Leg
      [24, 26], [26, 28]  // Right Leg
    ];

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    limbPairs.forEach(([from, to]) => {
      const p1 = lm[from];
      const p2 = lm[to];
      if (!p1 || !p2 || p1.visibility < 0.15 || p2.visibility < 0.15) return;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy);
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);
      const railOffset = 6 * awakeFactor;

      // Dual hydraulic rail struts
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(p1.x + nx * railOffset, p1.y + ny * railOffset);
      ctx.lineTo(p2.x + nx * railOffset, p2.y + ny * railOffset);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x - nx * railOffset, p1.y - ny * railOffset);
      ctx.lineTo(p2.x - nx * railOffset, p2.y - ny * railOffset);
      ctx.stroke();

      // Metallic center rod
      ctx.strokeStyle = pal.core;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Energy sliding sleeve
      const sleeveT = (Math.sin(time * 3 + from) * 0.5 + 0.5);
      const sx = p1.x + dx * sleeveT;
      const sy = p1.y + dy * sleeveT;
      ctx.fillStyle = pal.secondary;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5 * awakeFactor, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Adaptive Shoulder Width for Custom Fit Exoskeleton
    const ls = lm[11];
    const rs = lm[12];
    let shoulderDist = 120;
    if (ls && rs && ls.visibility > 0.1 && rs.visibility > 0.1) {
      shoulderDist = Math.hypot(rs.x - ls.x, rs.y - ls.y);
    }
    const baseSpan = Math.max(60, Math.min(260, shoulderDist * 0.9));

    // 3. Articulated Ribs radiating from Spine
    const ribPairs = 10;
    const flutter = Math.sin(time * 12.0) * energy * 8;

    for (let r = 0; r < ribPairs; r++) {
      const u = (r + 1) / (ribPairs + 2);
      const sIdx = Math.floor(u * (spine.length - 1));
      const pt = spine[sIdx];
      const nextPt = spine[Math.min(sIdx + 1, spine.length - 1)];
      if (!pt || !nextPt) continue;

      const tangentX = nextPt.x - pt.x;
      const tangentY = nextPt.y - pt.y;
      const tLen = Math.hypot(tangentX, tangentY) || 1;
      const perpX = -tangentY / tLen;
      const perpY = tangentX / tLen;

      // Rib taper: wider at chest, tapered at waist
      const taper = Math.sin(u * Math.PI);
      const ribLen = (baseSpan * 0.5 * taper + energy * 25 + flutter) * awakeFactor;
      const curveArch = 18 * taper;

      // Left Rib
      const lx1 = pt.x - perpX * (ribLen * 0.5);
      const ly1 = pt.y - perpY * (ribLen * 0.5) - curveArch;
      const lx2 = pt.x - perpX * ribLen;
      const ly2 = pt.y - perpY * ribLen;

      ctx.strokeStyle = r % 2 === 0 ? pal.primary : pal.secondary;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.quadraticCurveTo(lx1, ly1, lx2, ly2);
      ctx.stroke();

      // Right Rib
      const rx1 = pt.x + perpX * (ribLen * 0.5);
      const ry1 = pt.y + perpY * (ribLen * 0.5) - curveArch;
      const rx2 = pt.x + perpX * ribLen;
      const ry2 = pt.y + perpY * ribLen;

      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.quadraticCurveTo(rx1, ry1, rx2, ry2);
      ctx.stroke();

      // Rib tip glowing node
      ctx.fillStyle = pal.core;
      ctx.beginPath();
      ctx.arc(lx2, ly2, 3, 0, Math.PI * 2);
      ctx.arc(rx2, ry2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Central Vertebrae Spinal Column
    ctx.strokeStyle = pal.primary;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(spine[0].x, spine[0].y);
    for (let i = 1; i < spine.length; i++) {
      ctx.lineTo(spine[i].x, spine[i].y);
    }
    ctx.stroke();

    // Vertebrae discs
    for (let i = 0; i < spine.length; i += 2) {
      const pt = spine[i];
      ctx.fillStyle = pal.core;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5 * awakeFactor, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Articulated Joint Bearings & Concentric Rings
    const majorJoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    majorJoints.forEach(idx => {
      const pt = lm[idx];
      if (!pt || pt.visibility < 0.15) return;

      const radius = (idx === 11 || idx === 12 || idx === 23 || idx === 24) ? 12 : 9;
      ctx.strokeStyle = pal.secondary;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius * awakeFactor, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = pal.core;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, (radius * 0.45) * awakeFactor, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Core Pulsating Reactor at Torso Center
    if (this.metrics.torsoCenter) {
      const tc = this.metrics.torsoCenter;
      const coreR = (16 + energy * 18 + Math.sin(time * 6) * 4) * awakeFactor;

      const grad = ctx.createRadialGradient(tc.x, tc.y, 2, tc.x, tc.y, coreR * 1.5);
      grad.addColorStop(0, pal.core);
      grad.addColorStop(0.4, pal.primary);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, coreR * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Rotating core radar ring
      ctx.strokeStyle = pal.secondary;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, coreR, time * 2, time * 2 + Math.PI * 1.4);
      ctx.stroke();
    }

    ctx.restore();
  }
}


/**
 * FORM 2: BIO BRISTLE (2D HTML Canvas)
 * Living bioluminescent organism with thousands of kinetic quills swaying with momentum.
 */
class BioBristle2D {
  constructor(palette) {
    this.palette = palette;
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;
  }

  render(ctx) {
    const lm = this.landmarks;
    const spine = this.metrics.spinePoints || [];
    if (!lm || lm.length < 33) return;

    const { time, awakeFactor, sensitivity, yOffset } = this.params;
    const energy = (this.metrics.energy || 0) * sensitivity;
    const pal = this.palette;

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // Radiate filaments along spine and limbs
    const segments = [
      [11, 13], [13, 15], [12, 14], [14, 16],
      [23, 25], [25, 27], [24, 26], [26, 28]
    ];

    // Spine quills
    for (let i = 0; i < spine.length; i += 2) {
      const pt = spine[i];
      const count = 7;
      for (let k = 0; k < count; k++) {
        const angle = (k / count) * Math.PI * 2 + Math.sin(time * 3 + i) * 0.4;
        const len = (25 + Math.sin(i * 1.5 + k) * 15 + energy * 30) * awakeFactor;
        const sway = Math.sin(time * 8 + i + k) * (10 + energy * 15);

        const ex = pt.x + Math.cos(angle) * len + sway;
        const ey = pt.y + Math.sin(angle) * len + Math.abs(sway * 0.5);

        ctx.strokeStyle = k % 2 === 0 ? pal.primary : pal.secondary;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.quadraticCurveTo((pt.x + ex) * 0.5 + sway, (pt.y + ey) * 0.5, ex, ey);
        ctx.stroke();

        ctx.fillStyle = pal.core;
        ctx.beginPath();
        ctx.arc(ex, ey, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Limb filaments
    segments.forEach(([from, to]) => {
      const p1 = lm[from];
      const p2 = lm[to];
      if (!p1 || !p2 || p1.visibility < 0.15 || p2.visibility < 0.15) return;

      const steps = 6;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const bx = p1.x + (p2.x - p1.x) * u;
        const by = p1.y + (p2.y - p1.y) * u;

        for (const side of [-1, 1]) {
          const baseAngle = (side * Math.PI * 0.5) + Math.sin(time * 5 + s) * 0.3;
          const bristleLen = (20 + energy * 25 + Math.cos(s * 2 + time * 6) * 8) * awakeFactor;
          const sx = bx + Math.cos(baseAngle) * bristleLen;
          const sy = by + Math.sin(baseAngle) * bristleLen;

          ctx.strokeStyle = pal.primary;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(sx, sy);
          ctx.stroke();

          ctx.fillStyle = pal.secondary;
          ctx.beginPath();
          ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Core pulsing aura
    if (this.metrics.torsoCenter) {
      const tc = this.metrics.torsoCenter;
      ctx.fillStyle = pal.glow;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, (30 + energy * 30) * awakeFactor, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}


/**
 * FORM 3: LIQUID RIBBON (2D HTML Canvas)
 * Calligraphic flowing ribbon streamers tracing hand and body gestures with chromatic trails.
 */
class LiquidRibbon2D {
  constructor(palette) {
    this.palette = palette;
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
    this.history = []; // Array of snapshot joints
    this.maxHistory = 18;
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;

    if (landmarks && landmarks[15] && landmarks[16]) {
      this.history.unshift({
        lw: { x: landmarks[15].x, y: landmarks[15].y },
        rw: { x: landmarks[16].x, y: landmarks[16].y },
        neck: { x: (landmarks[11].x + landmarks[12].x) * 0.5, y: (landmarks[11].y + landmarks[12].y) * 0.5 },
        time: params.time
      });
      if (this.history.length > this.maxHistory) {
        this.history.pop();
      }
    }
  }

  render(ctx) {
    const lm = this.landmarks;
    if (!lm || lm.length < 33 || this.history.length < 3) return;

    const { time, awakeFactor, sensitivity, yOffset } = this.params;
    const energy = (this.metrics.energy || 0) * sensitivity;
    const pal = this.palette;

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // 1. Draw Liquid Hand Streamer Ribbons
    ['lw', 'rw'].forEach((handKey, hIdx) => {
      const pts = this.history.map(h => h[handKey]);
      if (pts.length < 3) return;

      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const u = 1.0 - (i / pts.length);
        const width = (4 + u * (14 + energy * 20)) * awakeFactor;

        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.strokeStyle = hIdx === 0 ? pal.primary : pal.secondary;
        ctx.globalAlpha = u * awakeFactor * 0.85;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // 2. Liquid Skeleton Strands
    const chains = [
      [15, 13, 11, 12, 14, 16], // Arm span
      [27, 25, 23, 24, 26, 28]  // Leg arch
    ];

    chains.forEach(chain => {
      const validPoints = chain.map(idx => lm[idx]).filter(p => p && p.visibility > 0.1);
      if (validPoints.length < 3) return;

      ctx.lineWidth = (3.5 + energy * 6) * awakeFactor;
      ctx.strokeStyle = pal.primary;
      ctx.globalAlpha = 0.75 * awakeFactor;

      ctx.beginPath();
      ctx.moveTo(validPoints[0].x, validPoints[0].y);
      for (let i = 1; i < validPoints.length - 1; i++) {
        const xc = (validPoints[i].x + validPoints[i + 1].x) * 0.5;
        const yc = (validPoints[i].y + validPoints[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(validPoints[i].x, validPoints[i].y, xc, yc);
      }
      ctx.lineTo(validPoints[validPoints.length - 1].x, validPoints[validPoints.length - 1].y);
      ctx.stroke();
    });

    ctx.restore();
  }
}


/**
 * FORM 4: QUANTUM LATTICE (2D HTML Canvas)
 * Geometric kinetic constellation matrix with holographic radar rings and laser filaments.
 */
class QuantumLattice2D {
  constructor(palette) {
    this.palette = palette;
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
    this.radarAngle = 0;
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;
    this.radarAngle += params.delta * 3.5;
  }

  render(ctx) {
    const lm = this.landmarks;
    if (!lm || lm.length < 33) return;

    const { time, awakeFactor, sensitivity, yOffset } = this.params;
    const energy = (this.metrics.energy || 0) * sensitivity;
    const pal = this.palette;

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // 1. Constellation Triangulation Network
    const connections = [
      [0, 11], [0, 12], [11, 12],
      [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [24, 26], [26, 28],
      [15, 23], [16, 24] // Cross kinetic bonds
    ];

    ctx.lineWidth = 1.2;
    connections.forEach(([i1, i2]) => {
      const p1 = lm[i1];
      const p2 = lm[i2];
      if (!p1 || !p2 || p1.visibility < 0.15 || p2.visibility < 0.15) return;

      ctx.strokeStyle = pal.primary;
      ctx.globalAlpha = (0.35 + energy * 0.4) * awakeFactor;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Kinetic spark traveling along bond
      const sparkT = (Math.sin(time * 4 + i1 + i2) * 0.5 + 0.5);
      const sx = p1.x + (p2.x - p1.x) * sparkT;
      const sy = p1.y + (p2.y - p1.y) * sparkT;
      ctx.fillStyle = pal.core;
      ctx.globalAlpha = 0.9 * awakeFactor;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Holographic Radar Rings at Joints
    const keyJoints = [11, 12, 15, 16, 23, 24, 27, 28];
    keyJoints.forEach((idx, jIdx) => {
      const pt = lm[idx];
      if (!pt || pt.visibility < 0.15) return;

      const r1 = (14 + energy * 12) * awakeFactor;
      const r2 = (22 + energy * 18) * awakeFactor;

      ctx.strokeStyle = pal.secondary;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.8 * awakeFactor;

      // Outer dashed radar
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r2, this.radarAngle + jIdx, this.radarAngle + jIdx + Math.PI * 1.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Inner solid ring
      ctx.strokeStyle = pal.primary;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r1, 0, Math.PI * 2);
      ctx.stroke();

      // Center quantum node
      ctx.fillStyle = pal.core;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5 * awakeFactor, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}
