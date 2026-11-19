/* POLARIS — Audio: everything synthesized with WebAudio. No assets. */

const A = 440;
const n2f = n => A * Math.pow(2, (n - 69) / 12);   // midi → freq
const BPM = 128;
const STEP = 60 / BPM / 4;                         // 16th note
const LOOP_STEPS = 64;                             // 4 bars

/* chord roots (midi) + triads per bar: Am  F  C  G */
const CHORDS = [
  { root: 33, triad: [57, 60, 64] },   // Am  (A1 ; A3 C4 E4)
  { root: 29, triad: [53, 57, 60] },   // F   (F1 ; F3 A3 C4)
  { root: 36, triad: [60, 64, 67] },   // C   (C2 ; C4 E4 G4)
  { root: 31, triad: [55, 59, 62] },   // G   (G1 ; G3 B3 D4)
];

/* lead motif over 64 steps (midi or null) — A minor pentatonic colour */
const LEAD = (() => {
  const m = new Array(LOOP_STEPS).fill(null);
  const put = (i, v) => { m[i] = v; };
  put(0, 76); put(6, 74); put(8, 72); put(14, 69);
  put(16, 72); put(22, 76); put(24, 79); put(30, 76);
  put(32, 74); put(38, 72); put(40, 69); put(46, 67);
  put(48, 69); put(54, 72); put(56, 76); put(62, 74);
  return m;
})();

const ARP_PAT = [0, 1, 2, 1, 0, 2, 1, 2];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.intensity = 0.2;
    this.boss = false;
    this._timer = null;
    this._nextTime = 0;
    this._step = 0;
    this._playing = false;
    this._muffle = false;
    this._absorbN = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.95;

      this.lowpass = ctx.createBiquadFilter();
      this.lowpass.type = 'lowpass';
      this.lowpass.frequency.value = 18000;

      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.knee.value = 22;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.2;

      this.master.connect(this.lowpass);
      this.lowpass.connect(this.comp);
      this.comp.connect(ctx.destination);

      /* reverb */
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._makeIR(1.9, 2.6);
      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0.34;
      this.reverb.connect(this.reverbGain);
      this.reverbGain.connect(this.master);

      /* buses */
      this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.72;
      this.sfxBus.connect(this.master);
      this.sfxSend = ctx.createGain(); this.sfxSend.gain.value = 0.16;
      this.sfxBus.connect(this.sfxSend); this.sfxSend.connect(this.reverb);

      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0001;
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 16000;
      this.musicSend = ctx.createGain(); this.musicSend.gain.value = 0.22;
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.master);
      this.musicFilter.connect(this.musicSend);
      this.musicSend.connect(this.reverb);

      /* layer gains */
      this.layers = {};
      for (const k of ['kick', 'snare', 'hat', 'bass', 'arp', 'pad', 'lead']) {
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        g.connect(this.musicBus);
        this.layers[k] = g;
      }

      this.ready = true;
      return true;
    } catch (e) {
      console.warn('audio unavailable', e);
      return false;
    }
  }

  _makeIR(seconds, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (t < 0.004 ? t / 0.004 : 1);
      }
    }
    return buf;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.95, this.ctx.currentTime, 0.05);
    }
  }

  setIntensity(v) { this.intensity = Math.max(0, Math.min(1, v)); }
  setBoss(b) { this.boss = b; }

  setMuffle(on) {
    if (!this.ready || this._muffle === on) return;
    this._muffle = on;
    const t = this.ctx.currentTime;
    this.musicFilter.frequency.cancelScheduledValues(t);
    this.musicFilter.frequency.setTargetAtTime(on ? 520 : 16000, t, 0.08);
  }

  /* ============================ SFX ============================ */

  _tone(o) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t0 = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, o.f), t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.sweep || o.dur));
    const g = ctx.createGain();
    const dur = o.dur || 0.15;
    const vol = o.gain ?? 0.2;
    const atk = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.setValueAtTime(o.ff || 1200, t0);
      if (o.ff2) f.frequency.exponentialRampToValueAtTime(o.ff2, t0 + dur);
      f.Q.value = o.q || 1;
      node.connect(f); node = f;
    }
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      node.connect(p); node = p;
    }
    node.connect(g);
    g.connect(o.bus || this.sfxBus);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(this.reverb); }
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  _noise(o) {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const t0 = o.t ?? ctx.currentTime;
    const dur = o.dur || 0.12;
    const src = ctx.createBufferSource();
    const len = Math.ceil(ctx.sampleRate * (dur + 0.02));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.ff || 2400, t0);
    if (o.ff2) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.ff2), t0 + dur);
    f.Q.value = o.q || 0.9;
    const g = ctx.createGain();
    const vol = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + (o.attack ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g);
    g.connect(o.bus || this.sfxBus);
    if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; g.connect(s); s.connect(this.reverb); }
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  shoot(polarity) {
    const base = polarity === 0 ? 640 : 900;
    this._tone({ f: base, f2: base * 0.55, type: 'square', dur: 0.075, gain: 0.055, filter: 'lowpass', ff: 3400, ff2: 1500 });
    this._noise({ dur: 0.045, gain: 0.03, ff: 5200, filter: 'highpass' });
  }
  hit() {
    this._noise({ dur: 0.05, gain: 0.075, ff: 2600, q: 1.4 });
  }
  shielded() {
    this._tone({ f: 1180, f2: 900, type: 'triangle', dur: 0.05, gain: 0.045 });
  }
  kill(big = false) {
    const f = big ? 150 : 240;
    this._tone({ f, f2: f * (big ? 3.4 : 2.6), type: 'triangle', dur: big ? 0.34 : 0.16, gain: big ? 0.16 : 0.075, rev: big ? 0.4 : 0.12 });
    this._noise({ dur: big ? 0.3 : 0.1, gain: big ? 0.14 : 0.06, ff: big ? 900 : 3200, ff2: big ? 5200 : 6200 });
  }
  absorb() {
    this._absorbN = (this._absorbN + 1) % 7;
    const f = 500 + this._absorbN * 95;
    this._tone({ f, f2: f * 1.7, type: 'sine', dur: 0.1, gain: 0.06, rev: 0.2 });
  }
  dash() {
    this._noise({ dur: 0.2, gain: 0.1, filter: 'bandpass', ff: 700, ff2: 4800, q: 1.2 });
    this._tone({ f: 220, f2: 700, type: 'sawtooth', dur: 0.16, gain: 0.045, filter: 'lowpass', ff: 1800, ff2: 5000 });
  }
  switchPol() {
    this._tone({ f: 760, f2: 1320, type: 'square', dur: 0.09, gain: 0.06, filter: 'lowpass', ff: 2600 });
    this._noise({ dur: 0.07, gain: 0.05, ff: 4200, filter: 'highpass' });
  }
  hurt() {
    this._tone({ f: 170, f2: 70, type: 'sawtooth', dur: 0.3, gain: 0.2, filter: 'lowpass', ff: 900, ff2: 260 });
    this._noise({ dur: 0.18, gain: 0.14, ff: 1600, ff2: 400 });
  }
  level() {
    const t = this.ctx ? this.ctx.currentTime : 0;
    [0, 4, 7, 12].forEach((s, i) => {
      this._tone({ t: t + i * 0.055, f: n2f(69 + s), type: 'triangle', dur: 0.24, gain: 0.1, rev: 0.35 });
    });
    this._noise({ t: t + 0.02, dur: 0.5, gain: 0.045, filter: 'highpass', ff: 5200, ff2: 900, rev: 0.4 });
  }
  cardHover() { this._tone({ f: 1400, type: 'sine', dur: 0.04, gain: 0.028 }); }
  cardPick() {
    this._tone({ f: 880, f2: 1760, type: 'triangle', dur: 0.16, gain: 0.1, rev: 0.3 });
    this._noise({ dur: 0.1, gain: 0.05, ff: 3000, ff2: 7000, filter: 'highpass' });
  }
  nova() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    this._tone({ t, f: 78, f2: 34, type: 'sine', dur: 1.1, gain: 0.4, rev: 0.6 });
    this._tone({ t, f: 156, f2: 66, type: 'triangle', dur: 0.9, gain: 0.2, rev: 0.5 });
    this._noise({ t, dur: 0.85, gain: 0.28, filter: 'bandpass', ff: 6000, ff2: 300, q: 0.6, rev: 0.55 });
    for (let i = 0; i < 5; i++) {
      this._tone({ t: t + 0.05 + i * 0.07, f: n2f(81 + [0, 7, 12, 16, 19][i]), type: 'sine', dur: 0.5, gain: 0.06, rev: 0.5 });
    }
  }
  bossRoar() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    this._tone({ t, f: 92, f2: 36, type: 'sawtooth', dur: 1.5, gain: 0.24, filter: 'lowpass', ff: 1400, ff2: 180, rev: 0.6 });
    this._noise({ t, dur: 1.3, gain: 0.16, filter: 'lowpass', ff: 2400, ff2: 200, rev: 0.5 });
    this._tone({ t: t + 0.1, f: 46, type: 'square', dur: 1.4, gain: 0.12, filter: 'lowpass', ff: 400 });
  }
  bossDie() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      this._tone({ t: t + i * 0.09, f: n2f(64 - i * 2), type: 'sawtooth', dur: 0.5, gain: 0.12, filter: 'lowpass', ff: 2600, ff2: 500, rev: 0.4 });
    }
    this._noise({ t, dur: 1.1, gain: 0.2, filter: 'lowpass', ff: 5200, ff2: 160, rev: 0.6 });
    this._tone({ t: t + 0.5, f: 60, f2: 28, type: 'sine', dur: 1.4, gain: 0.3, rev: 0.6 });
  }
  death() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    this._tone({ t, f: 440, f2: 55, type: 'sawtooth', dur: 2.2, gain: 0.2, filter: 'lowpass', ff: 3000, ff2: 140, rev: 0.7 });
    this._noise({ t, dur: 1.6, gain: 0.16, filter: 'lowpass', ff: 4000, ff2: 120, rev: 0.6 });
    [0, 0.22, 0.44].forEach((d, i) => this._tone({ t: t + d, f: n2f(57 - i * 5), type: 'triangle', dur: 1.2, gain: 0.1, rev: 0.7 }));
  }
  victory() {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    [0, 0.14, 0.28, 0.5].forEach((d, i) => {
      const chord = [69, 72, 76, 81];
      this._tone({ t: t + d, f: n2f(chord[i]), type: 'triangle', dur: 1.6, gain: 0.12, rev: 0.7 });
      this._tone({ t: t + d, f: n2f(chord[i] - 12), type: 'sine', dur: 1.6, gain: 0.1, rev: 0.7 });
    });
    this._noise({ t, dur: 1.4, gain: 0.1, filter: 'highpass', ff: 6000, ff2: 900, rev: 0.8 });
  }
  ui(kind = 'click') {
    if (kind === 'hover') this._tone({ f: 1650, type: 'sine', dur: 0.035, gain: 0.022 });
    else this._tone({ f: 720, f2: 1080, type: 'square', dur: 0.07, gain: 0.04, filter: 'lowpass', ff: 2600 });
  }
  buy() {
    const t = this.ctx.currentTime;
    [0, 0.07, 0.14].forEach((d, i) => this._tone({ t: t + d, f: n2f(72 + i * 5), type: 'triangle', dur: 0.3, gain: 0.09, rev: 0.4 }));
  }
  deny() { this._tone({ f: 220, f2: 150, type: 'square', dur: 0.14, gain: 0.06, filter: 'lowpass', ff: 1200 }); }

  /* ============================ MUSIC ============================ */

  startMusic() {
    if (!this.ensure()) return;
    if (this._playing) return;
    this._playing = true;
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.08;
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.6);
    if (!this._timer) this._timer = setInterval(() => this._tick(), 25);
  }

  stopMusic(fade = 1.2) {
    if (!this.ready || !this._playing) return;
    this._playing = false;
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setTargetAtTime(0.0001, t, fade / 3);
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _tick() {
    if (!this._playing || !this.ctx) return;
    const ahead = this.ctx.currentTime + 0.16;
    while (this._nextTime < ahead) {
      this._scheduleStep(this._step, this._nextTime);
      this._nextTime += STEP;
      this._step = (this._step + 1) % LOOP_STEPS;
    }
  }

  _scheduleStep(step, t) {
    if (this.muted) return;
    const I = this.boss ? Math.max(0.85, this.intensity) : this.intensity;
    const bar = (step / 16) | 0;
    const inBar = step % 16;
    const ch = CHORDS[bar];
    const L = this.layers;

    /* --- drums --- */
    if (I > 0.06 && (inBar === 0 || inBar === 4 || inBar === 8 || inBar === 12)) {
      this._drumKick(t, L.kick, I > 0.5 ? 0.95 : 0.8);
    }
    if (I > 0.3 && (inBar === 4 || inBar === 12)) this._drumSnare(t, L.snare, I);
    if (I > 0.16) {
      const sixteenths = I > 0.62;
      if (sixteenths || inBar % 2 === 0) {
        const open = (inBar === 6 || inBar === 14) && I > 0.45;
        this._drumHat(t, L.hat, open, inBar % 4 === 0 ? 0.5 : 0.3);
      }
    }

    /* --- bass --- */
    if (I > 0.1) {
      const pat = [0, 3, 6, 8, 11, 14];
      if (pat.includes(inBar)) {
        const oct = (inBar === 6 || inBar === 14) ? 12 : 0;
        this._bass(n2f(ch.root + oct), t, STEP * (inBar === 0 ? 2.4 : 1.6), L.bass, this.boss ? 0.5 : 0.4);
      }
    }

    /* --- arp --- */
    if (I > 0.34 && inBar % 2 === 0) {
      const idx = ARP_PAT[(step / 2 | 0) % ARP_PAT.length];
      const oct = (step % 16 >= 8) ? 12 : 0;
      this._arp(n2f(ch.triad[idx] + oct), t, L.arp, I);
    }

    /* --- pad --- */
    if (I > 0.5 && inBar === 0) {
      for (const m of ch.triad) this._pad(n2f(m - 12), t, STEP * 15.5, L.pad);
    }

    /* --- lead --- */
    if (I > 0.7) {
      const m = LEAD[step];
      if (m != null) this._lead(n2f(m), t, L.lead);
    }
  }

  _drumKick(t, bus, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.3);
    /* click */
    const n = ctx.createBufferSource();
    const len = Math.ceil(ctx.sampleRate * 0.02);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    n.buffer = b;
    const ng = ctx.createGain(); ng.gain.value = 0.14 * vel;
    n.connect(ng); ng.connect(bus);
    n.start(t); n.stop(t + 0.03);
  }

  _drumSnare(t, bus, I) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    const dur = 0.19;
    const len = Math.ceil(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
    src.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.34 * (0.6 + I * 0.5), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + dur + 0.02);
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, t);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.18, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(og); og.connect(bus);
    o.start(t); o.stop(t + 0.12);
  }

  _drumHat(t, bus, open, vel) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    const dur = open ? 0.22 : 0.05;
    const len = Math.ceil(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, open ? 1.4 : 3);
    src.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7400;
    const g = ctx.createGain(); g.gain.value = 0.16 * vel;
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  _bass(freq, t, dur, bus, vel) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(this.boss ? 900 : 560, t);
    f.frequency.exponentialRampToValueAtTime(160, t + dur);
    f.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
    const sub = ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.setValueAtTime(freq / 2, t);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(vel * 0.8, t + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.85);
    sub.connect(sg); sg.connect(bus);
    sub.start(t); sub.stop(t + dur + 0.03);
  }

  _arp(freq, t, bus, I) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(freq, t);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1500 + I * 3500, t);
    const g = ctx.createGain();
    const dur = STEP * 1.4;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  _pad(freq, t, dur, bus) {
    const ctx = this.ctx;
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(freq, t);
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.6);
      g.gain.setValueAtTime(0.05, t + dur - 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(bus);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  _lead(freq, t, bus) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2600, t);
    f.frequency.exponentialRampToValueAtTime(900, t + 0.4);
    f.Q.value = 3;
    const g = ctx.createGain();
    const dur = 0.42;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
    /* octave shimmer */
    const o2 = ctx.createOscillator();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(freq * 2, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.03, t + 0.03);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
    o2.connect(g2); g2.connect(bus);
    o2.start(t); o2.stop(t + dur);
  }
}
