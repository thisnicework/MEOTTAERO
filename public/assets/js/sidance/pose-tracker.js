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
      minScore: 0.22,
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

    // Multi-dancer state map: personId -> { id, landmarks, prevLandmarks, metrics, lastSeen, isExiting }
    this.trackedDancers = new Map();
    this.nextVirtualId = 1;

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

  _handleMultiPoses(rawPoses, now) {
    const validPoses = (rawPoses || []).filter(p => (p.score || 0) >= this.options.minScore);
    const seenIds = new Set();

    validPoses.forEach((rawPose, idx) => {
      // MoveNet MultiPose provides pose.id (integer)
      let personId = rawPose.id;
      if (personId === undefined || personId === null) {
        // Fallback spatial proximity assignment
        personId = this._matchOrCreatePersonId(rawPose);
      }

      seenIds.add(personId);
      this._processPersonPose(personId, rawPose, now);
    });

    // Handle absent dancers (graceful collapse)
    const timeoutThreshold = 1400; // ms before removing dancer
    for (const [id, dancer] of this.trackedDancers.entries()) {
      if (!seenIds.has(id)) {
        const elapsed = now - dancer.lastSeen;
        if (elapsed > timeoutThreshold) {
          this.trackedDancers.delete(id);
        } else {
          dancer.isExiting = true;
          dancer.metrics.isPresent = false;
        }
      } else {
        dancer.isExiting = false;
        dancer.metrics.isPresent = true;
      }
    }

    this._computeCollectiveMetrics();

    if (this.options.onMultiPose) {
      this.options.onMultiPose(this.trackedDancers, this.collectiveMetrics);
    }
  }

  _matchOrCreatePersonId(rawPose) {
    const nose = rawPose.keypoints[0] || { x: 0, y: 0 };
    let bestId = null;
    let minDist = 150; // pixel distance threshold

    for (const [id, dancer] of this.trackedDancers.entries()) {
      const prevNose = dancer.rawNose || { x: 0, y: 0 };
      const d = Math.hypot(nose.x - prevNose.x, nose.y - prevNose.y);
      if (d < minDist) {
        minDist = d;
        bestId = id;
      }
    }

    if (bestId !== null) {
      return bestId;
    }

    const newId = this.nextVirtualId++;
    return newId;
  }

  _processPersonPose(personId, rawPose, now) {
    const alpha = this.options.smoothingAlpha;
    const mirror = this.options.mirror;
    const cw = this.offscreenCanvas.width;
    const ch = this.offscreenCanvas.height;
    const keypoints = rawPose.keypoints;

    // Convert MoveNet 17 keypoints into standard 33 anatomical landmarks format
    const transformed = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 0 }));

    // Helper to map and normalize keypoint
    const mapKp = (kpIndex) => {
      const kp = keypoints[kpIndex];
      if (!kp || kp.score < 0.15) return null;

      let normX = kp.x / cw; // [0, 1]
      if (mirror) normX = 1.0 - normX;

      const x = (normX - 0.5) * 3.2;  // Stage width span
      const y = -(kp.y / ch - 0.5) * 3.6; // Vertical screen span
      const z = 0;
      return { x, y, z, visibility: kp.score };
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
        colorIndex: ((personId - 1) % 4) + 1, // 1 to 4
        landmarks: transformed.map(p => ({ ...p })),
        prevLandmarks: transformed.map(p => ({ ...p })),
        rawNose: keypoints[0] ? { x: keypoints[0].x, y: keypoints[0].y } : { x: 0, y: 0 },
        metrics: { energy: 0, velocity: 0, spread: 1.0, torsoAngle: 0, torsoCenter: { x: 0, y: 0, z: 0 }, spinePoints: [], isPresent: true },
        lastSeen: now,
        isExiting: false
      };
      this.trackedDancers.set(personId, dancer);
    } else {
      dancer.lastSeen = now;
      dancer.rawNose = keypoints[0] ? { x: keypoints[0].x, y: keypoints[0].y } : dancer.rawNose;

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

    // Reconstruct Neck, Pelvis, and Vertebrae Spine
    const lm = dancer.landmarks;
    const ls = lm[11].visibility > 0.1 ? lm[11] : { x: lm[0].x - 0.3, y: lm[0].y - 0.3, z: 0 };
    const rs = lm[12].visibility > 0.1 ? lm[12] : { x: lm[0].x + 0.3, y: lm[0].y - 0.3, z: 0 };
    const lh = lm[23].visibility > 0.1 ? lm[23] : { x: ls.x, y: ls.y - 0.7, z: 0 };
    const rh = lm[24].visibility > 0.1 ? lm[24] : { x: rs.x, y: rs.y - 0.7, z: 0 };

    const neck = { x: (ls.x + rs.x) * 0.5, y: (ls.y + rs.y) * 0.5, z: (ls.z + rs.z) * 0.5 };
    const pelvis = { x: (lh.x + rh.x) * 0.5, y: (lh.y + rh.y) * 0.5, z: (lh.z + rh.z) * 0.5 };

    dancer.metrics.torsoCenter = {
      x: (neck.x + pelvis.x) * 0.5,
      y: (neck.y + pelvis.y) * 0.5,
      z: (neck.z + pelvis.z) * 0.5
    };
    dancer.metrics.torsoAngle = Math.atan2(neck.x - pelvis.x, neck.y - pelvis.y);

    // Spine spline points
    const spineSegments = 20;
    const spine = [];
    for (let s = 0; s <= spineSegments; s++) {
      const t = s / spineSegments;
      const arch = Math.sin(t * Math.PI) * (dancer.metrics.torsoAngle * 0.35);
      spine.push({
        x: neck.x + (pelvis.x - neck.x) * t + arch,
        y: neck.y + (pelvis.y - neck.y) * t,
        z: neck.z + (pelvis.z - neck.z) * t,
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
    const count = this.trackedDancers.size;
    this.collectiveMetrics.dancerCount = count;

    if (count === 0) {
      this.collectiveMetrics.totalEnergy = 0;
      this.collectiveMetrics.averageSpread = 0;
      return;
    }

    let sumEnergy = 0;
    let sumSpread = 0;
    let sumX = 0, sumY = 0;

    const dancers = Array.from(this.trackedDancers.values());
    dancers.forEach(d => {
      sumEnergy += d.metrics.energy || 0;
      sumSpread += d.metrics.spread || 1.0;
      sumX += d.metrics.torsoCenter.x;
      sumY += d.metrics.torsoCenter.y;
    });

    this.collectiveMetrics.totalEnergy = sumEnergy / count;
    this.collectiveMetrics.averageSpread = sumSpread / count;
    this.collectiveMetrics.centerOfMass = { x: sumX / count, y: sumY / count, z: 0 };

    if (count >= 2) {
      const d1 = dancers[0].metrics.torsoCenter;
      const d2 = dancers[1].metrics.torsoCenter;
      this.collectiveMetrics.distanceBetweenDancers = Math.hypot(d1.x - d2.x, d1.y - d2.y);
    }
  }

  _generateMultiDancerDemo(delta) {
    this.demoTime += delta * 1.3;
    const t = this.demoTime;

    // Simulate 2 distinct dancers performing a duet across the stage!
    const activeDemoDancers = [
      { id: 1, baseOffsetX: -0.75, speedMult: 1.0, phase: 0 },
      { id: 2, baseOffsetX: 0.75, speedMult: 1.15, phase: Math.PI * 0.7 }
    ];

    activeDemoDancers.forEach(spec => {
      const dt = t * spec.speedMult + spec.phase;
      const sway = Math.sin(dt * 1.2) * 0.25;
      const bob = Math.cos(dt * 2.4) * 0.1;
      const armL = Math.sin(dt * 1.8);
      const armR = Math.cos(dt * 1.8);
      const legExt = Math.sin(dt * 0.9);

      const neck = { x: spec.baseOffsetX + sway * 0.5, y: 0.6 + bob, z: Math.sin(dt) * 0.15 };
      const pelvis = { x: spec.baseOffsetX + sway * 0.2, y: -0.15 + bob * 0.5, z: 0 };

      const leftShoulder = { x: neck.x - 0.32, y: neck.y - 0.05, z: neck.z };
      const rightShoulder = { x: neck.x + 0.32, y: neck.y - 0.05, z: neck.z };
      const leftHip = { x: pelvis.x - 0.2, y: pelvis.y, z: pelvis.z };
      const rightHip = { x: pelvis.x + 0.2, y: pelvis.y, z: pelvis.z };

      const leftElbow = { x: leftShoulder.x - 0.35 + Math.cos(dt * 2) * 0.15, y: leftShoulder.y + 0.2 + armL * 0.3, z: 0.2 };
      const leftWrist = { x: leftElbow.x - 0.35 + Math.sin(dt * 2.5) * 0.2, y: leftElbow.y + 0.3 + armL * 0.35, z: 0.25 };

      const rightElbow = { x: rightShoulder.x + 0.35 - Math.sin(dt * 2) * 0.15, y: rightShoulder.y + 0.2 + armR * 0.3, z: 0.2 };
      const rightWrist = { x: rightElbow.x + 0.35 - Math.cos(dt * 2.5) * 0.2, y: rightElbow.y + 0.3 + armR * 0.35, z: 0.25 };

      const leftKnee = { x: leftHip.x - 0.08, y: leftHip.y - 0.48 + Math.max(0, bob * 2), z: 0 };
      const leftAnkle = { x: leftKnee.x, y: leftKnee.y - 0.52, z: 0 };

      const rightKnee = { x: rightHip.x + 0.15 + legExt * 0.3, y: rightHip.y - 0.4 + Math.sin(dt * 1.5) * 0.25, z: 0.2 };
      const rightAnkle = { x: rightKnee.x + 0.15 + legExt * 0.2, y: rightKnee.y - 0.45, z: 0.2 };

      const syntheticLandmarks = new Array(33).fill(null).map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }));
      syntheticLandmarks[0] = { x: neck.x, y: neck.y + 0.24, z: neck.z, visibility: 1 };
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
      const torsoAngle = Math.atan2(neck.x - pelvis.x, neck.y - pelvis.y);
      for (let s = 0; s <= spineSegments; s++) {
        const u = s / spineSegments;
        const arch = Math.sin(u * Math.PI) * (torsoAngle * 0.35);
        spine.push({
          x: neck.x + (pelvis.x - neck.x) * u + arch,
          y: neck.y + (pelvis.y - neck.y) * u,
          z: neck.z + (pelvis.z - neck.z) * u,
          t: u
        });
      }

      this.trackedDancers.set(spec.id, {
        id: spec.id,
        colorIndex: spec.id,
        landmarks: syntheticLandmarks,
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
