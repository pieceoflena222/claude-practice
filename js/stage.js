/**
 * 태풍 실험실 — 위성 관측 스테이지(캔버스 애니메이션)
 * 해수면 온도로 계산된 강도(intensity)와 예상 크기(sizeKm)를 받아
 * 소용돌이 구름 띠, 태풍의 눈, 회전 속도를 실시간으로 그립니다.
 * 색상은 실제 강조적외선(Enhanced IR) 위성영상 관례를 따라 약할수록 청색,
 * 강할수록 주황~적색 계열로 표현합니다.
 */
(function (global) {
  'use strict';

  function mapRange(value, inMin, inMax, outMin, outMax) {
    const t = (value - inMin) / (inMax - inMin);
    return outMin + Math.min(1, Math.max(0, t)) * (outMax - outMin);
  }

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const bigint = parseInt(clean, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  function rgba(hex, alpha) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  class TyphoonStage {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.state = { intensity: 0, sizeKm: 150, colorHex: '#2f6fb0' };
      this.target = Object.assign({}, this.state);
      this.rotation = 0;
      this.dashPhase = 0;
      this.lastTs = 0;
      this._raf = null;

      this.resize();
      if (typeof ResizeObserver !== 'undefined') {
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(canvas);
      } else {
        window.addEventListener('resize', () => this.resize());
      }
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    }

    setTarget(next) {
      Object.assign(this.target, next);
    }

    start() {
      if (this._raf) return;
      const loop = (ts) => {
        this.frame(ts);
        this._raf = requestAnimationFrame(loop);
      };
      this._raf = requestAnimationFrame(loop);
    }

    stop() {
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this.lastTs = 0;
    }

    frame(ts) {
      const dt = this.lastTs ? Math.min((ts - this.lastTs) / 1000, 0.05) : 0;
      this.lastTs = ts;

      const lerpT = Math.min(1, dt * 2.6);
      this.state.intensity += (this.target.intensity - this.state.intensity) * lerpT;
      this.state.sizeKm += (this.target.sizeKm - this.state.sizeKm) * lerpT;
      this.state.colorHex = this.target.colorHex;

      const angularSpeed = 0.12 + this.state.intensity * 1.55; // rad/s
      this.rotation += angularSpeed * dt;
      this.dashPhase -= (18 + this.state.intensity * 70) * dt;

      this.draw();
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);
      if (w < 4 || h < 4) return;

      const cx = w / 2;
      const cy = h / 2;
      const minSide = Math.min(w, h);
      const color = this.state.colorHex;

      // 대기 발광
      const glowR = minSide * 0.46;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
      glow.addColorStop(0, rgba(color, 0.32 + this.state.intensity * 0.18));
      glow.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();

      // 레이더 격자
      ctx.lineWidth = 1 * this.dpr;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, minSide * 0.46 * (i / 3), 0, Math.PI * 2);
        ctx.stroke();
      }

      const maxRadius = mapRange(this.state.sizeKm, 150, 1250, minSide * 0.15, minSide * 0.45);
      const armCount = 1 + Math.round(this.state.intensity * 4);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.rotation);
      for (let a = 0; a < armCount; a++) {
        this.drawArm(ctx, a, armCount, maxRadius, color);
      }
      ctx.restore();

      const eyeClarity = Math.pow(this.state.intensity, 1.7);
      if (eyeClarity > 0.04) {
        const eyeR = mapRange(this.state.intensity, 0, 1, 3, 15) * this.dpr;
        ctx.globalAlpha = eyeClarity;
        const eyeGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, eyeR);
        eyeGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
        eyeGrad.addColorStop(1, 'rgba(255,255,255,0.15)');
        ctx.fillStyle = eyeGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, eyeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    drawArm(ctx, armIndex, totalArms, maxRadius, color) {
      const startAngle = (armIndex / totalArms) * Math.PI * 2;
      const turns = 1.05;
      const segments = 46;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = startAngle + t * turns * Math.PI * 2;
        const radius = t * maxRadius;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.setLineDash([3 * this.dpr, (11 - this.state.intensity * 5) * this.dpr]);
      ctx.lineDashOffset = this.dashPhase;
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.45 + this.state.intensity * 0.42;
      ctx.lineWidth = (3.5 + this.state.intensity * 8.5) * this.dpr;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  }

  global.TL = global.TL || {};
  global.TL.TyphoonStage = TyphoonStage;
})(window);
