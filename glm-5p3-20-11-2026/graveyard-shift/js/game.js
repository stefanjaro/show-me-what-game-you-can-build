'use strict';
const G = {
  cv: null, x: null, W: 0, H: 0, dpr: 1,
  state: 'boot', paused: false, frozen: false, overlay: null,
  time: 0, rtime: 0, hitstop: 0, dtScale: 1, slowmo: 0,
  cam: { x: 0, y: 0, trauma: 0, sx: 0, sy: 0 },
  save: null, char: 'necro',
  p: null, enemies: [], minions: [], corpses: [], souls: [], projs: [], eprojs: [],
  swings: [], parts: [], dnums: [], zaps: [], decals: [], chests: [], orbit: [],
  grid: new Map(), waveIdx: 0, spawnAcc: 0, eliteIdx: 0, champIdx: 0, ringNext: 0,
  endless: false, boss: null, seraphSpawned: false, winT: 0, overT: 0, overKind: '',
  frameMs: 16, q: 2, qTimer: 0, last: 0, comboSndT: 0, sfxKillT: 0, raiseT: 0,
  mv: { x: 1, y: 0 }, keys: {}, mouse: { down: false, x: 0, y: 0 }, touch: null,
  lvQueue: 0, rerolls: 0, hudC: {}, ambT: 0, fogP: []
};

(function () {
  const CELL = 96, PCELL = 170;

  G.init = function () {
    G.cv = document.getElementById('cv');
    G.x = G.cv.getContext('2d');
    window.addEventListener('resize', G.resize);
    window.addEventListener('keydown', G.keyDown);
    window.addEventListener('keyup', G.keyUp);
    G.cv.addEventListener('mousedown', e => { G.mouse.down = true; G.setMouse(e); });
    window.addEventListener('mousemove', G.setMouse);
    window.addEventListener('mouseup', () => { G.mouse.down = false; });
    G.cv.addEventListener('contextmenu', e => e.preventDefault());
    G.cv.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      G.touch = { ax: t.clientX, ay: t.clientY, dx: 0, dy: 0 };
    }, { passive: false });
    G.cv.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!G.touch) return;
      const t = e.touches[0];
      G.touch.dx = t.clientX - G.touch.ax;
      G.touch.dy = t.clientY - G.touch.ay;
    }, { passive: false });
    G.cv.addEventListener('touchend', e => { e.preventDefault(); G.touch = null; }, { passive: false });
    G.pattern = G.x.createPattern(SPR.groundPat, 'repeat');
    const ids = ['xpfill', 'lvltxt', 'timer', 'killtxt', 'esstxt', 'mintxt', 'hpfill', 'hptxt', 'abfill', 'abwrap', 'bosswrap', 'bossname', 'bossfill'];
    ids.forEach(id => G.hudC[id] = document.getElementById(id));
    G.resize();
    G.last = performance.now();
    requestAnimationFrame(G.frame);
  };

  G.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    G.W = w; G.H = h;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * dpr * dpr > 2300000) dpr = Math.max(1, Math.sqrt(2300000 / (w * h)));
    G.dpr = dpr;
    G.cv.width = Math.round(w * dpr);
    G.cv.height = Math.round(h * dpr);
    G.cv.style.width = w + 'px';
    G.cv.style.height = h + 'px';
  };

  G.keyDown = function (e) {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && (G.state === 'run' || G.state === 'title')) e.preventDefault();
    if (G.keys[k]) return;
    G.keys[k] = true;
    if (k === 'p' || k === 'escape') {
      if (G.state === 'run' && !G.frozen) UI.togglePause();
    }
    if (k === ' ' && G.state === 'run' && !G.paused && !G.frozen) G.tryAbility();
  };
  G.keyUp = function (e) { G.keys[e.key.toLowerCase()] = false; };
  G.setMouse = function (e) { G.mouse.x = e.clientX; G.mouse.y = e.clientY; };

  G.beginRun = function (charId) {
    G.char = charId;
    const C = DATA.chars[charId], m = G.save.meta;
    G.state = 'run';
    G.paused = false; G.frozen = false; G.overlay = null;
    G.time = 0; G.hitstop = 0; G.dtScale = 1; G.slowmo = 0;
    G.endless = false; G.boss = null; G.seraphSpawned = false; G.overT = 0; G.winT = 0; G.overKind = '';
    G.waveIdx = 0; G.spawnAcc = 0; G.eliteIdx = 0; G.champIdx = 0; G.ringNext = DATA.ringStart;
    G.enemies.length = 0; G.minions.length = 0; G.corpses.length = 0; G.souls.length = 0;
    G.projs.length = 0; G.eprojs.length = 0; G.swings.length = 0; G.parts.length = 0;
    G.dnums.length = 0; G.zaps.length = 0; G.decals.length = 0; G.chests.length = 0; G.orbit.length = 0;
    G.rerolls = m.reroll || 0;
    G.p = {
      x: 0, y: 0, hp: 1, maxhp: C.hp + (m.vitality || 0) * 14, regen: (C.regen || 0) + (charId === 'doctor' ? 1 : 0),
      spdBase: 250, face: 1, level: 1, xp: 0, need: DATA.xpNeed(1),
      weapons: [{ id: C.weapon, lv: 1, t: 0 }], pas: {},
      dmgMul: 1, cdMul: 1, xpMul: 1, pickR: 90, critC: 0.05, armor: 1, raiseC: 0.35 + (C.raise || 0),
      minionCap: 12 + (m.mastery || 0), minionDmg: 8,
      abT: 0, abDur: 0, combo: 0, comboT: 0, kills: 0, raised: 0, essence: 0, elites: 0, champs: 0,
      hitCd: 0, hurtT: 0, reviveLeft: (m.revive || 0), dead: false, win: false, ghostT: 0, walkT: 0
    };
    G.recompute();
    G.p.hp = G.p.maxhp;
    G.cam.x = 0; G.cam.y = 0; G.cam.trauma = 0;
    G.lvQueue = 0;
    G.fogP = [];
    for (let i = 0; i < 5; i++) G.fogP.push({ x: U.rand(-600, 600), y: U.rand(-400, 400), s: U.rand(1.4, 2.6), v: U.rand(4, 9) });
    A.startMusic('run');
    UI.setHUD(true);
    UI.banner('NIGHT FALLS', 'the dead are listening');
  };

  G.recompute = function () {
    const p = G.p, C = DATA.chars[G.char], m = G.save.meta, pas = p.pas;
    const lv = id => pas[id] || 0;
    p.maxhp = C.hp + (m.vitality || 0) * 14 + lv('sigil') * 25;
    p.regen = (G.char === 'doctor' ? 1 : 0) + lv('sigil') * 0.6;
    const spdMul = C.spd * (1 + (m.swift || 0) * 0.04 + lv('boots') * 0.10);
    p.spd = 250 * spdMul;
    p.dmgMul = 1 + (m.might || 0) * 0.06 + lv('cursed') * 0.10;
    p.cdMul = Math.max(0.6, 1 - lv('occult') * 0.08);
    p.xpMul = 1 + (m.wisdom || 0) * 0.08;
    p.essMul = 1 + (m.greed || 0) * 0.10;
    p.pickR = 90 * (1 + lv('magnet') * 0.45);
    p.critC = 0.05 + (m.luck || 0) * 0.02 + (C.crit || 0);
    p.armor = Math.max(0.7, 1 - (m.armor || 0) * 0.05);
    p.raiseC = 0.35 + (C.raise || 0) + lv('craft') * 0.07;
    p.minionCap = 12 + (m.mastery || 0) + lv('craft') * 2;
    p.minionDmg = (8 + p.level * 0.35) * (1 + lv('craft') * 0.15 + (m.mastery || 0) * 0.06);
    p.zapChains = C.zapChains || 0;
    p.miasmaMul = G.char === 'doctor' ? 1.3 : 1;
    p.luck = C.luck || 0;
  };

  G.frame = function (now) {
    const dt = Math.min(33, now - G.last) / 1000;
    G.last = now;
    G.frameMs = G.frameMs * 0.95 + (dt * 1000) * 0.05;
    G.qTimer += dt;
    if (G.qTimer > 2.5) {
      G.qTimer = 0;
      if (G.frameMs > 30 && G.q > 0) G.q--;
      else if (G.frameMs < 20 && G.q < 2) G.q++;
    }
    let sdt = dt;
    if (G.hitstop > 0) { G.hitstop -= dt; sdt = 0; }
    if (G.slowmo > 0) { G.slowmo -= dt; sdt *= 0.25; }
    if (G.state === 'run' && !G.paused && !G.frozen && !G.p.dead) G.update(sdt);
    if (G.state === 'run' && G.p.dead) G.overUpdate(sdt, dt);
    if (G.state === 'title') G.titleUpdate(dt);
    G.render();
    requestAnimationFrame(G.frame);
  };

  G.overUpdate = function (dt, real) {
    G.overT += real;
    G.ambT += dt;
    G.updateParts(dt);
    if (G.overT > 1.7 && !G.overKind) {
      G.overKind = G.p.win ? 'win' : 'death';
      if (G.overKind === 'win') UI.showWin(G.runStats());
      else UI.showDeath(G.runStats());
    }
  };

  G.update = function (dt) {
    G.time += dt;
    const p = G.p;
    let mvx = 0, mvy = 0;
    if (G.keys['w'] || G.keys['arrowup']) mvy -= 1;
    if (G.keys['s'] || G.keys['arrowdown']) mvy += 1;
    if (G.keys['a'] || G.keys['arrowleft']) mvx -= 1;
    if (G.keys['d'] || G.keys['arrowright']) mvx += 1;
    if (G.touch && (Math.abs(G.touch.dx) > 8 || Math.abs(G.touch.dy) > 8)) {
      const l = Math.hypot(G.touch.dx, G.touch.dy);
      mvx = G.touch.dx / l; mvy = G.touch.dy / l;
    } else if (mvx === 0 && mvy === 0 && G.mouse.down) {
      const wx = G.mouse.x - G.W / 2, wy = G.mouse.y - G.H / 2;
      const l = Math.hypot(wx, wy);
      if (l > 24) { mvx = wx / l; mvy = wy / l; }
    }
    if (mvx || mvy) {
      const l = Math.hypot(mvx, mvy);
      mvx /= l; mvy /= l;
      G.mv.x = mvx; G.mv.y = mvy;
      if (mvx) p.face = mvx > 0 ? 1 : -1;
      p.walkT += dt * 9;
    } else p.walkT = 0;
    p.x += mvx * p.spd * dt;
    p.y += mvy * p.spd * dt;

    G.cam.x = p.x; G.cam.y = p.y;
    G.cam.trauma = Math.max(0, G.cam.trauma - dt * 2.2);
    const sh = G.cam.trauma * G.cam.trauma * 15;
    G.cam.sx = U.rand(-sh, sh); G.cam.sy = U.rand(-sh, sh);

    if (p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
    p.hitCd -= dt; p.hurtT = Math.max(0, p.hurtT - dt);
    p.abT = Math.max(0, p.abT - dt);
    if (p.abDur > 0) p.abDur -= dt;
    if (p.comboT > 0) { p.comboT -= dt; if (p.comboT <= 0) p.combo = 0; }
    G.sfxKillT -= dt; G.comboSndT -= dt; G.raiseT -= dt;

    G.buildGrid();
    G.waves(dt);
    G.updateWeapons(dt);
    G.updateEnemies(dt);
    G.updateMinions(dt);
    G.updateCorpses(dt);
    G.updateSouls(dt);
    G.updateProjs(dt);
    G.updateEProjs(dt);
    G.updateParts(dt);
    G.updateChests(dt);
    G.ambT += dt;
    if (G.ambT > 0.9 && G.q > 0) {
      G.ambT = 0;
      const a = U.rand(0, TAU);
      const d = Math.max(G.W, G.H) * 0.55;
      G.parts.push({ x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, vx: U.rand(-14, 14), vy: U.rand(-24, -8), t: 0, life: U.rand(4, 7), spr: 'wisp', add: true, al: 0.5 });
    }
    if (p.hp < p.maxhp * 0.3 && U.chance(dt * 1.2)) {
      G.parts.push({ x: p.x + U.rand(-10, 10), y: p.y - 40, vx: 0, vy: -30, t: 0, life: 0.8, spr: 'wisp', add: true, al: 0.6 });
    }
    G.syncHUD();
  };

  G.buildGrid = function () {
    G.grid.clear();
    for (let i = 0; i < G.enemies.length; i++) {
      const e = G.enemies[i];
      const cx = U.clamp(Math.floor(e.x / CELL) + 4096, 0, 8191);
      const cy = U.clamp(Math.floor(e.y / CELL) + 4096, 0, 8191);
      const k = cx * 8192 + cy;
      let a = G.grid.get(k);
      if (!a) { a = []; G.grid.set(k, a); }
      a.push(e);
    }
  };
  G.gridAt = function (x, y, r, out) {
    out.length = 0;
    const x0 = U.clamp(Math.floor((x - r) / CELL) + 4096, 0, 8191);
    const x1 = U.clamp(Math.floor((x + r) / CELL) + 4096, 0, 8191);
    const y0 = U.clamp(Math.floor((y - r) / CELL) + 4096, 0, 8191);
    const y1 = U.clamp(Math.floor((y + r) / CELL) + 4096, 0, 8191);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const a = G.grid.get(cx * 8192 + cy);
      if (a) for (let i = 0; i < a.length; i++) out.push(a[i]);
    }
    return out;
  };
  G.qarr = [];
  G.nearEnemies = function (x, y, r) { return G.gridAt(x, y, r, G.qarr); };

  G.waves = function (dt) {
    const tl = DATA.timeline;
    while (G.waveIdx < tl.length - 1 && G.time >= tl[G.waveIdx + 1].t) G.waveIdx++;
    let rate = tl[G.waveIdx].rate;
    if (G.endless) rate = 21 + (G.time - DATA.winTime) / 20;
    if (G.seraphSpawned && !G.endless) rate *= 0.45;
    if (G.enemies.length < 300) {
      G.spawnAcc += rate * dt;
      while (G.spawnAcc >= 1) {
        G.spawnAcc--;
        G.spawn(U.pick(tl[G.waveIdx].types));
      }
    }
    if (G.eliteIdx < DATA.eliteTimes.length && G.time >= DATA.eliteTimes[G.eliteIdx]) {
      G.eliteIdx++;
      G.spawn('elite');
      if (G.time > 600) G.spawn('elite');
      A.sfx('warn');
    }
    if (G.champIdx < DATA.champTimes.length && G.time >= DATA.champTimes[G.champIdx]) {
      G.champIdx++;
      G.spawn('champ');
      UI.banner('A CHAMPION OF DAWN APPROACHES', 'it carries a relic');
      A.sfx('roar');
      G.cam.trauma = Math.min(1, G.cam.trauma + 0.5);
    }
    if (!G.endless && G.time >= G.ringNext) {
      const n = 26 + Math.floor(G.time / 60);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        G.spawnAt(U.pick(['acolyte', 'penitent']), G.p.x + Math.cos(a) * 480, G.p.y + Math.sin(a) * 480);
      }
      do { G.ringNext += DATA.ringEvery; } while (G.ringNext <= G.time);
    }
    if (!G.endless && !G.seraphSpawned && G.time >= DATA.winTime) {
      G.seraphSpawned = true;
      G.spawn('seraph');
      UI.banner('THE SERAPH OF DAWN', 'bearer of the morning sword');
      A.startMusic('boss');
      A.sfx('roar');
      G.cam.trauma = 1;
    }
    const min = G.time / 60;
    if (G.endless && G.time > DATA.winTime + 120 && G.champIdx < 99) {
      if (G.time > G.ringNext) { G.ringNext = G.time + 90; G.spawn('champ'); G.spawn('elite'); }
    }
    const inten = G.seraphSpawned && !G.endless ? 3 : min > 12 ? 3 : min > 5 ? 2 : 1;
    if (G.endless) A.setIntensity(3); else A.setIntensity(inten);
  };

  G.spawn = function (id) {
    const a = U.rand(0, TAU);
    const d = Math.hypot(G.W, G.H) / 2 + U.rand(60, 200);
    return G.spawnAt(id, G.p.x + Math.cos(a) * d, G.p.y + Math.sin(a) * d);
  };

  G.spawnAt = function (id, x, y) {
    const d = DATA.enemies[id];
    const hpMul = d.boss ? 1 : G.hpMulT();
    const e = {
      id, x, y, hp: d.hp * hpMul, maxhp: d.hp * hpMul,
      spd: d.spd * (1 + Math.min(0.4, G.time / 2400)), dmg: d.dmg * DATA.dmgMul(G.time),
      xp: d.xp, r: d.r, spr: d.spr, scale: d.scale, ai: d.ai,
      flash: 0, hitT: 0, mhit: 0, wcd: 0, mtick: 0, slow: 0, slowT: 0, kx: 0, ky: 0,
      state: 'chase', t: U.rand(0, 2), range: d.range || 0, shotCd: d.shotCd || 0,
      elite: !!d.elite, champ: !!d.champ, boss: !!d.boss, phase: 1, atkT: 2, tx: 0, ty: 0, wob: U.rand(0, TAU)
    };
    G.enemies.push(e);
    if (e.boss) G.boss = e;
    return e;
  };

  G.hpMulT = function () {
    let m = DATA.hpMul(G.time);
    if (G.endless) m *= 1 + Math.max(0, (G.time - DATA.winTime) / 60) * 0.5;
    return m;
  };

  G.updateEnemies = function (dt) {
    const p = G.p;
    const arr = G.enemies;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      e.flash = Math.max(0, e.flash - dt);
      e.hitT -= dt; e.mhit -= dt; e.wcd -= dt; e.t -= dt; e.atkT -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      const slowF = (e.slowT > 0 ? 0.45 : 1) * (e.slow > 0 ? e.slow : 1);
      let vx = 0, vy = 0;
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;

      if (e.ai === 'chase' || e.ai === 'champ' || e.ai === 'seraph') {
        if (e.ai === 'seraph') {
          if (e.state === 'dash') {
            vx = e.tx; vy = e.ty;
            if (e.t <= 0) { e.state = 'chase'; e.t = 1; }
          } else {
            vx = nx * e.spd * slowF; vy = ny * e.spd * slowF;
            const hpF = e.hp / e.maxhp;
            e.phase = hpF > 0.66 ? 1 : hpF > 0.33 ? 2 : 3;
            if (e.atkT <= 0) {
              e.atkT = e.phase === 1 ? 3.2 : e.phase === 2 ? 2.6 : 2.0;
              if (e.phase === 3) {
                if (U.chance(0.5)) { e.state = 'dash'; e.t = 0.8; e.tx = nx * 620; e.ty = ny * 620; A.sfx('warn'); }
                else { e.state = 'spiral'; e.t = 2.4; e.wob = 0; }
              } else if (e.phase === 2 && U.chance(0.5)) {
                for (let s = 0; s < 6; s++) {
                  const a = (s / 6) * TAU;
                  G.spawnAt('acolyte', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90);
                }
              } else {
                const n = e.phase === 1 ? 16 : 22;
                for (let s = 0; s < n; s++) {
                  const a = (s / n) * TAU + U.rand(0, 0.4);
                  G.eprojs.push({ x: e.x, y: e.y - 40, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, dmg: e.dmg * 0.7, t: 5 });
                }
                A.sfx('shoot');
              }
            }
            if (e.state === 'spiral') {
              e.wob += dt * 9;
              e.spirT = (e.spirT || 0) + dt;
              if (e.spirT > 0.08) {
                e.spirT = 0;
                G.eprojs.push({ x: e.x, y: e.y - 40, vx: Math.cos(e.wob) * 210, vy: Math.sin(e.wob) * 210, dmg: e.dmg * 0.6, t: 4 });
                G.eprojs.push({ x: e.x, y: e.y - 40, vx: Math.cos(e.wob + Math.PI) * 210, vy: Math.sin(e.wob + Math.PI) * 210, dmg: e.dmg * 0.6, t: 4 });
              }
              if (e.t <= 0) e.state = 'chase';
            }
          }
        } else if (e.ai === 'champ') {
          vx = nx * e.spd * slowF; vy = ny * e.spd * slowF;
          if (e.atkT <= 0) {
            e.atkT = 5.5;
            for (let s = 0; s < 12; s++) {
              const a = (s / 12) * TAU;
              G.eprojs.push({ x: e.x, y: e.y - 40, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, dmg: e.dmg * 0.8, t: 4 });
            }
            A.sfx('shoot');
            G.cam.trauma = Math.min(1, G.cam.trauma + 0.12);
          }
          if (dist > 340 && e.state === 'chase' && e.t <= 0) {
            e.state = 'windup'; e.t = 0.5;
          }
          if (e.state === 'windup') {
            vx = 0; vy = 0;
            if (e.t <= 0) { e.state = 'dash'; e.t = 0.55; e.tx = nx * 700; e.ty = ny * 700; }
          } else if (e.state === 'dash') {
            vx = e.tx; vy = e.ty;
            if (e.t <= 0) { e.state = 'chase'; e.t = 3; }
          }
        } else {
          vx = nx * e.spd * slowF; vy = ny * e.spd * slowF;
        }
      } else if (e.ai === 'ranged') {
        if (dist > e.range * 0.85) { vx = nx * e.spd * slowF; vy = ny * e.spd * slowF; }
        else if (dist < e.range * 0.6) { vx = -nx * e.spd * 0.5; vy = -ny * e.spd * 0.5; }
        else { vx = -ny * e.spd * 0.4; vy = nx * e.spd * 0.4; }
        if (e.atkT <= 0 && dist < e.range * 1.2) {
          e.atkT = e.shotCd;
          G.eprojs.push({ x: e.x, y: e.y - 26, vx: nx * 300, vy: ny * 300, dmg: e.dmg * 0.9, t: 4 });
          A.sfx('shoot');
        }
      } else if (e.ai === 'lunge') {
        if (e.state === 'chase') {
          vx = nx * e.spd * slowF; vy = ny * e.spd * slowF;
          if (dist < 260 && e.t <= 0) { e.state = 'windup'; e.t = 0.4; }
        } else if (e.state === 'windup') {
          if (e.t <= 0) { e.state = 'dash'; e.t = 0.5; e.tx = nx * 330; e.ty = ny * 330; }
        } else if (e.state === 'dash') {
          vx = e.tx; vy = e.ty;
          if (e.t <= 0) { e.state = 'chase'; e.t = 1.6; }
        } else if (e.state === 'recover') {
          vx = nx * e.spd * 0.3; vy = ny * e.spd * 0.3;
          if (e.t <= 0) e.state = 'chase';
        }
      }

      const sep = i % 2 === 0 ? G.separate(e, nx, ny) : null;
      if (sep) { vx += sep[0]; vy += sep[1]; }
      e.x += (vx + e.kx) * dt;
      e.y += (vy + e.ky) * dt;
      e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);

      if (e.slow > 0) e.slow = 0;
      if (dist < e.r + 14 && e.hitT <= 0) {
        e.hitT = 0.8;
        G.hurtPlayer(e.dmg);
        e.kx -= nx * 160; e.ky -= ny * 160;
      }
      if (e.mhit <= 0) {
        for (let mi = 0; mi < G.minions.length; mi++) {
          const m = G.minions[mi];
          if (U.dist2(e.x, e.y, m.x, m.y) < (e.r + 12) * (e.r + 12)) {
            e.mhit = 0.7;
            m.hp -= e.dmg * 0.6;
            m.flash = 0.12;
            if (m.hp <= 0) {
              G.killMinion(mi);
              for (let s = 0; s < 4; s++) G.parts.push({ x: m.x, y: m.y - 10, vx: U.rand(-70, 70), vy: U.rand(-120, -20), t: 0, life: 0.7, spr: 'shard', add: false, al: 1, g: 400 });
            }
            break;
          }
        }
      }
      if (e.hp <= 0) {
        if (!e.dead) G.killEnemy(e);
        U.swapRemove(arr, i);
        continue;
      }
      const pad = 900;
      if (U.dist2(e.x, e.y, p.x, p.y) > pad * pad && !e.boss && !e.champ) {
        U.swapRemove(arr, i);
      }
    }
  };

  G.separate = function (e, nx, ny) {
    const near = G.nearEnemies(e.x, e.y, e.r + 20);
    let px = 0, py = 0, cnt = 0;
    for (let i = 0; i < near.length && cnt < 6; i++) {
      const o = near[i];
      if (o === e) continue;
      const d2 = U.dist2(e.x, e.y, o.x, o.y);
      const min = (e.r + o.r) * 0.72;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = (min - d) / min * 60;
        px += (e.x - o.x) / d * f; py += (e.y - o.y) / d * f;
        cnt++;
      }
    }
    return cnt ? [px, py] : null;
  };

  G.killMinion = function (i) { U.swapRemove(G.minions, i); };

  G.updateMinions = function (dt) {
    const p = G.p, arr = G.minions;
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      m.flash = Math.max(0, (m.flash || 0) - dt);
      m.cd -= dt;
      m.retarget = (m.retarget || 0) - dt;
      const boost = p.abDur > 0 ? 1.6 : 1;
      if (m.retarget <= 0) {
        m.retarget = 0.2;
        let best = null, bd = 460 * 460;
        const near = G.nearEnemies(m.x, m.y, 460);
        for (let j = 0; j < near.length; j++) {
          const d2 = U.dist2(m.x, m.y, near[j].x, near[j].y);
          if (d2 < bd) { bd = d2; best = near[j]; }
        }
        m.target = best;
      }
      const spd = 265 * boost;
      let tx, ty;
      if (m.target && m.target.hp > 0) {
        tx = m.target.x; ty = m.target.y;
        const d = Math.hypot(tx - m.x, ty - m.y);
        if (d < 34 && m.cd <= 0) {
          m.cd = 0.55;
          G.damageEnemy(m.target, p.minionDmg * boost, false, '#e9e6da');
          A.sfx('minionHit');
        }
      } else {
        const idx = m.idx;
        const want = 4 + Math.floor(idx / 7) * 10;
        const a = (idx / Math.max(1, arr.length)) * TAU + G.time * 0.22;
        tx = p.x + Math.cos(a) * want * 1.6;
        ty = p.y + Math.sin(a) * want * 1.6;
      }
      const dx = tx - m.x, dy = ty - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > 8) {
        const mv = Math.min(spd, d * 6);
        m.x += dx / d * mv * dt;
        m.y += dy / d * mv * dt;
        m.walk = (m.walk || 0) + dt * 10;
      }
    }
  };

  G.updateCorpses = function (dt) {
    const p = G.p, arr = G.corpses;
    for (let i = arr.length - 1; i >= 0; i--) {
      const c = arr[i];
      c.t += dt;
      if (c.t > 9) { U.swapRemove(arr, i); continue; }
      if (c.t > 0.45) {
        const d2 = U.dist2(c.x, c.y, p.x, p.y);
        if (d2 < 300 * 300 && G.minions.length < p.minionCap && U.chance(p.raiseC * dt * 1.8)) {
          U.swapRemove(arr, i);
          G.raiseAt(c.x, c.y, false);
          continue;
        }
      }
    }
  };

  G.raiseAt = function (x, y, big) {
    const p = G.p;
    p.raised++;
    G.minions.push({ x, y, hp: 30 + G.time / 30, dmg: p.minionDmg, cd: 0, idx: G.minions.length, flash: 0, bob: U.rand(0, TAU) });
    for (let s = 0; s < (big ? 10 : 5); s++) {
      G.parts.push({ x: x + U.rand(-8, 8), y: y + U.rand(-4, 4), vx: U.rand(-60, 60), vy: U.rand(-170, -60), t: 0, life: U.rand(0.4, 0.8), spr: 'dirt', add: false, al: 1, g: 500 });
    }
    G.parts.push({ x, y: y - 26, vx: 0, vy: -50, t: 0, life: 0.8, spr: 'wisp', add: true, al: 0.9 });
    G.parts.push({ x, y, vx: 0, vy: 0, t: 0, life: 0.5, spr: 'rune', add: true, al: 0.8 });
    if (G.raiseT <= 0) { G.raiseT = 0.12; A.sfx('raise'); }
    if (G.weap('storm')) {
      G.fireZapAt(x, y, G.weapLv('storm'));
    }
  };

  G.weap = function (id) { return G.p.weapons.find(w => w.id === id); };
  G.weapLv = function (id) {
    const w = G.weap(id);
    if (!w) return 0;
    return w.lv;
  };

  G.updateSouls = function (dt) {
    const p = G.p, arr = G.souls;
    for (let i = arr.length - 1; i >= 0; i--) {
      const s = arr[i];
      s.t += dt;
      const dx = p.x - s.x, dy = (p.y - 6) - s.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < p.pickR || s.pull) {
        s.pull = true;
        const sp = 400 + s.t * 900;
        s.x += dx / d * sp * dt;
        s.y += dy / d * sp * dt;
      } else {
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.vx *= Math.pow(0.01, dt); s.vy *= Math.pow(0.01, dt);
      }
      if (d < 20) {
        U.swapRemove(arr, i);
        if (s.kind === 0) {
          G.gainXp(s.v);
          p.combo++; p.comboT = 2.2;
          A.sfx('pickup', p.combo);
          G.checkStreak(p.combo);
        } else if (s.kind === 1) {
          p.essence += s.v;
          A.sfx('essence');
        } else {
          p.hp = Math.min(p.maxhp, p.hp + 30);
          A.sfx('heal');
          G.dnums.push({ x: p.x, y: p.y - 50, t: 0, txt: '+30', col: '#ff8a9a', scale: 1 });
        }
      }
    }
  };

  G.checkStreak = function (c) {
    for (let i = 0; i < DATA.streaks.length; i++) {
      if (c === DATA.streaks[i].n) {
        UI.announce(DATA.streaks[i].name, c);
        A.sfx('streak', i);
        break;
      }
    }
  };

  G.gainXp = function (v) {
    const p = G.p;
    p.xp += v * p.xpMul;
    while (p.xp >= p.need) {
      p.xp -= p.need;
      p.level++;
      p.need = DATA.xpNeed(p.level);
      G.recompute();
      G.lvQueue++;
    }
    if (G.lvQueue > 0 && !G.frozen) G.openLevelUp();
  };

  G.openLevelUp = function () {
    A.sfx('levelup');
    A.duck(true);
    G.frozen = true;
    UI.showLevelUp(G.makeChoices(), G.rerolls);
  };

  G.choiceDone = function (choice, rerollUsed) {
    if (rerollUsed) {
      if (G.frozen && G.rerolls > 0) {
        G.rerolls--;
        UI.showLevelUp(G.makeChoices(), G.rerolls);
      }
      return;
    }
    if (choice) {
      if (choice.kind === 'weapon') {
        const w = G.weap(choice.id);
        if (w) w.lv++;
        else G.p.weapons.push({ id: choice.id, lv: 1, t: 0, angle: 0 });
      } else if (choice.kind === 'evolve') {
        for (const w of G.p.weapons) {
          const d = DATA.weapons[w.id];
          if (d.evolve && d.evolve.into === choice.id) {
            w.id = choice.id; w.lv = 1; w.t = 0;
            break;
          }
        }
        A.sfx('evolve');
        G.cam.trauma = Math.min(1, G.cam.trauma + 0.4);
        G.parts.push({ x: G.p.x, y: G.p.y, vx: 0, vy: 0, t: 0, life: 0.6, spr: 'shock', add: true, al: 0.9, scale: 2.5 });
        UI.announce(choice.name, 'EVOLUTION');
      } else if (choice.kind === 'passive') {
        G.p.pas[choice.id] = (G.p.pas[choice.id] || 0) + 1;
        G.recompute();
      } else if (choice.kind === 'heal') {
        G.p.hp = Math.min(G.p.maxhp, G.p.hp + 40);
        A.sfx('heal');
      } else if (choice.kind === 'ess') {
        G.p.essence += 25;
        A.sfx('essence');
      }
      G.lvQueue--;
    } else {
      G.lvQueue--;
    }
    if (G.lvQueue < 0) G.lvQueue = 0;
    G.frozen = false;
    A.duck(false);
    if (G.lvQueue > 0) G.openLevelUp();
  };

  G.makeChoices = function () {
    const p = G.p;
    const opts = [];
    const wf = [];
    for (const id in DATA.weapons) {
      const d = DATA.weapons[id];
      if (d.evolved) continue;
      const w = G.weap(id);
      if (w && w.lv >= d.max) {
        if (d.evolve && (p.pas[d.evolve.req] || 0) >= 4) {
          const ev = DATA.weapons[d.evolve.into];
          opts.push({ kind: 'evolve', id: d.evolve.into, name: ev.name, desc: ev.desc, flavor: ev.flavor, icon: ev.icon, col: '#ffd97a' });
          wf.push(100);
        }
        continue;
      }
      if (!w && p.weapons.length >= 6) continue;
      const st = d.lv[(w ? w.lv : 0)];
      opts.push({
        kind: 'weapon', id, name: d.name, desc: d.desc, flavor: d.flavor, icon: d.icon, col: d.col,
        isNew: !w, lv: w ? w.lv + 1 : 1, max: d.max, next: st
      });
      wf.push(w ? 5 : 3);
    }
    for (const id in DATA.passives) {
      const d = DATA.passives[id];
      const cur = p.pas[id] || 0;
      if (cur === 0 && Object.keys(p.pas).length >= 6) continue;
      if (cur >= d.max) continue;
      opts.push({
        kind: 'passive', id, name: d.name, desc: d.desc, flavor: d.flavor, icon: d.icon, col: d.col,
        lv: cur + 1, max: d.max
      });
      wf.push(cur ? 4 : 2.5);
    }
    const picks = [];
    const pool = opts.map((o, i) => i);
    while (picks.length < 3 && pool.length) {
      let tot = 0;
      for (const i of pool) tot += wf[i];
      let r = Math.random() * tot;
      let chosen = pool[0];
      for (const i of pool) { r -= wf[i]; if (r <= 0) { chosen = i; break; } }
      picks.push(opts[chosen]);
      pool.splice(pool.indexOf(chosen), 1);
    }
    while (picks.length < 3) {
      if (picks.length % 2 === 0) picks.push({ kind: 'heal', name: 'Soul Feast', desc: 'Devour 40 health instantly.', flavor: 'Waste not.', icon: 'iconHeart', col: '#ff8a9a' });
      else picks.push({ kind: 'ess', name: 'Gilded Remnant', desc: 'Pocket 25 essence for the Dark Altar.', flavor: 'Shiny.', icon: 'iconEss', col: '#ffd97a' });
    }
    return picks;
  };

  G.updateWeapons = function (dt) {
    const p = G.p;
    for (let wi = 0; wi < p.weapons.length; wi++) {
      const w = p.weapons[wi];
      const d = DATA.weapons[w.id];
      if (!d) continue;
      const st = d.lv[w.lv - 1];
      if (!st) continue;
      w.t -= dt;
      if (w.id === 'wraith' || w.id === 'choir') {
        const total = st.n;
        while (G.orbit.length < total) G.orbit.push({ a: U.rand(0, TAU) });
        if (G.orbit.length > total) G.orbit.length = total;
        for (let oi = 0; oi < G.orbit.length; oi++) {
          const o = G.orbit[oi];
          o.a += st.spd * dt * (w.id === 'choir' ? 1 : 1);
          const rad = st.rad + (w.id === 'choir' ? Math.sin(G.time * 2 + oi) * 22 : 0);
          o.x = p.x + Math.cos(o.a + oi * TAU / G.orbit.length) * rad;
          o.y = p.y + Math.sin(o.a + oi * TAU / G.orbit.length) * rad - 10;
          const near = G.nearEnemies(o.x, o.y, 34);
          for (let ni = 0; ni < near.length; ni++) {
            const e = near[ni];
            if (e.wcd <= 0 && U.dist2(o.x, o.y, e.x, e.y) < 30 * 30) {
              e.wcd = 0.4;
              G.damageEnemy(e, st.dmg * p.dmgMul, true, '#b9ffd6');
            }
          }
        }
        continue;
      }
      if (w.id === 'miasma' || w.id === 'pestilence') {
        const cx = p.x + (w.id === 'pestilence' ? Math.cos(G.time * 0.7) * 90 : 0);
        const cy = p.y + (w.id === 'pestilence' ? Math.sin(G.time * 0.7) * 90 : 0);
        const slowV = 1 - st.slow;
        const near = G.nearEnemies(cx, cy, st.rad);
        for (let ni = 0; ni < near.length; ni++) {
          const e = near[ni];
          if (U.dist2(cx, cy, e.x, e.y) < st.rad * st.rad) {
            e.slow = slowV; e.slowT = 0.3;
            e.mtick -= dt;
            if (e.mtick <= 0) {
              e.mtick = 0.3;
              G.damageEnemy(e, st.dps * 0.3 * p.dmgMul * (p.miasmaMul || 1), false, '#8fd14f', true);
            }
          }
        }
        if (U.chance(dt * 3)) {
          G.parts.push({ x: cx + U.rand(-st.rad, st.rad) * 0.7, y: cy + U.rand(-st.rad, st.rad) * 0.5, vx: 0, vy: -12, t: 0, life: 1.4, spr: 'puff', add: true, al: 0.5 });
        }
        continue;
      }
      if (w.t > 0) continue;
      const cd = st.cd * p.cdMul;
      w.t = cd;
      if (w.id === 'spear' || w.id === 'gungnir') {
        const baseA = Math.atan2(G.mv.y, G.mv.x);
        for (let s = 0; s < st.n; s++) {
          const a = baseA + (s - (st.n - 1) / 2) * 0.14;
          G.projs.push({ kind: 'spear', x: p.x, y: p.y - 16, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: st.dmg * p.dmgMul, pierce: st.pierce, t: 1.6, rot: a, hits: [] });
        }
        if (st.radial) {
          for (let s = 0; s < st.radial; s++) {
            const a = (s / st.radial) * TAU + G.time;
            G.projs.push({ kind: 'spear', x: p.x, y: p.y - 16, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, dmg: st.dmg * 0.7 * p.dmgMul, pierce: st.pierce, t: 1.6, rot: a, hits: [] });
          }
        }
        A.sfx('shoot');
      } else if (w.id === 'scythe' || w.id === 'harvest') {
        const near = G.nearEnemies(p.x, p.y, st.rad + 40);
        const baseA = Math.atan2(G.mv.y, G.mv.x);
        let hits = 0;
        for (let ni = 0; ni < near.length; ni++) {
          const e = near[ni];
          const d2 = U.dist2(p.x, p.y, e.x, e.y);
          if (d2 < st.rad * st.rad) {
            let inArc = true;
            if (w.id === 'scythe') {
              const ea = Math.atan2(e.y - p.y, e.x - p.x);
              let da = Math.abs(ea - baseA);
              if (da > Math.PI) da = TAU - da;
              inArc = da < 1.5;
            }
            if (inArc) {
              G.damageEnemy(e, st.dmg * p.dmgMul, true, '#d8d2c0');
              const d = Math.sqrt(d2) || 1;
              e.kx += (e.x - p.x) / d * st.kb; e.ky += (e.y - p.y) / d * st.kb;
              hits++;
            }
          }
        }
        G.swings.push({ x: p.x, y: p.y, t: 0, dur: 0.22, rad: st.rad, a: w.id === 'harvest' ? null : baseA });
        if (st.crescents) {
          for (let s = 0; s < st.crescents; s++) {
            const a = (s / st.crescents) * TAU + G.time;
            G.projs.push({ kind: 'crescent', x: p.x, y: p.y - 10, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, dmg: st.dmg * 0.5 * p.dmgMul, pierce: 4, t: 1.1, rot: a, hits: [] });
          }
        }
        A.sfx('scythe');
      } else if (w.id === 'bolt' || w.id === 'meteor') {
        const near = G.nearEnemies(p.x, p.y, 700);
        if (near.length === 0) { w.t = 0.3; continue; }
        for (let s = 0; s < st.n; s++) {
          const tgt = near[(Math.random() * near.length) | 0];
          const a = U.rand(0, TAU);
          G.projs.push({
            kind: 'bolt', x: p.x + Math.cos(a) * 30, y: p.y - 16 + Math.sin(a) * 30,
            tx: tgt, dmg: st.dmg * p.dmgMul, spd: 430, t: 3, boom: st.boom || 0, hits: []
          });
        }
        A.sfx('shoot');
      } else if (w.id === 'zap' || w.id === 'storm') {
        G.fireZap(p.x, p.y, w.id);
      }
    }
  };

  G.fireZap = function (x, y, wid) {
    const w = G.weap(wid);
    const st = DATA.weapons[wid].lv[w.lv - 1];
    const near = G.nearEnemies(x, y, 620);
    if (!near.length) { w.t = 0.3; return; }
    let tgt = near[(Math.random() * near.length) | 0];
    G.chainZap(tgt, st);
    A.sfx('zap');
  };

  G.fireZapAt = function (x, y, wid) {
    const w = G.weap(wid);
    if (!w) return;
    const st = DATA.weapons[wid].lv[w.lv - 1];
    const near = G.nearEnemies(x, y, 420);
    if (!near.length) return;
    const tgt = near[(Math.random() * near.length) | 0];
    G.chainZap(tgt, st);
    A.sfx('zap');
  };

  G.chainZap = function (first, st) {
    const p = G.p;
    const hitSet = [first];
    const pts = [[p.x, p.y - 20], [first.x, first.y - 14]];
    G.damageEnemy(first, st.dmg * p.dmgMul, true, '#d8b4ff');
    let cur = first;
    for (let c = 1; c < st.chains + (G.p.zapChains || 0); c++) {
      const near = G.nearEnemies(cur.x, cur.y, 200);
      let next = null, bd = 200 * 200;
      for (let ni = 0; ni < near.length; ni++) {
        const e = near[ni];
        if (hitSet.includes(e)) continue;
        const d2 = U.dist2(cur.x, cur.y, e.x, e.y);
        if (d2 < bd) { bd = d2; next = e; }
      }
      if (!next) break;
      hitSet.push(next);
      pts.push([next.x, next.y - 14]);
      G.damageEnemy(next, st.dmg * p.dmgMul, true, '#d8b4ff');
      cur = next;
    }
    G.zaps.push({ pts, t: 0 });
  };

  G.updateProjs = function (dt) {
    const arr = G.projs;
    for (let i = arr.length - 1; i >= 0; i--) {
      const pr = arr[i];
      pr.t -= dt;
      if (pr.kind === 'bolt') {
        if (!pr.tx || pr.tx.hp <= 0) {
          const near = G.nearEnemies(pr.x, pr.y, 500);
          pr.tx = near.length ? near[(Math.random() * near.length) | 0] : null;
        }
        if (pr.tx) {
          const a = U.ang(pr.x, pr.y, pr.tx.x, pr.tx.y - 10);
          const cur = Math.atan2(pr.vy, pr.vx);
          let da = a - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const turn = U.clamp(da, -7 * dt, 7 * dt);
          const na = cur + turn;
          pr.vx = Math.cos(na) * pr.spd; pr.vy = Math.sin(na) * pr.spd;
        }
      }
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (pr.kind === 'spear' || pr.kind === 'crescent') {
        if (U.chance(dt * 12)) G.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0, life: 0.3, spr: 'wisp', add: true, al: 0.3 });
      }
      const near = G.nearEnemies(pr.x, pr.y, 40);
      for (let ni = 0; ni < near.length; ni++) {
        const e = near[ni];
        if (!e || pr.hits.includes(e)) continue;
        if (U.dist2(pr.x, pr.y, e.x, e.y) < (e.r + 8) * (e.r + 8)) {
          pr.hits.push(e);
          const crit = U.chance(G.p.critC);
          G.damageEnemy(e, pr.dmg * (crit ? 2 : 1), crit, '#d8d2c0');
          if (pr.boom) {
            A.sfx('boom');
            const bn = G.nearEnemies(pr.x, pr.y, pr.boom);
            for (let bi = 0; bi < bn.length; bi++) {
              const be = bn[bi];
              if (be === e) continue;
              if (U.dist2(pr.x, pr.y, be.x, be.y) < pr.boom * pr.boom) G.damageEnemy(be, pr.dmg * 0.6 * G.p.dmgMul, false, '#8dffb0');
            }
            for (let s = 0; s < 6; s++) G.parts.push({ x: pr.x, y: pr.y, vx: U.rand(-180, 180), vy: U.rand(-180, 180), t: 0, life: 0.5, spr: 'wisp', add: true, al: 0.8 });
            G.parts.push({ x: pr.x, y: pr.y, vx: 0, vy: 0, t: 0, life: 0.3, spr: 'shock', add: true, al: 0.7, scale: pr.boom / 110 });
          }
          pr.pierce--;
          if (pr.pierce <= 0) { U.swapRemove(arr, i); break; }
        }
      }
      if (arr[i] === pr && pr.t <= 0) U.swapRemove(arr, i);
    }
  };

  G.updateEProjs = function (dt) {
    const arr = G.eprojs, p = G.p;
    for (let i = arr.length - 1; i >= 0; i--) {
      const b = arr[i];
      b.t -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.t <= 0) { U.swapRemove(arr, i); continue; }
      if (U.dist2(b.x, b.y, p.x, p.y - 10) < 20 * 20) {
        G.hurtPlayer(b.dmg);
        U.swapRemove(arr, i);
      }
    }
  };

  G.updateChests = function (dt) {
    const p = G.p, arr = G.chests;
    for (let i = arr.length - 1; i >= 0; i--) {
      const c = arr[i];
      c.t += dt;
      if (U.dist2(c.x, c.y, p.x, p.y) < 40 * 40) {
        U.swapRemove(arr, i);
        G.frozen = true;
        A.sfx('chest');
        A.duck(true);
        UI.showChest(G.genChest());
      }
    }
  };

  G.genChest = function () {
    const p = G.p;
    const luck = (G.save.meta.luck || 0) + (p.luck || 0);
    const up = [];
    for (const w of p.weapons) {
      const d = DATA.weapons[w.id];
      if (w.lv < d.max) up.push(w);
    }
    if (up.length && U.chance(0.55 + luck * 0.03)) {
      const w = U.pick(up);
      w.lv++;
      const d = DATA.weapons[w.id];
      return { kind: 'weapon', name: d.name + ' RISES', text: d.name + ' reaches level ' + w.lv + '.', icon: d.icon, col: d.col };
    }
    if (U.chance(0.5)) {
      p.hp = Math.min(p.maxhp, p.hp + 50);
      return { kind: 'heal', name: 'EMBER OF LIFE', text: 'The relics knit your wounds. +50 health.', icon: 'iconHeart', col: '#ff8a9a' };
    }
    p.essence += 30;
    return { kind: 'ess', name: 'GOLDEN TITHE', text: 'The Order tithes in your favor. +30 essence.', icon: 'iconEss', col: '#ffd97a' };
  };

  G.chestDone = function () {
    G.frozen = false;
    A.duck(false);
    if (G.lvQueue > 0) G.openLevelUp();
  };

  G.tryAbility = function () {
    const p = G.p;
    if (p.abT > 0) return;
    p.abT = 30;
    p.abDur = 4;
    A.sfx('ability');
    G.cam.trauma = Math.min(1, G.cam.trauma + 0.4);
    G.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0, life: 0.6, spr: 'rune', add: true, al: 1, scale: 3 });
    G.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0, life: 0.5, spr: 'shock', add: true, al: 0.8, scale: 2.4 });
    const wasCap = p.minionCap;
    p.minionCap += 20;
    let raised = 0;
    for (let i = G.corpses.length - 1; i >= 0; i--) {
      const c = G.corpses[i];
      if (U.dist2(c.x, c.y, p.x, p.y) < 700 * 700 && G.minions.length < p.minionCap) {
        U.swapRemove(G.corpses, i);
        G.raiseAt(c.x, c.y, true);
        raised++;
      }
    }
    p.minionCap = wasCap;
    for (const e of G.enemies) e.slowT = 4;
    UI.announce('DANSE MACABRE', raised + ' risen', true);
  };

  G.damageEnemy = function (e, dmg, allowCrit, col, quiet) {
    if (e.dead || e.hp <= 0) return;
    let crit = false;
    if (allowCrit && U.chance(G.p.critC)) { dmg *= 2; crit = true; }
    e.hp -= dmg;
    e.flash = 0.1;
    if (!quiet && G.dnums.length < 90) {
      G.dnums.push({
        x: e.x + U.rand(-8, 8), y: e.y - 24 - e.r, t: 0,
        txt: Math.round(dmg) + (crit ? '!' : ''), col: crit ? '#ffd97a' : (col || '#fff'),
        scale: crit ? 1.4 : (e.elite || e.champ || e.boss ? 1.1 : 0.9)
      });
    }
    if (e.hp <= 0) G.killEnemy(e);
  };

  G.killEnemy = function (e) {
    if (e.dead) return;
    e.dead = true;
    const p = G.p;
    p.kills++;
    if (p.comboT <= 0) p.combo = 0;
    p.comboT = 2.2;
    const q = G.q === 2 ? 1 : G.q === 1 ? 0.6 : 0.3;
    const nParts = Math.min(8, Math.round((e.champ || e.boss ? 24 : e.elite ? 12 : 4) * q));
    for (let s = 0; s < nParts; s++) {
      G.parts.push({
        x: e.x, y: e.y - 14, vx: U.rand(-140, 140), vy: U.rand(-200, -40),
        t: 0, life: U.rand(0.4, 0.9), spr: e.champ || e.boss || e.elite ? 'gspark' : 'shard', add: false, al: 1, g: 500
      });
    }
    if (G.decals.length < 70 && !e.boss) {
      G.decals.push({ x: e.x, y: e.y + 4, spr: U.irand(0, 2), t: 0, rot: U.rand(0, TAU) });
    }
    const xpV = e.xp;
    if (G.souls.length > 240) {
      if (G.souls.length) G.souls[(Math.random() * G.souls.length) | 0].v += xpV;
    } else if (xpV >= 4) G.souls.push({ x: e.x, y: e.y, vx: U.rand(-40, 40), vy: U.rand(-40, 40), v: xpV, kind: 0, t: 0, big: true });
    else if (U.chance(0.82)) G.souls.push({ x: e.x, y: e.y, vx: U.rand(-60, 60), vy: U.rand(-60, 60), v: xpV, kind: 0, t: 0, big: false });
    if (e.elite) {
      p.elites++;
      G.souls.push({ x: e.x + 12, y: e.y, vx: U.rand(-30, 30), vy: -40, v: 6, kind: 1, t: 0 });
      G.chests.push({ x: e.x, y: e.y, t: 0 });
      G.hitstop = 0.05;
      G.cam.trauma = Math.min(1, G.cam.trauma + 0.25);
    }
    if (e.champ) {
      p.champs++;
      G.chests.push({ x: e.x + 20, y: e.y, t: 0 });
      G.souls.push({ x: e.x - 14, y: e.y, vx: 0, vy: -30, v: 15, kind: 1, t: 0 });
      G.souls.push({ x: e.x + 14, y: e.y, vx: 0, vy: -30, v: 2, kind: 2, t: 0 });
      for (let c = 0; c < 4; c++) G.corpses.push({ x: e.x + U.rand(-50, 50), y: e.y + U.rand(-30, 30), t: 0 });
      G.hitstop = 0.12;
      G.cam.trauma = 1;
      A.sfx('champdie');
    }
    if (e.boss) {
      G.hitstop = 0.3;
      G.cam.trauma = 1;
      A.sfx('champdie');
      A.stopMusic();
      G.souls.push({ x: e.x, y: e.y, vx: 0, vy: -20, v: 100, kind: 1, t: 0 });
      for (let c = 0; c < 8; c++) G.corpses.push({ x: e.x + U.rand(-90, 90), y: e.y + U.rand(-60, 60), t: 0 });
      p.win = true;
      G.slowmo = 1.4;
    }
    if (G.sfxKillT <= 0 && !e.champ && !e.boss) { G.sfxKillT = 0.05; A.sfx('kill'); }
    if (!e.boss && G.corpses.length < 130 && U.chance(e.champ ? 1 : 0.85)) {
      G.corpses.push({ x: e.x, y: e.y, t: 0 });
    }
    if (e.boss) {
      G.boss = null;
      p.dead = true;
      p.win = true;
    }
  };

  G.hurtPlayer = function (dmg) {
    const p = G.p;
    if (p.hitCd > 0 || p.dead) return;
    p.hitCd = 0.45;
    p.hp -= dmg * p.armor;
    p.hurtT = 0.25;
    G.cam.trauma = Math.min(1, G.cam.trauma + 0.22);
    A.sfx('hurt');
    if (p.hp <= 0) {
      if (p.reviveLeft > 0) {
        p.reviveLeft--;
        p.hp = p.maxhp * 0.6;
        p.hitCd = 2;
        A.sfx('revive');
        UI.announce('SECOND DEATH', 'the grave is not done with you');
        G.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, t: 0, life: 0.7, spr: 'shock', add: true, al: 1, scale: 3 });
        for (const e of G.enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
          e.kx += (e.x - p.x) / d * 900; e.ky += (e.y - p.y) / d * 900;
        }
      } else {
        p.hp = 0;
        p.dead = true;
        G.overT = 0;
        G.slowmo = 1;
        G.parts.push({ x: p.x, y: p.y - 20, vx: 0, vy: -40, t: 0, life: 2.4, spr: 'ghost', add: true, al: 0.8 });
        A.stopMusic();
        A.sfx('deathbell');
      }
    }
  };

  G.updateParts = function (dt) {
    const arr = G.parts;
    for (let i = arr.length - 1; i >= 0; i--) {
      const s = arr[i];
      s.t += dt;
      if (s.t >= s.life) { U.swapRemove(arr, i); continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.g) s.vy += s.g * dt;
    }
    const dn = G.dnums;
    for (let i = dn.length - 1; i >= 0; i--) {
      const d = dn[i];
      d.t += dt;
      d.y -= 40 * dt;
      if (d.t > 0.8) U.swapRemove(dn, i);
    }
    for (let i = G.zaps.length - 1; i >= 0; i--) {
      const z = G.zaps[i];
      z.t += dt;
      if (z.t > 0.18) U.swapRemove(G.zaps, i);
    }
    for (let i = G.swings.length - 1; i >= 0; i--) {
      const s = G.swings[i];
      s.t += dt;
      if (s.t > s.dur) U.swapRemove(G.swings, i);
    }
    for (let i = G.decals.length - 1; i >= 0; i--) {
      const d = G.decals[i];
      d.t += dt;
      if (d.t > 25) U.swapRemove(G.decals, i);
    }
  };

  G.syncHUD = function () {
    const p = G.p, c = G.hudC;
    const xpF = p.xp / p.need;
    c.xpfill.style.width = (xpF * 100).toFixed(1) + '%';
    const lvlTxt = 'LV ' + p.level;
    if (c.lvltxt.textContent !== lvlTxt) c.lvltxt.textContent = lvlTxt;
    const t = U.fmtTime(G.time);
    if (c.timer.textContent !== t) c.timer.textContent = t;
    const k = p.kills + ' slain';
    if (c.killtxt.textContent !== k) c.killtxt.textContent = k;
    const es = p.essence + ' essence';
    if (c.esstxt.textContent !== es) c.esstxt.textContent = es;
    const ms = G.minions.length + ' / ' + p.minionCap;
    if (c.mintxt.textContent !== ms) c.mintxt.textContent = ms;
    const hpF = Math.max(0, p.hp / p.maxhp);
    c.hpfill.style.width = (hpF * 100).toFixed(1) + '%';
    const ht = Math.ceil(p.hp) + ' / ' + Math.round(p.maxhp);
    if (c.hptxt.textContent !== ht) c.hptxt.textContent = ht;
    c.hpfill.classList.toggle('low', hpF < 0.3);
    const ab = p.abT <= 0;
    c.abwrap.classList.toggle('ready', ab);
    if (ab) c.abfill.style.background = '';
    else {
      const deg = (1 - p.abT / 30) * 360;
      c.abfill.style.background = 'conic-gradient(rgba(0,0,0,0.72) ' + deg + 'deg, rgba(0,0,0,0) ' + deg + 'deg)';
    }
    if (G.boss) {
      c.bosswrap.classList.remove('hidden');
      c.bossfill.style.width = (G.boss.hp / G.boss.maxhp * 100).toFixed(1) + '%';
      const bn = 'THE SERAPH OF DAWN';
      if (c.bossname.textContent !== bn) c.bossname.textContent = bn;
    } else if (G.champActive()) {
      c.bosswrap.classList.remove('hidden');
      const ch = G.champActive();
      c.bossfill.style.width = (ch.hp / ch.maxhp * 100).toFixed(1) + '%';
      const bn = 'CHAMPION OF DAWN';
      if (c.bossname.textContent !== bn) c.bossname.textContent = bn;
    } else c.bosswrap.classList.add('hidden');
  };

  G.champActive = function () {
    for (const e of G.enemies) if (e.champ) return e;
    return null;
  };

  G.titleUpdate = function (dt) {
    G.ambT += dt;
    if (U.chance(dt * 2)) {
      G.parts.push({
        x: U.rand(-G.W / 2, G.W / 2), y: G.H / 2 + 40,
        vx: U.rand(-12, 12), vy: U.rand(-40, -14), t: 0, life: U.rand(4, 8), spr: 'wisp', add: true, al: 0.5
      });
    }
    G.updateParts(dt);
  };

  G.render = function () {
    const x = G.x;
    x.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    if (G.state === 'title' || G.state === 'boot') { G.renderTitle(); return; }
    const camX = G.cam.x + G.cam.sx, camY = G.cam.y + G.cam.sy;
    x.fillStyle = '#0b0d12';
    x.fillRect(0, 0, G.W, G.H);
    x.save();
    x.translate(-camX + G.W / 2, -camY + G.H / 2);
    G.renderGround(x, camX, camY);
    G.renderProps(x, camX, camY);
    for (const d of G.decals) {
      x.globalAlpha = Math.max(0, 1 - d.t / 25) * 0.8;
      const spr = SPR.blood[d.spr];
      x.save(); x.translate(d.x, d.y); x.rotate(d.rot);
      x.drawImage(spr, -spr.width / 2, -spr.height / 2);
      x.restore();
    }
    x.globalAlpha = 1;
    for (const c of G.corpses) x.drawImage(SPR.corpse, c.x - 30, c.y - 22);
    for (const ch of G.chests) {
      const bob = Math.sin(ch.t * 3) * 3;
      x.drawImage(SPR.shadow, ch.x - 30, ch.y - 8, 60, 24);
      x.drawImage(SPR.chest, ch.x - 30, ch.y - 44 + bob);
    }
    G.renderShadows(x);
    const list = [];
    for (const e of G.enemies) if (!e.dead) list.push(e);
    for (const m of G.minions) list.push(m);
    const p = G.p;
    const pEnt = { x: p.x, y: p.y, isP: true };
    list.push(pEnt);
    list.sort((a, b) => a.y - b.y);
    for (const ent of list) {
      if (ent.isP) G.renderPlayer(x);
      else if (ent.id) G.renderEnemy(x, ent);
      else G.renderMinion(x, ent);
    }
    for (const pr of G.projs) {
      if (pr.kind === 'spear') {
        x.save();
        x.translate(pr.x, pr.y);
        x.rotate(pr.rot);
        x.drawImage(SPR.projSpear, -42, -9);
        x.restore();
      } else if (pr.kind === 'crescent') {
        x.save();
        x.translate(pr.x, pr.y);
        x.rotate(pr.rot);
        x.drawImage(SPR.shockwave, -33, -33, 66, 66);
        x.restore();
      } else {
        x.drawImage(SPR.projBolt, pr.x - 17, pr.y - 17);
      }
    }
    for (const b of G.eprojs) x.drawImage(SPR.projHoly, b.x - 15, b.y - 15);
    for (const w of G.orbit) {
      if (w.x === undefined) continue;
      const f = Math.floor(G.time * 8) % 2;
      x.drawImage(SPR.wraith[f], w.x - 28, w.y - 40);
    }
    for (const s of G.swings) {
      const pr = s.t / s.dur;
      x.save();
      x.translate(s.x, s.y);
      x.globalAlpha = (1 - pr) * 0.85;
      x.strokeStyle = '#c8fff0';
      x.lineWidth = 14 * (1 - pr * 0.5);
      x.beginPath();
      if (s.a === null) x.arc(0, 0, s.rad * (0.75 + pr * 0.5), 0, TAU);
      else x.arc(0, 0, s.rad * (0.8 + pr * 0.4), s.a - 1.5, s.a + 1.5);
      x.stroke();
      x.restore();
    }
    x.globalAlpha = 1;
    for (const z of G.zaps) {
      x.save();
      x.globalAlpha = 1 - z.t / 0.18;
      x.strokeStyle = '#e8d8ff';
      x.lineWidth = 3;
      x.shadowColor = '#b47aff';
      x.shadowBlur = 12;
      x.beginPath();
      x.moveTo(z.pts[0][0], z.pts[0][1]);
      for (let i = 1; i < z.pts.length; i++) {
        const mid = [(z.pts[i - 1][0] + z.pts[i][0]) / 2 + U.rand(-10, 10), (z.pts[i - 1][1] + z.pts[i][1]) / 2 + U.rand(-10, 10)];
        x.quadraticCurveTo(mid[0], mid[1], z.pts[i][0], z.pts[i][1]);
      }
      x.stroke();
      x.lineWidth = 1.2;
      x.strokeStyle = '#fff';
      x.stroke();
      x.restore();
    }
    for (const w of G.p.weapons) {
      if (w.id === 'miasma' || w.id === 'pestilence') {
        const st = DATA.weapons[w.id].lv[w.lv - 1];
        const cx = p.x + (w.id === 'pestilence' ? Math.cos(G.time * 0.7) * 90 : 0);
        const cy = p.y + (w.id === 'pestilence' ? Math.sin(G.time * 0.7) * 90 : 0);
        const gr = x.createRadialGradient(cx, cy, st.rad * 0.2, cx, cy, st.rad);
        gr.addColorStop(0, 'rgba(127,196,95,0.22)');
        gr.addColorStop(0.8, 'rgba(90,150,60,0.12)');
        gr.addColorStop(1, 'rgba(90,150,60,0)');
        x.fillStyle = gr;
        x.beginPath(); x.arc(cx, cy, st.rad, 0, TAU); x.fill();
        x.strokeStyle = 'rgba(140,220,110,0.2)';
        x.lineWidth = 2;
        x.beginPath(); x.arc(cx, cy, st.rad, 0, TAU); x.stroke();
      }
    }
    if (p.abDur > 0) {
      x.globalAlpha = 0.06 + Math.sin(G.time * 8) * 0.02;
      x.fillStyle = '#7dff9a';
      x.fillRect(camX - G.W / 2, camY - G.H / 2, G.W, G.H);
      x.globalAlpha = 0.3;
      x.drawImage(SPR.ringRune, p.x - 90, p.y - 90, 180, 180);
      x.globalAlpha = 1;
    }
    x.globalCompositeOperation = 'lighter';
    for (const s of G.parts) {
      const lifeF = 1 - s.t / s.life;
      let spr;
      if (s.spr === 'rune') spr = SPR.ringRune;
      else if (s.spr === 'shock') spr = SPR.shockwave;
      else if (s.spr === 'ghost') spr = SPR.ghostSpr;
      else if (s.spr === 'wisp') spr = SPR.wisp;
      else if (s.spr === 'puff') spr = SPR.puff;
      else if (s.spr === 'shard') spr = SPR.shard;
      else if (s.spr === 'gspark') spr = SPR.gspark;
      else spr = SPR.dirt;
      if (!s.add) { x.globalCompositeOperation = 'source-over'; }
      x.globalAlpha = (s.al !== undefined ? s.al : 1) * lifeF;
      const sc = (s.scale || 1);
      const w = spr.width * sc, h = spr.height * sc;
      x.drawImage(spr, s.x - w / 2, s.y - h / 2, w, h);
      if (!s.add) x.globalCompositeOperation = 'lighter';
    }
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    for (const s of G.souls) {
      const bob = Math.sin(G.time * 5 + s.x) * 2;
      if (s.kind === 1) x.drawImage(SPR.ess, s.x - 13, s.y - 13 + bob);
      else if (s.kind === 2) x.drawImage(SPR.heart, s.x - 13, s.y - 13 + bob);
      else if (s.big || s.v >= 4) x.drawImage(SPR.soulB, s.x - 17, s.y - 17 + bob);
      else x.drawImage(SPR.soulS, s.x - 10, s.y - 10 + bob);
    }
    for (const d of G.dnums) {
      const lifeF = 1 - d.t / 0.8;
      x.globalAlpha = lifeF;
      x.font = 'bold ' + Math.round(13 * d.scale) + 'px Georgia, serif';
      x.textAlign = 'center';
      x.fillStyle = '#000';
      x.fillText(d.txt, d.x + 1, d.y + 1);
      x.fillStyle = d.col;
      x.fillText(d.txt, d.x, d.y);
    }
    x.globalAlpha = 1;
    x.restore();
    G.renderFog(x, camX, camY);
    x.save();
    x.globalAlpha = 0.16;
    x.drawImage(SPR.moon, 26, 12, 190, 190);
    x.globalAlpha = 0.55;
    const ca = (G.time * 4) % (G.W + 500) - 250;
    x.drawImage(SPR.cloud[0], G.W - ca * 0.4, 20, 300, 100);
    x.drawImage(SPR.cloud[1], G.W - ca * 0.25, 80, 260, 90);
    x.restore();
    if (p.hurtT > 0) {
      x.fillStyle = 'rgba(255,40,40,' + (p.hurtT * 0.9) + ')';
      x.fillRect(0, 0, G.W, G.H);
    }
    if (p.hp < p.maxhp * 0.3 && !p.dead) {
      const pulse = 0.12 + Math.sin(G.time * 6) * 0.06;
      const gr = x.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.3, G.W / 2, G.H / 2, G.H * 0.75);
      gr.addColorStop(0, 'rgba(120,0,0,0)');
      gr.addColorStop(1, 'rgba(120,0,0,' + pulse + ')');
      x.fillStyle = gr;
      x.fillRect(0, 0, G.W, G.H);
    }
    if (G.seraphSpawned && G.boss) {
      x.fillStyle = 'rgba(255,220,150,0.05)';
      x.fillRect(0, 0, G.W, G.H);
    }
    if (G.touch && G.state === 'run') {
      const jx = U.clamp(G.touch.dx, -44, 44), jy = U.clamp(G.touch.dy, -44, 44);
      x.globalAlpha = 0.28;
      x.strokeStyle = '#b89aff'; x.lineWidth = 2;
      x.beginPath(); x.arc(G.touch.ax, G.touch.ay, 46, 0, TAU); x.stroke();
      x.globalAlpha = 0.55;
      x.fillStyle = '#b89aff';
      x.beginPath(); x.arc(G.touch.ax + jx, G.touch.ay + jy, 20, 0, TAU); x.fill();
      x.globalAlpha = 1;
    }
  };

  G.renderGround = function (x, camX, camY) {
    x.save();
    x.translate(Math.floor(camX / 2) * 2, Math.floor(camY / 2) * 2);
    x.fillStyle = G.pattern;
    x.fillRect(camX - G.W / 2 - 2, camY - G.H / 2 - 2, G.W + 4, G.H + 4);
    x.restore();
  };

  G.renderProps = function (x, camX, camY) {
    const x0 = Math.floor((camX - G.W / 2) / PCELL), x1 = Math.floor((camX + G.W / 2) / PCELL);
    const y0 = Math.floor((camY - G.H / 2) / PCELL), y1 = Math.floor((camY + G.H / 2) / PCELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const h = U.hash2(cx, cy, 977);
        if (h > 0.62) continue;
        const px = cx * PCELL + U.hash2(cx, cy, 31) * (PCELL - 60) + 30;
        const py = cy * PCELL + U.hash2(cx, cy, 57) * (PCELL - 60) + 30;
        const v = U.hash2(cx, cy, 131);
        let spr;
        if (v < 0.26) spr = SPR.tuft;
        else if (v < 0.42) spr = SPR.tomb1;
        else if (v < 0.54) spr = SPR.tomb2;
        else if (v < 0.63) spr = SPR.tomb3;
        else if (v < 0.72) spr = SPR.bonesP;
        else if (v < 0.81) spr = SPR.rock;
        else if (v < 0.89) spr = SPR.fence;
        else if (v < 0.96) spr = SPR.tree;
        else spr = SPR.shrine;
        x.globalAlpha = 0.95;
        x.drawImage(spr, px - spr.width / 2, py - spr.height + 16);
        if (spr === SPR.shrine) {
          const fl = 0.5 + Math.sin(G.time * 7 + cx) * 0.2;
          x.globalAlpha = fl * 0.5;
          x.drawImage(SPR.wisp, px - 10, py - 30, 20, 20);
        }
        x.globalAlpha = 1;
      }
    }
  };

  G.renderShadows = function (x) {
    for (const e of G.enemies) {
      const w = e.r * 3.4;
      x.globalAlpha = e.boss ? 0.7 : 0.5;
      x.drawImage(SPR.shadow, e.x - w / 2, e.y - w / 4, w, w / 2);
    }
    for (const m of G.minions) x.drawImage(SPR.shadow, m.x - 20, m.y - 9, 40, 20);
    x.globalAlpha = 0.6;
    x.drawImage(SPR.shadow, G.p.x - 26, G.p.y - 12, 52, 26);
    x.globalAlpha = 1;
  };

  G.renderPlayer = function (x) {
    const p = G.p;
    if (p.dead) return;
    const moving = p.walkT > 0;
    const frame = moving ? (Math.floor(p.walkT) % 2 === 0 ? 1 : 2) : 0;
    const bob = moving ? Math.abs(Math.sin(p.walkT * 1.2)) * 3 : Math.sin(G.time * 2) * 1.5;
    x.save();
    x.translate(p.x, p.y - bob);
    if (p.face < 0) x.scale(-1, 1);
    if (p.hitCd > 0.3) {
      x.globalAlpha = 0.5;
    }
    x.drawImage(SPR.player[frame], -36, -82);
    if (p.hurtT > 0) {
      x.globalAlpha = p.hurtT * 2;
      x.drawImage(SPR.playerFlash[frame], -36, -82);
    }
    x.restore();
    x.globalAlpha = 1;
  };

  G.renderMinion = function (x, m) {
    const frame = m.walk > 0 ? Math.floor(m.walk) % 2 : 0;
    x.save();
    x.translate(m.x, m.y - Math.abs(Math.sin(m.walk || 0)) * 2);
    const t = m.target;
    if (t && t.x < m.x) x.scale(-1, 1);
    else if (!t && G.p.x < m.x) x.scale(-1, 1);
    x.drawImage(SPR.minion[frame], -25, -54);
    if (m.flash > 0) {
      x.globalAlpha = m.flash * 6;
      x.drawImage(SPR.minionFlash[frame], -25, -54);
      x.globalAlpha = 1;
    }
    x.restore();
  };

  G.renderEnemy = function (x, e) {
    const spr = SPR[e.spr], flash = SPR.flash[e.spr];
    const bob = Math.sin(G.time * 5 + e.wob) * 2;
    x.save();
    x.translate(e.x, e.y);
    if (e.ai === 'lunge') {
      if (e.state === 'windup') {
        x.translate(U.rand(-2, 2), U.rand(-2, 2));
      }
    }
    if (e.boss) {
      const flap = Math.sin(G.time * 3) * 0.14;
      x.save();
      x.scale(1, 1 + flap);
      x.drawImage(SPR.seraphWings, -200, -170, 400, 240);
      x.restore();
    }
    const sc = e.scale;
    const w = spr.width * sc, h = spr.height * sc;
    if (e.state === 'windup') x.translate(U.rand(-1.5, 1.5), U.rand(-1.5, 1.5));
    if (G.p.x < e.x) x.scale(-1, 1);
    x.drawImage(spr, -w / 2, -h + 12 + bob * 0.4, w, h);
    if (e.slowT > 0) {
      x.globalAlpha = 0.35;
      x.drawImage(spr, -w / 2, -h + 12 + bob * 0.4, w, h);
      x.globalAlpha = 1;
    }
    if (e.flash > 0) {
      x.globalAlpha = Math.min(1, e.flash * 8);
      x.drawImage(flash, -w / 2, -h + 12 + bob * 0.4, w, h);
      x.globalAlpha = 1;
    }
    x.restore();
    if ((e.elite || e.champ) && !e.boss) {
      const w2 = e.champ ? 90 : 64;
      const y0 = e.y - (spr.height * e.scale) + (e.champ ? 6 : 2);
      x.fillStyle = 'rgba(10,8,14,0.7)';
      x.fillRect(e.x - w2 / 2, y0, w2, 6);
      x.fillStyle = '#ffd97a';
      x.fillRect(e.x - w2 / 2, y0, w2 * Math.max(0, e.hp / e.maxhp), 6);
    }
  };

  G.renderFog = function (x, camX, camY) {
    if (G.q === 0) return;
    x.save();
    const t = G.time;
    for (let i = 0; i < G.fogP.length; i++) {
      const f = G.fogP[i];
      const fx = f.x + Math.sin(t * 0.05 * f.v + i) * 260 + camX * 0.12;
      const fy = f.y + Math.cos(t * 0.04 * f.v + i * 2) * 200 + camY * 0.12;
      const s = 480 * f.s;
      x.globalAlpha = G.q === 2 ? 0.6 : 0.35;
      x.drawImage(SPR.fogB, fx - s / 2 + G.W / 2, fy - s / 2 + G.H / 2, s, s);
    }
    x.restore();
    x.globalAlpha = 1;
  };

  G.renderTitle = function () {
    const x = G.x;
    x.fillStyle = '#0b0d12';
    x.fillRect(0, 0, G.W, G.H);
    x.save();
    x.translate(-Math.floor(G.W / 4), 0);
    x.fillStyle = G.pattern;
    x.fillRect(0, 0, G.W + G.W / 4, G.H);
    x.restore();
    x.globalAlpha = 0.5;
    x.drawImage(SPR.moon, G.W * 0.72 - 130, G.H * 0.1, 260, 260);
    x.globalAlpha = 0.45;
    const t = G.ambT;
    for (let i = 0; i < 3; i++) {
      const s = 420 + i * 160;
      x.drawImage(SPR.cloud[i % 3], G.W - ((t * (8 + i * 5)) % (G.W + 500)) + 250, 30 + i * 60, 320, 110);
    }
    x.globalAlpha = 0.5;
    for (let i = 0; i < 3; i++) {
      const s = 600 + i * 200;
      const fx = ((i * 577) % G.W) + Math.sin(t * 0.08 + i) * 100;
      x.drawImage(SPR.fogB, fx - s / 2, G.H * 0.3 + i * 90 - s / 2, s, s);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'lighter';
    for (const s of G.parts) {
      const lifeF = 1 - s.t / s.life;
      x.globalAlpha = 0.5 * lifeF;
      x.drawImage(SPR.wisp, s.x + G.W / 2, s.y + G.H * 0.4, 20, 20);
    }
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
  };

  G.runStats = function () {
    const p = G.p;
    const min = G.time / 60;
    let base = p.kills * 0.35 + min * 10 + p.level * 4 + p.elites * 10 + p.champs * 30;
    if (p.win) base += 100;
    if (G.endless) base += Math.max(0, min - 20) * 8;
    const ess = Math.floor(base * (p.essMul || 1)) + p.essence;
    return {
      time: G.time, level: p.level, kills: p.kills, raised: p.raised, essence: ess,
      win: !!p.win, endless: G.endless, minions: G.minions.length,
      elites: p.elites, champs: p.champs, char: G.char
    };
  };

  G.goEndless = function () {
    G.endless = true;
    G.p.dead = false;
    G.p.win = false;
    G.overKind = '';
    G.overT = 0;
    G.slowmo = 0;
    G.ringNext = G.time + 60;
    A.startMusic('run');
    A.setIntensity(3);
    UI.banner('REIGN ETERNAL', 'the dawn keeps sending them');
    for (let s = 0; s < 6; s++) {
      const a = (s / 6) * TAU;
      G.spawnAt(U.pick(['crusader', 'hound']), G.p.x + Math.cos(a) * 500, G.p.y + Math.sin(a) * 500);
    }
  };

  G.abandon = function () {
    G.p.dead = true;
    G.p.win = false;
    G.overT = 99;
    G.overKind = 'death';
  };
})();
