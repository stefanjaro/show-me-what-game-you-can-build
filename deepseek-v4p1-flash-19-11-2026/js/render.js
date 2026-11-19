import { TAU, makeCanvas, rand, rgba, RNG, clamp, lerp } from './util.js';

const glowCache = new Map();
export function glowSprite(color, size = 96) {
  const key = color + '|' + size;
  const hit = glowCache.get(key);
  if (hit) return hit;
  const c = makeCanvas(size, size);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.08, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.22, rgba(color, 0.55));
  g.addColorStop(0.5, rgba(color, 0.18));
  g.addColorStop(0.78, rgba(color, 0.04));
  g.addColorStop(1, rgba(color, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  glowCache.set(key, c);
  return c;
}

export function drawGlow(ctx, color, x, y, radius, alpha = 1, size = 96) {
  const sprite = glowSprite(color, size);
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

export function ring(ctx, x, y, r, color, width = 1, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function createNebula(w, h, seed, palette) {
  const scale = 0.5;
  const c = makeCanvas(Math.max(2, w * scale), Math.max(2, h * scale));
  const x = c.getContext('2d');
  const rng = new RNG(seed * 7919 + 13);
  x.globalCompositeOperation = 'lighter';
  const max = Math.max(c.width, c.height);
  for (let i = 0; i < 18; i++) {
    const cx = rng.range(-0.1, 1.1) * c.width;
    const cy = rng.range(-0.1, 1.1) * c.height;
    const r = rng.range(0.12, 0.4) * max;
    const sx = rng.range(0.7, 1.5);
    const sy = rng.range(0.55, 1.1);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = rng.pick(palette);
    g.addColorStop(0, rgba(col, rng.range(0.07, 0.14)));
    g.addColorStop(0.4, rgba(col, 0.05));
    g.addColorStop(0.75, rgba(col, 0.015));
    g.addColorStop(1, rgba(col, 0));
    x.save();
    x.translate(cx, cy);
    x.rotate(rng.range(0, TAU));
    x.scale(sx, sy);
    x.translate(-cx, -cy);
    x.fillStyle = g;
    x.fillRect(cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
    x.restore();
  }
  return c;
}

export class SpaceBackground {
  constructor() {
    this.w = 0;
    this.h = 0;
    this.stars = [];
    this.nebulas = [];
    this.gridSpacing = 96;
    this.menuSeeds = [];
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    const count = Math.round(clamp((w * h) / 14000, 100, 300));
    const rng = new RNG(9331);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const z = rng.range(0.15, 1);
      this.stars.push({
        x: rng.range(0, w),
        y: rng.range(0, h),
        z,
        r: rng.range(0.35, 1.5) * (0.6 + z * 0.7),
        tw: rng.range(0, TAU),
        tws: rng.range(0.25, 1.3),
        hue: rng.pick(['#e8f7ff', '#cfe6ff', '#ffe9c9', '#c9d4ff', '#ffffff', '#ffd9ef']),
      });
    }
    this.menuSeeds = [
      { a: 0, r: 0.28, speed: 0.14, color: '#7df9ff' },
      { a: 2.1, r: 0.34, speed: 0.1, color: '#ffd27d' },
      { a: 4.2, r: 0.24, speed: 0.18, color: '#ff7ad9' },
      { a: 5.3, r: 0.38, speed: 0.07, color: '#9b8cff' },
    ];
    const pad = 44;
    const c = makeCanvas(w + pad * 2, h + pad * 2);
    const x = c.getContext('2d');
    x.fillStyle = '#03040a';
    x.fillRect(0, 0, c.width, c.height);
    const base = x.createRadialGradient(c.width * 0.5, c.height * 0.46, 0, c.width * 0.5, c.height * 0.46, Math.max(w, h) * 0.72);
    base.addColorStop(0, 'rgba(13,22,48,0.9)');
    base.addColorStop(0.45, 'rgba(7,11,27,0.55)');
    base.addColorStop(1, 'rgba(2,3,8,0)');
    x.fillStyle = base;
    x.fillRect(0, 0, c.width, c.height);
    const n1 = createNebula(w, h, 3, ['#1b4377', '#3d2275', '#0f5560', '#2c2f7a']);
    const n2 = createNebula(w, h, 11, ['#742a4e', '#331d6a', '#175c49', '#26396d']);
    x.globalCompositeOperation = 'lighter';
    x.globalAlpha = 0.95;
    x.drawImage(n1, pad + 8, pad - 6, w * 1.02, h * 1.02);
    x.globalAlpha = 0.7;
    x.drawImage(n2, pad - 10, pad + 8, w * 1.02, h * 1.02);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    this.staticBg = c;
    this.pad = pad;
  }

  draw(ctx, t, opts = {}) {
    const { w, h } = this;
    const menu = !!opts.menu;
    const mx = (opts.mouseX ?? w / 2) / w - 0.5;
    const my = (opts.mouseY ?? h / 2) / h - 0.5;

    if (this.staticBg) {
      const ox = Math.sin(t * 0.006) * 14 + mx * 10;
      const oy = Math.cos(t * 0.005) * 10 + my * 8;
      ctx.drawImage(this.staticBg, -this.pad + ox, -this.pad + oy);
    } else {
      ctx.fillStyle = '#03040a';
      ctx.fillRect(0, 0, w, h);
    }

    // dot lattice
    const spacing = this.gridSpacing;
    const ox = (t * 3.5) % spacing;
    const oy = (t * 1.2) % spacing;
    const cx = w / 2, cy = h / 2;
    const maxD = Math.hypot(w, h) * 0.56;
    ctx.fillStyle = '#9fe8ff';
    for (let y = -spacing + oy; y < h + spacing; y += spacing) {
      for (let x = -spacing + ox; x < w + spacing; x += spacing) {
        const d = Math.hypot(x - cx, y - cy) / maxD;
        const a = Math.max(0, 0.075 * (1 - d * 0.85)) * (menu ? 1 : 0.75);
        if (a <= 0.002) continue;
        ctx.globalAlpha = a;
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }
    ctx.globalAlpha = 1;

    // stars
    for (const s of this.stars) {
      const px = ((s.x + t * (2.2 + s.z * 5) + mx * s.z * 36) % (w + 40) + w + 40) % (w + 40) - 20;
      const py = ((s.y + t * (0.7 + s.z * 1.4) + my * s.z * 26) % (h + 40) + h + 40) % (h + 40) - 20;
      const tw = 0.55 + 0.45 * Math.sin(t * s.tws + s.tw);
      ctx.globalAlpha = (0.25 + s.z * 0.55) * tw;
      ctx.fillStyle = s.hue;
      if (s.z > 0.9) {
        ctx.drawImage(glowSprite(s.hue, 48), px - 4.5, py - 4.5, 9, 9);
      } else {
        ctx.fillRect(px, py, s.r, s.r);
      }
    }
    ctx.globalAlpha = 1;

    if (menu) this.drawMenuDecor(ctx, t, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }

  drawMenuDecor(ctx, t, w, h) {
    const cx = w / 2, cy = h * 0.47;
    const R = Math.min(w, h) * 0.5;
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.75);
    halo.addColorStop(0, 'rgba(70,130,180,0.055)');
    halo.addColorStop(0.55, 'rgba(100,80,190,0.025)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.018);
    ctx.strokeStyle = 'rgba(125,249,255,0.10)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 16]);
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.29, 0, TAU);
    ctx.stroke();
    ctx.rotate(-t * 0.035);
    ctx.strokeStyle = 'rgba(255,160,210,0.08)';
    ctx.setLineDash([1, 26]);
    ctx.beginPath();
    ctx.arc(0, 0, Math.min(w, h) * 0.37, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const s of this.menuSeeds) {
      const a = s.a + t * s.speed;
      const x = Math.cos(a) * Math.min(w, h) * s.r;
      const y = Math.sin(a) * Math.min(w, h) * s.r * 0.62;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(glowSprite(s.color, 64), x - 9, y - 9, 18, 18);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function starPath(ctx, x, y, outer, inner, points = 4, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i / (points * 2)) * TAU - Math.PI / 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function polyPath(ctx, x, y, r, sides = 6, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function shapePath(ctx, shape, x, y, r, rot = 0) {
  switch (shape) {
    case 'diamond':
      polyPath(ctx, x, y, r * 1.05, 4, rot + Math.PI / 4);
      break;
    case 'square':
      polyPath(ctx, x, y, r, 4, rot + Math.PI / 4);
      break;
    case 'tri':
      polyPath(ctx, x, y, r * 1.15, 3, rot);
      break;
    case 'hex':
      polyPath(ctx, x, y, r, 6, rot);
      break;
    case 'star':
      starPath(ctx, x, y, r * 1.1, r * 0.48, 5, rot);
      break;
    case 'needle':
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(rot) * r * 1.7, y + Math.sin(rot) * r * 1.7);
      ctx.lineTo(x + Math.cos(rot + 1.8) * r * 0.8, y + Math.sin(rot + 1.8) * r * 0.8);
      ctx.lineTo(x + Math.cos(rot - 1.8) * r * 0.8, y + Math.sin(rot - 1.8) * r * 0.8);
      ctx.closePath();
      break;
    case 'ringed':
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      break;
    case 'circle':
    default:
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      break;
  }
}

export function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function softEllipse(ctx, x, y, rx, ry, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / Math.max(rx, ry));
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
  ctx.restore();
}

export function lightning(ctx, x1, y1, x2, y2, color, alpha = 1, jag = 14) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const steps = Math.max(3, Math.floor(len / 20));
  const nx = -dy / (len || 1), ny = dx / (len || 1);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = (Math.random() - 0.5) * jag * (1 - Math.abs(t - 0.5) * 1.2);
    ctx.lineTo(x1 + dx * t + nx * off, y1 + dy * t + ny * off);
  }
  ctx.lineTo(x2, y2);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export { createNebula, lerp };
