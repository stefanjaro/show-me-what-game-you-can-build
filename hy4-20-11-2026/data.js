'use strict';
const $ = id => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false });

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const now = () => performance.now() / 1000;
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtNum = n => Math.floor(n).toLocaleString('en-US');
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; };

const CFG = {
  playerR: 13, playerSpeed: 235, pickupBase: 92, xpBase: 8, xpGrowth: 1.33,
  maxEnemies: 280, maxProjectiles: 320, maxParticles: 620,
  dashSpeed: 820, dashTime: 0.17, dashCd: 2.3, grazeR: 46,
};

const PHASES = [
  { name: 'THE AWAKENING', bg: '#060a1a', accent: '#5ef2ff', grid: 'rgba(94,242,255,.055)', neb: ['#0a2f52', '#241046'] },
  { name: 'VIOLET TIDE', bg: '#0a0620', accent: '#b28bff', grid: 'rgba(178,139,255,.055)', neb: ['#2c1052', '#0b1c4e'] },
  { name: 'EMBER VEIL', bg: '#160a10', accent: '#ff8a5b', grid: 'rgba(255,138,91,.055)', neb: ['#4a1a0c', '#2a0a30'] },
  { name: 'VERDANT HAZE', bg: '#05140f', accent: '#7dff9b', grid: 'rgba(125,255,155,.055)', neb: ['#0a3a2c', '#0a2a44'] },
  { name: 'CRIMSON REQUIEM', bg: '#14060e', accent: '#ff4d6d', grid: 'rgba(255,77,109,.055)', neb: ['#4a0a2c', '#240a1c'] },
  { name: 'THE LAST LIGHT', bg: '#04060f', accent: '#ffffff', grid: 'rgba(255,255,255,.05)', neb: ['#0a1a3a', '#1c0a30'] },
];
const RAINBOW = ['#ff5c7c', '#ff9d5c', '#ffe86b', '#7dff9b', '#5ef2ff', '#6aa8ff', '#b28bff', '#ff6ad5', '#ff8ad8', '#a0ffe0', '#ffd76a', '#ffffff'];

const PASSIVES = {
  power: { name: 'OVERCHARGE', tag: 'PWR', color: '#ff8a5b', max: 8, desc: '+15% damage to everything.' },
  focus: { name: 'QUICKENED', tag: 'QCK', color: '#5ef2ff', max: 8, desc: '-7% weapon cooldown.' },
  area: { name: 'AMPLITUDE', tag: 'AMP', color: '#b28bff', max: 8, desc: '+15% area & range.' },
  multi: { name: 'MULTITUDE', tag: 'MLT', color: '#ff6ad5', max: 5, desc: '+1 projectile to every weapon.' },
  velocity: { name: 'MOMENTUM', tag: 'VEL', color: '#7dff9b', max: 8, desc: '+9% movement speed.' },
  vitality: { name: 'VITALITY', tag: 'VIT', color: '#ff5c7c', max: 8, desc: '+22 max HP (and heals you).' },
  armor: { name: 'AEGIS', tag: 'AEG', color: '#6aa8ff', max: 6, desc: '-7% damage taken.' },
  reach: { name: 'MAGNETISM', tag: 'MAG', color: '#9dffef', max: 6, desc: '+25% pickup radius.' },
  regen: { name: 'RENEWAL', tag: 'RGN', color: '#a0ffe0', max: 6, desc: '+0.6 HP regenerated per second.' },
  fortune: { name: 'FORTUNE', tag: 'FOR', color: '#ffd76a', max: 6, desc: '+15% luck (better choices, more drops).' },
  insight: { name: 'INSIGHT', tag: 'INS', color: '#ffffff', max: 6, desc: '+15% XP gained.' },
  precision: { name: 'PRECISION', tag: 'PRC', color: '#ffe86b', max: 6, desc: '+6% critical strike chance.' },
};

const WEAPONS = {
  bolts: { name: 'LUMEN BOLTS', tag: 'BLT', color: '#5ef2ff', type: 'bolt', max: 8, desc: 'Homing bolts of light seek the nearest foe.', evolve: { passive: 'focus', into: 'prism' }, base: { cd: 0.44, dmg: 13, speed: 520, count: 1, pierce: 0, homing: 3.2 } },
  wards: { name: 'ORBITING WARDS', tag: 'WRD', color: '#b28bff', type: 'orbit', max: 8, desc: 'Blades of light circle you, shredding all they touch.', evolve: { passive: 'area', into: 'horizon' }, base: { count: 3, radius: 80, dmg: 10, spin: 2.1, tick: 0.25 } },
  pulse: { name: 'PULSE RINGS', tag: 'PLS', color: '#7dff9b', type: 'ring', max: 8, desc: 'Expanding shockwaves erupt from your core.', evolve: { passive: 'focus', into: 'supernova' }, base: { cd: 1.9, dmg: 15, grow: 540, width: 26 } },
  arc: { name: 'ARC LIGHTNING', tag: 'ARC', color: '#ffe86b', type: 'chain', max: 8, desc: 'Lightning leaps between nearby enemies.', evolve: { passive: 'precision', into: 'stormcrown' }, base: { cd: 1.05, dmg: 18, jumps: 3, range: 200 } },
  shards: { name: 'SHARD SPRAY', tag: 'SHD', color: '#ff8ad8', type: 'shard', max: 8, desc: 'A volley of crystal shards in a wide cone.', evolve: { passive: 'multi', into: 'meteor' }, base: { cd: 0.92, dmg: 10, speed: 650, count: 5, spread: 0.72, pierce: 1 } },
  seekers: { name: 'SEEKER MISSILES', tag: 'MSL', color: '#ff9d5c', type: 'missile', max: 8, desc: 'Homing missiles detonate in bursts of flame.', evolve: { passive: 'power', into: 'armageddon' }, base: { cd: 1.35, dmg: 20, speed: 330, count: 2, blast: 66 } },
  aura: { name: 'SANCTUARY AURA', tag: 'AUR', color: '#9dffef', type: 'aura', max: 8, desc: 'A radiant field burns any foe that draws near.', evolve: { passive: 'vitality', into: 'crusader' }, base: { radius: 112, dmg: 8, tick: 0.32 } },
  prism: { name: 'PRISM CASCADE', tag: 'PRS', color: '#a0ffe0', type: 'bolt', max: 8, evo: true, from: 'bolts', desc: 'Bolts split, pierce and ricochet through the horde.', special: 'prism', base: { cd: 0.30, dmg: 22, speed: 640, count: 3, pierce: 3, homing: 4.5 } },
  horizon: { name: 'EVENT HORIZON', tag: 'HRZ', color: '#c9a0ff', type: 'orbit', max: 8, evo: true, from: 'wards', desc: 'A collapsing ring that drags foes in and erases them.', special: 'horizon', base: { count: 6, radius: 132, dmg: 26, spin: 2.6, tick: 0.18 } },
  supernova: { name: 'SUPERNOVA', tag: 'SNV', color: '#c9ff9b', type: 'ring', max: 8, evo: true, from: 'pulse', desc: 'Towering stellar waves scour the entire screen.', special: 'supernova', base: { cd: 1.5, dmg: 34, grow: 760, width: 44 } },
  stormcrown: { name: 'STORMCROWN', tag: 'STR', color: '#fff2a0', type: 'chain', max: 8, evo: true, from: 'arc', desc: 'Endless chains that stun everything they touch.', special: 'stormcrown', base: { cd: 0.72, dmg: 30, jumps: 9, range: 300 } },
  meteor: { name: 'METEOR SWARM', tag: 'MTR', color: '#ffb0e6', type: 'shard', max: 8, evo: true, from: 'shards', desc: 'Giant piercing shards that explode on impact.', special: 'meteor', base: { cd: 0.7, dmg: 24, speed: 720, count: 9, spread: 1.15, pierce: 4, blast: 46 } },
  armageddon: { name: 'ARMAGEDDON', tag: 'ARM', color: '#ffc07a', type: 'missile', max: 8, evo: true, from: 'seekers', desc: 'Missiles split into swarms of cluster bombs.', special: 'armageddon', base: { cd: 1.05, dmg: 30, speed: 380, count: 4, blast: 92 } },
  crusader: { name: 'CRUSADER FIELD', tag: 'CRU', color: '#c9fff4', type: 'aura', max: 8, evo: true, from: 'aura', desc: 'A holy field that incinerates foes and heals you.', special: 'crusader', base: { radius: 170, dmg: 22, tick: 0.2 } },
};

const ETYPE = {
  mote: { hp: 13, speed: 54, r: 11, dmg: 9, color: '#6fd0ff', xp: 1 },
  dart: { hp: 10, speed: 122, r: 9, dmg: 8, color: '#ff6ad5', xp: 1 },
  brute: { hp: 66, speed: 35, r: 23, dmg: 16, color: '#ff9d5c', xp: 3 },
  spinner: { hp: 28, speed: 72, r: 13, dmg: 11, color: '#b28bff', xp: 2 },
  shooter: { hp: 32, speed: 48, r: 14, dmg: 10, color: '#ffe86b', xp: 3 },
  wisp: { hp: 20, speed: 92, r: 12, dmg: 10, color: '#7dff9b', xp: 2, split: true },
  elite: { hp: 240, speed: 42, r: 30, dmg: 20, color: '#ff4d6d', xp: 12, elite: true },
  boss: { hp: 2600, speed: 32, r: 56, dmg: 26, color: '#ff2d55', xp: 60, boss: true },
};

const CHARACTERS = [
  { id: 'wanderer', name: 'THE WANDERER', tag: 'WA', color: '#5ef2ff', desc: 'Balanced and bright. +15% XP gain.', hpMul: 1, speedMul: 1, dmgMul: 1, start: 'bolts', xpBonus: 1.15, unlock: 'Available from the beginning' },
  { id: 'sentinel', name: 'THE SENTINEL', tag: 'SE', color: '#b28bff', desc: 'A fortress. +50% HP, +armor, slower. Starts with Wards.', hpMul: 1.5, speedMul: 0.9, dmgMul: 0.95, start: 'wards', startLv: 2, armorBonus: 0.12, unlock: 'Survive 3:00 in a single run' },
  { id: 'stormcaller', name: 'STORMCALLER', tag: 'ST', color: '#ffe86b', desc: 'Glass cannon. Fast, fragile, +15% damage. Starts with Arc.', hpMul: 0.7, speedMul: 1.2, dmgMul: 1.15, start: 'arc', unlock: '400 total kills across all runs' },
  { id: 'hollow', name: 'THE HOLLOW', tag: 'HO', color: '#9dffef', desc: 'Born of the void. +25% damage. Starts with Sanctuary Aura.', hpMul: 0.9, speedMul: 1, dmgMul: 1.25, start: 'aura', unlock: 'Transcend THE DEVOURER' },
  { id: 'chromatic', name: 'CHROMATIC', tag: 'CH', color: '#ffffff', desc: 'A prism given will. Every gift, amplified.', hpMul: 1.25, speedMul: 1.12, dmgMul: 1.4, start: 'pulse', startLv: 2, xpBonus: 1.3, rainbow: true, unlock: 'A hidden rhythm' },
];
const CHAR_BY_ID = {}; CHARACTERS.forEach(c => CHAR_BY_ID[c.id] = c);

const SHOP = [
  { id: 'vitality', name: 'VITAL CORE', tag: 'HP', color: '#ff5c7c', max: 8, base: 40, desc: '+12 max HP per level.' },
  { id: 'power', name: 'OVERDRIVE', tag: 'DMG', color: '#ff8a5b', max: 8, base: 45, desc: '+6% damage per level.' },
  { id: 'haste', name: 'CHRONO', tag: 'SPD', color: '#5ef2ff', max: 6, base: 55, desc: '-5% weapon cooldown per level.' },
  { id: 'reach', name: 'GRAVITON', tag: 'MAG', color: '#9dffef', max: 6, base: 40, desc: '+12% pickup radius per level.' },
  { id: 'fortune', name: 'SERENDIPITY', tag: 'LUK', color: '#ffd76a', max: 6, base: 60, desc: '+10% luck per level.' },
  { id: 'velocity', name: 'THRUSTERS', tag: 'MOV', color: '#7dff9b', max: 6, base: 45, desc: '+4% move speed per level.' },
  { id: 'resilience', name: 'CARAPACE', tag: 'ARM', color: '#6aa8ff', max: 6, base: 60, desc: '-4% damage taken per level.' },
  { id: 'focus', name: 'HEAD START', tag: 'LVL', color: '#b28bff', max: 3, base: 120, desc: '+1 starting weapon level per level.' },
  { id: 'reroll', name: 'SECOND THOUGHTS', tag: 'RRL', color: '#ff6ad5', max: 3, base: 110, desc: '+1 reroll each run.' },
  { id: 'revive', name: 'SECOND LIFE', tag: 'REV', color: '#ffffff', max: 2, base: 300, desc: '+1 revival per run. Death is optional.' },
];
const shopCost = (s, lv) => Math.round(s.base * Math.pow(lv + 1, 1.7));

const ACH = [
  { id: 'first', name: 'FIRST SPARK', desc: 'Reach level 5 in a run.', reward: 20, check: g => g.p.level >= 5 },
  { id: 'minute', name: 'ONE MINUTE MORE', desc: 'Survive for 1:00.', reward: 30, check: g => g.time >= 60 },
  { id: 'three', name: 'STUBBORN LIGHT', desc: 'Survive for 3:00.', reward: 70, unlock: 'sentinel', check: g => g.time >= 180 },
  { id: 'lvl20', name: 'RADIANT', desc: 'Reach level 20.', reward: 90, check: g => g.p.level >= 20 },
  { id: 'evolve', name: 'TRANSMUTATION', desc: 'Fuse a weapon into its evolved form.', reward: 60, check: g => g.evolved > 0 },
  { id: 'combo', name: 'DANCING WITH DEATH', desc: 'Reach a x3.0 combo.', reward: 50, check: g => g.p.comboMult >= 3 },
  { id: 'graze', name: 'TOO CLOSE', desc: 'Graze 50 foes in one run.', reward: 50, check: g => g.grazes >= 50 },
  { id: 'nova', name: 'STARBORN', desc: 'Unleash 5 NOVAs in one run.', reward: 70, check: g => g.novas >= 5 },
  { id: 'boss', name: 'HERALD SLAYER', desc: 'Defeat a boss.', reward: 110, check: g => g.bossKills >= 1 },
  { id: 'transcend', name: 'TRANSCENDED', desc: 'Defeat THE DEVOURER at 10:00.', reward: 260, unlock: 'hollow', check: g => g.transcended },
  { id: 'kills400', name: 'REAPER', desc: '400 total kills across all runs.', reward: 0, unlock: 'stormcaller', persistent: true, check: () => Save.data.totalKills >= 400 },
];

const DEFAULT_SAVE = {
  stardust: 0, bestTime: 0, bestScore: 0, bestLevel: 0, totalKills: 0, runs: 0,
  upgrades: {}, characters: ['wanderer'], selectedChar: 'wanderer', achievements: [],
  settings: { music: 0.6, sfx: 0.75, shake: true, reduced: false }, secrets: [],
};
const Save = {
  data: null,
  load() {
    let raw = null;
    try { raw = localStorage.getItem('voidbloom_save_v1'); } catch (e) { raw = null; }
    let d = {};
    if (raw) { try { d = JSON.parse(raw) || {}; } catch (e) { d = {}; } }
    this.data = Object.assign({}, DEFAULT_SAVE, d);
    this.data.upgrades = Object.assign({}, d.upgrades || {});
    this.data.settings = Object.assign({}, DEFAULT_SAVE.settings, d.settings || {});
    this.data.characters = Array.isArray(d.characters) ? d.characters.slice() : ['wanderer'];
    this.data.achievements = Array.isArray(d.achievements) ? d.achievements.slice() : [];
    this.data.secrets = Array.isArray(d.secrets) ? d.secrets.slice() : [];
    if (this.data.characters.indexOf('wanderer') < 0) this.data.characters.push('wanderer');
  },
  save() { try { localStorage.setItem('voidbloom_save_v1', JSON.stringify(this.data)); } catch (e) {} },
};

const A = {
  ac: null, master: null, musicBus: null, sfxBus: null, noise: null, started: false,
  nextNote: 0, step: 0, intensity: 0.12, timer: null, lastSfx: {},
  init() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ac = new AC(); } catch (e) { return; }
    this.master = this.ac.createGain(); this.master.gain.value = 0.85; this.master.connect(this.ac.destination);
    this.musicBus = this.ac.createGain(); this.musicBus.connect(this.master);
    this.sfxBus = this.ac.createGain(); this.sfxBus.connect(this.master);
    this.applyVolumes();
    const len = Math.floor(this.ac.sampleRate);
    this.noise = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const ch = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  },
  applyVolumes() {
    if (!this.ac) return;
    const s = Save.data.settings;
    this.musicBus.gain.setTargetAtTime(s.music * 0.5, this.ac.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx * 0.9, this.ac.currentTime, 0.05);
  },
  resume() {
    this.init();
    if (!this.ac) return;
    if (this.ac.state === 'suspended') this.ac.resume();
    if (!this.started) {
      this.started = true;
      this.nextNote = this.ac.currentTime + 0.12;
      this.step = 0;
      this.timer = setInterval(() => this.schedule(), 35);
    }
  },
  mf(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  tone(freq, when, dur, type, vol, bus, glideTo) {
    if (!this.ac) return;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, when);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), when + Math.min(0.03, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(when); o.stop(when + dur + 0.04);
  },
  hiss(when, dur, vol, hp) {
    if (!this.ac || !this.noise) return;
    const s = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = hp || 3000;
    g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(when); s.stop(when + dur + 0.02);
  },
  schedule() {
    if (!this.ac) return;
    const t = this.ac.currentTime;
    const bpm = 96 + this.intensity * 46;
    const stepDur = 60 / bpm / 4;
    const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    const roots = [45, 48, 43, 50, 41, 47];
    const root = roots[(Math.floor((G ? G.time : 0) / 75)) % roots.length];
    while (this.nextNote < t + 0.18) {
      if (this.nextNote < t - 1) this.nextNote = t + 0.02;
      const w = this.nextNote, s = this.step % 32, I = this.intensity;
      if (s % 4 === 0) this.tone(this.mf(root - 12), w, 0.34, 'triangle', 0.22 + I * 0.05, this.musicBus);
      if (s % 16 === 0) [0, 7, 15].forEach(iv => this.tone(this.mf(root + iv), w, 1.7, 'sine', 0.055, this.musicBus));
      if (I > 0.22 && s % 2 === 0) {
        const seq = [0, 2, 4, 3, 5, 4, 2, 1];
        const n = root + 12 + scale[seq[(s / 2) % seq.length] % scale.length];
        this.tone(this.mf(n), w, 0.16, 'square', 0.035 + I * 0.02, this.musicBus);
      }
      if (I > 0.42 && s % 4 === 0) this.tone(this.mf(root - 24), w, 0.2, 'sine', 0.3, this.musicBus, 45);
      if (I > 0.5 && s % 2 === 1 && this.noise) {
        const s2 = this.ac.createBufferSource(), f = this.ac.createBiquadFilter(), g = this.ac.createGain();
        s2.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
        g.gain.setValueAtTime(0.02 + I * 0.02, w); g.gain.exponentialRampToValueAtTime(0.0001, w + 0.05);
        s2.connect(f); f.connect(g); g.connect(this.musicBus); s2.start(w); s2.stop(w + 0.07);
      }
      if (I > 0.78 && s % 8 === 6) this.tone(this.mf(root + 24 + scale[(this.step / 8) % scale.length]), w, 0.4, 'sawtooth', 0.03, this.musicBus);
      this.nextNote += stepDur; this.step++;
    }
  },
  throttled(name, gap) {
    const t = now();
    if (this.lastSfx[name] && t - this.lastSfx[name] < gap) return false;
    this.lastSfx[name] = t; return true;
  },
  sfx(name) {
    if (!this.ac) return;
    const w = this.ac.currentTime;
    switch (name) {
      case 'shoot': if (!this.throttled('shoot', 0.055)) return; this.tone(rand(720, 900), w, 0.06, 'triangle', 0.05, this.sfxBus, 400); break;
      case 'hit': if (!this.throttled('hit', 0.045)) return; this.hiss(w, 0.05, 0.05, 2000); break;
      case 'kill': if (!this.throttled('kill', 0.06)) return; this.tone(rand(300, 380), w, 0.1, 'sine', 0.06, this.sfxBus, 140); break;
      case 'pickup': if (!this.throttled('pickup', 0.05)) return; this.tone(rand(900, 1150), w, 0.09, 'sine', 0.05, this.sfxBus, 1500); break;
      case 'hurt': this.tone(150, w, 0.3, 'sawtooth', 0.14, this.sfxBus, 55); this.hiss(w, 0.18, 0.12, 500); break;
      case 'levelup': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(this.mf(64 + n), w + i * 0.07, 0.3, 'triangle', 0.12, this.sfxBus)); break;
      case 'nova': this.tone(220, w, 0.9, 'sawtooth', 0.2, this.sfxBus, 60); this.tone(880, w, 0.8, 'sine', 0.12, this.sfxBus, 120); this.hiss(w, 0.7, 0.18, 800); break;
      case 'boss': [0, 3, 7].forEach(n => this.tone(this.mf(40 + n), w, 1.6, 'sawtooth', 0.1, this.sfxBus)); break;
      case 'dash': this.hiss(w, 0.14, 0.07, 1200); break;
      case 'button': this.tone(660, w, 0.05, 'square', 0.05, this.sfxBus); break;
      case 'ach': [0, 7, 12, 19].forEach((n, i) => this.tone(this.mf(72 + n), w + i * 0.06, 0.4, 'triangle', 0.1, this.sfxBus)); break;
      case 'gameover': [0, -3, -7, -12].forEach((n, i) => this.tone(this.mf(60 + n), w + i * 0.16, 0.5, 'sine', 0.12, this.sfxBus)); break;
      case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.tone(this.mf(60 + n), w + i * 0.11, 0.6, 'triangle', 0.12, this.sfxBus)); break;
    }
  },
};

const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const GLOWCACHE = {};
function glowSprite(color) {
  if (GLOWCACHE[color]) return GLOWCACHE[color];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rgb = hexRgb(color), r = rgb[0], gg = rgb[1], b = rgb[2];
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(' + r + ',' + gg + ',' + b + ',1)');
  grd.addColorStop(0.22, 'rgba(' + r + ',' + gg + ',' + b + ',0.55)');
  grd.addColorStop(0.55, 'rgba(' + r + ',' + gg + ',' + b + ',0.14)');
  grd.addColorStop(1, 'rgba(' + r + ',' + gg + ',' + b + ',0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  GLOWCACHE[color] = c; return c;
}
