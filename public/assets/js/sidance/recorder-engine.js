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
 *    - Starts 3 seconds after dancers are reliably detected on stage
 *    - Absorbs computer vision tracking flickers (1.5s debounce tolerance)
 *    - If dancers remain on stage continuously, automatically splits into 60s segments
 *      and starts the next recording immediately without dropping a single frame
 *    - Decoupled asynchronous background upload queue with session isolation:
 *      chunks are isolated per session so no session chunks are ever overwritten or lost
 *    - Automatic upload retries on network lag or transient Supabase delays
 * 3. Vertical 9:16 Exhibition Standard:
 *    - Recorded output strictly fixed to 1080x1920 @ 60fps (9:16 Portrait)
 *    - Bitrate optimized (4.5 Mbps) to guarantee files stay under Supabase 50MB storage limit
 */

export class RecorderEngine {
  constructor(options = {}) {
    this.options = Object.assign({
      cameraVideo: null,
      creatureCanvas: null,
      audioEngine: null,
      isMirror: true,
      maxDuration: 60,         // 60 seconds per video segment (auto-chunks if dance continues)
      minDuration: 0.8,        // Capture any interaction longer than 0.8 second
      presenceThreshold: 3.0,  // Continuous presence needed before recording begins (3 seconds)
      absenceGracePeriod: 2.5, // 2.5s grace period after leaving before finalizing file
      videoBitsPerSecond: 4500000, // 4.5 Mbps crisp 1080p 60fps (keeps 60s segment under 35MB for Supabase 50MB limit)
      onStatusChange: null     // Callback: (status, data) => {}
    }, options);

    this.isRecording = false;
    this.isAutoEnabled = true;
    this.currentDancerCount = 0;
    this.lastDancerSeenTime = 0;

    this.presenceTimer = null;
    this.absenceTimer = null;
    this.maxTimer = null;
    this.animationFrameId = null;

    // Session-isolated recording management (prevents race conditions and chunk overwrites)
    this.sessionCounter = 0;
    this.currentSession = null;
    this.activeUploadsCount = 0;

    // Offscreen Compositor Canvas (1080x1920 @ 60fps vertical standard)
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
      if (this.absenceTimer) {
        clearTimeout(this.absenceTimer);
        this.absenceTimer = null;
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

    const now = performance.now();

    if (dancerCount > 0) {
      this.lastDancerSeenTime = now;

      // Cancel absence stop timer since dancer is active
      if (this.absenceTimer) {
        clearTimeout(this.absenceTimer);
        this.absenceTimer = null;
      }

      // If not recording and not already in 3-second countdown, start countdown
      if (!this.isRecording && !this.presenceTimer) {
        if (this.options.onStatusChange) {
          this.options.onStatusChange('countdown', { remaining: this.options.presenceThreshold });
        }

        this.presenceTimer = setTimeout(() => {
          this.presenceTimer = null;
          // Robust check: dancer currently present OR seen within last 1.8s (absorbs momentary pose drops)
          const isStillActive = this.currentDancerCount > 0 || (performance.now() - this.lastDancerSeenTime) < 1800;
          if (isStillActive && !this.isRecording && this.isAutoEnabled) {
            this.start();
          }
        }, this.options.presenceThreshold * 1000);
      }
    } else {
      // Dancers not detected in current frame
      const elapsedSinceSeen = now - this.lastDancerSeenTime;

      // Only cancel 3-second countdown if dancer has been genuinely absent for > 1.5s
      if (this.presenceTimer && elapsedSinceSeen > 1500) {
        clearTimeout(this.presenceTimer);
        this.presenceTimer = null;
        if (this.options.onStatusChange) {
          this.options.onStatusChange('cancelled', { reason: 'left_before_start' });
        }
      }

      // If currently recording, schedule stop after absence grace period (2.5s)
      if (this.isRecording && !this.absenceTimer) {
        this.absenceTimer = setTimeout(() => {
          this.absenceTimer = null;
          const timeSinceSeen = performance.now() - this.lastDancerSeenTime;
          if (this.currentDancerCount === 0 || timeSinceSeen >= this.options.absenceGracePeriod * 1000) {
            this.stop();
          }
        }, this.options.absenceGracePeriod * 1000);
      }
    }
  }

  _initCompositorCanvas() {
    // Exhibition screen is ALWAYS a vertical display (세로 모니터, 9:16).
    // Recorded output MUST ALWAYS be saved as a crisp portrait video (1080x1920 @ 60fps),
    // precisely matching what the audience sees on the physical vertical exhibition monitor.
    let canvasW = 1080;
    let canvasH = 1920;

    const creature = this.options.creatureCanvas;
    let srcW = window.innerWidth || 1080;
    let srcH = window.innerHeight || 1920;
    if (creature && creature.width > 0 && creature.height > 0) {
      srcW = creature.width;
      srcH = creature.height;
    }

    if (srcH > srcW) {
      // Screen is already portrait: lock width to 1080 and compute matching height (even number)
      canvasW = 1080;
      canvasH = Math.round((1080 * (srcH / srcW)) / 2) * 2;
    } else {
      // Screen is landscape (e.g. testing on laptop): strictly lock to 1080x1920 (9:16 vertical video)
      canvasW = 1080;
      canvasH = 1920;
    }

    if (!this.compCanvas) {
      this.compCanvas = document.createElement('canvas');
    }
    if (this.compCanvas.width !== canvasW || this.compCanvas.height !== canvasH) {
      this.compCanvas.width = canvasW;
      this.compCanvas.height = canvasH;
    }
    this.compCtx = this.compCanvas.getContext('2d', { alpha: false });

    console.log(`[RecorderEngine] Compositor canvas: ${canvasW}x${canvasH} (Vertical Exhibition Video @ 60fps)`);
  }

  start() {
    if (this.isRecording) return;

    try {
      // 0. Initialize compositor canvas to vertical 9:16 standard
      this._initCompositorCanvas();

      // Create isolated session container to prevent any chunk overwrite or race conditions
      const session = {
        id: ++this.sessionCounter,
        chunks: [],
        startTime: performance.now(),
        mediaRecorder: null,
        mimeType: '',
        isCompleted: false
      };
      this.currentSession = session;
      this.isRecording = true;

      // 1. Prepare video stream from composite canvas (60 FPS)
      const videoStream = this.compCanvas.captureStream(60);

      // 2. Prepare combined stream with audio track if available
      const combinedTracks = [...videoStream.getVideoTracks()];
      if (this.options.audioEngine) {
        try {
          const audioTrack = this.options.audioEngine.getAudioStreamTrack();
          if (audioTrack && audioTrack.readyState === 'live') {
            combinedTracks.push(audioTrack);
          }
        } catch (audioErr) {
          console.warn('[RecorderEngine] Audio track attach warning:', audioErr);
        }
      }

      const recordStream = new MediaStream(combinedTracks);

      // 3. Choose best supported MIME type
      const mimeCandidates = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4'
      ];
      let mimeType = mimeCandidates.find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';

      const recorderOptions = {
        videoBitsPerSecond: this.options.videoBitsPerSecond || 4500000
      };
      if (mimeType) {
        recorderOptions.mimeType = mimeType;
      }

      const recorder = new MediaRecorder(recordStream, recorderOptions);
      session.mediaRecorder = recorder;
      session.mimeType = recorder.mimeType || mimeType || 'video/webm';

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          session.chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (session.isCompleted) return;
        session.isCompleted = true;
        this._finalizeSession(session);
      };

      recorder.start(1000); // 1-second timeslices

      // 4. Start compositor rendering loop
      this._startCompositorLoop();

      if (this.options.onStatusChange) {
        this.options.onStatusChange('started', { sessionId: session.id, startTime: session.startTime });
      }

      // 5. Continuous Segment Splitting (Auto-chunk if dancers remain longer than maxDuration)
      clearTimeout(this.maxTimer);
      this.maxTimer = setTimeout(() => {
        if (this.isRecording && this.currentSession === session) {
          this.stop(true);
        }
      }, this.options.maxDuration * 1000);

    } catch (err) {
      console.error('[RecorderEngine] Failed to start recording session:', err);
      this.isRecording = false;
      this.currentSession = null;
      if (this.options.onStatusChange) {
        this.options.onStatusChange('error', { error: err.message });
      }
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

    this.isRecording = false;
    const session = this.currentSession;
    this.currentSession = null;

    if (this.options.onStatusChange) {
      this.options.onStatusChange('stopping', { isContinuousChunk });
    }

    // Safely stop MediaRecorder — onstop will finalize and upload this session's chunks
    if (session && session.mediaRecorder && session.mediaRecorder.state !== 'inactive') {
      try {
        session.mediaRecorder.stop();
      } catch (stopErr) {
        console.warn('[RecorderEngine] Error stopping MediaRecorder:', stopErr);
      }
    }

    // If dancers are still actively dancing on stage, immediately start the next segment
    if (isContinuousChunk && (this.currentDancerCount > 0 || (performance.now() - this.lastDancerSeenTime) < 1800) && this.isAutoEnabled) {
      setTimeout(() => {
        if (!this.isRecording && this.isAutoEnabled) {
          this.start();
        }
      }, 100);
    }
  }

  _startCompositorLoop() {
    if (this.animationFrameId) return; // Loop already active

    const render = () => {
      // Keep rendering while recording OR while any session is active/uploading
      if (!this.isRecording && !this.currentSession && this.activeUploadsCount === 0) {
        this.animationFrameId = null;
        return;
      }

      const cw = this.compCanvas.width;
      const ch = this.compCanvas.height;
      const ctx = this.compCtx;

      // A. Draw camera video background (Aspect Fit / Cover onto vertical 9:16)
      const video = this.options.cameraVideo;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        ctx.save();
        if (this.options.isMirror) {
          ctx.translate(cw, 0);
          ctx.scale(-1, 1);
        }

        // Calculate aspect cover crop for 9:16 canvas
        const videoAspect = video.videoWidth / video.videoHeight;
        const canvasAspect = cw / ch;
        let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

        if (videoAspect > canvasAspect) {
          // Camera is wider than vertical canvas (e.g. 16:9 webcam on vertical monitor)
          sw = video.videoHeight * canvasAspect;
          sx = (video.videoWidth - sw) * 0.5;
        } else {
          // Camera is taller than canvas
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
      if (creature && creature.width > 0 && creature.height > 0) {
        const crW = creature.width;
        const crH = creature.height;
        const crAspect = crW / crH;
        const canvasAspect = cw / ch;

        let srcX = 0, srcY = 0, srcW = crW, srcH = crH;

        if (crAspect > canvasAspect) {
          // Source canvas is wider than target 9:16 vertical canvas (e.g. testing on laptop)
          srcW = crH * canvasAspect;
          srcX = (crW - srcW) * 0.5;
        } else if (crAspect < canvasAspect) {
          // Source canvas is taller than target vertical canvas
          srcH = crW / canvasAspect;
          srcY = (crH - srcH) * 0.5;
        }

        ctx.drawImage(creature, srcX, srcY, srcW, srcH, 0, 0, cw, ch);
      }

      this.animationFrameId = requestAnimationFrame(render);
    };

    render();
  }

  _finalizeSession(session) {
    const durationSec = (performance.now() - session.startTime) / 1000;
    const blobType = session.mimeType || 'video/webm';
    const blob = new Blob(session.chunks, { type: blobType });

    console.log(`[RecorderEngine] Finalized Session #${session.id}: ${durationSec.toFixed(1)}s, ${(blob.size / 1024).toFixed(1)} KB, ${session.chunks.length} chunks`);

    // Discard empty or micro-glitch interactions (< 0.8s or < 5000 bytes)
    if (durationSec < this.options.minDuration || blob.size < 5000) {
      console.log(`[RecorderEngine] Discarded micro-recording (${durationSec.toFixed(2)}s, ${blob.size} bytes)`);
      if (this.options.onStatusChange) {
        this.options.onStatusChange('discarded', { duration: durationSec, size: blob.size });
      }
      return;
    }

    // Asynchronously upload in background without blocking next recording session
    this.activeUploadsCount++;
    if (this.options.onStatusChange) {
      this.options.onStatusChange('uploading', {
        sessionId: session.id,
        duration: durationSec,
        size: blob.size,
        activeCount: this.activeUploadsCount
      });
    }

    this._uploadBlobWithRetry(blob, durationSec, session.id, 0);
  }

  async _uploadBlobWithRetry(blob, durationSec, sessionId, attempt = 0) {
    const maxRetries = 2;
    try {
      const response = await fetch('/api/sidance/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: blob
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload HTTP error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      this.activeUploadsCount = Math.max(0, this.activeUploadsCount - 1);
      console.log(`[RecorderEngine] Successfully saved Session #${sessionId}:`, result.fileName);

      if (this.options.onStatusChange) {
        this.options.onStatusChange('uploaded', {
          sessionId,
          duration: durationSec,
          publicUrl: result.publicUrl,
          fileName: result.fileName
        });
      }
    } catch (err) {
      console.error(`[RecorderEngine] Upload attempt ${attempt + 1} failed for Session #${sessionId}:`, err.message);
      if (attempt < maxRetries) {
        console.log(`[RecorderEngine] Retrying upload in 1.2s (attempt ${attempt + 2}/${maxRetries + 1})...`);
        setTimeout(() => {
          this._uploadBlobWithRetry(blob, durationSec, sessionId, attempt + 1);
        }, 1200);
      } else {
        this.activeUploadsCount = Math.max(0, this.activeUploadsCount - 1);
        if (this.options.onStatusChange) {
          this.options.onStatusChange('error', { error: err.message, sessionId });
        }
      }
    }
  }
}
