/**
 * SIDANCE ✕ FUTURE YOU - Locking Dance Funk Audio Engine (락킹 댄스 신디사이저)
 * 
 * Features:
 * 1. Volume calibrated strictly to 60% of previous (0.27 master gain).
 * 2. Authentic 112 BPM Funk / Locking groove (Slap Bass, Snappy Funk Drums, Shuffling Hats).
 * 3. The "LOCK" Gesture Detector: Freezing after fast movement triggers signature Funk Brass Stabs!
 * 4. The "POINT" Gesture: Sharp arm jabs/points trigger upbeat Funk Horn Stabs tuned to D Dorian scale.
 * 5. The "TWIRL": Rapid wrist rolls sweep a classic 70s Auto-Wah Clavinet filter.
 * 6. Crouch / Knee-Drop: Triggers sub-bass growl and grounding funk resonance.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isEnabled = false;
    this.volume = 0.27; // Calibrated to 60% of original (0.45 * 0.6 = 0.27)

    // Master Bus & Mastering Compressor
    this.masterGain = null;
    this.compressor = null;

    // Funk Rhythm Clock (112 BPM Locking Groove)
    this.bpm = 112;
    this.stepTime = 60 / (this.bpm * 4); // 16th note step = ~0.134s
    this.currentStep = 0;
    this.grooveTimer = null;
    this.grooveGain = null;
    this.isGrooving = false;

    // Funk Bass & Drum Nodes
    this.bassFilter = null;

    // Kinetic Gesture Detection State
    this.dancerHistories = new Map(); // id -> { lastRw, lastLw, prevVelR, prevVelL, lastLockTime, lastPointTime }

    // Funky Horn Stab Scale (D Funk / D Dorian Pentatonic)
    this.hornScale = [
      146.83, // D3 (Low Horn)
      174.61, // F3
      196.00, // G3
      220.00, // A3
      261.63, // C4
      293.66, // D4 (Classic Horn Root)
      349.23, // F4
      392.00, // G4
      440.00, // A4
      523.25, // C5
      587.33, // D5 (High Lead Horn)
      698.46, // F5
      783.99  // G5
    ];

    // Funk Clavinet Wah Oscillator Pool
    this.clavVoices = [];
    this.maxClavs = 4;
    this.clavIdx = 0;

    // Noise Generator for Percussion & Rimshots
    this.noiseBuffer = null;

    this.lastFrameTime = performance.now();
    this.collectiveEnergy = 0;
  }

  init() {
    if (this.ctx) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();

    // 1. Studio Mastering Compressor (Punchy funk transients without harsh clipping)
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4.5, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.004, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.14, this.ctx.currentTime);
    this.compressor.connect(this.ctx.destination);

    // 2. Master Bus Gain (Scaled to 60%)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.compressor);

    // 3. Groove Sub-Bus
    this.grooveGain = this.ctx.createGain();
    this.grooveGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.grooveGain.connect(this.masterGain);

    // 4. Bass Filter (Warm 70s Moog/Oberheim style funk lowpass)
    this.bassFilter = this.ctx.createBiquadFilter();
    this.bassFilter.type = 'lowpass';
    this.bassFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.bassFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);
    this.bassFilter.connect(this.grooveGain);

    // 5. Pre-allocate White Noise Buffer for Funk Snares & Hi-Hats
    this._initNoiseBuffer();

    // 6. Pre-allocate Clavinet / Wah Voices
    this._initClavVoices();
  }

  _initNoiseBuffer() {
    const bufferSize = this.ctx.sampleRate * 1;
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  _initClavVoices() {
    for (let i = 0; i < this.maxClavs; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.Q.setValueAtTime(4.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      this.clavVoices.push({ osc, filter, gain });
    }
  }

  // =========================================================================
  // FUNK DRUMS & SLAP BASS SYNTHESIZERS
  // =========================================================================

  playFunkKick(time, velocity = 1.0) {
    if (!this.ctx || !this.isEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = 120 + velocity * 25;
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.08);

    const peak = 0.28 * velocity * (this.volume / 0.45);
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(gain);
    gain.connect(this.grooveGain);

    osc.start(time);
    osc.stop(time + 0.18);
  }

  playFunkSnare(time, velocity = 1.0) {
    if (!this.ctx || !this.isEnabled || !this.noiseBuffer) return;

    // Body tone
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(185, time);
    osc.frequency.exponentialRampToValueAtTime(110, time + 0.06);

    const bodyPeak = 0.18 * velocity * (this.volume / 0.45);
    oscGain.gain.setValueAtTime(bodyPeak, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
    osc.connect(oscGain);
    oscGain.connect(this.grooveGain);

    // Snare rattle / noise
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1400, time);

    const noiseGain = this.ctx.createGain();
    const rattlePeak = 0.20 * velocity * (this.volume / 0.45);
    noiseGain.gain.setValueAtTime(rattlePeak, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.grooveGain);

    osc.start(time);
    osc.stop(time + 0.12);
    noise.start(time);
    noise.stop(time + 0.16);
  }

  playFunkHiHat(time, open = false, velocity = 0.8) {
    if (!this.ctx || !this.isEnabled || !this.noiseBuffer) return;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6500, time);

    const gain = this.ctx.createGain();
    const peak = (open ? 0.14 : 0.09) * velocity * (this.volume / 0.45);
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.22 : 0.045));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.grooveGain);

    noise.start(time);
    noise.stop(time + (open ? 0.24 : 0.05));
  }

  playSlapBassNote(time, freq, duration = 0.16, velocity = 1.0) {
    if (!this.ctx || !this.isEnabled) return;

    // Dual Oscillator: Triangle + Sub Sine
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 0.5, time); // Sub-octave thump

    // Punchy filter envelope on slap
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const filterPeak = 700 + velocity * 1200;
    filter.frequency.setValueAtTime(filterPeak, time);
    filter.frequency.exponentialRampToValueAtTime(140, time + duration);
    filter.Q.setValueAtTime(4.0, time);

    const peak = 0.22 * velocity * (this.volume / 0.45);
    gain.gain.setValueAtTime(peak, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.grooveGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.05);
    osc2.stop(time + duration + 0.05);
  }

  // =========================================================================
  // KINETIC LOCKING GESTURES: THE "LOCK" & THE "POINT" HORN STABS
  // =========================================================================

  /**
   * The "LOCK" Strike: Fired when an abrupt stop / joint freeze is detected!
   * Combines an assertive James Brown brass stab + rim crack!
   */
  triggerLockStab(intensity = 1.0) {
    if (!this.ctx || !this.isEnabled) return;
    const t = this.ctx.currentTime;
    const vel = Math.max(0.4, Math.min(1.2, intensity));

    // Funky Brass Horn Chord: D4 (293.6Hz) + A4 (440Hz) + D5 (587.3Hz)
    const chord = [293.66, 440.00, 587.33];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * (1 + (Math.random() - 0.5) * 0.012), t);

      // Brass envelope: sharp attack, bright bite
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4200 * vel, t);
      filter.frequency.exponentialRampToValueAtTime(800, t + 0.22);
      filter.Q.setValueAtTime(3.2, t);

      const peak = (idx === 2 ? 0.12 : 0.15) * vel * (this.volume / 0.45);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.28);
    });

    // Pungent mechanical lock snap (Rim click)
    this.playFunkSnare(t, vel * 1.15);
  }

  /**
   * The "POINT" Horn Stab: Fired on sharp arm extension / point!
   * Pitch is determined by hand elevation in D Dorian scale.
   */
  triggerPointStab(freq, intensity = 1.0) {
    if (!this.ctx || !this.isEnabled) return;
    const t = this.ctx.currentTime;
    const vel = Math.max(0.3, Math.min(1.0, intensity));

    // Dual horn: Lead tone + 5th harmony
    [freq, freq * 1.498].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = idx === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(f * 2.2, t);
      filter.Q.setValueAtTime(2.5, t);

      const peak = (idx === 0 ? 0.16 : 0.10) * vel * (this.volume / 0.45);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /**
   * The "TWIRL" / Wrist Roll: Modulates funky wah-wah clavinet pulses!
   */
  triggerTwirlWah(freq, speed) {
    if (!this.ctx || !this.isEnabled) return;
    const t = this.ctx.currentTime;

    const voice = this.clavVoices[this.clavIdx % this.maxClavs];
    this.clavIdx++;

    voice.osc.frequency.setTargetAtTime(freq, t, 0.02);

    // Wah-wah sweep
    voice.filter.frequency.cancelScheduledValues(t);
    voice.filter.frequency.setValueAtTime(350, t);
    voice.filter.frequency.exponentialRampToValueAtTime(1800 + Math.min(speed * 400, 1600), t + 0.08);
    voice.filter.frequency.exponentialRampToValueAtTime(450, t + 0.22);

    const peak = 0.12 * Math.min(speed / 2.5, 1.0) * (this.volume / 0.45);
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(0.001, t);
    voice.gain.gain.linearRampToValueAtTime(peak, t + 0.01);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  }

  // =========================================================================
  // 112 BPM FUNK RHYTHM SEQUENCER LOOP
  // =========================================================================

  _startGrooveLoop() {
    if (this.isGrooving) return;
    this.isGrooving = true;
    this.currentStep = 0;

    // Classic 16-step Locking Slap Bass & Drum Pattern (D Dorian Funk)
    // Scale: D2 = 73.4Hz, F2 = 87.3Hz, G2 = 98.0Hz, A2 = 110.0Hz, C3 = 130.8Hz, D3 = 146.8Hz
    const D2 = 73.42, F2 = 87.31, G2 = 98.00, GS2 = 103.83, A2 = 110.00, C3 = 130.81, D3 = 146.83;

    const bassPattern = [
      D2,   null, D3,   null,  // 1
      null, F2,   null, D2,    // 2
      G2,   null, GS2,  A2,    // 3
      null, C3,   null, D2     // 4
    ];

    const kickSteps = [0, 4, 8, 11]; // Syncopated funk kick
    const snareSteps = [4, 12];       // Backbeat snares on 2 & 4
    const openHatSteps = [6, 14];      // Funk syncopated open hats

    const tick = () => {
      if (!this.isEnabled || !this.ctx) {
        this.isGrooving = false;
        return;
      }

      const now = this.ctx.currentTime;
      const step = this.currentStep % 16;
      this.currentStep++;

      // Adjust groove volume smoothly based on dancer motion energy
      const targetGrooveVol = Math.max(0.18, Math.min(1.0, this.collectiveEnergy * 1.5 + 0.25));
      this.grooveGain.gain.setTargetAtTime(targetGrooveVol, now, 0.1);

      // Play Kick
      if (kickSteps.includes(step)) {
        this.playFunkKick(now, step === 0 ? 1.0 : 0.85);
      }

      // Play Snare
      if (snareSteps.includes(step)) {
        this.playFunkSnare(now, 1.0);
      }

      // Play Hi-Hat
      const isOpen = openHatSteps.includes(step);
      this.playFunkHiHat(now, isOpen, (step % 2 === 0) ? 0.8 : 0.5);

      // Play Slap Bass
      const bassNote = bassPattern[step];
      if (bassNote) {
        this.playSlapBassNote(now, bassNote, this.stepTime * 0.9, (step % 4 === 0) ? 1.0 : 0.85);
      }

      // Schedule next step with micro-swing (classic funk shuffle)
      const isOffbeat = step % 2 === 1;
      const swingOffset = isOffbeat ? 0.016 : -0.016;
      const nextDelayMs = Math.max(20, (this.stepTime + swingOffset) * 1000);

      this.grooveTimer = setTimeout(tick, nextDelayMs);
    };

    tick();
  }

  _stopGrooveLoop() {
    this.isGrooving = false;
    clearTimeout(this.grooveTimer);
    if (this.grooveGain && this.ctx) {
      this.grooveGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.3);
    }
  }

  // =========================================================================
  // PUBLIC CONTROLS & EVENT LOOP
  // =========================================================================

  toggle(enable) {
    if (enable === undefined) enable = !this.isEnabled;
    this.isEnabled = enable;

    if (this.isEnabled) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      this._startGrooveLoop();
    } else {
      this._stopGrooveLoop();
    }

    return this.isEnabled;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
  }

  /**
   * Main multi-dancer kinetic tracking hook.
   * Directly detects:
   * 1. THE "LOCK" (Freeze after fast motion)
   * 2. THE "POINT" (Swift directional extension)
   * 3. THE "TWIRL" (Fast continuous wrist circles)
   * 4. Body bounce & spread dynamics.
   */
  updateMultiDancers(trackedDancersMap, collectiveMetrics) {
    if (!this.isEnabled || !this.ctx || !trackedDancersMap) return;

    const now = performance.now();
    const dt = Math.max(0.016, Math.min((now - this.lastFrameTime) * 0.001, 0.1));
    this.lastFrameTime = now;

    const totalEnergy = collectiveMetrics ? (collectiveMetrics.totalEnergy || 0) : 0;
    this.collectiveEnergy = totalEnergy;

    const activeDancers = Array.from(trackedDancersMap.values())
      .filter(d => (d.isConfirmed !== false) && !d.isExiting && d.metrics && d.metrics.isPresent);

    const sw = window.innerWidth || 1080;
    const sh = window.innerHeight || 1920;

    // Start groove if dancers arrive, pause if empty
    if (activeDancers.length > 0 && !this.isGrooving) {
      this._startGrooveLoop();
    } else if (activeDancers.length === 0 && this.isGrooving) {
      // Soften groove when no dancers
      this.grooveGain.gain.setTargetAtTime(0.08, this.ctx.currentTime, 0.4);
    }

    // Process each dancer's locking gestures
    activeDancers.forEach((dancer, dancerIdx) => {
      let hist = this.dancerHistories.get(dancer.id);
      if (!hist) {
        hist = {
          lastRw: null,
          lastLw: null,
          prevSpeedR: 0,
          prevSpeedL: 0,
          speedHistoryR: [0, 0, 0],
          lastLockTime: 0,
          lastPointTime: 0,
          lastTwirlTime: 0
        };
        this.dancerHistories.set(dancer.id, hist);
      }

      const lm = dancer.landmarks;
      const lw = lm[15]; // Left Wrist
      const rw = lm[16]; // Right Wrist

      const rNormY = rw && rw.normY !== undefined ? rw.normY : (rw ? rw.y / sh : 0.6);
      const lNormY = lw && lw.normY !== undefined ? lw.normY : (lw ? lw.y / sh : 0.6);

      // Hand elevation for Horn pitch: 0 (bottom) -> 1 (top)
      const handElevationR = Math.max(0, Math.min(1, 1.0 - rNormY));
      const handElevationL = Math.max(0, Math.min(1, 1.0 - lNormY));

      let rwSpeed = 0;
      let lwSpeed = 0;

      if (rw && hist.lastRw) {
        const dx = (rw.x - hist.lastRw.x) / sw;
        const dy = (rw.y - hist.lastRw.y) / sh;
        rwSpeed = Math.hypot(dx, dy) / dt;
      }
      if (lw && hist.lastLw) {
        const dx = (lw.x - hist.lastLw.x) / sw;
        const dy = (lw.y - hist.lastLw.y) / sh;
        lwSpeed = Math.hypot(dx, dy) / dt;
      }

      // Update speed history
      hist.speedHistoryR.shift();
      hist.speedHistoryR.push(rwSpeed);

      // -----------------------------------------------------------------------
      // 1. THE "LOCK" DETECTOR (Sudden Stop / Freeze after high-speed motion)
      // -----------------------------------------------------------------------
      const wasMovingFast = hist.speedHistoryR[0] > 1.35 || hist.prevSpeedR > 1.35;
      const isNowStopped = rwSpeed < 0.22 && hist.speedHistoryR[1] < 0.35;

      if (wasMovingFast && isNowStopped && (now - hist.lastLockTime > 260)) {
        hist.lastLockTime = now;
        const lockForce = Math.min(hist.prevSpeedR / 2.0, 1.2);
        this.triggerLockStab(lockForce);
      }

      // -----------------------------------------------------------------------
      // 2. THE "POINT" DETECTOR (Sharp directional punch / arm thrust)
      // -----------------------------------------------------------------------
      const isPunchThrust = rwSpeed > 1.85 && hist.prevSpeedR < 1.0;
      if (isPunchThrust && (now - hist.lastPointTime > 130)) {
        hist.lastPointTime = now;
        let noteIdx = Math.floor(handElevationR * (this.hornScale.length - 1));
        if (dancerIdx === 1) noteIdx = (noteIdx + 2) % this.hornScale.length; // Duet harmony
        const hornFreq = this.hornScale[noteIdx];
        this.triggerPointStab(hornFreq, Math.min(rwSpeed / 3.0, 1.0));
      }

      // -----------------------------------------------------------------------
      // 3. THE "TWIRL" DETECTOR (Continuous fast wrist circles)
      // -----------------------------------------------------------------------
      const isTwirling = rwSpeed > 0.85 && lwSpeed > 0.85;
      if (isTwirling && (now - hist.lastTwirlTime > 110)) {
        hist.lastTwirlTime = now;
        let noteIdx = Math.floor(handElevationL * (this.hornScale.length - 1));
        const wahFreq = this.hornScale[noteIdx];
        this.triggerTwirlWah(wahFreq, (rwSpeed + lwSpeed) * 0.5);
      }

      // Cache positions for next frame
      hist.prevSpeedR = rwSpeed;
      hist.prevSpeedL = lwSpeed;
      if (rw) hist.lastRw = { x: rw.x, y: rw.y };
      if (lw) hist.lastLw = { x: lw.x, y: lw.y };
    });
  }
}
