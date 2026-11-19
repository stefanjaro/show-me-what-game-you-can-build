'use strict';
let W = 0, H = 0, dpr = 1, vignette = null;
function resize() {
  W = window.innerWidth; H = window.innerHeight; dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.72)');
  vignette = g;
}
window.addEventListener('resize', resize);

const stars = [];
function initStars() {
  stars.length = 0;
  for (let i = 0; i < 150; i++) stars.push({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), r: rand(0.4, 1.7), tw: rand(0, TAU) });
}
const ambient = [];
function initAmbient() {
  ambient.length = 0;
  for (let i = 0; i < 70; i++) ambient.push({ x: rand(0, 2000), y: rand(0, 2000), r: rand(1, 3.2), vx: rand(-9, 9), vy: rand(-14, -3), a: rand(0.15, 0.6), ph: rand(0, TAU) });
}

const keys = {};
const pointer = { active: false, ox: 0, oy: 0, x: 0, y: 0, dx: 0, dy: 0 };
let scene = 'title';
let backTarget = 'title';
let G = null;
let warnTimer = 0;
const cam = { x: 0, y: 0 };
const effects = { shake: 0, flash: 0, flashColor: '#ffffff', slowmo: 0, hitstop: 0 };

function phase() { return PHASES[Math.min(PHASES.length - 1, Math.floor((G ? G.time : 0) / 75))]; }
function phaseIndex() { return Math.min(PHASES.length - 1, Math.floor((G ? G.time : 0) / 75)); }
function playerColor() {
  const ch = CHAR_BY_ID[Save.data.selectedChar];
  if (ch && ch.rainbow) return RAINBOW[Math.floor(now() * 3) % RAINBOW.length];
  return ch ? ch.color : '#5ef2ff';
}
function activeAccent() { return phase().accent; }

function shake(m) {
  if (!Save.data.settings.shake || Save.data.settings.reduced) return;
  effects.shake = Math.min(34, effects.shake + m);
}
function flash(color, amt) { effects.flashColor = color; effects.flash = Math.min(1, effects.flash + amt); }
function banner(text, color) {
  const el = $('warn'); el.textContent = text; el.style.color = color || '#fff'; el.style.opacity = '1'; warnTimer = 2.3;
}
function toast(title, sub) {
  const d = document.createElement('div'); d.className = 'toast';
  d.innerHTML = title + (sub ? '<small>' + sub + '</small>' : '');
  $('toasts').appendChild(d);
  setTimeout(() => { d.style.transition = 'opacity .4s, transform .4s'; d.style.opacity = '0'; d.style.transform = 'translateY(-10px)'; setTimeout(() => d.remove(), 420); }, 2600);
}
function glow(color, x, y, r, a) {
  ctx.globalAlpha = a === undefined ? 1 : a;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
function addParticle(x, y, color, opt) {
  if (!G || G.particles.length >= CFG.maxParticles) return;
  const o = opt || {};
  G.particles.push({
    x, y, vx: o.vx === undefined ? rand(-90, 90) : o.vx, vy: o.vy === undefined ? rand(-90, 90) : o.vy,
    life: o.life || rand(0.3, 0.75), max: o.life || 0.6, r: o.r || rand(1.5, 4), color,
    drag: o.drag === undefined ? 0.9 : o.drag, spark: !!o.spark,
  });
}
function burst(x, y, color, n, spd, opt) {
  const o = opt || {};
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.3, spd);
    addParticle(x, y, color, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: o.life || rand(0.3, 0.7), r: o.r || rand(1.5, 3.6), spark: o.spark });
  }
}
function floater(x, y, text, color, big) {
  if (!G) return;
  G.floaters.push({ x, y, text, color, life: big ? 1.3 : 0.85, max: big ? 1.3 : 0.85, big: !!big, vy: big ? -34 : -46 });
}

let entityId = 1;
function spawnEnemy(type, x, y, opt) {
  const d = ETYPE[type];
  if (!G || (G.enemies.length >= CFG.maxEnemies && !d.boss && !d.elite)) return null;
  const o = opt || {};
  const hpScale = 1 + G.time / 95 + phaseIndex() * 0.15;
  const e = {
    id: entityId++, type, x, y, vx: 0, vy: 0, r: d.r * (o.scale || 1), color: d.color,
    hp: d.hp * hpScale * (o.hpMul || 1), maxHp: d.hp * hpScale * (o.hpMul || 1),
    dmg: d.dmg * (1 + G.time / 320), speed: d.speed * (o.speedMul || 1),
    atkCd: rand(0, 0.4), flash: 0, dead: false, grazed: false, hitCd: 0, slow: 0,
    angle: rand(0, TAU), t: rand(0, 10), elite: !!d.elite, boss: !!d.boss,
    xp: d.xp, split: !!d.split, shootCd: rand(1, 2.5), patternCd: rand(2, 4), charge: 0,
    isFinal: !!o.isFinal, name: o.name || (d.boss ? 'HERALD OF THE VOID' : ''),
  };
  G.enemies.push(e);
  return e;
}
function spawnAround(type, opt) {
  const a = rand(0, TAU), d = Math.max(W, H) * 0.6 + rand(60, 140);
  return spawnEnemy(type, G.p.x + Math.cos(a) * d, G.p.y + Math.sin(a) * d, opt);
}
function spawnProjectile(x, y, vx, vy, opt) {
  if (!G || G.projectiles.length >= CFG.maxProjectiles) return;
  const o = opt || {};
  G.projectiles.push({
    x, y, vx, vy, r: o.r || 5, color: o.color || playerColor(), dmg: o.dmg || 10,
    life: o.life || 1.6, maxLife: o.life || 1.6, pierce: o.pierce || 0,
    homing: o.homing || 0, hostile: !!o.hostile, blast: o.blast || 0,
    special: o.special || null, target: o.target || null, trail: [], dead: false,
    angle: Math.atan2(vy, vx), spin: o.spin || 0,
  });
}
function dropGem(x, y, val) {
  if (!G) return;
  G.pickups.push({ type: 'gem', x, y, vx: rand(-40, 40), vy: rand(-40, 40), r: 6 + Math.min(6, val * 0.25), val, color: '#5ef2ff', life: 22, t: rand(0, TAU) });
}
function dropPickup(x, y, type) {
  if (!G) return;
  const map = { heart: { color: '#ff5c7c', r: 9 }, magnet: { color: '#9dffef', r: 9 }, bomb: { color: '#ffd76a', r: 9 }, chest: { color: '#ffd76a', r: 13 } };
  const m = map[type];
  G.pickups.push({ type, x, y, vx: 0, vy: 0, r: m.r, color: m.color, life: 26, t: rand(0, TAU) });
}

function recalc() {
  const p = G.p, u = Save.data.upgrades, P = p.passives, ch = CHAR_BY_ID[Save.data.selectedChar] || CHARACTERS[0];
  const L = id => P[id] || 0;
  p.maxHp = Math.round((100 + L('vitality') * 22 + (u.vitality || 0) * 12) * ch.hpMul);
  p.hp = Math.min(p.hp, p.maxHp);
  p.dmgMul = (1 + L('power') * 0.15 + (u.power || 0) * 0.06) * ch.dmgMul;
  p.cdr = clamp(L('focus') * 0.07 + (u.haste || 0) * 0.05, 0, 0.62);
  p.areaMul = 1 + L('area') * 0.15;
  p.projBonus = L('multi');
  p.speed = CFG.playerSpeed * (1 + L('velocity') * 0.09 + (u.velocity || 0) * 0.04) * ch.speedMul;
  p.armor = clamp(L('armor') * 0.07 + (u.resilience || 0) * 0.04 + (ch.armorBonus || 0), 0, 0.72);
  p.reach = CFG.pickupBase * (1 + L('reach') * 0.25 + (u.reach || 0) * 0.12);
  p.regen = L('regen') * 0.6;
  p.luck = 1 + L('fortune') * 0.15 + (u.fortune || 0) * 0.10;
  p.xpMul = 1 + L('insight') * 0.15 + (ch.xpBonus ? ch.xpBonus - 1 : 0);
  p.crit = Math.min(0.65, L('precision') * 0.06);
  p.critMul = 2 + L('precision') * 0.1;
}
function ws(w) {
  const b = WEAPONS[w.id].base, p = G.p, L = w.level;
  return {
    dmg: (b.dmg || 0) * (1 + (L - 1) * 0.22) * p.dmgMul,
    cd: Math.max(0.06, (b.cd || 1) * (1 - (L - 1) * 0.04) * (1 - p.cdr)),
    count: (b.count || 1) + p.projBonus + (L >= 5 ? 1 : 0),
    speed: b.speed || 0, radius: (b.radius || 0) * p.areaMul,
    grow: (b.grow || 0) * p.areaMul, width: (b.width || 0) * p.areaMul,
    spread: b.spread || 0, pierce: (b.pierce || 0) + (L >= 6 ? 1 : 0),
    jumps: (b.jumps || 0) + Math.floor((L - 1) / 2),
    range: (b.range || 0) * p.areaMul, blast: (b.blast || 0) * p.areaMul,
    spin: b.spin || 1, homing: b.homing || 0, tick: b.tick || 0.3,
    special: WEAPONS[w.id].special || null,
  };
}
function nearestEnemy(x, y, maxD, exclude) {
  let best = null, bd = maxD ? maxD * maxD : Infinity;
  for (let i = 0; i < G.enemies.length; i++) {
    const e = G.enemies[i];
    if (e.dead || (exclude && exclude.indexOf(e) >= 0)) continue;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 < bd) { bd = d2; best = e; }
  }
  return best;
}

function fireWeapon(w, s) {
  const p = G.p, def = WEAPONS[w.id];
  const target = nearestEnemy(p.x, p.y, 900);
  const baseAng = target ? Math.atan2(target.y - p.y, target.x - p.x) : p.facing;
  if (def.type === 'bolt') {
    for (let i = 0; i < s.count; i++) {
      const a = baseAng + (i - (s.count - 1) / 2) * 0.16;
      spawnProjectile(p.x, p.y, Math.cos(a) * s.speed, Math.sin(a) * s.speed, { color: def.color, dmg: s.dmg, r: 6, pierce: s.pierce, homing: s.homing, life: 1.9, special: s.special, target });
    }
    A.sfx('shoot');
  } else if (def.type === 'shard') {
    for (let i = 0; i < s.count; i++) {
      const a = baseAng + (i - (s.count - 1) / 2) * (s.spread / Math.max(1, s.count - 1));
      spawnProjectile(p.x, p.y, Math.cos(a) * s.speed * rand(0.85, 1.1), Math.sin(a) * s.speed * rand(0.85, 1.1), { color: def.color, dmg: s.dmg, r: s.special ? 8 : 5, pierce: s.pierce, life: 1.3, blast: s.special ? s.blast : 0, spin: 6 });
    }
    A.sfx('shoot');
  } else if (def.type === 'missile') {
    for (let i = 0; i < s.count; i++) {
      const a = baseAng + (i - (s.count - 1) / 2) * 0.5 + rand(-0.15, 0.15);
      spawnProjectile(p.x, p.y, Math.cos(a) * s.speed, Math.sin(a) * s.speed, { color: def.color, dmg: s.dmg, r: 6, life: 2.3, blast: s.blast, homing: 4.5, special: s.special, target });
    }
    A.sfx('shoot');
  } else if (def.type === 'ring') {
    const waves = s.special ? 2 : 1;
    for (let k = 0; k < waves; k++) G.rings.push({ x: p.x, y: p.y, r: 10 + k * 30, grow: s.grow, width: s.width, dmg: s.dmg, color: def.color, hit: {}, life: (s.special ? 900 : 620) / s.grow });
    A.sfx('shoot');
  } else if (def.type === 'chain') {
    let cur = nearestEnemy(p.x, p.y, s.range);
    const hit = [], jumps = s.jumps;
    let fx = p.x, fy = p.y;
    for (let j = 0; j < jumps && cur; j++) {
      hit.push(cur);
      G.arcs.push({ x1: fx, y1: fy, x2: cur.x, y2: cur.y, color: def.color, life: 0.16, seed: rand(0, 1000) });
      dmgEnemy(cur, s.dmg * (j === 0 ? 1 : 0.8));
      if (s.special) cur.slow = 0.9;
      fx = cur.x; fy = cur.y;
      cur = nearestEnemy(fx, fy, s.range, hit);
    }
    A.sfx('shoot');
  }
}

function updateContinuous(w, s, dt) {
  const def = WEAPONS[w.id], p = G.p;
  if (def.type === 'orbit') {
    w.angle = (w.angle || 0) + dt * s.spin;
    w.tick = (w.tick || 0) - dt;
    const doTick = w.tick <= 0;
    if (doTick) w.tick = s.tick;
    w._orbs = w._orbs || [];
    w._orbs.length = s.count;
    for (let i = 0; i < s.count; i++) {
      const a = w.angle + i * TAU / s.count;
      const ox = p.x + Math.cos(a) * s.radius, oy = p.y + Math.sin(a) * s.radius;
      w._orbs[i] = { x: ox, y: oy };
      if (doTick) {
        for (let k = 0; k < G.enemies.length; k++) {
          const e = G.enemies[k];
          if (e.dead) continue;
          if (dist2(ox, oy, e.x, e.y) < (e.r + 12) * (e.r + 12)) dmgEnemy(e, s.dmg);
        }
      }
    }
    if (doTick && s.special === 'horizon') {
      for (let k = 0; k < G.enemies.length; k++) {
        const e = G.enemies[k];
        if (e.dead || e.boss) continue;
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < s.radius + 90 && d > 1) { e.x -= (e.x - p.x) / d * 140 * dt; e.y -= (e.y - p.y) / d * 140 * dt; }
      }
    }
  } else if (def.type === 'aura') {
    w.tick = (w.tick || 0) - dt;
    if (w.tick <= 0) {
      w.tick = s.tick;
      for (let k = 0; k < G.enemies.length; k++) {
        const e = G.enemies[k];
        if (e.dead) continue;
        if (dist2(p.x, p.y, e.x, e.y) < s.radius * s.radius + e.r * e.r) dmgEnemy(e, s.dmg);
      }
      if (s.special === 'crusader') p.hp = Math.min(p.maxHp, p.hp + 1.5);
    }
  }
}

function dmgEnemy(e, dmg, force) {
  if (e.dead) return;
  let crit = false;
  if (!force && G.p.crit > 0 && Math.random() < G.p.crit) { dmg *= G.p.critMul; crit = true; }
  e.hp -= dmg; e.flash = 0.12;
  if (Math.random() < 0.22) floater(e.x + rand(-8, 8), e.y - e.r, (crit ? '!' : '') + Math.round(dmg), crit ? '#ffd76a' : '#e9f2ff', crit);
  if (Math.random() < 0.3) burst(e.x, e.y, e.color, 2, 120, { life: 0.3, r: 2 });
  A.sfx('hit');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const p = G.p;
  G.kills++;
  p.combo++; p.comboTimer = 3.0;
  p.od = clamp(p.od + 2.4, 0, 100);
  const mult = comboMult();
  G.score += Math.round((10 + e.xp * 4) * mult * (1 + G.time / 140));
  burst(e.x, e.y, e.color, e.boss ? 60 : e.elite ? 26 : 8, e.boss ? 340 : 180, { life: rand(0.4, 0.9), r: rand(2, 5) });
  effects.hitstop = e.boss ? 0.09 : e.elite ? 0.05 : 0;
  shake(e.boss ? 20 : e.elite ? 8 : 1.2);
  A.sfx('kill');
  if (e.boss) { bossDefeated(e); return; }
  if (e.split && G.enemies.length < CFG.maxEnemies - 2) for (let i = 0; i < 2; i++) spawnEnemy('mote', e.x + rand(-14, 14), e.y + rand(-14, 14), { scale: 0.8 });
  if (Math.random() < 0.9 * (e.elite ? 3 : 1)) dropGem(e.x, e.y, e.xp * (1 + G.time / 200) * rand(0.8, 1.3));
  if (e.elite) { dropPickup(e.x, e.y, 'chest'); dropPickup(e.x + 16, e.y, 'heart'); }
  if (Math.random() < 0.012 * G.p.luck) dropPickup(e.x, e.y, 'heart');
  if (Math.random() < 0.006 * G.p.luck) dropPickup(e.x, e.y, pick(['magnet', 'bomb']));
}
function bossDefeated(e) {
  G.bossKills++;
  G.score += Math.round(2500 * comboMult());
  flash('#ffffff', 0.8); shake(28); effects.slowmo = 1.4;
  G.p.hp = Math.min(G.p.maxHp, G.p.hp + 30);
  for (let i = 0; i < 3; i++) dropPickup(e.x + rand(-30, 30), e.y + rand(-30, 30), 'chest');
  dropGem(e.x, e.y, 40);
  banner('BOSS SLAIN', '#ffd76a');
  A.sfx('ach');
  $('bossWrap').classList.add('hidden');
  G.boss = null;
  if (e.isFinal && !G.transcended) {
    G.transcended = true;
    unlockAch('transcend');
    setTimeout(() => victory(), 900);
  }
  checkAchievements();
}
function comboMult() { return 1 + Math.min(2.2, Math.floor(G.p.combo / 8) * 0.1); }
function gainXP(v) {
  const p = G.p;
  p.xp += v * p.xpMul;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = Math.round(CFG.xpBase * Math.pow(CFG.xpGrowth, p.level - 1));
    p.hp = Math.min(p.maxHp, p.hp + 4);
    G.pendingLevels++;
    A.sfx('levelup');
    floater(p.x, p.y - 30, 'LEVEL ' + p.level, '#5ef2ff', true);
    flash(playerColor(), 0.25);
  }
}

function nova() {
  const p = G.p;
  if (p.od < 100 || !G.active || scene !== 'play') return;
  p.od = 0; G.novas++;
  effects.slowmo = 1.15; effects.hitstop = 0.08;
  flash(playerColor(), 0.95); shake(24);
  A.sfx('nova');
  banner('N O V A', playerColor());
  for (const e of G.enemies) {
    if (e.dead) continue;
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    e.x += Math.cos(a) * 90; e.y += Math.sin(a) * 90;
    dmgEnemy(e, 75 * p.dmgMul + p.level * 7, true);
  }
  G.projectiles = G.projectiles.filter(pr => !pr.hostile);
  G.rings.push({ x: p.x, y: p.y, r: 20, grow: 1500, width: 60, dmg: 0, color: playerColor(), hit: {}, life: 0.9, visual: true });
  p.hp = Math.min(p.maxHp, p.hp + 12);
  G.score += Math.round(500 * comboMult());
  floater(p.x, p.y - 40, 'NOVA', '#ffffff', true);
  burst(p.x, p.y, playerColor(), 60, 620, { life: 0.9, r: 4 });
  checkAchievements();
}
function dash() {
  const p = G.p;
  if (p.dashCd > 0 || p.dashTimer > 0 || !G.active) return;
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;
  if (pointer.active) { dx = pointer.dx; dy = pointer.dy; }
  const m = Math.hypot(dx, dy);
  if (m < 0.1) { dx = Math.cos(p.facing); dy = Math.sin(p.facing); }
  else { dx /= m; dy /= m; }
  p.dashDir = { x: dx, y: dy };
  p.dashTimer = CFG.dashTime; p.dashCd = CFG.dashCd; p.invuln = Math.max(p.invuln, 0.35);
  A.sfx('dash');
  burst(p.x, p.y, playerColor(), 16, 220, { life: 0.4 });
}
function hurtPlayer(dmg) {
  const p = G.p;
  if (p.invuln > 0 || !G.active) return;
  dmg *= (1 - p.armor);
  p.hp -= dmg; p.invuln = 0.7;
  shake(10); flash('#ff2d55', 0.3); A.sfx('hurt');
  floater(p.x, p.y - 26, '-' + Math.round(dmg), '#ff5c7c');
  burst(p.x, p.y, '#ff5c7c', 12, 200, { life: 0.5 });
  if (p.combo >= 15) floater(p.x, p.y + 10, 'COMBO LOST', '#ff8a5b');
  p.combo = 0; p.comboTimer = 0; p.od = Math.max(0, p.od - 12);
  if (p.hp <= 0) {
    if (G.revives > 0) {
      G.revives--; p.hp = p.maxHp * 0.6; p.invuln = 2.2;
      flash('#ffffff', 0.9); shake(26); effects.slowmo = 1.2;
      banner('SECOND LIFE', '#ffffff');
      for (const e of G.enemies) if (!e.dead) dmgEnemy(e, 99999, true);
      A.sfx('win');
    } else gameOver(false);
  }
}
function spawnBoss(isFinal) {
  const e = spawnAround('boss', {
    hpMul: 1 + G.bossSpawned * 0.55, scale: isFinal ? 1.35 : 1,
    name: isFinal ? 'THE DEVOURER' : 'HERALD OF THE VOID', isFinal: isFinal,
  });
  G.bossSpawned++;
  G.boss = e;
  if (e) {
    $('bossName').textContent = e.name;
    $('bossWrap').classList.remove('hidden');
    banner(isFinal ? 'THE DEVOURER AWAKENS' : 'A HERALD APPROACHES', '#ff4d6d');
    flash('#ff2d55', 0.4); shake(16); A.sfx('boss');
  }
}
