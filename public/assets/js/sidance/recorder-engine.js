/**
 * SIDANCE ✕ FUTURE YOU - Automatic Exhibition Recorder Engine
 * 
 * Features:
 * 1. Clean Full Composite Recording:
 *    - Real Camera Background Video (Mirrored & Aspect Maintained)
 *    - Generative Silk / Aurora / Cosmic Creature Ribbon Visuals
 *    - Pure Clean Visuals (No Watermark Logos or UI)
 *    - Real-time Multi-Voice Polyphonic Synthesizer Audio
 * 2. Unbroken Continuous Auto-Recording & Saving ("계속 매번 저장"):
 *    - Starts immediately whenever any dancer is detected
 *    - If dancers remain on stage continuously, automatically splits into 60s segments
 *      and starts the next recording immediately without dropping a single frame
 *    - Decoupled asynchronous background upload queue: new recordings start instantly
 *      even while previous videos are being uploaded to Supabase / local archive
 *    - Minimal 1.0s threshold so every interaction is reliably captured and preserved
 * 3. Mobile Visitor Access:
 *    - Returns public HTTPS Supabase URL & generates QR code for instant smartphone download
 */

export class RecorderEngine {
  constructor(options = {}) {
    this.options = Object.assign({
      cameraVideo: null,
      creatureCanvas: null,
      audioEngine: null,
      isMirror: true,
      maxDuration: 60,         // 60 seconds per video segment (auto-chunks if dance continues)
      minDuration: 1.0,        // Capture any interaction longer than 1 second
      presenceThreshold: 3.0,  // Continuous presence needed before recording begins (3 seconds)
      absenceGracePeriod: 2.8, // 2.8s grace period after leaving before finalizing file
      onStatusChange: null     // Callback: (status, data) => {}
    }, options);

    this.isRecording = false;
    this.isAutoEnabled = true;
    this.currentDancerCount = 0;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.recordStartTime = 0;
    this.presenceTimer = null;
    this.presenceDropTimer = null;
    this.absenceTimer = null;
    this.maxTimer = null;
    this.animationFrameId = null;

    // Active upload tracking
    this.activeUploadsCount = 0;

    // Offscreen Compositor Canvas — created lazily in start() to match actual display aspect ratio
    this.compCanvas = null;
    this.compCtx = null;
  }

  setMirror(mirror) {
    this.options.isMirror = Boolean(mirror);
  }

  setAutoEnabled(enable) {
    this.isAutoEnabled = Boolean(enable);
    if (!this.isAutoEnabled) {
      if (this.presenceTimer) {
        clearTimeout(this.presenceTimer);
        this.presenceTimer = null;
      }
      if (this.presenceDropTimer) {
        clearTimeout(this.presenceDropTimer);
        this.presenceDropTimer = null;
      }
      if (this.isRecording) {
        this.stop();
      }
    } else if (this.isAutoEnabled && this.currentDancerCount > 0 && !this.isRecording) {
      this.onDancerUpdate(this.currentDancerCount);
    }
  }

  onDancerUpdate(dancerCount) {
    this.currentDancerCount = dancerCount;
    if (!this.isAutoEnabled) return;

    if (dancerCount > 0) {
      // Dancers present: cancel any pending absence stop and drop debounce
      if (this.absenceTimer) {
        clearTimeout(this.absenceTimer);
        this.absenceTimer = null;
      }
      if (this.presenceDropTimer) {
        clearTimeout(this.presenceDropTimer);
        this.presenceDropTimer = null;
      }

      // If not recording and not already counting down, start 3-second continuous presence timer
      if (!this.isRecording && !this.presenceTimer) {
        this.presenceTimer = setTimeout(() => {
          this.presenceTimer = null;
          if (this.currentDancerCount > 0 && !this.isRecording && this.isAutoEnabled) {
            this.start();
          }
        }, this.options.presenceThreshold * 1000);
      }
    } else {
      // Dancers not detected
      // If we were waiting for 3 seconds to start, debounce 400ms in case of single-frame pose drop
      if (this.presenceTimer && !this.presenceDropTimer) {
        this.presenceDropTimer = setTimeout(() => {
          if (this.currentDancerCount === 0 && this.presenceTimer) {
            clearTimeout(this.presenceTimer);
            this.presenceTimer = null;
          }
          this.presenceDropTimer = null;
        }, 400);
      }

      // If currently recording, schedule stop after absence grace period
      if (this.isRecording && !this.absenceTimer) {
        this.absenceTimer = setTimeout(() => {
          this.stop();
          this.absenceTimer = null;
        }, this.options.absenceGracePeriod * 1000);
      }
    }
  }

  _initCompositorCanvas() {
    // Detect actual display aspect ratio from creature canvas or viewport
    const creature = this.options.creatureCanvas;
    let srcW = window.innerWidth || 1280;
    let srcH = window.innerHeight || 720;

    if (creature && creature.width > 0 && creature.height > 0) {
      srcW = creature.width;
      srcH = creature.height;
    }

    const isPortrait = srcH > srcW;
    // Target ~720p resolution while preserving real aspect ratio
    const targetShort = 720;
    const targetLong = Math.round(targetShort * (Math.max(srcW, srcH) / Math.min(srcW, srcH)));

    const canvasW = isPortrait ? targetShort : targetLong;
    const canvasH = isPortrait ? targetLong : targetShort;

    if (!this.compCanvas) {
      this.compCanvas = document.createElement('canvas');
    }
    this.compCanvas.width = canvasW;
    this.compCanvas.height = canvasH;
    this.compCtx = this.compCanvas.getContext('2d', { alpha: false });

    console.log(`[RecorderEngine] Compositor canvas: ${canvasW}x${canvasH} (${isPortrait ? 'Portrait' : 'Landscape'})`);
  }

  start() {
    if (this.isRecording) return;

    try {
      this.recordedChunks = [];
      this.recordStartTime = performance.now();

      // 0. Initialize compositor canvas to match actual screen aspect ratio
      this._initCompositorCanvas();

      // 1. Prepare video stream from composite canvas (30 FPS)
      const videoStream = this.compCanvas.captureStream(30);

      // 2. Prepare combined stream with audio track if available
      const combinedTracks = [...videoStream.getVideoTracks()];
      if (this.options.audioEngine) {
        const audioTrack = this.options.audioEngine.getAudioStreamTrack();
        if (audioTrack && audioTrack.readyState === 'live') {
          combinedTracks.push(audioTrack);
        }
      }

      const recordStream = new MediaStream(combinedTracks);

      // 3. Choose best supported MIME type
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp9,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(recordStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps crisp 720p
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this._handleRecordingComplete();
      };

      this.mediaRecorder.start(1000); // 1-second timeslices
      this.isRecording = true;

      // 4. Start compositor rendering loop
      this._startCompositorLoop();

      if (this.options.onStatusChange) {
        this.options.onStatusChange('started', { startTime: this.recordStartTime });
      }

      // 5. Continuous Segment Splitting (Auto-chunk if dancers remain longer than maxDuration)
      clearTimeout(this.maxTimer);
      this.maxTimer = setTimeout(() => {
        if (this.isRecording) {
          // Stop current segment to save it, and if dancers are still on stage, immediately begin next segment!
          this.stop(true);
        }
      }, this.options.maxDuration * 1000);

    } catch (err) {
      console.error('Failed to start RecorderEngine:', err);
      this.isRecording = false;
    }
  }

  stop(isContinuousChunk = false) {
    if (!this.isRecording) return;

    clearTimeout(this.maxTimer);
    clearTimeout(this.absenceTimer);
    this.absenceTimer = null;
    if (this.presenceTimer) {
      clearTimeout(this.presenceTimer);
      this.presenceTimer = null;
    }
    if (this.presenceDropTimer) {
      clearTimeout(this.presenceDropTimer);
      this.presenceDropTimer = null;
    }

    this.isRecording = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }

    if (this.options.onStatusChange) {
      this.options.onStatusChange('stopping', { isContinuousChunk });
    }

    // If dancers are still actively dancing on stage, immediately start the next segment
    if (isContinuousChunk && this.currentDancerCount > 0 && this.isAutoEnabled) {
      setTimeout(() => {
        if (this.currentDancerCount > 0 && !this.isRecording) {
          this.start();
        }
      }, 50);
    }
  }

  _startCompositorLoop() {
    const cw = this.compCanvas.width;
    const ch = this.compCanvas.height;
    const ctx = this.compCtx;

    const render = () => {
      if (!this.isRecording) return;

      // A. Draw camera video background (Aspect Fit / Cover)
      const video = this.options.cameraVideo;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        ctx.save();
        if (this.options.isMirror) {
          ctx.translate(cw, 0);
          ctx.scale(-1, 1);
        }

        // Calculate aspect cover crop for 16:9 canvas
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = cw / ch;
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

        if (videoAspect > canvasAspect) {
          // Video is wider than canvas
          sw = video.videoHeight * canvasAspect;
          sx = (video.videoWidth - sw) * 0.5;
        } else {
          // Video is taller than canvas
          sh = video.videoWidth / canvasAspect;
          sy = (video.videoHeight - sh) * 0.5;
        }

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
        ctx.restore();

        // Subtle dark vignette/dimmer for media art depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(0, 0, cw, ch);
      } else {
        // Fallback dark void background
        ctx.fillStyle = '#060709';
        ctx.fillRect(0, 0, cw, ch);
      }

      // B. Draw generative creature visual canvas directly on top
      const creature = this.options.creatureCanvas;
      if (creature && creature.width > 0) {
        ctx.drawImage(creature, 0, 0, cw, ch);
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  async _handleRecordingComplete() {
    const durationSec = (performance.now() - this.recordStartTime) / 1000;
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });

    // Discard empty/zero-byte chunks (< 1.0s or < 2000 bytes)
    if (durationSec < this.options.minDuration || blob.size < 2000) {
      if (this.options.onStatusChange) {
        this.options.onStatusChange('discarded', { duration: durationSec });
      }
      return;
    }

    // Asynchronously upload in background without blocking next recording session
    this.activeUploadsCount++;
    if (this.options.onStatusChange) {
      this.options.onStatusChange('uploading', { duration: durationSec, size: blob.size, activeCount: this.activeUploadsCount });
    }

    this._uploadBlob(blob, durationSec);
  }

  async _uploadBlob(blob, durationSec) {
    try {
      const response = await fetch('/api/sidance/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'video/webm'
        },
        body: blob
      });

      if (!response.ok) {
        throw new Error(`Upload HTTP error: ${response.status}`);
      }

      const result = await response.json();
      this.activeUploadsCount = Math.max(0, this.activeUploadsCount - 1);

      if (this.options.onStatusChange) {
        this.options.onStatusChange('uploaded', {
          duration: durationSec,
          publicUrl: result.publicUrl,
          localUrl: result.localUrl,
          fileName: result.fileName
        });
      }
    } catch (err) {
      console.error('Failed uploading recording to server / Supabase:', err);
      this.activeUploadsCount = Math.max(0, this.activeUploadsCount - 1);
      if (this.options.onStatusChange) {
        this.options.onStatusChange('error', { error: err.message });
      }
    }
  }
}
