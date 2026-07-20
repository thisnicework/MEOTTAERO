/**
 * MEOTTAERO Interactive Movement Canvas
 * Implements fluid, expressive visual trails responding to mouse and touch interactions.
 */

class MovementCanvas {
  constructor(canvasId, toggleId, panelId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.toggle = document.getElementById(toggleId);
    this.panel = document.getElementById(panelId);

    this.isActive = localStorage.getItem('meottaero-interaction') === 'true';
    this.points = [];
    this.particles = [];
    this.ripples = [];
    this.mouse = { x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, down: false, active: false };
    
    // Config
    this.mode = localStorage.getItem('meottaero-interaction-mode') || 'ribbon'; // ribbon, particles, waves
    this.theme = localStorage.getItem('meottaero-interaction-theme') || 'cosmic'; // cosmic, neon, mono
    this.hue = 0;
    this.maxPoints = 40;
    
    this.init();
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Toggle button listener
    if (this.toggle) {
      this.toggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleState();
      });
      this.updateToggleUI();
    }

    // Event listeners for tracking
    window.addEventListener('mousemove', (e) => this.handleMouseMove(e), { passive: true });
    window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
    window.addEventListener('mousedown', (e) => this.handleMouseDown(e), { passive: true });
    window.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
    
    // Panel controls
    this.setupPanelControls();

    // Start rendering loop
    this.tick();
  }

  resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  toggleState() {
    this.isActive = !this.isActive;
    localStorage.setItem('meottaero-interaction', this.isActive);
    this.updateToggleUI();
    this.points = [];
    this.particles = [];
    this.ripples = [];
  }

  updateToggleUI() {
    if (this.toggle) {
      if (this.isActive) {
        this.toggle.classList.add('active');
        this.toggle.innerHTML = 'interaction <span class="dot active"></span>';
        if (this.panel) this.panel.style.display = 'flex';
      } else {
        this.toggle.classList.remove('active');
        this.toggle.innerHTML = 'interaction <span class="dot"></span>';
        if (this.panel) this.panel.style.display = 'none';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  setupPanelControls() {
    if (!this.panel) return;
    const modeBtn = this.panel.querySelector('#control-mode');
    const colorBtn = this.panel.querySelector('#control-color');

    if (modeBtn) {
      modeBtn.textContent = `MODE: ${this.mode.toUpperCase()}`;
      modeBtn.addEventListener('click', () => {
        const modes = ['ribbon', 'particles', 'waves'];
        const nextIdx = (modes.indexOf(this.mode) + 1) % modes.length;
        this.mode = modes[nextIdx];
        localStorage.setItem('meottaero-interaction-mode', this.mode);
        modeBtn.textContent = `MODE: ${this.mode.toUpperCase()}`;
        this.points = [];
        this.particles = [];
      });
    }

    if (colorBtn) {
      colorBtn.textContent = `THEME: ${this.theme.toUpperCase()}`;
      colorBtn.addEventListener('click', () => {
        const themes = ['cosmic', 'neon', 'mono'];
        const nextIdx = (themes.indexOf(this.theme) + 1) % themes.length;
        this.theme = themes[nextIdx];
        localStorage.setItem('meottaero-interaction-theme', this.theme);
        colorBtn.textContent = `THEME: ${this.theme.toUpperCase()}`;
      });
    }
  }

  getColor(opacity = 1) {
    if (this.theme === 'cosmic') {
      return `hsla(${this.hue}, 85%, 60%, ${opacity})`;
    } else if (this.theme === 'neon') {
      const colors = [
        `rgba(255, 0, 127, ${opacity})`, // Pink
        `rgba(0, 240, 255, ${opacity})`, // Cyan
        `rgba(57, 255, 20, ${opacity})`  // Lime
      ];
      const idx = Math.floor((this.hue / 120) % 3);
      return colors[idx];
    } else {
      // Monochrome: subtle dark gray or white
      const isDarkMode = window.getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)';
      return isDarkMode ? `rgba(255, 255, 255, ${opacity * 0.3})` : `rgba(0, 0, 0, ${opacity * 0.15})`;
    }
  }

  handleMouseMove(e) {
    if (!this.isActive) return;
    this.mouse.active = true;
    this.mouse.px = this.mouse.x;
    this.mouse.py = this.mouse.y;
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.mouse.vx = this.mouse.x - this.mouse.px;
    this.mouse.vy = this.mouse.y - this.mouse.py;

    this.addInteractiveElements();
  }

  handleTouchMove(e) {
    if (!this.isActive || e.touches.length === 0) return;
    this.mouse.active = true;
    const touch = e.touches[0];
    this.mouse.px = this.mouse.x;
    this.mouse.py = this.mouse.y;
    this.mouse.x = touch.clientX;
    this.mouse.y = touch.clientY;
    this.mouse.vx = this.mouse.x - this.mouse.px;
    this.mouse.vy = this.mouse.y - this.mouse.py;

    this.addInteractiveElements();
  }

  handleMouseDown(e) {
    if (!this.isActive) return;
    this.spawnRipple(e.clientX, e.clientY);
  }

  handleTouchStart(e) {
    if (!this.isActive || e.touches.length === 0) return;
    const touch = e.touches[0];
    this.spawnRipple(touch.clientX, touch.clientY);
  }

  spawnRipple(x, y) {
    const color = this.getColor(0.8);
    this.ripples.push({
      x,
      y,
      radius: 0,
      maxRadius: 180,
      alpha: 1,
      color
    });
  }

  addInteractiveElements() {
    const speed = Math.sqrt(this.mouse.vx * this.mouse.vx + this.mouse.vy * this.mouse.vy);
    if (speed < 0.5) return;

    if (this.mode === 'ribbon' || this.mode === 'waves') {
      this.points.push({
        x: this.mouse.x,
        y: this.mouse.y,
        vx: this.mouse.vx * 0.15,
        vy: this.mouse.vy * 0.15,
        age: 0,
        color: this.getColor(0.85),
        speed: speed
      });
      if (this.points.length > this.maxPoints) {
        this.points.shift();
      }
    } else if (this.mode === 'particles') {
      // Spawn few particles
      const count = Math.min(6, Math.floor(speed / 2) + 1);
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: this.mouse.x,
          y: this.mouse.y,
          vx: (Math.random() - 0.5) * 4 + this.mouse.vx * 0.2,
          vy: (Math.random() - 0.5) * 4 + this.mouse.vy * 0.2 - 1,
          size: Math.random() * 4 + 2,
          alpha: 1,
          life: 0.94 + Math.random() * 0.04,
          color: this.getColor(1)
        });
      }
    }
  }

  tick() {
    requestAnimationFrame(() => this.tick());
    if (!this.isActive) return;

    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Color cycle
    this.hue = (this.hue + 1.2) % 360;

    // 1. Draw Waves Mode
    if (this.mode === 'waves' && this.points.length > 1) {
      this.drawWaves();
    }

    // 2. Draw Ribbon Mode
    if (this.mode === 'ribbon' && this.points.length > 1) {
      this.drawRibbon();
    }

    // 3. Draw Particles Mode
    if (this.mode === 'particles') {
      this.drawParticles();
    }

    // 4. Draw Ripples
    this.drawRipples();

    // Decay points ages
    this.points.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.age += 1;
    });
    this.points = this.points.filter(p => p.age < 50);
  }

  drawRibbon() {
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';

    for (let i = 1; i < this.points.length; i++) {
      const p1 = this.points[i - 1];
      const p2 = this.points[i];
      const ratio = i / this.points.length;
      
      const width = Math.max(1, (10 - p2.speed * 0.2) * ratio);
      const alpha = ratio * (1 - p2.age / 50);
      
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      
      // Control points for nice smooth curves
      const xc = (p1.x + p2.x) / 2;
      const yc = (p1.y + p2.y) / 2;
      this.ctx.quadraticCurveTo(p1.x, p1.y, xc, yc);
      
      this.ctx.lineWidth = width;
      this.ctx.strokeStyle = p2.color;
      this.ctx.globalAlpha = Math.max(0, alpha);
      this.ctx.stroke();
    }
    this.ctx.globalAlpha = 1;
  }

  drawWaves() {
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.lineWidth = 1.5;

    // Draw 3 layers of waves
    for (let w = 0; w < 3; w++) {
      this.ctx.beginPath();
      const offsetSpeed = w * 2.5;
      
      for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        const ratio = i / this.points.length;
        const waveOffset = Math.sin((i + this.hue * 0.15) + offsetSpeed) * (8 * (1 - ratio));
        
        const x = p.x + waveOffset * (p.vy / 2);
        const y = p.y + waveOffset * -(p.vx / 2);

        if (i === 0) {
          this.ctx.moveTo(x, y);
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      
      this.ctx.strokeStyle = this.getColor(0.45 - w * 0.12);
      this.ctx.stroke();
    }
  }

  drawParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // tiny gravity
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.alpha *= p.life;

      if (p.alpha < 0.01) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
  }

  drawRipples() {
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += (r.maxRadius - r.radius) * 0.1;
      r.alpha *= 0.92;

      if (r.alpha < 0.01) {
        this.ripples.splice(i, 1);
        continue;
      }

      this.ctx.beginPath();
      this.ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = r.color;
      this.ctx.lineWidth = 2.5;
      this.ctx.globalAlpha = r.alpha;
      this.ctx.stroke();

      // Outer concentric ring
      if (r.radius > 30) {
        this.ctx.beginPath();
        this.ctx.arc(r.x, r.y, r.radius - 20, 0, Math.PI * 2);
        this.ctx.strokeStyle = r.color;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = r.alpha * 0.5;
        this.ctx.stroke();
      }
    }
    this.ctx.globalAlpha = 1;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MovementCanvas('interaction-canvas', 'interaction-toggle', 'interaction-panel');
});
