/* POLARIS — weapon systems: gun, orbiters, pulse, drones, missiles, beam */

import { TAU, rand, clamp, angleTo, lerp, chance } from './util.js';
import { BAL, POLARITY_COLOR, COLORS } from './data.js';
import { Bullet, Enemy } from './actors.js';
import { glowSprite } from './fx.js';

export function initWeaponState(p) {
  p.weps = {
    gunCd: 0,
    recoil: 0,
    orbitAng: rand(TAU),
    pulseT: 2.2,
    pulseRings: [],
    drones: [],
    droneSync: 0,
    missileT: 3,
    beamFlick: 0,
    rifts: [],
  };
}

/* ---------- helpers ---------- */
function playerDmgMult(game) {
  let m = 1 + 0.05 * (game.save.meta.dmg || 0);
  return m;
}

export function gunStats(game) {
  const m = game.player.mods;
  const evo = !!m.evo_needle;
  const spreadRank = m.spread || 0;
  const count = evo ? 9 : 1 + spreadRank;
  const pierce = (m.pierce || 0) + (evo ? 4 : 0);
  let dmg = BAL.player.bulletDmg;
  dmg *= 1 + 0.24 * (m.caliber || 0);
  dmg *= 1 + 0.08 * (m.velocity || 0);
  dmg *= playerDmgMult(game);
  if (evo) dmg *= 1.4;
  const interval = BAL.player.fireInterval / (1 + 0.15 * (m.overcharge || 0)) * (evo ? 0.9 : 1);
  const speed = BAL.player.bulletSpeed * (1 + 0.2 * (m.velocity || 0));
  const cone = evo ? 0.42 : 0.075 * Math.max(0, count - 1);
  return { count, pierce, dmg, interval, speed, cone, chain: m.chain || 0, homing: (m.homing || 0) * 2.2 + (evo ? 1.2 : 0) };
}

export function updateWeapons(dt, game) {
  const p = game.player;
  const m = p.mods;
  const weps = p.weps;

  /* ================= GUN ================= */
  weps.gunCd -= dt;
  if (weps.recoil > 0) weps.recoil = Math.max(0, weps.recoil - dt * 6);
  if (weps.gunCd <= 0) {
    const st = gunStats(game);
    weps.gunCd = st.interval;
    const aim = p.aimAngle;
    for (let i = 0; i < st.count; i++) {
      let off = 0;
      if (st.count > 1) {
        const k = i - (st.count - 1) / 2;
        off = k * (st.cone / Math.max(1, st.count - 1)) * (st.count === 1 ? 0 : 1);
        if (st.count > 1) off = (k / Math.max(1, (st.count - 1) / 2)) * (st.cone / 2);
      }
      const a = aim + off + rand(-0.014, 0.014);
      const mx = p.x + Math.cos(a) * (p.r + 12);
      const my = p.y + Math.sin(a) * (p.r + 12);
      game.spawnPlayerBullet(mx, my, a, {
        speed: st.speed, dmg: st.dmg, pierce: st.pierce,
        homing: st.homing, chain: st.chain, r: BAL.player.bulletR,
      });
    }
    weps.recoil = 1;
    /* muzzle flash particles */
    const a = aim;
    game.fx.burst(p.x + Math.cos(a) * (p.r + 14), p.y + Math.sin(a) * (p.r + 14), 3,
      POLARITY_COLOR[p.polarity], { speed: 160, life: 0.16, size: 2.6, angle: a, spread: 0.9 });
    game.audio?.shoot(p.polarity);
  }

  /* ================= ORBITERS ================= */
  const orbitRank = m.orbit || 0;
  if (orbitRank > 0) {
    const evo = !!m.evo_halo;
    const count = orbitRank;
    const radius = (76 + 10 * orbitRank) * (evo ? 1.5 : 1);
    const speed = (2.1 + 0.35 * orbitRank) * (evo ? 1.35 : 1);
    const dmg = (17 + 9 * orbitRank) * playerDmgMult(game) * (evo ? 2 : 1);
    weps.orbitAng += dt * speed;
    for (let i = 0; i < count; i++) {
      const a = weps.orbitAng + (i / count) * TAU;
      const bx = p.x + Math.cos(a) * radius;
      const by = p.y + Math.sin(a) * radius;
      for (const e of game.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        if (e.orbCd > 0) continue;
        const rr = e.r + (evo ? 20 : 13);
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 < rr * rr) {
          if (e.polarity !== p.polarity) {
            e.orbCd = 0.42;
            e.hurt(dmg, game, bx, by, { polarity: p.polarity, knock: 140, burn: evo ? 13 : 0 });
            game.fx.hitSparks(bx, by, POLARITY_COLOR[p.polarity], angleTo(bx, by, e.x, e.y), 5);
            game.audio?.hit();
          } else {
            e.orbCd = 0.5;
            game.fx.hitSparks(bx, by, '#8892c8', angleTo(bx, by, e.x, e.y), 3);
            game.audio?.shielded();
          }
        }
      }
      if (game.boss && !game.boss.dead && game.boss.state === 'fight') {
        for (const hb of game.boss.hitboxes()) {
          if (hb.sub && hb.sub !== 'halfA' && hb.sub !== 'halfB' && hb.sub.dead) continue;
          const rr = hb.r + (evo ? 20 : 13);
          const key = 'boss' + (hb.subId || 'core');
          if ((hb.x - bx) ** 2 + (hb.y - by) ** 2 < rr * rr) {
            if (!weps._bossCd || weps._bossCd[key] === undefined) weps._bossCd = weps._bossCd || {};
            if ((weps._bossCd[key] || 0) <= 0) {
              weps._bossCd[key] = 0.42;
              game.boss.hurt(dmg, game, bx, by, { polarity: p.polarity, burn: evo ? 13 : 0 });
              game.fx.hitSparks(bx, by, POLARITY_COLOR[p.polarity], angleTo(bx, by, hb.x, hb.y), 5);
            }
          }
        }
        for (const k in weps._bossCd) weps._bossCd[k] -= dt;
      }
    }
  }

  /* ================= NOVA PULSE ================= */
  const pulseRank = m.pulse || 0;
  if (pulseRank > 0) {
    const evo = !!m.evo_graviton;
    weps.pulseT -= dt;
    if (weps.pulseT <= 0) {
      weps.pulseT = Math.max(1.4, 3.3 - 0.42 * pulseRank);
      const dmg = (24 + 15 * pulseRank) * playerDmgMult(game) * (evo ? 2 : 1);
      weps.pulseRings.push({
        x: p.x, y: p.y, r: 30, maxR: (250 + 44 * pulseRank) * (evo ? 1.3 : 1),
        dmg, hit: new Set(), life: 0.62, max: 0.62, pull: evo,
      });
      game.fx.ring(p.x, p.y, 200, POLARITY_COLOR[p.polarity], 0.5, 3);
      game.audio?.ui('click');
    }
  }
  /* pulse rings update */
  for (let i = weps.pulseRings.length - 1; i >= 0; i--) {
    const ring = weps.pulseRings[i];
    ring.life -= dt;
    const k = 1 - ring.life / ring.max;
    ring.r = ring.maxR * (0.2 + 0.8 * (1 - Math.pow(1 - k, 2.4)));
    ring.x = lerp(ring.x, p.x, dt * 6);
    ring.y = lerp(ring.y, p.y, dt * 6);
    if (ring.pull) {
      for (const e of game.enemies) {
        if (e.dead || e.state === 'spawn') continue;
        const a = angleTo(e.x, e.y, ring.x, ring.y);
        e.vx += Math.cos(a) * 620 * dt;
        e.vy += Math.sin(a) * 620 * dt;
      }
    }
    /* damage at ring edge */
    const targets = game.enemyTargets();
    for (const e of targets) {
      if (e.dead || e.state === 'spawn') continue;
      if (ring.hit.has(e.id)) continue;
      const d = Math.hypot(e.x - ring.x, e.y - ring.y);
      if (Math.abs(d - ring.r) < e.r + 26) {
        if (e.polarity !== p.polarity) {
          ring.hit.add(e.id);
          e.hurt(ring.dmg, game, e.x, e.y, { polarity: p.polarity, knock: 260 });
          game.fx.hitSparks(e.x, e.y, POLARITY_COLOR[p.polarity], angleTo(ring.x, ring.y, e.x, e.y), 6);
        }
      }
    }
    if (game.boss && !game.boss.dead && game.boss.state === 'fight') {
      for (const hb of game.boss.hitboxes()) {
        const key = 'b' + (hb.subId || 'core');
        if (ring.hit.has(key)) continue;
        const d = Math.hypot(hb.x - ring.x, hb.y - ring.y);
        if (Math.abs(d - ring.r) < hb.r + 26) {
          ring.hit.add(key);
          game.boss.hurt(ring.dmg, game, hb.x, hb.y, { polarity: p.polarity });
          game.fx.hitSparks(hb.x, hb.y, POLARITY_COLOR[p.polarity], 0, 6);
        }
      }
    }
    if (ring.life <= 0) weps.pulseRings.splice(i, 1);
  }

  /* ================= DRONES ================= */
  const droneRank = m.drone || 0;
  while (weps.drones.length < droneRank) {
    weps.drones.push({ ang: rand(TAU), x: p.x, y: p.y, fireT: rand(0, 0.4), flash: 0 });
  }
  while (weps.drones.length > droneRank) weps.drones.pop();
  for (let i = 0; i < weps.drones.length; i++) {
    const dr = weps.drones[i];
    const want = p.aimAngle + Math.PI + (i - (weps.drones.length - 1) / 2) * 0.7;
    dr.ang = lerp(dr.ang, want, dt * 4);
    const tx = p.x + Math.cos(dr.ang) * 58;
    const ty = p.y + Math.sin(dr.ang) * 58;
    dr.x = lerp(dr.x, tx, dt * 9);
    dr.y = lerp(dr.y, ty, dt * 9);
    if (dr.flash > 0) dr.flash -= dt;
    dr.fireT -= dt;
    if (dr.fireT <= 0) {
      const t = game.nearestEnemy(dr.x, dr.y, 620, e => !e.dead && e.state !== 'spawn' && e.polarity !== p.polarity)
        || game.nearestEnemy(dr.x, dr.y, 620, e => !e.dead && e.state !== 'spawn');
      if (t) {
        dr.fireT = 0.52;
        dr.flash = 0.1;
        const a = angleTo(dr.x, dr.y, t.x, t.y);
        const dmg = (9 + 5 * droneRank) * playerDmgMult(game);
        game.spawnPlayerBullet(dr.x, dr.y, a, { speed: 660, dmg, r: 4, life: 1.6 });
        game.fx.burst(dr.x, dr.y, 2, POLARITY_COLOR[p.polarity], { speed: 90, life: 0.15, size: 2, angle: a, spread: 0.8 });
        game.audio?.shoot(p.polarity);
      }
    }
  }

  /* ================= MISSILES ================= */
  const msRank = m.missile || 0;
  if (msRank > 0) {
    weps.missileT -= dt;
    if (weps.missileT <= 0) {
      weps.missileT = Math.max(1.6, 4.4 - 0.95 * msRank);
      const n = msRank >= 3 ? 3 : msRank >= 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = p.aimAngle + rand(-0.7, 0.7);
        game.missiles.push({
          x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
          ang: a, life: 3.4,
          dmg: (44 + 17 * msRank) * playerDmgMult(game) * (m.evo_swarm ? 1.3 : 1),
          blast: 88 + 15 * msRank,
          split: !!m.evo_swarm,
          r: 7,
        });
      }
      game.audio?.dash();
    }
  }
  for (let i = game.missiles.length - 1; i >= 0; i--) {
    const ms = game.missiles[i];
    ms.life -= dt;
    const t = game.nearestEnemy(ms.x, ms.y, 900, e => !e.dead && e.state !== 'spawn');
    let speed = 470;
    if (t) {
      const a = angleTo(ms.x, ms.y, t.x, t.y);
      let d = a - ms.ang;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      ms.ang += clamp(d, -5.2 * dt, 5.2 * dt);
    } else ms.ang += dt * 1.4;
    ms.vx = Math.cos(ms.ang) * speed;
    ms.vy = Math.sin(ms.ang) * speed;
    ms.x += ms.vx * dt;
    ms.y += ms.vy * dt;
    if (chance(dt * 30)) game.fx.burst(ms.x, ms.y, 1, '#ffb347', { speed: 30, life: 0.3, size: 2.4, angle: ms.ang + Math.PI, spread: 0.6 });
    /* hit test */
    let boom = ms.life <= 0;
    if (!boom) {
      const targets = game.enemyTargets();
      for (const e of targets) {
        if (e.dead || e.state === 'spawn') continue;
        const rr = e.r + ms.r;
        if ((e.x - ms.x) ** 2 + (e.y - ms.y) ** 2 < rr * rr) { boom = true; break; }
      }
    }
    if (!boom && game.boss && !game.boss.dead && game.boss.state === 'fight') {
      for (const hb of game.boss.hitboxes()) {
        const rr = hb.r + ms.r;
        if ((hb.x - ms.x) ** 2 + (hb.y - ms.y) ** 2 < rr * rr) { boom = true; break; }
      }
    }
    if (boom) {
      game.explodeMissile(ms);
      if (ms.split) {
        for (let k = 0; k < 3; k++) {
          const a = rand(TAU);
          game.missiles.push({
            x: ms.x, y: ms.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
            ang: a, life: 1.5, dmg: ms.dmg * 0.55, blast: ms.blast * 0.7,
            split: false, r: 5, mini: true,
          });
        }
      }
      game.missiles.splice(i, 1);
    } else if (ms.x < -60 || ms.y < -60 || ms.x > game.world.w + 60 || ms.y > game.world.h + 60) {
      game.missiles.splice(i, 1);
    }
  }

  /* ================= SUNCUTTER BEAM ================= */
  const beamRank = m.beam || 0;
  if (beamRank > 0) {
    weps.beamFlick = Math.sin(game.t * 60) * 0.5 + 0.5;
    const dps = (32 + 19 * beamRank) * playerDmgMult(game);
    const width = 13 + 4.5 * beamRank;
    const range = 660;
    const a = p.aimAngle;
    const ex = p.x + Math.cos(a) * range;
    const ey = p.y + Math.sin(a) * range;
    /* damage enemies near segment */
    const targets = game.enemyTargets();
    for (const e of targets) {
      if (e.dead || e.state === 'spawn') continue;
      const proj = (e.x - p.x) * Math.cos(a) + (e.y - p.y) * Math.sin(a);
      if (proj < 0 || proj > range) continue;
      const px = p.x + Math.cos(a) * proj;
      const py = p.y + Math.sin(a) * proj;
      const d2 = (e.x - px) ** 2 + (e.y - py) ** 2;
      const rr = e.r + width;
      if (d2 < rr * rr && e.polarity !== p.polarity) {
        e.hurt(dps * dt, game, e.x, e.y, { polarity: p.polarity, burn: 0 });
        if (chance(dt * 18)) game.fx.hitSparks(e.x, e.y, '#fff', angleTo(p.x, p.y, e.x, e.y), 2);
      }
    }
    if (game.boss && !game.boss.dead && game.boss.state === 'fight') {
      for (const hb of game.boss.hitboxes()) {
        const proj = (hb.x - p.x) * Math.cos(a) + (hb.y - p.y) * Math.sin(a);
        if (proj < 0 || proj > range) continue;
        const px = p.x + Math.cos(a) * proj;
        const py = p.y + Math.sin(a) * proj;
        if ((hb.x - px) ** 2 + (hb.y - py) ** 2 < (hb.r + width) ** 2) {
          game.boss.hurt(dps * dt, game, hb.x, hb.y, { polarity: p.polarity });
        }
      }
    }
  }

  /* ================= PHANTOM RIFT (dash trail) ================= */
  if (m.evo_rift) {
    for (let i = weps.rifts.length - 1; i >= 0; i--) {
      const rf = weps.rifts[i];
      rf.life -= dt;
      const dps = 42 * playerDmgMult(game);
      const targets = game.enemyTargets();
      for (const e of targets) {
        if (e.dead || e.state === 'spawn') continue;
        if ((e.x - rf.x) ** 2 + (e.y - rf.y) ** 2 < (e.r + rf.r) ** 2) {
          e.hurt(dps * dt, game, e.x, e.y, { polarity: p.polarity, burn: 8, knock: 60 });
        }
      }
      if (game.boss && !game.boss.dead && game.boss.state === 'fight') {
        for (const hb of game.boss.hitboxes()) {
          if ((hb.x - rf.x) ** 2 + (hb.y - rf.y) ** 2 < (hb.r + rf.r) ** 2) {
            game.boss.hurt(dps * dt, game, hb.x, hb.y, { polarity: p.polarity });
          }
        }
      }
      if (rf.life <= 0) weps.rifts.splice(i, 1);
    }
  }
}

/* ---------------- drawing ---------------- */
export function drawWeapons(ctx, game) {
  const p = game.player;
  const m = p.mods;
  const weps = p.weps;
  const pol = POLARITY_COLOR[p.polarity];

  /* pulse rings */
  for (const ring of weps.pulseRings) {
    const a = clamp(ring.life / ring.max, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.75;
    ctx.strokeStyle = pol;
    ctx.lineWidth = 7 * a + 2;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = a * 0.2;
    ctx.fillStyle = pol;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* orbiters */
  const orbitRank = m.orbit || 0;
  if (orbitRank > 0) {
    const evo = !!m.evo_halo;
    const count = orbitRank;
    const radius = (76 + 10 * orbitRank) * (evo ? 1.5 : 1);
    const speed = (2.1 + 0.35 * orbitRank) * (evo ? 1.35 : 1);
    const ang0 = weps.orbitAng;
    for (let i = 0; i < count; i++) {
      const a = ang0 + (i / count) * TAU;
      const bx = p.x + Math.cos(a) * radius;
      const by = p.y + Math.sin(a) * radius;
      const size = evo ? 20 : 13;
      const g = glowSprite(evo ? '#ffb347' : pol, size * 4.6);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.75;
      ctx.drawImage(g, bx - g.width / 2, by - g.height / 2);
      ctx.restore();
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = evo ? '#ffb347' : pol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -size); ctx.lineTo(size * 0.5, 0); ctx.lineTo(0, size); ctx.lineTo(-size * 0.5, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /* drones */
  for (const dr of weps.drones) {
    const g = glowSprite(pol, 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = dr.flash > 0 ? 1 : 0.6;
    ctx.drawImage(g, dr.x - g.width / 2, dr.y - g.height / 2);
    ctx.restore();
    ctx.save();
    ctx.translate(dr.x, dr.y);
    ctx.rotate(dr.ang);
    ctx.fillStyle = dr.flash > 0 ? '#fff' : '#0b0e1e';
    ctx.strokeStyle = pol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(11, 0); ctx.lineTo(-7, 7); ctx.lineTo(-3, 0); ctx.lineTo(-7, -7);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /* missiles */
  for (const ms of game.missiles) {
    const g = glowSprite('#ffb347', 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7;
    ctx.drawImage(g, ms.x - g.width / 2, ms.y - g.height / 2);
    ctx.restore();
    ctx.save();
    ctx.translate(ms.x, ms.y);
    ctx.rotate(ms.ang);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-6, 5); ctx.lineTo(-4, 0); ctx.lineTo(-6, -5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.fillRect(-9, -2, 5, 4);
    ctx.restore();
  }

  /* beam */
  if ((m.beam || 0) > 0) {
    const a = p.aimAngle;
    const range = 660;
    const ex = p.x + Math.cos(a) * range;
    const ey = p.y + Math.sin(a) * range;
    const flick = 0.75 + weps.beamFlick * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    /* soft glow */
    const grad = ctx.createLinearGradient(p.x, p.y, ex, ey);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.12, rgbaA(pol, 0.85));
    grad.addColorStop(1, rgbaA(pol, 0));
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineWidth = (13 + 4.5 * (m.beam || 0)) * flick;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 3.4 * flick;
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(ex, ey); ctx.stroke();
    /* scan dots */
    for (let i = 0; i < 6; i++) {
      const t = ((game.t * 1.6 + i / 6) % 1);
      const x = p.x + Math.cos(a) * range * t;
      const y = p.y + Math.sin(a) * range * t;
      ctx.globalAlpha = (1 - t) * 0.5;
      ctx.fillStyle = pol;
      ctx.beginPath(); ctx.arc(x, y, 5 * (1 - t) + 1.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* rifts */
  for (const rf of weps.rifts) {
    const a = clamp(rf.life / rf.max, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.55;
    const g = glowSprite('#8b6cff', rf.r * 3);
    ctx.drawImage(g, rf.x - g.width / 2, rf.y - g.height / 2);
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = '#c9b8ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(rf.x, rf.y, rf.r * 0.7, rf.r, game.t * 3, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function rgbaA(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
