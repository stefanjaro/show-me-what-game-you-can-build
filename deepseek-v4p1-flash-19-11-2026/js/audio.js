import { clamp, rand } from './util.js';

const MIDI = m => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [57, 60, 64, 71, 74], // Am9
  [53, 57, 60, 67, 71], // Fmaj9
  [50, 57, 60, 65, 69], // Dm9
  [52, 56, 59, 63, 69], // E7
];

export class AudioEngine {
  constructor(settings = {}) {
    this.ctx = null;
    this.started = false;
    this.musicEnabled = settings.music !== false;
    this.sfxEnabled = settings.sfx !== false;
    this.musicBase = 0.42;
    this.sfxBase = 0.95;
    this.musicDuck = 1;
    this.duckTimer = null;
    this.intensity = 0;
    this.targetIntensity = 0;
    this.danger = 0;
    this.step = 0;
    this.nextStepTime = 0;
    this.bpm = 86;
    this.stepDur = 60 / this.bpm / 4;
    this.timer = null;
    this.sfxLast = new Map();
    this.pickStreak = 0;
    this.pickStreakT = 0;
    this.rngSeed = Math.random() * 10000;
  }

  rng() {
    this.rngSeed = (this.rngSeed * 16807 + 1) % 2147483647;
    return this.rngSeed / 2147483647;
  }

  unlock() {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.started = true;

      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -20;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.22;
      this.compressor.connect(ctx.destination);

      this.master = ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.compressor);

      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicEnabled ? this.musicBase : 0;
      this.musicBus.connect(this.master);

      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxEnabled ? this.sfxBase : 0;
      this.sfxBus.connect(this.master);

      // space
      this.reverb = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 3.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          const t = i / len;
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
        }
      }
      this.reverb.buffer = ir;
      this.reverbReturn = ctx.createGain();
      this.reverbReturn.gain.value = 0.42;
      const revLP = ctx.createBiquadFilter();
      revLP.type = 'lowpass';
      revLP.frequency.value = 3800;
      this.reverb.connect(revLP);
      revLP.connect(this.reverbReturn);
      this.reverbReturn.connect(this.master);

      this.delay = ctx.createDelay(1.0);
      this.delay.delayTime.value = this.stepDur * 3;
      this.delayFb = ctx.createGain();
      this.delayFb.gain.value = 0.3;
      this.delayWet = ctx.createGain();
      this.delayWet.gain.value = 0.18;
      const delayLP = ctx.createBiquadFilter();
      delayLP.type = 'lowpass';
      delayLP.frequency.value = 2200;
      this.delay.connect(delayLP);
      delayLP.connect(this.delayFb);
      this.delayFb.connect(this.delay);
      delayLP.connect(this.delayWet);
      this.delayWet.connect(this.master);

      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      this.buildDrone();
      this.startMusic();
    } catch (err) {
      console.warn('Audio unavailable', err);
    }
  }

  buildDrone() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 190;
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 55.7;
    o2.detune.value = 7;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(lp);
    lp.connect(this.musicBus);
    o1.start();
    o2.start();
    this.droneGain = g;
  }

  setDanger(v) {
    this.danger = clamp(v, 0, 1);
    if (!this.ctx || !this.droneGain) return;
    const t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(0.09 * this.danger, t, 0.6);
  }

  setIntensity(v) {
    this.targetIntensity = clamp(v, 0, 1);
  }

  duckMusic(amount = 0.3, time = 0.5) {
    if (!this.ctx) return;
    this.musicDuck = amount;
    this.applyMusicGain();
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.musicDuck = 1;
      this.applyMusicGain();
    }, time * 1000);
  }

  applyMusicGain() {
    if (!this.ctx) return;
    const target = this.musicEnabled ? this.musicBase * this.musicDuck : 0;
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
  }

  setMusic(on) {
    this.musicEnabled = on;
    if (this.ctx) {
      if (on && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      this.applyMusicGain();
    }
    if (on) this.startMusic();
  }

  setSfx(on) {
    this.sfxEnabled = on;
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? this.sfxBase : 0, this.ctx.currentTime, 0.08);
  }

  startMusic() {
    if (!this.ctx || this.timer) return;
    this.nextStepTime = this.ctx.currentTime + 0.12;
    this.timer = setInterval(() => this.scheduler(), 60);
  }

  scheduler() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.nextStepTime < now - 0.5) this.nextStepTime = now + 0.05;
    this.intensity += (this.targetIntensity - this.intensity) * 0.02;
    while (this.nextStepTime < now + 0.22) {
      this.playStep(this.step, this.nextStepTime);
      this.nextStepTime += this.stepDur;
      this.step++;
    }
  }

  playStep(step, t) {
    const chord = CHORDS[Math.floor(step / 64) % CHORDS.length];
    const pos = step % 64;
    const inten = this.intensity;

    if (pos === 0) {
      this.pad(chord, t, 64 * this.stepDur * 1.05);
    }
    if (pos % 16 === 0 || pos % 16 === 10) {
      const root = chord[0] - 24;
      this._tone('sine', MIDI(root), MIDI(root) * 0.985, 1.5, 0.055, {
        bus: 'music', attack: 0.02, filter: { type: 'lowpass', freq: 260 },
      });
    }
    if (pos % 16 === 0) {
      this._kick(t, 0.028 + inten * 0.018);
    }
    const arpChance = 0.16 + inten * 0.3;
    if (pos % 2 === 0 && this.rng() < arpChance) {
      const idx = Math.floor(this.rng() * chord.length);
      const note = chord[idx] + (this.rng() < 0.3 ? 24 : 12);
      this._pluck(t + this.rng() * 0.02, MIDI(note), 0.2 + this.rng() * 0.2, 0.018 + inten * 0.012);
    }
    if (inten > 0.25 && pos % 4 === 2) {
      this._hat(t, 0.006 + inten * 0.006);
    }
    if (inten > 0.55 && pos % 32 === 16) {
      this._bell(t, MIDI(chord[2] + 24), 0.6, 0.012, 0.65);
    }
    if (pos === 48 && inten > 0.7) {
      const note = chord[Math.floor(this.rng() * chord.length)] + 12;
      this._bell(t + this.stepDur, MIDI(note), 0.8, 0.008, 0.7);
    }
  }

  pad(chord, t, dur) {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520 + this.intensity * 380;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.017, t + 2.2);
    g.gain.setValueAtTime(0.017, t + dur * 0.72);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 3.2);
    lp.connect(g);
    g.connect(this.musicBus);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    g.connect(send);
    send.connect(this.reverb);
    for (const m of chord) {
      const f = MIDI(m);
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = det + rand(-2, 2);
        const og = ctx.createGain();
        og.gain.value = 0.014;
        o.connect(og);
        og.connect(lp);
        o.start(t);
        o.stop(t + dur + 3.4);
      }
    }
  }

  _tone(type, f0, f1, dur, vol, opts = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = (opts.when ?? ctx.currentTime) + (opts.delay || 0);
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(10, f0), t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t0 + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + Math.max(0.003, atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out = g;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filter.type || 'lowpass';
      f.frequency.setValueAtTime(opts.filter.freq || 1000, t0);
      if (opts.filter.end) f.frequency.exponentialRampToValueAtTime(opts.filter.end, t0 + dur);
      f.Q.value = opts.filter.q || 0.7;
      o.connect(f);
      f.connect(g);
    } else {
      o.connect(g);
    }
    if (opts.pan) {
      const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (p) { p.pan.value = opts.pan; g.connect(p); out = p; }
    }
    const bus = opts.bus === 'music' ? this.musicBus : this.sfxBus;
    out.connect(bus);
    if (opts.reverb) {
      const send = ctx.createGain();
      send.gain.value = opts.reverb;
      out.connect(send);
      send.connect(this.reverb);
    }
    if (opts.delay) {
      const send = ctx.createGain();
      send.gain.value = opts.delay;
      out.connect(send);
      send.connect(this.delay);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.08);
  }

  _noise(dur, vol, opts = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = (opts.when ?? ctx.currentTime) + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq || 1200, t0);
    if (opts.end) f.frequency.exponentialRampToValueAtTime(opts.end, t0 + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (opts.attack ?? 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    const bus = opts.bus === 'music' ? this.musicBus : this.sfxBus;
    g.connect(bus);
    if (opts.reverb) {
      const send = ctx.createGain();
      send.gain.value = opts.reverb;
      g.connect(send);
      send.connect(this.reverb);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  _kick(t, vol) {
    this._tone('sine', 118, 42, 0.3, vol, { bus: 'music', when: t, attack: 0.004 });
  }
  _hat(t, vol) {
    this._noise(0.035, vol, { type: 'highpass', freq: 6500, when: t, bus: 'music' });
  }
  _pluck(t, freq, dur, vol) {
    this._tone('triangle', freq, freq * 0.995, dur, vol, {
      bus: 'music', when: t, attack: 0.004, delay: 0.001, reverb: 0.25,
    });
    this._tone('sine', freq * 2, freq * 1.99, dur * 0.5, vol * 0.3, { bus: 'music', when: t, attack: 0.002 });
  }
  _bell(t, freq, dur, vol, rev = 0.5) {
    this._tone('sine', freq, freq, dur, vol, { bus: 'music', when: t, attack: 0.002, reverb: rev, pan: rand(-0.4, 0.4) });
    this._tone('sine', freq * 2.01, freq * 2, dur * 0.5, vol * 0.3, { bus: 'music', when: t, attack: 0.002 });
  }

  sfxThrottle(key, ms) {
    const now = performance.now();
    if ((this.sfxLast.get(key) || 0) > now - ms) return false;
    this.sfxLast.set(key, now);
    return true;
  }

  shoot(weaponId) {
    if (!this.ctx || !this.sfxEnabled) return;
    const det = rand(-40, 40);
    if (weaponId === 'pulsar') {
      this._tone('triangle', 1450 + det, 460, 0.075, 0.02, { filter: { type: 'lowpass', freq: 4200 } });
      this._noise(0.03, 0.008, { type: 'highpass', freq: 3200 });
    } else if (weaponId === 'lance') {
      this._tone('sawtooth', 260 + det, 70, 0.28, 0.026, { filter: { type: 'lowpass', freq: 1400, end: 300 }, reverb: 0.18 });
      this._noise(0.12, 0.014, { type: 'bandpass', freq: 1300, end: 500, q: 1.2 });
    } else if (weaponId === 'scatter') {
      this._noise(0.13, 0.026, { type: 'bandpass', freq: 1900, end: 700, q: 0.8 });
      this._tone('sine', 130, 55, 0.16, 0.02);
    } else if (weaponId === 'halo') {
      this._tone('sine', 700 + det, 1400, 0.16, 0.014, { reverb: 0.3, pan: rand(-0.2, 0.2) });
      this._noise(0.18, 0.008, { type: 'bandpass', freq: 2600, end: 900, q: 2 });
    }
  }

  hit(crit = false) {
    if (!this.ctx || !this.sfxEnabled || !this.sfxThrottle('hit', 28)) return;
    this._noise(crit ? 0.07 : 0.035, crit ? 0.018 : 0.009, { type: 'highpass', freq: crit ? 2200 : 3400 });
    if (crit) this._tone('square', 900, 180, 0.08, 0.008, { filter: { type: 'lowpass', freq: 1500 } });
  }

  kill(big = false) {
    if (!this.ctx || !this.sfxEnabled || !this.sfxThrottle('kill', 38)) return;
    if (big) {
      this._noise(0.4, 0.05, { type: 'lowpass', freq: 1600, end: 200 });
      this._tone('sine', 150, 35, 0.45, 0.06, { reverb: 0.2 });
    } else {
      this._noise(0.16, 0.024, { type: 'lowpass', freq: 1500, end: 300 });
      this._tone('sine', 180 + rand(-30, 30), 55, 0.18, 0.022);
    }
  }

  graze(charge = 0) {
    if (!this.ctx || !this.sfxEnabled || !this.sfxThrottle('graze', 55)) return;
    const notes = [1046, 1175, 1318, 1568, 2093];
    const f = notes[Math.floor(charge * notes.length) % notes.length];
    this._tone('sine', f, f, 0.12, 0.009, { reverb: 0.35, pan: rand(-0.5, 0.5) });
  }

  pickup() {
    if (!this.ctx || !this.sfxEnabled || !this.sfxThrottle('pickup', 38)) return;
    const now = performance.now();
    if (now - this.pickStreakT > 700) this.pickStreak = 0;
    this.pickStreakT = now;
    this.pickStreak = Math.min(this.pickStreak + 1, 8);
    const scale = [659.25, 783.99, 880, 987.77, 1174.66, 1318.51, 1567.98, 1760];
    const f = scale[(this.pickStreak + Math.floor(rand(0, 2))) % scale.length];
    this._tone('triangle', f, f, 0.08, 0.009, { reverb: 0.12 });
  }

  heal() {
    if (!this.ctx || !this.sfxEnabled) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone('sine', f, f, 0.45, 0.02, { delay: i * 0.06, reverb: 0.45, attack: 0.01 });
    });
  }

  hurt() {
    if (!this.ctx || !this.sfxEnabled) return;
    this._tone('sawtooth', 170, 48, 0.38, 0.055, { filter: { type: 'lowpass', freq: 700, end: 180 }, reverb: 0.18 });
    this._noise(0.24, 0.04, { type: 'lowpass', freq: 900, end: 150 });
  }

  shieldBreak() {
    if (!this.ctx || !this.sfxEnabled) return;
    this._noise(0.22, 0.02, { type: 'highpass', freq: 3000, end: 900, q: 2 });
    this._tone('sine', 1600, 400, 0.25, 0.02, { reverb: 0.4 });
  }

  dash() {
    if (!this.ctx || !this.sfxEnabled || !this.sfxThrottle('dash', 70)) return;
    this._noise(0.22, 0.026, { type: 'bandpass', freq: 400, end: 2600, q: 0.9 });
    this._tone('sine', 220, 620, 0.16, 0.012, { filter: { type: 'lowpass', freq: 1800 } });
  }

  nova() {
    if (!this.ctx || !this.sfxEnabled) return;
    this.duckMusic(0.28, 1.1);
    this._tone('sine', 90, 28, 1.2, 0.13, { attack: 0.005, reverb: 0.5 });
    this._noise(0.9, 0.075, { type: 'lowpass', freq: 2600, end: 120, q: 0.6, reverb: 0.4 });
    [523, 784, 1046, 1568].forEach((f, i) => {
      this._tone('sine', f, f * 1.5, 0.6, 0.015, { delay: 0.05 + i * 0.045, reverb: 0.5 });
    });
  }

  levelup() {
    if (!this.ctx || !this.sfxEnabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((f, i) => {
      this._tone('triangle', f, f, 0.7, 0.02, { delay: i * 0.055, reverb: 0.55, attack: 0.008 });
    });
    this._noise(0.5, 0.006, { type: 'highpass', freq: 6000, reverb: 0.5 });
  }

  select() {
    if (!this.ctx || !this.sfxEnabled) return;
    this._tone('sine', 880, 1320, 0.22, 0.02, { reverb: 0.5 });
    this._tone('triangle', 442, 660, 0.18, 0.012);
  }

  wave() {
    if (!this.ctx || !this.sfxEnabled) return;
    this._tone('sine', 220, 218, 1.6, 0.026, { attack: 0.02, reverb: 0.5 });
    this._tone('sine', 330, 329, 1.3, 0.014, { attack: 0.02 });
  }

  bossIntro() {
    if (!this.ctx || !this.sfxEnabled) return;
    this.duckMusic(0.22, 2.6);
    this._tone('sawtooth', 55, 54, 2.4, 0.04, { filter: { type: 'lowpass', freq: 260 }, attack: 0.6, reverb: 0.55 });
    this._tone('sawtooth', 58.3, 57.5, 2.4, 0.032, { filter: { type: 'lowpass', freq: 240 }, attack: 0.8, reverb: 0.55 });
    this._noise(2.2, 0.014, { type: 'bandpass', freq: 400, end: 120, q: 1.4, attack: 1.2, reverb: 0.6 });
  }

  bossDeath() {
    if (!this.ctx || !this.sfxEnabled) return;
    this.duckMusic(0.2, 2.2);
    this._tone('sine', 70, 24, 1.8, 0.15, { reverb: 0.6 });
    this._noise(1.6, 0.08, { type: 'lowpass', freq: 2400, end: 100 });
    [392, 466, 587, 698].forEach((f, i) => {
      this._tone('sine', f, f, 1.4, 0.018, { delay: 0.3 + i * 0.09, reverb: 0.7, attack: 0.02 });
    });
  }

  gameover() {
    if (!this.ctx || !this.sfxEnabled) return;
    this.duckMusic(0.18, 3);
    [440, 349.23, 293.66, 220].forEach((f, i) => {
      this._tone('sine', f, f * 0.995, 1.6, 0.025, { delay: i * 0.22, reverb: 0.6, attack: 0.04 });
    });
    this._noise(1.2, 0.012, { type: 'lowpass', freq: 500, attack: 0.3, reverb: 0.5 });
  }

  revive() {
    if (!this.ctx || !this.sfxEnabled) return;
    [261.63, 392, 523.25, 659.25, 1046.5].forEach((f, i) => {
      this._tone('triangle', f, f, 1.2, 0.028, { delay: i * 0.07, reverb: 0.6, attack: 0.02 });
    });
  }

  uiHover() {
    if (!this.ctx || !this.sfxEnabled || !this.sfxThrottle('hover', 45)) return;
    this._tone('sine', 1200, 1200, 0.04, 0.006);
  }

  uiClick() {
    if (!this.ctx || !this.sfxEnabled) return;
    this._tone('triangle', 660, 990, 0.12, 0.012, { reverb: 0.2 });
  }
}
