import {
  TAU, clamp, rand, pick, dist, RNG, randomSeed,
} from './util.js';
import { WEAPON_BY_ID, WHISPERS, DEATH_LINES, COLORS } from './data.js';
import { SpaceBackground } from './render.js';
import { flowMethods } from './game-flow.js';
import { combatMethods } from './game-combat.js';
import { drawMethods } from './game-draw.js';

export class Game {
  constructor(canvas, { audio, save }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.audio = audio;
    this.save = save;
    this.ui = null;
    this.bg = new SpaceBackground();
    this.W = 0; this.H = 0; this.S = 1; this.dpr = 1;
    this.time = 0;
    this.state = 'menu';
    this.lastTs = performance.now();
    this.timeScale = 1;
    this.slowT = 0;
    this.slowFactor = 1;
    this.shake = 0;
    this.flashA = 0;
    this.flashColor = '#ffffff';
    this.rng = new RNG(Date.now());
    this.isTouch = matchMedia('(pointer: coarse)').matches;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, seen: false };
    this.touch = {
      moveId: null, aimId: null,
      moveStart: { x: 0, y: 0 }, aimStart: { x: 0, y: 0 },
      moveVec: { x: 0, y: 0 }, aimVec: { x: 0, y: 0 },
    };
    this.dashQueued = false;
    this.novaQueued = false;
    this.deathT = 0;
    this.finished = false;
    this.renderScale = 1;
    this.perfT = 0;
    this.perfFrames = 0;
    this.el = this.grabEls();
    this._hud = {};
    this.controlHintT = 0;
    this.stats = this.baseStats();
    this.player = this.makePlayer();
    this.weapon = WEAPON_BY_ID.pulsar;
    this.weaponId = 'pulsar';
    this.resetWorld();
    this.bindEvents();
    this.resize();
    requestAnimationFrame(ts => this.loop(ts));
  }

  grabEls() {
    const $ = id => document.getElementById(id);
    return {
      hud: $('hud'), hp: $('hpPips'), shield: $('shieldPips'), dash: $('dashPips'),
      waveNum: $('waveNum'), waveSub: $('waveSub'), waveFill: $('waveFill'),
      score: $('score'), best: $('best'), combo: $('combo'),
      bossBar: $('bossBar'), bossName: $('bossName'), bossHp: $('bossHpText'), bossFill: $('bossFill'),
      banner: $('banner'), bannerTitle: $('bannerTitle'), bannerSub: $('bannerSub'),
      novaHint: $('novaHint'), xpFill: $('xpFill'), level: $('levelLabel'), xpText: $('xpText'),
      controlHint: $('controlHint'), danger: $('dangerFlash'), toast: $('toast'),
      touchNova: $('btnTouchNova'),
    };
  }

  baseStats() {
    return {
      maxHp: 6, damage: 1, rate: 1, speed: 1, projSpeed: 1, pierce: 0, count: 0,
      crit: 0.05, critMul: 2, grazeMul: 1, xpMul: 1, magnet: 1,
      dashCharges: 2, dashRecharge: 1, knockback: 1, ricochet: 0, chain: 0,
      burn: 0, frost: 0, shieldMax: 0, orbit: 0, novaPower: 1, leech: 0,
      bounty: 0, supernova: false, starChild: 0, overcharge: false,
      reaper: false, solar: 0, prism: false, timeField: 0, phoenix: false,
      rerolls: 0, greed: 1, revive: 0, firstBlessing: false, startShield: 0,
    };
  }

  makePlayer() {
    return {
      x: this.W / 2 || 500, y: this.H / 2 || 400, vx: 0, vy: 0,
      r: 11, aim: 0, fireCd: 0, iframes: 0, dashT: 0, dashVX: 0, dashVY: 0,
      dashEnergy: 2, dashMax: 2, focus: 0, shield: 0, shieldMax: 0,
      shieldT: 0, hurtT: 0, trail: [], orbitAngle: 0, shotCounter: 0,
      solarT: 4.5, dead: false, reviveGlow: 0, hp: 6, maxHp: 6,
    };
  }

  resetWorld() {
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.motes = [];
    this.hearts = [];
    this.particles = [];
    this.zones = [];
    this.companions = [];
    this.fireflies = [];
    this.nextId = 1;
    this.combo = 0;
    this.comboT = 0;
    this.comboMul = 1;
    this.maxCombo = 0;
    this.score = 0;
    this.kills = 0;
    this.grazes = 0;
    this.bossesKilled = 0;
    this.wave = 1;
    this.waveT = 30;
    this.waveDuration = 30;
    this.runTime = 0;
    this.spawnT = 1.2;
    this.bossActive = false;
    this.bossRef = null;
    this.bossPendingT = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = this.xpNeeded(1);
    this.pendingLevels = 0;
    this.upgrades = {};
    this.rerollsLeft = 0;
    this.revives = 0;
    this.revivesUsed = 0;
    this.heartPity = 0;
    this.timeScale = 1;
    this.slowT = 0;
    this.shake = 0;
    this.flashA = 0;
    this.deathT = 0;
    this.finished = false;
    this.lastDanger = -1;
    this.lastIntensity = -1;
    this.seed = '';
    this.lastHurtAt = 0;
    this.taughtGraze = false;
    this._hud = {};
  }

  // ============================================================
  // input
  // ============================================================
  bindEvents() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') this.handleTouchMove(e);
      else {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.mouse.seen = true;
      }
    });
    window.addEventListener('pointerdown', e => {
      if (e.target !== this.canvas) return;
      this.audio.unlock();
      if (e.pointerType === 'touch') {
        this.handleTouchDown(e);
      } else if (this.state === 'running') {
        if (e.button === 0) this.mouse.down = true;
        if (e.button === 2) this.queueNova();
      }
    });
    window.addEventListener('pointerup', e => {
      if (e.pointerType === 'touch') this.handleTouchUp(e);
      else if (e.button === 0) this.mouse.down = false;
    });
    window.addEventListener('pointercancel', e => {
      if (e.pointerType === 'touch') this.handleTouchUp(e);
      else this.mouse.down = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.touch.moveId = null;
      this.touch.aimId = null;
      if (this.state === 'running') this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'running') this.pause();
    });
    window.addEventListener('contextmenu', e => {
      if (e.target === this.canvas) e.preventDefault();
    });
    window.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '')) return;
      if ((e.code === 'Space' || e.code.startsWith('Arrow')) && this.state === 'running') e.preventDefault();
      this.audio.unlock();
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        this.keys.add(e.code);
      }
      if (e.code === 'Space' && this.state === 'running' && !e.repeat) this.queueDash();
      if (e.code === 'KeyE' && this.state === 'running' && !e.repeat) this.queueNova();
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
        if (this.state === 'running') this.pause();
        else if (this.state === 'paused') this.resume();
      }
      if (e.code === 'KeyM' && !e.repeat) this.ui?.toggleMusic?.();
      if (this.state === 'levelup' && !e.repeat) {
        if (e.code === 'Digit1' || e.code === 'Numpad1') this.chooseUpgradeIndex(0);
        else if (e.code === 'Digit2' || e.code === 'Numpad2') this.chooseUpgradeIndex(1);
        else if (e.code === 'Digit3' || e.code === 'Numpad3') this.chooseUpgradeIndex(2);
        else if (e.code === 'KeyQ') this.reroll();
      }
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.W = w; this.H = h;
    this.applyCanvasSize();
    this.S = clamp(Math.min(w, h) / 900, 0.7, 1.55);
    if (!this.mouse.seen) {
      this.mouse.x = w * 0.66;
      this.mouse.y = h * 0.5;
    }
    if (this.player) {
      this.player.r = 11 * this.S;
      this.player.x = clamp(this.player.x, 30, w - 30);
      this.player.y = clamp(this.player.y, 30, h - 30);
      this.player.trail = [];
    }
    this.bg.resize(w, h);
    if (this.el.danger) this.el.danger.style.opacity = 0;
  }

  applyCanvasSize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1) * this.renderScale;
    this.canvas.width = Math.max(320, Math.floor(this.W * this.dpr));
    this.canvas.height = Math.max(240, Math.floor(this.H * this.dpr));
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  handleTouchDown(e) {
    if (this.state !== 'running') return;
    const t = this.touch;
    if (e.clientX < this.W * 0.46) {
      if (t.moveId === null) {
        t.moveId = e.pointerId;
        t.moveStart.x = e.clientX;
        t.moveStart.y = e.clientY;
        t.moveVec.x = 0;
        t.moveVec.y = 0;
      }
    } else if (t.aimId === null) {
      t.aimId = e.pointerId;
      t.aimStart.x = e.clientX;
      t.aimStart.y = e.clientY;
      t.aimVec.x = 0;
      t.aimVec.y = 0;
    }
  }

  handleTouchMove(e) {
    const t = this.touch;
    if (e.pointerId === t.moveId) {
      t.moveVec.x = e.clientX - t.moveStart.x;
      t.moveVec.y = e.clientY - t.moveStart.y;
    } else if (e.pointerId === t.aimId) {
      t.aimVec.x = e.clientX - t.aimStart.x;
      t.aimVec.y = e.clientY - t.aimStart.y;
    }
  }

  handleTouchUp(e) {
    const t = this.touch;
    if (e.pointerId === t.moveId) {
      t.moveId = null; t.moveVec.x = 0; t.moveVec.y = 0;
    }
    if (e.pointerId === t.aimId) {
      t.aimId = null; t.aimVec.x = 0; t.aimVec.y = 0;
    }
  }

  queueDash() { if (this.state === 'running') this.dashQueued = true; }
  queueNova() { if (this.state === 'running') this.novaQueued = true; }

  // ============================================================
  // run lifecycle
  // ============================================================
  startRun(weaponId = 'pulsar', seed) {
    if (!this.save.isUnlocked(weaponId)) weaponId = 'pulsar';
    this.audio.unlock();
    this.resetWorld();
    this.state = 'running';
    this.seed = seed || randomSeed();
    this.rng = new RNG(this.seed);
    this.save.data.lastSeed = this.seed;
    this.weaponId = weaponId;
    this.weapon = WEAPON_BY_ID[weaponId] || WEAPON_BY_ID.pulsar;
    this.stats = this.baseStats();
    this.save.applyMeta(this.stats);
    this.stats.shieldMax += this.stats.startShield;
    this.player = this.makePlayer();
    this.player.maxHp = this.stats.maxHp;
    this.player.hp = this.stats.maxHp;
    this.player.dashMax = this.stats.dashCharges;
    this.player.dashEnergy = this.stats.dashCharges;
    this.player.shieldMax = this.stats.shieldMax;
    this.player.shield = this.stats.shieldMax;
    this.revives = this.stats.revive + (this.stats.phoenix ? 1 : 0);
    this.rerollsLeft = this.stats.rerolls;
    this.keys.clear();
    this.mouse.down = false;
    this.dashQueued = false;
    this.novaQueued = false;
    this.el.hud.classList.add('on');
    this.el.bossBar.classList.remove('on');
    this.el.combo.classList.remove('on');
    this.el.novaHint.classList.remove('on');
    this.el.controlHint.classList.add('on');
    this.controlHintT = 12;
    this.ui?.startRunUI?.();
    this.ui?.setTouchControls?.(this.isTouch);
    if (this.stats.firstBlessing) {
      const choices = this.rollChoices();
      if (choices.length) {
        this.applyUpgrade(choices[0].id, true);
        this.ui?.toast?.(`FIRST BLOSSOM · ${choices[0].name}`, false, 2800);
      }
    }
    for (let i = 0; i < 30; i++) {
      const a = rand(0, TAU), sp = rand(40, 220);
      this.addGlow(this.player.x, this.player.y, COLORS.cyan, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.5, 1.2), rand(2, 5));
    }
    this.ringFx(this.player.x, this.player.y, 10, 170, 0.9, COLORS.cyan, 2);
    this.shakeIt(6);
    this.flash('#bff4ff', 0.22);
    this.audio.wave();
    this.audio.setIntensity(0.3);
    this.audio.setDanger(0);
    this.startWave(1, true);
    this.ui?.syncBest?.();
  }

  startWave(n, first = false) {
    this.wave = n;
    this.waveDuration = 30;
    this.waveT = 30;
    this.spawnT = first ? 0.35 : 0.9;
    this.bossPendingT = n % 5 === 0 ? 1.4 : 0;
    this.el.waveNum.textContent = n;
    this.el.waveSub.textContent = n % 5 === 0 ? '· HORROR' : '';
    if (!first) this.audio.wave();
    const whisper = n === 1 ? 'graze fire to grow your nova'
      : WHISPERS[Math.floor(this.rng.next() * WHISPERS.length)];
    this.ui?.banner?.(`WAVE ${n}`, whisper, false);
    if (n % 5 === 0) this.ui?.toast?.('SOMETHING HUGE IS WAKING UP', true, 2600);
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.keys.clear();
    this.audio.setIntensity(0.12);
    this.ui?.showPause?.();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.audio.setIntensity(this.waveIntensity());
    this.ui?.hidePause?.();
  }

  abandonRun() {
    this.state = 'menu';
    this.mouse.down = false;
    this.keys.clear();
    this.el.hud.classList.remove('on');
    this.el.bossBar.classList.remove('on');
    this.ui?.setTouchControls?.(false);
    this.ui?.showTitle?.();
    this.audio.setIntensity(0);
    this.audio.setDanger(0);
  }

  restartRun() {
    this.ui?.hideAll?.();
    this.startRun(this.weaponId);
  }

  finishRun() {
    if (this.finished) return;
    this.finished = true;
    this.state = 'dead';
    const base = Math.floor(this.score / 180) + this.wave * 4 + this.bossesKilled * 22;
    const dust = Math.max(3, Math.floor(base * this.stats.greed));
    const data = {
      score: Math.floor(this.score),
      wave: this.wave,
      kills: this.kills,
      time: this.runTime,
      maxCombo: this.maxCombo,
      grazes: this.grazes,
      level: this.level,
      weapon: this.weapon.name,
      weaponId: this.weaponId,
      dust,
      seed: this.seed,
      bosses: this.bossesKilled,
      upgrades: { ...this.upgrades },
      line: DEATH_LINES[Math.floor(Math.random() * DEATH_LINES.length)],
    };
    data.isBest = this.save.recordRun({
      score: data.score, wave: data.wave, kills: data.kills, time: data.time,
      maxCombo: data.maxCombo, seed: data.seed, weapon: data.weaponId, dust,
    });
    this.el.hud.classList.remove('on');
    this.ui?.setTouchControls?.(false);
    this.ui?.showGameOver?.(data);
    this.audio.setIntensity(0);
    this.audio.setDanger(0);
  }

  die() {
    if (this.state !== 'running') return;
    const p = this.player;
    p.dead = true;
    p.hp = 0;
    this.state = 'dying';
    this.deathT = 1.5;
    this.slowT = 1.3;
    this.slowFactor = 0.16;
    this.shakeIt(26);
    this.flash('#ff8a9d', 0.55);
    for (let i = 0; i < 70; i++) {
      const a = rand(0, TAU), sp = rand(40, 440);
      this.addGlow(p.x, p.y, pick([COLORS.cyan, COLORS.gold, '#ffffff']),
        Math.cos(a) * sp, Math.sin(a) * sp, rand(0.6, 1.7), rand(2, 6));
    }
    this.ringFx(p.x, p.y, 8, 280, 1.4, COLORS.cyan, 3);
    this.audio.gameover();
  }

  xpNeeded(level) {
    return Math.floor(7 + level * 4.5 + Math.pow(level, 1.3) * 1.1);
  }

  waveIntensity() {
    const hpFrac = this.player ? this.player.hp / Math.max(1, this.player.maxHp) : 1;
    return clamp(0.24 + this.wave * 0.028 + (this.bossActive ? 0.24 : 0) + (hpFrac < 0.4 ? 0.14 : 0), 0.1, 1);
  }

  // ============================================================
  // loop
  // ============================================================
  loop(ts) {
    const rawDt = Math.min(0.042, Math.max(0.0001, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    this.time += rawDt;

    if (this.state === 'running') {
      this.runTime += rawDt;
      this.perfT += rawDt;
      this.perfFrames++;
      if (this.perfT > 2.6) {
        const fps = this.perfFrames / this.perfT;
        if (fps < 47 && this.renderScale > 0.6 && !document.hidden) {
          this.renderScale = Math.max(0.6, this.renderScale - 0.2);
          this.applyCanvasSize();
        }
        this.perfT = 0;
        this.perfFrames = 0;
      }
      if (this.slowT > 0) {
        this.slowT -= rawDt;
        this.timeScale = this.slowFactor;
      } else {
        this.timeScale += (1 - this.timeScale) * Math.min(1, rawDt * 9);
        if (this.timeScale > 0.995) this.timeScale = 1;
      }
      this.update(rawDt * this.timeScale, rawDt);
      if (this.controlHintT > 0) {
        this.controlHintT -= rawDt;
        if (this.controlHintT <= 0) this.el.controlHint.classList.remove('on');
      }
      this.updateAudioState();
    } else if (this.state === 'dying') {
      this.deathT -= rawDt;
      this.updateDeath(rawDt);
      if (this.deathT <= 0) this.finishRun();
    } else if (this.state === 'menu' || this.state === 'dead') {
      this.updateFireflies(rawDt);
    }
    this.render(rawDt);
    requestAnimationFrame(t => this.loop(t));
  }

  update(realDt, rawDt) {
    this.updateShake(rawDt);
    this.flashA = Math.max(0, this.flashA - rawDt * 2.2);
    this.updateWaves(realDt);
    this.updatePlayer(realDt);
    this.updateEnemies(realDt);
    this.updateBullets(realDt);
    this.updateMotes(realDt);
    this.updateZones(realDt);
    this.updateParticles(realDt);
    if (this.comboT > 0) {
      this.comboT -= realDt;
      if (this.comboT <= 0) { this.combo = 0; this.comboT = 0; }
    }
    this.comboMul = 1 + Math.min(this.combo * 0.04, 3);
    this.updateHud();
  }

  updateAudioState() {
    const p = this.player;
    const danger = clamp((1 - p.hp / Math.max(1, p.maxHp)) * 0.66 + (this.bossActive ? 0.24 : 0) + (p.hp <= 1 ? 0.18 : 0), 0, 1);
    if (Math.abs(danger - this.lastDanger) > 0.07) {
      this.lastDanger = danger;
      this.audio.setDanger(danger);
    }
    const inten = this.waveIntensity();
    if (Math.abs(inten - this.lastIntensity) > 0.05) {
      this.lastIntensity = inten;
      this.audio.setIntensity(inten);
    }
    document.body.classList.toggle('cursor-firing', !!(this.mouse.down || this.touch.aimId !== null));
  }

  updateDeath(rawDt) {
    const dt = rawDt * this.timeScale;
    this.timeScale += (0.5 - this.timeScale) * Math.min(1, rawDt * 2);
    this.updateParticles(dt);
    this.updateShake(rawDt);
    this.flashA = Math.max(0, this.flashA - rawDt * 1.4);
    if (this.el.danger) this.el.danger.style.opacity = 0;
    this.updateFireflies(rawDt);
  }

  updateFireflies(dt) {
    if (!this.fireflies) this.fireflies = [];
    if (this.fireflies.length < 24 && Math.random() < dt * 3) {
      this.fireflies.push({
        x: rand(0, this.W), y: rand(0, this.H), vx: rand(-7, 7), vy: rand(-12, -3),
        life: rand(5, 12), r: rand(1, 2.4), hue: rand(0, TAU),
      });
    }
    for (const f of this.fireflies) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      if (f.life <= 0 || f.y < -20) {
        f.x = rand(0, this.W); f.y = this.H + 10;
        f.vx = rand(-7, 7); f.vy = rand(-12, -3); f.life = rand(5, 12);
      }
    }
  }

  updateShake(dt) {
    if (this.shake > 0.05) this.shake *= Math.exp(-7 * dt);
    else this.shake = 0;
  }

  shakeIt(amount) {
    if (!this.save.settings.shake) return;
    this.shake = Math.min(30, Math.max(this.shake, amount));
  }

  flash(color, alpha) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, alpha);
  }
}

Object.assign(Game.prototype, flowMethods, combatMethods, drawMethods);
