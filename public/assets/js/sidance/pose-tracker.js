/**
 * SIDANCE ✕ FUTURE YOU - Multi-Person Pose Tracker Module
 * Real-time multi-person pose estimation using TensorFlow.js MoveNet MultiPose Lightning.
 * Tracks up to 6 dancers simultaneously with persistent IDs, per-dancer landmark smoothing,
 * spine reconstruction, and multi-dancer kinetic metric extraction.
 */

export class MultiPoseTracker {
  constructor(options = {}) {
    this.options = Object.assign({
      mirror: true,
      deviceId: null,
      resolution: '4k',
      maxDancers: 4,
      smoothingAlpha: 0.65,
      minScore: 0.42,
      onMultiPose: null, // Callback: (activeDancersMap, collectiveMetrics) => {}
      onPresenceChange: null,
      onFps: null,
    }, options);

    this.videoElement = null;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // Optimal MoveNet MultiPose input resolution (288x512 or 384x512)
    this.offscreenCanvas.width = 512;
    this.offscreenCanvas.height = 384;

    this.detector = null;
    this.stream = null;
    this.isRunning = false;
    this.isProcessingFrame = false;
    this.demoMode = false;
    this.isModelReady = false;

    // Multi-dancer state map: slotId (1..maxDancers) -> { id, landmarks, prevLandmarks, metrics, lastSeen, isExiting, isConfirmed, detectionStreak }
    this.trackedDancers = new Map();

    // Frame timing & FPS
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = performance.now();
    this.currentFps = 60;

    // Collective metrics across all dancers
    this.collectiveMetrics = {
      dancerCount: 0,
      totalEnergy: 0,
      averageSpread: 0,
      centerOfMass: { x: 0, y: 0, z: 0 },
      distanceBetweenDancers: 0
    };

    // Demo choreo state
    this.demoTime = 0;
  }

  async init(videoElement) {
    this.videoElement = videoElement;

    // Initialize TensorFlow.js WebGL backend
    if (window.tf) {
      try {
        await window.tf.setBackend('webgl');
        await window.tf.ready();
      } catch (e) {
        console.warn('WebGL backend setup notice:', e);
      }
    }

    // Initialize MoveNet MultiPose Detector
    try {
      const detectorConfig = {
        modelType: window.poseDetection.movenet.modelType.MULTIPOSE_LIGHTNING,
        enableTracking: true,
        trackerType: window.poseDetection.TrackerType.BoundingBox,
        minPoseScore: this.options.minScore
      };
      this.detector = await window.poseDetection.createDetector(
        window.poseDetection.SupportedModels.MoveNet,
        detectorConfig
      );
      this.isModelReady = true;
    } catch (err) {
      console.error('Failed to create MoveNet MultiPose detector:', err);
    }
  }

  async getAvailableCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch (err) {
      console.warn('Unable to enumerate cameras:', err);
      return [];
    }
  }

  setMaxDancers(num) {
    this.options.maxDancers = Math.max(1, Math.min(6, parseInt(num) || 4));
  }

  async startCamera(deviceId = null, resolution = '4k') {
    this.options.deviceId = deviceId || this.options.deviceId;
    this.options.resolution = resolution || this.options.resolution;
    this.demoMode = false;

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    let width = 1920;
    let height = 1080;
    if (this.options.resolution === '4k') {
      width = 3840;
      height = 2160;
    } else if (this.options.resolution === '720p') {
      width = 1280;
      height = 720;
    }

    const constraints = {
      video: {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 60, min: 30 }
      },
      audio: false
    };

    if (this.options.deviceId) {
      constraints.video.deviceId = { exact: this.options.deviceId };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.isRunning = true;
      this._startProcessingLoop();
      return true;
    } catch (err) {
      console.warn('Camera request failed, trying generic constraints:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play();
        this.isRunning = true;
        this._startProcessingLoop();
        return true;
      } catch (fallbackErr) {
        console.warn('Camera unavailable, launching Multi-Dancer Demo Simulation:', fallbackErr);
        this.startDemoMode();
        return false;
      }
    }
  }

  stopCamera() {
    this.isRunning = false;
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  startDemoMode() {
    this.stopCamera();
    this.demoMode = true;
    this.isRunning = true;
    this.trackedDancers.clear();
    this._startProcessingLoop();
  }

  setMirror(mirror) {
    this.options.mirror = Boolean(mirror);
  }

  _startProcessingLoop() {
    const loop = async () => {
      if (!this.isRunning) return;

      const now = performance.now();
      const delta = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      // FPS tracking
      this.frameCount++;
      if (now - this.fpsTimer >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
        this.frameCount = 0;
        this.fpsTimer = now;
        if (this.options.onFps) this.options.onFps(this.currentFps);
      }

      if (this.demoMode) {
        this._generateMultiDancerDemo(delta);
      } else if (this.isModelReady && this.videoElement && this.videoElement.readyState >= 2 && !this.isProcessingFrame) {
        this.isProcessingFrame = true;
        try {
          // Downscale to 512x384 for high-speed multi-person inference
          this.offscreenCtx.drawImage(
            this.videoElement,
            0, 0,
            this.offscreenCanvas.width,
            this.offscreenCanvas.height
          );

          const rawPoses = await this.detector.estimatePoses(this.offscreenCanvas, {
            maxPoses: this.options.maxDancers,
            flipHorizontal: false
          });

          this._handleMultiPoses(rawPoses, now);
        } catch (e) {
          console.error('MultiPose estimation error:', e);
        } finally {
          this.isProcessingFrame = false;
        }
      }

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  _isValidHumanPose(rawPose) {
    if (!rawPose || (rawPose.score || 0) < this.options.minScore) {
      return false;
    }

    const kps = rawPose.keypoints;
    if (!kps || kps.length < 17) return false;

    // 1. Count keypoints with solid confidence and compute bounding box in 512x384 canvas
    let confidentCount = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < 17; i++) {
      const kp = kps[i];
      if (kp && kp.score >= 0.28) {
        confidentCount++;
        if (kp.x < minX) minX = kp.x;
        if (kp.x > maxX) maxX = kp.x;
        if (kp.y < minY) minY = kp.y;
        if (kp.y > maxY) maxY = kp.y;
      }
    }

    // Require at least 5 confident keypoints to reject sensor/background noise
    if (confidentCount < 5) {
      return false;
    }

    // 2. Physical bounding box in 512x384 canvas
    const boxW = maxX - minX;
    const boxH = maxY - minY;
    // Reject tiny micro-speck noise clumps (like 5px dot in empty room)
    if (boxH < 36 || boxW < 16) {
      return false;
    }

    // 3. Essential anatomical joints check:
    // Shoulders: 5 (left_shoulder), 6 (right_shoulder)
    const ls = kps[5];
    const rs = kps[6];
    const hasShoulder = (ls && ls.score >= 0.32) || (rs && rs.score >= 0.32);
    if (!hasShoulder) {
      return false;
    }

    // Hip or Head: 11 (left_hip), 12 (right_hip), 0 (nose)
    const lh = kps[11];
    const rh = kps[12];
    const nose = kps[0];
    const hasHip = (lh && lh.score >= 0.28) || (rh && rh.score >= 0.28);
    const hasNose = nose && nose.score >= 0.32;

    if (!hasHip && !hasNose) {
      return false;
    }

    // 4. Torso span check: If hips are detected, verify physical vertical distance
    if (hasHip) {
      const shoulderY = (ls && rs && ls.score >= 0.25 && rs.score >= 0.25)
        ? (ls.y + rs.y) * 0.5
        : (ls && ls.score >= 0.25 ? ls.y : rs.y);
      const hipY = (lh && rh && lh.score >= 0.25 && rh.score >= 0.25)
        ? (lh.y + rh.y) * 0.5
        : (lh && lh.score >= 0.25 ? lh.y : rh.y);

      const torsoH = Math.abs(hipY - shoulderY);
      if (torsoH < 20) {
        // Collapsed torso: sensor noise speck
        return false;
      }
    }

    return true;
  }

  _handleMultiPoses(rawPoses, now) {
    // 1. Strict anatomical filtering to eliminate noise and phantom candidates
    const validPoses = (rawPoses || [])
      .filter(p => this._isValidHumanPose(p))
      .slice(0, this.options.maxDancers);

    // 2. Spatial slot assignment strictly bound to 1..maxDancers
    const assignments = this._assignSlotsToPoses(validPoses);
    const seenSlotIds = new Set();

    assignments.forEach(({ slotId, rawPose, cx, cy }) => {
      seenSlotIds.add(slotId);
      this._processPersonPose(slotId, rawPose, now, cx, cy);
    });

    // 3. Handle absent dancers (fast 650ms timeout)
    const timeoutThreshold = 650;
    for (const [id, dancer] of this.trackedDancers.entries()) {
      if (!seenSlotIds.has(id)) {
        const elapsed = now - dancer.lastSeen;
        if (elapsed > timeoutThreshold) {
          this.trackedDancers.delete(id);
        } else {
          dancer.isExiting = true;
          dancer.metrics.isPresent = false;
        }
      }
    }

    this._computeCollectiveMetrics();

    if (this.options.onMultiPose) {
      this.options.onMultiPose(this.trackedDancers, this.collectiveMetrics);
    }
  }

  _assignSlotsToPoses(validPoses) {
    const assignments = [];
    const maxDancers = this.options.maxDancers || 4;
    const availableSlotIds = [];
    for (let i = 1; i <= maxDancers; i++) {
      availableSlotIds.push(i);
    }

    // Compute candidate centroid in 512x384 canvas
    const candidates = validPoses.map(pose => {
      const kps = pose.keypoints;
      let cx = 0, cy = 0, count = 0;
      [5, 6, 11, 12, 0].forEach(idx => {
        if (kps[idx] && kps[idx].score >= 0.25) {
          cx += kps[idx].x;
          cy += kps[idx].y;
          count++;
        }
      });
      if (count === 0 && kps[0]) {
        cx = kps[0].x;
        cy = kps[0].y;
      } else if (count > 0) {
        cx /= count;
        cy /= count;
      }
      return { pose, cx, cy };
    });

    const unassignedCandidates = [];
    const usedSlotIds = new Set();

    // 1st pass: match to existing tracked dancers nearest to candidate
    candidates.forEach(cand => {
      let bestSlot = null;
      let minDist = 180; // pixel distance threshold in 512x384 canvas

      for (const [slotId, dancer] of this.trackedDancers.entries()) {
        if (usedSlotIds.has(slotId)) continue;
        const dCenter = dancer.canvasCenter || { x: 256, y: 192 };
        const dist = Math.hypot(cand.cx - dCenter.x, cand.cy - dCenter.y);
        if (dist < minDist) {
          minDist = dist;
          bestSlot = slotId;
        }
      }

      if (bestSlot !== null) {
        usedSlotIds.add(bestSlot);
        assignments.push({ slotId: bestSlot, rawPose: cand.pose, cx: cand.cx, cy: cand.cy });
      } else {
        unassignedCandidates.push(cand);
      }
    });

    // 2nd pass: assign lowest free slot (1..maxDancers) to new candidates
    unassignedCandidates.forEach(cand => {
      const freeSlot = availableSlotIds.find(id => !this.trackedDancers.has(id) && !usedSlotIds.has(id));
      if (freeSlot !== undefined) {
        usedSlotIds.add(freeSlot);
        assignments.push({ slotId: freeSlot, rawPose: cand.pose, cx: cand.cx, cy: cand.cy });
      }
    });

    return assignments;
  }

  _processPersonPose(personId, rawPose, now, cx, cy) {
    const alpha = this.options.smoothingAlpha;
    const mirror = this.options.mirror;
    const cw = this.offscreenCanvas.width;
    const ch = this.offscreenCanvas.height;
    const keypoints = rawPose.keypoints;

    // Convert MoveNet 17 keypoints into standard 33 anatomical landmarks format
    const transformed = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

    // Screen and perspective frustum dimensions for 1:1 camera body overlay
    const sw = window.innerWidth || 1080;
    const sh = window.innerHeight || 1920;
    const screenAspect = sw / sh;

    const videoAspect = (this.videoElement && this.videoElement.videoWidth && this.videoElement.videoHeight)
      ? (this.videoElement.videoWidth / this.videoElement.videoHeight)
      : (cw / ch);

    // Three.js frustum bounds at z = 0 with camera at z = 4.6, FOV = 50 deg
    const fovRad = (50 * Math.PI) / 360;
    const halfFrustumH = Math.tan(fovRad) * 4.6;
    const halfFrustumW = halfFrustumH * screenAspect;

    // Helper to project keypoint directly onto screen pixel location
    const mapKp = (kpIndex) => {
      const kp = keypoints[kpIndex];
      if (!kp || kp.score < 0.15) return null;

      let normX = kp.x / cw;
      let normY = kp.y / ch;

      if (mirror) {
        normX = 1.0 - normX;
      }

      // Exact CSS object-fit: cover coordinate mapping
      let normScreenX, normScreenY;
      if (screenAspect > videoAspect) {
        // Screen is wider than video (video height cropped)
        const renderedH = sw / videoAspect;
        const cropOffset = (renderedH - sh) * 0.5;
        normScreenX = normX;
        normScreenY = (normY * renderedH - cropOffset) / sh;
      } else {
        // Screen is taller than video (Vertical 9:16 screen: video width cropped)
        const renderedW = sh * videoAspect;
        const cropOffset = (renderedW - sw) * 0.5;
        normScreenX = (normX * renderedW - cropOffset) / sw;
        normScreenY = normY;
      }

      // Convert from screen space [0, 1] to exact 2D canvas pixel coordinates
      const screenX = normScreenX * sw;
      const screenY = normScreenY * sh;
      const worldX = (normScreenX - 0.5) * 2.0 * halfFrustumW;
      const worldY = -(normScreenY - 0.5) * 2.0 * halfFrustumH;

      return {
        x: screenX,
        y: screenY,
        z: 0,
        screenX,
        screenY,
        worldX,
        worldY,
        normX: normScreenX,
        normY: normScreenY,
        visibility: kp.score
      };
    };

    // MoveNet 17 to MediaPipe 33 mapping
    const kpMap = {
      0: 0,   // nose -> 0
      1: 2,   // left_eye -> 2
      2: 5,   // right_eye -> 5
      3: 7,   // left_ear -> 7
      4: 8,   // right_ear -> 8
      5: 11,  // left_shoulder -> 11
      6: 12,  // right_shoulder -> 12
      7: 13,  // left_elbow -> 13
      8: 14,  // right_elbow -> 14
      9: 15,  // left_wrist -> 15
      10: 16, // right_wrist -> 16
      11: 23, // left_hip -> 23
      12: 24, // right_hip -> 24
      13: 25, // left_knee -> 25
      14: 26, // right_knee -> 26
      15: 27, // left_ankle -> 27
      16: 28  // right_ankle -> 28
    };

    for (const [mnIdx, mpIdx] of Object.entries(kpMap)) {
      const pt = mapKp(Number(mnIdx));
      if (pt) {
        transformed[mpIdx] = pt;
      }
    }

    let dancer = this.trackedDancers.get(personId);
    if (!dancer) {
      dancer = {
        id: personId,
        colorIndex: ((personId - 1) % 4) + 1, // strictly 1 to 4
        landmarks: transformed.map(p => ({ ...p })),
        prevLandmarks: transformed.map(p => ({ ...p })),
        canvasCenter: { x: cx, y: cy },
        detectionStreak: 1,
        isConfirmed: false, // Require at least 2 consecutive frames before confirmed
        metrics: { energy: 0, velocity: 0, spread: 1.0, torsoAngle: 0, torsoCenter: { x: 0, y: 0, z: 0 }, spinePoints: [], isPresent: true },
        lastSeen: now,
        isExiting: false
      };
      this.trackedDancers.set(personId, dancer);
    } else {
      dancer.lastSeen = now;
      dancer.isExiting = false;
      dancer.metrics.isPresent = true;
      dancer.canvasCenter = { x: cx, y: cy };
      dancer.detectionStreak = (dancer.detectionStreak || 0) + 1;
      if (dancer.detectionStreak >= 2) {
        dancer.isConfirmed = true;
      }

      // Landmark smoothing
      let totalVel = 0;
      for (let i = 0; i < transformed.length; i++) {
        const curr = transformed[i];
        const smooth = dancer.landmarks[i];
        const prev = dancer.prevLandmarks[i];

        if (curr.visibility > 0.1) {
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          totalVel += Math.hypot(dx, dy);

          smooth.x += alpha * (curr.x - smooth.x);
          smooth.y += alpha * (curr.y - smooth.y);
          smooth.z += alpha * (curr.z - smooth.z);
          smooth.visibility = curr.visibility;

          prev.x = curr.x;
          prev.y = curr.y;
          prev.z = curr.z;
        }
      }

      dancer.metrics.velocity = totalVel;
      const rawEnergy = Math.min(totalVel * 3.5, 3.5);
      dancer.metrics.energy += 0.25 * (rawEnergy - dancer.metrics.energy);
    }

    // Reconstruct Neck, Pelvis, and Vertebrae Spine in 2D Screen Space
    const lm = dancer.landmarks;
    const defaultW = sw * 0.12;
    const defaultH = sh * 0.22;
    const nose = lm[0] && lm[0].visibility > 0.1 ? lm[0] : { x: sw * 0.5, y: sh * 0.35, z: 0 };
    const ls = lm[11] && lm[11].visibility > 0.1 ? lm[11] : { x: nose.x - defaultW * 0.5, y: nose.y + 40, z: 0 };
    const rs = lm[12] && lm[12].visibility > 0.1 ? lm[12] : { x: nose.x + defaultW * 0.5, y: nose.y + 40, z: 0 };
    const lh = lm[23] && lm[23].visibility > 0.1 ? lm[23] : { x: ls.x, y: ls.y + defaultH, z: 0 };
    const rh = lm[24] && lm[24].visibility > 0.1 ? lm[24] : { x: rs.x, y: rs.y + defaultH, z: 0 };

    const neck = { x: (ls.x + rs.x) * 0.5, y: (ls.y + rs.y) * 0.5, z: 0 };
    const pelvis = { x: (lh.x + rh.x) * 0.5, y: (lh.y + rh.y) * 0.5, z: 0 };

    dancer.metrics.torsoCenter = {
      x: (neck.x + pelvis.x) * 0.5,
      y: (neck.y + pelvis.y) * 0.5,
      z: 0
    };
    dancer.metrics.torsoAngle = Math.atan2(pelvis.x - neck.x, pelvis.y - neck.y);

    // Spine spline points in 2D
    const spineSegments = 20;
    const spine = [];
    for (let s = 0; s <= spineSegments; s++) {
      const t = s / spineSegments;
      const arch = Math.sin(t * Math.PI) * (dancer.metrics.torsoAngle * 25);
      spine.push({
        x: neck.x + (pelvis.x - neck.x) * t + arch,
        y: neck.y + (pelvis.y - neck.y) * t,
        z: 0,
        t: t
      });
    }
    dancer.metrics.spinePoints = spine;

    // Spread calculation
    const lw = lm[15];
    const rw = lm[16];
    dancer.metrics.spread = (
      Math.hypot(lw.x - neck.x, lw.y - neck.y) +
      Math.hypot(rw.x - neck.x, rw.y - neck.y)
    ) * 0.5;
  }

  _computeCollectiveMetrics() {
    const activeDancers = Array.from(this.trackedDancers.values())
      .filter(d => d.isConfirmed && !d.isExiting && d.metrics.isPresent);

    const count = activeDancers.length;
    this.collectiveMetrics.dancerCount = count;

    if (count === 0) {
      this.collectiveMetrics.totalEnergy = 0;
      this.collectiveMetrics.averageSpread = 0;
      this.collectiveMetrics.centerOfMass = { x: 0, y: 0, z: 0 };
      this.collectiveMetrics.distanceBetweenDancers = 0;
      return;
    }

    let sumEnergy = 0;
    let sumSpread = 0;
    let sumX = 0, sumY = 0;

    activeDancers.forEach(d => {
      sumEnergy += d.metrics.energy || 0;
      sumSpread += d.metrics.spread || 1.0;
      sumX += d.metrics.torsoCenter.x;
      sumY += d.metrics.torsoCenter.y;
    });

    this.collectiveMetrics.totalEnergy = sumEnergy / count;
    this.collectiveMetrics.averageSpread = sumSpread / count;
    this.collectiveMetrics.centerOfMass = { x: sumX / count, y: sumY / count, z: 0 };

    if (count >= 2) {
      const d1 = activeDancers[0].metrics.torsoCenter;
      const d2 = activeDancers[1].metrics.torsoCenter;
      this.collectiveMetrics.distanceBetweenDancers = Math.hypot(d1.x - d2.x, d1.y - d2.y);
    } else {
      this.collectiveMetrics.distanceBetweenDancers = 0;
    }
  }

  _generateMultiDancerDemo(delta) {
    this.demoTime += delta * 1.3;
    const t = this.demoTime;
    const sw = window.innerWidth || 1080;
    const sh = window.innerHeight || 1920;

    // Simulate 2 distinct dancers performing a duet across the stage in 2D Canvas!
    const activeDemoDancers = [
      { id: 1, baseNormX: 0.32, speedMult: 1.0, phase: 0 },
      { id: 2, baseNormX: 0.68, speedMult: 1.15, phase: Math.PI * 0.7 }
    ];

    activeDemoDancers.forEach(spec => {
      const dt = t * spec.speedMult + spec.phase;
      const sway = Math.sin(dt * 1.2) * (sw * 0.04);
      const bob = Math.cos(dt * 2.4) * (sh * 0.02);
      const armL = Math.sin(dt * 1.8);
      const armR = Math.cos(dt * 1.8);
      const legExt = Math.sin(dt * 0.9);

      const baseX = spec.baseNormX * sw;
      const baseY = sh * 0.42;

      const neck = { x: baseX + sway * 0.8, y: baseY - sh * 0.14 + bob, z: 0 };
      const pelvis = { x: baseX + sway * 0.4, y: baseY + sh * 0.1 + bob * 0.5, z: 0 };

      const leftShoulder = { x: neck.x - sw * 0.07, y: neck.y + sh * 0.02, z: 0 };
      const rightShoulder = { x: neck.x + sw * 0.07, y: neck.y + sh * 0.02, z: 0 };
      const leftHip = { x: pelvis.x - sw * 0.045, y: pelvis.y, z: 0 };
      const rightHip = { x: pelvis.x + sw * 0.045, y: pelvis.y, z: 0 };

      const leftElbow = { x: leftShoulder.x - sw * 0.07 + Math.cos(dt * 2) * (sw * 0.02), y: leftShoulder.y + sh * 0.08 + armL * (sh * 0.04), z: 0 };
      const leftWrist = { x: leftElbow.x - sw * 0.05 + Math.sin(dt * 2.5) * (sw * 0.03), y: leftElbow.y + sh * 0.09 + armL * (sh * 0.04), z: 0 };

      const rightElbow = { x: rightShoulder.x + sw * 0.07 - Math.sin(dt * 2) * (sw * 0.02), y: rightShoulder.y + sh * 0.08 + armR * (sh * 0.04), z: 0 };
      const rightWrist = { x: rightElbow.x + sw * 0.05 - Math.cos(dt * 2.5) * (sw * 0.03), y: rightElbow.y + sh * 0.09 + armR * (sh * 0.04), z: 0 };

      const leftKnee = { x: leftHip.x - sw * 0.02, y: leftHip.y + sh * 0.15 + Math.max(0, bob * 1.5), z: 0 };
      const leftAnkle = { x: leftKnee.x, y: leftKnee.y + sh * 0.17, z: 0 };

      const rightKnee = { x: rightHip.x + sw * 0.03 + legExt * (sw * 0.03), y: rightHip.y + sh * 0.13 + Math.sin(dt * 1.5) * (sh * 0.03), z: 0 };
      const rightAnkle = { x: rightKnee.x + sw * 0.03 + legExt * (sw * 0.02), y: rightKnee.y + sh * 0.16, z: 0 };

      const syntheticLandmarks = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      syntheticLandmarks[0] = { x: neck.x, y: neck.y - sh * 0.05, z: 0, visibility: 1 };
      syntheticLandmarks[11] = { ...leftShoulder, visibility: 1 };
      syntheticLandmarks[12] = { ...rightShoulder, visibility: 1 };
      syntheticLandmarks[13] = { ...leftElbow, visibility: 1 };
      syntheticLandmarks[14] = { ...rightElbow, visibility: 1 };
      syntheticLandmarks[15] = { ...leftWrist, visibility: 1 };
      syntheticLandmarks[16] = { ...rightWrist, visibility: 1 };
      syntheticLandmarks[23] = { ...leftHip, visibility: 1 };
      syntheticLandmarks[24] = { ...rightHip, visibility: 1 };
      syntheticLandmarks[25] = { ...leftKnee, visibility: 1 };
      syntheticLandmarks[26] = { ...rightKnee, visibility: 1 };
      syntheticLandmarks[27] = { ...leftAnkle, visibility: 1 };
      syntheticLandmarks[28] = { ...rightAnkle, visibility: 1 };

      const spineSegments = 20;
      const spine = [];
      const torsoAngle = Math.atan2(pelvis.x - neck.x, pelvis.y - neck.y);
      for (let s = 0; s <= spineSegments; s++) {
        const u = s / spineSegments;
        const arch = Math.sin(u * Math.PI) * (torsoAngle * 30);
        spine.push({
          x: neck.x + (pelvis.x - neck.x) * u + arch,
          y: neck.y + (pelvis.y - neck.y) * u,
          z: 0,
          t: u
        });
      }

      this.trackedDancers.set(spec.id, {
        id: spec.id,
        colorIndex: spec.id,
        landmarks: syntheticLandmarks,
        isConfirmed: true,
        detectionStreak: 10,
        metrics: {
          energy: 0.5 + Math.abs(Math.sin(dt * 1.8)) * 0.7,
          velocity: 0.8,
          spread: 1.2 + Math.sin(dt * 1.4) * 0.4,
          torsoCenter: { x: (neck.x + pelvis.x) * 0.5, y: (neck.y + pelvis.y) * 0.5, z: 0 },
          torsoAngle: torsoAngle,
          spinePoints: spine,
          isPresent: true
        },
        isExiting: false,
        lastSeen: performance.now()
      });
    });

    this._computeCollectiveMetrics();

    if (this.options.onMultiPose) {
      this.options.onMultiPose(this.trackedDancers, this.collectiveMetrics);
    }
  }
}
