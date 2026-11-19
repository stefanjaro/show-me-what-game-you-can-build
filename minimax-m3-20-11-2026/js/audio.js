(function (G) {
  'use strict';

  var A = (G.Audio = {
    ctx: null,
    ready: false,
    muted: false,
    master: null,
    musicBus: null,
    sfxBus: null,
    reverb: null,
    reverbSend: null,
    delay: null,
    delaySend: null,
    _timer: null,
    _nextNote: 0,
    _step: 0,
    intensity: 0,
    targetIntensity: 0,
    bpm: 96,
    rng: null,
    musicOn: true
  });

  var SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  var ROOT = 38;
  var PROG = [0, -4, 3, -2];

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  function degToMidi(deg) {
    var oct = Math.floor(deg / SCALE.length);
    var idx = ((deg % SCALE.length) + SCALE.length) % SCALE.length;
    return ROOT + SCALE[idx] + oct * 12;
  }

  A.init = function () {
    if (A.ready) return true;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;
    try { A.ctx = new Ctx(); } catch (e) { return false; }
    var ctx = A.ctx;

    A.master = ctx.createGain();
    A.master.gain.value = A.muted ? 0 : 0.9;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    A.master.connect(comp);
    comp.connect(ctx.destination);

    A.musicBus = ctx.createGain();
    A.musicBus.gain.value = 0.62;
    A.musicBus.connect(A.master);

    A.sfxBus = ctx.createGain();
    A.sfxBus.gain.value = 0.85;
    A.sfxBus.connect(A.master);

    A.reverb = ctx.createConvolver();
    A.reverb.buffer = makeIR(ctx, 2.4, 2.6);
    var revGain = ctx.createGain();
    revGain.gain.value = 0.5;
    A.reverb.connect(revGain);
    revGain.connect(A.master);
    A.reverbSend = A.reverb;

    A.delay = ctx.createDelay(1.0);
    A.delay.delayTime.value = 0.375;
    var fb = ctx.createGain();
    fb.gain.value = 0.36;
    var dFilter = ctx.createBiquadFilter();
    dFilter.type = 'lowpass';
    dFilter.frequency.value = 2600;
    var dGain = ctx.createGain();
    dGain.gain.value = 0.34;
    A.delay.connect(dFilter);
    dFilter.connect(fb);
    fb.connect(A.delay);
    dFilter.connect(dGain);
    dGain.connect(A.master);
    A.delaySend = A.delay;

    A.ready = true;
    A.rng = new G.U.RNG(1337);
    A._nextNote = ctx.currentTime + 0.1;
    A._timer = setInterval(schedule, 25);
    return true;
  };

  function makeIR(ctx, dur, decay) {
    var rate = ctx.sampleRate;
    var len = Math.floor(rate * dur);
    var buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        var t = i / len;
        var env = Math.pow(1 - t, decay);
        d[i] = (Math.random() * 2 - 1) * env * (i < 220 ? i / 220 : 1);
      }
    }
    return buf;
  }

  A.resume = function () {
    if (!A.ready) A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  A.setMuted = function (m) {
    A.muted = m;
    if (A.master) {
      A.master.gain.setTargetAtTime(m ? 0 : 0.9, A.ctx.currentTime, 0.05);
    }
  };

  A.setIntensity = function (v) { A.targetIntensity = G.U.clamp(v, 0, 1); };

  A.setMusicEnabled = function (on) {
    A.musicOn = on;
    if (A.musicBus) A.musicBus.gain.setTargetAtTime(on ? 0.62 : 0, A.ctx.currentTime, 0.15);
  };

  function schedule() {
    if (!A.ready) return;
    var ctx = A.ctx;
    A.intensity += (A.targetIntensity - A.intensity) * 0.05;
    var stepDur = 60 / A.bpm / 4;
    while (A._nextNote < ctx.currentTime + 0.15) {
      playStep(A._step, A._nextNote, stepDur);
      A._nextNote += stepDur;
      A._step++;
    }
  }

  function playStep(step, t, sd) {
    if (!A.musicOn) return;
    var s16 = step % 16;
    var bar = Math.floor(step / 16);
    var chordRoot = PROG[bar % PROG.length] + ROOT;
    var I = A.intensity;

    if (s16 % 4 === 0) kick(t, 0.85 * (0.6 + I * 0.5));
    if (I > 0.18 && (s16 % 2 === 1)) hat(t, s16 % 4 === 3 ? 0.28 : 0.16, 0.5 + I * 0.5);
    if (I > 0.32 && (s16 === 4 || s16 === 12)) snare(t, 0.4 + I * 0.4);
    if (I > 0.1) bass(t, sd, chordRoot, s16, I);
    if (I > 0.26) pad(t, sd, chordRoot, I);
    if (I > 0.45) arp(t, sd, chordRoot, s16, I);
    if (I > 0.62 && s16 === 0 && bar % 2 === 1) lead(t, sd, chordRoot);
  }

  function env(node, t, a, d, peak) {
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function noiseBuffer(ctx, dur) {
    var len = Math.floor(ctx.sampleRate * dur);
    var b = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function kick(t, vol) {
    var ctx = A.ctx;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(A.musicBus);
    o.start(t); o.stop(t + 0.34);
  }

  function hat(t, vol, tone) {
    var ctx = A.ctx;
    var s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, 0.08);
    var f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7200;
    var g = ctx.createGain();
    env(g, t, 0.002, 0.045, vol * 0.22);
    s.connect(f); f.connect(g); g.connect(A.musicBus);
    s.start(t); s.stop(t + 0.09);
  }

  function snare(t, vol) {
    var ctx = A.ctx;
    var s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, 0.3);
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
    var g = ctx.createGain();
    env(g, t, 0.003, 0.17, vol * 0.34);
    s.connect(f); f.connect(g); g.connect(A.musicBus);
    var sg = ctx.createGain(); sg.gain.value = 0.35;
    g.connect(sg); sg.connect(A.reverbSend);
    s.start(t); s.stop(t + 0.32);
  }

  function bass(t, sd, root, s16, I) {
    var ctx = A.ctx;
    var pat = [0, 0, 7, 0, 0, 12, 0, 7, 0, 0, 3, 0, 10, 0, 7, 5];
    var n = root + pat[s16];
    var o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(n - 12);
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(240 + I * 900, t);
    f.frequency.exponentialRampToValueAtTime(120 + I * 320, t + sd * 2);
    f.Q.value = 7;
    var g = ctx.createGain();
    env(g, t, 0.006, sd * 1.7, 0.17 + I * 0.1);
    o.connect(f); f.connect(g); g.connect(A.musicBus);
    o.start(t); o.stop(t + sd * 2.4);
  }

  function pad(t, sd, root, I) {
    var ctx = A.ctx;
    var chord = [root, root + 7, root + 12, root + 15];
    var dur = sd * 16;
    for (var i = 0; i < chord.length; i++) {
      var o = ctx.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = midi(chord[i]);
      o.detune.value = (i % 2 ? 7 : -6);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500 + I * 1700;
      f.Q.value = 2;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.026 + I * 0.022, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(A.musicBus);
      var sg = ctx.createGain(); sg.gain.value = 0.6;
      g.connect(sg); sg.connect(A.reverbSend);
      o.start(t); o.stop(t + dur + 0.05);
    }
  }

  function arp(t, sd, root, s16, I) {
    var ctx = A.ctx;
    var shape = [0, 2, 4, 2, 7, 4, 2, 0, 4, 7, 9, 7, 4, 2, 0, 2];
    var n = degToMidi(root - 12 + shape[s16]);
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = midi(n);
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = midi(n) * 1.6; f.Q.value = 1.4;
    var g = ctx.createGain();
    env(g, t, 0.004, sd * 1.4, 0.05 + I * 0.045);
    o.connect(f); f.connect(g); g.connect(A.musicBus);
    var dg = ctx.createGain(); dg.gain.value = 0.4;
    g.connect(dg); dg.connect(A.delaySend);
    o.start(t); o.stop(t + sd * 2);
  }

  function lead(t, sd, root) {
    var ctx = A.ctx;
    var notes = [12, 15, 19, 22, 19, 15];
    for (var i = 0; i < notes.length; i++) {
      var tt = t + i * sd * 0.5;
      var o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = midi(root + notes[i]);
      var g = ctx.createGain();
      env(g, tt, 0.01, sd * 0.9, 0.07);
      o.connect(g); g.connect(A.musicBus);
      var sg = ctx.createGain(); sg.gain.value = 0.5;
      g.connect(sg); sg.connect(A.reverbSend);
      o.start(tt); o.stop(tt + sd);
    }
  }

  function tone(o, t, dur, peak, type) {
    var ctx = A.ctx;
    var node = ctx.createOscillator();
    node.type = type || 'sine';
    o.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), t + dur);
    var g = ctx.createGain();
    env(g, t, o.a || 0.006, dur, peak);
    node.connect(g);
    g.connect(o.bus || A.sfxBus);
    if (o.send) {
      var sg = ctx.createGain(); sg.gain.value = o.send;
      g.connect(sg); sg.connect(o.send === 'd' ? A.delaySend : A.reverbSend);
    }
    node.start(t);
    node.stop(t + dur + (o.a || 0.006) + 0.05);
    return node;
  }

  A.sfx = {
    eat: function (pitch) {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      var p = pitch || 1;
      tone({ f0: 420 * p, f1: 900 * p, a: 0.004, dur: 0.1, send: 0.2 }, t, 0.1, 0.07, 'sine');
    },
    thud: function () {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      tone({ f0: 160, f1: 60, a: 0.004, dur: 0.2 }, t, 0.2, 0.12, 'triangle');
    },
    dash: function () {
      if (!A.ready || A.muted) return;
      var ctx = A.ctx, t = ctx.currentTime;
      var s = ctx.createBufferSource();
      s.buffer = noiseBuffer(ctx, 0.5);
      var f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 1.6;
      f.frequency.setValueAtTime(380, t);
      f.frequency.exponentialRampToValueAtTime(3400, t + 0.22);
      f.frequency.exponentialRampToValueAtTime(500, t + 0.42);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      s.connect(f); f.connect(g); g.connect(A.sfxBus);
      s.start(t); s.stop(t + 0.5);
    },
    hit: function () {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      tone({ f0: 220, f1: 90, a: 0.003, dur: 0.16, send: 0.25 }, t, 0.16, 0.16, 'square');
    },
    kill: function () {
      if (!A.ready || A.muted) return;
      var ctx = A.ctx, t = ctx.currentTime;
      var s = ctx.createBufferSource();
      s.buffer = noiseBuffer(ctx, 0.45);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(2600, t);
      f.frequency.exponentialRampToValueAtTime(180, t + 0.4);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.26, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      s.connect(f); f.connect(g); g.connect(A.sfxBus);
      s.start(t); s.stop(t + 0.45);
      tone({ f0: 420, f1: 70, a: 0.004, dur: 0.26 }, t, 0.26, 0.13, 'triangle');
    },
    shoot: function () {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      tone({ f0: 900, f1: 300, a: 0.003, dur: 0.11 }, t, 0.11, 0.06, 'square');
    },
    pickup: function () {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      var ns = [72, 79, 84];
      for (var i = 0; i < ns.length; i++) {
        tone({ f0: midi(ns[i]), a: 0.006, dur: 0.28, send: 0.35 }, t + i * 0.07, 0.28, 0.075, 'triangle');
      }
    },
    levelup: function () {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      var ns = [50, 57, 62, 65, 69];
      for (var i = 0; i < ns.length; i++) {
        tone({ f0: midi(ns[i]), a: 0.02, dur: 0.9, send: 0.5 }, t + i * 0.045, 0.9, 0.06, 'sawtooth');
      }
    },
    ult: function () {
      if (!A.ready || A.muted) return;
      var ctx = A.ctx, t = ctx.currentTime;
      var s = ctx.createBufferSource();
      s.buffer = noiseBuffer(ctx, 1.8);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(120, t);
      f.frequency.exponentialRampToValueAtTime(5200, t + 0.9);
      f.frequency.exponentialRampToValueAtTime(120, t + 1.7);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.85);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
      s.connect(f); f.connect(g); g.connect(A.sfxBus);
      s.start(t); s.stop(t + 1.8);
      tone({ f0: 150, f1: 24, a: 0.02, dur: 1.5 }, t, 1.5, 0.34, 'sine');
    },
    death: function () {
      if (!A.ready || A.muted) return;
      var ctx = A.ctx, t = ctx.currentTime;
      var s = ctx.createBufferSource();
      s.buffer = noiseBuffer(ctx, 2.4);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(4000, t);
      f.frequency.exponentialRampToValueAtTime(90, t + 2.1);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.34, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      s.connect(f); f.connect(g); g.connect(A.sfxBus);
      s.start(t); s.stop(t + 2.4);
      tone({ f0: 320, f1: 30, a: 0.02, dur: 1.8 }, t, 1.8, 0.2, 'triangle');
    },
    ui: function () {
      if (!A.ready || A.muted) return;
      var t = A.ctx.currentTime;
      tone({ f0: 1200, f1: 1700, a: 0.002, dur: 0.06 }, t, 0.06, 0.04, 'square');
    },
    boss: function () {
      if (!A.ready || A.muted) return;
      var ctx = A.ctx, t = ctx.currentTime;
      var o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 1.1);
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(f); f.connect(g); g.connect(A.sfxBus);
      o.start(t); o.stop(t + 1.25);
    }
  };
})(window.G = window.G || {});
