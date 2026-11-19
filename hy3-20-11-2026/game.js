"use strict";
(function () {

const VW = 1280, VH = 720;
const G = 1600;
const BALL_R = 13;
const MAX_SPEED = 2200;
const SUBSTEPS = 6;

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

/* ---------------- AUDIO ---------------- */
const Sound = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  on: true, musicTimer: null, nextNote: 0, step: 0,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  },
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },
  tone(freq, dur, type, vol, when, dest) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, when) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    const f = this.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1200;
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t);
  },
  bounce(v) {
    if (!this.on) return;
    const f = 220 + clamp(v, 0, 1400) * 0.5;
    this.tone(f, 0.12, "triangle", 0.25);
  },
  collect() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    this.tone(880, 0.1, "triangle", 0.3, t);
    this.tone(1320, 0.14, "triangle", 0.25, t + 0.06);
  },
  portal() {
    if (!this.on) return;
    this.noise(0.25, 0.25);
    this.tone(420, 0.25, "sine", 0.2);
  },
  death() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.4);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + 0.5);
  },
  win() {
    if (!this.on) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.5, "triangle", 0.3, t + i * 0.09));
  },
  startMusic() {
    if (!this.ctx || !this.on) return;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 1.5);
    if (this.musicTimer) return;
    this.nextNote = this.ctx.currentTime + 0.1;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const root = 196;
    const sched = () => {
      const ahead = this.ctx.currentTime + 0.3;
      while (this.nextNote < ahead) {
        const t = this.nextNote;
        const s = scale[this.step % scale.length];
        const oct = (this.step % 14 >= 7) ? 2 : 1;
        const f = root * Math.pow(2, s / 12) * oct;
        this.tone(f, 0.45, "sine", 0.5, t, this.musicGain);
        if (this.step % 4 === 0) this.tone(f / 2, 0.7, "triangle", 0.35, t, this.musicGain);
        if (this.step % 8 === 4) this.noise(0.06, 0.04, t);
        this.nextNote += 0.22;
        this.step++;
      }
    };
    this.musicTimer = setInterval(sched, 60);
  },
  stopMusic() {
    if (!this.ctx) return;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.5);
  }
};

/* ---------------- STORAGE ---------------- */
const SAVE_KEY = "inkbound_save_v1";
const Save = {
  data: { unlocked: 1, stars: {}, best: {} },
  load() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) this.data = s; } catch (e) {}
  },
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {} },
  isUnlocked(i) { return i < this.data.unlocked; },
  complete(i, stars, time) {
    this.data.unlocked = Math.max(this.data.unlocked, i + 2 > LEVELS.length ? LEVELS.length : i + 2);
    const prev = this.data.stars[i] || 0;
    if (stars > prev) this.data.stars[i] = stars;
    const b = this.data.best[i];
    if (!b || time < b) this.data.best[i] = time;
    this.save();
  }
};

/* ---------------- LEVELS ---------------- */
const LEVELS = [
  {
    name: "FIRST LIGHT", ink: 1300, hint: "Draw a ramp to roll the orb home.",
    ball: { x: 230, y: 130 }, goal: { x: 1080, y: 620, r: 30 },
    stars: [{ x: 640, y: 360 }],
    walls: [], hazards: [], bouncers: [], fans: [], portals: [], movers: []
  },
  {
    name: "THE GAP", ink: 1200, hint: "Bridge the chasm. Mind the crimson below.",
    ball: { x: 160, y: 140 }, goal: { x: 1110, y: 150, r: 30 },
    stars: [{ x: 640, y: 470 }],
    walls: [{ x: 0, y: 540, w: 520, h: 60 }, { x: 760, y: 540, w: 520, h: 60 }],
    hazards: [{ x: 520, y: 600, w: 240, h: 120 }],
    bouncers: [], fans: [], portals: [], movers: []
  },
  {
    name: "SPRINGBOARD", ink: 1000, hint: "Bounce pads love a good launch.",
    ball: { x: 180, y: 600 }, goal: { x: 1080, y: 140, r: 30 },
    stars: [{ x: 640, y: 200 }, { x: 980, y: 520 }],
    walls: [{ x: 0, y: 660, w: 1280, h: 60 }],
    bouncers: [{ x: 430, y: 648, r: 34, power: 760 }],
    hazards: [{ x: 560, y: 600, w: 360, h: 120 }],
    fans: [], portals: [], movers: []
  },
  {
    name: "UPWIND", ink: 1200, hint: "The fan pushes up. Ride the current.",
    ball: { x: 170, y: 640 }, goal: { x: 1090, y: 120, r: 30 },
    stars: [{ x: 400, y: 300 }, { x: 880, y: 300 }],
    walls: [{ x: 0, y: 690, w: 1280, h: 30 }],
    fans: [{ x: 520, y: 120, w: 240, h: 600, fx: 0, fy: -2600 }],
    hazards: [{ x: 760, y: 660, w: 520, h: 60 }],
    bouncers: [], portals: [], movers: []
  },
  {
    name: "WARP", ink: 1100, hint: "Gold portals are two ends of one thread.",
    ball: { x: 170, y: 150 }, goal: { x: 1090, y: 620, r: 30 },
    stars: [{ x: 300, y: 560 }, { x: 980, y: 180 }],
    walls: [{ x: 540, y: 200, w: 200, h: 460 }],
    portals: [{ ax: 300, ay: 360, bx: 1000, by: 360, r: 30 }],
    hazards: [{ x: 540, y: 660, w: 200, h: 60 }],
    bouncers: [], fans: [], movers: []
  },
  {
    name: "CONVEYOR", ink: 1100, hint: "Hop the drifting platform. Time it.",
    ball: { x: 140, y: 160 }, goal: { x: 1120, y: 160, r: 30 },
    stars: [{ x: 640, y: 250 }],
    walls: [{ x: 0, y: 640, w: 360, h: 80 }, { x: 920, y: 640, w: 360, h: 80 }],
    hazards: [{ x: 360, y: 690, w: 560, h: 30 }],
    movers: [{ w: 150, h: 26, ax: 420, ay: 470, bx: 760, by: 470, speed: 0.6 }],
    bouncers: [], fans: [], portals: []
  },
  {
    name: "NEEDLE", ink: 1100, hint: "Thread between the spikes.",
    ball: { x: 150, y: 600 }, goal: { x: 1110, y: 600, r: 30 },
    stars: [{ x: 640, y: 250 }, { x: 440, y: 430 }, { x: 840, y: 430 }],
    walls: [{ x: 0, y: 660, w: 1280, h: 60 }],
    hazards: [
      { x: 380, y: 660, w: 120, h: 60 }, { x: 560, y: 660, w: 120, h: 60 },
      { x: 740, y: 660, w: 120, h: 60 }, { x: 920, y: 660, w: 120, h: 60 },
      { x: 300, y: 300, w: 30, h: 360 }, { x: 980, y: 300, w: 30, h: 360 }
    ],
    bouncers: [], fans: [], portals: [], movers: []
  },
  {
    name: "GAUNTLET", ink: 1200, hint: "Bounce, drift, survive.",
    ball: { x: 160, y: 140 }, goal: { x: 1110, y: 620, r: 30 },
    stars: [{ x: 360, y: 360 }, { x: 920, y: 360 }, { x: 640, y: 560 }],
    walls: [{ x: 0, y: 660, w: 1280, h: 60 }, { x: 600, y: 0, w: 80, h: 320 }],
    bouncers: [{ x: 320, y: 648, r: 30, power: 640 }],
    fans: [{ x: 760, y: 360, w: 200, h: 300, fx: 0, fy: -2400 }],
    hazards: [{ x: 700, y: 660, w: 220, h: 60 }],
    portals: [], movers: []
  },
  {
    name: "LABYRINTH", ink: 1400, hint: "No straight line reaches the gate.",
    ball: { x: 140, y: 140 }, goal: { x: 1110, y: 140, r: 30 },
    stars: [{ x: 360, y: 560 }, { x: 640, y: 360 }, { x: 920, y: 560 }],
    walls: [
      { x: 300, y: 200, w: 40, h: 360 }, { x: 560, y: 160, w: 40, h: 380 },
      { x: 820, y: 200, w: 40, h: 360 }
    ],
    hazards: [{ x: 0, y: 690, w: 1280, h: 30 }],
    bouncers: [{ x: 1080, y: 632, r: 28, power: 560 }],
    fans: [], portals: [], movers: []
  },
  {
    name: "SINGULARITY", ink: 1700, hint: "Everything at once. You've got this.",
    ball: { x: 150, y: 640 }, goal: { x: 1110, y: 640, r: 30 },
    stars: [{ x: 300, y: 200 }, { x: 640, y: 200 }, { x: 980, y: 200 }, { x: 640, y: 520 }],
    walls: [{ x: 0, y: 690, w: 1280, h: 30 }, { x: 600, y: 300, w: 80, h: 280 }],
    bouncers: [{ x: 240, y: 678, r: 30, power: 700 }, { x: 1040, y: 678, r: 30, power: 700 }],
    fans: [{ x: 560, y: 80, w: 160, h: 240, fx: 0, fy: -2600 }],
    portals: [{ ax: 380, ay: 360, bx: 900, by: 360, r: 28 }],
    hazards: [
      { x: 360, y: 690, w: 200, h: 30 }, { x: 720, y: 690, w: 200, h: 30 },
      { x: 0, y: 300, w: 30, h: 240 }, { x: 1250, y: 300, w: 30, h: 240 }
    ],
    movers: [{ w: 130, h: 24, ax: 480, ay: 500, bx: 760, by: 500, speed: 0.7 }]
  }
];

/* ---------------- GAME STATE ---------------- */
const canvas = document.getElementById("bg");
const ctx = canvas.getContext("2d");
let scale = 1, offX = 0, offY = 0, DPR = 1;

const G_ = {
  state: "menu",
  levelIndex: 0,
  level: null,
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: BALL_R, portalCD: 0, trail: [] },
  strokes: [],
  inkUsed: 0,
  inkTotal: 0,
  starsLeft: [],
  starsTotal: 0,
  starsGot: 0,
  time: 0,
  running: false,
  erase: false,
  drawing: null,
  particles: [],
  shake: 0,
  win: false,
  flashEl: document.getElementById("flash")
};

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  scale = Math.min(canvas.width / VW, canvas.height / VH);
  offX = (canvas.width - VW * scale) / 2;
  offY = (canvas.height - VH * scale) / 2;
}
window.addEventListener("resize", resize);

/* ---------------- LEVEL LOAD ---------------- */
function loadLevel(i) {
  const L = JSON.parse(JSON.stringify(LEVELS[i]));
  G_.levelIndex = i;
  G_.level = L;
  G_.inkTotal = L.ink;
  G_.inkUsed = 0;
  G_.strokes = [];
  G_.starsLeft = L.stars.map(s => ({ x: s.x, y: s.y, got: false }));
  G_.starsTotal = G_.starsLeft.length;
  G_.starsGot = 0;
  G_.time = 0;
  G_.win = false;
  G_.particles = [];
  G_.shake = 0;
  resetBall();
  for (const m of (L.movers || [])) { m.p = 0; m.dir = 1; m.cx = m.ax; m.cy = m.ay; m.px = m.ax; m.py = m.ay; }
  G_.state = "play";
  G_.running = true;
  hideAllScreens();
  document.getElementById("hud").classList.remove("hidden");
  document.getElementById("hudLevelName").textContent = "REALM " + (i + 1) + " — " + L.name;
  document.getElementById("hudHint").textContent = L.hint || "";
  updateHUD();
  Sound.startMusic();
}

function resetBall() {
  const L = G_.level;
  G_.ball.x = L.ball.x; G_.ball.y = L.ball.y;
  G_.ball.vx = 0; G_.ball.vy = 0;
  G_.ball.portalCD = 0;
  G_.ball.trail = [];
  for (const s of G_.starsLeft) s.got = false;
  G_.starsGot = 0;
}

/* ---------------- DRAWING / INPUT ---------------- */
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const px = (clientX - rect.left) * DPR;
  const py = (clientY - rect.top) * DPR;
  return { x: (px - offX) / scale, y: (py - offY) / scale };
}

function pointerDown(e) {
  if (G_.state !== "play") return;
  Sound.init(); Sound.resume();
  const p = screenToWorld(e.clientX, e.clientY);
  if (G_.erase) {
    eraseAt(p.x, p.y);
    return;
  }
  if (G_.inkUsed >= G_.inkTotal - 1) return;
  G_.drawing = { pts: [p], hue: (G_.strokes.length * 47) % 360 };
}
function pointerMove(e) {
  if (G_.state !== "play") return;
  const p = screenToWorld(e.clientX, e.clientY);
  if (G_.erase && e.buttons) { eraseAt(p.x, p.y); return; }
  if (!G_.drawing) return;
  const pts = G_.drawing.pts;
  const last = pts[pts.length - 1];
  const d = Math.hypot(p.x - last.x, p.y - last.y);
  if (d < 6) return;
  if (G_.inkUsed + d > G_.inkTotal) {
    const remain = G_.inkTotal - G_.inkUsed;
    if (remain > 2) {
      const t = remain / d;
      pts.push({ x: last.x + (p.x - last.x) * t, y: last.y + (p.y - last.y) * t });
      G_.inkUsed = G_.inkTotal;
    }
    G_.drawing = null;
    return;
  }
  G_.inkUsed += d;
  pts.push(p);
  updateHUD();
}
function pointerUp() {
  if (G_.drawing && G_.drawing.pts.length > 1) {
    G_.strokes.push(G_.drawing);
    spawnParticles(G_.drawing.pts[G_.drawing.pts.length - 1].x, G_.drawing.pts[G_.drawing.pts.length - 1].y, 6, "hsl(" + G_.drawing.hue + ",100%,70%)");
  }
  G_.drawing = null;
}

function eraseAt(x, y) {
  for (let i = G_.strokes.length - 1; i >= 0; i--) {
    const s = G_.strokes[i];
    for (let j = 0; j < s.pts.length - 1; j++) {
      const a = s.pts[j], b = s.pts[j + 1];
      if (distToSeg(x, y, a.x, a.y, b.x, b.y) < 22) {
        G_.inkUsed -= strokeLen(s);
        if (G_.inkUsed < 0) G_.inkUsed = 0;
        G_.strokes.splice(i, 1);
        spawnParticles(x, y, 8, "#ff6f91");
        updateHUD();
        return;
      }
    }
  }
}

function strokeLen(s) {
  let L = 0;
  for (let i = 0; i < s.pts.length - 1; i++) L += Math.hypot(s.pts[i + 1].x - s.pts[i].x, s.pts[i + 1].y - s.pts[i].y);
  return L;
}
function distToSeg(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

canvas.addEventListener("pointerdown", pointerDown);
window.addEventListener("pointermove", pointerMove);
window.addEventListener("pointerup", pointerUp);

/* ---------------- PHYSICS ---------------- */
function resolveContact(cx, cy, rest, friction) {
  const b = G_.ball;
  let dx = b.x - cx, dy = b.y - cy;
  let d = Math.hypot(dx, dy);
  if (d === 0) { dx = 0; dy = -1; d = 1; }
  const pen = b.r - d;
  if (pen <= 0) return false;
  const nx = dx / d, ny = dy / d;
  b.x += nx * pen; b.y += ny * pen;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    const vnAfter = -rest * vn;
    let tx = b.vx - vn * nx, ty = b.vy - vn * ny;
    tx *= friction; ty *= friction;
    b.vx = tx + vnAfter * nx;
    b.vy = ty + vnAfter * ny;
    if (-vn > 120) { Sound.bounce(-vn); spawnParticles(b.x - nx * b.r, b.y - ny * b.r, 4, "#9fe8ff", 120); G_.shake = Math.min(G_.shake + -vn * 0.01, 14); }
  }
  return true;
}

function collideRect(r, rest, friction) {
  const b = G_.ball;
  const cx = clamp(b.x, r.x, r.x + r.w);
  const cy = clamp(b.y, r.y, r.y + r.h);
  resolveContact(cx, cy, rest, friction);
}
function collideCircle(c, rest, friction) {
  const b = G_.ball;
  const dx = b.x - c.x, dy = b.y - c.y;
  const d = Math.hypot(dx, dy);
  if (d === 0) return;
  const cx = c.x + dx / d * c.r, cy = c.y + dy / d * c.r;
  resolveContact(cx, cy, rest, friction);
}
function collideSeg(x1, y1, x2, y2, rest, friction) {
  const b = G_.ball;
  const dx = x2 - x1, dy = y2 - y1;
  const t = clamp(((b.x - x1) * dx + (b.y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  resolveContact(cx, cy, rest, friction);
}

function inRect(b, r) { return b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h; }

function step(dt) {
  const L = G_.level, b = G_.ball;
  b.portalCD = Math.max(0, b.portalCD - dt);

  // movers update
  for (const m of (L.movers || [])) {
    m.px = m.cx; m.py = m.cy;
    m.p += m.dir * m.speed * dt;
    if (m.p >= 1) { m.p = 1; m.dir = -1; }
    if (m.p <= 0) { m.p = 0; m.dir = 1; }
    m.cx = lerp(m.ax, m.bx, m.p);
    m.cy = lerp(m.ay, m.by, m.p);
  }

  for (const f of (L.fans || [])) if (inRect(b, f)) { b.vx += f.fx * dt; b.vy += f.fy * dt; }

  b.vy += G * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > MAX_SPEED) { b.vx *= MAX_SPEED / sp; b.vy *= MAX_SPEED / sp; }
  b.x += b.vx * dt; b.y += b.vy * dt;

  for (let it = 0; it < 2; it++) {
    // world edges
    if (b.x < b.r) { b.x = b.r; if (b.vx < 0) b.vx = -b.vx * 0.4; }
    if (b.x > VW - b.r) { b.x = VW - b.r; if (b.vx > 0) b.vx = -b.vx * 0.4; }
    if (b.y < b.r) { b.y = b.r; if (b.vy < 0) b.vy = -b.vy * 0.4; }
    if (b.y > VH - b.r) { b.y = VH - b.r; if (b.vy > 0) b.vy = -b.vy * 0.4; }

    for (const w of (L.walls || [])) collideRect(w, 0.32, 0.985);
    for (const m of (L.movers || [])) {
      const r = { x: m.cx - m.w / 2, y: m.cy - m.h / 2, w: m.w, h: m.h };
      if (collideRect(r, 0.3, 0.99)) {
        b.vx += (m.cx - m.px) / dt * 0.6;
        b.vy += (m.cy - m.py) / dt * 0.6;
      }
    }
    for (const bo of (L.bouncers || [])) {
      const dx = b.x - bo.x, dy = b.y - bo.y;
      const d = Math.hypot(dx, dy);
      if (d < b.r + bo.r) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        b.x = bo.x + nx * (b.r + bo.r); b.y = bo.y + ny * (b.r + bo.r);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          const vnAfter = -1.05 * vn;
          let tx = b.vx - vn * nx, ty = b.vy - vn * ny;
          b.vx = tx + vnAfter * nx; b.vy = ty + vnAfter * ny;
        }
        b.vx += nx * bo.power; b.vy += ny * bo.power;
        Sound.bounce(900); spawnParticles(b.x, b.y, 10, "#ff8df0", 220); G_.shake = Math.min(G_.shake + 8, 16);
      }
    }
    for (const s of G_.strokes) for (let j = 0; j < s.pts.length - 1; j++) collideSeg(s.pts[j].x, s.pts[j].y, s.pts[j + 1].x, s.pts[j + 1].y, 0.2, 0.997);
  }

  // portals
  for (const p of (L.portals || [])) {
    if (b.portalCD > 0) break;
    const da = Math.hypot(b.x - p.ax, b.y - p.ay);
    const db = Math.hypot(b.x - p.bx, b.y - p.by);
    if (da < p.r) { b.x = p.bx; b.y = p.by; b.portalCD = 0.35; Sound.portal(); spawnParticles(p.ax, p.ay, 14, "#ffd23d", 200); spawnParticles(p.bx, p.by, 14, "#ffd23d", 200); }
    else if (db < p.r) { b.x = p.ax; b.y = p.ay; b.portalCD = 0.35; Sound.portal(); spawnParticles(p.bx, p.by, 14, "#ffd23d", 200); spawnParticles(p.ax, p.ay, 14, "#ffd23d", 200); }
  }

  // hazards
  for (const h of (L.hazards || [])) if (inRect(b, h)) { die(); return; }

  // goal
  const g = L.goal;
  if (Math.hypot(b.x - g.x, b.y - g.y) < g.r + b.r * 0.5) { win(); return; }

  // stars
  for (const s of G_.starsLeft) {
    if (!s.got && Math.hypot(b.x - s.x, b.y - s.y) < 18 + b.r) {
      s.got = true; G_.starsGot++; Sound.collect();
      spawnParticles(s.x, s.y, 16, "#3df0ff", 240); G_.shake = Math.min(G_.shake + 3, 14);
      updateHUD();
    }
  }

  b.trail.push({ x: b.x, y: b.y });
  if (b.trail.length > 18) b.trail.shift();
}

function die() {
  Sound.death();
  G_.flashEl.classList.remove("hidden");
  G_.flashEl.classList.add("flash");
  setTimeout(() => { G_.flashEl.classList.add("hidden"); G_.flashEl.classList.remove("flash"); }, 480);
  spawnParticles(G_.ball.x, G_.ball.y, 22, "#ff3b5c", 260);
  G_.shake = 16;
  resetBall();
}

function win() {
  if (G_.win) return;
  G_.win = true; G_.running = false;
  Sound.win();
  Save.complete(G_.levelIndex, G_.starsGot, G_.time);
  spawnParticles(G_.level.goal.x, G_.level.goal.y, 40, "#ffd23d", 320);
  G_.shake = 12;
  const stars = "✦".repeat(G_.starsGot) + "✧".repeat(G_.starsTotal - G_.starsGot);
  document.getElementById("winStars").textContent = stars || "✧";
  document.getElementById("winStats").innerHTML =
    "Orbs gathered: <b>" + G_.starsGot + " / " + G_.starsTotal + "</b><br>Time: <b>" + G_.time.toFixed(1) + "s</b>";
  const last = G_.levelIndex >= LEVELS.length - 1;
  document.querySelector('#win [data-act="next"]').textContent = last ? "YOU WIN!" : "NEXT REALM";
  setTimeout(() => {
    document.getElementById("win").classList.remove("hidden");
    Sound.stopMusic();
  }, 700);
}

/* ---------------- PARTICLES ---------------- */
function spawnParticles(x, y, n, color, speed) {
  speed = speed || 160;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(0.3, 1) * speed;
    G_.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, max: rand(0.4, 0.9), color, size: rand(2, 5) });
  }
  if (G_.particles.length > 600) G_.particles.splice(0, G_.particles.length - 600);
}
function updateParticles(dt) {
  for (let i = G_.particles.length - 1; i >= 0; i--) {
    const p = G_.particles[i];
    p.life -= dt / p.max;
    if (p.life <= 0) { G_.particles.splice(i, 1); continue; }
    p.vy += 300 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.98; p.vy *= 0.98;
  }
}

/* ---------------- RENDER ---------------- */
const bg = { stars: [], orbs: [], t: 0 };
function initBG() {
  for (let i = 0; i < 140; i++) bg.stars.push({ x: rand(0, VW), y: rand(0, VH), s: rand(0.5, 2.2), tw: rand(0, TAU) });
  for (let i = 0; i < 7; i++) bg.orbs.push({ x: rand(0, VW), y: rand(0, VH), r: rand(120, 280), vx: rand(-12, 12), vy: rand(-12, 12), h: rand(0, 360) });
}

function drawBG(dt) {
  bg.t += dt;
  const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#05060f");
  g.addColorStop(1, "#0a0f24");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  // nebula orbs
  ctx.globalCompositeOperation = "lighter";
  for (const o of bg.orbs) {
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.x < -300) o.x = VW + 300; if (o.x > VW + 300) o.x = -300;
    if (o.y < -300) o.y = VH + 300; if (o.y > VH + 300) o.y = -300;
    const rg = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
    rg.addColorStop(0, "hsla(" + o.h + ",90%,60%,0.10)");
    rg.addColorStop(1, "hsla(" + o.h + ",90%,60%,0)");
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  // stars
  for (const s of bg.stars) {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(bg.t * 1.5 + s.tw));
    ctx.fillStyle = "rgba(200,225,255," + a + ")";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.restore();
}

function drawWorld() {
  const L = G_.level, b = G_.ball;
  ctx.save();
  let sx = 0, sy = 0;
  if (G_.shake > 0.2) { sx = rand(-G_.shake, G_.shake); sy = rand(-G_.shake, G_.shake); }
  ctx.setTransform(scale, 0, 0, scale, offX + sx * scale, offY + sy * scale);

  // play area frame
  ctx.fillStyle = "rgba(8,12,30,0.55)";
  ctx.fillRect(0, 0, VW, VH);
  ctx.strokeStyle = "rgba(108,160,255,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, VW - 4, VH - 4);

  // grid
  ctx.strokeStyle = "rgba(108,160,255,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= VW; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VH); ctx.stroke(); }
  for (let y = 0; y <= VH; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke(); }

  // fans
  for (const f of (L.fans || [])) {
    ctx.fillStyle = "rgba(61,240,255,0.07)";
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.strokeStyle = "rgba(61,240,255,0.3)";
    ctx.strokeRect(f.x, f.y, f.w, f.h);
    const off = (bg.t * 120) % 40;
    ctx.strokeStyle = "rgba(61,240,255,0.35)";
    ctx.lineWidth = 2;
    for (let yy = f.y + f.h - off; yy > f.y; yy -= 40) {
      ctx.beginPath();
      ctx.moveTo(f.x + 6, yy);
      ctx.quadraticCurveTo(f.x + f.w / 2, yy - 14, f.x + f.w - 6, yy);
      ctx.stroke();
    }
  }

  // walls
  for (const w of (L.walls || [])) {
    ctx.fillStyle = "rgba(40,54,104,0.9)";
    ctx.strokeStyle = "rgba(120,170,255,0.6)";
    ctx.lineWidth = 2;
    roundRect(w.x, w.y, w.w, w.h, 8); ctx.fill(); ctx.stroke();
  }

  // hazards
  for (const h of (L.hazards || [])) {
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = "#ff3b5c";
    ctx.fillStyle = "rgba(255,59,92,0.22)";
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.strokeStyle = "rgba(255,59,92,0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(h.x, h.y, h.w, h.h);
    ctx.restore();
    // spikes
    ctx.fillStyle = "rgba(255,59,92,0.85)";
    const n = Math.max(1, Math.floor(h.w / 22));
    const sw = h.w / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      ctx.moveTo(h.x + i * sw, h.y);
      ctx.lineTo(h.x + i * sw + sw / 2, h.y - 14);
      ctx.lineTo(h.x + (i + 1) * sw, h.y);
    }
    ctx.fill();
  }

  // movers
  for (const m of (L.movers || [])) {
    ctx.save();
    ctx.shadowBlur = 16; ctx.shadowColor = "#ff4ddb";
    ctx.fillStyle = "rgba(255,77,219,0.25)";
    roundRect(m.cx - m.w / 2, m.cy - m.h / 2, m.w, m.h, 8); ctx.fill();
    ctx.strokeStyle = "#ff4ddb"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  // bouncers
  for (const bo of (L.bouncers || [])) {
    ctx.save();
    ctx.shadowBlur = 22; ctx.shadowColor = "#ff4ddb";
    const pulse = 1 + 0.08 * Math.sin(bg.t * 6);
    ctx.fillStyle = "rgba(255,77,219,0.3)";
    ctx.beginPath(); ctx.arc(bo.x, bo.y, bo.r * pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#ff8df0"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(bo.x, bo.y, bo.r * pulse, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  // portals
  for (const p of (L.portals || [])) {
    drawPortal(p.ax, p.ay, p.r, "#ffd23d", bg.t);
    drawPortal(p.bx, p.by, p.r, "#ffd23d", bg.t + 1.5);
  }

  // stars
  for (const s of G_.starsLeft) {
    if (s.got) continue;
    ctx.save();
    ctx.shadowBlur = 20; ctx.shadowColor = "#3df0ff";
    ctx.translate(s.x, s.y);
    ctx.rotate(bg.t * 1.5);
    ctx.fillStyle = "#3df0ff";
    starShape(0, 0, 5, 13, 6); ctx.fill();
    ctx.restore();
  }

  // goal
  drawGoal(L.goal);

  // strokes
  for (const s of G_.strokes) drawStroke(s);
  if (G_.drawing) drawStroke(G_.drawing);

  // ball trail
  for (let i = 0; i < b.trail.length; i++) {
    const t = b.trail[i];
    const a = i / b.trail.length;
    ctx.fillStyle = "rgba(120,240,255," + (a * 0.5) + ")";
    ctx.beginPath(); ctx.arc(t.x, t.y, b.r * a * 0.9, 0, TAU); ctx.fill();
  }
  // ball
  ctx.save();
  ctx.shadowBlur = 26; ctx.shadowColor = "#7df9ff";
  const grd = ctx.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, b.r);
  grd.addColorStop(0, "#ffffff");
  grd.addColorStop(1, "#3df0ff");
  ctx.fillStyle = grd;
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  ctx.restore();

  // particles
  ctx.globalCompositeOperation = "lighter";
  for (const p of G_.particles) {
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  ctx.restore();
}

function drawPortal(x, y, r, color, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.shadowBlur = 24; ctx.shadowColor = color;
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.arc(0, 0, r - k * 6 + Math.sin(t * 3 + k) * 3, t * (1 + k * 0.4), t * (1 + k * 0.4) + Math.PI * 1.4);
    ctx.stroke();
  }
  ctx.restore();
}
function drawGoal(g) {
  ctx.save();
  ctx.translate(g.x, g.y);
  const pulse = 1 + 0.12 * Math.sin(bg.t * 3);
  ctx.shadowBlur = 30; ctx.shadowColor = "#ffd23d";
  ctx.strokeStyle = "rgba(255,210,61,0.9)"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, g.r * pulse, 0, TAU); ctx.stroke();
  ctx.fillStyle = "rgba(255,210,61,0.15)";
  ctx.beginPath(); ctx.arc(0, 0, g.r * 0.7, 0, TAU); ctx.fill();
  ctx.rotate(-bg.t * 1.2);
  ctx.fillStyle = "#ffd23d";
  starShape(0, 0, 5, g.r * 0.5, g.r * 0.22); ctx.fill();
  ctx.restore();
}
function drawStroke(s) {
  if (s.pts.length < 2) return;
  ctx.save();
  ctx.shadowBlur = 14; ctx.shadowColor = "hsl(" + s.hue + ",100%,70%)";
  ctx.strokeStyle = "hsl(" + s.hue + ",100%,72%)";
  ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(s.pts[0].x, s.pts[0].y);
  for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
  ctx.stroke();
  ctx.restore();
}
function starShape(cx, cy, spikes, outer, inner) {
  let rot = -Math.PI / 2;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  for (let i = 0; i < spikes; i++) {
    rot += step; ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
    rot += step; ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
  }
  ctx.closePath();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------------- HUD ---------------- */
function updateHUD() {
  const pct = clamp(1 - G_.inkUsed / G_.inkTotal, 0, 1) * 100;
  document.getElementById("inkFill").style.width = pct + "%";
  document.getElementById("hudStars").textContent = "✦ " + G_.starsGot + " / " + G_.starsTotal;
}
function tickTimer() {
  document.getElementById("hudTimer").textContent = G_.time.toFixed(1) + "s";
}

/* ---------------- LOOP ---------------- */
let lastT = performance.now();
function frame(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 1 / 20) dt = 1 / 20;

  drawBG(dt);

  if (G_.state === "play") {
    if (G_.running && !G_.win) {
      G_.time += dt;
      const h = dt / SUBSTEPS;
      for (let i = 0; i < SUBSTEPS; i++) step(h);
      tickTimer();
    }
    updateParticles(dt);
    G_.shake *= 0.9;
    drawWorld();
  } else {
    updateParticles(dt);
    G_.shake *= 0.9;
    if (G_.particles.length) {
      ctx.save();
      ctx.setTransform(scale, 0, 0, scale, offX, offY);
      ctx.globalCompositeOperation = "lighter";
      for (const p of G_.particles) { ctx.globalAlpha = clamp(p.life, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.restore();
    }
  }
  requestAnimationFrame(frame);
}

/* ---------------- UI / SCREENS ---------------- */
function hideAllScreens() {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
}
function showMenu() {
  G_.state = "menu"; G_.running = false;
  Sound.stopMusic();
  hideAllScreens();
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("win").classList.add("hidden");
  document.getElementById("menu").classList.remove("hidden");
}
function showLevels() {
  G_.state = "levels";
  hideAllScreens();
  document.getElementById("hud").classList.add("hidden");
  const grid = document.getElementById("levelGrid");
  grid.innerHTML = "";
  LEVELS.forEach((L, i) => {
    const cell = document.createElement("div");
    cell.className = "level-cell" + (Save.isUnlocked(i) ? "" : " locked");
    const stars = Save.data.stars[i] || 0;
    cell.innerHTML = '<div class="num">' + (i + 1) + '</div><div class="mini-stars">' + (Save.isUnlocked(i) ? "✦".repeat(stars) + "✧".repeat(Math.max(0, L.stars.length - stars)) : "") + '</div>';
    if (Save.isUnlocked(i)) cell.addEventListener("click", () => { Sound.init(); Sound.resume(); loadLevel(i); });
    grid.appendChild(cell);
  });
  document.getElementById("levels").classList.remove("hidden");
}
function showHow() {
  G_.state = "how";
  hideAllScreens();
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("how").classList.remove("hidden");
}

function nextLevel() {
  if (G_.levelIndex < LEVELS.length - 1) loadLevel(G_.levelIndex + 1);
  else showMenu();
}

document.addEventListener("click", (e) => {
  const act = e.target.getAttribute && e.target.getAttribute("data-act");
  if (!act) return;
  Sound.init(); Sound.resume();
  switch (act) {
    case "play": {
      let idx = 0;
      for (let i = 0; i < LEVELS.length; i++) if (Save.isUnlocked(i)) idx = i;
      loadLevel(idx);
      break;
    }
    case "levels": showLevels(); break;
    case "how": showHow(); break;
    case "menu": showMenu(); break;
    case "undo": if (G_.strokes.length) { G_.inkUsed -= strokeLen(G_.strokes[G_.strokes.length - 1]); if (G_.inkUsed < 0) G_.inkUsed = 0; G_.strokes.pop(); updateHUD(); } break;
    case "clear": G_.strokes = []; G_.inkUsed = 0; updateHUD(); break;
    case "erase":
      G_.erase = !G_.erase;
      document.getElementById("eraseBtn").classList.toggle("active", G_.erase);
      break;
    case "restart": resetBall(); break;
    case "retry": loadLevel(G_.levelIndex); break;
    case "next": nextLevel(); break;
    case "toggle-audio":
      Sound.on = !Sound.on;
      document.getElementById("audioBtn").textContent = "SOUND: " + (Sound.on ? "ON" : "OFF");
      if (Sound.on) { Sound.init(); Sound.startMusic(); } else Sound.stopMusic();
      break;
  }
});

window.addEventListener("keydown", (e) => {
  if (G_.state !== "play") {
    if (e.key === "Escape" && G_.state !== "menu") showMenu();
    return;
  }
  switch (e.key.toLowerCase()) {
    case "r": resetBall(); break;
    case "u": if (G_.strokes.length) { G_.inkUsed -= strokeLen(G_.strokes[G_.strokes.length - 1]); if (G_.inkUsed < 0) G_.inkUsed = 0; G_.strokes.pop(); updateHUD(); } break;
    case "c": G_.strokes = []; G_.inkUsed = 0; updateHUD(); break;
    case "e": G_.erase = !G_.erase; document.getElementById("eraseBtn").classList.toggle("active", G_.erase); break;
    case "escape": showMenu(); break;
  }
});

/* ---------------- BOOT ---------------- */
Save.load();
initBG();
resize();
showMenu();
requestAnimationFrame(frame);

})();
