/* POLARIS — actors: bullets, enemies, bosses, pickups */

import { TAU, rand, clamp, lerp, angleTo, chance, sign } from './util.js';
import { ENEMIES, ELITE, BOSS_DEFS, POLARITY_COLOR, COLORS, BAL } from './data.js';
import { glowSprite } from './fx.js';

let ID = 1;
const newId = () => ID++;

/* ============================ BULLET ============================ */
export class Bullet {
  constructor(o) {
    this.id = newId();
    this.x = o.x; this.y = o.y;
    this.vx = o.vx || 0; this.vy = o.vy || 0;
    this.r = o.r || 5;
    this.dmg = o.dmg || 10;
    this.friendly = !!o.friendly;
    this.polarity = o.polarity || 0;
    this.life = o.life || 2.4;
    this.pierce = o.pierce || 0;
    this.homing = o.homing || 0;
    this.chain = o.chain || 0;
    this.kills = 0;
    this.dead = false;
    this.color = POLARITY_COLOR[this.polarity];
    this.trail = [];
    this.kind = o.kind || 'bolt';
    this.knock = o.knock || 0;
    this.onHit = o.onHit || null;   // callback for missiles etc.
    this.burn = o.burn || 0;
    this.seen = new Set();
  }
  update(dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (this.homing > 0) {
      const t = game.nearestEnemy(this.x, this.y, 520, e => !e.dead && e.polarity !== this.polarity);
      if (t) {
        const a = angleTo(this.x, this.y, t.x, t.y);
        const ca = Math.atan2(this.vy, this.vx);
        let d = a - ca;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        const na = ca + clamp(d, -this.homing * dt, this.homing * dt);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
    }
    /* matching-colour bolts are vacuumed into the star */
    if (!this.friendly && game.player && this.polarity === game.player.polarity) {
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const R = BAL.player.absorbRadius + p.r + this.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < R * R) {
        const d = Math.sqrt(d2) || 1;
        this.vx += (dx / d) * 3200 * dt;
        this.vy += (dy / d) * 3200 * dt;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 980) { this.vx *= 980 / sp; this.vy *= 980 / sp; }
        if (chance(dt * 30)) game.fx.burst(this.x, this.y, 1, this.color, { speed: 60, life: 0.25, size: 2 });
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (game.t % 0.03 < dt) {
      this.trail.push(this.x, this.y);
      if (this.trail.length > 8) this.trail.splice(0, 2);
    }
    if (this.x < -80 || this.y < -80 || this.x > game.world.w + 80 || this.y > game.world.h + 80) this.dead = true;
  }
  draw(ctx) {
    const c = this.color;
    const g = glowSprite(c, Math.max(24, this.r * 7));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.85;
    ctx.drawImage(g, this.x - g.width / 2, this.y - g.height / 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* ============================ ENEMY ============================ */
export class Enemy {
  constructor(type, x, y, opts = {}) {
    const d = ENEMIES[type];
    this.id = newId();
    this.type = type;
    this.def = d;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.elite = !!opts.elite;
    this.polarity = opts.polarity ?? (chance(0.5) ? 0 : 1);
    const hpMul = this.elite ? ELITE.hpMul : 1;
    this.maxHp = d.hp * hpMul * (opts.hpMul || 1);
    this.hp = this.maxHp;
    this.r = d.radius * (this.elite ? ELITE.radiusMul : 1);
    this.speed = d.speed * (this.elite ? ELITE.speedMul : 1) * rand(0.94, 1.06);
    this.contact = d.contact * (this.elite ? ELITE.contactMul : 1);
    this.xp = Math.round(d.xp * (this.elite ? ELITE.xpMul : 1) * (opts.xpMul || 1));
    this.score = Math.round(d.score * (this.elite ? ELITE.scoreMul : 1));
    this.state = 'spawn';
    this.spawnT = opts.spawnDelay ?? 0.66;
    this.flash = 0;
    this.angle = rand(TAU);
    this.phase = rand(TAU);
    this.t = 0;
    this.dead = false;
    this.shootT = rand(0.4, 1.4);
    this.burstLeft = 0;
    this.burstT = 0;
    this.lungeState = 0;      // 0 idle, 1 windup, 2 lunging, 3 recover
    this.lungeT = 0;
    this.lungeAng = 0;
    this.armT = -1;           // bomber
    this.spawnGapT = rand(1, 2.5);
    this.burnT = 0; this.burnDps = 0;
    this.bob = rand(TAU);
    this.spawnFrom = opts.spawnFrom || null;
  }

  hurt(dmg, game, hx, hy, opts = {}) {
    if (this.state === 'spawn' || this.dead) return 0;
    if (this.polarity === opts.polarity && opts.polarity !== undefined) return 0;
    this.hp -= dmg;
    this.flash = 0.09;
    if (opts.burn) { this.burnT = Math.max(this.burnT, 2.6); this.burnDps = Math.max(this.burnDps, opts.burn); }
    if (opts.knock) {
      const a = angleTo(hx, hy, this.x, this.y);
      this.vx += Math.cos(a) * opts.knock;
      this.vy += Math.sin(a) * opts.knock;
    }
    if (this.hp <= 0) { this.kill(game, opts); return dmg; }
    return dmg;
  }

  kill(game, opts = {}) {
    if (this.dead) return;
    this.dead = true;
    game.onEnemyKilled(this, opts);
    if (this.type === 'splitter') {
      for (let i = 0; i < this.def.splits; i++) {
        const a = rand(TAU);
        const e = new Enemy('shard', this.x + Math.cos(a) * 20, this.y + Math.sin(a) * 20, {
          polarity: this.polarity, spawnDelay: 0.25,
        });
        e.vx = Math.cos(a) * 160; e.vy = Math.sin(a) * 160;
        game.enemies.push(e);
      }
    }
    if (this.type === 'bomber') game.explode(this.x, this.y, this.def.blastR, this.def.blastDmg, this.polarity, true);
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * dt;
      if (chance(dt * 14)) game.fx.burst(this.x + rand(-this.r, this.r), this.y + rand(-this.r, this.r), 1, '#ffb347', { speed: 40, life: 0.4, size: 2.6 });
      if (this.hp <= 0 && !this.dead) { this.kill(game, { silent: true }); return; }
    }
    if (this.state === 'spawn') {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.state = 'live';
        game.fx.burst(this.x, this.y, 8, POLARITY_COLOR[this.polarity], { speed: 190, life: 0.4, size: 3 });
      }
      return;
    }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const B = this.def;

    switch (this.type) {
      case 'grunt': {
        const wob = Math.sin(this.t * 3 + this.phase) * 0.35;
        this._steer(ux, uy, wob, dt);
        break;
      }
      case 'swarm': {
        const wob = Math.sin(this.t * 9 + this.phase) * 0.8;
        this._steer(ux, uy, wob, dt);
        break;
      }
      case 'shard': this._steer(ux, uy, Math.sin(this.t * 7 + this.phase) * 0.5, dt); break;
      case 'tank': this._steer(ux, uy, 0, dt); break;
      case 'splitter': this._steer(ux, uy, Math.sin(this.t * 2 + this.phase) * 0.25, dt); break;

      case 'shooter': {
        const want = B.range;
        let move = 0;
        if (d > want * 1.05) move = 1;
        else if (d < want * 0.6) move = -1;
        const strafe = Math.sin(this.t * 1.4 + this.phase) * 0.75;
        const tx = ux * move + (-uy) * strafe;
        const ty = uy * move + (ux) * strafe;
        const tl = Math.hypot(tx, ty) || 1;
        this.vx = lerp(this.vx, (tx / tl) * this.speed, dt * 3.4);
        this.vy = lerp(this.vy, (ty / tl) * this.speed, dt * 3.4);
        this.shootT -= dt;
        if (this.burstLeft > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) {
            this.burstLeft--; this.burstT = B.burstGap;
            const a = angleTo(this.x, this.y, p.x, p.y) + rand(-0.07, 0.07);
            game.spawnEnemyBullet(this.x, this.y, a, B.bulletSpeed, B.bulletDmg, B.bulletR, this.polarity);
            game.fx.burst(this.x, this.y, 3, POLARITY_COLOR[this.polarity], { speed: 120, life: 0.25, size: 2.6 });
          }
        } else if (this.shootT <= 0 && d < 620) {
          this.burstLeft = B.burst; this.burstT = 0; this.shootT = B.fireGap * rand(0.85, 1.2);
        }
        break;
      }

      case 'darter': {
        if (this.lungeState === 0) {
          this._steer(ux, uy, 0, dt, 0.55);
          if (d < B.sight && chance(dt * 0.9)) {
            this.lungeState = 1; this.lungeT = B.windup;
            this.lungeAng = angleTo(this.x, this.y, p.x, p.y);
            game.fx.ring(this.x, this.y, this.r * 3.4, POLARITY_COLOR[this.polarity], B.windup, 3);
          }
        } else if (this.lungeState === 1) {
          this.lungeT -= dt;
          this.vx *= 0.82; this.vy *= 0.82;
          this.lungeAng = lerp(this.lungeAng, angleTo(this.x, this.y, p.x, p.y), dt * 2.4);
          if (this.lungeT <= 0) {
            this.lungeState = 2; this.lungeT = B.lungeTime;
            this.vx = Math.cos(this.lungeAng) * B.lunge;
            this.vy = Math.sin(this.lungeAng) * B.lunge;
            game.fx.burst(this.x, this.y, 6, POLARITY_COLOR[this.polarity], { speed: 220, life: 0.3, size: 3, angle: this.lungeAng + Math.PI, spread: 1.4 });
          }
        } else if (this.lungeState === 2) {
          this.lungeT -= dt;
          if (this.lungeT <= 0) { this.lungeState = 3; this.lungeT = B.recover; }
        } else {
          this.lungeT -= dt;
          this.vx *= 0.9; this.vy *= 0.9;
          if (this.lungeT <= 0) this.lungeState = 0;
        }
        break;
      }

      case 'bomber': {
        const armed = this.armT >= 0;
        this._steer(ux, uy, 0, dt, armed ? 1.35 : 1);
        if (!armed && d < 165) { this.armT = B.fuse; game.fx.ring(this.x, this.y, this.r * 4.4, '#ffb347', B.fuse, 4); }
        if (armed) {
          this.armT -= dt;
          this.vx *= 0.94; this.vy *= 0.94;
          if (this.armT <= 0) { this.dead = true; game.explode(this.x, this.y, B.blastR, B.blastDmg, this.polarity, true); game.onEnemyKilled(this, {}); }
        }
        break;
      }

      case 'spawner': {
        this._steer(ux, uy, 0, dt, 0.7);
        this.spawnGapT -= dt;
        if (this.spawnGapT <= 0) {
          this.spawnGapT = B.spawnGap;
          const a = rand(TAU);
          const e = new Enemy(B.spawnType, this.x + Math.cos(a) * 46, this.y + Math.sin(a) * 46, { polarity: this.polarity });
          game.enemies.push(e);
          game.fx.ring(this.x, this.y, 60, POLARITY_COLOR[this.polarity], 0.4, 3);
        }
        break;
      }

      case 'sniper': {
        const want = B.range;
        let move = 0;
        if (d > want * 1.1) move = 1;
        else if (d < want * 0.75) move = -1;
        this.vx = lerp(this.vx, ux * this.speed * move, dt * 3);
        this.vy = lerp(this.vy, uy * this.speed * move, dt * 3);
        this.shootT -= dt;
        if (this.shootT <= 0 && d < 760 && this.lungeState === 0) {
          this.lungeState = 1; this.lungeT = B.telegraph;
          this.lungeAng = angleTo(this.x, this.y, p.x, p.y);
        }
        if (this.lungeState === 1) {
          this.lungeT -= dt;
          this.lungeAng = lerp(this.lungeAng, angleTo(this.x, this.y, p.x, p.y), dt * 1.5);
          if (this.lungeT <= 0) {
            this.lungeState = 0;
            this.shootT = B.fireGap * rand(0.9, 1.15);
            const lead = 0.14;
            const a = angleTo(this.x, this.y, p.x + p.vx * lead, p.y + p.vy * lead);
            game.spawnEnemyBullet(this.x, this.y, a, B.bulletSpeed, B.bulletDmg, B.bulletR, this.polarity, { big: true });
            game.fx.burst(this.x, this.y, 10, POLARITY_COLOR[this.polarity], { speed: 260, life: 0.35, size: 3.4, angle: a, spread: 0.9 });
            game.shake(5);
          }
        }
        break;
      }
    }

    /* integrate + world bounds */
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const pad = this.r + 10;
    this.x = clamp(this.x, pad, game.world.w - pad);
    this.y = clamp(this.y, pad, game.world.h - pad);
    this.angle = Math.atan2(this.vy, this.vx);
    this.bob += dt * 3;
  }

  _steer(ux, uy, wob, dt, mul = 1) {
    const a = Math.atan2(uy, ux) + wob;
    const tx = Math.cos(a) * this.speed * mul;
    const ty = Math.sin(a) * this.speed * mul;
    const k = 1 - Math.pow(0.0016, dt);
    this.vx += (tx - this.vx) * k;
    this.vy += (ty - this.vy) * k;
  }

  /* ---------- drawing ---------- */
  draw(ctx, game) {
    const pol = POLARITY_COLOR[this.polarity];
    const spawn = this.state === 'spawn';
    const t = spawn ? clamp(1 - this.spawnT / 0.66, 0, 1) : 1;
    const r = this.r * (spawn ? 0.5 + t * 0.5 : 1);

    if (spawn) {
      /* telegraph */
      const pulse = 0.5 + Math.sin(this.t * 18) * 0.5;
      ctx.save();
      ctx.globalAlpha = 0.35 + pulse * 0.4;
      ctx.strokeStyle = pol;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * (1.9 - t * 0.8), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = pol;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * t, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }

    const flash = this.flash > 0;
    const g = glowSprite(pol, this.r * 4.2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + (this.elite ? 0.3 : 0);
    ctx.drawImage(g, this.x - g.width / 2, this.y - g.height / 2);
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);

    /* elite ring */
    if (this.elite) {
      ctx.save();
      ctx.rotate(this.t * 1.7);
      ctx.strokeStyle = pol;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 8, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const bodyFill = flash ? '#ffffff' : '#0b0e1e';
    const edge = flash ? '#ffffff' : pol;
    ctx.fillStyle = bodyFill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = this.elite ? 3 : 2.2;
    ctx.lineJoin = 'round';
    const shapeAng = this.angle + Math.PI / 2;
    ctx.rotate(this.type === 'darter' || this.type === 'sniper' ? this.angle : shapeAng * 0.2 + this.t * (this.type === 'swarm' ? 3 : 0.4));

    this._path(ctx, r, this.t);
    ctx.fill();
    ctx.stroke();

    /* inner colour core */
    if (!flash) {
      ctx.fillStyle = pol;
      ctx.globalAlpha = 0.9;
      this._core(ctx, r, this.t);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    /* sniper telegraph line */
    if (this.type === 'sniper' && this.lungeState === 1) {
      const k = 1 - this.lungeT / this.def.telegraph;
      ctx.save();
      ctx.globalAlpha = 0.25 + k * 0.55;
      ctx.strokeStyle = pol;
      ctx.lineWidth = 1.5 + k * 2.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + Math.cos(this.lungeAng) * 900, this.y + Math.sin(this.lungeAng) * 900);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* hp bar for elites / tanks */
    if ((this.elite || this.type === 'tank') && this.hp < this.maxHp) {
      const w = this.r * 2.2, h = 4;
      const x = this.x - w / 2, y = this.y - this.r - 12;
      ctx.save();
      ctx.fillStyle = 'rgba(4,5,12,0.75)';
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = pol;
      ctx.fillRect(x, y, w * clamp(this.hp / this.maxHp, 0, 1), h);
      ctx.restore();
    }
  }

  _path(ctx, r, t) {
    ctx.beginPath();
    switch (this.def.shape) {
      case 'jag': {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * TAU;
          const rr = i % 2 === 0 ? r : r * 0.66;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      case 'diamond': ctx.rect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6); break;
      case 'pent': {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU - Math.PI / 2;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      case 'arrow':
        ctx.moveTo(r * 1.25, 0); ctx.lineTo(-r * 0.8, r * 0.85); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.8, -r * 0.85);
        ctx.closePath();
        break;
      case 'hex': {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const x = Math.cos(a) * r, y = Math.sin(a) * r;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      case 'blob': {
        for (let i = 0; i <= 20; i++) {
          const a = (i / 20) * TAU;
          const rr = r * (0.86 + Math.sin(a * 3 + t * 3) * 0.16);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        break;
      }
      case 'circle': ctx.arc(0, 0, r, 0, TAU); break;
      case 'ring': ctx.arc(0, 0, r, 0, TAU); break;
      case 'eye': ctx.ellipse(0, 0, r * 1.15, r * 0.8, 0, 0, TAU); break;
      default: ctx.arc(0, 0, r, 0, TAU);
    }
  }

  _core(ctx, r, t) {
    switch (this.def.shape) {
      case 'ring':
        ctx.beginPath(); ctx.arc(0, 0, r * 0.42, 0, TAU); ctx.fill();
        for (let i = 0; i < 4; i++) {
          const a = t * 2 + (i / 4) * TAU;
          ctx.beginPath(); ctx.arc(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2, 3, 0, TAU); ctx.fill();
        }
        break;
      case 'eye': {
        const aim = this.lungeState === 1 ? this.lungeAng : this.angle;
        ctx.save(); ctx.rotate(aim - (this.angle + Math.PI / 2) * 0.2 - t * 0.4);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.24, 0, 0, TAU); ctx.fill();
        ctx.restore();
        break;
      }
      case 'circle': {
        const k = this.armT >= 0 ? 0.5 + Math.sin(t * 22) * 0.5 : 0.6;
        ctx.globalAlpha = 0.5 + k * 0.5;
        ctx.beginPath(); ctx.arc(0, 0, r * (0.34 + k * 0.22), 0, TAU); ctx.fill();
        break;
      }
      case 'hex': ctx.beginPath(); ctx.rect(-r * 0.34, -r * 0.34, r * 0.68, r * 0.68); ctx.fill(); break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, r * 0.36, 0, TAU); ctx.fill();
    }
  }
}

/* ============================ PICKUP ============================ */
export class Pickup {
  constructor(x, y, kind, value) {
    this.x = x; this.y = y;
    this.vx = rand(-70, 70); this.vy = rand(-70, 70);
    this.kind = kind;          // 'xp' | 'hp'
    this.value = value;
    this.r = kind === 'hp' ? 11 : 7;
    this.life = 22;
    this.dead = false;
    this.t = rand(TAU);
    this.magnet = false;
  }
  update(dt, game) {
    this.t += dt * 4;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    const p = game.player;
    const d = Math.hypot(p.x - this.x, p.y - this.y);
    const rad = game.player.magnetRadius;
    if (d < rad) {
      this.magnet = true;
      const a = angleTo(this.x, this.y, p.x, p.y);
      const pull = lerp(420, 1500, 1 - clamp(d / rad, 0, 1));
      this.vx += Math.cos(a) * pull * dt * 3;
      this.vy += Math.sin(a) * pull * dt * 3;
    } else this.magnet = false;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (!this.magnet) { this.vx *= Math.pow(0.02, dt); this.vy *= Math.pow(0.02, dt); }
    if (d < p.r + this.r + 4) {
      this.dead = true;
      game.collect(this);
    }
  }
  draw(ctx) {
    const col = this.kind === 'hp' ? COLORS.hp : COLORS.xp;
    const g = glowSprite(col, this.r * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.life < 4 ? (0.35 + Math.sin(this.life * 18) * 0.35) : 0.8;
    ctx.drawImage(g, this.x - g.width / 2, this.y - g.height / 2);
    ctx.restore();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.t);
    ctx.fillStyle = col;
    if (this.kind === 'hp') {
      const s = this.r;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.7, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(-1.4, -4.5, 2.8, 9); ctx.fillRect(-4.5, -1.4, 9, 2.8);
    } else {
      const s = this.r;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* ============================ BOSS ============================ */
export class Boss {
  constructor(id, x, y) {
    const d = BOSS_DEFS[id];
    this.id = id;
    this.def = d;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = d.radius;
    this.maxHp = d.hp;
    this.hp = d.hp;
    this.contact = d.contact;
    this.polarity = 0;
    this.polT = 7;
    this.polWarn = 0;
    this.dead = false;
    this.flash = 0;
    this.t = 0;
    this.state = 'enter';
    this.stateT = 1.6;
    this.attack = 0;
    this.atkT = 1.4;
    this.phase = 0;
    this.score = d.score;
    this.xp = d.xp;
    this.name = '';
    this.subs = [];
    this.orbit = 0;
    this.crossT = 0;
    this.stunT = 0;
    this.chargeT = 0;
    this.chargeAng = 0;
    this.burnT = 0; this.burnDps = 0;
    this.summonT = 6;
    this.gapAngle = 0;
    if (id === 'choir') {
      for (let i = 0; i < 4; i++) {
        this.subs.push({ ang: (i / 4) * TAU, hp: 340, maxHp: 340, r: 20, x, y, fireT: 1 + i * 0.4, dead: false, flash: 0 });
      }
    }
  }

  get armored() {
    return this.id === 'choir' && this.subs.some(s => !s.dead);
  }

  hurt(dmg, game, hx, hy, opts = {}) {
    if (this.state === 'enter' || this.dead) return 0;
    if (opts.polarity !== undefined && opts.polarity === this.polarity) return 0;
    let mul = 1;
    if (this.armored) mul = 0.3;

    /* choir: check satellites first */
    if (this.id === 'choir') {
      for (const s of this.subs) {
        if (s.dead) continue;
        if (Math.hypot(s.x - hx, s.y - hy) < s.r + 8) {
          s.hp -= dmg * 1.35;
          s.flash = 0.09;
          if (s.hp <= 0) {
            s.dead = true;
            game.fx.killBurst(s.x, s.y, POLARITY_COLOR[this.polarity], true);
            game.fx.text(s.x, s.y - 20, 'SHATTERED', { color: COLORS.gold, size: 18 });
            game.audio?.kill(true);
            if (!this.subs.some(x => !x.dead)) {
              game.fx.text(this.x, this.y - this.r - 30, 'CORE EXPOSED', { color: COLORS.gold, size: 24, life: 1.4 });
              game.fx.ring(this.x, this.y, 260, COLORS.gold, 0.7, 5);
            }
          }
          return dmg;
        }
      }
    }

    this.hp -= dmg * mul;
    this.flash = 0.08;
    if (opts.burn) { this.burnT = Math.max(this.burnT, 2.4); this.burnDps = Math.max(this.burnDps, opts.burn); }
    if (this.hp <= 0) { this.kill(game); }
    return dmg;
  }

  kill(game) {
    if (this.dead) return;
    this.dead = true;
    game.onBossKilled(this);
  }

  /* hurtbox list for player bullets */
  hitboxes() {
    const list = [{ x: this.x, y: this.y, r: this.r, boss: this, sub: null, subId: 'core' }];
    if (this.id === 'choir') {
      let i = 0;
      for (const s of this.subs) {
        if (!s.dead) list.push({ x: s.x, y: s.y, r: s.r, boss: this, sub: s, subId: 'sub' + (i++) });
      }
    }
    if (this.id === 'splitmind') {
      /* two halves */
      const a = this.orbit;
      list[0] = {
        x: this.x + Math.cos(a) * 96, y: this.y + Math.sin(a) * 96, r: this.r, boss: this, sub: 'halfA', subId: 'halfA',
      };
      list.push({
        x: this.x - Math.cos(a) * 96, y: this.y - Math.sin(a) * 96, r: this.r, boss: this, sub: 'halfB', subId: 'halfB',
      });
    }
    return list;
  }

  update(dt, game) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.hp -= this.burnDps * dt;
      if (this.hp <= 0) { this.kill(game); return; }
    }
    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;

    /* polarity cycle */
    if (this.state !== 'enter') {
      this.polT -= dt;
      if (this.polT < 1 && this.polWarn <= 0) this.polWarn = 1;
      if (this.polWarn > 0) {
        this.polWarn -= dt;
        if (this.polWarn <= 0) {
          this.polarity = 1 - this.polarity;
          this.polT = this.id === 'voidheart' && this.phase === 2 ? 4.6 : 7;
          game.fx.ring(this.x, this.y, this.r * 3.2, POLARITY_COLOR[this.polarity], 0.55, 5);
          game.fx.text(this.x, this.y - this.r - 34, 'CHROMA SHIFT', { color: POLARITY_COLOR[this.polarity], size: 20, life: 1 });
          game.audio?.switchPol();
        }
      }
    }

    if (this.state === 'enter') {
      this.stateT -= dt;
      this.x = lerp(this.x, p.x + Math.cos(this.t * 1.2) * 340, dt * 1.2);
      this.y = lerp(this.y, p.y - 300, dt * 1.2);
      /* keep the landing spot on screen (below the HUD strip) */
      const hw = game.view.w / 2 - this.r - 40;
      const hh = game.view.h / 2 - this.r - 70;
      this.x = clamp(this.x, game.cam.x - hw, game.cam.x + hw);
      this.y = clamp(this.y, game.cam.y - hh + 40, game.cam.y + hh);
      if (this.stateT <= 0) { this.state = 'fight'; this.atkT = 1; }
      return;
    }

    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vx *= 0.9; this.vy *= 0.9;
      this.x += this.vx * dt; this.y += this.vy * dt;
      return;
    }

    switch (this.id) {
      case 'warden': this._warden(dt, game, p, ux, uy, d); break;
      case 'splitmind': this._splitmind(dt, game, p, ux, uy, d); break;
      case 'choir': this._choir(dt, game, p, ux, uy, d); break;
      case 'voidheart': this._voidheart(dt, game, p, ux, uy, d); break;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const pad = this.r + 20;
    this.x = clamp(this.x, pad, game.world.w - pad);
    this.y = clamp(this.y, pad, game.world.h - pad);

    /* phase from hp */
    const frac = this.hp / this.maxHp;
    const np = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
    if (np !== this.phase) {
      this.phase = np;
      game.fx.ring(this.x, this.y, 340, '#fff', 0.7, 6);
      game.shake(14);
      game.audio?.bossRoar();
      game.fx.text(this.x, this.y - this.r - 40, np === 2 ? 'ENRAGED' : 'PHASE ' + (np + 1), { color: '#fff', size: 26, life: 1.3 });
      if (this.id === 'voidheart' && np === 2) this.polT = Math.min(this.polT, 2);
    }
  }

  /* ---------- WARDEN ---------- */
  _warden(dt, game, p, ux, uy, d) {
    const speed = 150 + this.phase * 34;
    /* hold distance ~360 */
    let move = 0;
    if (d > 420) move = 1;
    else if (d < 280) move = -1;
    const strafe = Math.sin(this.t * 0.8) * 0.8;
    const tx = ux * move - uy * strafe, ty = uy * move + ux * strafe;
    const tl = Math.hypot(tx, ty) || 1;
    this.vx = lerp(this.vx, (tx / tl) * speed, dt * 2);
    this.vy = lerp(this.vy, (ty / tl) * speed, dt * 2);

    if (this.chargeT > 0) {
      this.chargeT -= dt;
      this.vx = Math.cos(this.chargeAng) * 720;
      this.vy = Math.sin(this.chargeAng) * 720;
      if (chance(dt * 40)) game.fx.burst(this.x, this.y, 1, POLARITY_COLOR[this.polarity], { speed: 90, life: 0.4, size: 4 });
      if (this.chargeT <= 0) {
        this.stunT = 1.15;
        this.vx *= -0.2; this.vy *= -0.2;
        game.fx.ring(this.x, this.y, 150, '#fff', 0.5, 4);
        game.shake(10);
      }
      return;
    }

    this.atkT -= dt;
    if (this.atkT <= 0) {
      this.attack = (this.attack + 1) % 3;
      const speedUp = 1 - this.phase * 0.16;
      if (this.attack === 0) {
        /* radial bursts */
        const n = 14 + this.phase * 4;
        const base = rand(TAU);
        for (let i = 0; i < n; i++) {
          game.spawnEnemyBullet(this.x, this.y, base + (i / n) * TAU, 250, 13, 7, this.polarity);
        }
        game.fx.ring(this.x, this.y, 120, POLARITY_COLOR[this.polarity], 0.4, 4);
        this.atkT = 1.7 * speedUp;
        if (this.phase >= 1) this._spiralExtra(game, 6, 210);
      } else if (this.attack === 1) {
        /* aimed fan x3 */
        this._fanT = 3; this._fanGap = 0;
        this.atkT = 2.1 * speedUp;
        this._fanLeft = 3 + this.phase;
      } else {
        /* charge */
        this.chargeAng = angleTo(this.x, this.y, p.x, p.y);
        this.chargeT = 0.62;
        game.fx.text(this.x, this.y - this.r - 30, 'CHARGING', { color: '#fff', size: 18, life: 0.62 });
        game.fx.ring(this.x, this.y, this.r * 2.6, '#fff', 0.62, 4);
        this.atkT = 2.4 * speedUp;
      }
    }
    if (this._fanLeft > 0) {
      this._fanGap -= dt;
      if (this._fanGap <= 0) {
        this._fanGap = 0.22;
        this._fanLeft--;
        const a = angleTo(this.x, this.y, p.x, p.y);
        for (let i = -2; i <= 2; i++) {
          game.spawnEnemyBullet(this.x, this.y, a + i * 0.13, 320, 12, 6, this.polarity);
        }
        game.fx.burst(this.x, this.y, 5, POLARITY_COLOR[this.polarity], { speed: 160, life: 0.3, size: 3, angle: a, spread: 1 });
      }
    }
  }

  _spiralExtra(game, n, spd) {
    const base = this.t * 3;
    for (let i = 0; i < n; i++) {
      game.spawnEnemyBullet(this.x, this.y, base + (i / n) * TAU, spd, 11, 6, this.polarity);
    }
  }

  /* ---------- SPLIT MIND ---------- */
  _splitmind(dt, game, p, ux, uy, d) {
    this.orbit += dt * (0.9 + this.phase * 0.35);
    /* drift toward mid distance */
    let move = 0;
    if (d > 430) move = 1; else if (d < 300) move = -1;
    this.vx = lerp(this.vx, ux * 130 * move, dt * 2);
    this.vy = lerp(this.vy, uy * 130 * move, dt * 2);

    /* double spiral from both halves */
    this.atkT -= dt;
    if (this.atkT <= 0) {
      this.atkT = Math.max(0.07, 0.14 - this.phase * 0.03);
      const a = this.t * (2.6 + this.phase * 0.7);
      const hx = this.x + Math.cos(this.orbit) * 96;
      const hy = this.y + Math.sin(this.orbit) * 96;
      const hx2 = this.x - Math.cos(this.orbit) * 96;
      const hy2 = this.y - Math.sin(this.orbit) * 96;
      game.spawnEnemyBullet(hx, hy, a, 235, 11, 6, this.polarity);
      game.spawnEnemyBullet(hx2, hy2, a + Math.PI, 235, 11, 6, this.polarity);
    }
    /* periodic cross-ring */
    this.crossT -= dt;
    if (this.crossT <= 0) {
      this.crossT = 4.4 - this.phase * 0.7;
      const n = 20;
      const off = rand(TAU);
      for (let i = 0; i < n; i++) {
        if (i % 5 === 0) continue;   /* gaps */
        game.spawnEnemyBullet(this.x, this.y, off + (i / n) * TAU, 300, 13, 7, this.polarity);
      }
      game.fx.ring(this.x, this.y, 130, POLARITY_COLOR[this.polarity], 0.5, 5);
    }
    if (this.phase >= 1 && chance(dt * 1.6)) {
      const a = angleTo(this.x, this.y, p.x, p.y);
      game.spawnEnemyBullet(this.x, this.y, a + rand(-0.2, 0.2), 360, 12, 6, this.polarity);
    }
  }

  /* ---------- CHOIR ---------- */
  _choir(dt, game, p, ux, uy, d) {
    /* slow drift, keep ~400 */
    let move = 0;
    if (d > 470) move = 1; else if (d < 330) move = -1;
    this.vx = lerp(this.vx, ux * 90 * move, dt * 1.6);
    this.vy = lerp(this.vy, uy * 90 * move, dt * 1.6);

    /* satellites orbit + fire */
    for (const s of this.subs) {
      if (s.dead) continue;
      s.ang += dt * 0.75;
      s.x = this.x + Math.cos(s.ang) * 186;
      s.y = this.y + Math.sin(s.ang) * 186;
      s.fireT -= dt;
      if (s.fireT <= 0) {
        s.fireT = 2.3;
        const a = angleTo(s.x, s.y, p.x, p.y);
        for (let i = -1; i <= 1; i++) game.spawnEnemyBullet(s.x, s.y, a + i * 0.18, 260, 11, 6, this.polarity);
      }
      if (s.flash > 0) s.flash -= dt;
    }

    this.atkT -= dt;
    if (this.atkT <= 0) {
      const armored = this.armored;
      this.atkT = armored ? 3.4 : 2.3 - this.phase * 0.35;
      if (chance(0.55)) {
        /* summon */
        for (let i = 0; i < 2 + this.phase; i++) {
          const a = rand(TAU);
          const e = new Enemy(chance(0.4) ? 'swarm' : 'grunt', this.x + Math.cos(a) * 150, this.y + Math.sin(a) * 150, { polarity: this.polarity });
          game.enemies.push(e);
        }
        game.fx.text(this.x, this.y - this.r - 34, 'IT SINGS', { color: POLARITY_COLOR[this.polarity], size: 20, life: 1.1 });
        game.fx.ring(this.x, this.y, 170, POLARITY_COLOR[this.polarity], 0.6, 4);
      } else {
        /* radial hymn */
        const n = 16 + this.phase * 6;
        const off = this.t;
        for (let i = 0; i < n; i++) {
          game.spawnEnemyBullet(this.x, this.y, off + (i / n) * TAU, 240, 12, 7, this.polarity);
        }
        game.fx.ring(this.x, this.y, 140, '#fff', 0.45, 4);
      }
    }
  }

  /* ---------- VOID HEART ---------- */
  _voidheart(dt, game, p, ux, uy, d) {
    const speed = 120 + this.phase * 46;
    let move = 0;
    if (d > 400) move = 1; else if (d < 270) move = -1;
    const strafe = Math.sin(this.t * 0.6) * 0.7;
    this.vx = lerp(this.vx, (ux * move - uy * strafe) * speed, dt * 2);
    this.vy = lerp(this.vy, (uy * move + ux * strafe) * speed, dt * 2);

    this.atkT -= dt;
    if (this.atkT <= 0) {
      const ph = this.phase;
      this.atkT = 2.6 - ph * 0.5;
      const roll = Math.random();
      if (roll < 0.36) {
        /* ring with safe gaps */
        const n = 26 + ph * 8;
        const off = rand(TAU);
        const gapAt = (Math.random() * n) | 0;
        for (let i = 0; i < n; i++) {
          const gi = (i - gapAt + n) % n;
          if (gi < 3 + ph) continue;
          game.spawnEnemyBullet(this.x, this.y, off + (i / n) * TAU, 265, 13, 7, this.polarity);
        }
        game.fx.ring(this.x, this.y, 150, POLARITY_COLOR[this.polarity], 0.5, 5);
      } else if (roll < 0.66) {
        /* rotating triple spray */
        this._sprayT = 1.1; this._sprayN = 10 + ph * 4;
        game.fx.text(this.x, this.y - this.r - 36, 'VOID SPEAKS', { color: POLARITY_COLOR[this.polarity], size: 20, life: 1 });
      } else if (roll < 0.86) {
        /* homing bolts */
        const n = 2 + ph;
        for (let i = 0; i < n; i++) {
          const a = angleTo(this.x, this.y, p.x, p.y) + (i - (n - 1) / 2) * 0.4;
          const b = game.spawnEnemyBullet(this.x, this.y, a, 200, 14, 8, this.polarity, { homing: 1.6, life: 4 });
          if (b) b.color = '#b388ff';
        }
      } else if (ph >= 1) {
        /* summon cinders */
        for (let i = 0; i < ph; i++) {
          const a = rand(TAU);
          game.enemies.push(new Enemy('bomber', this.x + Math.cos(a) * 170, this.y + Math.sin(a) * 170, { polarity: this.polarity }));
        }
      } else {
        /* simple aimed burst */
        const a = angleTo(this.x, this.y, p.x, p.y);
        for (let i = -3; i <= 3; i++) game.spawnEnemyBullet(this.x, this.y, a + i * 0.1, 330, 12, 6, this.polarity);
      }
    }
    if (this._sprayT > 0) {
      this._sprayT -= dt;
      if (chance(dt * 22)) {
        const a = this.t * 4.2;
        for (let k = 0; k < 3; k++) {
          game.spawnEnemyBullet(this.x, this.y, a + (k / 3) * TAU, 300, 12, 6, this.polarity);
        }
      }
    }
  }

  /* ---------- drawing ---------- */
  draw(ctx, game) {
    const pol = POLARITY_COLOR[this.polarity];
    const enter = this.state === 'enter';
    const scale = enter ? clamp(1 - this.stateT / 1.6, 0.1, 1) : 1;
    const warn = this.polWarn > 0 ? (Math.sin(this.t * 30) > 0 ? 1 : 0) : 0;
    const flash = this.flash > 0;
    const col = flash ? '#fff' : warn ? '#ffffff' : pol;

    if (this.id === 'splitmind') {
      this._drawSplit(ctx, col, pol, scale, flash);
    } else if (this.id === 'choir') {
      this._drawChoir(ctx, col, pol, scale, flash);
    } else if (this.id === 'voidheart') {
      this._drawVoid(ctx, col, pol, scale, flash);
    } else {
      this._drawWarden(ctx, col, pol, scale, flash);
    }

    if (enter) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * (2.4 - scale * 1.2), 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  _glow(ctx, col, mul = 5) {
    const g = glowSprite(col, this.r * mul);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    ctx.drawImage(g, this.x - g.width / 2, this.y - g.height / 2);
    ctx.restore();
  }

  _drawWarden(ctx, col, pol, scale, flash) {
    this._glow(ctx, col);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.rotate(this.t * 0.55);
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.fillStyle = flash ? '#fff' : '#0a0d1e';
    ctx.lineJoin = 'round';
    /* outer spikes */
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const rr = i % 2 === 0 ? this.r * 1.42 : this.r * 0.92;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    /* inner hex */
    ctx.rotate(-this.t * 1.4);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.lineTo(Math.cos(a) * this.r * 0.62, Math.sin(a) * this.r * 0.62);
    }
    ctx.closePath();
    ctx.fillStyle = col; ctx.globalAlpha = flash ? 1 : 0.85; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.22, 0, TAU); ctx.fill();
    ctx.restore();
  }

  _drawSplit(ctx, col, pol, scale, flash) {
    const g = glowSprite(col, this.r * 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(g, this.x - g.width / 2, this.y - g.height / 2);
    ctx.restore();
    for (const s of [1, -1]) {
      const hx = this.x + Math.cos(this.orbit) * 96 * s;
      const hy = this.y + Math.sin(this.orbit) * 96 * s;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(scale, scale);
      ctx.rotate(this.orbit * 1.6 * s + Math.PI / 2);
      ctx.fillStyle = flash ? '#fff' : '#0a0d1e';
      ctx.strokeStyle = col;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.r, s > 0 ? -Math.PI / 2 : Math.PI / 2, s > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, this.r * 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(0, 0, this.r * 0.16, 0, TAU); ctx.fill();
      ctx.restore();
    }
    /* link */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 7]);
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(this.orbit) * 96, this.y + Math.sin(this.orbit) * 96);
    ctx.lineTo(this.x - Math.cos(this.orbit) * 96, this.y - Math.sin(this.orbit) * 96);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawChoir(ctx, col, pol, scale, flash) {
    /* satellites */
    for (const s of this.subs) {
      if (s.dead) continue;
      const sc = flash ? '#fff' : pol;
      const g = glowSprite(sc, s.r * 4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(g, s.x - g.width / 2, s.y - g.height / 2);
      ctx.restore();
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(this.t * 1.5);
      ctx.fillStyle = s.flash > 0 ? '#fff' : '#0a0d1e';
      ctx.strokeStyle = sc;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const x = Math.cos(a) * s.r, y = Math.sin(a) * s.r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = sc;
      ctx.beginPath(); ctx.arc(0, 0, s.r * 0.36, 0, TAU); ctx.fill();
      ctx.restore();
      /* hp */
      const w = s.r * 2;
      ctx.save();
      ctx.fillStyle = 'rgba(4,5,12,0.8)';
      ctx.fillRect(s.x - w / 2, s.y - s.r - 10, w, 3.5);
      ctx.fillStyle = sc;
      ctx.fillRect(s.x - w / 2, s.y - s.r - 10, w * clamp(s.hp / s.maxHp, 0, 1), 3.5);
      ctx.restore();
    }
    this._glow(ctx, this.armored ? '#7c86b8' : col, 5.5);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    ctx.rotate(this.t * 0.4);
    ctx.fillStyle = flash ? '#fff' : '#0a0d1e';
    ctx.strokeStyle = this.armored ? '#9aa3d6' : col;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill(); ctx.stroke();
    /* armor plates while subs alive */
    if (this.armored) {
      ctx.save();
      ctx.rotate(-this.t * 0.9);
      ctx.setLineDash([12, 9]);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, this.r * 1.3, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.rotate(-this.t * 1.1);
    ctx.fillStyle = this.armored ? '#9aa3d6' : col;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.5, 0, TAU); ctx.fill();
    /* eye */
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0, 0, this.r * 0.3, this.r * 0.14, this.t * 0.7, 0, TAU); ctx.fill();
    ctx.restore();
  }

  _drawVoid(ctx, col, pol, scale, flash) {
    this._glow(ctx, col, 6);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    /* pulsing outer petals */
    ctx.save();
    ctx.rotate(this.t * 0.3);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      const rr = this.r * (1.35 + Math.sin(a * 6 + this.t * 3) * 0.16);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    /* body */
    ctx.fillStyle = flash ? '#fff' : '#080a18';
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill(); ctx.stroke();
    /* beating core */
    const beat = 1 + Math.sin(this.t * (this.phase === 2 ? 12 : 7)) * 0.16;
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.52 * beat, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, this.r * 0.24 * beat, 0, TAU); ctx.fill();
    if (this.phase === 2) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.arc(0, 0, this.r * 0.8, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
}
