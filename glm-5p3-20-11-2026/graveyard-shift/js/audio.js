'use strict';
const A = {
  ctx: null, master: null, comp: null, sfxG: null, musG: null, delay: null,
  noiseBuf: null, onSfx: true, onMusic: true, started: false,
  mode: null, bpm: 104, step: 0, nextT: 0, timer: null, intensity: 1,
  voices: 0, bellT: 0, duckT: 0,

  ensure() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    A.ctx = ctx;
    A.comp = ctx.createDynamicsCompressor();
    A.comp.threshold.value = -20; A.comp.ratio.value = 6; A.comp.attack.value = 0.004;
    A.master = ctx.createGain(); A.master.gain.value = 0.9;
    A.comp.connect(A.master); A.master.connect(ctx.destination);
    A.sfxG = ctx.createGain(); A.sfxG.gain.value = A.onSfx ? 0.55 : 0; A.sfxG.connect(A.comp);
    A.musG = ctx.createGain(); A.musG.gain.value = A.onMusic ? 0.5 : 0;
    A.musLP = ctx.createBiquadFilter(); A.musLP.type = 'lowpass'; A.musLP.frequency.value = 12000;
    A.musG.connect(A.musLP); A.musLP.connect(A.comp);
    A.delay = ctx.createDelay(1); A.delay.delayTime.value = 0.26;
    A.delFb = ctx.createGain(); A.delFb.gain.value = 0.34;
    A.delOut = ctx.createGain(); A.delOut.gain.value = 0.5;
    A.delay.connect(A.delFb); A.delFb.connect(A.delay);
    A.delay.connect(A.delOut); A.delOut.connect(A.musG);
    const len = ctx.sampleRate * 1.2;
    A.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.started = true;
    return true;
  },

  setSfx(on) { A.onSfx = on; if (A.sfxG) A.sfxG.gain.setTargetAtTime(on ? 0.55 : 0, A.ctx.currentTime, 0.05); },
  setMusic(on) {
    A.onMusic = on;
    if (A.musG) A.musG.gain.setTargetAtTime(on ? 0.5 : 0, A.ctx.currentTime, 0.1);
  },

  tone(o) {
    const ctx = A.ctx;
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const dur = o.dur || 0.15;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f || 220, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + dur);
    const g = ctx.createGain();
    const v = (o.v || 0.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter[0]; f.frequency.value = o.filter[1]; if (o.filter[2]) f.Q.value = o.filter[2];
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.dest || A.sfxG);
    if (o.echo) g.connect(A.delay);
    osc.start(t); osc.stop(t + dur + 0.05);
    A.voices++;
    osc.onended = () => { A.voices--; };
    return osc;
  },

  noise(o) {
    const ctx = A.ctx;
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const dur = o.dur || 0.2;
    const src = ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 800, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(10, o.f2), t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const v = o.v || 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.a || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || A.sfxG);
    src.start(t); src.stop(t + dur + 0.05);
    A.voices++;
    src.onended = () => { A.voices--; };
  },

  sfx(name, p) {
    if (!A.ctx || !A.onSfx || A.voices > 26) return;
    const T = A.tone.bind(A), N = A.noise.bind(A);
    const t = A.ctx.currentTime;
    p = p || 0;
    switch (name) {
      case 'shoot':
        N({ f: 1400, f2: 300, dur: 0.09, v: 0.12, q: 2 });
        T({ f: 190, f2: 70, type: 'square', dur: 0.07, v: 0.05 });
        break;
      case 'scythe':
        N({ f: 400, f2: 2400, dur: 0.16, v: 0.1, q: 6, type: 'bandpass' });
        break;
      case 'hit':
        N({ f: 900, f2: 300, dur: 0.06, v: 0.1, q: 1 });
        T({ f: 130, f2: 60, type: 'triangle', dur: 0.06, v: 0.1 });
        break;
      case 'kill':
        T({ f: 70, f2: 34, type: 'sine', dur: 0.16, v: 0.22 });
        N({ f: 500, f2: 150, dur: 0.1, v: 0.1 });
        break;
      case 'minionHit':
        N({ f: 2200, dur: 0.04, v: 0.05, q: 3 });
        break;
      case 'pickup': {
        const f = 520 * Math.pow(1.06, Math.min(p, 24));
        T({ f: f, f2: f * 1.6, type: 'sine', dur: 0.1, v: 0.08 });
        break;
      }
      case 'essence':
        T({ f: 1250, type: 'square', dur: 0.06, v: 0.05 });
        T({ f: 1670, type: 'square', dur: 0.1, v: 0.05, t: t + 0.06 });
        break;
      case 'heal':
        [440, 550, 660].forEach((f, i) => T({ f, type: 'sine', dur: 0.3, v: 0.06, t: t + i * 0.07 }));
        break;
      case 'levelup':
        [62, 65, 69, 74].forEach((m, i) => {
          T({ f: U.mtof(m), type: 'sawtooth', dur: 0.5, v: 0.07, t: t + i * 0.06, filter: ['lowpass', 2200], echo: true });
          T({ f: U.mtof(m + 12), type: 'triangle', dur: 0.4, v: 0.05, t: t + i * 0.06 });
        });
        break;
      case 'raise':
        N({ f: 300, f2: 1800, dur: 0.35, v: 0.1, q: 1.5 });
        T({ f: 460, f2: 690, type: 'sine', dur: 0.4, v: 0.07, t: t + 0.12 });
        for (let i = 0; i < 3; i++) N({ f: 2600, dur: 0.03, v: 0.045, t: t + 0.1 + i * 0.07, q: 4 });
        break;
      case 'zap':
        T({ f: 1500, f2: 180, type: 'sawtooth', dur: 0.12, v: 0.08, filter: ['highpass', 400] });
        N({ f: 4000, f2: 900, dur: 0.1, v: 0.06, q: 0.5, type: 'highpass' });
        break;
      case 'boom':
        N({ f: 900, f2: 60, dur: 0.5, v: 0.3, q: 0.8, type: 'lowpass' });
        T({ f: 90, f2: 30, type: 'sine', dur: 0.5, v: 0.3 });
        break;
      case 'chest':
        [57, 60, 64, 69, 72].forEach((m, i) => T({ f: U.mtof(m), type: 'triangle', dur: 0.35, v: 0.07, t: t + i * 0.08, echo: true }));
        break;
      case 'evolve':
        [50, 57, 62, 66, 69, 74, 78].forEach((m, i) => {
          T({ f: U.mtof(m), type: 'sawtooth', dur: 0.6, v: 0.06, t: t + i * 0.05, filter: ['lowpass', 3000], echo: true });
        });
        N({ f: 200, f2: 3000, dur: 0.6, v: 0.08, q: 1 });
        break;
      case 'hurt':
        T({ f: 150, f2: 70, type: 'square', dur: 0.16, v: 0.14, filter: ['lowpass', 700] });
        N({ f: 300, f2: 120, dur: 0.12, v: 0.1 });
        break;
      case 'deathbell':
        [38, 50].forEach((m, i) => T({ f: U.mtof(m), type: 'sine', dur: 2.6, v: 0.14, t: t + i * 0.02 }));
        T({ f: U.mtof(38) * 2.76, type: 'sine', dur: 1.4, v: 0.04, t: t + 0.02 });
        break;
      case 'roar':
        T({ f: 110, f2: 38, type: 'sawtooth', dur: 1.1, v: 0.3, filter: ['lowpass', 600] });
        N({ f: 200, f2: 60, dur: 1.2, v: 0.22, q: 0.6, type: 'lowpass' });
        T({ f: 55, f2: 30, type: 'square', dur: 1.2, v: 0.18, t: t + 0.1 });
        break;
      case 'champdie':
        N({ f: 1200, f2: 80, dur: 0.8, v: 0.3, type: 'lowpass' });
        T({ f: 60, f2: 26, type: 'sine', dur: 0.8, v: 0.34 });
        [50, 57, 62, 65].forEach((m, i) => T({ f: U.mtof(m), type: 'triangle', dur: 1.2, v: 0.05, t: t + 0.3 + i * 0.05, echo: true }));
        break;
      case 'streak':
        T({ f: 700 + p * 130, f2: (700 + p * 130) * 1.5, type: 'square', dur: 0.12, v: 0.07 });
        T({ f: (700 + p * 130) * 1.5, f2: (700 + p * 130) * 2, type: 'square', dur: 0.14, v: 0.07, t: t + 0.09 });
        break;
      case 'ability':
        N({ f: 120, f2: 40, dur: 0.7, v: 0.34, q: 0.5, type: 'lowpass' });
        [50, 57, 62, 69].forEach((m, i) => T({ f: U.mtof(m), type: 'sawtooth', dur: 1.0, v: 0.05, t: t + i * 0.04, filter: ['lowpass', 900], echo: true }));
        N({ f: 600, f2: 2600, dur: 0.5, v: 0.07, q: 2 });
        break;
      case 'revive':
        [50, 54, 57, 62, 66].forEach((m, i) => T({ f: U.mtof(m), type: 'triangle', dur: 0.8, v: 0.08, t: t + i * 0.1, echo: true }));
        N({ f: 100, f2: 2000, dur: 0.8, v: 0.1 });
        break;
      case 'warn':
        T({ f: 98, f2: 92, type: 'sawtooth', dur: 0.5, v: 0.14, filter: ['lowpass', 500] });
        T({ f: 98 * 1.06, f2: 104, type: 'sawtooth', dur: 0.5, v: 0.14, filter: ['lowpass', 500] });
        break;
      case 'click':
        N({ f: 2400, dur: 0.035, v: 0.06, q: 5 });
        break;
      case 'hover':
        N({ f: 5200, dur: 0.02, v: 0.02, q: 8 });
        break;
      case 'error':
        T({ f: 110, f2: 80, type: 'square', dur: 0.2, v: 0.1 });
        break;
      case 'win':
        [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => T({ f: U.mtof(m), type: 'sawtooth', dur: 0.8, v: 0.06, t: t + i * 0.09, filter: ['lowpass', 3500], echo: true }));
        N({ f: 300, f2: 4000, dur: 0.9, v: 0.1, q: 1 });
        break;
      case 'tickup':
        T({ f: 900 + p * 40, type: 'square', dur: 0.04, v: 0.035 });
        break;
    }
  },

  chords: {
    run: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
    boss: [[50, 53, 57], [50, 53, 56], [49, 52, 56], [45, 49, 52]],
    title: [[38, 50, 53, 57], [34, 46, 50, 53], [40, 45, 48, 52], [33, 45, 49, 52]]
  },

  startMusic(mode) {
    if (!A.ensure()) return;
    A.mode = mode;
    A.step = 0;
    A.nextT = A.ctx.currentTime + 0.1;
    A.intensity = mode === 'title' ? 0 : 1;
    A.bpm = mode === 'title' ? 52 : mode === 'boss' ? 132 : 104;
    if (A.timer) clearInterval(A.timer);
    A.timer = setInterval(A.schedule, 46);
  },
  stopMusic() {
    if (A.timer) clearInterval(A.timer);
    A.timer = null; A.mode = null;
  },
  setIntensity(i) { A.intensity = i; },
  duck(on) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    A.musG.gain.cancelScheduledValues(t);
    A.musG.gain.setTargetAtTime(on ? 0.16 : (A.onMusic ? 0.5 : 0), t, 0.08);
    A.musLP.frequency.setTargetAtTime(on ? 700 : 12000, t, 0.1);
  },

  schedule() {
    if (!A.ctx || !A.mode) return;
    const spb = 60 / A.bpm / 4;
    while (A.nextT < A.ctx.currentTime + 0.18) {
      A.playStep(A.step, A.nextT, spb);
      A.step = (A.step + 1) % 64;
      A.nextT += spb;
    }
  },

  playStep(s, t, spb) {
    const M = A;
    const ch = M.chords[M.mode === 'boss' ? 'boss' : M.mode === 'title' ? 'title' : 'run'];
    const chord = ch[(s >> 4) & 3];
    const root = chord[0];
    const inten = M.mode === 'title' ? 0 : M.intensity;

    if (M.mode !== 'title') {
      if (s % 4 === 0) M.tone({ f: 130, f2: 38, type: 'sine', dur: 0.16, v: 0.5, t, dest: M.musG });
      if (inten >= 1) {
        if (s % 8 === 4) M.noise({ f: 1900, dur: 0.14, v: 0.16, q: 0.8, t, dest: M.musG });
        if (s % 2 === 0) M.noise({ f: 9000, dur: s % 4 === 2 ? 0.05 : 0.025, v: 0.05, type: 'highpass', t, dest: M.musG });
        const bl = [0, 3, 6, 8, 11, 14];
        if (bl.includes(s % 16)) {
          const off = (s % 16 === 6 || s % 16 === 14) ? 7 : (s % 16 === 11) ? 12 : 0;
          M.tone({ f: U.mtof(root - 12 + off), type: 'sawtooth', dur: spb * 2.2, v: 0.3, t, filter: ['lowpass', 420, 6], dest: M.musG });
          M.tone({ f: U.mtof(root - 24 + off), type: 'sine', dur: spb * 2.2, v: 0.32, t, dest: M.musG });
        }
      }
      if (inten >= 2) {
        const seq = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 0, 2, 1, 2];
        const nn = chord[seq[s % 16] % chord.length] + (s % 32 >= 16 ? 12 : 0);
        M.tone({ f: U.mtof(nn + 12), type: 'square', dur: spb * 0.9, v: 0.05, t, filter: ['lowpass', 2600], dest: M.musG, echo: true });
      }
      if (inten >= 3) {
        const lead = [74, 77, 74, 72, 70, 72, 69, 0, 72, 74, 77, 76, 74, 72, 74, 0];
        const ln = lead[(s % 32) % 16];
        if (ln) M.tone({ f: U.mtof(ln), type: 'sawtooth', dur: spb * 3, v: 0.06, t, filter: ['lowpass', 1800, 3], dest: M.musG, echo: true });
      }
    }
    if (s % 16 === 0) {
      chord.forEach(m => {
        M.tone({ f: U.mtof(m), type: 'sawtooth', dur: spb * 16, v: M.mode === 'title' ? 0.07 : 0.05, t, a: spb * 4, filter: ['lowpass', 900, 2], dest: M.musG });
        M.tone({ f: U.mtof(m) * 1.006, type: 'sawtooth', dur: spb * 16, v: M.mode === 'title' ? 0.05 : 0.04, t, a: spb * 4, filter: ['lowpass', 900, 2], dest: M.musG });
      });
      if (M.mode === 'title') M.tone({ f: U.mtof(root - 12), type: 'sine', dur: spb * 16, v: 0.2, t, a: spb * 2, dest: M.musG });
    }
    if (M.mode === 'title') {
      if (s % 16 === 8 && U.chance(0.5)) {
        const bells = [62, 65, 67, 69, 74];
        const f = U.mtof(U.pick(bells));
        M.tone({ f, type: 'sine', dur: 2.2, v: 0.1, t, echo: true, dest: M.musG });
        M.tone({ f: f * 2.76, type: 'sine', dur: 1.2, v: 0.03, t, dest: M.musG });
      }
    }
  }
};
