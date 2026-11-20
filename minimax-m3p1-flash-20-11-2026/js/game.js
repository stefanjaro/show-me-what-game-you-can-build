// EMBERDEEP — entities, gameplay, rendering, controller.

import { Rng, Input, clamp, lerp, TAU, fmt, fmtTime, dist } from './util.js';
import { World, T, TILES, TW, TH, TILE, VW, VH, VIEW_W, VIEW_H, WW, WH, tileSprites, BIOMES, SOLID, LIQUID, SIPHON, NEUTRAL, ATTEN } from './tiles.js';
import { Particles, FloatingText, ScreenFx, AudioEngine } from './fx.js';

const FORMS = [
  { name: 'EMBER', color: [255, 148, 58], light: [255, 214, 160], li: 244, key: 0 },
  { name: 'TIDE', color: [78, 172, 255], light: [186, 224, 255], li: 236, key: 1 },
  { name: 'SPARK', color: [255, 232, 96], light: [255, 255, 214], li: 250, key: 2 },
  { name: 'BLOOM', color: [116, 236, 142], light: [206, 255, 216], li: 224, key: 3 }
];
const FORM_NAMES = ['EMBER', 'TIDE', 'SPARK', 'BLOOM'];
const METER_NAMES = ['EMBER', 'TIDE', 'SPARK', 'BLOOM'];
const METER_COLORS = ['#ff9440', '#4eacff', '#ffe860', '#74ec8e'];
const ABIL = [
  { name: 'IGNITE', key: 'LMB', cost: 9, cd: 0.24, el: 0 },
  { name: 'QUENCH', key: 'RMB', cost: 11, cd: 0.32, el: 1 },
  { name: 'ARC', key: 'E', cost: 15, cd: 0.58, el: 2 },
  { name: 'SEED', key: 'Q', cost: 9, cd: 0.66, el: 3 }
];

const ENEMY_DEFS = {
  crawler: { hp: 26, r: 3.4, speed: 27, dmg: 11, score: 12, el: 3, fire: 1 },
  sporeling: { hp: 9, r: 2.2, speed: 40, dmg: 6, score: 6, el: 3, fire: 1 },
  drifter: { hp: 17, r: 3.0, speed: 24, dmg: 9, score: 16, el: 1, fire: 2 },
  brute: { hp: 95, r: 7.0, speed: 19, dmg: 21, score: 40, el: 0, fire: 0.35 },
  wraith: { hp: 30, r: 4.2, speed: 36, dmg: 13, score: 34, el: 2, fire: 1 },
  sporepod: { hp: 22, r: 4.6, speed: 5, dmg: 8, score: 22, el: 3, fire: 2 },
  warden: { hp: 340, r: 15, speed: 21, dmg: 26, score: 320, el: 0, fire: 0.2 }
};

const UPGRADES = [
  { id: 'vigor', name: 'VIGOR', desc: '+30 maximum ember-health', cost: 60, max: 8, icon: '❤' },
  { id: 'reservoir', name: 'RESERVOIR', desc: '+25 capacity for every element', cost: 70, max: 8, icon: '◈' },
  { id: 'dash', name: 'DASH CHARGE', desc: '+1 dash charge (and faster recharge)', cost: 150, max: 3, icon: '»' },
  { id: 'kindle', name: 'KINDLE', desc: '+35% element regeneration', cost: 120, max: 3, icon: '✦' },
  { id: 'siphon', name: 'SIPHON RADIUS', desc: '+25% siphon reach', cost: 110, max: 3, icon: '◎' },
  { id: 'luck', name: 'CINDER LUCK', desc: '+30% cinders earned', cost: 100, max: 3, icon: '✧' },
  { id: 'startlight', name: 'EMBERLIGHT', desc: 'Begin every run with a charged element', cost: 240, max: 1, icon: '☀' },
  { id: 'afterlife', name: 'AFTERLIFE', desc: 'Cheat death once per run', cost: 500, max: 1, icon: '↺' }
];

const MUTATIONS = [
  { id: 'hungry', name: 'HUNGRY FLAME', desc: 'Fire spreads twice as fast. Ember burns 60% hotter.', icon: '🔥', apply: (g) => { g.mut.fireSpread = 2; g.mut.emberGain = 1.6; } },
  { id: 'glass', name: 'GLASS BONES', desc: '+45 maximum health, but you move 18% slower.', icon: '◇', apply: (g) => { g.mut.maxHp += 45; g.mut.speed = 0.82; } },
  { id: 'salt', name: 'SALT HEART', desc: 'Your spray freezes what it touches. Tide burns 45% brighter.', icon: '❄', apply: (g) => { g.mut.freeze = true; g.mut.tideGain = 1.45; } },
  { id: 'lungs', name: 'DEEP LUNGS', desc: '+60% siphon reach, +45% element regeneration.', icon: '◎', apply: (g) => { g.mut.siphon = 1.6; g.mut.regen = 1.45; } },
  { id: 'tether', name: 'IRON TETHER', desc: '+1 dash charge. Dash no longer grants invulnerability.', icon: '⛓', apply: (g) => { g.mut.dashCharges += 1; g.mut.iFrames = 0; } },
  { id: 'ashen', name: 'ASHEN TRAIL', desc: 'Your dash sets the world alight. +25% dash speed.', icon: '≈', apply: (g) => { g.mut.burnTrail = true; g.mut.dashSpeed = 1.25; } },
  { id: 'bloom', name: 'FUNGAL BLOOM', desc: 'Spores double in spread. Spores mend you. Bloom burns 65% brighter.', icon: '❀', apply: (g) => { g.mut.growth = 2; g.mut.sporeHeal = 2.2; g.mut.bloomGain = 1.65; } },
  { id: 'sight', name: 'STORM SIGHT', desc: 'Your light reaches far further and reveals the dark. Spark burns 45% brighter.', icon: '◎', apply: (g) => { g.mut.light = 1.8; g.mut.reveal = true; g.mut.sparkGain = 1.45; } },
  { id: 'volatile', name: 'VOLATILE HEART', desc: 'Slain foes detonate, igniting their neighbours. +30% score.', icon: '✷', apply: (g) => { g.mut.volatile = true; g.mut.score = 1.3; } },
  { id: 'second', name: 'SECOND EMBER', desc: 'On death, you return once at 40% health.', icon: '☙', apply: (g) => { g.mut.secondChance = (g.mut.secondChance || 0) + 1; } },
  { id: 'radiant', name: 'RADIANT', desc: 'Your presence scorches nearby foes. -10% move speed.', icon: '☀', apply: (g) => { g.mut.radiant = true; g.mut.speed *= 0.9; } },
  { id: 'void', name: 'VOID HUNGER', desc: 'Your siphon devours twice as fast. Every element burns 50% brighter.', icon: '◍', apply: (g) => { g.mut.siphonSpeed = 2; g.mut.allGain = 1.5; } }
];

const SAVE_KEY = 'emberdeep.save.v1';

export class Game {
  constructor(dom) {
    this.dom = dom;
    this.world = new World((Math.random() * 4294967296) >>> 0);
    this.particles = new Particles(2800);
    this.text = new FloatingText();
    this.fx = new ScreenFx();
    this.audio = new AudioEngine();
    this.rng = new Rng();
    this.sprites = tileSprites();

    this.state = 'title';
    this.time = 0;
    this.acc = 0;
    this.last = performance.now();
    this.frame = 0;
    this.showDebug = false;

    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.save = this.loadSave();
    this.run = null;
    this.cam = { x: 0, y: 0, tx: 0, ty: 0 };

    this.setupCanvases();
    this.buildStaticLight();
    this.bindUI();
    Input.init();
    this.enterTitle();
  }

  // ------------------------------------------------------------------ setup
  setupCanvases() {
    this.cWorld = this.dom.cWorld.getContext('2d');
    this.cLight = this.dom.cLight.getContext('2d');
    this.worldImg = this.cWorld.createImageData(VW, VH);
    this.worldBuf = new Uint32Array(this.worldImg.data.buffer);
    this.lightSmall = document.createElement('canvas');
    this.lightSmall.width = VIEW_W; this.lightSmall.height = VIEW_H;
    this.lightCtx = this.lightSmall.getContext('2d');
    this.lightImg = this.lightCtx.createImageData(VIEW_W, VIEW_H);
    this.lightBuf = new Uint32Array(this.lightImg.data.buffer);
    this.glowCache = new Map();
  }

  buildStaticLight() {
    // ambient light canvas for title screen etc.
    this.vignette = document.createElement('canvas');
    this.vignette.width = VW; this.vignette.height = VH;
    const v = this.vignette.getContext('2d');
    const g = v.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VH * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(4,2,10,0.25)');
    g.addColorStop(1, 'rgba(2,1,6,0.85)');
    v.fillStyle = g; v.fillRect(0, 0, VW, VH);
  }

  glowSprite(r, g, b) {
    const key = r + ',' + g + ',' + b;
    let c = this.glowCache.get(key);
    if (c) return c;
    const size = 64;
    c = document.createElement('canvas'); c.width = size; c.height = size;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(0.28, `rgba(${r},${g},${b},0.55)`);
    grd.addColorStop(0.62, `rgba(${r},${g},${b},0.14)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd; x.fillRect(0, 0, size, size);
    this.glowCache.set(key, c);
    return c;
  }

  // ------------------------------------------------------------------ save
  loadSave() {
    const def = { cinders: 0, up: {}, stats: { deepest: 0, runs: 0, best: 0, kills: 0 } };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return def;
      const d = JSON.parse(raw);
      return { ...def, ...d, stats: { ...def.stats, ...(d.stats || {}) }, up: { ...(d.up || {}) } };
    } catch (e) { return def; }
  }
  save_() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* ignore */ }
  }
  upLv(id) { return this.save.up[id] || 0; }
  cinderGain(n) { return Math.floor(n * (1 + this.upLv('luck') * 0.3) * (this.run ? this.run.mut.score : 1)); }

  // ------------------------------------------------------------------ flow
  enterTitle() {
    this.state = 'title';
    this.enemies.length = 0; this.projectiles.length = 0; this.player = null;
    this.world = new World((Math.random() * 4294967296) >>> 0);
    this.world.generate(1);
    this.titleT = 0;
    this.dom.show('title');
    this.dom.updateStats(this.save);
    this.audio.setMusic(false);
  }

  startRun() {
    this.audio.init(); this.audio.resume();
    this.run = {
      stratum: 1, score: 0, kills: 0, tiles: 0, time: 0, shards: 0, combo: 0, comboT: 0,
      mut: {
        fireSpread: 1, emberGain: 1, tideGain: 1, sparkGain: 1, bloomGain: 1, allGain: 1,
        maxHp: 0, speed: 1, regen: 1, siphon: 1, dashCharges: 0, iFrames: 1, dashSpeed: 1,
        burnTrail: false, growth: 1, sporeHeal: 1, light: 1, reveal: false, volatile: false,
        score: 1, secondChance: 0, radiant: false, eatStone: false, freeze: false,
        siphonSpeed: 1
      },
      picked: [], reviveUsed: false
    };
    const p = this.player = this.makePlayer();
    this.loadStratum(1, true);
    this.dom.show('hud');
    this.state = 'play';
    this.audio.setMusic(true);
    this.announce('STRATUM I', this.world.biome.name + ' \u2014 ' + this.world.biome.sub);
    this.audio.sfx('heart');
  }

  makePlayer() {
    const hp = 100 + this.upLv('vigor') * 30 + (this.run ? this.run.mut.maxHp : 0);
    const p = {
      x: 0, y: 0, vx: 0, vy: 0, hw: 2.6, hh: 3.4,
      hp, maxHp: hp, dead: false,
      meters: [45, 45, 45, 45], cap: 100 + this.upLv('reservoir') * 25,
      form: 0, dash: 2, dashMax: 2, dashTimer: 0, dashCd: 0, dashing: 0, dashDir: [1, 0],
      iframes: 0, hurtCd: 0, aim: 0, cd: [0, 0, 0, 0],
      siphonT: 0, sporeHealT: 0, anim: 0, trail: [], burnT: 0, wetT: 0, frozen: 0,
      glowPulse: 0, spawnGrace: 1.2, magnetT: 0
    };
    if (this.upLv('startlight') > 0) p.meters[this.rng.int(0, 3)] = p.cap;
    return p;
  }

  loadStratum(n, first) {
    const w = this.world = new World((Math.random() * 4294967296) >>> 0);
    this.run.stratum = n;
    const b = w.generate(n);
    w.mut.fireSpread = this.run.mut.fireSpread;
    w.mut.growth = this.run.mut.growth;
    this.enemies.length = 0; this.projectiles.length = 0;
    const p = this.player;
    p.x = w.spawn.x * TILE + TILE / 2;
    p.y = w.spawn.y * TILE + TILE / 2;
    p.vx = p.vy = 0;
    p.iframes = 1.0;
    p.spawnGrace = 1.6;
    p.hp = Math.min(p.maxHp, p.hp + (first ? 0 : p.maxHp * 0.35));
    p.meters = p.meters.map(m => Math.min(m, p.cap));
    p.dashMax = 2 + this.upLv('dash') + this.run.mut.dashCharges;
    p.dash = p.dashMax;
    this.cam.tx = clamp(Math.floor(p.x / TILE) - VIEW_W / 2, 0, TW - VIEW_W);
    this.cam.ty = clamp(Math.floor(p.y / TILE) - VIEW_H / 2, 0, TH - VIEW_H);
    this.cam.x = this.cam.tx * TILE; this.cam.y = this.cam.ty * TILE;

    // populate enemies
    const list = b.enemies;
    const count = Math.min(80, 30 + n * 6);
    for (let i = 0; i < count; i++) {
      const type = this.rng.pick(list);
      let x, y, tries = 0;
      do {
        x = this.rng.int(4, TW - 5); y = this.rng.int(4, TH - 5); tries++;
      } while (tries < 60 && (w.at(x, y) !== T.AIR || Math.hypot(x - w.spawn.x, y - w.spawn.y) < 22));
      if (tries >= 60) continue;
      this.spawnEnemy(type, x * TILE + TILE / 2, y * TILE + TILE / 2);
    }
    if (n % 3 === 0) {
      const hx = w.heart.x, hy = w.heart.y;
      this.spawnEnemy('warden', hx * TILE + TILE / 2, (hy - 4) * TILE);
    }
    this.audio.setRoot(b.music);
    this.boss = this.enemies.find(e => e.type === 'warden') || null;
  }

  spawnEnemy(type, x, y) {
    const d = ENEMY_DEFS[type];
    const e = {
      type, x, y, vx: 0, vy: 0, hp: d.hp, maxHp: d.hp, r: d.r,
      speed: d.speed, dmg: d.dmg, score: d.score, el: d.el, fireRes: d.fire,
      frozen: 0, wet: 0, burn: 0, burnT: 0, hurt: 0, anim: this.rng.range(0, 10),
      slow: 0, phase: 0, shootT: 0, summonT: 0, dead: false, bob: this.rng.range(0, TAU),
      aggro: false, charge: 0, chargeT: 0, drainT: 0, seed: this.rng.int(0, 99999)
    };
    this.enemies.push(e);
    return e;
  }

  announce(a, b) {
    this.dom.announce(a, b);
  }

  // ------------------------------------------------------------------ input
  bindUI() {
    const d = this.dom;
    d.btnStart.addEventListener('click', () => { this.audio.init(); this.audio.resume(); this.audio.sfx('ui'); this.startRun(); });
    d.btnShop.addEventListener('click', () => { this.audio.init(); this.audio.sfx('ui'); this.openShop('title'); });
    d.btnHelp.addEventListener('click', () => { this.audio.sfx('ui'); d.show('help'); });
    d.btnHelpBack.addEventListener('click', () => { this.audio.sfx('ui'); this.closeOverlay(); });
    d.btnResume.addEventListener('click', () => { this.audio.sfx('ui'); this.resume(); });
    d.btnPauseShop.addEventListener('click', () => { this.audio.sfx('ui'); this.openShop('pause'); });
    d.btnAbandon.addEventListener('click', () => { this.audio.sfx('ui'); this.toTitle(); });
    d.btnDeathShop.addEventListener('click', () => { this.audio.sfx('ui'); this.openShop('death'); });
    d.btnAgain.addEventListener('click', () => { this.audio.sfx('ui'); this.startRun(); });
    d.btnSurface.addEventListener('click', () => { this.audio.sfx('ui'); this.toTitle(); });
    d.btnShopBack.addEventListener('click', () => { this.audio.sfx('ui'); this.closeOverlay(); });
    d.btnPause.addEventListener('click', () => { this.audio.sfx('ui'); this.pause(); });
    d.shopRows.innerHTML = '';
    for (const u of UPGRADES) {
      const row = document.createElement('div');
      row.className = 'shopRow';
      row.innerHTML = `<div class="shopIcon">${u.icon}</div>
        <div class="shopInfo"><div class="shopName">${u.name}<span class="shopLv"></span></div>
        <div class="shopDesc">${u.desc}</div></div>
        <button class="buyBtn"></button>`;
      row.querySelector('.buyBtn').addEventListener('click', () => this.buy(u));
      d.shopRows.appendChild(row);
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.state === 'play') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (this.state === 'title' && (e.key === 'Enter' || e.key === ' ')) { this.audio.init(); this.audio.resume(); this.startRun(); }
      if (this.state === 'dead' && e.key === 'Enter') this.startRun();
    });
    this.dom.stage.addEventListener('mousemove', (e) => {
      const r = this.dom.stage.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width, my = (e.clientY - r.top) / r.height;
      this.mouseWorld = { x: mx * VW, y: my * VH };
    });
    this.dom.stage.addEventListener('mousedown', (e) => {
      if (e.button === 0) Input.mouse.down = true;
      if (e.button === 2) Input.mouse.rdown = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) Input.mouse.down = false;
      if (e.button === 2) Input.mouse.rdown = false;
    });
    this.dom.stage.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  buy(u) {
    const lv = this.upLv(u.id);
    if (lv >= u.max) { this.audio.sfx('deny'); return; }
    const cost = Math.floor(u.cost * (1 + lv * 0.6));
    if (this.save.cinders < cost) { this.audio.sfx('deny'); this.dom.shopFlash('Not enough cinders'); return; }
    this.save.cinders -= cost;
    this.save.up[u.id] = lv + 1;
    this.save_();
    this.audio.sfx('levelup');
    this.refreshShop();
    this.dom.cinderPulse();
  }

  refreshShop() {
    const rows = this.dom.shopRows.querySelectorAll('.shopRow');
    UPGRADES.forEach((u, i) => {
      const row = rows[i]; if (!row) return;
      const lv = this.upLv(u.id);
      const cost = Math.floor(u.cost * (1 + lv * 0.6));
      row.querySelector('.shopLv').textContent = lv ? `  ${lv}/${u.max}` : '';
      const btn = row.querySelector('.buyBtn');
      if (lv >= u.max) { btn.textContent = 'MAX'; btn.disabled = true; btn.classList.add('maxed'); }
      else { btn.textContent = '◆ ' + cost; btn.disabled = false; btn.classList.remove('maxed'); btn.classList.toggle('poor', this.save.cinders < cost); }
    });
    this.dom.cinders.textContent = fmt(this.save.cinders);
  }

  openShop(from) {
    this.shopFrom = from;
    this.refreshShop();
    this.dom.show('shop');
  }
  closeOverlay() {
    if (this.shopFrom === 'pause') this.dom.show('pause');
    else if (this.shopFrom === 'death') this.dom.show('death');
    else this.dom.show('title');
  }
  pause() { if (this.state !== 'play') return; this.state = 'paused'; this.dom.show('pause'); }
  resume() { if (this.state !== 'paused') return; this.state = 'play'; this.dom.show('hud'); }
  toTitle() { this.state = 'title'; this.run = null; this.player = null; this.enterTitle(); }

  // ------------------------------------------------------------------ loop
  loop(now) {
    const dtReal = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.dtReal = dtReal;
    this.frame++;
    this.fx.update(dtReal);
    const dt = dtReal * this.fx.timeScale;

    if (this.state === 'play') {
      this.update(dt);
    } else if (this.state === 'title') {
      this.updateTitle(dt);
    }
    this.render();
    Input.endFrame();
    requestAnimationFrame(this.loop.bind(this));
  }

  updateTitle(dt) {
    this.titleT += dt;
    // a wandering lantern lights the caves behind the title
    const w = this.world;
    w.sources.length = 0;
    const lx = w.spawn.x + Math.cos(this.titleT * 0.16) * 46 + Math.sin(this.titleT * 0.07) * 18;
    const ly = w.spawn.y + Math.sin(this.titleT * 0.13) * 30;
    this.titleLight = { x: lx, y: ly };
    w.addSource(Math.round(lx), Math.round(ly), 236, 255, 168, 86);
    this.updateCamera(dt);
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 4) { this.world.step(); this.acc -= 1 / 60; steps++; }
    if (this.rng.chance(0.35)) {
      this.particles.spawn({
        x: this.rng.range(0, VW), y: VH + 4, vx: this.rng.range(-6, 6), vy: this.rng.range(-22, -8),
        life: this.rng.range(3, 7), size: this.rng.range(0.8, 2.0), r: 255, g: this.rng.range(120, 200), b: 60,
        add: true, drag: 0.995, glow: true
      });
    }
    this.particles.update(dt, this.world);
    this.text.update(dt);
  }

  update(dt) {
    const p = this.player;
    this.run.time += dt;
    this.run.comboT = Math.max(0, (this.run.comboT || 0) - dt);
    if (this.run.comboT <= 0) this.run.combo = 0;
    this.world.sources.length = 0;
    this.updateCamera(dt);

    if (p) {
      this.updatePlayer(dt, p);
      // the deeper you go, the less the world gives back
      const depthDim = 1 / (1 + Math.max(0, this.run.stratum - 1) * 0.085);
      this.world.sources.push({
        x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE),
        i: Math.round(FORMS[p.form].li * this.run.mut.light * depthDim * (1 + this.rng.range(-0.03, 0.03))),
        r: FORMS[p.form].light[0], g: FORMS[p.form].light[1], b: FORMS[p.form].light[2]
      });
    }

    if (this.state === 'play' && this.player && this.world.heart.alive) {
      // the Heart burns like a beacon
      this.world.addSource(this.world.heart.x, this.world.heart.y, 250, 120, 222, 255);
    }

    this.updateEnemies(dt);
    this.updateProjectiles(dt);

    // world sim at fixed 60Hz
    this.acc += dt;
    let steps = 0;
    while (this.acc >= 1 / 60 && steps < 5) { this.world.step(); this.acc -= 1 / 60; steps++; }

    // collisions between enemies & elemental tiles
    this.terrainDamage(dt);

    // shards
    if (this.world.shards) {
      for (const s of this.world.shards) {
        if (s.taken) continue;
        const sx = s.x * TILE + TILE / 2, sy = s.y * TILE + TILE / 2;
        if (p && dist(p.x, p.y, sx, sy) < 10) {
          s.taken = true;
          this.world.set(s.x, s.y, T.AIR);
          this.run.shards++;
          this.run.score += 40;
          this.audio.sfx('shard');
          this.burst(sx, sy, 12, 130, 255, 226, 255);
          this.text.add(sx, sy - 6, '+40', '#9fe8ff', 7);
        }
      }
    }

    // heart
    if (p && this.world.heart.alive) {
      const hx = this.world.heart.x * TILE + TILE / 2, hy = this.world.heart.y * TILE + TILE / 2;
      if (dist(p.x, p.y, hx, hy) < 13) this.descend();
    }

    this.particles.update(dt, this.world);
    this.text.update(dt);

    if (this.frame % 3 === 0) this.dom.updateHUD(this);
    if (this.frame % 6 === 0) this.dom.drawMinimap(this);

    const intensity = clamp(0.2 + this.enemies.length / 22 + (1 - p.hp / p.maxHp) * 0.5, 0, 1);
    this.audio.update(this.dtReal || dt, this.state === 'play' ? intensity : 0);
  }

  // ------------------------------------------------------------------ player
  updatePlayer(dt, p) {
    p.anim += dt;
    p.iframes = Math.max(0, p.iframes - dt);
    p.hurtCd = Math.max(0, p.hurtCd - dt);
    p.spawnGrace = Math.max(0, (p.spawnGrace || 0) - dt);
    p.frozen = Math.max(0, p.frozen - dt);
    p.wetT = Math.max(0, p.wetT - dt);
    p.burnT = Math.max(0, p.burnT - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    for (let i = 0; i < 4; i++) p.cd[i] = Math.max(0, p.cd[i] - dt);
    if (p.dash < p.dashMax && p.dashCd <= 0) { p.dash++; p.dashCd = this.dashRecharge(p); }

    // aim
    const mw = this.mouseWorld || { x: p.x, y: p.y - 20 };
    p.aim = Math.atan2(mw.y - p.y, mw.x - p.x);

    // movement input
    let ix = 0, iy = 0;
    if (Input.down('a', 'ArrowLeft')) ix -= 1;
    if (Input.down('d', 'ArrowRight')) ix += 1;
    if (Input.down('w', 'ArrowUp')) iy -= 1;
    if (Input.down('s', 'ArrowDown')) iy += 1;
    const il = Math.hypot(ix, iy) || 1;
    ix /= il; iy /= il;

    // form
    const form = this.dominantMeter(p);
    if (form !== p.form) {
      p.form = form;
      this.audio.sfx('levelup');
      this.burst(p.x, p.y, 18, 90, FORMS[form].color[0], FORMS[form].color[1], FORMS[form].color[2]);
      this.text.add(p.x, p.y - 10, FORM_NAMES[form] + ' FORM', '#fff', 8);
    }

    const speed = 88 * this.run.mut.speed * (p.form === 2 ? 1.14 : 1) * (p.form === 3 ? 0.95 : 1);
    const inWater = this.waterAt(p.x, p.y);
    if (p.dashing > 0) {
      p.dashing -= dt;
      p.vx = p.dashDir[0] * 250 * this.run.mut.dashSpeed;
      p.vy = p.dashDir[1] * 250 * this.run.mut.dashSpeed;
      if (this.run.mut.burnTrail && this.rng.chance(0.85)) this.igniteAt(p.x, p.y, 1, false);
      p.trail.push({ x: p.x, y: p.y, t: 0.32 });
    } else {
      const accel = 780 * (inWater ? 0.55 : 1);
      p.vx += ix * accel * dt;
      p.vy += iy * accel * dt;
      const drag = Math.pow(inWater ? 0.86 : 0.80, dt * 60);
      p.vx *= drag; p.vy *= drag;
      const maxs = speed * (inWater ? 0.72 : 1);
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > maxs) { p.vx = p.vx / sp * maxs; p.vy = p.vy / sp * maxs; }
      if (ix || iy) p.dashDir = [ix, iy];
    }
    // gravity / buoyancy
    if (inWater) {
      p.vy += (p.form === 1 ? -140 : -40) * dt;
      p.vy = clamp(p.vy, -70, 70);
    } else {
      p.vy += 420 * dt;
      if (p.vy > 300) p.vy = 300;
    }

    this.moveEntity(p, dt);

    // element state interactions
    const tt = this.world.tileAtPx(p.x, p.y);
    if (tt === T.LAVA) { this.damagePlayer(26 * dt, 'lava'); p.burnT = 0.4; }
    if (tt === T.ACID) this.damagePlayer(18 * dt, 'acid');
    if (tt === T.FIRE) { this.damagePlayer(12 * dt, 'fire'); }
    if (tt === T.WATER) p.wetT = 1.2;
    if (tt === T.ICE) { p.vx *= 0.9; p.vy *= 0.9; }
    if (p.burnT > 0 && p.form !== 0) this.damagePlayer(9 * dt, 'fire');
    if (p.wetT > 0 && p.form === 0) this.damagePlayer(14 * dt, 'wet');
    if (p.form === 1 && tt === T.WATER) p.wetT = 0;

    // the body you wear reshapes the world around you
    this.bodyAura(p, dt);

    // spores mend you
    if (this.run.mut.sporeHeal > 1 || p.form === 3) {
      if (this.nearTile(p.x, p.y, T.SPORE, 14)) {
        p.sporeHealT += dt;
        if (p.sporeHealT > 0.9) {
          p.sporeHealT = 0;
          const amt = (p.form === 3 ? 3 : 2) * this.run.mut.sporeHeal;
          this.healPlayer(amt);
        }
      }
    }
    // radiant mutation scorches nearby foes
    if (this.run.mut.radiant) {
      for (const e of this.enemies) {
        if (dist(e.x, e.y, p.x, p.y) < 26) this.damageEnemy(e, 9 * dt, 'fire');
      }
    }

    // meters regen
    const regen = 8 * this.run.mut.regen;
    for (let i = 0; i < 4; i++) {
      if (p.meters[i] < p.cap) p.meters[i] = Math.min(p.cap, p.meters[i] + regen * dt);
    }

    // dash
    if (Input.hit(' ') && p.dash > 0 && p.dashing <= 0) {
      p.dash--; p.dashing = 0.16; p.iframes = Math.max(p.iframes, 0.24 * this.run.mut.iFrames);
      p.dashCd = this.dashRecharge(p);
      this.audio.sfx('dash');
      this.burst(p.x, p.y, 10, 70, FORMS[p.form].color[0], FORMS[p.form].color[1], FORMS[p.form].color[2]);
    }

    // abilities
    if ((Input.mouse.down || Input.down('j')) && p.cd[0] <= 0) this.castIgnite(p);
    if ((Input.mouse.rdown || Input.down('k')) && p.cd[1] <= 0) this.castQuench(p);
    if (Input.hit('e') && p.cd[2] <= 0) this.castArc(p);
    if (Input.hit('q') && p.cd[3] <= 0) this.castSeed(p);

    // siphon
    if (Input.down('f') && p.meters.some(m => m < p.cap)) this.siphon(p, dt);
    else p.siphonT = 0;

    // trail decay
    for (let i = p.trail.length - 1; i >= 0; i--) {
      p.trail[i].t -= dt;
      if (p.trail[i].t <= 0) p.trail.splice(i, 1);
    }
  }

  // Your body IS the element: it reacts with whatever it touches.
  bodyAura(p, dt) {
    p.bodyT = (p.bodyT || 0) - dt;
    if (p.bodyT > 0) return;
    p.bodyT = 0.13;
    const w = this.world;
    const px = Math.floor(p.x / TILE), py = Math.floor(p.y / TILE);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const tx = px + ox, ty = py + oy;
        const t = w.at(tx, ty);
        if (t === T.AIR) {
          if (p.form === 3 && w.at(tx, ty + 1) === T.DIRT && this.rng.chance(0.22)) {
            w.set(tx, ty, T.SPORE);
          }
          continue;
        }
        switch (p.form) {
          case 0: // EMBER — burns what it touches
            if ((FLAMMABLE_TILE(t) || t === T.OIL) && this.rng.chance(0.3)) {
              w.set(tx, ty, T.FIRE); w.life[ty * TW + tx] = 40 + this.rng.int(50);
            }
            break;
          case 1: // TIDE — smothers fire, cools lava
            if (t === T.FIRE) { w.set(tx, ty, T.STEAM); w.life[ty * TW + tx] = 40; }
            else if (t === T.LAVA && this.rng.chance(0.16)) { w.set(tx, ty, T.OBSIDIAN); }
            break;
          case 2: // SPARK — charges what conducts
            if ((t === T.METAL || t === T.WATER) && this.rng.chance(0.5)) w.charge[ty * TW + tx] = 22;
            break;
          case 3: // BLOOM — seeds the earth
            if (t === T.DIRT && this.rng.chance(0.18)) w.set(tx, ty, T.FOLIAGE);
            break;
        }
      }
    }
  }

  dashRecharge(p) {
    const formMul = p.form === 2 ? 0.5 : 1;
    return (1.7 * formMul) / (1 + this.upLv('dash') * 0.22);
  }

  dominantMeter(p) {
    let best = 0;
    for (let i = 1; i < 4; i++) if (p.meters[i] > p.meters[best]) best = i;
    return best;
  }

  castIgnite(p) {
    if (p.meters[0] < ABIL[0].cost) { this.deny(p, 0); return; }
    p.meters[0] -= ABIL[0].cost; p.cd[0] = ABIL[0].cd;
    this.audio.sfx('ignite');
    const a = p.aim;
    this.projectiles.push({
      kind: 'fire', x: p.x + Math.cos(a) * 6, y: p.y + Math.sin(a) * 6,
      vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 1.1, r: 2.4, dmg: 14, seed: this.rng.int(0, 1e6)
    });
    this.burst(p.x + Math.cos(a) * 6, p.y + Math.sin(a) * 6, 6, 60, 255, 170, 60);
  }
  castQuench(p) {
    if (p.meters[1] < ABIL[1].cost) { this.deny(p, 1); return; }
    p.meters[1] -= ABIL[1].cost; p.cd[1] = ABIL[1].cd;
    this.audio.sfx('quench');
    const a = p.aim;
    for (let i = -2; i <= 2; i++) {
      const aa = a + i * 0.22;
      this.projectiles.push({
        kind: 'water', x: p.x + Math.cos(aa) * 6, y: p.y + Math.sin(aa) * 6,
        vx: Math.cos(aa) * 165, vy: Math.sin(aa) * 165, life: 0.65, r: 2.0, dmg: 0, seed: this.rng.int(0, 1e6)
      });
    }
  }
  castArc(p) {
    if (p.meters[2] < ABIL[2].cost) { this.deny(p, 2); return; }
    p.meters[2] -= ABIL[2].cost; p.cd[2] = ABIL[2].cd;
    this.audio.sfx('arc');
    const mw = this.mouseWorld || { x: p.x, y: p.y - 20 };
    let dx = mw.x - p.x, dy = mw.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = 130;
    const steps = Math.floor(Math.min(d, range) / TILE) + 1;
    const hits = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / Math.max(1, steps);
      const x = p.x + dx * t, y = p.y + dy * t;
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      const tile = this.world.at(tx, ty);
      if (tile === T.WATER || tile === T.METAL) {
        this.world.charge[ty * TW + tx] = 55;
        hits.push({ x, y });
      }
      if (this.world.isSolid(tx, ty)) { hits.push({ x, y }); break; }
    }
    this.arcs = this.arcs || [];
    this.arcs.push({ x0: p.x, y0: p.y, x1: p.x + dx / d * Math.min(d, range), y1: p.y + dy / d * Math.min(d, range), t: 0.16, hits });
    // direct damage to enemies along the beam
    for (const e of this.enemies) {
      if (dist(e.x, e.y, p.x, p.y) < range) {
        const proj = ((e.x - p.x) * dx + (e.y - p.y) * dy) / (d * d);
        if (proj < 0 || proj > 1) continue;
        const cxp = p.x + dx * proj, cyp = p.y + dy * proj;
        if (dist(cxp, cyp, e.x, e.y) < 8 + e.r) {
          this.damageEnemy(e, 16, 'shock');
          e.wet = 3;
        }
      }
    }
    this.fx.bang(0.10, '150,220,255');
  }
  castSeed(p) {
    if (p.meters[3] < ABIL[3].cost) { this.deny(p, 3); return; }
    p.meters[3] -= ABIL[3].cost; p.cd[3] = ABIL[3].cd;
    this.audio.sfx('seed');
    for (let i = 0; i < 5; i++) {
      const a = this.rng.range(0, TAU), d = this.rng.range(0, 9);
      const x = Math.floor((p.x + Math.cos(a) * d) / TILE), y = Math.floor((p.y + Math.sin(a) * d) / TILE);
      if (this.world.at(x, y) === T.AIR) {
        this.world.set(x, y, T.SPORE);
        this.world.life[y * TW + x] = 1;
      }
    }
    this.burst(p.x, p.y, 14, 70, 120, 240, 160);
  }
  deny(p, i) {
    if (p.hurtCd > 0) return;
    p.hurtCd = 0.35;
    this.audio.sfx('deny');
  }

  siphon(p, dt) {
    p.siphonT += dt;
    const radius = 26 * this.run.mut.siphon * (1 + this.upLv('siphon') * 0.25);
    const r2 = radius * radius;
    const tx0 = Math.floor((p.x - radius) / TILE), tx1 = Math.floor((p.x + radius) / TILE);
    const ty0 = Math.floor((p.y - radius) / TILE), ty1 = Math.floor((p.y + radius) / TILE);
    const budget = Math.max(1, Math.floor(dt * 22 * this.run.mut.siphonSpeed));
    let taken = 0;
    for (let y = ty0; y <= ty1 && taken < budget; y++) {
      for (let x = tx0; x <= tx1 && taken < budget; x++) {
        const dx = x * TILE + TILE / 2 - p.x, dy = y * TILE + TILE / 2 - p.y;
        if (dx * dx + dy * dy > r2) continue;
        const i = y * TW + x;
        const tile = this.world.tiles[i];
        let el = SIPHON[tile];
        if (el < 0) {
          if (NEUTRAL[tile]) el = p.form;             // rock feeds your current body
          else if (this.run.mut.eatStone && (tile === T.OBSIDIAN || tile === T.GLASS)) el = p.form;
          else continue;
        }
        if (p.meters[el] >= p.cap) continue;
        this.world.tiles[i] = T.AIR;
        this.run.tiles++;
        const gain = 5.2 * this.run.mut.allGain * (el === 0 ? this.run.mut.emberGain : el === 1 ? this.run.mut.tideGain : el === 2 ? this.run.mut.sparkGain : this.run.mut.bloomGain);
        p.meters[el] = Math.min(p.cap, p.meters[el] + gain);
        taken++;
        const c = METER_COLORS_RGB[el];
        this.particles.spawn({
          x: x * TILE + TILE / 2, y: y * TILE + TILE / 2,
          vx: (p.x - (x * TILE + TILE / 2)) * 4, vy: (p.y - (y * TILE + TILE / 2)) * 4,
          life: 0.28, size: 1.8, r: c[0], g: c[1], b: c[2],
          add: true, drag: 0.9, glow: true
        });
      }
    }
    if (taken > 0) {
      if (this.rng.chance(0.14)) this.audio.sfx('siphon', taken);
    } else if (p.siphonT > 0.5) {
      p.siphonT = 0;
      if (this.rng.chance(0.05)) this.text.add(p.x, p.y - 12, 'FULL', '#8f8397', 6);
    }
  }

  nearTile(x, y, type, radius) {
    const tx0 = Math.floor((x - radius) / TILE), tx1 = Math.floor((x + radius) / TILE);
    const ty0 = Math.floor((y - radius) / TILE), ty1 = Math.floor((y + radius) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (this.world.at(tx, ty) === type) return true;
    }
    return false;
  }

  waterAt(x, y) {
    const t = this.world.tileAtPx(x, y);
    return t === T.WATER || t === T.ACID || t === T.OIL;
  }

  // ------------------------------------------------------------------ combat
  damagePlayer(amount, cause) {
    const p = this.player;
    if (!p || p.dead) return;
    if (cause === 'contact' && p.spawnGrace > 0) return;
    if (p.iframes > 0 && cause !== 'lava' && cause !== 'acid' && cause !== 'fire') return;
    p.hp -= amount;
    if (amount > 3) {
      p.iframes = 0.75;
      this.fx.kick(Math.min(7, amount * 0.35));
      this.fx.bang(0.22, '255,90,60');
      this.audio.sfx('hurt');
      this.text.add(p.x, p.y - 8, '-' + Math.round(amount), '#ff8a6a', 7);
      this.burst(p.x, p.y, 8, 80, 255, 90, 60);
    }
    if (p.hp <= 0) this.killPlayer();
  }

  healPlayer(amount) {
    const p = this.player;
    if (!p) return;
    if (p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + amount);
      this.text.add(p.x, p.y - 9, '+' + Math.round(amount), '#8ef0a8', 7);
    }
  }

  killPlayer() {
    const p = this.player;
    if (this.run.mut.secondChance > 0 && !this.run.reviveUsed) {
      this.run.reviveUsed = true;
      this.run.mut.secondChance--;
      p.hp = p.maxHp * 0.4;
      p.iframes = 2.2;
      this.audio.sfx('levelup');
      this.fx.bang(0.6, '255,220,150');
      this.burst(p.x, p.y, 40, 160, 255, 200, 120);
      this.announce('SECOND EMBER', 'you refuse the dark');
      return;
    }
    p.dead = true;
    p.hp = 0;
    this.audio.sfx('death');
    this.fx.kick(9, 0.6);
    this.fx.bang(0.5, '255,120,60');
    this.burst(p.x, p.y, 46, 190, 255, 150, 70);
    this.state = 'dying';
    setTimeout(() => this.gameOver(), 900);
  }

  gameOver() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    const gained = this.cinderGain(Math.floor(this.run.score / 6));
    this.save.cinders += gained;
    this.save.stats.runs++;
    this.save.stats.kills += this.run.kills;
    this.save.stats.deepest = Math.max(this.save.stats.deepest, this.run.stratum);
    this.save.stats.best = Math.max(this.save.stats.best, this.run.score);
    this.save_();
    this.dom.showDeath({
      score: this.run.score, stratum: this.run.stratum, kills: this.run.kills,
      tiles: this.run.tiles, shards: this.run.shards, time: this.run.time,
      cinders: gained, total: this.save.cinders, best: this.save.stats.best
    });
    this.audio.setMusic(false);
  }

  damageEnemy(e, amount, cause) {
    if (e.dead) return;
    let dmg = amount;
    if (cause === 'fire' || cause === 'burn') dmg *= e.fireRes;
    e.hp -= dmg;
    e.hurt = 0.14;
    if (dmg >= 6) {
      this.text.add(e.x, e.y - e.r - 2, String(Math.round(dmg)), cause === 'shock' ? '#a9e8ff' : '#ffe0a0', 7);
    }
    if (e.hp <= 0) this.killEnemy(e, cause);
  }

  killEnemy(e, cause) {
    e.dead = true;
    this.run.kills++;
    // combo: chained kills multiply the score
    this.run.combo = (this.run.comboT > 0 ? this.run.combo + 1 : 1);
    this.run.comboT = 3.2;
    const mult = Math.min(5, 1 + (this.run.combo - 1) * 0.25);
    this.run.score += Math.round(e.score * mult);
    if (this.run.combo >= 3) {
      this.text.add(e.x, e.y - e.r - 10, 'x' + mult.toFixed(2).replace('.00', ''), '#ffd27a', 8);
    }
    const c = FORMS[e.el].color;
    this.burst(e.x, e.y, 16, 130, c[0], c[1], c[2]);
    this.audio.sfx('pop');
    const p = this.player;
    if (p) {
      const gain = 7;
      p.meters[e.el] = Math.min(p.cap, p.meters[e.el] + gain);
    }
    if (e.type === 'sporepod') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU + this.rng.range(0, 1);
        const s = this.spawnEnemy('sporeling', e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6);
        s.vx = Math.cos(a) * 60; s.vy = Math.sin(a) * 60;
      }
    }
    if (this.run.mut.volatile) {
      for (const o of this.enemies) {
        if (o !== e && dist(o.x, o.y, e.x, e.y) < 26) {
          this.damageEnemy(o, 18, 'burn');
          this.igniteAt(o.x, o.y, 1.4, false);
        }
      }
      this.explode(e.x, e.y, 16, 20);
    }
  }

  terrainDamage(dt) {
    const p = this.player;
    for (const e of this.enemies) {
      const tx = Math.floor(e.x / TILE), ty = Math.floor(e.y / TILE);
      const tile = this.world.at(tx, ty);
      if (tile === T.FIRE) {
        e.burnT += dt;
        if (e.burnT > 0.12) { e.burnT = 0; this.damageEnemy(e, 7 * e.fireRes, 'fire'); }
      }
      if (tile === T.LAVA) this.damageEnemy(e, 24 * dt, 'fire');
      if (tile === T.WATER) e.wet = 2.2;
      if (tile === T.ICE) { e.frozen = Math.max(e.frozen, 0.7); }
      if (tile === T.ACID) this.damageEnemy(e, 16 * dt, 'acid');
      // electric water
      const charge = this.world.charge[ty * TW + tx];
      if (charge > 0) {
        this.damageEnemy(e, 16 * dt, 'shock');
        if (this.rng.chance(0.14)) {
          this.particles.spawn({
            x: e.x + this.rng.range(-3, 3), y: e.y + this.rng.range(-3, 3),
            vx: this.rng.range(-60, 60), vy: this.rng.range(-60, 60), life: 0.22, size: 1.4,
            r: 170, g: 230, b: 255, add: true, drag: 0.9, glow: true
          });
        }
      }
      if (e.frozen > 0) { e.vx *= 0.85; e.vy *= 0.85; }
    }
    // player standing in electrified water
    if (p) {
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      if (this.world.charge[ty * TW + tx] > 0 && p.form !== 2) this.damagePlayer(18 * dt, 'shock');
    }
  }

  // ------------------------------------------------------------------ enemies
  updateEnemies(dt) {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      e.anim += dt;
      e.hurt = Math.max(0, e.hurt - dt);
      e.wet = Math.max(0, e.wet - dt);
      e.frozen = Math.max(0, e.frozen - dt);
      if (!p) continue;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (e.type === 'warden') this.updateBoss(e, dt, dx, dy, d);
      else if (e.type === 'drifter') {
        e.vx += (dx / d) * 120 * dt; e.vy += (dy / d) * 120 * dt;
        e.vx *= 0.94; e.vy *= 0.94;
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.x = clamp(e.x, 4, WW - 4); e.y = clamp(e.y, 4, WH - 4);
      } else if (e.type === 'wraith') {
        e.vx += (dx / d) * 200 * dt; e.vy += (dy / d) * 200 * dt;
        e.vx *= 0.95; e.vy *= 0.95;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (d < 12 && e.drainT <= 0) {
          e.drainT = 0.6;
          const el = 2;
          p.meters[el] = Math.max(0, p.meters[el] - 9);
          this.text.add(p.x, p.y - 9, '-9 SPARK', '#ffe860', 7);
        }
        e.drainT = Math.max(0, e.drainT - dt);
      } else if (e.type === 'sporepod') {
        e.vx += Math.cos(e.anim * 0.8 + e.bob) * 20 * dt;
        e.vy += Math.sin(e.anim * 0.8 + e.bob) * 20 * dt;
        e.vx *= 0.9; e.vy *= 0.9;
        e.x += e.vx * dt; e.y += e.vy * dt;
      } else {
        // ground walkers
        e.vy += 460 * dt;
        const dirx = Math.sign(dx) || 1;
        e.vx += dirx * 260 * dt;
        e.vx *= Math.pow(0.86, dt * 60);
        const maxs = e.speed * (e.frozen > 0 ? 0 : 1);
        e.vx = clamp(e.vx, -maxs, maxs);
        if (Math.abs(dy) > 22 && e.type !== 'brute') e.vy -= 120 * dt;
        // jump obstacles
        if (e.frozen <= 0 && Math.abs(e.vx) < 4 && Math.abs(dy) < 26) e.vy = -150;
        e.x += e.vx * dt;
        if (this.world.solidAtPx(e.x + Math.sign(e.vx) * e.r, e.y)) { e.vx = -e.vx * 0.4; }
        e.y += e.vy * dt;
        if (this.world.solidAtPx(e.x, e.y + e.r + 1)) {
          e.y = Math.floor((e.y + e.r + 1) / TILE) * TILE - e.r - 1.01;
          e.vy = 0;
        }
        e.x = clamp(e.x, 4, WW - 4);
        if (e.y > WH + 40) { e.dead = true; }
      }

      // contact damage
      if (dist(e.x, e.y, p.x, p.y) < e.r + 4) {
        this.damagePlayer(e.dmg, 'contact');
        const k = 130 / Math.max(20, d);
        p.vx -= dx / d * k; p.vy -= dy / d * k;
      }
    }
  }

  updateBoss(e, dt, dx, dy, d) {
    const p = this.player;
    e.shootT -= dt; e.summonT -= dt; e.chargeT -= dt;
    e.vx += (dx / d) * 90 * dt; e.vy += (dy / d) * 90 * dt;
    e.vx *= 0.95; e.vy *= 0.95;
    e.x = clamp(e.x + e.vx * dt, 20, WW - 20);
    e.y = clamp(e.y + e.vy * dt, 20, WH - 20);
    if (e.shootT <= 0) {
      e.shootT = 2.4;
      const base = Math.atan2(dy, dx);
      for (let i = 0; i < 8; i++) {
        const a = base + (i / 8) * TAU;
        this.projectiles.push({
          kind: 'ember', x: e.x, y: e.y, vx: Math.cos(a) * 74, vy: Math.sin(a) * 74,
          life: 4, r: 3, dmg: 12, seed: this.rng.int(0, 1e6)
        });
      }
      this.audio.sfx('arc');
    }
    if (e.summonT <= 0) {
      e.summonT = 7;
      for (let i = 0; i < 2; i++) {
        const s = this.spawnEnemy('crawler', e.x + this.rng.range(-16, 16), e.y + this.rng.range(-16, 16));
        s.hp = s.maxHp = 14;
      }
    }
  }

  // ------------------------------------------------------------------ projectiles
  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) { this.projectiles.splice(i, 1); continue; }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt;
      if (pr.kind === 'ember') pr.vy += 30 * dt;
      const tx = Math.floor(pr.x / TILE), ty = Math.floor(pr.y / TILE);
      const tile = this.world.at(tx, ty);

      // world interaction
      if (pr.kind === 'fire' || pr.kind === 'ember') {
        if (FLAMMABLE_TILE(tile) && this.rng.chance(0.8)) {
          this.world.set(tx, ty, T.FIRE);
          this.world.life[ty * TW + tx] = 40 + this.rng.int(50);
          this.projectiles.splice(i, 1);
          this.burst(pr.x, pr.y, 8, 70, 255, 170, 60);
          continue;
        }
        if (tile === T.OIL && this.rng.chance(0.5)) {
          this.world.set(tx, ty, T.FIRE);
          this.world.life[ty * TW + tx] = 60;
          this.projectiles.splice(i, 1); continue;
        }
        if (this.world.isSolid(tx, ty)) {
          this.projectiles.splice(i, 1);
          this.explode(pr.x, pr.y, 8, 12);
          continue;
        }
      } else if (pr.kind === 'water') {
        if (!this.world.isSolid(tx, ty)) {
          this.world.set(tx, ty, T.WATER);
          if (this.run.mut.freeze) {
            const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [ox, oy] of nb) {
              const t2 = this.world.at(tx + ox, ty + oy);
              if (t2 === T.WATER) this.world.set(tx + ox, ty + oy, T.ICE);
            }
          }
        }
        if (this.world.isSolid(tx, ty) || pr.life <= 0) {
          this.projectiles.splice(i, 1);
          this.burst(pr.x, pr.y, 4, 50, 120, 190, 255);
          continue;
        }
      }

      // enemy interaction
      for (const e of this.enemies) {
        if (dist(e.x, e.y, pr.x, pr.y) < e.r + pr.r) {
          if (pr.kind === 'fire' || pr.kind === 'ember') {
            this.damageEnemy(e, pr.dmg * (pr.kind === 'ember' ? 1 : e.fireRes), 'fire');
            e.burnT = 0.3;
          } else if (pr.kind === 'water') {
            e.wet = 3;
            this.damageEnemy(e, 3, 'wet');
          }
          this.burst(pr.x, pr.y, 6, 60, pr.kind === 'water' ? 140 : 255, pr.kind === 'water' ? 200 : 180, pr.kind === 'water' ? 255 : 70);
          this.projectiles.splice(i, 1);
          break;
        }
      }
      if (this.projectiles[i] !== pr) continue;
      if (pr.x < -20 || pr.x > WW + 20 || pr.y < -20 || pr.y > WH + 20) this.projectiles.splice(i, 1);
    }
  }

  igniteAt(x, y, radius, damage) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const r = Math.ceil(radius);
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      if (ox * ox + oy * oy > radius * radius) continue;
      const t = this.world.at(tx + ox, ty + oy);
      if (FLAMMABLE_TILE(t) || t === T.OIL) {
        this.world.set(tx + ox, ty + oy, T.FIRE);
        this.world.life[(ty + oy) * TW + (tx + ox)] = 45 + this.rng.int(55);
      }
    }
    if (damage) {
      for (const e of this.enemies) if (dist(e.x, e.y, x, y) < radius * TILE * 0.7) this.damageEnemy(e, damage, 'fire');
    }
  }

  explode(x, y, radius, dmg) {
    this.fx.kick(5, 0.3);
    this.audio.sfx('boom');
    this.burst(x, y, 24, 170, 255, 170, 70);
    this.igniteAt(x, y, radius / TILE, dmg);
  }

  burst(x, y, n, sp, r, g, b) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, TAU), s = this.rng.range(sp * 0.3, sp);
      this.particles.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: this.rng.range(0.25, 0.7), size: this.rng.range(1.2, 3.0),
        r, g, b, add: true, drag: 0.9, glow: true
      });
    }
  }

  // ------------------------------------------------------------------ movement
  moveEntity(e, dt) {
    const w = this.world;
    e.x += e.vx * dt;
    this.collide(e, true);
    e.y += e.vy * dt;
    this.collide(e, false);
  }
  collide(e, isX) {
    const w = this.world;
    const x0 = Math.floor((e.x - e.hw) / TILE), x1 = Math.floor((e.x + e.hw) / TILE);
    const y0 = Math.floor((e.y - e.hh) / TILE), y1 = Math.floor((e.y + e.hh) / TILE);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!SOLID[w.at(x, y)]) continue;
        if (isX) {
          if (e.vx > 0) e.x = x * TILE - e.hw - 0.01;
          else if (e.vx < 0) e.x = (x + 1) * TILE + e.hw + 0.01;
          e.vx = 0;
        } else {
          if (e.vy > 0) { e.y = y * TILE - e.hh - 0.01; e.vy = 0; }
          else if (e.vy < 0) { e.y = (y + 1) * TILE + e.hh + 0.01; e.vy = 0; }
        }
      }
    }
  }

  // ------------------------------------------------------------------ descend
  descend() {
    if (this.state !== 'play') return;
    this.world.heart.alive = false;
    this.state = 'descending';
    this.fx.bang(0.85, '255,230,170');
    this.fx.kick(7, 0.7);
    this.audio.sfx('descend');
    this.burst(this.world.heart.x * TILE, this.world.heart.y * TILE, 60, 220, 255, 230, 170);
    this.run.score += 250 * this.run.stratum;
    setTimeout(() => this.openDraft(), 850);
  }

  openDraft() {
    this.state = 'draft';
    const pool = MUTATIONS.filter(m => !this.run.picked.includes(m.id));
    const opts = this.rng.shuffle(pool.slice()).slice(0, 3);
    this.dom.showDraft(opts, (m) => {
      this.run.picked.push(m.id);
      m.apply(this.run);
      this.run.score += 120;
      this.dom.show('hud');
      this.state = 'play';
      this.loadStratum(this.run.stratum + 1, false);
      this.announce('STRATUM ' + (ROMAN[this.run.stratum - 1] || this.run.stratum),
        this.world.biome.name + ' \u2014 ' + this.world.biome.sub);
    });
  }

  // ------------------------------------------------------------------ render
  render() {
    const w = this.world;
    const cam = this.cam;
    const ox = cam.tx, oy = cam.ty;

    // ---- world tiles (camera window only)
    const buf = this.worldBuf;
    const sprites = this.sprites;
    const t = w.tiles;
    for (let ly = 0; ly < VIEW_H; ly++) {
      const wy = oy + ly;
      if (wy < 0 || wy >= TH) continue;
      const rowBase = wy * TW;
      for (let lx = 0; lx < VIEW_W; lx++) {
        const wx = ox + lx;
        if (wx < 0 || wx >= TW) continue;
        const sp = sprites[t[rowBase + wx]];
        const px0 = lx * TILE;
        for (let py = 0; py < TILE; py++) {
          const dst = (ly * TILE + py) * VW + px0;
          const src = py * TILE;
          for (let px = 0; px < TILE; px++) buf[dst + px] = sp[src + px];
        }
      }
    }
    this.cWorld.putImageData(this.worldImg, 0, 0);

    // ---- entities & particles (world space)
    const ctx = this.cWorld;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    if (this.state === 'play' || this.state === 'descending' || this.state === 'dying') {
      this.drawEntities(ctx);
    }
    this.particles.draw(ctx, false);
    this.text.draw(ctx);
    ctx.restore();

    // ---- light buffer
    w.computeLight(ox, oy);
    const lb = this.lightBuf;
    const li = w.lightI, lc = w.lightC;
    const amb = this.world.biome ? this.world.biome.sky : [0.05, 0.05, 0.08];
    const depthAmb = 1 / (1 + Math.max(0, (this.run ? this.run.stratum : 1) - 1) * 0.12);
    for (let i = 0; i < VIEW_W * VIEW_H; i++) {
      const v = li[i];
      let r = amb[0] * 255 * depthAmb, g = amb[1] * 255 * depthAmb, b = amb[2] * 255 * depthAmb;
      if (v > 0) {
        const k = Math.pow(v / 255, 1.12);
        r += lc[i * 3] * k; g += lc[i * 3 + 1] * k; b += lc[i * 3 + 2] * k;
      }
      r = Math.min(255, r) | 0; g = Math.min(255, g) | 0; b = Math.min(255, b) | 0;
      lb[i] = 0xff000000 | (b << 16) | (g << 8) | r;
    }
    this.lightCtx.putImageData(this.lightImg, 0, 0);

    const lc2 = this.cLight;
    lc2.globalCompositeOperation = 'source-over';
    lc2.clearRect(0, 0, VW, VH);
    lc2.imageSmoothingEnabled = true;
    lc2.drawImage(this.lightSmall, 0, 0, VW, VH);
    // glow halos live in the light layer so they stay smooth
    lc2.globalCompositeOperation = 'lighter';
    lc2.save();
    lc2.translate(-cam.x, -cam.y);
    this.drawGlow(lc2);
    this.particles.draw(lc2, true);
    if (this.state === 'play' && this.player && w.heart.alive) this.drawCompass(lc2);
    lc2.restore();
    lc2.globalCompositeOperation = 'source-over';

    // ---- overlays on the pixel canvas (screen space)
    ctx.globalAlpha = 1;
    ctx.drawImage(this.vignette, 0, 0);
    if (this.fx.flash > 0) {
      ctx.globalAlpha = Math.min(1, this.fx.flash);
      ctx.fillStyle = `rgba(${this.fx.flashColor},1)`;
      ctx.fillRect(0, 0, VW, VH);
      ctx.globalAlpha = 1;
    }

    // ---- mark explored ground for the map
    if (this.state === 'play' || this.state === 'title') this.markExplored();
  }

  updateCamera(dt) {
    const cam = this.cam;
    let tx, ty;
    if (this.player) {
      tx = (this.player.x - VW / 2) / TILE;
      ty = (this.player.y - VH / 2) / TILE;
    } else if (this.titleLight) {
      tx = (this.titleLight.x * TILE - VW / 2) / TILE;
      ty = (this.titleLight.y * TILE - VH / 2) / TILE;
    } else {
      tx = Math.cos(this.titleT * 0.06) * (TW / 2 - VIEW_W / 2);
      ty = Math.sin(this.titleT * 0.045) * (TH / 2 - VIEW_H / 2);
    }
    tx = clamp(tx, 0, TW - VIEW_W);
    ty = clamp(ty, 0, TH - VIEW_H);
    const k = 1 - Math.pow(0.0005, dt);
    cam.x = lerp(cam.x, tx * TILE, k);
    cam.y = lerp(cam.y, ty * TILE, k);
    cam.tx = clamp(Math.floor(cam.x / TILE), 0, TW - VIEW_W);
    cam.ty = clamp(Math.floor(cam.y / TILE), 0, TH - VIEW_H);
    cam.x = cam.tx * TILE;
    cam.y = cam.ty * TILE;
    this.world.setSimWindow(cam.tx - 14, cam.ty - 14, cam.tx + VIEW_W + 14, cam.ty + VIEW_H + 14);
  }

  markExplored() {
    const w = this.world, li = w.lightI, ex = w.explored;
    const ox = this.cam.tx, oy = this.cam.ty;
    for (let ly = 0; ly < VIEW_H; ly += 1) {
      const wy = oy + ly;
      if (wy < 0 || wy >= TH) continue;
      for (let lx = 0; lx < VIEW_W; lx++) {
        if (li[ly * VIEW_W + lx] > 12) ex[wy * TW + (ox + lx)] = 1;
      }
    }
  }

  drawEntities(ctx) {
    const p = this.player;
    // enemies
    for (const e of this.enemies) {
      const light = this.world.lightAt(Math.floor(e.x / TILE), Math.floor(e.y / TILE));
      ctx.save();
      if (e.type === 'wraith') {
        ctx.globalAlpha = clamp(0.20 + light / 200, 0.16, 0.95);
      }
      if (e.hurt > 0) ctx.globalAlpha = Math.min(1, ctx.globalAlpha + 0.4);
      this.drawEnemy(ctx, e);
      ctx.restore();
      if (e.hurt > 0) {
        ctx.globalAlpha = e.hurt / 0.14 * 0.8;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
      }
      if (e.maxHp > 40 && e.hp < e.maxHp) {
        const w = e.r * 2.4, h = 1.6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 5, w, h);
        ctx.fillStyle = '#ff5a4a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 5, w * (e.hp / e.maxHp), h);
      }
    }
    // projectiles
    for (const pr of this.projectiles) {
      if (pr.kind === 'water') {
        ctx.fillStyle = '#7ec8ff';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = pr.kind === 'ember' ? '#ff9a3c' : '#ffd45e';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, TAU); ctx.fill();
      }
    }
    // player
    if (p && !p.dead) this.drawPlayer(ctx, p);
    // arcs
    if (this.arcs) {
      for (let i = this.arcs.length - 1; i >= 0; i--) {
        const a = this.arcs[i];
        a.t -= 1 / 60;
        if (a.t <= 0) { this.arcs.splice(i, 1); continue; }
        ctx.globalAlpha = clamp(a.t / 0.16, 0, 1);
        ctx.strokeStyle = '#bfe8ff'; ctx.lineWidth = 1;
        ctx.beginPath();
        const segs = 6;
        for (let s = 0; s <= segs; s++) {
          const tt = s / segs;
          const jx = (Math.random() - 0.5) * 7 * (tt > 0 && tt < 1 ? 1 : 0);
          const jy = (Math.random() - 0.5) * 7 * (tt > 0 && tt < 1 ? 1 : 0);
          const x = lerp(a.x0, a.x1, tt) + jx, y = lerp(a.y0, a.y1, tt) + jy;
          if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  drawPlayer(ctx, p) {
    const f = FORMS[p.form];
    const blink = p.iframes > 0 && Math.floor(p.anim * 18) % 2 === 0;
    // trail
    for (const t of p.trail) {
      ctx.globalAlpha = t.t / 0.32 * 0.5;
      ctx.fillStyle = `rgb(${f.color[0]},${f.color[1]},${f.color[2]})`;
      ctx.beginPath(); ctx.arc(t.x, t.y, 2.4, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (blink) return;
    const r = 3.4 + Math.sin(p.anim * 6) * 0.25;
    ctx.fillStyle = `rgb(${f.color[0] * 0.45 | 0},${f.color[1] * 0.45 | 0},${f.color[2] * 0.45 | 0})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r + 1.4, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgb(${f.color[0]},${f.color[1]},${f.color[2]})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(p.x - 0.4, p.y - 0.4, r * 0.5, 0, TAU); ctx.fill();
    // eyes
    const ex = Math.cos(p.aim) * 1.4, ey = Math.sin(p.aim) * 1.4;
    ctx.fillStyle = '#12101c';
    ctx.fillRect(p.x + ex - 1.2, p.y + ey - 0.8, 1.1, 1.1);
    ctx.fillRect(p.x + ex + 0.4, p.y + ey - 0.8, 1.1, 1.1);
  }

  drawEnemy(ctx, e) {
    const t = e.type;
    const bob = Math.sin(e.anim * 6 + e.bob) * 0.6;
    if (t === 'crawler' || t === 'sporeling') {
      const s = e.r;
      ctx.fillStyle = '#6a4a7a';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + bob, s, s * 0.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9a6fb0';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + bob - 1, s * 0.8, s * 0.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe66d';
      ctx.fillRect(e.x - s * 0.6, e.y + bob - 0.6, 1.2, 1.2);
      ctx.fillRect(e.x + s * 0.2, e.y + bob - 0.6, 1.2, 1.2);
    } else if (t === 'drifter') {
      const s = e.r;
      ctx.fillStyle = 'rgba(90,150,220,0.85)';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - s * 1.3 + bob);
      ctx.lineTo(e.x + s, e.y + bob);
      ctx.lineTo(e.x, e.y + s * 1.2 + bob);
      ctx.lineTo(e.x - s, e.y + bob);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8f0ff';
      ctx.fillRect(e.x - 1, e.y + bob - 1, 2, 2);
    } else if (t === 'brute') {
      const s = e.r;
      ctx.fillStyle = '#5a2f2f';
      ctx.fillRect(e.x - s, e.y - s + bob, s * 2, s * 2);
      ctx.fillStyle = '#8a4444';
      ctx.fillRect(e.x - s * 0.8, e.y - s * 0.8 + bob, s * 1.6, s * 1.6);
      ctx.fillStyle = '#ffb03a';
      ctx.fillRect(e.x - s * 0.5, e.y - 0.4 + bob, s * 0.5, s * 0.5);
      ctx.fillRect(e.x + s * 0.05, e.y - 0.4 + bob, s * 0.5, s * 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(e.x - s, e.y + s - 1 + bob, s * 2, 2);
    } else if (t === 'wraith') {
      const s = e.r;
      ctx.fillStyle = 'rgba(20,14,32,0.92)';
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - s * 1.4);
      ctx.quadraticCurveTo(e.x + s * 1.3, e.y - s * 0.2, e.x + s * 0.8, e.y + s * 1.1);
      ctx.quadraticCurveTo(e.x, e.y + s * 0.5, e.x - s * 0.8, e.y + s * 1.1);
      ctx.quadraticCurveTo(e.x - s * 1.3, e.y - s * 0.2, e.x, e.y - s * 1.4);
      ctx.fill();
      ctx.fillStyle = '#b98cff';
      ctx.fillRect(e.x - 1.6, e.y - 0.6, 1.3, 1.6);
      ctx.fillRect(e.x + 0.3, e.y - 0.6, 1.3, 1.6);
    } else if (t === 'sporepod') {
      const s = e.r;
      ctx.fillStyle = '#4e7a52';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + bob, s, s * 1.1, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8fdc95';
      for (let i = 0; i < 4; i++) {
        const a = e.anim * 0.6 + i * 1.6;
        ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * s * 0.5, e.y + bob + Math.sin(a) * s * 0.5, 1, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#ffe66d';
      ctx.fillRect(e.x - 1, e.y - 0.6 + bob, 1, 1);
      ctx.fillRect(e.x + 0.6, e.y - 0.6 + bob, 1, 1);
    } else if (t === 'warden') {
      const s = e.r;
      ctx.fillStyle = '#2b1b33';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3d2547';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob - 2, s * 0.72, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff6a3a';
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, s * 0.3 + Math.sin(e.anim * 4) * 1.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd08a';
      ctx.fillRect(e.x - s * 0.5, e.y - 3 + bob, 2.4, 2.4);
      ctx.fillRect(e.x + s * 0.2, e.y - 3 + bob, 2.4, 2.4);
      ctx.strokeStyle = 'rgba(255,120,60,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(e.x, e.y + bob, s + 3 + Math.sin(e.anim * 2) * 2, 0, TAU); ctx.stroke();
    }
  }

  drawGlow(gc) {
    const p = this.player;
    // player aura
    if (p && !p.dead) {
      const f = FORMS[p.form];
      const sp = this.glowSprite(f.color[0], f.color[1], f.color[2]);
      const s = 96 * this.run.mut.light;
      gc.globalAlpha = 0.40;
      gc.drawImage(sp, p.x - s / 2, p.y - s / 2, s, s);
      const lsp = this.glowSprite(f.light[0], f.light[1], f.light[2]);
      gc.globalAlpha = 0.85;
      gc.drawImage(lsp, p.x - 15, p.y - 15, 30, 30);
      gc.globalAlpha = 1;
    }
    // projectiles
    for (const pr of this.projectiles) {
      const c = pr.kind === 'water' ? [130, 200, 255] : [255, 180, 70];
      const sp = this.glowSprite(c[0], c[1], c[2]);
      gc.globalAlpha = 0.85;
      gc.drawImage(sp, pr.x - 12, pr.y - 12, 24, 24);
    }
    gc.globalAlpha = 1;
    // lava & fire glow: sample the visible window sparsely
    const t = this.world.tiles;
    const ox = this.cam.tx, oy = this.cam.ty;
    for (let ly = 0; ly < VIEW_H; ly += 2) {
      const wy = oy + ly;
      if (wy < 0 || wy >= TH) continue;
      for (let lx = 0; lx < VIEW_W; lx += 2) {
        const wx = ox + lx;
        if (wx < 0 || wx >= TW) continue;
        const v = t[wy * TW + wx];
        if (v === T.LAVA || v === T.FIRE) {
          const c = v === T.LAVA ? [255, 120, 40] : [255, 170, 60];
          const sp = this.glowSprite(c[0], c[1], c[2]);
          gc.globalAlpha = 0.42;
          gc.drawImage(sp, wx * TILE - 10, wy * TILE - 10, 28, 28);
        } else if (v === T.CRYSTAL) {
          const sp = this.glowSprite(130, 225, 255);
          gc.globalAlpha = 0.36;
          gc.drawImage(sp, wx * TILE - 7, wy * TILE - 7, 22, 22);
        }
      }
    }
    gc.globalAlpha = 1;
  }

  drawCompass(ctx) {
    const p = this.player;
    const hx = this.world.heart.x * TILE + TILE / 2, hy = this.world.heart.y * TILE + TILE / 2;
    const a = Math.atan2(hy - p.y, hx - p.x);
    const d = 62;
    const cx = clamp(p.x + Math.cos(a) * d, this.cam.x + 14, this.cam.x + VW - 14);
    const cy = clamp(p.y + Math.sin(a) * d, this.cam.y + 14, this.cam.y + VH - 14);
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,214,140,0.9)';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,60,0.35)';
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-3, -6); ctx.lineTo(-3, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const METER_COLORS_RGB = [[255, 148, 58], [78, 172, 255], [255, 232, 96], [116, 236, 142]];
const FLAMMABLE_TILE = (t) => FLAMMABLE_TABLE[t] === 1;
const FLAMMABLE_TABLE = (() => {
  const a = new Uint8Array(32);
  a[T.WOOD] = 1; a[T.FOLIAGE] = 1; a[T.SPORE] = 1; a[T.ROOT] = 1; a[T.OIL] = 1;
  return a;
})();
