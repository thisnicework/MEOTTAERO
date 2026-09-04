/**
 * SIDANCE ✕ FUTURE YOU - Multi-Avatar 3D Creature Engine
 * High-performance WebGL2 procedural multi-avatar rendering with UnrealBloom post-processing.
 * Manages multiple simultaneous Future You creature instances (1~6 dancers) with
 * individual color palettes, independent wake/collapse physics, and 4 morphing forms.
 */

// Color Palettes for Multi-Dancer Distinction
const DANCER_PALETTES = [
  {
    name: 'Cyber Cyan & Magenta',
    primary: 0x00f0ff,
    accent: 0xff0066,
    metal: 0x1e293b,
    chrome: 0xe2e8f0,
    trail: 0x00f0ff
  },
  {
    name: 'Solar Amber & Gold',
    primary: 0xffaa00,
    accent: 0xff3300,
    metal: 0x271a00,
    chrome: 0xffe8b3,
    trail: 0xffbb00
  },
  {
    name: 'Ultraviolet & Mint',
    primary: 0xaa00ff,
    accent: 0x00ffaa,
    metal: 0x1e102d,
    chrome: 0xe9d5ff,
    trail: 0xaa00ff
  },
  {
    name: 'Laser Crimson & Acid',
    primary: 0xff0033,
    accent: 0x00ff66,
    metal: 0x260a0a,
    chrome: 0xfecdd3,
    trail: 0xff0055
  }
];

export class CreatureEngine {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.options = Object.assign({
      scale: 1.0,
      yOffset: -0.1,
      sensitivity: 1.2,
      activeForm: 1, // 1: Cyber Spine, 2: Bio Bristle, 3: Liquid Ribbon, 4: Quantum
    }, options);

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    this.bloomPass = null;

    // Multi-Avatar Map: personId -> AvatarInstance
    this.avatars = new Map();
    this.rootGroup = null;

    // Time & clock
    this.clock = new THREE.Clock();
    this.elapsedTime = 0;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x040507, 0.07);

    // 2. Camera (Vertical 9:16 optimized)
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    this.camera.position.set(0, 0.0, 4.6);

    // 3. WebGL Renderer (alpha: true enables camera background video overlay)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x040507, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // 4. UnrealBloom Post-Processing
    this._setupPostProcessing(width, height);

    // 5. Lighting
    this._setupLighting();

    // 6. Multi-Avatar Root Group
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onResize());
  }

  _setupLighting() {
    const ambient = new THREE.AmbientLight(0x0e1726, 1.2);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(2, 5, 3);
    this.scene.add(dirLight);

    const rimL = new THREE.PointLight(0x00f0ff, 2.0, 10);
    rimL.position.set(-4, 2, -2);
    this.scene.add(rimL);

    const rimR = new THREE.PointLight(0xff0077, 2.0, 10);
    rimR.position.set(4, 2, -2);
    this.scene.add(rimR);
  }

  _setupPostProcessing(width, height) {
    if (!window.THREE || !window.THREE.EffectComposer) {
      console.warn('EffectComposer not found, falling back to standard render');
      return;
    }

    const renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(width, height),
      1.2,  // bloom strength
      0.45, // radius
      0.2   // threshold
    );

    this.composer = new THREE.EffectComposer(this.renderer);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.bloomPass);
  }

  setForm(formId) {
    this.options.activeForm = Number(formId);
    for (const avatar of this.avatars.values()) {
      avatar.setForm(this.options.activeForm);
    }
  }

  setCalibration({ scale, yOffset, sensitivity }) {
    if (scale !== undefined) this.options.scale = scale;
    if (yOffset !== undefined) this.options.yOffset = yOffset;
    if (sensitivity !== undefined) this.options.sensitivity = sensitivity;
  }

  setCameraBackground(isOverlayActive) {
    if (isOverlayActive) {
      this.renderer.setClearColor(0x000000, 0.0);
      if (this.scene.fog) this.scene.fog.density = 0.0;
    } else {
      this.renderer.setClearColor(0x040507, 1.0);
      if (this.scene.fog) this.scene.fog.density = 0.07;
    }
  }

  updateMultiDancers(trackedDancersMap, collectiveMetrics) {
    const delta = this.clock.getDelta();
    this.elapsedTime += delta;

    // Apply global vertical offset & base scale
    this.rootGroup.position.set(0, this.options.yOffset, 0);

    const activeIds = new Set();

    if (trackedDancersMap) {
      for (const [id, dancer] of trackedDancersMap.entries()) {
        activeIds.add(id);

        let avatar = this.avatars.get(id);
        if (!avatar) {
          const paletteIndex = ((dancer.colorIndex || 1) - 1) % DANCER_PALETTES.length;
          avatar = new AvatarInstance(id, DANCER_PALETTES[paletteIndex], this.rootGroup);
          avatar.setForm(this.options.activeForm);
          this.avatars.set(id, avatar);
        }

        avatar.update(dancer.landmarks, dancer.metrics, {
          time: this.elapsedTime,
          delta,
          sensitivity: this.options.sensitivity,
          baseScale: this.options.scale,
          isExiting: dancer.isExiting
        });
      }
    }

    // Clean up avatars whose dancers have left
    for (const [id, avatar] of this.avatars.entries()) {
      if (!activeIds.has(id)) {
        avatar.collapse(delta);
        if (avatar.isDead()) {
          avatar.dispose(this.rootGroup);
          this.avatars.delete(id);
        }
      }
    }

    // Render 4K Scene
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }
}


/**
 * ============================================================================
 * AVATAR INSTANCE CLASS
 * Represents one discrete dancer's Future You avatar in 3D space with its own
 * position, color palette, lifecycle (wake/collapse), and 4 creature forms.
 * ============================================================================
 */
class AvatarInstance {
  constructor(id, palette, parentGroup) {
    this.id = id;
    this.palette = palette;
    this.group = new THREE.Group();
    parentGroup.add(this.group);

    this.awakeFactor = 0.0; // 0 (asleep) -> 1 (fully awake)
    this.currentFormId = 1;

    // Dynamic light on dancer's core
    this.coreLight = new THREE.PointLight(this.palette.primary, 1.8, 4.5);
    this.group.add(this.coreLight);

    // Initialize the 4 forms with this dancer's palette
    this.forms = {
      1: new CyberSpineForm(this.palette),
      2: new BioBristleForm(this.palette),
      3: new LiquidRibbonForm(this.palette),
      4: new QuantumLatticeForm(this.palette)
    };

    Object.values(this.forms).forEach(f => {
      this.group.add(f.root);
      f.setVisible(false);
    });
  }

  setForm(formId) {
    this.currentFormId = formId;
    Object.entries(this.forms).forEach(([id, f]) => {
      f.setVisible(Number(id) === this.currentFormId);
    });
  }

  update(landmarks, metrics, { time, delta, sensitivity, baseScale, isExiting }) {
    // Smooth wake-up or exit-collapse
    const targetAwake = isExiting ? 0.0 : 1.0;
    this.awakeFactor += (targetAwake - this.awakeFactor) * (delta * 3.2);

    const s = baseScale * this.awakeFactor;
    this.group.scale.set(s, s, s);

    // Core light position & pulse
    if (metrics.torsoCenter) {
      this.coreLight.position.set(
        metrics.torsoCenter.x,
        metrics.torsoCenter.y,
        metrics.torsoCenter.z + 0.3
      );
      this.coreLight.intensity = (1.0 + (metrics.energy || 0) * 2.0) * this.awakeFactor;
    }

    const currentForm = this.forms[this.currentFormId];
    if (currentForm && landmarks) {
      currentForm.update(landmarks, metrics, {
        time,
        delta,
        awakeFactor: this.awakeFactor,
        sensitivity
      });
    }
  }

  collapse(delta) {
    this.awakeFactor -= delta * 2.5;
    const s = Math.max(0, this.awakeFactor);
    this.group.scale.set(s, s, s);
  }

  isDead() {
    return this.awakeFactor <= 0.01;
  }

  dispose(parentGroup) {
    parentGroup.remove(this.group);
  }
}


/**
 * ============================================================================
 * FORM 1: CYBER SPINE & RIBS (Multi-Dancer Palette Aware)
 * ============================================================================
 */
class CyberSpineForm {
  constructor(palette) {
    this.root = new THREE.Group();
    this.palette = palette;
    this.vertebraeCount = 20;
    this.vertebraeMeshes = [];
    this.ribMeshes = [];

    this.metalMaterial = new THREE.MeshStandardMaterial({
      color: palette.metal,
      metalness: 0.95,
      roughness: 0.2
    });

    this.chromeMaterial = new THREE.MeshStandardMaterial({
      color: palette.chrome,
      metalness: 0.98,
      roughness: 0.12
    });

    this.primaryNeon = new THREE.MeshBasicMaterial({ color: palette.primary });
    this.accentNeon = new THREE.MeshBasicMaterial({ color: palette.accent });

    this._buildSpineAndRibs();
    this._buildLimbs();
    this._buildCore();
  }

  setVisible(v) {
    this.root.visible = v;
  }

  _buildSpineAndRibs() {
    const spineGroup = new THREE.Group();

    for (let i = 0; i < this.vertebraeCount; i++) {
      const vGeom = new THREE.CylinderGeometry(0.04, 0.05, 0.03, 14);
      const vMesh = new THREE.Mesh(vGeom, this.metalMaterial);

      const ringGeom = new THREE.TorusGeometry(0.045, 0.007, 8, 20);
      const ringMesh = new THREE.Mesh(ringGeom, this.primaryNeon);
      vMesh.add(ringMesh);

      spineGroup.add(vMesh);
      this.vertebraeMeshes.push(vMesh);

      if (i >= 3 && i <= 15) {
        const ribPair = { left: null, right: null, baseSpan: 0.12 + (1.0 - Math.abs(i - 9) / 6.5) * 0.2 };
        const ribGeom = new THREE.BoxGeometry(0.018, 0.012, 0.22);

        const leftRib = new THREE.Mesh(ribGeom, this.chromeMaterial);
        const rightRib = new THREE.Mesh(ribGeom, this.chromeMaterial);

        const tipGeom = new THREE.SphereGeometry(0.016, 8, 8);
        const tipL = new THREE.Mesh(tipGeom, this.accentNeon);
        tipL.position.z = 0.11;
        leftRib.add(tipL);

        const tipR = new THREE.Mesh(tipGeom, this.accentNeon);
        tipR.position.z = 0.11;
        rightRib.add(tipR);

        vMesh.add(leftRib);
        vMesh.add(rightRib);

        ribPair.left = leftRib;
        ribPair.right = rightRib;
        this.ribMeshes.push(ribPair);
      }
    }

    this.root.add(spineGroup);
  }

  _buildLimbs() {
    this.limbSegments = [
      { from: 11, to: 13 }, { from: 13, to: 15 },
      { from: 12, to: 14 }, { from: 14, to: 16 },
      { from: 23, to: 25 }, { from: 25, to: 27 },
      { from: 24, to: 26 }, { from: 26, to: 28 }
    ];

    this.limbMeshes = this.limbSegments.map(() => {
      const group = new THREE.Group();
      const cylGeom = new THREE.CylinderGeometry(0.03, 0.04, 1.0, 10);
      const cylMesh = new THREE.Mesh(cylGeom, this.metalMaterial);
      cylMesh.position.y = 0.5;
      group.add(cylMesh);

      const ringGeom = new THREE.CylinderGeometry(0.048, 0.048, 0.18, 10);
      const ringMesh = new THREE.Mesh(ringGeom, this.chromeMaterial);
      ringMesh.position.y = 0.5;
      group.add(ringMesh);

      const jointGeom = new THREE.SphereGeometry(0.058, 12, 12);
      const jointMesh = new THREE.Mesh(jointGeom, this.primaryNeon);
      group.add(jointMesh);

      this.root.add(group);
      return { group, cylMesh, ringMesh };
    });
  }

  _buildCore() {
    this.coreGroup = new THREE.Group();
    const coreSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 16, 16),
      this.primaryNeon
    );
    this.coreGroup.add(coreSphere);

    for (let r = 1; r <= 3; r++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.1 * r, 0.005, 6, 24),
        this.chromeMaterial
      );
      this.coreGroup.add(ring);
    }

    this.root.add(this.coreGroup);
  }

  update(landmarks, metrics, { time, delta, awakeFactor, sensitivity }) {
    if (!metrics.spinePoints || metrics.spinePoints.length === 0) return;

    const spine = metrics.spinePoints;
    const energy = (metrics.energy || 0) * sensitivity;

    for (let i = 0; i < this.vertebraeMeshes.length; i++) {
      const mesh = this.vertebraeMeshes[i];
      const pIdx = Math.min(i, spine.length - 1);
      const pt = spine[pIdx];

      mesh.position.set(pt.x, pt.y, pt.z);
      if (pIdx < spine.length - 1) {
        const next = spine[pIdx + 1];
        mesh.lookAt(next.x, next.y, next.z);
        mesh.rotateX(Math.PI * 0.5);
      }
    }

    const ribFlutter = Math.sin(time * 12.0) * energy * 0.15;
    const ribSpread = (1.0 + energy * 0.85) * awakeFactor;

    this.ribMeshes.forEach(ribPair => {
      const span = ribPair.baseSpan * ribSpread;
      const angle = (0.55 + ribFlutter) * awakeFactor;

      ribPair.left.position.set(-span * 0.8, 0, span * 0.5);
      ribPair.left.rotation.set(0, angle, 0.2);

      ribPair.right.position.set(span * 0.8, 0, span * 0.5);
      ribPair.right.rotation.set(0, -angle, -0.2);
    });

    this.limbSegments.forEach((seg, idx) => {
      const p1 = landmarks[seg.from];
      const p2 = landmarks[seg.to];
      const limb = this.limbMeshes[idx];

      if (p1 && p2 && p1.visibility > 0.1 && p2.visibility > 0.1) {
        const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
        const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
        const distance = v1.distanceTo(v2);

        limb.group.position.copy(v1);
        limb.group.lookAt(v2);
        limb.group.rotateX(Math.PI * 0.5);
        limb.cylMesh.scale.set(1, Math.max(distance, 0.01), 1);
        limb.ringMesh.position.y = distance * 0.5 + Math.sin(time * 4 + idx) * 0.04;
        limb.group.visible = true;
      } else {
        limb.group.visible = false;
      }
    });

    if (metrics.torsoCenter) {
      this.coreGroup.position.set(
        metrics.torsoCenter.x,
        metrics.torsoCenter.y + 0.08,
        metrics.torsoCenter.z + 0.05
      );
      this.coreGroup.rotation.y = time * 2.0;
      this.coreGroup.rotation.x = time * 1.5;
    }
  }
}


/**
 * ============================================================================
 * FORM 2: BIO BRISTLE / FUR ORGANISM (Multi-Dancer)
 * ============================================================================
 */
class BioBristleForm {
  constructor(palette) {
    this.root = new THREE.Group();
    this.palette = palette;
    this.bristleCount = 180;
    this.bristles = [];

    this.material = new THREE.LineBasicMaterial({
      color: palette.primary,
      transparent: true,
      opacity: 0.85
    });

    this.tipMaterial = new THREE.MeshBasicMaterial({
      color: palette.accent
    });

    this._buildBristles();
  }

  setVisible(v) {
    this.root.visible = v;
  }

  _buildBristles() {
    const tipGeom = new THREE.SphereGeometry(0.016, 6, 6);

    for (let i = 0; i < this.bristleCount; i++) {
      const positions = new Float32Array(3 * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const line = new THREE.Line(geom, this.material);
      const tipMesh = new THREE.Mesh(tipGeom, this.tipMaterial);

      this.root.add(line);
      this.root.add(tipMesh);

      this.bristles.push({
        line, tipMesh, geom, positions,
        jointIndex: i % 14,
        offsetAngle: (i / this.bristleCount) * Math.PI * 2 * 5,
        length: 0.2 + Math.random() * 0.25,
        tipPos: new THREE.Vector3(),
        tipVel: new THREE.Vector3()
      });
    }
  }

  update(landmarks, metrics, { time, delta, awakeFactor, sensitivity }) {
    if (!landmarks) return;

    const energy = (metrics.energy || 0) * sensitivity;
    const trackedJoints = [
      landmarks[0],
      landmarks[11], landmarks[12],
      landmarks[13], landmarks[14],
      landmarks[15], landmarks[16],
      landmarks[23], landmarks[24],
      landmarks[25], landmarks[26],
      landmarks[27], landmarks[28]
    ];

    for (let i = 0; i < this.bristles.length; i++) {
      const b = this.bristles[i];
      const joint = trackedJoints[b.jointIndex % trackedJoints.length];
      if (!joint || joint.visibility < 0.1) {
        b.line.visible = false;
        b.tipMesh.visible = false;
        continue;
      }
      b.line.visible = true;
      b.tipMesh.visible = awakeFactor > 0.1;

      const base = new THREE.Vector3(joint.x, joint.y, joint.z);
      const restDir = new THREE.Vector3(
        Math.cos(b.offsetAngle),
        Math.sin(b.offsetAngle) * 0.8,
        Math.sin(b.offsetAngle * 2.0) * 0.5
      ).normalize().multiplyScalar(b.length * (1.0 + energy * 0.75) * awakeFactor);

      const targetTip = base.clone().add(restDir);
      const springForce = targetTip.sub(b.tipPos).multiplyScalar(18.0);
      b.tipVel.add(springForce.multiplyScalar(delta));
      b.tipVel.multiplyScalar(0.78);
      b.tipPos.add(b.tipVel);

      const mid = base.clone().lerp(b.tipPos, 0.5);
      mid.y += Math.sin(time * 5.0 + i) * 0.03 * energy;

      const pos = b.positions;
      pos[0] = base.x; pos[1] = base.y; pos[2] = base.z;
      pos[3] = mid.x;  pos[4] = mid.y;  pos[5] = mid.z;
      pos[6] = b.tipPos.x; pos[7] = b.tipPos.y; pos[8] = b.tipPos.z;

      b.geom.attributes.position.needsUpdate = true;
      b.tipMesh.position.copy(b.tipPos);
    }
  }
}


/**
 * ============================================================================
 * FORM 3: LIQUID MERCURY & CHROMATIC RIBBONS (Multi-Dancer)
 * ============================================================================
 */
class LiquidRibbonForm {
  constructor(palette) {
    this.root = new THREE.Group();
    this.palette = palette;
    this.jointSpheres = [];

    this.mercuryMaterial = new THREE.MeshStandardMaterial({
      color: palette.chrome,
      metalness: 1.0,
      roughness: 0.08
    });

    this.trailPointsCount = 45;
    this.trailEmitters = [
      { jointIdx: 0, color: palette.primary },
      { jointIdx: 15, color: palette.accent },
      { jointIdx: 16, color: palette.primary },
      { jointIdx: 27, color: palette.accent },
      { jointIdx: 28, color: palette.primary }
    ];

    this.trails = [];
    this._buildJoints();
    this._buildTrails();
  }

  setVisible(v) {
    this.root.visible = v;
  }

  _buildJoints() {
    const geom = new THREE.SphereGeometry(0.07, 16, 16);
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(geom, this.mercuryMaterial);
      this.root.add(mesh);
      this.jointSpheres.push(mesh);
    }
  }

  _buildTrails() {
    this.trailEmitters.forEach(emitter => {
      const history = [];
      for (let p = 0; p < this.trailPointsCount; p++) {
        history.push(new THREE.Vector3(0, 0, 0));
      }

      const vertexCount = this.trailPointsCount * 2;
      const positions = new Float32Array(vertexCount * 3);
      const indices = [];

      for (let i = 0; i < this.trailPointsCount - 1; i++) {
        const v = i * 2;
        indices.push(v, v + 1, v + 2);
        indices.push(v + 1, v + 3, v + 2);
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setIndex(indices);

      const ribbonMat = new THREE.MeshBasicMaterial({
        color: emitter.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });

      const mesh = new THREE.Mesh(geom, ribbonMat);
      this.root.add(mesh);
      this.trails.push({ emitter, history, geom, positions, mesh });
    });
  }

  update(landmarks, metrics, { time, delta, awakeFactor, sensitivity }) {
    if (!landmarks) return;

    const energy = (metrics.energy || 0) * sensitivity;
    const joints = [
      landmarks[0],
      landmarks[11], landmarks[12],
      landmarks[13], landmarks[14],
      landmarks[15], landmarks[16],
      landmarks[23], landmarks[24],
      landmarks[25], landmarks[26],
      landmarks[27], landmarks[28]
    ];

    joints.forEach((j, idx) => {
      if (j && this.jointSpheres[idx]) {
        const mesh = this.jointSpheres[idx];
        if (j.visibility > 0.1) {
          mesh.position.set(j.x, j.y, j.z);
          const squash = 1.0 + Math.sin(time * 6.0 + idx) * 0.15 * energy;
          mesh.scale.set(squash * awakeFactor, (1.0 / squash) * awakeFactor, squash * awakeFactor);
          mesh.visible = true;
        } else {
          mesh.visible = false;
        }
      }
    });

    this.trails.forEach(trail => {
      const joint = landmarks[trail.emitter.jointIdx];
      if (!joint || joint.visibility < 0.1) return;

      const currentPos = new THREE.Vector3(joint.x, joint.y, joint.z);
      trail.history.pop();
      trail.history.unshift(currentPos);

      const pos = trail.positions;
      for (let i = 0; i < this.trailPointsCount; i++) {
        const pt = trail.history[i];
        const width = (1.0 - i / this.trailPointsCount) * 0.1 * awakeFactor;
        const normIdx = i * 2 * 3;

        pos[normIdx]     = pt.x - width;
        pos[normIdx + 1] = pt.y;
        pos[normIdx + 2] = pt.z;

        pos[normIdx + 3] = pt.x + width;
        pos[normIdx + 4] = pt.y;
        pos[normIdx + 5] = pt.z;
      }
      trail.geom.attributes.position.needsUpdate = true;
    });
  }
}


/**
 * ============================================================================
 * FORM 4: QUANTUM GEOMETRIC CONSTELLATION (Multi-Dancer)
 * ============================================================================
 */
class QuantumLatticeForm {
  constructor(palette) {
    this.root = new THREE.Group();
    this.palette = palette;
    this.polyhedra = [];

    this.crystalMaterial = new THREE.MeshStandardMaterial({
      color: palette.primary,
      emissive: palette.metal,
      metalness: 0.85,
      roughness: 0.15,
      wireframe: true
    });

    this.laserMaterial = new THREE.LineBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    this._buildConstellation();
  }

  setVisible(v) {
    this.root.visible = v;
  }

  _buildConstellation() {
    for (let i = 0; i < 14; i++) {
      const geom = (i % 2 === 0)
        ? new THREE.IcosahedronGeometry(0.075, 0)
        : new THREE.OctahedronGeometry(0.08, 0);

      const crystalMesh = new THREE.Mesh(geom, this.crystalMaterial);
      this.root.add(crystalMesh);

      this.polyhedra.push({
        crystalMesh,
        jointIdx: i,
        orbitSpeed: 2.0 + Math.random() * 2.0,
        orbitRadius: 0.08 + Math.random() * 0.08
      });
    }

    this.laserLinesCount = 12;
    this.laserPositions = new Float32Array(this.laserLinesCount * 2 * 3);
    this.laserGeom = new THREE.BufferGeometry();
    this.laserGeom.setAttribute('position', new THREE.BufferAttribute(this.laserPositions, 3));
    this.laserMesh = new THREE.LineSegments(this.laserGeom, this.laserMaterial);
    this.root.add(this.laserMesh);
  }

  update(landmarks, metrics, { time, delta, awakeFactor, sensitivity }) {
    if (!landmarks) return;

    const energy = (metrics.energy || 0) * sensitivity;
    const joints = [
      landmarks[0],
      landmarks[11], landmarks[12],
      landmarks[13], landmarks[14],
      landmarks[15], landmarks[16],
      landmarks[23], landmarks[24],
      landmarks[25], landmarks[26],
      landmarks[27], landmarks[28]
    ];

    this.polyhedra.forEach((p, idx) => {
      const j = joints[idx];
      if (!j || j.visibility < 0.1) {
        p.crystalMesh.visible = false;
        return;
      }
      p.crystalMesh.visible = true;

      const orbitRad = (p.orbitRadius + energy * 0.12) * awakeFactor;
      const angle = time * p.orbitSpeed + idx;

      p.crystalMesh.position.set(
        j.x + Math.cos(angle) * orbitRad,
        j.y + Math.sin(angle) * orbitRad,
        j.z + Math.sin(angle * 2.0) * orbitRad * 0.5
      );

      p.crystalMesh.rotation.x = time * 2.0;
      p.crystalMesh.rotation.y = time * 1.5;

      const scale = (1.0 + energy * 0.6) * awakeFactor;
      p.crystalMesh.scale.set(scale, scale, scale);
    });

    const links = [
      [0, 1], [0, 2], [1, 2],
      [1, 3], [3, 5],
      [2, 4], [4, 6],
      [1, 7], [2, 8], [7, 8],
      [7, 9], [8, 10]
    ];

    const pos = this.laserPositions;
    links.forEach((link, idx) => {
      const j1 = joints[link[0]];
      const j2 = joints[link[1]];
      const nIdx = idx * 6;

      if (j1 && j2 && j1.visibility > 0.1 && j2.visibility > 0.1) {
        pos[nIdx]     = j1.x; pos[nIdx + 1] = j1.y; pos[nIdx + 2] = j1.z;
        pos[nIdx + 3] = j2.x; pos[nIdx + 4] = j2.y; pos[nIdx + 5] = j2.z;
      } else {
        pos[nIdx] = 0; pos[nIdx + 1] = 0; pos[nIdx + 2] = 0;
        pos[nIdx + 3] = 0; pos[nIdx + 4] = 0; pos[nIdx + 5] = 0;
      }
    });

    this.laserGeom.attributes.position.needsUpdate = true;
  }
}
