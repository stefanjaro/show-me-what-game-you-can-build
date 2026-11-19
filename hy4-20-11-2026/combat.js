'use strict';
function updateEnemies(dt) {
  const p = G.p;
  const len = G.enemies.length;
  for (let i = 0; i < len; i++) {
    const e = G.enemies[i];
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt); e.atkCd -= dt; e.hitCd -= dt;
    if (e.slow > 0) e.slow -= dt;
    const sm = e.slow > 0 ? 0.35 : 1;
    let dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    if (e.type === 'shooter') {
      const want = 300, mv = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
      e.x += (dx * mv - dy * 0.5) * e.speed * sm * dt;
      e.y += (dy * mv + dx * 0.5) * e.speed * sm * dt;
      e.shootCd -= dt;
      if (e.shootCd <= 0 && d < 620) {
        e.shootCd = rand(1.8, 2.8);
        spawnProjectile(e.x, e.y, dx * 230, dy * 230, { color: '#ff6a8a', dmg: e.dmg, r: 6, hostile: true, life: 3 });
      }
    } else if (e.type === 'spinner') {
      e.x += (dx * 0.8 - dy * 0.9) * e.speed * sm * dt;
      e.y += (dy * 0.8 + dx * 0.9) * e.speed * sm * dt;
    } else if (e.type === 'wisp') {
      e.angle += dt * 4;
      e.x += (dx + Math.cos(e.angle) * 0.8) * e.speed * sm * dt;
      e.y += (dy + Math.sin(e.angle) * 0.8) * e.speed * sm * dt;
    } else if (e.type === 'dart') {
      e.angle += dt * 2;
      e.x += (dx + Math.cos(e.angle) * 0.35) * e.speed * sm * dt;
      e.y += (dy + Math.sin(e.angle) * 0.35) * e.speed * sm * dt;
    } else if (e.boss) {
      e.patternCd -= dt;
      const chase = e.charge > 0 ? 2.6 : 1;
      e.x += dx * e.speed * chase * sm * dt; e.y += dy * e.speed * chase * sm * dt;
      if (e.charge > 0) e.charge -= dt;
      if (e.patternCd <= 0) {
        e.patternCd = e.isFinal ? rand(2.2, 3.2) : rand(3, 4.2);
        const n = e.isFinal ? 20 : 12;
        for (let k = 0; k < n; k++) {
          const a = k * TAU / n + e.t * 0.5;
          spawnProjectile(e.x, e.y, Math.cos(a) * 210, Math.sin(a) * 210, { color: '#ff4d6d', dmg: e.dmg * 0.7, r: 7, hostile: true, life: 4 });
        }
        for (let k = 0; k < 3; k++) spawnAround(k === 0 ? 'brute' : 'dart');
        if (Math.random() < 0.5) e.charge = 0.9;
        flash('#ff2d55', 0.15);
      }
    } else {
      e.x += dx * e.speed * sm * dt; e.y += dy * e.speed * sm * dt;
    }
    e.angle += dt * (e.type === 'spinner' ? 5 : 1);
    const hitR = e.r + CFG.playerR;
    if (d < hitR && e.atkCd <= 0) { e.atkCd = 0.75; hurtPlayer(e.dmg); }
    const grazeR = hitR + CFG.grazeR;
    if (!e.grazed && d < grazeR && d > hitR) {
      e.grazed = true; G.grazes++;
      p.od = clamp(p.od + 4.6, 0, 100);
      p.combo++; p.comboTimer = 3.0;
      if (Math.random() < 0.25) floater(p.x + rand(-20, 20), p.y - 20, 'GRAZE', '#ffd76a');
      burst(p.x, p.y, '#ffffff', 2, 90, { life: 0.3, r: 2 });
    }
    if (d > grazeR + 30) e.grazed = false;
  }
  G.enemies = G.enemies.filter(e => !e.dead);
  if (G.boss && G.boss.dead) G.boss = null;
}

function areaBlast(x, y, r, dmg, color, special) {
  burst(x, y, color, 10, 220, { life: 0.45, r: 3 });
  G.rings.push({ x, y, r: 2, grow: r * 5, width: 14, dmg: 0, color, hit: {}, life: 0.3, visual: true });
  const len = G.enemies.length;
  for (let k = 0; k < len; k++) { const e = G.enemies[k]; if (!e.dead && dist2(x, y, e.x, e.y) < r * r) dmgEnemy(e, dmg); }
  if (special === 'armageddon' || special === 'meteor') {
    for (let i = 0; i < 3; i++) {
      const a = rand(0, TAU);
      spawnProjectile(x, y, Math.cos(a) * 260, Math.sin(a) * 260, { color, dmg: dmg * 0.5, r: 4, life: 0.5, blast: 0 });
    }
  }
}
function explodeProjectile(pr) {
  if (pr.blast > 0) areaBlast(pr.x, pr.y, pr.blast, pr.dmg * 0.8, pr.color, pr.special);
  else burst(pr.x, pr.y, pr.color, 3, 90, { life: 0.3 });
  pr.dead = true;
}
function updateProjectiles(dt) {
  const p = G.p, arr = G.projectiles, plen = arr.length;
  for (let i = 0; i < plen; i++) {
    const pr = arr[i];
    if (pr.dead) continue;
    pr.life -= dt;
    if (pr.life <= 0) { explodeProjectile(pr); continue; }
    if (pr.homing > 0) {
      const t = pr.target && !pr.target.dead ? pr.target : nearestEnemy(pr.x, pr.y, 420);
      if (t) {
        const a = Math.atan2(t.y - pr.y, t.x - pr.x);
        const cur = Math.atan2(pr.vy, pr.vx);
        let da = a - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const na = cur + clamp(da, -pr.homing * dt, pr.homing * dt);
        const sp = Math.hypot(pr.vx, pr.vy);
        pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
      }
    }
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.angle = Math.atan2(pr.vy, pr.vx);
    pr.trail.push({ x: pr.x, y: pr.y });
    if (pr.trail.length > 6) pr.trail.shift();
    if (pr.hostile) {
      if (dist2(pr.x, pr.y, p.x, p.y) < (CFG.playerR + pr.r) * (CFG.playerR + pr.r)) {
        hurtPlayer(pr.dmg); pr.dead = true; burst(pr.x, pr.y, pr.color, 6, 120, { life: 0.3 });
      }
    } else {
      const elen = G.enemies.length;
      for (let k = 0; k < elen; k++) {
        const e = G.enemies[k];
        if (e.dead) continue;
        if (dist2(pr.x, pr.y, e.x, e.y) < (e.r + pr.r) * (e.r + pr.r)) {
          dmgEnemy(e, pr.dmg);
          if (pr.blast > 0) areaBlast(pr.x, pr.y, pr.blast, pr.dmg * 0.7, pr.color, pr.special);
          else burst(pr.x, pr.y, pr.color, 3, 130, { life: 0.3 });
          if (pr.pierce > 0) pr.pierce--; else pr.dead = true;
          break;
        }
      }
    }
  }
  G.projectiles = G.projectiles.filter(pr => !pr.dead);
}
function updateRings(dt) {
  for (const r of G.rings) {
    r.r += r.grow * dt; r.life -= dt;
    if (r.dmg > 0 && !r.visual) {
      const len = G.enemies.length;
      for (let k = 0; k < len; k++) {
        const e = G.enemies[k];
        if (e.dead || r.hit[e.id]) continue;
        if (Math.abs(dist(r.x, r.y, e.x, e.y) - r.r) < r.width + e.r) { r.hit[e.id] = 1; dmgEnemy(e, r.dmg); }
      }
    }
  }
  G.rings = G.rings.filter(r => r.life > 0);
}
function updatePickups(dt) {
  const p = G.p;
  for (const g of G.pickups) {
    g.life -= dt; g.t += dt * 3;
    const d = dist(g.x, g.y, p.x, p.y);
    if (g.type === 'gem') {
      const ga = Math.atan2(p.y - g.y, p.x - g.x);
      const gs = 140 + d * 0.85;
      g.x += Math.cos(ga) * gs * dt; g.y += Math.sin(ga) * gs * dt;
      g.vx *= 0.92; g.vy *= 0.92;
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < p.reach + 40) {
        const a = Math.atan2(p.y - g.y, p.x - g.x);
        const pull = clamp((p.reach + 60 - d) * 7, 120, 900);
        g.x += Math.cos(a) * pull * dt; g.y += Math.sin(a) * pull * dt;
      }
      if (d < CFG.playerR + 12) { gainXP(g.val); A.sfx('pickup'); g.life = -1; burst(g.x, g.y, '#5ef2ff', 3, 90, { life: 0.3 }); }
    } else {
      if (d < p.reach) { const a = Math.atan2(p.y - g.y, p.x - g.x); g.x += Math.cos(a) * 240 * dt; g.y += Math.sin(a) * 240 * dt; }
      if (d < CFG.playerR + 14) {
        g.life = -1; A.sfx('pickup');
        if (g.type === 'heart') { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.28); floater(p.x, p.y - 24, '+HP', '#ff5c7c'); }
        else if (g.type === 'magnet') { for (const q of G.pickups) if (q.type === 'gem') { q.x = p.x + rand(-30, 30); q.y = p.y + rand(-30, 30); } }
        else if (g.type === 'bomb') { for (const e of G.enemies) if (!e.dead) dmgEnemy(e, 60 * p.dmgMul, true); flash('#ffd76a', 0.5); shake(12); }
        else if (g.type === 'chest') { G.chestQueue++; banner('A GIFT FROM THE VOID', '#ffd76a'); }
      }
    }
  }
  G.pickups = G.pickups.filter(g => g.life > 0);
}
function updateDirector(dt) {
  const t = G.time;
  const pi = phaseIndex();
  if (pi !== G.lastPhase) {
    G.lastPhase = pi;
    banner(PHASES[pi].name, PHASES[pi].accent);
    flash(PHASES[pi].accent, 0.35);
  }
  const rate = Math.min(16, 1.2 + t * 0.045 + pi * 0.6);
  G.spawnAcc += dt * rate;
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    const pool = ['mote', 'mote', 'mote', 'dart'];
    if (t > 22) pool.push('dart', 'spinner');
    if (t > 50) pool.push('brute', 'wisp');
    if (t > 85) pool.push('shooter', 'spinner', 'brute');
    if (t > 150) pool.push('brute', 'shooter', 'wisp', 'dart', 'spinner');
    spawnAround(pick(pool));
  }
  G.eliteTimer -= dt;
  if (G.eliteTimer <= 0) {
    G.eliteTimer = Math.max(12, 26 - t * 0.02) + rand(0, 6);
    spawnAround('elite');
  }
  G.swarmTimer -= dt;
  if (G.swarmTimer <= 0) {
    G.swarmTimer = 42 + rand(0, 8);
    banner('SWARM INCOMING', '#ff6ad5');
    for (let k = 0; k < 22; k++) {
      const a = k * TAU / 22;
      const dd = Math.max(W, H) * 0.62;
      spawnEnemy(pick(['mote', 'dart', 'wisp']), G.p.x + Math.cos(a) * dd, G.p.y + Math.sin(a) * dd);
    }
  }
  if (G.nextBossIdx < G.bossTimes.length) {
    if (t >= G.bossTimes[G.nextBossIdx] && !G.boss) { spawnBoss(G.nextBossIdx === G.bossTimes.length - 1); G.nextBossIdx++; }
  } else if (t >= G.extraBossAt && !G.boss) {
    spawnBoss(true); G.extraBossAt = t + 150;
  }
  if (t >= G.nextMilestone) {
    G.nextMilestone += 30;
    banner(fmtTime(t) + ' SURVIVED', '#5ef2ff');
    G.score += 250 * Math.floor(t / 30);
  }
}
function updateWeapons(dt) {
  for (const w of G.p.weapons) {
    const def = WEAPONS[w.id], s = ws(w);
    if (def.type === 'orbit' || def.type === 'aura') { updateContinuous(w, s, dt); continue; }
    w.cd -= dt;
    if (w.cd <= 0) { w.cd += Math.max(0.05, s.cd); fireWeapon(w, s); }
  }
}
function updatePlayer(dt) {
  const p = G.p;
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (pointer.active) { dx += pointer.dx; dy += pointer.dy; }
  const m = Math.hypot(dx, dy);
  if (m > 0.01) { dx /= m; dy /= m; p.facing = Math.atan2(dy, dx); }
  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.x += p.dashDir.x * CFG.dashSpeed * dt; p.y += p.dashDir.y * CFG.dashSpeed * dt;
    if (Math.random() < 0.8) addParticle(p.x, p.y, playerColor(), { life: 0.35, r: rand(2, 5), vx: -p.dashDir.x * 80, vy: -p.dashDir.y * 80 });
  } else {
    p.x += dx * p.speed * dt; p.y += dy * p.speed * dt;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.comboTimer -= dt;
  if (p.comboTimer <= 0 && p.combo > 0) p.combo = 0;
  p.comboMult = comboMult();
  p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
  p.od = clamp(p.od, 0, 100);
  p.trail.push({ x: p.x, y: p.y });
  if (p.trail.length > 14) p.trail.shift();
  cam.x = lerp(cam.x, p.x, 0.12);
  cam.y = lerp(cam.y, p.y, 0.12);
}
function updateParticles(dt) {
  for (const q of G.particles) {
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
    const drag = Math.pow(q.drag, dt * 60);
    q.vx *= drag; q.vy *= drag;
  }
  G.particles = G.particles.filter(q => q.life > 0);
}
function updateFloaters(dt) {
  for (const f of G.floaters) { f.life -= dt; f.y += f.vy * dt; }
  G.floaters = G.floaters.filter(f => f.life > 0);
}
function updateArcs(dt) {
  for (const a of G.arcs) a.life -= dt;
  G.arcs = G.arcs.filter(a => a.life > 0);
}

function update(dt) {
  G.time += dt;
  updatePlayer(dt);
  updateDirector(dt);
  updateEnemies(dt);
  updateWeapons(dt);
  updateProjectiles(dt);
  updateRings(dt);
  updateArcs(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateFloaters(dt);
  A.intensity = clamp(0.12 + G.time / 320 + G.enemies.length / 280 + (G.boss ? 0.35 : 0), 0, 1);
  checkAchievements();
  maybeOpenChoice();
}
