/* POLARIS — renderer: world, background, HUD, crosshair */

import { TAU, clamp, lerp, rgba, formatTime } from './util.js';
import { COLORS, POLARITY_COLOR, WORLD, BAL } from './data.js';
import { glowSprite } from './fx.js';
import { drawWeapons } from './weapons.js';

/* ---------------- starfield ---------------- */
const stars = [];
for (let i = 0; i < 260; i++) {
  stars.push({
    x: Math.random(), y: Math.random(),
    z: 0.12 + Math.random() * 0.55,          /* depth for parallax */
    s: Math.random() < 0.1 ? rand2(1.6, 2.6) : rand2(0.5, 1.5),
    tw: Math.random() * TAU,
    c: Math.random() < 0.16 ? (Math.random() < 0.5 ? '#8fe8ff' : '#ffb9d4') : '#dfe6ff',
  });
}
function rand2(a, b) { return a + Math.random() * (b - a); }

let nebulaCanvas = null;
function getNebula() {
  if (nebulaCanvas) return nebulaCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d');
  const blobs = [
    [0.28, 0.34, 420, 'rgba(88,54,190,0.55)'],
    [0.72, 0.3, 380, 'rgba(190,44,120,0.4)'],
    [0.55, 0.72, 460, 'rgba(38,110,220,0.42)'],
    [0.2, 0.75, 320, 'rgba(120,40,180,0.35)'],
    [0.85, 0.62, 300, 'rgba(20,160,200,0.3)'],
  ];
  for (const [x, y, r, col] of blobs) {
    const grad = g.createRadialGradient(x * 1024, y * 1024, 0, x * 1024, y * 1024, r);
    grad.addColorStop(0, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 1024);
  }
  nebulaCanvas = c;
  return c;
}

let bgCache = null, vigCache = null, cacheKey = '';
function buildCaches(w, h) {
  const key = w + 'x' + h;
  if (key === cacheKey && bgCache) return;
  cacheKey = key;
  bgCache = document.createElement('canvas');
  bgCache.width = w; bgCache.height = h;
  const g = bgCache.getContext('2d');
  const bg = g.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.85);
  bg.addColorStop(0, '#0a0c1c');
  bg.addColorStop(0.55, '#070814');
  bg.addColorStop(1, '#03040a');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const neb = getNebula();
  g.save();
  g.globalAlpha = 0.5;
  g.globalCompositeOperation = 'screen';
  const scale = Math.max(w, h) / 760;
  g.drawImage(neb, w / 2 - 512 * scale, h * 0.42 - 512 * scale, 1024 * scale, 1024 * scale);
  g.restore();

  vigCache = document.createElement('canvas');
  vigCache.width = w; vigCache.height = h;
  const v = vigCache.getContext('2d');
  const vg = v.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(2,3,8,0.55)');
  v.fillStyle = vg;
  v.fillRect(0, 0, w, h);
}

function drawSpace(ctx, w, h, camX, camY, t) {
  buildCaches(w, h);
  ctx.drawImage(bgCache, 0, 0);

  /* stars */
  ctx.save();
  for (const s of stars) {
    const px = ((s.x * (w + 200) - camX * s.z * 0.35) % (w + 200) + (w + 200)) % (w + 200) - 100;
    const py = ((s.y * (h + 200) - camY * s.z * 0.35) % (h + 200) + (h + 200)) % (h + 200) - 100;
    const tw = 0.55 + Math.sin(t * (1.2 + s.z * 2) + s.tw) * 0.45;
    ctx.globalAlpha = clamp(tw * (0.35 + s.z), 0, 1);
    ctx.fillStyle = s.c;
    ctx.beginPath();
    ctx.arc(px, py, s.s, 0, TAU);
    ctx.fill();
    if (s.s > 2) {
      ctx.globalAlpha *= 0.4;
      ctx.fillRect(px - s.s * 3, py - 0.4, s.s * 6, 0.8);
      ctx.fillRect(px - 0.4, py - s.s * 3, 0.8, s.s * 6);
    }
  }
  ctx.restore();
}

/* ---------------- world ---------------- */
function drawGrid(ctx, cam, view) {
  const step = 92;
  const x0 = Math.floor((cam.x - view.w / 2) / step) * step;
  const x1 = cam.x + view.w / 2 + step;
  const y0 = Math.floor((cam.y - view.h / 2) / step) * step;
  const y1 = cam.y + view.h / 2 + step;
  ctx.save();
  ctx.lineWidth = 1;
  /* minor + major batches = 4 stroke calls total */
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? 'rgba(110,125,220,0.075)' : 'rgba(110,125,220,0.035)';
    ctx.beginPath();
    for (let x = x0; x < x1; x += step) {
      if ((((x / step) % 4) === 0) !== (pass === 1)) continue;
      ctx.moveTo(x, y0); ctx.lineTo(x, y1);
    }
    for (let y = y0; y < y1; y += step) {
      if ((((y / step) % 4) === 0) !== (pass === 1)) continue;
      ctx.moveTo(x0, y); ctx.lineTo(x1, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawArenaBorder(ctx, t) {
  ctx.save();
  const pulse = 0.6 + Math.sin(t * 1.6) * 0.25;
  ctx.strokeStyle = `rgba(139,108,255,${0.16 * pulse})`;
  ctx.lineWidth = 26;
  ctx.strokeRect(-8, -8, WORLD.w + 16, WORLD.h + 16);
  ctx.strokeStyle = `rgba(190,180,255,${0.5 * pulse})`;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
  ctx.setLineDash([26, 18]);
  ctx.lineDashOffset = -t * 40;
  ctx.strokeStyle = `rgba(255,255,255,${0.16 * pulse})`;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(6, 6, WORLD.w - 12, WORLD.h - 12);
  ctx.setLineDash([]);
  ctx.restore();
}

function inView(e, cam, view, m = 140) {
  return e.x > cam.x - view.w / 2 - m && e.x < cam.x + view.w / 2 + m &&
    e.y > cam.y - view.h / 2 - m && e.y < cam.y + view.h / 2 + m;
}

/* ---------------- player ---------------- */
function drawPlayer(ctx, g) {
  const p = g.player;
  const col = POLARITY_COLOR[p.polarity];
  const blink = p.iframe > 0 ? (Math.sin(g.t * 46) > -0.2 ? 1 : 0.25) : 1;

  /* afterimages */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const a of p.afterimages) {
    const k = a.life / a.max;
    ctx.globalAlpha = k * 0.4;
    const c = POLARITY_COLOR[a.pol];
    const gg = glowSprite(c, p.r * 5);
    ctx.drawImage(gg, a.x - gg.width / 2, a.y - gg.height / 2);
    ctx.globalAlpha = k * 0.5;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(a.x, a.y, p.r * 0.9, 0, TAU); ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = blink;

  /* corona glow */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.85 * blink;
  const gg = glowSprite(col, p.r * 7);
  ctx.drawImage(gg, p.x - gg.width / 2, p.y - gg.height / 2);
  ctx.restore();

  /* rotating polarity ring */
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(g.t * (p.dashT > 0 ? 12 : 2.4));
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.4;
  ctx.globalAlpha = 0.95;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.arc(0, 0, p.r + 7, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  /* core star */
  const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(0.55, '#ffffff');
  grd.addColorStop(1, col);
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * (p.dashT > 0 ? 1.15 : 1), 0, TAU);
  ctx.fill();

  /* inner dark pupil gives it life */
  ctx.fillStyle = 'rgba(6,8,20,0.85)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 0.34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 0.18, 0, TAU);
  ctx.fill();

  /* aim notch */
  ctx.rotate(0);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9 * blink;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aimAngle) * (p.r + 3), p.y + Math.sin(p.aimAngle) * (p.r + 3));
  ctx.lineTo(p.x + Math.cos(p.aimAngle) * (p.r + 13), p.y + Math.sin(p.aimAngle) * (p.r + 13));
  ctx.stroke();
  ctx.restore();

  /* hit flash ring */
  if (p.hitFlash > 0) {
    ctx.save();
    ctx.globalAlpha = p.hitFlash;
    ctx.strokeStyle = COLORS.crimson;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 14 + (0.55 - p.hitFlash) * 40, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

/* ============================ MENU ============================ */
export function renderMenu(g, ctx, w, h) {
  drawSpace(ctx, w, h, 0, 0, g.ambientT);

  const t = g.ambientT;
  ctx.save();
  ctx.translate(w / 2, h * 0.44);

  /* emblem */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gg = glowSprite(COLORS.cyan, 460);
  ctx.globalAlpha = 0.30 + Math.sin(t * 1.4) * 0.08;
  ctx.drawImage(gg, -gg.width / 2, -gg.height / 2);
  ctx.restore();

  ctx.save();
  ctx.rotate(t * 0.12);
  ctx.strokeStyle = 'rgba(45,225,255,0.30)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 14]);
  ctx.beginPath(); ctx.arc(0, 0, 260, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.rotate(-t * 0.2);
  ctx.strokeStyle = 'rgba(255,45,120,0.26)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([30, 60]);
  ctx.beginPath(); ctx.arc(0, 0, 330, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  ctx.strokeStyle = 'rgba(190,200,255,0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + t * 0.05;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 120, Math.sin(a) * 120);
    ctx.lineTo(Math.cos(a) * 480, Math.sin(a) * 480);
    ctx.stroke();
  }
  ctx.restore();

  /* drifting motes */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const seed = i * 137.5;
    const x = ((seed * 7.3 + t * (10 + (i % 5) * 6)) % (w + 80)) - 40;
    const y = (seed * 3.7) % h;
    const yy = (y - t * (8 + (i % 4) * 7)) % h;
    const a = 0.1 + ((i * 31) % 40) / 100;
    ctx.globalAlpha = a * (0.5 + Math.sin(t * 2 + i) * 0.5);
    ctx.fillStyle = i % 3 === 0 ? COLORS.cyan : i % 3 === 1 ? COLORS.crimson : '#cfd6ff';
    ctx.beginPath();
    ctx.arc(x, yy < 0 ? yy + h : yy, 1.4 + (i % 3) * 0.7, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  /* vignette */
  drawVignette(ctx, w, h, 0.5);
}

/* ============================ GAME ============================ */
export function renderGame(g, ctx, w, h) {
  const cam = g.cam;
  drawSpace(ctx, w, h, cam.x, cam.y, g.t);

  ctx.save();
  ctx.translate(Math.round(w / 2 - cam.x + g.shakeX), Math.round(h / 2 - cam.y + g.shakeY));

  drawGrid(ctx, cam, g.view);
  drawArenaBorder(ctx, g.t);

  /* pickups */
  for (const pk of g.pickups) if (inView(pk, cam, g.view, 80)) pk.draw(ctx);

  /* enemies */
  for (const e of g.enemies) if (inView(e, cam, g.view, 120)) e.draw(ctx, g);

  /* boss */
  if (g.boss && !g.boss.dead) g.boss.draw(ctx, g);

  /* player */
  drawPlayer(ctx, g);

  /* weapons (orbiters/drones/missiles/beam/pulses/rifts) */
  drawWeapons(ctx, g);

  /* bullets — batched: all glows (additive), then all bodies */
  {
    const vis = [];
    for (const b of g.bullets) {
      if (inView(b, cam, g.view, 60)) vis.push(b);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of vis) {
      const gsz = Math.max(26, b.r * 7);
      const gl = glowSprite(b.color, gsz);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(gl, b.x - gl.width / 2, b.y - gl.height / 2);
    }
    ctx.restore();
    ctx.save();
    for (const b of vis) {
      const c = b.color;
      if (b.friendly) {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(6,8,20,0.75)';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 0.8, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* fx */
  g.fx.drawWorld(ctx);

  ctx.restore();

  /* ---- screen space ---- */
  drawScreenEffects(g, ctx, w, h);
  drawCrosshair(g, ctx, w, h);
  drawHUD(g, ctx, w, h);
}

function drawScreenEffects(g, ctx, w, h) {
  const p = g.player;
  /* low hp pulse */
  if (p && p.hp / p.maxHp < 0.35 && g.state === 'playing') {
    const k = (0.35 - p.hp / p.maxHp) / 0.35;
    const pulse = 0.5 + Math.sin(g.t * 7) * 0.5;
    const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    grd.addColorStop(0, 'rgba(255,45,120,0)');
    grd.addColorStop(1, `rgba(255,45,120,${(0.14 + k * 0.3) * (0.55 + pulse * 0.45)})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
  /* nova ready glow */
  if (p && p.nova >= BAL.player.novaMax && g.state === 'playing') {
    const pulse = 0.5 + Math.sin(g.t * 5) * 0.5;
    const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    grd.addColorStop(0, 'rgba(255,209,102,0)');
    grd.addColorStop(1, `rgba(255,209,102,${0.1 + pulse * 0.12})`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }
  g.fx.drawScreen(ctx, w, h);
  drawVignette(ctx, w, h, 0.55);
}

function drawVignette(ctx, w, h, strength) {
  buildCaches(w, h);
  ctx.save();
  ctx.globalAlpha = strength / 0.55;
  ctx.drawImage(vigCache, 0, 0);
  ctx.restore();
}

/* ---------------- crosshair ---------------- */
function drawCrosshair(g, ctx, w, h) {
  if (g.state === 'menu' || !g.player) return;
  const p = g.player;
  const col = POLARITY_COLOR[p.polarity];
  const x = g.input.mx, y = g.input.my;
  const mw = g.screenToWorld(x, y);

  /* target state */
  let mode = 'idle';
  let target = null;
  for (const e of g.enemies) {
    if (e.dead || e.state === 'spawn') continue;
    if ((e.x - mw.x) ** 2 + (e.y - mw.y) ** 2 < (e.r + 26) ** 2) {
      target = e; break;
    }
  }
  if (target) mode = target.polarity !== p.polarity ? 'kill' : 'shield';

  const r = mode === 'kill' ? 11 : mode === 'shield' ? 17 : 14;
  const c = mode === 'kill' ? COLORS.gold : mode === 'shield' ? '#7d84ad' : col;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(g.t * (mode === 'kill' ? 2.4 : 0.7));

  ctx.strokeStyle = c;
  ctx.lineWidth = mode === 'kill' ? 2.4 : 1.8;
  ctx.globalAlpha = 0.95;
  /* broken ring */
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * TAU + 0.22;
    ctx.beginPath();
    ctx.arc(0, 0, r, a0, a0 + TAU / 4 - 0.44);
    ctx.stroke();
  }
  /* brackets on kill target */
  if (mode === 'kill') {
    ctx.rotate(-g.t * 2.4);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const cx = Math.cos(a), cy = Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(cx * (r + 7) - cy * 6, cy * (r + 7) + cx * 6);
      ctx.lineTo(cx * (r + 7), cy * (r + 7));
      ctx.lineTo(cx * (r + 7) + cy * 6, cy * (r + 7) - cx * 6);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = mode === 'shield' ? '#7d84ad' : '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ---------------- HUD ---------------- */
function fmt(n) {
  n = Math.floor(n);
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function bar(ctx, x, y, w, h, frac, fill, bg = 'rgba(8,10,24,0.82)', stroke = 'rgba(150,160,220,0.3)') {
  ctx.save();
  const cut = Math.min(9, h / 2);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x + cut, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - cut, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.restore();
  path();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawHUD(g, ctx, w, h) {
  const p = g.player;
  if (!p) return;
  const compact = w < 760;

  ctx.save();
  ctx.textBaseline = 'middle';

  /* ---------- top left: hp / level / dash ---------- */
  const hx = 24, hy = 22;
  const barW = compact ? 170 : 240;
  const hpFrac = p.hp / p.maxHp;
  const hpCol = hpFrac > 0.55 ? '#7dffb2' : hpFrac > 0.28 ? COLORS.gold : COLORS.crimson;
  bar(ctx, hx, hy, barW, 16, hpFrac, hpCol);
  ctx.font = '700 14px "Chakra Petch", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, hx + barW + 12, hy + 8);

  /* level + xp */
  const xpFrac = g.xp / g.xpNeed;
  bar(ctx, hx, hy + 24, barW, 8, xpFrac, 'rgba(125,255,178,0.85)', 'rgba(8,10,24,0.7)', 'rgba(125,255,178,0.28)');
  ctx.font = '600 12px "Chakra Petch", sans-serif';
  ctx.fillStyle = COLORS.xp;
  ctx.fillText(`LV ${g.level}`, hx + barW + 12, hy + 28);

  /* dash pips */
  const dashReady = p.dashCd <= 0;
  const dashFrac = dashReady ? 1 : 1 - p.dashCd / (p.dashCdBase * (1 - 0.13 * (p.mods.quickstep || 0)));
  ctx.save();
  ctx.translate(hx, hy + 46);
  for (let i = 0; i < 3; i++) {
    const on = i === 0 ? dashReady : false;
    ctx.strokeStyle = on ? COLORS.cyan : 'rgba(140,150,210,0.35)';
    ctx.fillStyle = on ? 'rgba(45,225,255,0.35)' : 'rgba(8,10,24,0.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(i * 26 + 8, 0); ctx.lineTo(i * 26 + 16, 5.5); ctx.lineTo(i * 26 + 8, 11); ctx.lineTo(i * 26, 5.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (!dashReady) {
    ctx.fillStyle = 'rgba(45,225,255,0.85)';
    ctx.fillRect(0, 15, 16 * clamp(dashFrac, 0, 1), 2.5);
  }
  ctx.font = '600 10px "Chakra Petch", sans-serif';
  ctx.fillStyle = 'rgba(160,168,220,0.8)';
  ctx.textAlign = 'left';
  ctx.fillText('DASH', 84, 6);
  ctx.restore();

  /* ---------- top center: timer + combo ---------- */
  ctx.textAlign = 'center';
  ctx.font = '700 30px "Chakra Petch", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(45,225,255,0.5)';
  ctx.shadowBlur = 12;
  ctx.fillText(formatTime(g.t), w / 2, 34);
  ctx.shadowBlur = 0;
  ctx.font = '600 10px "Chakra Petch", sans-serif';
  ctx.fillStyle = 'rgba(150,158,215,0.85)';
  ctx.fillText('SURVIVED', w / 2, 56);

  if (g.combo > 2) {
    const mult = g.comboMult();
    const k = clamp(g.comboT / BAL.comboWindow, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.55 + k * 0.45;
    ctx.font = '700 22px "Chakra Petch", sans-serif';
    const c = mult >= 4 ? COLORS.gold : mult >= 2.5 ? COLORS.crimson : '#fff';
    ctx.fillStyle = c;
    ctx.shadowColor = c;
    ctx.shadowBlur = 14;
    ctx.fillText(`×${g.combo}  +${mult.toFixed(1)}x`, w / 2, 80);
    ctx.restore();
  }

  /* ---------- top right: score ---------- */
  ctx.textAlign = 'right';
  ctx.font = '700 26px "Chakra Petch", sans-serif';
  ctx.fillStyle = COLORS.gold;
  ctx.shadowColor = 'rgba(255,209,102,0.45)';
  ctx.shadowBlur = 12;
  ctx.fillText(fmt(g.score), w - 26, 32);
  ctx.shadowBlur = 0;
  ctx.font = '600 10px "Chakra Petch", sans-serif';
  ctx.fillStyle = 'rgba(150,158,215,0.85)';
  ctx.fillText('RESONANCE', w - 26, 52);
  ctx.font = '600 12px "Rajdhani", sans-serif';
  ctx.fillStyle = 'rgba(150,158,215,0.7)';
  ctx.fillText(`${g.kills} shattered`, w - 26, 70);

  /* ---------- boss bar ---------- */
  if (g.boss && !g.boss.dead && g.boss.state !== 'enter') {
    const b = g.boss;
    const bw = Math.min(560, w * 0.5);
    const bx = w / 2 - bw / 2, by = 104;
    ctx.save();
    ctx.fillStyle = 'rgba(4,5,12,0.46)';
    ctx.fillRect(bx - 22, by - 32, bw + 44, 78);
    ctx.strokeStyle = 'rgba(150,160,220,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 22, by - 32, bw + 44, 78);
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = '700 15px "Chakra Petch", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(b.name, w / 2, by - 10);
    ctx.font = '500 11px "Rajdhani", sans-serif';
    ctx.fillStyle = 'rgba(170,176,225,0.8)';
    ctx.fillText(b.sub || '', w / 2, by + 28);
    const pol = POLARITY_COLOR[b.polarity];
    bar(ctx, bx, by + 6, bw, 15, b.hp / b.maxHp, pol, 'rgba(8,10,24,0.85)', 'rgba(255,255,255,0.35)');
    if (b.armored) {
      ctx.font = '600 10px "Chakra Petch", sans-serif';
      ctx.fillStyle = '#9aa3d6';
      ctx.fillText('◈ SATELLITES ARMED — SHATTER THE CHOIR', w / 2, by + 44);
    }
  }

  /* ---------- bottom left: polarity ---------- */
  const px = 46, py = h - 52;
  const col = POLARITY_COLOR[p.polarity];
  const other = POLARITY_COLOR[1 - p.polarity];
  ctx.save();
  ctx.translate(px, py);
  /* outer glow */
  ctx.globalCompositeOperation = 'lighter';
  const pg = glowSprite(col, 130);
  ctx.globalAlpha = 0.7;
  ctx.drawImage(pg, -pg.width / 2, -pg.height / 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(6,8,20,0.9)';
  ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 27, 0, TAU); ctx.stroke();
  /* other colour ghost */
  ctx.strokeStyle = other;
  ctx.lineWidth = 1.4;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  /* switch cooldown sweep */
  if (p.switchCd > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 31, -Math.PI / 2, -Math.PI / 2 + TAU * (p.switchCd / 0.12));
    ctx.stroke();
  }
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.font = '600 11px "Chakra Petch", sans-serif';
  ctx.fillStyle = col;
  ctx.fillText(p.polarity === 0 ? 'CRIMSON' : 'CYAN', px + 44, py - 8);
  ctx.font = '500 11px "Rajdhani", sans-serif';
  ctx.fillStyle = 'rgba(160,168,220,0.85)';
  ctx.fillText('Q / RMB — SHIFT', px + 44, py + 8);

  /* ---------- bottom center: nova ---------- */
  const nw = compact ? 240 : 330, nh = 15;
  const nx = w / 2 - nw / 2, ny = h - 34;
  const nf = p.nova / BAL.player.novaMax;
  const full = nf >= 1;
  ctx.save();
  if (full) {
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 22 + Math.sin(g.t * 7) * 10;
  }
  const fill = full
    ? `rgba(255,209,102,${0.85 + Math.sin(g.t * 7) * 0.15})`
    : 'rgba(45,225,255,0.75)';
  bar(ctx, nx, ny, nw, nh, nf, fill, 'rgba(8,10,24,0.85)', full ? 'rgba(255,209,102,0.9)' : 'rgba(150,160,220,0.35)');
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.font = '700 12px "Chakra Petch", sans-serif';
  ctx.fillStyle = full ? COLORS.gold : 'rgba(170,176,225,0.9)';
  ctx.fillText(full ? '✦ NOVA READY — [E] DETONATE' : `NOVA ${Math.floor(nf * 100)}%`, w / 2, ny - 12);

  /* ---------- bottom right: arsenal ---------- */
  if (!compact) {
    const m = p.mods;
    const owned = [];
    owned.push({ n: 'PRISM GUN', lv: (m.spread || 0) + (m.pierce || 0) + (m.caliber || 0) + (m.overcharge || 0) + (m.velocity || 0) + (m.chain || 0) + (m.homing || 0), col });
    if (m.orbit) owned.push({ n: 'ORBITAL', lv: m.orbit, col: POLARITY_COLOR[p.polarity] });
    if (m.pulse) owned.push({ n: 'NOVA PULSE', lv: m.pulse, col: POLARITY_COLOR[p.polarity] });
    if (m.drone) owned.push({ n: 'SENTINEL', lv: m.drone, col: POLARITY_COLOR[p.polarity] });
    if (m.missile) owned.push({ n: 'SEEKER', lv: m.missile, col: '#ffb347' });
    if (m.beam) owned.push({ n: 'SUNCUTTER', lv: m.beam, col: '#fff' });
    const evos = ['evo_needle', 'evo_halo', 'evo_graviton', 'evo_swarm', 'evo_rift', 'evo_dawn'].filter(k => m[k]);
    ctx.textAlign = 'right';
    let y = h - 118;
    ctx.font = '600 11px "Chakra Petch", sans-serif';
    for (const o of owned.slice(0, 6)) {
      ctx.fillStyle = 'rgba(160,168,220,0.9)';
      ctx.fillText(o.n, w - 26, y);
      ctx.fillStyle = o.col;
      const pips = Math.min(o.lv, 8);
      for (let i = 0; i < pips; i++) {
        ctx.fillRect(w - 22 - (pips - i) * 7, y + 8, 5, 3);
      }
      y += 20;
    }
    if (evos.length) {
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('✦ ' + evos.length + ' EVOLUTION' + (evos.length > 1 ? 'S' : ''), w - 26, y + 4);
    }
  }

  ctx.restore();
}
