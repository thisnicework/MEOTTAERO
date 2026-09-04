/**
 * SIDANCE ✕ FUTURE YOU - Multi-Person Polyphonic Audio Engine
 * Reactive multi-voice synthesizer using the Web Audio API.
 * Expands dynamically from solo to polyphonic harmony as multiple dancers enter the stage.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isEnabled = false;
    this.volume = 0.45;

    this.masterGain = null;
    this.droneGain = null;
    this.filter = null;
    this.delayNode = null;
    this.delayGain = null;

    // Polyphonic Lead Voices (up to 4 dancers)
    this.voices = [];
    this.noiseGain = null;

    // Ethereal D Minor Pentatonic Scale
    this.scale = [
      146.83, 174.61, 196.00, 220.00, 261.63,
      293.66, 349.23, 392.00, 440.00, 523.25,
      587.33, 698.46, 783.99, 880.00, 1046.50
    ];

    this.lastTotalEnergy = 0;
  }

  init() {
    if (this.ctx) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    this.ctx = new AudioContext();

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Dynamic Filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(3.5, this.ctx.currentTime);
    this.filter.connect(this.masterGain);

    // Stereo Hall Delay
    this.delayNode = this.ctx.createDelay();
    this.delayNode.delayTime.setValueAtTime(0.36, this.ctx.currentTime);
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.setValueAtTime(0.32, this.ctx.currentTime);

    this.filter.connect(this.delayNode);
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.delayNode);
    this.delayGain.connect(this.masterGain);

    // Grounding Drone (D2, A2, D3)
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.droneGain.connect(this.filter);

    [73.42, 110.00, 146.83].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.connect(this.droneGain);
      osc.start();
    });

    // 4 Polyphonic Synthesizer Voices
    for (let v = 0; v < 4; v++) {
      const vGain = this.ctx.createGain();
      vGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      vGain.connect(this.filter);

      const osc = this.ctx.createOscillator();
      osc.type = (v % 2 === 0) ? 'sawtooth' : 'sine';
      osc.frequency.setValueAtTime(293.66 * (1 + v * 0.25), this.ctx.currentTime);
      osc.connect(vGain);
      osc.start();

      this.voices.push({ osc, gain: vGain, currentFreq: 293.66 });
    }

    // Motion Whoosh Noise
    this._setupNoise();
  }

  _setupNoise() {
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain);

    whiteNoise.start();
  }

  toggle(enable) {
    if (enable === undefined) enable = !this.isEnabled;
    this.isEnabled = enable;

    if (this.isEnabled) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.5);
      }
    } else {
      if (this.droneGain) {
        this.droneGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.3);
      }
      this.voices.forEach(v => {
        v.gain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.3);
      });
    }

    return this.isEnabled;
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.1);
    }
  }

  updateMultiDancers(trackedDancersMap, collectiveMetrics) {
    if (!this.isEnabled || !this.ctx || !trackedDancersMap) return;

    const t = this.ctx.currentTime;
    const dancerCount = collectiveMetrics ? (collectiveMetrics.dancerCount || 0) : 0;
    const totalEnergy = collectiveMetrics ? (collectiveMetrics.totalEnergy || 0) : 0;

    // 1. Dynamic Filter opening proportional to collective energy and dancer count
    const targetCutoff = dancerCount === 0 ? 320 : 380 + Math.min(totalEnergy * 1400 + dancerCount * 300, 4200);
    this.filter.frequency.setTargetAtTime(targetCutoff, t, 0.09);

    // 2. Map confirmed active dancers to polyphonic voices
    const activeDancers = Array.from(trackedDancersMap.values())
      .filter(d => (d.isConfirmed !== false) && !d.isExiting && d.metrics && d.metrics.isPresent);

    for (let i = 0; i < this.voices.length; i++) {
      const voice = this.voices[i];
      const dancer = activeDancers[i];

      if (dancer) {
        const lw = dancer.landmarks[15];
        const rw = dancer.landmarks[16];
        const handY = Math.max(lw ? lw.y : 0, rw ? rw.y : 0);

        // Map height to pitch with harmonious harmonic offset per dancer
        const normY = Math.max(0, Math.min(1, (handY + 0.6) / 2.0));
        let noteIdx = Math.floor(normY * (this.scale.length - 1));
        // Add musical offset for polyphony: Dancer 2 plays 3rd/5th harmonic
        if (i === 1) noteIdx = (noteIdx + 2) % this.scale.length;
        if (i === 2) noteIdx = (noteIdx + 4) % this.scale.length;

        const targetFreq = this.scale[noteIdx];
        voice.osc.frequency.setTargetAtTime(targetFreq, t, 0.08);

        // Voice volume based on dancer's individual energy
        const voiceVol = Math.min((dancer.metrics.energy || 0) * 0.18, 0.22);
        voice.gain.gain.setTargetAtTime(voiceVol, t, 0.1);
      } else {
        // Silence inactive voices
        voice.gain.gain.setTargetAtTime(0.0, t, 0.2);
      }
    }

    // 3. Collective whoosh noise on sudden group acceleration
    const accel = Math.max(0, totalEnergy - this.lastTotalEnergy);
    this.lastTotalEnergy = totalEnergy;
    if (accel > 0.35 && this.noiseGain) {
      this.noiseGain.gain.cancelScheduledValues(t);
      this.noiseGain.gain.setValueAtTime(Math.min(accel * 0.15, 0.14), t);
      this.noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    }
  }
}
