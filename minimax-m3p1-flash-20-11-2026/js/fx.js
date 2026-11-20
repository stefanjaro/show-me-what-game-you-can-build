// EMBERDEEP — particles, screen effects, procedural audio.

import { clamp, lerp, TAU } from './util.js';

export class Particles {
  constructor(max = 2600) {
    this.max = max;
    this.p = new Array(max);
    for (let i = 0; i < max; i++) this.p[i] = { alive: false };
    this.head = 0;
    this.count = 0;
  }
  spawn(o) {
    let idx = -1;
    for (let k = 0; k < 40; k++) {
      const i = (this.head + k) % this.max;
      if (!this.p[i].alive) { idx = i; this.head = (i + 1) % this.max; break; }
    }
    if (idx === -1) { idx = this.head; this.head = (this.head + 1) % this.max; }
    const p = this.p[idx];
    p.alive = true;
    p.x = o.x; p.y = o.y;
    p.vx = o.vx || 0; p.vy = o.vy || 0;
    p.life = o.life || 0.6; p.max = p.life;
    p.size = o.size || 1.4;
    p.r = o.r; p.g = o.g; p.b = o.b;
    p.add = o.add !== false;
    p.drag = o.drag ?? 0.94;
    p.grav = o.grav || 0;
    p.glow = o.glow ?? 1;
    p.rock = o.rock || false;
    p.fade = o.fade ?? 1;
    return p;
  }
  update(dt, world) {
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      alive++;
      p.vy += p.grav * dt;
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      if (world) {
        if (p.rock && world.solidAtPx(nx, p.y)) { p.vx *= -0.4; p.vy *= -0.3; }
        else if (p.rock && world.solidAtPx(p.x, ny)) { p.vy *= -0.35; p.vx *= 0.7; }
        else { p.x = nx; p.y = ny; }
      } else { p.x = nx; p.y = ny; }
    }
    this.count = alive;
  }
  draw(ctx, additive) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (!p.alive) continue;
      if (!!p.add !== additive) continue;
      const t = p.life / p.max;
      const a = clamp(t * p.fade, 0, 1);
      const s = p.size * (p.glow ? (0.45 + t * 0.75) : 1);
      if (p.glow) {
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = `rgb(${p.r | 0},${p.g | 0},${p.b | 0})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${p.r | 0},${p.g | 0},${p.b | 0})`;
        ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      }
    }
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  constructor() { this.items = []; }
  add(x, y, text, color = '#ffd9a0', size = 7) {
    this.items.push({ x, y, text, color, size, life: 0.85, max: 0.85, vy: -18 });
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const t = this.items[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94;
      if (t.life <= 0) this.items.splice(i, 1);
    }
  }
  draw(ctx) {
    ctx.textAlign = 'center';
    for (const t of this.items) {
      const a = clamp(t.life / t.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `700 ${t.size}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

export class ScreenFx {
  constructor() {
    this.shake = 0; this.shakeT = 0;
    this.flash = 0; this.flashColor = '255,255,255';
    this.vignettePulse = 0;
    this.timeScale = 1; this.timeScaleTarget = 1;
    this.zoom = 1;
  }
  kick(amount, time = 0.28) {
    if (amount > this.shake) { this.shake = amount; this.shakeT = time; this.shakeMax = time; }
  }
  bang(alpha, color = '255,255,255') { this.flash = Math.max(this.flash, alpha); this.flashColor = color; }
  update(dt) {
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) { this.shake = 0; this.shakeT = 0; } }
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.vignettePulse = Math.max(0, this.vignettePulse - dt * 2);
    this.timeScale = lerp(this.timeScale, this.timeScaleTarget, 1 - Math.pow(0.001, dt));
  }
  shakeOffset() {
    if (this.shakeT <= 0) return [0, 0];
    const k = this.shake * (this.shakeT / (this.shakeMax || 1));
    return [(Math.random() * 2 - 1) * k, (Math.random() * 2 - 1) * k];
  }
}

// --------------------------------------------------------------------- audio
export class AudioEngine {
  constructor() {
    this.ready = false;
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
    this.root = 55;
    this.nextNote = 0;
    this.step = 0;
    this.intensity = 0;
  }
  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.85;
    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 8; this.comp.attack.value = 0.004; this.comp.release.value = 0.22;
    this.master.connect(this.comp); this.comp.connect(c.destination);

    this.sfxBus = c.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musBus = c.createGain(); this.musBus.gain.value = 0.0; this.musBus.connect(this.master);

    // reverb-ish: simple feedback delay
    this.verb = c.createGain(); this.verb.gain.value = 0.32;
    const delay = c.createDelay(1.0); delay.delayTime.value = 0.22;
    const fb = c.createGain(); fb.gain.value = 0.42;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.verb.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.master);
    this.send = c.createGain(); this.send.gain.value = 1; this.send.connect(this.verb);

    // noise buffer
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // drone
    this.droneGain = c.createGain(); this.droneGain.gain.value = 0.0;
    this.droneFilter = c.createBiquadFilter(); this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 320; this.droneFilter.Q.value = 4;
    this.droneGain.connect(this.droneFilter); this.droneFilter.connect(this.musBus);
    this.droneFilter.connect(this.send);
    this.oscs = [];
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = this.root;
      o.detune.value = (i - 1.5) * 7;
      const g = c.createGain(); g.gain.value = i === 0 ? 0.5 : 0.22;
      o.connect(g); g.connect(this.droneGain); o.start();
      this.oscs.push(o);
    }
    // slow filter LFO
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lfoG = c.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG); lfoG.connect(this.droneFilter.frequency); lfo.start();

    this.ready = true;
    this.nextNote = c.currentTime + 0.1;
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMusic(on) {
    this.musicOn = on;
    if (!this.ready) return;
    this.musBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musBus.gain.linearRampToValueAtTime(on ? 0.5 : 0, this.ctx.currentTime + 0.4);
  }
  setRoot(hz) {
    this.root = hz;
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    for (const o of this.oscs) o.frequency.linearRampToValueAtTime(hz, t + 1.4);
  }

  // ---- sfx primitives
  tone(freq, dur, type = 'sine', vol = 0.3, slide = 0, delay = 0, send = 0.2) {
    if (!this.ready || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    if (send > 0) { const s = c.createGain(); s.gain.value = send; g.connect(s); s.connect(this.send); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  noiseBurst(dur, f0, f1, vol = 0.3, q = 1, type = 'bandpass', delay = 0) {
    if (!this.ready || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = type; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(this.sfxBus);
    const sd = c.createGain(); sd.gain.value = 0.25; g.connect(sd); sd.connect(this.send);
    s.start(t); s.stop(t + dur + 0.05);
  }

  sfx(name, arg = 1) {
    if (!this.ready || this.muted) return;
    switch (name) {
      case 'ignite': this.noiseBurst(0.34, 900, 180, 0.30, 1.2); this.tone(120, 0.2, 'sine', 0.22, -60); break;
      case 'quench': this.noiseBurst(0.42, 4200, 500, 0.22, 0.9, 'highpass'); this.tone(700, 0.16, 'sine', 0.10, -380); break;
      case 'arc': this.noiseBurst(0.22, 5200, 900, 0.24, 3); this.tone(900, 0.14, 'square', 0.14, -700); this.tone(1500, 0.1, 'sawtooth', 0.08, -900, 0.03); break;
      case 'seed': this.tone(320, 0.3, 'triangle', 0.16, 260); this.noiseBurst(0.2, 700, 2200, 0.10, 1.4); break;
      case 'siphon': this.noiseBurst(0.5, 260, 1500, 0.14 * arg, 2.2); this.tone(90 + arg * 40, 0.4, 'sine', 0.10, 60); break;
      case 'dash': this.noiseBurst(0.22, 1800, 320, 0.20, 1.1); this.tone(220, 0.12, 'sine', 0.08, 180); break;
      case 'hurt': this.noiseBurst(0.3, 800, 120, 0.34, 0.7); this.tone(180, 0.25, 'sawtooth', 0.20, -120); break;
      case 'pop': this.noiseBurst(0.26, 1600, 200, 0.26, 0.9); this.tone(300, 0.16, 'square', 0.10, -220); break;
      case 'boom': this.noiseBurst(0.7, 700, 60, 0.42, 0.6); this.tone(90, 0.55, 'sine', 0.32, -60); this.tone(58, 0.8, 'triangle', 0.22, -30); break;
      case 'pickup': this.tone(760, 0.12, 'sine', 0.14, 240); this.tone(1140, 0.12, 'sine', 0.10, 180, 0.06); break;
      case 'shard': this.tone(520, 0.1, 'triangle', 0.12, 320); this.tone(780, 0.14, 'sine', 0.10, 420, 0.05); break;
      case 'descend': this.tone(140, 1.5, 'sine', 0.34, -90); this.tone(70, 1.9, 'triangle', 0.24, -30); this.noiseBurst(1.2, 300, 60, 0.18, 0.5); break;
      case 'death': this.tone(220, 1.4, 'sawtooth', 0.26, -190); this.tone(110, 2.0, 'sine', 0.2, -60); break;
      case 'levelup': this.tone(330, 0.2, 'triangle', 0.16, 120); this.tone(440, 0.2, 'triangle', 0.16, 120, 0.08); this.tone(660, 0.34, 'sine', 0.16, 60, 0.16); break;
      case 'ui': this.tone(520, 0.05, 'square', 0.05, -80); break;
      case 'deny': this.tone(160, 0.16, 'square', 0.12, -60); break;
      case 'freeze': this.tone(1600, 0.3, 'sine', 0.12, -900); this.noiseBurst(0.3, 6000, 2000, 0.10, 2); break;
      case 'zap': this.noiseBurst(0.18, 4000, 700, 0.20, 4); break;
      case 'heart': this.tone(196, 0.6, 'sine', 0.20, 130); this.tone(294, 0.7, 'triangle', 0.12, 150, 0.06); break;
    }
  }

  // ---- generative score
  update(dt, intensity = 0) {
    if (!this.ready || !this.musicOn) return;
    this.intensity = lerp(this.intensity, intensity, dt * 0.6);
    const c = this.ctx;
    const now = c.currentTime;
    const bpm = 72;
    const beat = 60 / bpm;
    while (this.nextNote < now + 0.25) {
      const t = this.nextNote;
      const s = this.step;
      // deep pulse
      if (s % 8 === 0) {
        this.toneAt(this.root * 0.5, 0.9, 'sine', 0.22, -6, t);
        this.toneAt(this.root * 0.25, 1.4, 'triangle', 0.12, -3, t);
      }
      if (s % 8 === 4 && this.intensity > 0.2) {
        this.toneAt(this.root * 0.5, 0.5, 'sine', 0.12, -4, t);
      }
      // sparse bell melody from minor pentatonic
      const scale = [0, 3, 5, 7, 10, 12, 15, 14, 12, 10];
      if (Math.random() < 0.30 + this.intensity * 0.25) {
        const n = scale[(Math.random() * scale.length) | 0];
        const f = this.root * 4 * Math.pow(2, n / 12);
        this.bell(f, t, 0.055 + this.intensity * 0.05);
      }
      // shimmer when intense
      if (this.intensity > 0.55 && Math.random() < 0.25) {
        const f = this.root * 8 * Math.pow(2, ((Math.random() * 5) | 0) / 12);
        this.bell(f, t + beat * 0.5, 0.03);
      }
      this.nextNote += beat / 2;
      this.step = (s + 1) % 64;
    }
    const target = 0.10 + this.intensity * 0.16;
    this.droneGain.gain.setTargetAtTime(target, now, 0.6);
  }
  toneAt(freq, dur, type, vol, slide, t) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musBus);
    const sd = c.createGain(); sd.gain.value = 0.5; g.connect(sd); sd.connect(this.send);
    o.start(t); o.stop(t + dur + 0.05);
  }
  bell(freq, t, vol) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); g.connect(this.musBus);
    const sd = c.createGain(); sd.gain.value = 0.7; g.connect(sd); sd.connect(this.send);
    o.start(t); o.stop(t + 1.7);
  }
}
