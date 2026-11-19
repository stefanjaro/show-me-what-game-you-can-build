/* POLARIS — core game: state machine, player, director, collisions, progression */

import { TAU, clamp, lerp, rand, chance, angleTo, weightedPick, shuffle, formatTime } from './util.js';
import {
  COLORS, POLARITY_COLOR, WORLD, BAL, ENEMIES, ELITE, BOSSES, BOSS_DEFS,
  CARDS, RARITY_W, META, metaCost, SPAWN_SCHEDULE, SAVE_KEY, defaultSave,
} from './data.js';
import { FX } from './fx.js';
import { Bullet, Enemy, Boss, Pickup } from './actors.js';
import { initWeaponState, updateWeapons, drawWeapons, gunStats } from './weapons.js';
import { renderGame, renderMenu } from './render.js';

const STEP = 1 / 60;

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      const def = defaultSave();
      return { ...def, ...data, meta: { ...def.meta, ...(data.meta || {}) }, best: { ...def.best, ...(data.best || {}) }, gifts: data.gifts || {} };
    }
  } catch (e) { /* private mode */ }
  return defaultSave();
}
function persist(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

export class Game {
  constructor(canvas, audio, ui) {
    this.canvas = canvas;
    this.audio = audio;
    this.ui = ui;
    this.save = loadSave();
    this.fx = new FX();
    this.state = 'menu';
    this.world = WORLD;
    this.view = { w: 1280, h: 720 };
    this.cam = { x: WORLD.w / 2, y: WORLD.h / 2 };
    this.trauma = 0;
    this.hitstop = 0;
    this.slowT = 0; this.slowScale = 1;
    this.acc = 0;
    this.t = 0;
    this.ambientT = 0;
    this.input = { up: false, down: false, left: false, right: false, mx: 640, my: 360 };
    this.shieldSfxT = 0;
    this.xpSfxT = 0;
    this.intensityT = 0;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.missiles = [];
    this.boss = null;
    this.bossIdx = 0;
    this.spawnT = 0.9;
    this.batchT = 4;
    this.batchPol = 0;
    this.pendingLevels = 0;
    this.cards = [];
    this.combo = 1;
    this.comboT = 0;
    this.score = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = BAL.xpNeed(1);
    this.shakeX = 0; this.shakeY = 0;
    this.victoryT = -1;
    this.bossBannerT = 0;
    this._shieldCd = 0;
  }

  /* ==================== lifecycle ==================== */

  startRun() {
    const s = this.save;
    const m = s.meta, g = s.gifts;
    const mods = {};
    if (g.ember) mods.orbit = (mods.orbit || 0) + 1;
    if (g.ripple) mods.pulse = (mods.pulse || 0) + 1;
    if (g.prismcore) mods.spread = (mods.spread || 0) + 1;

    const maxHp = BAL.player.hp + 14 * (m.hp || 0);
    this.player = {
      x: WORLD.w / 2, y: WORLD.h / 2, vx: 0, vy: 0,
      r: BAL.player.radius,
      hp: maxHp, maxHp,
      speed: BAL.player.speed * (1 + 0.04 * (m.spd || 0)) * (g.wings ? 1.12 : 1),
      dashCdBase: BAL.player.dashCd * Math.pow(0.93, m.dash || 0),
      polarity: 0,
      aimAngle: 0,
      iframe: 0, hitFlash: 0,
      dashT: 0, dashCd: 0, dashAng: 0,
      switchCd: 0, driftCd: 0,
      nova: 0,
      magnetRadius: 120 * (1 + 0.18 * (m.magnet || 0)) * (1 + 0.5 * (mods.magnet || 0)),
      mods,
      afterimages: [],
      moveX: 0, moveY: 0,
      lastHurtT: 0,
    };
    initWeaponState(this.player);

    this.enemies.length = 0;
    this.bullets.length = 0;
    this.pickups.length = 0;
    this.missiles.length = 0;
    this.boss = null;
    this.bossIdx = 0;
    this.spawnT = 0.9;
    this.batchT = 4;
    this.batchPol = chance(0.5) ? 0 : 1;
    this.t = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 1;
    this.comboT = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNeed = BAL.xpNeed(1);
    this.pendingLevels = 0;
    this.cards = [];
    this.trauma = 0;
    this.hitstop = 0;
    this.slowT = 0; this.slowScale = 1;
    this.victoryT = -1;
    this.cam.x = this.player.x;
    this.cam.y = this.player.y;
    this.fx.clear();
    this.state = 'playing';
    this.save.runs = (this.save.runs || 0) + 1;
    this.save.seenHowto = true;
    persist(this.save);
    this.audio.startMusic();
    this.audio.setBoss(false);
    this.ui.hideAllScreens();
    this.ui.banner('HOLD THE LIGHT', 1.6);
  }

  endRun(win, abandoned = false) {
    if (this.state === 'dead' || this.state === 'victory') return;
    const time = this.t;
    const stardust = abandoned ? Math.floor(Math.sqrt(this.score) * 0.45)
      : Math.floor(Math.sqrt(this.score) * 1.2) + this.bossesKilled * 20 + Math.floor(time / 15) + (win ? 200 : 0);
    this.save.stardust += stardust;
    this.save.best.score = Math.max(this.save.best.score || 0, Math.floor(this.score));
    this.save.best.time = Math.max(this.save.best.time || 0, time);
    this.save.best.kills = Math.max(this.save.best.kills || 0, this.kills);
    if (win) { this.save.wins = (this.save.wins || 0) + 1; this.save.best.wins = (this.save.best.wins || 0) + 1; }
    persist(this.save);

    if (win) {
      this.state = 'victory';
      this.audio.stopMusic(2);
      this.audio.victory();
      this.fx.flash('#fff', 0.7, 1.2);
      this.ui.showVictory(this, stardust);
    } else {
      this.state = 'dead';
      this.audio.stopMusic(1.4);
      if (!abandoned) this.audio.death();
      const p = this.player;
      this.fx.burst(p.x, p.y, 60, '#fff', { speed: 520, life: 1.3, size: 6 });
      this.fx.burst(p.x, p.y, 40, COLORS.crimson, { speed: 380, life: 1.1, size: 5 });
      this.fx.burst(p.x, p.y, 30, COLORS.cyan, { speed: 380, life: 1.1, size: 5 });
      this.fx.ring(p.x, p.y, 460, '#fff', 1, 6);
      this.fx.flash('#fff', 0.55, 0.8);
      this.trauma = 1;
      if (!abandoned) this.ui.showEnd(this, stardust);
      else this.ui.showTitle();
    }
    this.audio.setBoss(false);
    this.audio.setMuffle(false);
    this.ui.refreshMeta(this);
  }

  get bossesKilled() { return this.bossIdx - (this.boss && !this.boss.dead ? 1 : 0); }

  /* ==================== input / flow ==================== */

  press(action, arg) {
    const st = this.state;
    if (action === 'mute') {
      this.save.muted = !this.save.muted;
      this.audio.setMuted(this.save.muted);
      persist(this.save);
      return;
    }
    if (st === 'menu') {
      if (action === 'confirm') this.ui.requestStart();
      return;
    }
    if (st === 'playing') {
      switch (action) {
        case 'dash': this.tryDash(); break;
        case 'switch': this.switchPolarity(); break;
        case 'nova': this.tryNova(); break;
        case 'pause': this.setState('paused'); break;
      }
      return;
    }
    if (st === 'levelup') {
      if (action === 'card') this.pickCard(arg);
      return;
    }
    if (st === 'paused') {
      if (action === 'pause' || action === 'resume' || action === 'confirm') this.setState('playing');
      if (action === 'quit') this.endRun(false, true);
      return;
    }
    if (st === 'dead' || st === 'victory') {
      if (action === 'confirm') this.startRun();
      return;
    }
  }

  setState(s) {
    const prev = this.state;
    this.state = s;
    if (s === 'paused') {
      this.ui.showPause(this);
      this.audio.setMuffle(true);
      this.audio.ui('click');
    } else if (s === 'playing') {
      this.ui.hidePause();
      if (prev === 'paused') this.audio.setMuffle(false);
      this.audio.ui('click');
    }
  }

  /* ==================== player actions ==================== */

  tryDash() {
    const p = this.player;
    if (!p || p.dashT > 0 || p.dashCd > 0) return;
    let ax = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    let ay = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    if (ax === 0 && ay === 0) { ax = Math.cos(p.aimAngle); ay = Math.sin(p.aimAngle); }
    const l = Math.hypot(ax, ay) || 1;
    p.dashAng = Math.atan2(ay / l, ax / l);
    p.dashT = BAL.player.dashTime;
    p.dashCd = p.dashCdBase * (1 - 0.13 * (p.mods.quickstep || 0));
    p.iframe = BAL.player.dashIFrames + 0.08 * (p.mods.phase || 0);
    this.audio.dash();
    this.fx.burst(p.x, p.y, 10, POLARITY_COLOR[p.polarity], { speed: 260, life: 0.35, size: 3, angle: p.dashAng + Math.PI, spread: 1.5 });
    this.fx.ring(p.x, p.y, 60, POLARITY_COLOR[p.polarity], 0.3, 3);
    p.afterimages.push({ x: p.x, y: p.y, life: 0.34, max: 0.34, ang: p.aimAngle, pol: p.polarity });
    if (p.mods.evo_rift) {
      p.weps.rifts.push({ x: p.x, y: p.y, r: 44, life: 1.5, max: 1.5 });
    }
  }

  switchPolarity() {
    const p = this.player;
    if (!p || p.switchCd > 0) return;
    p.polarity ^= 1;
    p.switchCd = 0.12;
    const col = POLARITY_COLOR[p.polarity];
    this.fx.ring(p.x, p.y, 96, col, 0.4, 4);
    this.fx.burst(p.x, p.y, 12, col, { speed: 300, life: 0.4, size: 3.2 });
    this.audio.switchPol();
    if (p.mods.poldrift && p.driftCd <= 0) {
      p.driftCd = 2.5;
      const dmg = 46 * (1 + 0.05 * (this.save.meta.dmg || 0));
      const R = 200;
      this.fx.ring(p.x, p.y, R, '#fff', 0.42, 6);
      this.fx.ring(p.x, p.y, R * 0.8, col, 0.5, 4);
      this.shake(6);
      for (const e of this.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < R + e.r) {
          e.hurt(dmg, this, e.x, e.y, { knock: 320 });
          this.fx.hitSparks(e.x, e.y, col, angleTo(p.x, p.y, e.x, e.y), 5);
        }
      }
      if (this.boss && !this.boss.dead && this.boss.state === 'fight') {
        for (const hb of this.boss.hitboxes()) {
          if (Math.hypot(hb.x - p.x, hb.y - p.y) < R + hb.r) this.boss.hurt(dmg, this, hb.x, hb.y, {});
        }
      }
      this.audio.nova();
    }
  }

  tryNova() {
    const p = this.player;
    if (!p) return;
    if (p.nova < BAL.player.novaMax) {
      if (this._shieldCd <= 0) {
        this._shieldCd = 0.5;
        this.fx.text(p.x, p.y - 40, 'NOVA NOT READY', { color: '#8b90b8', size: 14, life: 0.6 });
        this.audio.deny();
      }
      return;
    }
    const m = p.mods;
    const novaRank = m.novacore || 0;
    p.nova = 0;
    const R = 540 * (1 + 0.12 * novaRank);
    const dmg = 300 * (1 + 0.38 * novaRank) * (1 + 0.05 * (this.save.meta.dmg || 0));
    const col = POLARITY_COLOR[p.polarity];

    this.audio.nova();
    this.fx.flash('#fff', 0.85, 0.55);
    this.fx.ring(p.x, p.y, R, '#fff', 0.7, 8);
    this.fx.ring(p.x, p.y, R * 0.85, col, 0.85, 6);
    this.fx.ring(p.x, p.y, R * 0.6, COLORS.gold, 1, 4);
    this.fx.burst(p.x, p.y, 70, '#fff', { speed: 900, life: 0.9, size: 5 });
    this.fx.burst(p.x, p.y, 50, col, { speed: 620, life: 1.1, size: 5 });
    this.shake(1.6);
    this.hitstop = 0.16;
    this.slowT = 0.5; this.slowScale = 0.26;

    for (const e of this.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < R + e.r) {
        const fall = 1 - 0.45 * clamp(d / R, 0, 1);
        e.hurt(dmg * fall, this, e.x, e.y, { knock: 900 * fall });
        e.x += (e.x - p.x) / (d || 1) * 26 * fall;
        e.y += (e.y - p.y) / (d || 1) * 26 * fall;
      }
    }
    if (this.boss && !this.boss.dead && this.boss.state === 'fight') {
      for (const hb of this.boss.hitboxes()) {
        const d = Math.hypot(hb.x - p.x, hb.y - p.y);
        if (d < R + hb.r) this.boss.hurt(dmg, this, hb.x, hb.y, {});
      }
    }
    /* clear enemy bullets */
    for (const b of this.bullets) {
      if (b.friendly || b.dead) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < R) {
        b.dead = true;
        this.fx.burst(b.x, b.y, 4, b.color, { speed: 200, life: 0.4, size: 2.6 });
      }
    }
  }

  /* ==================== damage helpers ==================== */

  hurtPlayer(dmg, sx, sy) {
    const p = this.player;
    if (!p || p.iframe > 0 || this.state !== 'playing') return;
    dmg *= Math.pow(0.89, p.mods.aegis || 0);
    p.hp -= dmg;
    p.iframe = BAL.player.hitIFrames;
    p.hitFlash = 0.55;
    p.lastHurtT = 0.4;
    this.trauma = Math.min(1, this.trauma + 0.55);
    this.combo = 1;
    this.comboT = 0;
    this.audio.hurt();
    this.fx.flash(COLORS.crimson, 0.24, 0.32);
    this.fx.text(p.x, p.y - 30, `-${Math.round(dmg)}`, { color: COLORS.crimson, size: 20, life: 0.8 });
    this.fx.burst(p.x, p.y, 12, COLORS.crimson, { speed: 300, life: 0.4, size: 3.4 });
    if (sx !== undefined) {
      const a = angleTo(sx, sy, p.x, p.y);
      p.vx += Math.cos(a) * 300;
      p.vy += Math.sin(a) * 300;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun(false);
    }
  }

  absorbBullet(b) {
    const p = this.player;
    const m = p.mods;
    let gain = 3.4 * (1 + 0.32 * (m.hungry || 0)) * (1 + 0.09 * (this.save.meta.reson || 0));
    if (m.evo_dawn) gain *= 2;
    p.nova = Math.min(BAL.player.novaMax, p.nova + gain);
    this.audio.absorb();
    this.fx.burst(b.x, b.y, 6, b.color, { speed: 190, life: 0.34, size: 2.8 });
    this.fx.ring(b.x, b.y, 30, b.color, 0.28, 2);
    this.score += 2;

    /* mirror: fire it back */
    if (m.mirror) {
      const a = angleTo(b.x, b.y, p.x, p.y); // outgoing back along incoming
      const ang = Math.atan2(-b.vy, -b.vx);
      this.spawnPlayerBullet(b.x, b.y, ang, { speed: 700, dmg: b.dmg * 1.2 * 0.6, r: 5, life: 1.6 });
    }
    /* devour: chain lightning */
    if (m.devour) {
      this.chainFrom(b.x, b.y, 22 + 8 * m.devour, new Set(), 1 + (m.devour >= 2 ? 1 : 0));
    }
    /* dawn: burn nearby */
    if (m.evo_dawn) {
      for (const e of this.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 150 + e.r) {
          e.hurt(24, this, e.x, e.y, { burn: 14 });
        }
      }
      this.fx.ring(p.x, p.y, 150, COLORS.gold, 0.4, 3);
    }
  }

  chainFrom(x, y, dmg, visited, hops) {
    let cx = x, cy = y;
    for (let i = 0; i < hops; i++) {
      let best = null, bestD = 190 * 190;
      for (const e of this.enemies) {
        if (e.dead || e.state === 'spawn' || visited.has(e.id)) continue;
        if (e.polarity === this.player.polarity) continue;
        const d2 = (e.x - cx) ** 2 + (e.y - cy) ** 2;
        if (d2 < bestD) { bestD = d2; best = e; }
      }
      if (!best) return;
      visited.add(best.id);
      this.fx.line(cx, cy, best.x, best.y, COLORS.cyan, 0.16, 3);
      best.hurt(dmg, this, best.x, best.y, { polarity: this.player.polarity });
      this.fx.hitSparks(best.x, best.y, COLORS.cyan, 0, 4);
      cx = best.x; cy = best.y;
    }
  }

  explode(x, y, r, dmg, polarity, hurtsPlayer) {
    this.fx.ring(x, y, r, '#ffb347', 0.5, 6);
    this.fx.burst(x, y, 26, '#ffb347', { speed: 520, life: 0.6, size: 4.5 });
    this.fx.burst(x, y, 10, '#fff', { speed: 340, life: 0.35, size: 3.5 });
    this.shake(0.5);
    this.audio.kill(true);
    for (const e of this.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < r + e.r) {
        const fall = 1 - 0.5 * clamp(d / r, 0, 1);
        e.hurt(dmg * fall, this, e.x, e.y, { knock: 420 * fall });
      }
    }
    if (hurtsPlayer) {
      const p = this.player;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r + p.r) {
        const fall = 1 - 0.5 * clamp(d / r, 0, 1);
        this.hurtPlayer(dmg * fall, x, y);
      }
    }
  }

  explodeMissile(ms) {
    const p = this.player;
    this.fx.ring(ms.x, ms.y, ms.blast, '#ffb347', 0.42, 5);
    this.fx.burst(ms.x, ms.y, 18, '#ffb347', { speed: 420, life: 0.5, size: 4 });
    this.fx.burst(ms.x, ms.y, 6, '#fff', { speed: 300, life: 0.3, size: 3 });
    this.shake(0.28);
    this.audio.kill(false);
    for (const e of this.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const d = Math.hypot(e.x - ms.x, e.y - ms.y);
      if (d < ms.blast + e.r && e.polarity !== p.polarity) {
        const fall = 1 - 0.4 * clamp(d / ms.blast, 0, 1);
        e.hurt(ms.dmg * fall, this, e.x, e.y, { knock: 380 * fall });
      }
    }
    if (this.boss && !this.boss.dead && this.boss.state === 'fight') {
      for (const hb of this.boss.hitboxes()) {
        if (Math.hypot(hb.x - ms.x, hb.y - ms.y) < ms.blast + hb.r) {
          this.boss.hurt(ms.dmg, this, hb.x, hb.y, { polarity: p.polarity });
        }
      }
    }
  }

  /* ==================== spawning ==================== */

  spawnPlayerBullet(x, y, a, o = {}) {
    this.bullets.push(new Bullet({
      x, y,
      vx: Math.cos(a) * (o.speed || 700),
      vy: Math.sin(a) * (o.speed || 700),
      dmg: o.dmg || 10,
      r: o.r || 5,
      friendly: true,
      polarity: this.player.polarity,
      pierce: o.pierce || 0,
      homing: o.homing || 0,
      chain: o.chain || 0,
      life: o.life || 2,
      knock: o.knock || 0,
    }));
  }

  spawnEnemyBullet(x, y, a, speed, dmg, r, polarity, o = {}) {
    const b = new Bullet({
      x, y,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg, r, friendly: false, polarity,
      homing: o.homing || 0, life: o.life || 4,
      kind: 'enemy',
    });
    this.bullets.push(b);
    return b;
  }

  spawnPos() {
    const p = this.player;
    const viewR = Math.hypot(this.view.w, this.view.h) / 2;
    const want = clamp(viewR * 0.66, 430, 740);
    for (let i = 0; i < 14; i++) {
      /* bias: most spawns appear ahead of the crosshair */
      const a = chance(0.62) ? p.aimAngle + rand(-1.5, 1.5) : rand(TAU);
      const d = want * rand(0.94, 1.2);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (x > 70 && y > 70 && x < WORLD.w - 70 && y < WORLD.h - 70) {
        if ((x - p.x) ** 2 + (y - p.y) ** 2 > 340 * 340) return { x, y };
      }
    }
    /* fallback: clamp at edge */
    const a = chance(0.62) ? p.aimAngle + rand(-1.5, 1.5) : rand(TAU);
    return {
      x: clamp(p.x + Math.cos(a) * want, 80, WORLD.w - 80),
      y: clamp(p.y + Math.sin(a) * want, 80, WORLD.h - 80),
    };
  }

  trySpawn() {
    if (this.enemies.length >= BAL.director.maxAlive(this.t)) return;
    const avail = SPAWN_SCHEDULE.filter(s => s.t <= this.t);
    if (!avail.length) return;
    const items = avail.map(s => ({ type: s.type, w: ENEMIES[s.type].w }));
    const pickItem = weightedPick(items);
    if (!pickItem) return;
    const type = pickItem.type;
    const pos = this.spawnPos();
    const elite = chance(BAL.director.eliteChance(this.t));
    const pol = chance(0.65) ? this.batchPol : (chance(0.5) ? 0 : 1);
    const e = new Enemy(type, pos.x, pos.y, { elite, polarity: pol });
    this.enemies.push(e);

    if (type === 'swarm') {
      const n = 3 + (rand(3) | 0);
      for (let i = 0; i < n; i++) {
        const a = rand(TAU), d = rand(30, 110);
        const x = clamp(pos.x + Math.cos(a) * d, 60, WORLD.w - 60);
        const y = clamp(pos.y + Math.sin(a) * d, 60, WORLD.h - 60);
        this.enemies.push(new Enemy('swarm', x, y, { polarity: pol, spawnDelay: rand(0.5, 0.95) }));
      }
    }
    if (elite) {
      this.fx.ring(pos.x, pos.y, 90, POLARITY_COLOR[pol], 0.7, 4);
    }
  }

  updateDirector(dt) {
    /* boss trigger */
    if (this.bossIdx < BOSSES.length && !this.boss && this.t >= BOSSES[this.bossIdx].t) {
      const def = BOSSES[this.bossIdx];
      const bd = BOSS_DEFS[def.id];
      const p = this.player;
      const a = angleTo(p.x, p.y, WORLD.w / 2, WORLD.h / 2) + Math.PI;
      const bx = clamp(p.x + Math.cos(a) * 520, 200, WORLD.w - 200);
      const by = clamp(p.y + Math.sin(a) * 420, 200, WORLD.h - 200);
      this.boss = new Boss(def.id, bx, by);
      this.boss.name = def.name;
      this.boss.sub = def.sub;
      this.bossIdx++;
      this.audio.bossRoar();
      this.audio.setBoss(true);
      this.ui.banner(def.name, 2.2, true);
      this.ui.toast(def.sub, 'crimson');
      this.trauma = Math.min(1, this.trauma + 0.7);
      this.fx.flash(COLORS.crimson, 0.3, 0.6);
      this.fx.ring(bx, by, 300, COLORS.crimson, 1.2, 6);
      this.slowT = 0.6; this.slowScale = 0.4;
    }

    /* batch polarity drift */
    this.batchT -= dt;
    if (this.batchT <= 0) {
      this.batchT = rand(5, 8.5);
      this.batchPol = chance(0.5) ? 0 : 1;
    }

    const mul = this.boss && !this.boss.dead ? BAL.director.bossSpawnMul : 1;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = BAL.director.spawnInterval(this.t) / mul;
      this.trySpawn();
      if (this.t > 240 && chance(0.25)) this.trySpawn();
    }
  }

  /* ==================== kills / pickups ==================== */

  comboMult() {
    return 1 + Math.min(this.combo - 1, 18) * 0.22;
  }

  onEnemyKilled(e, opts = {}) {
    this.kills++;
    this.combo = Math.min(this.combo + 1, 99);
    this.comboT = BAL.comboWindow;
    this.score += e.score * this.comboMult();
    const p = this.player;
    p.nova = Math.min(BAL.player.novaMax, p.nova + 0.5);

    /* drops */
    const orbs = Math.min(e.xp, 6);
    const val = e.xp / orbs;
    for (let i = 0; i < orbs; i++) {
      const a = rand(TAU), d = rand(4, 26);
      this.pickups.push(new Pickup(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, 'xp', val));
    }
    if (chance(e.elite ? 0.14 : 0.022)) {
      this.pickups.push(new Pickup(e.x, e.y, 'hp', 18));
    }

    const big = e.elite || e.type === 'tank' || e.type === 'spawner';
    this.fx.killBurst(e.x, e.y, POLARITY_COLOR[e.polarity], big);
    this.fx.burst(e.x, e.y, big ? 8 : 4, '#fff', { speed: 200, life: 0.3, size: 2.4 });
    this.audio.kill(big);
    if (big) {
      this.hitstop = Math.max(this.hitstop, e.elite ? 0.07 : 0.045);
      this.trauma = Math.min(1, this.trauma + (e.elite ? 0.3 : 0.18));
      this.fx.text(e.x, e.y - e.r - 12, `+${Math.round(e.score * this.comboMult())}`, { color: COLORS.gold, size: 15, life: 0.7 });
    } else {
      this.trauma = Math.min(1, this.trauma + 0.08);
    }
  }

  onBossKilled(b) {
    this.score += b.score * this.comboMult();
    this.kills++;
    this.trauma = 1;
    this.hitstop = 0.5;
    this.slowT = 0.9; this.slowScale = 0.32;
    this.audio.bossDie();
    this.audio.setBoss(false);
    this.fx.flash('#fff', 0.55, 0.9);
    this.fx.ring(b.x, b.y, 520, '#fff', 1.1, 8);
    this.fx.ring(b.x, b.y, 420, COLORS.gold, 1.4, 5);
    this.fx.burst(b.x, b.y, 80, POLARITY_COLOR[b.polarity], { speed: 800, life: 1.4, size: 6 });
    this.fx.burst(b.x, b.y, 40, '#fff', { speed: 560, life: 1, size: 5 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      this.pickups.push(new Pickup(b.x + Math.cos(a) * 40, b.y + Math.sin(a) * 40, 'xp', b.xp / 14));
    }
    if (chance(0.85)) this.pickups.push(new Pickup(b.x, b.y, 'hp', 30));
    this.ui.banner('HERALD FALLS', 1.8, true);
    this.ui.toast(`+${b.score} resonance`, 'gold');
    if (b.id === 'voidheart') {
      this.victoryT = 1.7;
    } else {
      this.boss = null;
      this.fx.text(b.x, b.y, '✦', { color: COLORS.gold, size: 40, life: 1.4 });
    }
  }

  gainXp(v) {
    v *= (1 + 0.13 * (this.player.mods.fortune || 0)) * (1 + 0.07 * (this.save.meta.fortune || 0));
    this.xp += v;
    while (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.level++;
      this.xpNeed = BAL.xpNeed(this.level);
      this.pendingLevels++;
    }
    if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();
  }

  collect(pk) {
    if (pk.kind === 'xp') {
      this.gainXp(pk.value);
      this.xpSfxT -= 1;
      if (this.xpSfxT <= 0) { this.xpSfxT = 7; this.audio.absorb(); }
      this.fx.burst(pk.x, pk.y, 3, COLORS.xp, { speed: 120, life: 0.3, size: 2.4 });
    } else {
      const p = this.player;
      p.hp = Math.min(p.maxHp, p.hp + pk.value);
      this.audio.level();
      this.fx.text(p.x, p.y - 36, `+${pk.value} ♥`, { color: COLORS.hp, size: 20, life: 0.9 });
      this.fx.ring(pk.x, pk.y, 70, COLORS.hp, 0.5, 4);
    }
  }

  /* ==================== cards ==================== */

  rollCards() {
    const m = this.player.mods;
    const pool = CARDS.filter(c => (m[c.id] || 0) < c.max && (!c.req || Object.entries(c.req).every(([k, v]) => (m[k] || 0) >= v)));
    if (!pool.length) return [];
    const evos = pool.filter(c => c.rarity === 'legendary');
    const normal = pool.filter(c => c.rarity !== 'legendary');
    const out = [];
    if (evos.length && chance(0.6)) {
      out.push(evos[(rand(evos.length)) | 0]);
    }
    const bag = normal.slice();
    while (out.length < 3 && bag.length) {
      const items = bag.map(c => ({ c, w: RARITY_W[c.rarity] || 10 }));
      const pickI = weightedPick(items);
      out.push(pickI.c);
      bag.splice(bag.indexOf(pickI.c), 1);
    }
    if (!out.length && evos.length) out.push(evos[0]);
    return shuffle(out);
  }

  openLevelUp() {
    this.state = 'levelup';
    this.cards = this.rollCards();
    this.audio.setMuffle(true);
    this.audio.level();
    this.fx.ring(this.player.x, this.player.y, 180, COLORS.gold, 0.7, 5);
    this.fx.burst(this.player.x, this.player.y, 24, COLORS.gold, { speed: 320, life: 0.8, size: 4 });
    this.ui.showCards(this, this.cards);
  }

  pickCard(idx) {
    if (this.state !== 'levelup') return;
    const card = this.cards[idx];
    if (!card) return;
    const p = this.player;
    const m = p.mods;
    for (const [k, v] of Object.entries(card.mods)) m[k] = (m[k] || 0) + v;
    if (card.id === 'vigor') {
      p.maxHp += 16;
      p.hp = Math.min(p.maxHp, p.hp + 16);
    }
    p.hp = Math.min(p.maxHp, p.hp + BAL.levelHeal + 9 * (m.starlight || 0));
    this.audio.cardPick();
    this.fx.burst(p.x, p.y, 20, card.rarity === 'legendary' ? COLORS.gold : COLORS.cyan, { speed: 340, life: 0.7, size: 4 });
    this.fx.text(p.x, p.y - 50, card.name, { color: card.rarity === 'legendary' ? COLORS.gold : '#fff', size: 22, life: 1.1 });
    if (card.rarity === 'legendary') {
      this.fx.flash(COLORS.gold, 0.35, 0.6);
      this.trauma = Math.min(1, this.trauma + 0.5);
      this.ui.toast(`EVOLUTION — ${card.name}`, 'gold');
    }
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.cards = this.rollCards();
      this.ui.showCards(this, this.cards);
    } else {
      this.ui.hideCards();
      this.state = 'playing';
      this.audio.setMuffle(false);
    }
  }

  /* ==================== frame / step ==================== */

  frame(dt) {
    this.ambientT += dt;
    const st = this.state;
    if (st === 'playing') {
      if (this.hitstop > 0) {
        this.hitstop -= dt;
      } else {
        const scale = this.slowT > 0 ? this.slowScale : 1;
        if (this.slowT > 0) this.slowT -= dt;
        this.acc += dt * scale;
        let n = 0;
        while (this.acc >= STEP && n < 5) { this.step(STEP); this.acc -= STEP; n++; }
        if (this.acc > STEP * 5) this.acc = 0;
      }
      this.updateCamera(dt, true);
    } else if (st === 'levelup' || st === 'paused') {
      /* frozen world */
      this.updateCamera(dt, false);
    } else {
      /* menu / dead / victory: fx only */
      this.fx.update(dt);
      if (st === 'dead' || st === 'victory') {
        this.updateCamera(dt, false);
        if (this.victoryT > 0) {
          this.victoryT -= dt;
          if (this.victoryT <= 0) { this.victoryT = -1; this.endRun(true); }
        }
      } else {
        this.trauma = Math.max(0, this.trauma - dt * 1.6);
      }
    }
    if (this.shieldCd > 0) this.shieldCd -= dt;
    if (this._shieldCd > 0) this._shieldCd -= dt;
    this.computeShake(dt);
  }

  step(dt) {
    const p = this.player;
    this.t += dt;

    /* victory trigger while boss death fx plays */
    if (this.victoryT > 0) {
      this.victoryT -= dt;
      if (this.victoryT <= 0) { this.victoryT = -1; this.endRun(true); return; }
    }

    /* timers */
    if (p.iframe > 0) p.iframe -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.switchCd > 0) p.switchCd -= dt;
    if (p.driftCd > 0) p.driftCd -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.lastHurtT > 0) p.lastHurtT -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 1;
    }

    /* ---- movement ---- */
    const ix = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const iy = (this.input.down ? 1 : 0) - (this.input.up ? 1 : 0);
    const il = Math.hypot(ix, iy);
    p.moveX = il > 0 ? ix / il : 0;
    p.moveY = il > 0 ? iy / il : 0;

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = Math.cos(p.dashAng) * BAL.player.dashSpeed;
      p.vy = Math.sin(p.dashAng) * BAL.player.dashSpeed;
      if (chance(dt * 40)) {
        p.afterimages.push({ x: p.x, y: p.y, life: 0.3, max: 0.3, ang: p.aimAngle, pol: p.polarity });
      }
      if (p.mods.evo_rift && chance(dt * 30)) {
        p.weps.rifts.push({ x: p.x, y: p.y, r: 44, life: 1.5, max: 1.5 });
      }
    } else {
      const tx = p.moveX * p.speed;
      const ty = p.moveY * p.speed;
      const k = 1 - Math.pow(0.000045, dt);
      p.vx += (tx - p.vx) * k;
      p.vy += (ty - p.vy) * k;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const pad = p.r + 6;
    if (p.x < pad) { p.x = pad; p.vx = Math.max(0, p.vx); }
    if (p.y < pad) { p.y = pad; p.vy = Math.max(0, p.vy); }
    if (p.x > WORLD.w - pad) { p.x = WORLD.w - pad; p.vx = Math.min(0, p.vx); }
    if (p.y > WORLD.h - pad) { p.y = WORLD.h - pad; p.vy = Math.min(0, p.vy); }

    /* aim toward mouse */
    const mw = this.screenToWorld(this.input.mx, this.input.my);
    p.aimAngle = angleTo(p.x, p.y, mw.x, mw.y);

    /* afterimages */
    for (let i = p.afterimages.length - 1; i >= 0; i--) {
      p.afterimages[i].life -= dt;
      if (p.afterimages[i].life <= 0) p.afterimages.splice(i, 1);
    }

    /* ---- weapons ---- */
    updateWeapons(dt, this);

    /* ---- bullets ---- */
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(dt, this);
      if (b.dead) { this.bullets.splice(i, 1); continue; }
      if (b.friendly) this.collidePlayerBullet(b, i);
      else this.collideEnemyBullet(b, i);
      if (this.state !== 'playing') return;
    }

    /* ---- enemies ---- */
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      e.update(dt, this);
      if (e.dead) { this.enemies.splice(i, 1); continue; }
    }
    this.separateEnemies(dt);

    /* ---- boss ---- */
    if (this.boss) {
      if (this.boss.dead && this.victoryT < 0) {
        /* handled */
      } else if (!this.boss.dead) {
        this.boss.update(dt, this);
        this.collideBossContact();
      }
    }

    /* ---- player contact with enemies ---- */
    this.collideContact();

    /* ---- pickups ---- */
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.update(dt, this);
      if (pk.dead) this.pickups.splice(i, 1);
    }

    /* ---- director ---- */
    this.updateDirector(dt);

    /* ---- audio intensity ---- */
    this.intensityT -= dt;
    if (this.intensityT <= 0) {
      this.intensityT = 0.4;
      const threat = clamp(this.enemies.length / BAL.director.maxAlive(this.t), 0, 1);
      const v = clamp(0.2 + (this.t / 620) * 0.38 + threat * 0.34 + (this.boss && !this.boss.dead ? 0.3 : 0), 0, 1);
      this.audio.setIntensity(v);
    }

    this.fx.update(dt);
    this.updateCamera(dt, true);
  }

  collidePlayerBullet(b, idx) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const rr = e.r + b.r;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) continue;
      if (e.polarity === b.polarity) {
        /* shielded */
        b.dead = true;
        this.fx.hitSparks(b.x, b.y, '#9aa3d6', angleTo(b.x, b.y, e.x, e.y), 4);
        if (this._shieldCd <= 0) { this._shieldCd = 0.14; this.audio.shielded(); }
        return;
      }
      e.hurt(b.dmg, this, b.x, b.y, { polarity: b.polarity, knock: b.knock || 90, burn: 0 });
      this.fx.hitSparks(b.x, b.y, POLARITY_COLOR[b.polarity], angleTo(b.x, b.y, e.x, e.y), 5);
      this.audio.hit();
      if (b.dmg >= 42) this.fx.text(e.x, e.y - e.r - 8, `${Math.round(b.dmg)}`, { color: '#fff', size: 15, life: 0.55 });
      if (b.chain > 0 && !e.dead) this.chainFrom(e.x, e.y, b.dmg * 0.55, new Set([e.id]), b.chain);
      if (e.dead) b.kills++;
      if (b.pierce > 0) { b.pierce--; b.seen.add(e.id); }
      else { b.dead = true; return; }
      if (b.onHit) b.onHit(this, e);
    }
    /* boss */
    if (this.boss && !this.boss.dead && this.boss.state === 'fight') {
      for (const hb of this.boss.hitboxes()) {
        if (hb.sub && hb.sub !== 'halfA' && hb.sub !== 'halfB' && hb.sub.dead) continue;
        const rr = hb.r + b.r;
        if ((hb.x - b.x) ** 2 + (hb.y - b.y) ** 2 > rr * rr) continue;
        if (this.boss.polarity === b.polarity) {
          b.dead = true;
          this.fx.hitSparks(b.x, b.y, '#9aa3d6', angleTo(b.x, b.y, hb.x, hb.y), 4);
          if (this._shieldCd <= 0) { this._shieldCd = 0.14; this.audio.shielded(); }
          return;
        }
        this.boss.hurt(b.dmg, this, b.x, b.y, { polarity: b.polarity });
        this.fx.hitSparks(b.x, b.y, '#fff', angleTo(b.x, b.y, hb.x, hb.y), 6);
        this.audio.hit();
        this._bossDmgT = (this._bossDmgT || 0) + b.dmg;
        if (this._bossDmgT > 90) {
          this._bossDmgT = 0;
          this.fx.text(hb.x, hb.y - hb.r - 14, `${Math.round(b.dmg)}`, { color: '#fff', size: 16, life: 0.5 });
        }
        if (b.pierce > 0) { b.pierce--; continue; }
        b.dead = true;
        return;
      }
    }
  }

  collideEnemyBullet(b, idx) {
    const p = this.player;
    const rr = p.r + b.r;
    const d2 = (p.x - b.x) ** 2 + (p.y - b.y) ** 2;
    if (d2 > rr * rr) return;
    if (b.polarity === p.polarity) {
      /* devoured */
      this.absorbBullet(b);
      b.dead = true;
      return;
    }
    if (p.iframe > 0) return;   /* pass through while phasing */
    this.hurtPlayer(b.dmg, b.x, b.y);
    b.dead = true;
  }

  collideContact() {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      const rr = e.r + p.r;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
      /* knock enemy away */
      const a = angleTo(p.x, p.y, e.x, e.y);
      e.vx += Math.cos(a) * 240;
      e.vy += Math.sin(a) * 240;
      this.hurtPlayer(e.contact, e.x, e.y);
      if (p.mods.thorns) {
        e.hurt(20 * p.mods.thorns, this, e.x, e.y, { knock: 200 });
        this.fx.hitSparks(e.x, e.y, '#fff', a, 5);
      }
    }
  }

  collideBossContact() {
    const b = this.boss;
    if (!b || b.dead || b.state === 'enter') return;
    const p = this.player;
    for (const hb of b.hitboxes()) {
      if (hb.sub && hb.sub !== 'halfA' && hb.sub !== 'halfB' && hb.sub.dead) continue;
      const rr = hb.r + p.r;
      if ((hb.x - p.x) ** 2 + (hb.y - p.y) ** 2 <= rr * rr) {
        this.hurtPlayer(b.contact, hb.x, hb.y);
        const a = angleTo(hb.x, hb.y, p.x, p.y);
        p.vx += Math.cos(a) * 260;
        p.vy += Math.sin(a) * 260;
        break;
      }
    }
  }

  separateEnemies(dt) {
    const list = this.enemies;
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const a = list[i];
      if (a.dead || a.state === 'spawn') continue;
      for (let j = i + 1; j < n; j++) {
        const b = list[j];
        if (b.dead || b.state === 'spawn') continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.r + b.r) * 0.86;
        const d2 = dx * dx + dy * dy;
        if (d2 > min * min || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) / d * 0.5;
        const px = dx * push, py = dy * push;
        a.x -= px; a.y -= py;
        b.x += px; b.y += py;
      }
    }
  }

  /* ==================== camera / utils ==================== */

  updateCamera(dt, lead) {
    const p = this.player;
    if (!p) return;
    let tx = p.x, ty = p.y;
    if (lead) {
      tx += p.vx * 0.22 + Math.cos(p.aimAngle) * 46;
      ty += p.vy * 0.22 + Math.sin(p.aimAngle) * 46;
    }
    const k = 1 - Math.pow(0.0035, dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const hw = this.view.w / 2, hh = this.view.h / 2;
    this.cam.x = this.world.w <= this.view.w ? this.world.w / 2 : clamp(this.cam.x, hw, this.world.w - hw);
    this.cam.y = this.world.h <= this.view.h ? this.world.h / 2 : clamp(this.cam.y, hh, this.world.h - hh);
    this.trauma = Math.max(0, this.trauma - dt * 1.55);
  }

  computeShake(dt) {
    const s = this.trauma * this.trauma;
    const max = 22;
    this.shakeX = (Math.random() * 2 - 1) * max * s;
    this.shakeY = (Math.random() * 2 - 1) * max * s;
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }

  screenToWorld(sx, sy) {
    return { x: this.cam.x + sx - this.view.w / 2, y: this.cam.y + sy - this.view.h / 2 };
  }

  nearestEnemy(x, y, range, filter) {
    let best = null, bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.state === 'spawn') continue;
      if (filter && !filter(e)) continue;
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d2 < bd) { bd = d2; best = e; }
    }
    if (!best && this.boss && !this.boss.dead && this.boss.state === 'fight') {
      for (const hb of this.boss.hitboxes()) {
        if (hb.sub && hb.sub !== 'halfA' && hb.sub !== 'halfB' && hb.sub.dead) continue;
        if (filter && !filter({ polarity: this.boss.polarity, dead: false, state: 'live' })) continue;
        const d2 = (hb.x - x) ** 2 + (hb.y - y) ** 2;
        if (d2 < bd) { bd = d2; best = { x: hb.x, y: hb.y, dead: false, polarity: this.boss.polarity, isHb: true }; }
      }
    }
    return best;
  }

  enemyTargets() { return this.enemies; }

  /* ==================== render ==================== */

  render(ctx, w, h) {
    this.view.w = w; this.view.h = h;
    if (this.state === 'menu' || !this.player) {
      renderMenu(this, ctx, w, h);
      return;
    }
    renderGame(this, ctx, w, h);
  }
}
