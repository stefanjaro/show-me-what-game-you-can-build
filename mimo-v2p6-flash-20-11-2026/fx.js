/* POLARIS — FX: particles, rings, floating text, screen flashes */

import { TAU, rand, chance, clamp } from './util.js';

const MAX_PARTICLES = 1100;
const MAX_TEXTS = 90;
const MAX_RINGS = 70;
const MAX_FLASHES = 12;

/* pre-rendered glow sprites (cheap additive blobs) */
const glowCache = new Map();
export function glowSprite(color, size) {
  size = Math.max(6, Math.round(size / 4) * 4);
  const key = color + '|' + size;
  let c = glowCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, colorWithAlpha(color, 0.5));
  grad.addColorStop(1, colorWithAlpha(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}
function colorWithAlpha(hex, a) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export class FX {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.rings = [];
    this.flashes = [];
    this.lines = [];
  }

  clear() {
    this.parts.length = 0;
    this.texts.length = 0;
    this.rings.length = 0;
    this.flashes.length = 0;
    this.lines.length = 0;
  }

  line(x1, y1, x2, y2, color, life = 0.18, width = 3) {
    if (this.lines.length > 40) this.lines.shift();
    this.lines.push({ x1, y1, x2, y2, color, life, max: life, width });
  }

  /* ---------------- spawning ---------------- */

  burst(x, y, n, color, opt = {}) {
    const spd = opt.speed || 240;
    const life = opt.life || 0.55;
    const size = opt.size || 3.4;
    const drag = opt.drag ?? 0.86;
    const spread = opt.spread || TAU;
    const baseAng = opt.angle ?? 0;
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX_PARTICLES) break;
      const a = baseAng + rand(-spread / 2, spread / 2);
      const s = spd * rand(0.25, 1);
      this.parts.push({
        kind: opt.kind || 'dot',
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: life * rand(0.6, 1.15), max: life,
        r: size * rand(0.55, 1.3),
        color, drag,
        rot: rand(TAU), vr: rand(-9, 9),
        grav: opt.grav || 0,
      });
    }
  }

  hitSparks(x, y, color, ang, n = 7) {
    this.burst(x, y, n, color, { speed: 330, life: 0.3, size: 3, angle: ang, spread: 1.6, kind: 'spark' });
  }

  killBurst(x, y, color, big = false) {
    this.burst(x, y, big ? 26 : 14, color, { speed: big ? 430 : 330, life: big ? 0.8 : 0.55, size: big ? 5 : 3.8 });
    this.burst(x, y, big ? 12 : 6, '#ffffff', { speed: big ? 300 : 230, life: 0.3, size: 2.4 });
    this.ring(x, y, big ? 120 : 54, color, big ? 0.5 : 0.32, big ? 5 : 3);
  }

  ring(x, y, maxR, color, life = 0.45, width = 4, fill = 0) {
    if (this.rings.length >= MAX_RINGS) this.rings.shift();
    this.rings.push({ x, y, r: maxR * 0.16, maxR, life, max: life, color, width, fill });
  }

  text(x, y, str, opt = {}) {
    if (this.texts.length >= MAX_TEXTS) this.texts.shift();
    this.texts.push({
      x, y, vx: opt.vx ?? rand(-16, 16), vy: opt.vy ?? -52,
      life: opt.life || 0.85, max: opt.life || 0.85,
      text: str, size: opt.size || 17, color: opt.color || '#fff',
      stroke: opt.stroke !== false, font: opt.font || 'display', weight: opt.weight || 700,
      drag: opt.drag ?? 0.94, glow: opt.glow || false,
    });
  }

  flash(color, alpha, life = 0.3) {
    if (this.flashes.length >= MAX_FLASHES) this.flashes.shift();
    this.flashes.push({ color, alpha, life, max: life });
  }

  /* ---------------- update ---------------- */

  update(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.life -= dt;
      if (p.life <= 0) { P[i] = P[P.length - 1]; P.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      p.vy += p.grav * dt;
      p.rot += p.vr * dt;
    }
    const T = this.texts;
    for (let i = T.length - 1; i >= 0; i--) {
      const t = T[i];
      t.life -= dt;
      if (t.life <= 0) { T[i] = T[T.length - 1]; T.pop(); continue; }
      t.x += t.vx * dt; t.y += t.vy * dt;
      const d = Math.pow(t.drag, dt * 60);
      t.vx *= d; t.vy *= d;
      t.vy += 42 * dt;
    }
    const R = this.rings;
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i];
      r.life -= dt;
      if (r.life <= 0) { R[i] = R[R.length - 1]; R.pop(); continue; }
      const t = 1 - r.life / r.max;
      r.r = r.maxR * (0.16 + 0.84 * (1 - Math.pow(1 - t, 3)));
    }
    const F = this.flashes;
    for (let i = F.length - 1; i >= 0; i--) {
      F[i].life -= dt;
      if (F[i].life <= 0) { F[i] = F[F.length - 1]; F.pop(); }
    }
    const L = this.lines;
    for (let i = L.length - 1; i >= 0; i--) {
      L[i].life -= dt;
      if (L[i].life <= 0) { L[i] = L[L.length - 1]; L.pop(); }
    }
  }

  /* ---------------- draw ---------------- */

  drawWorld(ctx) {
    /* rings (additive) */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const a = clamp(r.life / r.max, 0, 1);
      ctx.globalAlpha = a * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (0.4 + a * 0.9);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
      if (r.fill > 0) {
        ctx.globalAlpha = a * r.fill;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r * 0.92, 0, TAU);
        ctx.fill();
      }
    }

    /* particles */
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, p.r * a * 0.85);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.024, p.y - p.vy * 0.024);
        ctx.stroke();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        const s = p.r * (0.5 + a * 0.7);
        ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, s * 0.6); ctx.lineTo(-s * 0.4, -s * 0.7);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.35 + a * 0.75), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    /* lightning lines */
    for (const l of this.lines) {
      const a = clamp(l.life / l.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.strokeStyle = l.color;
      ctx.lineWidth = l.width * a;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const segs = 5;
      const jx = (Math.random() - 0.5) * 16, jy = (Math.random() - 0.5) * 16;
      ctx.moveTo(l.x1, l.y1);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const nx = l.x1 + (l.x2 - l.x1) * t + (i === segs - 1 ? 0 : (Math.random() - 0.5) * 26);
        const ny = l.y1 + (l.y2 - l.y1) * t + (i === segs - 1 ? 0 : (Math.random() - 0.5) * 26);
        ctx.lineTo(nx, ny);
      }
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = l.width * a * 0.4;
      ctx.stroke();
    }

    /* floating text */
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.82 ? 1 + (1 - (k - 0.82) / 0.18) * 0.35 : 1;
      ctx.globalAlpha = clamp(k * 1.5, 0, 1);
      const size = t.size * pop;
      ctx.font = `${t.weight} ${size}px ${t.font === 'display' ? '"Chakra Petch", sans-serif' : '"Rajdhani", sans-serif'}`;
      if (t.glow) { ctx.shadowColor = t.color; ctx.shadowBlur = 14; }
      if (t.stroke) {
        ctx.lineWidth = Math.max(2.5, size * 0.16);
        ctx.strokeStyle = 'rgba(4,5,12,0.85)';
        ctx.strokeText(t.text, t.x, t.y);
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  drawScreen(ctx, w, h) {
    if (!this.flashes.length) return;
    ctx.save();
    for (const f of this.flashes) {
      const a = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = f.alpha * a * a;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }
}
