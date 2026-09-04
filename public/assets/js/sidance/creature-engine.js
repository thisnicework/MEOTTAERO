/**
 * SIDANCE ✕ FUTURE YOU - Non-AI Organic Ribbon & Fluid Silk Dynamics Engine
 * Replaces robotic/stick-figure geometry with physics-based silk fabric,
 * multi-strand aurora veils, painterly calligraphy ink strokes, and dynamic cloth drag.
 */

const ARTISTIC_PALETTES = [
  {
    name: 'OPAL_PEARL',
    primary: '#00f0ff',
    secondary: '#ff2a8d',
    core: '#ffffff',
    sheen: '#bbf7d0',
    glow: 'rgba(0, 240, 255, 0.45)',
    ink: 'rgba(0, 240, 255, 0.85)'
  },
  {
    name: 'CHAMPAGNE_GOLD',
    primary: '#ffe66d',
    secondary: '#00ff88',
    core: '#ffffff',
    sheen: '#ffaa44',
    glow: 'rgba(255, 230, 109, 0.45)',
    ink: 'rgba(255, 220, 80, 0.85)'
  },
  {
    name: 'MIDNIGHT_IRIS',
    primary: '#b366ff',
    secondary: '#ff477e',
    core: '#ffffff',
    sheen: '#e0b0ff',
    glow: 'rgba(179, 102, 255, 0.45)',
    ink: 'rgba(179, 102, 255, 0.85)'
  },
  {
    name: 'TITANIUM_SILK',
    primary: '#ffffff',
    secondary: '#00a2ff',
    core: '#70ffe5',
    sheen: '#dbeafe',
    glow: 'rgba(255, 255, 255, 0.5)',
    ink: 'rgba(255, 255, 255, 0.9)'
  }
];

export class CreatureEngine {
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      activeForm: 1, // Default: Form 1 (Silk Flow)
      scale: 1.0,
      yOffset: 0.0,
      sensitivity: 1.2,
      isTestOverlayMode: true,
      hasCameraBg: true
    }, options);

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'sidance-organic-canvas';
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

    this.avatars = new Map(); // slotId -> OrganicAvatarInstance
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

  setYOffset(offset) {
    this.options.yOffset = Number(offset) || 0.0;
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
    const delta = Math.min((now - this.lastTime) * 0.001, 0.066);
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
      // Void Stage: Deep gallery black with gentle motion persistence for liquid silk trails
      ctx.fillStyle = 'rgba(5, 6, 8, 0.28)';
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
            const paletteIndex = ((dancer.colorIndex || 1) - 1) % ARTISTIC_PALETTES.length;
            avatar = new OrganicAvatarInstance(id, ARTISTIC_PALETTES[paletteIndex]);
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

          // Render avatar
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
 * ORGANIC AVATAR INSTANCE CLASS
 * Manages one discrete dancer's fluid ribbon physics, particle embers, and organic forms.
 */
class OrganicAvatarInstance {
  constructor(id, palette) {
    this.id = id;
    this.palette = palette;
    this.awakeFactor = 0.0;
    this.currentFormId = 1;

    // Floating Stardust Embers / Ink Sprinkles
    this.particles = [];
    this.maxParticles = 65;

    // The 4 Curated Non-AI Dance Art Forms
    this.forms = {
      1: new SilkFlowForm(this.palette),      // Form 1: Wide Satin Silk Ribbons & Cloth Physics
      2: new AuroraVeilForm(this.palette),     // Form 2: Multi-Strand Ethereal Gossamer Veils
      3: new FluidInkForm(this.palette),       // Form 3: Contemporary Korean Calligraphy Ink Strokes
      4: new CosmicYarnForm(this.palette)      // Form 4: Kinetic Woven Thread Loom & Sculptural Contour
    };
  }

  setForm(formId) {
    this.currentFormId = formId;
  }

  update(landmarks, metrics, options) {
    this.awakeFactor += (1.0 - this.awakeFactor) * Math.min(options.delta * 4.5, 1.0);

    // Particle shedding on sudden acceleration
    const energy = (metrics.energy || 0) * options.sensitivity;
    if (energy > 0.4 && Math.random() < 0.65 && landmarks[15] && landmarks[16]) {
      const source = Math.random() < 0.5 ? landmarks[15] : landmarks[16];
      if (source && source.visibility > 0.1) {
        this.particles.push({
          x: source.x + (Math.random() - 0.5) * 20,
          y: source.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 45,
          vy: -15 - Math.random() * 35,
          radius: 1.5 + Math.random() * 2.5,
          alpha: 0.9,
          decay: 0.4 + Math.random() * 0.5
        });
        if (this.particles.length > this.maxParticles) {
          this.particles.shift();
        }
      }
    }

    // Update floating particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * options.delta;
      p.y += p.vy * options.delta;
      p.vx *= 0.96;
      p.vy += 25 * options.delta; // gentle gravity
      p.alpha -= p.decay * options.delta;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }

    const form = this.forms[this.currentFormId];
    if (form && landmarks) {
      form.update(landmarks, metrics, {
        ...options,
        awakeFactor: this.awakeFactor
      });
    }
  }

  collapse(delta) {
    this.awakeFactor -= delta * 3.0;
  }

  isDead() {
    return this.awakeFactor <= 0.01;
  }

  render(ctx) {
    if (this.awakeFactor <= 0.01) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.max(0, Math.min(1, this.awakeFactor));

    // Render floating embers
    const pal = this.palette;
    this.particles.forEach(p => {
      ctx.fillStyle = pal.primary;
      ctx.globalAlpha = p.alpha * this.awakeFactor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    const form = this.forms[this.currentFormId];
    if (form) {
      form.render(ctx);
    }

    ctx.restore();
  }
}


/**
 * PHYSICAL RIBBON CHAIN (Spring-Damper Chain)
 * Real-time cloth/streamer physics with air resistance, inertia, and wave undulation.
 */
class RibbonChain {
  constructor(nodeCount = 28, segmentLength = 12) {
    this.nodeCount = nodeCount;
    this.segmentLength = segmentLength;
    this.nodes = [];
    this.isInitialized = false;
  }

  update(anchorX, anchorY, time, energy, delta) {
    if (!this.isInitialized) {
      for (let i = 0; i < this.nodeCount; i++) {
        this.nodes.push({
          x: anchorX,
          y: anchorY + i * this.segmentLength,
          vx: 0,
          vy: 0
        });
      }
      this.isInitialized = true;
      return;
    }

    // Node 0 follows anchor directly
    this.nodes[0].x = anchorX;
    this.nodes[0].y = anchorY;

    const drag = 0.91; // Air resistance
    const gravity = 25; // Gentle cloth drape

    for (let i = 1; i < this.nodeCount; i++) {
      const node = this.nodes[i];
      const prev = this.nodes[i - 1];

      // Undulating aerodynamic flutter wave
      const flutterPhase = time * 6.0 + i * 0.38;
      const waveFreq = Math.sin(flutterPhase) * (1.8 + energy * 8.5);

      // Distance and spring constraint to previous node
      const dx = prev.x - node.x;
      const dy = prev.y - node.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      const tension = (dist - this.segmentLength) * 0.45;
      const tx = (dx / dist) * tension;
      const ty = (dy / dist) * tension;

      node.vx = (node.vx + tx) * drag;
      node.vy = (node.vy + ty + gravity * delta) * drag;

      // Apply transverse wave flutter
      const nx = -dy / dist;
      const ny = dx / dist;

      node.x += node.vx + nx * waveFreq * delta * 12;
      node.y += node.vy + ny * waveFreq * delta * 12;

      // Distance clamping
      const newDx = node.x - prev.x;
      const newDy = node.y - prev.y;
      const newDist = Math.hypot(newDx, newDy) || 0.001;
      const maxDist = this.segmentLength * 1.5;
      if (newDist > maxDist) {
        node.x = prev.x + (newDx / newDist) * maxDist;
        node.y = prev.y + (newDy / newDist) * maxDist;
      }
    }
  }
}


/**
 * ============================================================================
 * FORM 1: SILK FLOW (와이드 새틴 실크 플로우)
 * Volumetric double-edged satin ribbons billowing with fluid cloth physics,
 * draping around wrists, spine, and feet without robotic lines.
 * ============================================================================
 */
class SilkFlowForm {
  constructor(palette) {
    this.palette = palette;
    this.leftHandRibbon = new RibbonChain(34, 14);
    this.rightHandRibbon = new RibbonChain(34, 14);
    this.spineRibbon = new RibbonChain(26, 15);
    this.leftFootRibbon = new RibbonChain(22, 13);
    this.rightFootRibbon = new RibbonChain(22, 13);
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;

    const { time, delta } = params;
    const energy = (metrics.energy || 0) * params.sensitivity;

    // Update Physics Ribbon Chains attached to key dancer joints
    if (landmarks[15] && landmarks[15].visibility > 0.1) {
      this.leftHandRibbon.update(landmarks[15].x, landmarks[15].y, time, energy, delta);
    }
    if (landmarks[16] && landmarks[16].visibility > 0.1) {
      this.rightHandRibbon.update(landmarks[16].x, landmarks[16].y, time + 0.4, energy, delta);
    }
    if (metrics.torsoCenter) {
      this.spineRibbon.update(metrics.torsoCenter.x, metrics.torsoCenter.y, time + 0.8, energy, delta);
    }
    if (landmarks[27] && landmarks[27].visibility > 0.1) {
      this.leftFootRibbon.update(landmarks[27].x, landmarks[27].y, time + 1.2, energy, delta);
    }
    if (landmarks[28] && landmarks[28].visibility > 0.1) {
      this.rightFootRibbon.update(landmarks[28].x, landmarks[28].y, time + 1.6, energy, delta);
    }
  }

  _renderVolumetricRibbon(ctx, ribbonChain, baseWidth, color1, color2) {
    const nodes = ribbonChain.nodes;
    if (!nodes || nodes.length < 3) return;

    const { awakeFactor, time } = this.params;
    const energy = (this.metrics.energy || 0) * (this.params.sensitivity || 1.2);

    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      const u1 = 1.0 - (i / nodes.length);
      const u2 = 1.0 - ((i + 1) / nodes.length);

      // Ribbon twist modulation: simulated 3D folding
      const twist1 = Math.cos(i * 0.2 + time * 2.5);
      const twist2 = Math.cos((i + 1) * 0.2 + time * 2.5);

      const w1 = (baseWidth * u1 + energy * 18) * Math.abs(twist1) * awakeFactor;
      const w2 = (baseWidth * u2 + energy * 18) * Math.abs(twist2) * awakeFactor;

      // Left & Right Edges of Ribbon Surface
      const l1 = { x: p1.x - nx * w1, y: p1.y - ny * w1 };
      const r1 = { x: p1.x + nx * w1, y: p1.y + ny * w1 };
      const l2 = { x: p2.x - nx * w2, y: p2.y - ny * w2 };
      const r2 = { x: p2.x + nx * w2, y: p2.y + ny * w2 };

      // Volumetric translucent silk quad fill
      const grad = ctx.createLinearGradient(l1.x, l1.y, r1.x, r1.y);
      if (twist1 > 0) {
        grad.addColorStop(0, color1);
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, color2);
      } else {
        // Inverted sheen on ribbon underside twist
        grad.addColorStop(0, color2);
        grad.addColorStop(0.5, '#ffffff');
        grad.addColorStop(1, color1);
      }

      ctx.fillStyle = grad;
      ctx.globalAlpha = u1 * 0.75 * awakeFactor;
      ctx.beginPath();
      ctx.moveTo(l1.x, l1.y);
      ctx.lineTo(r1.x, r1.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.lineTo(l2.x, l2.y);
      ctx.closePath();
      ctx.fill();

      // Glowing silk edge seam line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2 * u1;
      ctx.globalAlpha = u1 * 0.9 * awakeFactor;
      ctx.beginPath();
      ctx.moveTo(l1.x, l1.y);
      ctx.lineTo(l2.x, l2.y);
      ctx.moveTo(r1.x, r1.y);
      ctx.lineTo(r2.x, r2.y);
      ctx.stroke();
    }
  }

  render(ctx) {
    const lm = this.landmarks;
    if (!lm || lm.length < 33) return;

    const { yOffset, awakeFactor, time } = this.params;
    const pal = this.palette;
    const energy = (this.metrics.energy || 0) * (this.params.sensitivity || 1.2);

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // 1. Draped Silk Ribbons on Hand Streamers (Left & Right)
    this._renderVolumetricRibbon(ctx, this.leftHandRibbon, 28, pal.primary, pal.secondary);
    this._renderVolumetricRibbon(ctx, this.rightHandRibbon, 28, pal.secondary, pal.primary);

    // 2. Trailing Silk Ribbons on Feet (Left & Right)
    this._renderVolumetricRibbon(ctx, this.leftFootRibbon, 22, pal.sheen, pal.primary);
    this._renderVolumetricRibbon(ctx, this.rightFootRibbon, 22, pal.sheen, pal.secondary);

    // 3. Torso Silk Cocoon Draping (Organic curving bands connecting shoulders, chest, and hips)
    const ls = lm[11];
    const rs = lm[12];
    const lh = lm[23];
    const rh = lm[24];

    if (ls && rs && lh && rh && ls.visibility > 0.1 && rs.visibility > 0.1) {
      const chestBands = 7;
      for (let b = 0; b < chestBands; b++) {
        const t = b / (chestBands - 1);
        const wave = Math.sin(time * 4 + b) * (8 + energy * 12);

        // Smooth draping curves from left shoulder/hip to right shoulder/hip
        const pL = { x: ls.x + (lh.x - ls.x) * t, y: ls.y + (lh.y - ls.y) * t };
        const pR = { x: rs.x + (rh.x - rs.x) * t, y: rs.y + (rh.y - rs.y) * t };
        const cX = (pL.x + pR.x) * 0.5 + wave;
        const cY = (pL.y + pR.y) * 0.5 + 15 * Math.sin(t * Math.PI);

        ctx.strokeStyle = b % 2 === 0 ? pal.primary : pal.secondary;
        ctx.lineWidth = (3.5 + (1 - Math.abs(t - 0.5) * 2) * 5 + energy * 4) * awakeFactor;
        ctx.globalAlpha = (0.55 + Math.sin(time * 3 + b) * 0.25) * awakeFactor;

        ctx.beginPath();
        ctx.moveTo(pL.x, pL.y);
        ctx.quadraticCurveTo(cX, cY, pR.x, pR.y);
        ctx.stroke();
      }
    }

    // 4. Soft Silk Core Aura at Torso Center
    if (this.metrics.torsoCenter) {
      const tc = this.metrics.torsoCenter;
      const auraR = (35 + energy * 40 + Math.sin(time * 5) * 6) * awakeFactor;

      const grad = ctx.createRadialGradient(tc.x, tc.y, 2, tc.x, tc.y, auraR);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, pal.primary);
      grad.addColorStop(0.7, pal.secondary);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.55 * awakeFactor;
      ctx.beginPath();
      ctx.arc(tc.x, tc.y, auraR, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}


/**
 * ============================================================================
 * FORM 2: AURORA VEIL (다중 오로라 베일)
 * Hundreds of ethereal gossamer light strands weaving fluid light veils
 * following dancer limbs and spine, inspired by northern lights.
 * ============================================================================
 */
class AuroraVeilForm {
  constructor(palette) {
    this.palette = palette;
    this.strandChains = [];
    this.strandCount = 6;
    // Multiple strands trailing each hand
    for (let i = 0; i < this.strandCount; i++) {
      this.strandChains.push({
        left: new RibbonChain(26, 12),
        right: new RibbonChain(26, 12),
        phaseOffset: i * 0.45
      });
    }
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;

    const { time, delta } = params;
    const energy = (metrics.energy || 0) * params.sensitivity;

    if (landmarks[15] && landmarks[16]) {
      this.strandChains.forEach((strand, idx) => {
        const spread = (idx - this.strandCount * 0.5) * 6;
        if (landmarks[15].visibility > 0.1) {
          strand.left.update(landmarks[15].x + spread, landmarks[15].y, time + strand.phaseOffset, energy, delta);
        }
        if (landmarks[16].visibility > 0.1) {
          strand.right.update(landmarks[16].x - spread, landmarks[16].y, time + strand.phaseOffset + 0.3, energy, delta);
        }
      });
    }
  }

  render(ctx) {
    const lm = this.landmarks;
    if (!lm || lm.length < 33) return;

    const { yOffset, awakeFactor, time } = this.params;
    const pal = this.palette;
    const energy = (this.metrics.energy || 0) * (this.params.sensitivity || 1.2);

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // Render multi-strand aurora light filaments
    this.strandChains.forEach((strand, sIdx) => {
      ['left', 'right'].forEach(side => {
        const chain = strand[side];
        const nodes = chain.nodes;
        if (!nodes || nodes.length < 3) return;

        ctx.lineWidth = (2.2 + (sIdx % 2) * 1.5 + energy * 3) * awakeFactor;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = sIdx % 2 === 0 ? pal.primary : pal.secondary;

        ctx.beginPath();
        ctx.moveTo(nodes[0].x, nodes[0].y);
        for (let i = 1; i < nodes.length - 1; i++) {
          const xc = (nodes[i].x + nodes[i + 1].x) * 0.5;
          const yc = (nodes[i].y + nodes[i + 1].y) * 0.5;
          ctx.quadraticCurveTo(nodes[i].x, nodes[i].y, xc, yc);
        }
        ctx.lineTo(nodes[nodes.length - 1].x, nodes[nodes.length - 1].y);

        ctx.globalAlpha = (0.45 + (1 - sIdx / this.strandCount) * 0.45) * awakeFactor;
        ctx.stroke();

        // Tip glowing light droplet
        const lastNode = nodes[nodes.length - 1];
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8 * awakeFactor;
        ctx.beginPath();
        ctx.arc(lastNode.x, lastNode.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // Aurora limb connecting streams (shoulders to hands)
    const streamPairs = [
      [11, 13, 15], // Left Arm
      [12, 14, 16], // Right Arm
      [23, 25, 27], // Left Leg
      [24, 26, 28]  // Right Leg
    ];

    streamPairs.forEach(([p1Idx, p2Idx, p3Idx]) => {
      const p1 = lm[p1Idx];
      const p2 = lm[p2Idx];
      const p3 = lm[p3Idx];
      if (!p1 || !p2 || !p3 || p1.visibility < 0.15 || p3.visibility < 0.15) return;

      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = (4.0 + energy * 6) * awakeFactor;
      ctx.globalAlpha = 0.7 * awakeFactor;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.quadraticCurveTo(p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();
    });

    ctx.restore();
  }
}


/**
 * ============================================================================
 * FORM 3: FLUID INK (수묵 키네틱)
 * Contemporary Korean sumi-e / calligraphy brush dynamics.
 * Strokes swell with deceleration, taper with rapid flickers, and shed ink embers.
 * ============================================================================
 */
class FluidInkForm {
  constructor(palette) {
    this.palette = palette;
    this.inkHistory = [];
    this.maxHistory = 32;
    this.splatters = [];
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;

    const lw = landmarks[15];
    const rw = landmarks[16];
    const energy = (metrics.energy || 0) * params.sensitivity;

    if (lw && rw && lw.visibility > 0.15 && rw.visibility > 0.15) {
      this.inkHistory.unshift({
        lw: { x: lw.x, y: lw.y },
        rw: { x: rw.x, y: rw.y },
        energy: energy,
        time: params.time
      });
      if (this.inkHistory.length > this.maxHistory) {
        this.inkHistory.pop();
      }

      // Ink splatter droplets on violent acceleration
      if (energy > 0.65 && Math.random() < 0.45) {
        for (let k = 0; k < 3; k++) {
          this.splatters.push({
            x: lw.x + (Math.random() - 0.5) * 30,
            y: lw.y + (Math.random() - 0.5) * 30,
            radius: 2 + Math.random() * 4,
            alpha: 1.0,
            life: 0.8
          });
        }
      }
    }

    // Decay ink splatters
    for (let i = this.splatters.length - 1; i >= 0; i--) {
      this.splatters[i].alpha -= params.delta * 1.5;
      if (this.splatters[i].alpha <= 0) {
        this.splatters.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (this.inkHistory.length < 3) return;

    const { yOffset, awakeFactor } = this.params;
    const pal = this.palette;

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // Draw fluid calligraphic sumi ink brush strokes
    ['lw', 'rw'].forEach((key, kIdx) => {
      for (let i = 0; i < this.inkHistory.length - 1; i++) {
        const p1 = this.inkHistory[i][key];
        const p2 = this.inkHistory[i + 1][key];
        const u = 1.0 - (i / this.inkHistory.length);

        // Brush stroke width: swells with low velocity, sharpens with high speed
        const speed = this.inkHistory[i].energy;
        const brushWidth = (6 + u * 24 + (1.0 / (speed + 0.5)) * 8) * awakeFactor;

        ctx.lineWidth = brushWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Calligraphic gradient: sumi ink fading into neon edge
        ctx.strokeStyle = kIdx === 0 ? pal.primary : pal.secondary;
        ctx.globalAlpha = u * 0.85 * awakeFactor;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Inner velvet ink core
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = brushWidth * 0.35;
        ctx.globalAlpha = u * 0.95 * awakeFactor;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    // Render ink splatters
    this.splatters.forEach(s => {
      ctx.fillStyle = pal.primary;
      ctx.globalAlpha = s.alpha * awakeFactor;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}


/**
 * ============================================================================
 * FORM 4: COSMIC YARN (코스믹 얀 / 키네틱 직조)
 * Sculptural kinetic woven threads wrapping around the dancer's volumetric silhouette.
 * ============================================================================
 */
class CosmicYarnForm {
  constructor(palette) {
    this.palette = palette;
    this.landmarks = [];
    this.metrics = {};
    this.params = {};
    this.helixPhase = 0;
  }

  update(landmarks, metrics, params) {
    this.landmarks = landmarks;
    this.metrics = metrics;
    this.params = params;
    this.helixPhase += params.delta * 3.8;
  }

  render(ctx) {
    const lm = this.landmarks;
    if (!lm || lm.length < 33) return;

    const { yOffset, awakeFactor, time } = this.params;
    const pal = this.palette;
    const energy = (this.metrics.energy || 0) * (this.params.sensitivity || 1.2);

    ctx.save();
    if (yOffset) ctx.translate(0, yOffset);

    // Volumetric spiral yarn winding along limbs
    const limbs = [
      [11, 13, 15], // Left Arm
      [12, 14, 16], // Right Arm
      [23, 25, 27], // Left Leg
      [24, 26, 28]  // Right Leg
    ];

    limbs.forEach(([j1, j2, j3]) => {
      const p1 = lm[j1];
      const p3 = lm[j3];
      if (!p1 || !p3 || p1.visibility < 0.15 || p3.visibility < 0.15) return;

      const segments = 22;
      const dx = p3.x - p1.x;
      const dy = p3.y - p1.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = -dy / dist;
      const ny = dx / dist;

      ctx.lineWidth = 2.0;
      for (let side of [-1, 1]) {
        ctx.strokeStyle = side === 1 ? pal.primary : pal.secondary;
        ctx.globalAlpha = 0.8 * awakeFactor;

        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
          const u = s / segments;
          const spiral = Math.sin(u * Math.PI * 6 + this.helixPhase * side) * (18 + energy * 15) * awakeFactor;
          const px = p1.x + dx * u + nx * spiral;
          const py = p1.y + dy * u + ny * spiral;

          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    });

    // Cosmic Yarn Torso Lattice (woven threads across chest & spine)
    const spine = this.metrics.spinePoints || [];
    if (spine.length > 5) {
      for (let i = 0; i < spine.length - 1; i += 2) {
        const pt = spine[i];
        const span = (45 + Math.sin(i * 0.8 + time * 3) * 25 + energy * 30) * awakeFactor;

        ctx.strokeStyle = i % 4 === 0 ? pal.sheen : pal.primary;
        ctx.lineWidth = 1.6;
        ctx.globalAlpha = 0.7 * awakeFactor;

        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, span, span * 0.35, Math.sin(time + i) * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
