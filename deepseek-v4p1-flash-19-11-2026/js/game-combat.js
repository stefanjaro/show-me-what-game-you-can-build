import {
  TAU, clamp, rand, pick, dist, dist2, angleTo,
} from './util.js';
import { ENEMY_TYPES, bossForWave, COLORS } from './data.js';

const BOSS_DEATH_LINES = [
  'THE CHOIR FALLS SILENT',
  'RUST RETURNS TO DUST',
  'THE HUNGER ENDS',
];

export const combatMethods = {

  // ============================================================
  // spawning
  // ============================================================
  spawnEnemy(typeId, opts = {}) {
    const def = ENEMY_TYPES[typeId];
    if (!def) return null;
    const wave = this.wave;
    const hpScale = 1 + 0.15 * (wave - 1) + 0.011 * Math.pow(wave - 1, 2);
    const speedScale = Math.min(1.45, 1 + 0.012 * (wave - 1));
    const elite = opts.elite ?? (!def.hidden && wave >= 4 && this.rng.chance(Math.min(0.16, 0.008 * wave)));
    const pos = opts.x !== undefined ? { x: opts.x, y: opts.y } : this.edgeSpawnPos();
    const r = def.radius * this.S * (elite ? 1.32 : 1);
    const hp = def.hp * hpScale * (elite ? 3.4 : 1) * (opts.hpMul || 1);
    const e = {
      id: this.nextId++,
      type: typeId,
      behavior: def.behavior,
      shape: def.shape,
      color: def.color,
      x: pos.x, y: pos.y, vx: 0, vy: 0, r,
      hp, maxHp: hp,
      speed: def.speed * this.S * speedScale * (elite ? 0.86 : 1),
      dmg: def.dmg * (elite ? 2 : 1),
      xp: def.xp * (elite ? 4 : 1),
      score: def.score * (elite ? 4 : 1),
      elite,
      rot: rand(0, TAU),
      seed: rand(0, 1000),
      stage: 'idle', stageT: 0, atkT: rand(0.7, 2.4),
      flash: 0, slowT: 0, slowAmt: 0, burnT: 0, burnDps: 0,
      entered: pos.x > 0 && pos.x < this.W && pos.y > 0 && pos.y < this.H,
      dead: false, isBoss: false,
      beamT: 0, beamAngle: 0, orbitA: rand(0, TAU),
      orbCd: 0,
    };
    this.enemies.push(e);
    if (!opts.quiet) {
      this.addGlow(e.x, e.y, e.color, 0, 0, 0.5, r * 1.2);
      this.ringFx(e.x, e.y, r * 0.5, r * 3, 0.5, e.color, 1);
    }
    return e;
  },

  estimateDps() {
    const w = this.weapon.fire;
    const s = this.stats;
    const count = (w.count || 1) + (this.weaponId === 'halo' ? Math.min(2, s.count) : s.count);
    const critFactor = 1 + s.crit * (s.critMul - 1);
    let dps = (w.damage * count * s.damage * s.rate / w.cd) * critFactor;
    if (this.weaponId === 'halo') dps *= 0.78;
    dps += s.orbit * (w.damage * 1.4 * s.damage) / 0.32;
    dps += s.starChild * ((w.damage * 1.1 + 4) * s.damage * 0.7) / 0.95;
    if (s.chain) dps *= 1 + 0.12 * s.chain;
    if (s.solar) dps += (30 + this.wave * 5) * s.damage * (0.7 + s.solar * 0.45) / 3.8;
    if (s.overcharge) dps *= 1.08;
    if (s.reaper) dps *= 1.1;
    return Math.max(30, dps * 0.78);
  },

  spawnBoss() {
    const data = bossForWave(this.wave);
    const idx = Math.floor(this.wave / 5 - 1);
    const est = this.estimateDps();
    const targetTime = 16 + Math.min(14, idx * 2);
    const typeFactor = 1 + (idx % 3 === 1 ? 0.08 : idx % 3 === 2 ? 0.16 : 0);
    const floorHp = 1600 * Math.pow(1.65, idx * 0.9);
    const bossHp = Math.round(Math.max(est * targetTime * typeFactor, floorHp) / 50) * 50;
    this.bossActive = true;
    const e = {
      id: this.nextId++,
      isBoss: true,
      bossType: ((idx % 3) + 3) % 3,
      bossIndex: idx,
      name: data.name,
      color: data.color,
      shape: data.shape,
      x: this.W / 2, y: -this.H * 0.18,
      vx: 0, vy: 0,
      r: data.radius * this.S * 1.15,
      hp: bossHp, maxHp: bossHp,
      speed: 80 * this.S,
      dmg: 2, xp: 30, score: 500, elite: false,
      rot: 0, seed: rand(0, 1000),
      stage: 'idle', atkT: 2, flash: 0, slowT: 0, slowAmt: 0, burnT: 0, burnDps: 0,
      entered: true, dead: false, invuln: true,
      introT: 1.9, enraged: false, fightT: 0, crackAnnounced: false,
      atk1: 2.2, atk2: 1.2, summonT: 4, teleT: 6.5,
      spiralT: 0, spiralCd: 2, spiralFireT: 0, spiralAngle: 0,
      orbit: 0, wallT: 2.6, beamT: 0, orbCd: 0,
    };
    this.enemies.push(e);
    this.bossRef = e;
    this.el.bossName.textContent = e.name;
    this.el.bossBar.classList.add('on');
    this.el.bossHp.textContent = '100%';
    this.ui?.banner?.(e.name, data.line, true);
    this.audio.bossIntro();
    this.audio.setIntensity(0.9);
    this.flash(e.color, 0.16);
    this.shakeIt(12);
    for (let i = 0; i < 26; i++) {
      const a = rand(0, TAU);
      this.addGlow(this.W / 2 + Math.cos(a) * this.H * 0.5, rand(0, 100), e.color,
        Math.cos(a + Math.PI) * rand(30, 120), rand(40, 140), rand(0.7, 1.6), rand(2, 5));
    }
    return e;
  },

  // ============================================================
  // enemies
  // ============================================================
  enemyTimeScale() {
    return 1 - this.stats.timeField * 0.08;
  },

  updateEnemies(dt) {
    const ts = this.enemyTimeScale();
    for (const e of this.enemies) {
      if (e.dead) continue;
      if ((e.flash || 0) > 0) e.flash -= dt;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowAmt = 0;
      }
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.hp -= e.burnDps * dt;
        if (Math.random() < dt * 8) {
          this.addGlow(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), COLORS.orange,
            rand(-10, 10), rand(-40, -10), rand(0.2, 0.5), rand(1.5, 3));
        }
        if (e.hp <= 0) { this.killEnemy(e, { source: 'burn' }); continue; }
      }
      if (e.isBoss) this.updateBoss(e, dt * ts);
      else this.updateEnemy(e, dt * ts);
    }

    const arr = this.enemies;
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a.dead || a.isBoss) continue;
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j];
        if (b.dead) continue;
        const min = a.r + b.r;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          if (!b.isBoss) { b.x += nx * push; b.y += ny * push; }
          a.x -= nx * push * 0.8;
          a.y -= ny * push * 0.8;
        }
      }
    }

    const p = this.player;
    for (const e of arr) {
      if (e.dead || p.dead) continue;
      if (dist(e.x, e.y, p.x, p.y) < e.r + p.r) {
        if (p.iframes <= 0) {
          this.hitPlayer(e.dmg, e.x, e.y);
          if (!e.isBoss) {
            e.vx += (e.x - p.x) * 1.5;
            e.vy += (e.y - p.y) * 1.5;
          }
        }
      }
      if (e.isBoss && !e.invuln && !this.bossActive) this.bossActive = true;
    }

    this.enemies = this.enemies.filter(e => !e.dead);
    if (this.bossRef && this.bossRef.dead) this.bossRef = null;
  },

  updateEnemy(e, dt) {
    if (dt <= 0) return;
    const p = this.player;
    const slowMul = 1 - e.slowAmt;
    const edt = dt * slowMul;
    if (edt <= 0) return;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d, ny = dy / d;
    const ang = Math.atan2(dy, dx);

    if (!e.entered && e.x > 0 && e.x < this.W && e.y > 0 && e.y < this.H) e.entered = true;

    switch (e.behavior) {
      case 'seek': {
        let tx = nx, ty = ny;
        if (e.type === 'shard') {
          const w = Math.sin(this.time * 5 + e.seed) * 0.4;
          tx = Math.cos(ang + w * 0.5);
          ty = Math.sin(ang + w * 0.5);
        }
        e.vx += (tx * e.speed - e.vx) * Math.min(1, edt * 4);
        e.vy += (ty * e.speed - e.vy) * Math.min(1, edt * 4);
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        break;
      }
      case 'weave': {
        const wob = Math.sin(this.time * 2.4 + e.seed) * 0.85;
        const tx = Math.cos(ang + wob) * e.speed;
        const ty = Math.sin(ang + wob) * e.speed;
        e.vx += (tx - e.vx) * Math.min(1, edt * 3);
        e.vy += (ty - e.vy) * Math.min(1, edt * 3);
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        break;
      }
      case 'darter': {
        e.atkT -= edt;
        if (e.stage === 'idle') {
          e.vx += (nx * e.speed * 0.5 - e.vx) * Math.min(1, edt * 2.5);
          e.vy += (ny * e.speed * 0.5 - e.vy) * Math.min(1, edt * 2.5);
          e.x += e.vx * edt;
          e.y += e.vy * edt;
          if (e.atkT <= 0) {
            e.stage = 'wind';
            e.stageT = 0.42;
            e.vx *= 0.2; e.vy *= 0.2;
            this.ringFx(e.x, e.y, e.r, e.r * 2.4, 0.35, e.color, 1.5);
          }
        } else if (e.stage === 'wind') {
          e.stageT -= edt;
          e.vx *= 0.85; e.vy *= 0.85;
          e.x += e.vx * edt;
          e.y += e.vy * edt;
          if (e.stageT <= 0) {
            e.stage = 'dash';
            e.stageT = 0.26;
            e.vx = nx * 760 * this.S;
            e.vy = ny * 760 * this.S;
            this.addSpark(e.x, e.y, e.color, -e.vx * 0.2, -e.vy * 0.2, 0.25, 2);
          }
        } else if (e.stage === 'dash') {
          e.stageT -= edt;
          e.x += e.vx * edt;
          e.y += e.vy * edt;
          if (Math.random() < 0.6) this.addGlow(e.x, e.y, e.color, 0, 0, 0.2, 3);
          if (e.stageT <= 0) { e.stage = 'idle'; e.atkT = rand(1.1, 2); }
        }
        break;
      }
      case 'spitter': {
        e.atkT -= edt;
        const dir = Math.sin(this.time * 0.6 + e.seed) > 0 ? 1 : -1;
        let tx, ty;
        if (d > 360 * this.S) { tx = nx * e.speed; ty = ny * e.speed; }
        else if (d < 250 * this.S) { tx = -nx * e.speed; ty = -ny * e.speed; }
        else { tx = -ny * e.speed * 0.7 * dir; ty = nx * e.speed * 0.7 * dir; }
        e.vx += (tx - e.vx) * Math.min(1, edt * 2.5);
        e.vy += (ty - e.vy) * Math.min(1, edt * 2.5);
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        if (e.atkT <= 0) {
          e.atkT = rand(2.1, 2.8);
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = -1; i <= 1; i++) {
            this.enemyBullet(e.x, e.y, base + i * 0.13, 290 * this.S, 5.2 * this.S, COLORS.coral);
          }
          this.addGlow(e.x + nx * e.r, e.y + ny * e.r, COLORS.coral, 0, 0, 0.3, 6);
          e.flash = 0.12;
        }
        break;
      }
      case 'weaver': {
        e.atkT -= edt;
        e.orbitA += edt * 0.9;
        const desired = 285 * this.S;
        const radial = clamp((d - desired) / (60 * this.S), -1, 1);
        const tx = -ny * e.speed + nx * radial * e.speed;
        const ty = nx * e.speed + ny * radial * e.speed;
        e.vx += (tx - e.vx) * Math.min(1, edt * 2.2);
        e.vy += (ty - e.vy) * Math.min(1, edt * 2.2);
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        if (e.atkT <= 0) {
          e.atkT = rand(2.4, 3.2);
          for (let i = 0; i < 5; i++) {
            this.enemyBullet(e.x, e.y, e.orbitA + i * 0.14, 270 * this.S, 5 * this.S, e.color);
          }
          e.orbitA += 0.5;
          this.ringFx(e.x, e.y, e.r, e.r * 2.2, 0.35, e.color, 1.2);
        }
        break;
      }
      case 'bulwark': {
        e.atkT -= edt;
        e.vx += (nx * e.speed - e.vx) * Math.min(1, edt * 1.6);
        e.vy += (ny * e.speed - e.vy) * Math.min(1, edt * 1.6);
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        if (e.atkT <= 0 && d < 680 * this.S) {
          e.atkT = rand(3.3, 4.4);
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = -2; i <= 2; i++) {
            this.enemyBullet(e.x, e.y, base + i * 0.15, 205 * this.S, 7 * this.S, e.color);
          }
          this.ringFx(e.x, e.y, e.r, e.r * 2.6, 0.5, e.color, 2);
          this.shakeIt(2);
        }
        break;
      }
      case 'sniper': {
        e.atkT -= edt;
        let tx, ty;
        if (d > 470 * this.S) { tx = nx * e.speed; ty = ny * e.speed; }
        else if (d < 380 * this.S) { tx = -nx * e.speed; ty = -ny * e.speed; }
        else { tx = -ny * e.speed * 0.5; ty = nx * e.speed * 0.5; }
        e.vx += (tx - e.vx) * Math.min(1, edt * 2);
        e.vy += (ty - e.vy) * Math.min(1, edt * 2);
        e.x += e.vx * edt;
        e.y += e.vy * edt;
        if (e.beamT > 0) {
          e.beamT -= edt;
          if (e.beamT <= 0.28) e.beamAngle = Math.atan2(p.y - e.y, p.x - e.x);
          if (e.beamT <= 0) {
            this.enemyBullet(e.x + Math.cos(e.beamAngle) * e.r, e.y + Math.sin(e.beamAngle) * e.r,
              e.beamAngle, 1750 * this.S, 5 * this.S, '#cfe3ff', { shape: 'beam', life: 2 });
            this.addSpark(e.x, e.y, '#cfe3ff', Math.cos(e.beamAngle) * 240, Math.sin(e.beamAngle) * 240, 0.2, 2);
            this.shakeIt(3);
          }
        } else if (e.atkT <= 0) {
          e.atkT = rand(3.2, 4.1);
          e.beamT = 0.85;
          e.beamAngle = Math.atan2(p.y - e.y, p.x - e.x);
        }
        break;
      }
      default: {
        e.x += nx * e.speed * edt;
        e.y += ny * e.speed * edt;
      }
    }

    if (e.entered) {
      const m = 18 * this.S;
      if (e.x < m) { e.x = m; e.vx = Math.abs(e.vx) * 0.4; }
      if (e.x > this.W - m) { e.x = this.W - m; e.vx = -Math.abs(e.vx) * 0.4; }
      if (e.y < m) { e.y = m; e.vy = Math.abs(e.vy) * 0.4; }
      if (e.y > this.H - m) { e.y = this.H - m; e.vy = -Math.abs(e.vy) * 0.4; }
    }
    e.rot += edt * (e.behavior === 'darter' ? 1.5 : 0.4);
  },

  // ============================================================
  // bosses
  // ============================================================
  updateBoss(e, dt) {
    const p = this.player;
    e.rot += dt * (0.2 + (e.bossType === 1 ? 0.16 : 0));
    if (e.introT > 0) {
      e.introT -= dt;
      e.invuln = true;
      e.y += (this.H * 0.23 - e.y) * Math.min(1, dt * 2.2);
      e.x += (this.W / 2 - e.x) * Math.min(1, dt * 2);
      if (Math.random() < 0.5) {
        const a = rand(0, TAU), r = rand(0.4, 1) * e.r * 1.8;
        this.addGlow(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.color,
          -Math.cos(a) * 30, -Math.sin(a) * 30, 0.5, rand(2, 5));
      }
      return;
    }
    e.invuln = false;
    e.fightT = (e.fightT || 0) + dt;
    if (e.fightT > 18 && !e.crackAnnounced) {
      e.crackAnnounced = true;
      this.ui?.toast?.('ITS SHELL IS CRACKING · YOUR LIGHT BITES DEEPER', false, 2200);
    }
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true;
      this.ui?.banner?.('IT IS WOUNDED', 'it remembers you', true);
      this.flash(e.color, 0.25);
      this.shakeIt(14);
      this.audio.bossIntro();
    }

    if (e.bossType === 0) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      const d = dist(e.x, e.y, p.x, p.y);
      const dir = d > 300 * this.S ? 1 : -0.3;
      e.x += Math.cos(a) * 26 * this.S * dir * dt + Math.sin(this.time * 0.4) * 8 * dt;
      e.y += Math.sin(a) * 26 * this.S * dir * dt + Math.cos(this.time * 0.33) * 10 * dt;
      e.x = clamp(e.x, 110 * this.S, this.W - 110 * this.S);
      e.y = clamp(e.y, 100 * this.S, this.H - 100 * this.S);
      e.atk1 -= dt; e.atk2 -= dt; e.summonT -= dt;
      if (e.atk1 <= 0) {
        e.atk1 = e.enraged ? 1.75 : 2.7;
        this.bossRing(e, e.enraged ? 22 : 16, 170, 6.5);
      }
      if (e.atk2 <= 0) {
        e.atk2 = e.enraged ? 1.1 : 1.8;
        this.bossAim(e, e.enraged ? 5 : 3, 0.17, 320, 5.5);
      }
      if (e.summonT <= 0) {
        e.summonT = 8;
        this.summonAdds(e, e.enraged ? 4 : 3, e.enraged && Math.random() < 0.5 ? 'darter' : 'wisp');
      }
    } else if (e.bossType === 1) {
      e.orbit += dt * 0.6;
      const tx = p.x + Math.cos(e.orbit) * 330 * this.S;
      const ty = p.y + Math.sin(e.orbit) * 225 * this.S;
      e.x += (tx - e.x) * Math.min(1, dt * 1.4);
      e.y += (ty - e.y) * Math.min(1, dt * 1.4);
      e.x = clamp(e.x, 90 * this.S, this.W - 90 * this.S);
      e.y = clamp(e.y, 90 * this.S, this.H - 90 * this.S);
      if (Math.random() < dt * 22) {
        this.addGlow(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), COLORS.orange,
          rand(-20, 20), rand(-50, 10), rand(0.3, 0.8), rand(1.5, 3.5));
      }
      if (e.spiralT > 0) {
        e.spiralT -= dt;
        e.spiralFireT -= dt;
        if (e.spiralFireT <= 0) {
          e.spiralFireT = e.enraged ? 0.065 : 0.09;
          e.spiralAngle += 0.27;
          const arms = e.enraged ? 3 : 2;
          for (let i = 0; i < arms; i++) {
            this.enemyBullet(e.x, e.y, e.spiralAngle + (i / arms) * TAU, 200 * this.S, 5 * this.S, e.color);
          }
        }
      } else {
        e.spiralCd -= dt;
        if (e.spiralCd <= 0) {
          e.spiralT = 2.0;
          e.spiralCd = e.enraged ? 3.4 : 4.6;
          e.spiralFireT = 0;
        }
      }
      e.atk2 -= dt;
      if (e.atk2 <= 0) {
        e.atk2 = e.enraged ? 1.9 : 2.6;
        this.bossAim(e, e.enraged ? 7 : 5, 0.2, 290, 5);
      }
      e.teleT -= dt;
      if (e.teleT <= 0) {
        e.teleT = e.enraged ? 4.6 : 6.4;
        for (let i = 0; i < 14; i++) {
          this.addGlow(e.x, e.y, e.color, rand(-200, 200), rand(-200, 200), rand(0.3, 0.8), rand(2, 5));
        }
        const a = rand(0, TAU);
        e.x = clamp(p.x + Math.cos(a) * 300 * this.S, 100 * this.S, this.W - 100 * this.S);
        e.y = clamp(p.y + Math.sin(a) * 240 * this.S, 100 * this.S, this.H - 100 * this.S);
        this.bossRing(e, 12, 180, 5.5);
        this.flash(e.color, 0.1);
      }
    } else {
      e.x += (this.W / 2 - e.x) * Math.min(1, dt * 0.35);
      e.y += (this.H * 0.3 - e.y) * Math.min(1, dt * 0.4);
      const dd = dist(e.x, e.y, p.x, p.y);
      if (dd < 640 * this.S) {
        const a = angleTo(p.x, p.y, e.x, e.y);
        p.vx += Math.cos(a) * 70 * this.S * dt;
        p.vy += Math.sin(a) * 70 * this.S * dt;
      }
      if (Math.random() < dt * 26) {
        const a = rand(0, TAU), r = rand(160, 460) * this.S;
        const gx = e.x + Math.cos(a) * r;
        const gy = e.y + Math.sin(a) * r;
        this.addGlow(gx, gy, pick([e.color, COLORS.rose, COLORS.violet]),
          -Math.cos(a) * rand(80, 220), -Math.sin(a) * rand(80, 220), rand(0.4, 0.9), rand(1.2, 3));
      }
      e.wallT -= dt;
      if (e.wallT <= 0) {
        e.wallT = e.enraged ? 2.1 : 3.1;
        this.devourerWall(e, e.enraged);
      }
      e.atk1 -= dt;
      if (e.atk1 <= 0) {
        e.atk1 = e.enraged ? 2.3 : 3.4;
        this.bossRing(e, e.enraged ? 20 : 13, 155, 6.5);
      }
      e.summonT -= dt;
      if (e.summonT <= 0) {
        e.summonT = 5.5;
        this.summonAdds(e, e.enraged ? 5 : 4, 'shard');
      }
    }
  },

  bossRing(e, count, speed, radius) {
    const off = rand(0, TAU);
    for (let i = 0; i < count; i++) {
      this.enemyBullet(e.x, e.y, off + (i / count) * TAU, speed * this.S, radius * this.S, e.color);
    }
    e.flash = 0.14;
  },

  bossAim(e, count, spread, speed, radius) {
    const base = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? (i / (count - 1) - 0.5) : 0;
      this.enemyBullet(e.x, e.y, base + frac * spread * 2, speed * this.S, radius * this.S, e.color);
    }
    e.flash = 0.12;
  },

  devourerWall(e, enraged) {
    const gapA = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    const gap = enraged ? 0.6 : 0.9;
    const count = 30;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const diff = Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA));
      if (Math.abs(diff) < gap) continue;
      this.enemyBullet(e.x, e.y, a, 145 * this.S, 5.5 * this.S, e.color, { life: 6 });
    }
    this.ringFx(e.x, e.y, e.r * 0.8, e.r * 1.8, 0.4, e.color, 2);
  },

  summonAdds(e, n, type = 'wisp') {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), r = e.r + rand(20, 80) * this.S;
      this.spawnEnemy(type, { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r, quiet: true });
    }
    this.ringFx(e.x, e.y, e.r, e.r * 2, 0.5, e.color, 2);
  },

  enemyBullet(x, y, angle, speed, r, color, opts = {}) {
    if (this.enemyBullets.length > 520) return;
    this.enemyBullets.push({
      x, y, px: x, py: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r, color,
      life: opts.life || 7,
      grazed: false,
      dead: false,
      shape: opts.shape || 'orb',
      accel: opts.accel || 0,
      turn: opts.turn || 0,
      angle,
    });
  },

  // ============================================================
  // damage
  // ============================================================
  hitEnemy(e, amount, opts = {}) {
    if (e.dead || e.invuln) return;
    if (e.isBoss && e.fightT > 18) {
      amount *= Math.min(3, 1 + (e.fightT - 18) * 0.07);
    }
    e.hp -= amount;
    e.flash = Math.max(e.flash, 0.09);
    if (opts.source !== 'burn') {
      const crit = !!opts.crit;
      if (crit) {
        this.addText(e.x + rand(-8, 8), e.y - e.r * 0.6, `${Math.round(amount)}`, COLORS.gold, 17, 'crit');
        this.shakeIt(2.5);
      } else if (Math.random() < 0.16) {
        this.addText(e.x + rand(-6, 6), e.y - e.r * 0.5, `${Math.round(amount)}`, 'rgba(220,240,255,.7)', 11);
      }
      for (let i = 0; i < (crit ? 8 : 3); i++) {
        const a = rand(0, TAU), sp = rand(60, crit ? 320 : 180);
        this.addSpark(e.x, e.y, crit ? COLORS.gold : e.color,
          Math.cos(a) * sp, Math.sin(a) * sp, rand(0.15, 0.4), rand(1, 2.2));
      }
      if (opts.x !== undefined && opts.kb) {
        const a = angleTo(opts.x, opts.y, e.x, e.y);
        const kb = opts.kb * (e.isBoss ? 0.03 : e.type === 'bulwark' ? 0.25 : 1) / (e.elite ? 1.5 : 1);
        e.vx += Math.cos(a) * kb;
        e.vy += Math.sin(a) * kb;
      }
      if (this.stats.burn > 0) {
        e.burnT = 3;
        e.burnDps = Math.max(e.burnDps || 0, (8 + this.wave * 1.8) * this.stats.burn * this.damageMult() * 0.7);
      }
      if (this.stats.frost > 0) {
        e.slowT = 2;
        e.slowAmt = Math.max(e.slowAmt, Math.min(0.55, 0.18 * this.stats.frost));
      }
      if (this.stats.chain > 0) {
        let fromX = e.x, fromY = e.y;
        const hitIds = new Set([e.id]);
        for (let c = 0; c < this.stats.chain; c++) {
          const target = this.enemies.find(o => !o.dead && !hitIds.has(o.id) && dist(o.x, o.y, fromX, fromY) < 240 * this.S);
          if (!target) break;
          hitIds.add(target.id);
          const dmg = amount * 0.42 * Math.pow(0.8, c);
          target.hp -= dmg;
          target.flash = 0.08;
          this.addText(target.x, target.y - target.r * 0.4, `${Math.round(dmg)}`, COLORS.cyan, 11);
          this.addEffect({
            type: 'lightning', life: 0.16, x1: fromX, y1: fromY, x2: target.x, y2: target.y, color: COLORS.cyan,
          });
          for (let i = 0; i < 3; i++) {
            const a = rand(0, TAU);
            this.addSpark(target.x, target.y, COLORS.cyan, Math.cos(a) * 80, Math.sin(a) * 80, 0.3, 1.5);
          }
          if (target.hp <= 0) this.killEnemy(target, { source: 'chain' });
          fromX = target.x; fromY = target.y;
        }
      }
    }
    if (e.hp <= 0) this.killEnemy(e, opts);
  },

  killEnemy(e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    const isBoss = e.isBoss;
    const big = isBoss || e.maxHp > 120;
    const p = this.player;
    this.kills++;
    if (!isBoss) {
      this.combo++;
      this.comboT = 2.6;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += Math.round((e.score || 10) * this.comboMul);
    }
    p.focus = Math.min(100, p.focus + (isBoss ? 20 : 0.8));
    this.audio.kill(big);
    this.shakeIt(isBoss ? 10 : big ? 5 : 2.5);

    const nParticles = isBoss ? 70 : e.elite ? 26 : big ? 18 : 10;
    for (let i = 0; i < nParticles; i++) {
      const a = rand(0, TAU), sp = rand(50, isBoss ? 600 : 260);
      this.addSpark(e.x, e.y, pick([e.color, '#ffffff', e.color]),
        Math.cos(a) * sp, Math.sin(a) * sp, rand(0.25, 0.8), rand(1, 3.2));
    }
    for (let i = 0; i < (e.elite ? 12 : 5); i++) {
      const a = rand(0, TAU), sp = rand(30, 160);
      this.addDebris(e.x, e.y, e.color, Math.cos(a) * sp, Math.sin(a) * sp, rand(2, 5), rand(0.4, 1));
    }
    this.ringFx(e.x, e.y, e.r * 0.4, e.r * (isBoss ? 9 : 3.4), isBoss ? 1.2 : 0.5, e.color, isBoss ? 4 : 1.5);

    if (isBoss) {
      this.bossKilled(e);
      return;
    }

    const xp = e.xp * this.stats.xpMul;
    const moteCount = clamp(Math.ceil(e.xp), 1, 4);
    for (let i = 0; i < moteCount; i++) {
      const a = rand(0, TAU), sp = rand(40, 190);
      this.addMote(e.x, e.y, xp / moteCount, Math.cos(a) * sp, Math.sin(a) * sp);
    }
    this.heartPity++;
    const heartChance = 0.022 + this.stats.bounty + (this.heartPity > 42 ? 0.4 : 0);
    if (Math.random() < heartChance && (p.hp < p.maxHp || this.heartPity > 42)) {
      this.heartPity = 0;
      this.addHeart(e.x + rand(-8, 8), e.y + rand(-8, 8));
    }
    if (this.stats.leech > 0 && Math.random() < this.stats.leech && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + 1);
      this.audio.heal();
      this.addText(p.x, p.y - 20, '+1', COLORS.gold, 13);
    }
    if (e.type === 'splitter') {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, TAU);
        const shard = this.spawnEnemy('shard', {
          x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18, quiet: true, elite: false,
        });
        if (shard) {
          shard.vx = Math.cos(a) * 240 * this.S;
          shard.vy = Math.sin(a) * 240 * this.S;
          shard.xp = 1;
          shard.score = 4;
        }
      }
    }
  },

  bossKilled(e) {
    this.bossActive = false;
    this.bossesKilled++;
    this.combo += 5;
    this.comboT = 3;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.score += 600 + this.wave * 110;
    this.slowT = 1.1;
    this.slowFactor = 0.2;
    this.flash('#ffe6f0', 0.5);
    this.shakeIt(24);
    this.audio.bossDeath();
    for (let i = 0; i < 90; i++) {
      const a = rand(0, TAU), sp = rand(60, 700);
      this.addGlow(e.x, e.y, pick([e.color, COLORS.gold, '#ffffff']),
        Math.cos(a) * sp, Math.sin(a) * sp, rand(0.6, 1.8), rand(2, 6));
    }
    for (let i = 0; i < 4; i++) {
      this.ringFx(e.x, e.y, e.r * 0.5, e.r * (5 + i * 2.5), 1.3 + i * 0.2, i % 2 ? COLORS.gold : e.color, 4);
    }
    this.enemyBullets.forEach(b => {
      if (!b.dead) {
        b.dead = true;
        this.addGlow(b.x, b.y, COLORS.gold, rand(-60, 60), rand(-60, 60), 0.5, 3);
      }
    });
    const totalXp = 50 + this.wave * 4;
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), sp = rand(60, 260);
      this.addMote(e.x, e.y, totalXp / 12, Math.cos(a) * sp, Math.sin(a) * sp, true);
    }
    this.addHeart(e.x - 30, e.y);
    this.addHeart(e.x + 30, e.y);
    if (this.player.hp < this.player.maxHp) {
      this.player.hp += 1;
      this.audio.heal();
    }
    this.el.bossBar.classList.remove('on');
    const line = BOSS_DEATH_LINES[e.bossType] || 'IT IS OVER';
    this.ui?.banner?.(line, `wave ${this.wave} survived`, true);
    this.ui?.toast?.(`HORROR SLAIN · +${600 + this.wave * 110} SCORE`, false, 2800);
    this.waveT = Math.min(this.waveT, 5.5);
    this.bossRef = null;
    this.audio.setIntensity(0.45);
  },

  // ============================================================
  // projectiles
  // ============================================================
  updateBullets(dt) {
    const p = this.player;
    const ts = this.enemyTimeScale();
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.age += dt;
      b.px = b.x;
      b.py = b.y;
      if (b.shape === 'chakram') {
        b.spin += dt * 22;
        if (b.phase === 'out') {
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          b.vx *= Math.exp(-1.8 * dt);
          b.vy *= Math.exp(-1.8 * dt);
          if (b.age > b.returnT) b.phase = 'back';
        } else {
          const a = Math.atan2(p.y - b.y, p.x - b.x);
          const sp = 900 * this.S;
          b.vx += Math.cos(a) * sp * dt * 5;
          b.vy += Math.sin(a) * sp * dt * 5;
          const spd = Math.hypot(b.vx, b.vy);
          const maxSpd = 1500 * this.S;
          if (spd > maxSpd) { b.vx = b.vx / spd * maxSpd; b.vy = b.vy / spd * maxSpd; }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.age > 0.6 && dist(b.x, b.y, p.x, p.y) < p.r + 18 * this.S) b.dead = true;
        }
        if (b.age > b.life * 1.6) b.dead = true;
      } else {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        if (b.life <= 0) b.dead = true;
      }
      if (b.x < -80 || b.x > this.W + 80 || b.y < -80 || b.y > this.H + 80) {
        if (b.shape !== 'chakram' || b.phase === 'out') b.dead = true;
      }
      if (b.dead) continue;

      for (const e of this.enemies) {
        if (e.dead || e.invuln) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
        if (b.hits.has(e.id)) continue;
        if (b.shape === 'chakram') {
          const last = b.hitCd.get(e.id);
          if (last !== undefined && b.age - last < 0.3) continue;
          b.hitCd.set(e.id, b.age);
          this.hitEnemy(e, b.damage, { source: 'shot', crit: b.crit, x: b.x, y: b.y, kb: b.knockback });
          this.audio.hit(b.crit);
          continue;
        }
        b.hits.add(e.id);
        this.hitEnemy(e, b.damage, { source: 'shot', crit: b.crit, x: b.x, y: b.y, kb: b.knockback });
        this.audio.hit(b.crit);
        if (b.pierce > 0) {
          b.pierce--;
          continue;
        }
        if (b.ricochets > 0) {
          const target = this.enemies.find(o => !o.dead && !b.hits.has(o.id) && dist(o.x, o.y, b.x, b.y) < 420 * this.S);
          if (target) {
            b.ricochets--;
            const a = Math.atan2(target.y - b.y, target.x - b.x);
            const sp = Math.max(650 * this.S, Math.hypot(b.vx, b.vy));
            b.vx = Math.cos(a) * sp;
            b.vy = Math.sin(a) * sp;
            b.life = Math.max(b.life, 0.7);
            b.pierce = 0;
            this.addEffect({ type: 'lightning', life: 0.1, x1: e.x, y1: e.y, x2: target.x, y2: target.y, color: COLORS.violet });
            this.ringFx(b.x, b.y, 4, 18, 0.2, COLORS.violet, 1);
            continue;
          }
        }
        b.dead = true;
        break;
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    for (const b of this.enemyBullets) {
      if (b.dead) continue;
      b.px = b.x;
      b.py = b.y;
      b.life -= dt * ts;
      if (b.life <= 0) { b.dead = true; continue; }
      if (b.accel) {
        const sp = Math.hypot(b.vx, b.vy) + b.accel * dt * ts;
        const a = Math.atan2(b.vy, b.vx);
        b.vx = Math.cos(a) * sp;
        b.vy = Math.sin(a) * sp;
      }
      if (b.turn) {
        const a = Math.atan2(p.y - b.y, p.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        const na = cur + Math.atan2(Math.sin(a - cur), Math.cos(a - cur)) * Math.min(1, b.turn * dt * ts);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
      }
      b.x += b.vx * dt * ts;
      b.y += b.vy * dt * ts;
      if (b.x < -120 || b.x > this.W + 120 || b.y < -120 || b.y > this.H + 120) {
        b.dead = true;
        continue;
      }
      const d = dist(b.x, b.y, p.x, p.y);
      if (d < b.r + p.r + 3 && p.iframes <= 0 && !p.dead) {
        this.hitPlayer(1, b.x, b.y);
        b.dead = true;
        for (let i = 0; i < 8; i++) {
          const a = rand(0, TAU);
          this.addSpark(b.x, b.y, b.color, Math.cos(a) * rand(30, 160), Math.sin(a) * rand(30, 160), 0.3, 1.6);
        }
        continue;
      }
      if (!b.grazed && !p.dead && d < b.r + p.r + 30 * this.S) {
        b.grazed = true;
        this.grazes++;
        const wasReady = p.focus >= 100;
        p.focus = Math.min(100, p.focus + 7 * this.stats.grazeMul);
        if (!this.taughtGraze) {
          this.taughtGraze = true;
          this.ui?.toast?.('GRAZE IS CHARGE · NOVA CLEARS BULLETS', false, 2800);
        }
        this.audio.graze(p.focus / 100);
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU);
          this.addSpark(b.x, b.y, COLORS.gold, Math.cos(a) * 60, Math.sin(a) * 60, 0.25, 1.2);
        }
        if (!wasReady && p.focus >= 100) {
          this.ringFx(p.x, p.y, 20, 70, 0.5, COLORS.gold, 2.5);
          this.ui?.toast?.('NOVA READY', false, 1200);
        }
      }
    }
    this.enemyBullets = this.enemyBullets.filter(b => !b.dead);
  },

  hitPlayer(amount, sx, sy) {
    const p = this.player;
    if (this.state !== 'running' || p.dead) return;
    if (p.iframes > 0) return;
    this.dashQueued = false;
    p.shieldT = 0;
    this.lastHurtAt = this.time;
    if (p.shield > 0) {
      p.shield--;
      p.iframes = 1.0;
      p.hurtT = 0.3;
      this.shakeIt(7);
      this.flash(COLORS.cyan, 0.16);
      this.audio.shieldBreak();
      this.ringFx(p.x, p.y, 12, 90, 0.5, COLORS.cyan, 3);
      return;
    }
    p.hp -= amount;
    p.iframes = 1.15;
    p.hurtT = 0.45;
    this.combo = 0;
    this.comboT = 0;
    this.shakeIt(10);
    this.flash(COLORS.coral, 0.28);
    this.audio.hurt();
    const a = angleTo(sx, sy, p.x, p.y);
    p.vx += Math.cos(a) * 280 * this.S;
    p.vy += Math.sin(a) * 280 * this.S;
    for (let i = 0; i < 18; i++) {
      const aa = rand(0, TAU);
      this.addSpark(p.x, p.y, pick([COLORS.coral, COLORS.gold]),
        Math.cos(aa) * rand(40, 260), Math.sin(aa) * rand(40, 260), rand(0.3, 0.8), rand(1, 2.5));
    }
    if (p.hp <= 0) {
      if (this.revives > 0) {
        this.revives--;
        this.revivesUsed++;
        p.hp = 3;
        p.iframes = 2.2;
        p.reviveGlow = 2;
        this.subTimeSlow(0.5, 0.25);
        this.flash('#fff4d0', 0.5);
        this.shakeIt(18);
        this.audio.revive();
        this.ringFx(p.x, p.y, 20, 420, 1.2, COLORS.gold, 4);
        for (const b of this.enemyBullets) {
          if (!b.dead && dist(b.x, b.y, p.x, p.y) < 360 * this.S) {
            b.dead = true;
            this.addGlow(b.x, b.y, COLORS.gold, 0, 0, 0.4, 2.5);
          }
        }
        for (let i = 0; i < 40; i++) {
          const ang = rand(0, TAU), sp = rand(60, 400);
          this.addGlow(p.x, p.y, pick([COLORS.gold, '#ffffff']),
            Math.cos(ang) * sp, Math.sin(ang) * sp, rand(0.5, 1.2), rand(2, 5));
        }
        this.ui?.banner?.('SECOND DAWN', 'the light refuses', false);
      } else {
        this.die();
      }
    }
  },

  subTimeSlow(dur, factor) {
    this.slowT = Math.max(this.slowT, dur);
    this.slowFactor = Math.min(this.slowFactor, factor);
  },
};
