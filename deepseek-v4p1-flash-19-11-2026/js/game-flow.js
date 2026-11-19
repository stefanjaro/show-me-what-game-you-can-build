import {
  TAU, clamp, rand, pick, dist, weightedPick, formatScore,
} from './util.js';
import {
  UPGRADES, UPGRADE_BY_ID, RARITIES, COLORS, ENEMY_TYPES,
} from './data.js';

export const flowMethods = {

  // ============================================================
  // waves
  // ============================================================
  updateWaves(dt) {
    if (this.bossPendingT > 0) {
      this.bossPendingT -= dt;
      if (this.bossPendingT <= 0) this.spawnBoss();
    }
    if (!this.bossActive) {
      this.waveT -= dt;
      if (this.waveT <= 0) this.startWave(this.wave + 1);
    }
    this.spawnT -= dt;
    if (!this.bossActive && this.bossPendingT <= 0 && this.spawnT <= 0 && this.enemies.length < 100) {
      this.spawnPack();
      const base = Math.max(0.3, 1.02 * Math.pow(0.94, this.wave - 1));
      this.spawnT = base * rand(0.78, 1.22);
    }
  },

  edgeSpawnPos() {
    const m = 60 * this.S;
    for (let tries = 0; tries < 10; tries++) {
      const side = Math.floor(this.rng.next() * 4);
      let x, y;
      if (side === 0) { x = this.rng.range(0, this.W); y = -m; }
      else if (side === 1) { x = this.W + m; y = this.rng.range(0, this.H); }
      else if (side === 2) { x = this.rng.range(0, this.W); y = this.H + m; }
      else { x = -m; y = this.rng.range(0, this.H); }
      if (dist(x, y, this.player.x, this.player.y) > 320 * this.S) return { x, y };
    }
    return { x: -m, y: this.H / 2 };
  },

  spawnPack() {
    const types = Object.entries(ENEMY_TYPES).filter(([, def]) => def.minWave <= this.wave && !def.hidden);
    if (!types.length) return;
    const chosen = weightedPick(types, ([, def]) => def.weight, () => this.rng.next());
    if (!chosen) return;
    const typeId = chosen[0];
    const pack = Math.min(5, 1 + Math.floor(this.wave / 4) + (this.rng.next() < 0.3 ? 1 : 0));
    const base = this.edgeSpawnPos();
    for (let i = 0; i < pack; i++) {
      this.spawnEnemy(typeId, {
        x: base.x + rand(-55, 55) * this.S,
        y: base.y + rand(-55, 55) * this.S,
      });
    }
  },

  // ============================================================
  // player
  // ============================================================
  updatePlayer(dt) {
    const p = this.player;
    if (p.dead) return;
    const s = this.stats;

    if (p.iframes > 0) p.iframes -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    if (p.reviveGlow > 0) p.reviveGlow -= dt;
    p.shieldT += dt;
    if (p.shield < p.shieldMax && p.shieldT > 6.5) {
      p.shield++;
      p.shieldT = 0;
      this.audio.shieldBreak();
      this.ringFx(p.x, p.y, 10, 60, 0.5, COLORS.cyan, 1.5);
    }

    let ix = 0, iy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) ix -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) ix += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) iy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) iy += 1;
    const t = this.touch;
    if (t.moveId !== null) {
      const dx = t.moveVec.x, dy = t.moveVec.y;
      const len = Math.hypot(dx, dy);
      if (len > 8) {
        const m = Math.min(1, len / 55);
        ix = (dx / len) * m;
        iy = (dy / len) * m;
      }
    }
    const il = Math.hypot(ix, iy);
    if (il > 1) { ix /= il; iy /= il; }

    const firing = this.mouse.down || t.aimId !== null;
    const baseSpeed = 340 * this.S * s.speed * (firing ? 0.86 : 1);

    if (this.dashQueued) {
      this.dashQueued = false;
      if (p.dashEnergy >= 1) {
        let dx = ix, dy = iy;
        if (!dx && !dy) {
          const aim = this.aimPoint();
          dx = aim.x - p.x; dy = aim.y - p.y;
        }
        const l = Math.hypot(dx, dy) || 1;
        dx /= l; dy /= l;
        p.dashEnergy = Math.max(0, p.dashEnergy - 1);
        p.dashT = 0.15;
        p.iframes = Math.max(p.iframes, 0.38);
        p.dashVX = dx * 1480 * this.S;
        p.dashVY = dy * 1480 * this.S;
        this.audio.dash();
        this.shakeIt(3);
        for (let i = 0; i < 10; i++) {
          this.addSpark(p.x, p.y, COLORS.cyan, rand(-160, 160), rand(-160, 160), rand(0.15, 0.4), rand(1, 2.5));
        }
        this.ringFx(p.x, p.y, p.r, 52, 0.35, COLORS.cyan, 1.5);
      }
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.x += p.dashVX * dt;
      p.y += p.dashVY * dt;
      p.vx = p.dashVX * 0.4;
      p.vy = p.dashVY * 0.4;
      if (Math.random() < 0.9) {
        this.addGlow(p.x + rand(-4, 4), p.y + rand(-4, 4), pick([COLORS.cyan, '#ffffff']),
          -p.dashVX * 0.03, -p.dashVY * 0.03, rand(0.2, 0.45), rand(1.5, 3.4));
      }
    } else {
      const targetVX = ix * baseSpeed;
      const targetVY = iy * baseSpeed;
      const accel = il > 0.01 ? 13 : 17;
      p.vx += (targetVX - p.vx) * Math.min(1, dt * accel);
      p.vy += (targetVY - p.vy) * Math.min(1, dt * accel);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (Math.hypot(p.vx, p.vy) > baseSpeed * 0.5 && Math.random() < 0.25) {
        this.addGlow(p.x - p.vx * 0.02, p.y - p.vy * 0.02, COLORS.cyan,
          -p.vx * 0.05, -p.vy * 0.05, rand(0.2, 0.5), rand(1, 2.2));
      }
    }
    p.dashEnergy = Math.min(p.dashMax, p.dashEnergy + dt * (s.dashRecharge / 1.7));

    const margin = 22 * this.S;
    p.x = clamp(p.x, margin, this.W - margin);
    p.y = clamp(p.y, margin, this.H - margin);

    const aim = this.aimPoint();
    p.aim = Math.atan2(aim.y - p.y, aim.x - p.x);

    p.trail.push({ x: p.x, y: p.y, a: 1 });
    if (p.trail.length > 22) p.trail.shift();
    for (const tr of p.trail) tr.a *= 0.86;

    if (p.fireCd > 0) p.fireCd -= dt;
    if (firing && p.fireCd <= 0) this.fire();
    if (this.novaQueued) {
      this.novaQueued = false;
      if (p.focus >= 100) this.triggerNova();
    }
    p.focus = Math.min(100, p.focus + dt * 0.35);

    p.orbitAngle += dt * 2.5;
    if (s.orbit > 0) {
      for (let i = 0; i < s.orbit; i++) {
        const a = p.orbitAngle + (i / s.orbit) * TAU;
        const bx = p.x + Math.cos(a) * 68 * this.S;
        const by = p.y + Math.sin(a) * 68 * this.S;
        for (const e of this.enemies) {
          if (e.dead) continue;
          if ((e.orbCd || 0) <= 0 && dist(bx, by, e.x, e.y) < e.r + 11 * this.S) {
            e.orbCd = 0.32;
            const dmg = this.weapon.fire.damage * 1.4 * this.damageMult() * (0.9 + i * 0.12);
            this.hitEnemy(e, dmg, { source: 'orbit', crit: false, x: bx, y: by, kb: 40 });
          }
        }
        if (Math.random() < 0.2) this.addGlow(bx, by, COLORS.violet, 0, 0, 0.3, 3);
      }
    }
    for (const e of this.enemies) if (e.orbCd > 0) e.orbCd -= dt;

    if (this.companions.length < s.starChild) {
      this.companions.push({ a: rand(0, TAU), t: rand(0.2, 0.9), x: p.x, y: p.y });
    }
    this.companions.length = Math.min(this.companions.length, s.starChild);
    for (let i = 0; i < this.companions.length; i++) {
      const c = this.companions[i];
      const a = this.time * 1.6 + i * Math.PI;
      c.x = p.x + Math.cos(a) * 56 * this.S;
      c.y = p.y + Math.sin(a) * 56 * this.S;
      c.t -= dt;
      if (c.t <= 0) {
        const target = this.nearestEnemy(c.x, c.y, 520 * this.S);
        if (target) {
          c.t = 0.85;
          const ang = Math.atan2(target.y - c.y, target.x - c.x);
          const dmg = (this.weapon.fire.damage * 1.25 + 6) * this.damageMult() * 1.1;
          this.addBullet(c.x, c.y, ang, 900 * this.S, 4 * this.S, dmg, COLORS.gold,
            { shape: 'bolt', life: 0.9, pierce: 0, crit: false });
          this.addGlow(c.x, c.y, COLORS.gold, Math.cos(ang) * -40, Math.sin(ang) * -40, 0.25, 3);
        }
      }
    }

    if (s.solar > 0) {
      p.solarT -= dt;
      if (p.solarT <= 0) {
        p.solarT = 3.8 / (1 + (s.solar - 1) * 0.28);
        const radius = 165 * this.S * (1 + (s.solar - 1) * 0.2);
        const dmg = (30 + this.wave * 5) * this.damageMult() * (0.7 + s.solar * 0.45);
        for (const e of this.enemies) {
          if (!e.dead && dist(e.x, e.y, p.x, p.y) < radius + e.r) {
            this.hitEnemy(e, dmg, { source: 'solar', crit: false, kb: 220, x: p.x, y: p.y });
          }
        }
        this.ringFx(p.x, p.y, 12, radius, 0.5, COLORS.gold, 3);
        this.flash(COLORS.gold, 0.05);
        this.audio.wave();
      }
    }
  },

  aimPoint() {
    const t = this.touch;
    if (t.aimId !== null) {
      const len = Math.hypot(t.aimVec.x, t.aimVec.y);
      if (len > 12) {
        return { x: this.player.x + (t.aimVec.x / len) * 300, y: this.player.y + (t.aimVec.y / len) * 300 };
      }
      const e = this.nearestEnemy(this.player.x, this.player.y, 900 * this.S);
      if (e) return { x: e.x, y: e.y };
      return { x: this.player.x + 200, y: this.player.y };
    }
    return { x: this.mouse.x, y: this.mouse.y };
  },

  nearestEnemy(x, y, maxR = Infinity) {
    let best = null, bestD = maxR * maxR;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = e; }
    }
    return best;
  },

  damageMult() {
    const p = this.player;
    let m = this.stats.damage;
    if (this.stats.overcharge && p.hp <= p.maxHp / 2) m *= 1.35;
    if (this.stats.reaper) m *= 1 + Math.min(0.6, (this.combo / 5) * 0.01);
    return m;
  },

  fire() {
    const p = this.player;
    const w = this.weapon.fire;
    const s = this.stats;
    const count = (w.count || 1) + (this.weaponId === 'halo' ? Math.min(2, s.count) : s.count);
    const spread = w.spread;
    const baseAngle = p.aim;
    const dmgBase = w.damage * this.damageMult();
    const muzzle = 18 * this.S;
    const isPrism = s.prism && (++p.shotCounter % 6 === 0);
    for (let i = 0; i < count; i++) {
      const frac = count > 1 ? (i / (count - 1) - 0.5) : 0;
      const angle = baseAngle + frac * spread + rand(-0.012, 0.012);
      const crit = Math.random() < s.crit;
      const dmg = dmgBase * (crit ? s.critMul : 1);
      this.addBullet(
        p.x + Math.cos(angle) * muzzle, p.y + Math.sin(angle) * muzzle, angle,
        w.speed * this.S * s.projSpeed, w.radius * this.S * (crit ? 1.25 : 1),
        dmg, this.weapon.color,
        {
          shape: w.shape, life: w.life * (1 + s.projSpeed * 0.12),
          pierce: (w.pierce || 0) + s.pierce, crit,
          knockback: (this.weaponId === 'lance' ? 130 : 60) * s.knockback,
        },
      );
    }
    if (isPrism) {
      for (let i = 0; i < 5; i++) {
        const angle = baseAngle + (i - 2) * 0.16;
        const crit = Math.random() < s.crit;
        this.addBullet(p.x + Math.cos(angle) * muzzle, p.y + Math.sin(angle) * muzzle,
          angle, w.speed * this.S * s.projSpeed, w.radius * this.S * 0.85,
          dmgBase * 0.85 * (crit ? s.critMul : 1), COLORS.gold,
          { shape: 'bolt', life: (w.life || 1) * 1.1, pierce: s.pierce, crit });
      }
      this.ringFx(p.x, p.y, 8, 40, 0.2, COLORS.gold, 1.5);
    }
    p.fireCd = w.cd / s.rate;
    const mx = p.x + Math.cos(baseAngle) * 20 * this.S;
    const my = p.y + Math.sin(baseAngle) * 20 * this.S;
    this.addGlow(mx, my, this.weapon.color, Math.cos(baseAngle) * 30, Math.sin(baseAngle) * 30, 0.16, rand(4, 8) * this.S);
    this.addSpark(mx, my, this.weapon.color, Math.cos(baseAngle) * rand(40, 160), Math.sin(baseAngle) * rand(40, 160), 0.16, rand(1, 2.4));
    this.shakeIt(this.weaponId === 'lance' ? 1.6 : 0.7);
    this.audio.shoot(this.weaponId);
  },

  addBullet(x, y, angle, speed, r, damage, color, opts = {}) {
    const b = {
      x, y, px: x, py: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r, damage, color,
      shape: opts.shape || 'bolt',
      life: opts.life || 1.2,
      pierce: opts.pierce || 0,
      crit: !!opts.crit,
      knockback: opts.knockback || 60,
      ricochets: opts.ricochets ?? this.stats.ricochet,
      hits: new Set(),
      dead: false,
      spin: rand(0, TAU),
      phase: 'out',
      hitCd: new Map(),
      age: 0,
      returnT: 0,
    };
    if (b.shape === 'chakram') {
      b.returnT = b.life * 0.42;
      b.pierce = 999;
      b.vx *= 0.9;
      b.vy *= 0.9;
    }
    this.bullets.push(b);
    return b;
  },

  triggerNova() {
    const p = this.player;
    const s = this.stats;
    p.focus = 0;
    p.iframes = Math.max(p.iframes, 0.6);
    const radius = 340 * this.S * s.novaPower;
    const clearR = 460 * this.S * Math.sqrt(s.novaPower);
    const dmg = (55 + this.wave * 7) * s.novaPower * this.damageMult();
    let cleared = 0;
    for (const b of this.enemyBullets) {
      if (!b.dead && dist(b.x, b.y, p.x, p.y) < clearR) {
        b.dead = true;
        cleared++;
        this.addGlow(b.x, b.y, COLORS.gold, rand(-80, 80), rand(-80, 80), rand(0.3, 0.7), rand(2, 4));
      }
    }
    for (const e of this.enemies) {
      if (!e.dead && dist(e.x, e.y, p.x, p.y) < radius + e.r) {
        this.hitEnemy(e, dmg, { source: 'nova', crit: false, x: p.x, y: p.y, kb: 520 * s.knockback });
        if (!e.isBoss) { e.slowT = 1.5; e.slowAmt = 0.6; }
      }
    }
    this.ringFx(p.x, p.y, 16, 560 * Math.sqrt(s.novaPower), 0.9, COLORS.gold, 5);
    this.ringFx(p.x, p.y, 8, 380, 0.6, COLORS.cyan, 2);
    for (let i = 0; i < 46; i++) {
      const a = rand(0, TAU), sp = rand(120, 620);
      this.addSpark(p.x, p.y, pick([COLORS.gold, COLORS.cyan, '#ffffff']),
        Math.cos(a) * sp, Math.sin(a) * sp, rand(0.3, 0.9), rand(1.5, 3.5));
    }
    if (s.supernova) {
      this.zones.push({
        x: p.x, y: p.y, r: 150 * this.S * Math.sqrt(s.novaPower), life: 6, maxLife: 6,
        tick: 0, dps: (16 + this.wave * 3) * this.damageMult(), color: COLORS.gold,
      });
    }
    this.flash('#d8fbff', 0.45);
    this.shakeIt(16);
    this.slowT = 0.32;
    this.slowFactor = 0.32;
    this.audio.nova();
    this.score += cleared * 5;
  },

  // ============================================================
  // pickups & progression
  // ============================================================
  addMote(x, y, value, vx = 0, vy = 0, big = false) {
    this.motes.push({
      x, y, vx, vy, value, r: (big ? 7 : 4.5) * this.S, life: 30, phase: rand(0, TAU),
    });
  },

  addHeart(x, y) {
    this.hearts.push({ x, y, vx: rand(-40, 40), vy: rand(-40, 40), r: 11 * this.S, life: 22, phase: rand(0, TAU) });
  },

  updateMotes(dt) {
    const p = this.player;
    const magnetR = 155 * this.S * this.stats.magnet;
    for (const m of this.motes) {
      m.life -= dt;
      m.phase += dt * 3;
      const d = dist(m.x, m.y, p.x, p.y);
      m.age = (m.age || 0) + dt;
      if (m.age > 0.55) {
        const a = Math.atan2(p.y - m.y, p.x - m.x);
        const bonus = m.inside ? 700 : 0;
        m.inside = d < magnetR;
        const targetSpeed = (m.inside ? 520 : 150 + Math.max(0, 1 - d / 1100) * 260) * this.stats.magnet;
        m.vx += (Math.cos(a) * targetSpeed - m.vx) * Math.min(1, dt * 3.6);
        m.vy += (Math.sin(a) * targetSpeed - m.vy) * Math.min(1, dt * 3.6);
        m.vx += Math.cos(a) * bonus * dt;
        m.vy += Math.sin(a) * bonus * dt;
      } else {
        m.vx *= Math.exp(-2.8 * dt);
        m.vy *= Math.exp(-2.8 * dt);
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (d < p.r + m.r + 6) {
        m.dead = true;
        this.gainXp(m.value);
        this.audio.pickup();
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU);
          this.addGlow(p.x, p.y, m.value > 3 ? COLORS.gold : COLORS.mint, Math.cos(a) * 80, Math.sin(a) * 80, 0.3, 2);
        }
      }
      if (m.life <= 0) m.dead = true;
    }
    this.motes = this.motes.filter(m => !m.dead);

    for (const h of this.hearts) {
      h.life -= dt;
      h.phase += dt * 2;
      const d = dist(h.x, h.y, p.x, p.y);
      if (d < magnetR * 1.25) {
        const a = Math.atan2(p.y - h.y, p.x - h.x);
        h.vx += Math.cos(a) * 520 * dt;
        h.vy += Math.sin(a) * 520 * dt;
      }
      h.vx *= Math.exp(-2.4 * dt);
      h.vy *= Math.exp(-2.4 * dt);
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      if (d < p.r + h.r && p.hp < p.maxHp) {
        h.dead = true;
        p.hp = Math.min(p.maxHp, p.hp + 1);
        this.audio.heal();
        this.addText(p.x, p.y - 24, '+1 LIGHT', COLORS.gold, 13);
        this.ringFx(p.x, p.y, 8, 54, 0.4, COLORS.gold, 2);
      }
      if (h.life <= 0) h.dead = true;
    }
    this.hearts = this.hearts.filter(h => !h.dead);
  },

  gainXp(value) {
    this.xp += value;
    let leveled = false;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.pendingLevels++;
      this.xpNext = this.xpNeeded(this.level);
      leveled = true;
    }
    if (leveled) {
      this.audio.levelup();
      this.flash('#fff2cd', 0.12);
      this.ringFx(this.player.x, this.player.y, 10, 120, 0.6, COLORS.gold, 2);
      this.el.xpFill.classList.remove('flash');
      void this.el.xpFill.offsetWidth;
      this.el.xpFill.classList.add('flash');
      if (this.state === 'running') this.openLevelUp();
    }
  },

  openLevelUp() {
    if (this.pendingLevels <= 0) return;
    this.state = 'levelup';
    this.dashQueued = false;
    this.novaQueued = false;
    document.body.classList.remove('cursor-firing');
    this.levelChoices = this.rollChoices();
    this.ui?.showLevelUp?.(this.level, this.levelChoices, this.rerollsLeft);
    this.audio.setIntensity(0.12);
  },

  rollChoices() {
    const pool = UPGRADES.filter(u => {
      if ((this.upgrades[u.id] || 0) >= u.max) return false;
      if (u.needsHurt && this.player.hp >= this.player.maxHp) return false;
      return true;
    });
    const picked = [];
    const available = pool.slice();
    while (picked.length < 3 && available.length > 0) {
      const choice = weightedPick(available, u => {
        let w = RARITIES[u.rarity].weight;
        if (u.rarity === 'epic') w *= 1 + this.level * 0.045;
        if (u.rarity === 'rare') w *= 1 + this.level * 0.02;
        return w;
      }, () => this.rng.next());
      if (!choice) break;
      picked.push(choice);
      available.splice(available.indexOf(choice), 1);
    }
    return picked;
  },

  chooseUpgradeIndex(idx) {
    if (this.state !== 'levelup') return;
    const c = this.levelChoices?.[idx];
    if (c) this.chooseUpgrade(c.id);
  },

  chooseUpgrade(id) {
    if (this.state !== 'levelup') return;
    const def = UPGRADE_BY_ID[id];
    if (!def) return;
    this.applyUpgrade(id, false);
    this.pendingLevels = Math.max(0, this.pendingLevels - 1);
    this.audio.select();
    const p = this.player;
    for (let i = 0; i < 24; i++) {
      const a = rand(0, TAU), sp = rand(40, 260);
      this.addGlow(p.x, p.y, pick([COLORS.gold, COLORS.teal, COLORS.cyan]),
        Math.cos(a) * sp, Math.sin(a) * sp, rand(0.4, 0.9), rand(2, 4));
    }
    this.ringFx(p.x, p.y, 8, 110, 0.5, COLORS.gold, 2.5);
    if (this.pendingLevels > 0) {
      this.levelChoices = this.rollChoices();
      this.ui?.showLevelUp?.(this.level, this.levelChoices, this.rerollsLeft);
    } else {
      this.state = 'running';
      this.player.iframes = Math.max(this.player.iframes, 0.7);
      this.ui?.hideLevelUp?.();
      this.audio.setIntensity(this.waveIntensity());
    }
  },

  reroll() {
    if (this.state !== 'levelup' || this.rerollsLeft <= 0) return;
    this.rerollsLeft--;
    this.levelChoices = this.rollChoices();
    this.ui?.showLevelUp?.(this.level, this.levelChoices, this.rerollsLeft);
    this.audio.uiClick();
  },

  applyUpgrade(id) {
    const def = UPGRADE_BY_ID[id];
    if (!def) return;
    this.upgrades[id] = (this.upgrades[id] || 0) + 1;
    def.apply(this.stats, this);
    const p = this.player;
    if (id === 'phoenix') this.revives += 1;
    p.maxHp = this.stats.maxHp;
    p.hp = Math.min(p.hp, p.maxHp);
    const oldDash = p.dashMax;
    p.dashMax = Math.max(1, this.stats.dashCharges);
    if (p.dashMax > oldDash) p.dashEnergy = Math.min(p.dashMax, p.dashEnergy + (p.dashMax - oldDash));
    p.shieldMax = this.stats.shieldMax;
    p.shield = Math.min(p.shield, p.shieldMax);
    if (id === 'solar' && this.upgrades[id] === 1) p.solarT = 1.6;
  },

  // ============================================================
  // zones & particles
  // ============================================================
  updateZones(dt) {
    for (const z of this.zones) {
      z.life -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.35;
        for (const e of this.enemies) {
          if (!e.dead && dist(e.x, e.y, z.x, z.y) < z.r + e.r) {
            this.hitEnemy(e, z.dps * 0.35, { source: 'burn', crit: false });
          }
        }
        for (let i = 0; i < 2; i++) {
          const a = rand(0, TAU), r = rand(0, z.r);
          this.addGlow(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, COLORS.gold,
            rand(-20, 20), rand(-50, -20), rand(0.3, 0.7), rand(2, 4));
        }
      }
      if (z.life <= 0) z.dead = true;
    }
    this.zones = this.zones.filter(z => !z.dead);
  },

  addParticle(p) {
    if (this.particles.length > 1300) return;
    this.particles.push(p);
  },

  addGlow(x, y, color, vx, vy, life, size) {
    this.addParticle({
      type: 'glow', x, y, vx, vy, life, maxLife: life, color, size,
      drag: 2.5,
    });
  },

  addSpark(x, y, color, vx, vy, life, size) {
    this.addParticle({
      type: 'spark', x, y, vx, vy, life, maxLife: life, color, size, drag: 3.2,
    });
  },

  addDebris(x, y, color, vx, vy, size, life) {
    this.addParticle({
      type: 'debris', x, y, vx, vy, life, maxLife: life, color, size,
      rot: rand(0, TAU), vr: rand(-8, 8), drag: 1.8,
    });
  },

  addText(x, y, text, color, size, style) {
    this.addParticle({
      type: 'text', x, y, vx: rand(-8, 8), vy: -46, life: 0.8, maxLife: 0.8,
      text, color, size, style: style || '',
    });
  },

  addEffect(fx) {
    fx.maxLife = fx.maxLife || fx.life;
    this.addParticle(fx);
  },

  ringFx(x, y, r0, r1, life, color, width) {
    this.addParticle({ type: 'ring', x, y, r0, r1, life, maxLife: life, color, width: width || 1.5 });
  },

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      if (p.type === 'glow' || p.type === 'spark' || p.type === 'debris') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const drag = Math.exp(-(p.drag || 2) * dt);
        p.vx *= drag;
        p.vy *= drag;
        if (p.type === 'debris') p.rot += p.vr * dt;
      } else if (p.type === 'text') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= Math.exp(-1.6 * dt);
      }
    }
    this.particles = this.particles.filter(p => p.life > 0);
  },

  // ============================================================
  // HUD
  // ============================================================
  updateHud() {
    const p = this.player;
    const s = this.stats;
    const hud = this._hud;
    const el = this.el;

    if (hud.maxHp !== p.maxHp) {
      hud.maxHp = p.maxHp;
      el.hp.innerHTML = '';
      for (let i = 0; i < p.maxHp; i++) {
        const span = document.createElement('span');
        span.className = 'pip';
        el.hp.appendChild(span);
      }
      hud.hp = -1;
    }
    if (hud.hp !== p.hp) {
      const lost = p.hp < hud.hp;
      hud.hp = p.hp;
      const pips = el.hp.children;
      for (let i = 0; i < pips.length; i++) {
        pips[i].classList.toggle('empty', i >= p.hp);
        if (lost && i === Math.max(0, p.hp)) {
          pips[i].classList.remove('hurt');
          void pips[i].offsetWidth;
          pips[i].classList.add('hurt');
        }
      }
    }

    if (hud.shieldMax !== p.shieldMax) {
      hud.shieldMax = p.shieldMax;
      el.shield.innerHTML = '';
      for (let i = 0; i < p.shieldMax; i++) {
        const span = document.createElement('span');
        span.className = 'pip';
        el.shield.appendChild(span);
      }
      hud.shield = -1;
    }
    if (hud.shield !== p.shield) {
      hud.shield = p.shield;
      const pips = el.shield.children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('empty', i >= p.shield);
    }

    if (hud.dashMax !== p.dashMax) {
      hud.dashMax = p.dashMax;
      el.dash.innerHTML = '';
      for (let i = 0; i < p.dashMax; i++) {
        const span = document.createElement('span');
        span.className = 'dash-pip';
        el.dash.appendChild(span);
      }
      hud.dash = -1;
    }
    const dashFull = Math.floor(p.dashEnergy + 0.001);
    if (hud.dash !== dashFull) {
      hud.dash = dashFull;
      const pips = el.dash.children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('empty', i >= dashFull);
    }

    if (hud.wave !== this.wave) {
      hud.wave = this.wave;
      el.waveNum.textContent = this.wave;
      el.waveSub.textContent = this.wave % 5 === 0 ? '· HORROR' : '';
    }
    const waveProgress = clamp(1 - this.waveT / this.waveDuration, 0, 1);
    if (hud.waveProgress === undefined || Math.abs(hud.waveProgress - waveProgress) > 0.003) {
      hud.waveProgress = waveProgress;
      el.waveFill.style.transform = `scaleX(${waveProgress.toFixed(3)})`;
    }

    const score = Math.floor(this.score);
    if (hud.score !== score) {
      hud.score = score;
      el.score.textContent = formatScore(score);
    }
    const best = Math.max(this.save.data.bestScore, score);
    if (hud.best !== best) {
      hud.best = best;
      el.best.textContent = 'BEST ' + formatScore(best);
    }

    if (hud.combo !== this.combo) {
      const prev = hud.combo;
      hud.combo = this.combo;
      if (this.combo > 1) {
        el.combo.innerHTML = `×${this.combo}<span class="cmul">${this.comboMul.toFixed(1)}× SCORE</span>`;
        el.combo.classList.add('on');
        if (this.combo > (prev || 0)) {
          el.combo.classList.remove('pop');
          void el.combo.offsetWidth;
          el.combo.classList.add('pop');
        }
      } else {
        el.combo.classList.remove('on');
      }
    }

    if (hud.level !== this.level) {
      hud.level = this.level;
      el.level.textContent = 'LV ' + this.level;
    }
    const xpFrac = clamp(this.xp / this.xpNext, 0, 1);
    if (hud.xpFrac === undefined || Math.abs(hud.xpFrac - xpFrac) > 0.002) {
      hud.xpFrac = xpFrac;
      el.xpFill.style.transform = `scaleX(${xpFrac.toFixed(3)})`;
    }
    if (hud.xp !== this.xp) {
      hud.xp = this.xp;
      el.xpText.textContent = `${Math.floor(this.xp)} / ${this.xpNext}`;
    }

    const boss = this.bossRef && !this.bossRef.dead ? this.bossRef : null;
    if (boss) {
      if (!el.bossBar.classList.contains('on')) el.bossBar.classList.add('on');
      const frac = clamp(boss.hp / boss.maxHp, 0, 1);
      if (hud.bossFrac === undefined || Math.abs(hud.bossFrac - frac) > 0.002) {
        hud.bossFrac = frac;
        el.bossFill.style.transform = `scaleX(${frac.toFixed(3)})`;
        el.bossHp.textContent = `${Math.ceil(frac * 100)}%`;
      }
      if (hud.bossName !== boss.name) {
        hud.bossName = boss.name;
        el.bossName.textContent = boss.name;
      }
      el.bossBar.classList.toggle('low', frac < 0.35);
    } else if (el.bossBar.classList.contains('on')) {
      el.bossBar.classList.remove('on');
      el.bossBar.classList.remove('low');
      hud.bossFrac = undefined;
    }

    const ready = p.focus >= 100;
    if (hud.nova !== ready) {
      hud.nova = ready;
      el.novaHint.classList.toggle('on', ready);
      el.touchNova?.classList.toggle('ready', ready);
    }

    const low = p.hp <= 2 ? 0.22 + 0.09 * Math.sin(this.time * 4) : 0;
    const hurtFlash = this.lastHurtAt ? Math.max(0, 0.55 - (this.time - this.lastHurtAt) * 2.2) : 0;
    el.danger.style.opacity = clamp(low + hurtFlash, 0, 0.9);
  },
};
