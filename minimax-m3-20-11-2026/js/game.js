(function (G) {
  'use strict';
  var U = G.U, K = G.K, R = G.Render, A = G.Audio;

  var Save = (G.Save = {
    data: { echoes: 0, best: 0, bestWave: 0, runs: 0, meta: {}, muted: false, seenHow: false },
    load: function () {
      var d = U.Storage.get('periapsis.save', null);
      if (d && typeof d === 'object') {
        Save.data = Object.assign(Save.data, d);
        Save.data.meta = d.meta || {};
      }
      if (Save.data.muted) A.muted = true;
    },
    save: function () { U.Storage.set('periapsis.save', Save.data); }
  });

  var game = (G.Game = {
    state: 'title',
    time: 0,
    last: 0,
    seed: '',
    rng: null,
    player: null,
    mods: null,
    enemies: [],
    debris: [],
    bolts: [],
    shards: [],
    pickups: [],
    particles: [],
    texts: [],
    rings: [],
    planets: [],
    cam: { x: 0, y: 0, zoom: 1 },
    wave: 1,
    waveTimer: 0,
    waveBudget: 0,
    spawnAcc: 0,
    debrisAcc: 0,
    trailAcc: 0,
    kills: 0,
    killScore: 0,
    bonus: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    score: 0,
    runTime: 0,
    xp: 0,
    level: 1,
    xpNext: 40,
    perks: [],
    perkChoices: [],
    shakeAmt: 0,
    flashAmt: 0,
    flashColor: [1, 1, 1],
    ult: null,
    ultActive: null,
    timeScale: 1,
    deadT: 0,
    pendingPerk: false,
    attractT: 0,
    attractPlanet: null,
    attractCam: { x: 0, y: 0, zoom: 0.7 },
    dom: {},
    lastHud: {}
  });

  function $(id) { return document.getElementById(id); }

  function cacheDom() {
    var ids = ['hud', 'hud-mass', 'hud-wave', 'hud-score', 'hud-kills', 'hud-seed', 'hud-time',
      'bar-hp', 'txt-hp', 'bar-dash', 'txt-dash', 'bar-ult', 'txt-ult', 'ult-prompt', 'boss-bar',
      'bar-hunger', 'txt-hunger', 'combo', 'banner',
      'boss-name', 'boss-fill', 'toasts', 'title', 'how', 'meta', 'perk', 'perk-cards', 'pause',
      'pause-sub', 'gameover', 'go-title', 'go-sub', 'go-stats', 'go-echoes', 'loading',
      'best-score', 'best-wave', 'echo-count', 'meta-list', 'meta-echoes', 'seed-input',
      'view', 'touch', 'stick', 'stick-knob', 'btn-dash', 'btn-ult',
      'btn-play', 'btn-meta', 'btn-how', 'btn-seed', 'btn-daily',
      'btn-resume', 'btn-abort', 'btn-retry', 'btn-title', 'seed-input'];
    for (var i = 0; i < ids.length; i++) {
      game.dom[ids[i]] = $(ids[i]);
      var camel = ids[i].replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
      if (!game.dom[camel]) game.dom[camel] = game.dom[ids[i]];
    }
    game.dom.btnPlay = game.dom['btn-play'];
    game.dom.btnMeta = game.dom['btn-meta'];
    game.dom.btnHow = game.dom['btn-how'];
    game.dom.btnSeed = game.dom['btn-seed'];
    game.dom.btnDaily = game.dom['btn-daily'];
    game.dom.btnResume = game.dom['btn-resume'];
    game.dom.btnAbort = game.dom['btn-abort'];
    game.dom.btnRetry = game.dom['btn-retry'];
    game.dom.btnTitle = game.dom['btn-title'];
    game.dom.seedInput = game.dom['seed-input'];
  }

  function show(el, on) { if (el) el.classList.toggle('hidden', !on); }

  game.banner = function (title, sub) {
    var el = game.dom.banner;
    if (!el) return;
    el.innerHTML = '<b>' + title + '</b><span>' + (sub || '') + '</span>';
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(game._bannerT);
    game._bannerT = setTimeout(function () { el.classList.add('hidden'); }, 1750);
  };

  game.toast = function (txt, cls) {
    var el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = txt;
    game.dom.toasts.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2000);
  };

  game.shake = function (a) { game.shakeAmt = Math.min(46, game.shakeAmt + a); };
  game.flash = function (a, c) { game.flashAmt = Math.max(game.flashAmt, a); if (c) game.flashColor = c; };

  game.burst = function (x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * U.TAU;
      var s = spd * (0.35 + Math.random() * 0.9);
      game.particles.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        r: 1.4 + Math.random() * 2.6, life: 0.35 + Math.random() * 0.6, max: 1,
        c: color, a: 1, grow: Math.random() < 0.4
      });
      if (game.particles.length > 900) game.particles.shift();
    }
  };

  game.ring = function (x, y, color, radius, life) {
    game.rings.push({ x: x, y: y, c: color, r: 10, max: radius, life: life, t: 0 });
  };

  game.floatText = function (x, y, txt, color) {
    game.texts.push({ x: x, y: y, txt: txt, c: color || '#ffffff', life: 0.95, max: 0.95, size: 14 });
    if (game.texts.length > 40) game.texts.shift();
  };

  game.inputDir = function () {
    if (game.touchVec && (game.touchVec.x || game.touchVec.y)) return game.touchVec;
    return G.Input.axis();
  };

  function fieldAccel(o, dt, resp, reach) {
    var p = game.player;
    if (!p) return;
    var cr = p.captureR();
    var dx = p.x - o.x, dy = p.y - o.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var far = cr * (reach || 1.75);
    if (d > far) return;
    var scale = Math.pow(p.mass / K.START_MASS, 0.25);
    var k = K.FIELD_K * p.mods.pullMul * scale * resp;
    var a = k / (1 + (d / cr) * (d / cr));
    var inv = 1 / (d || 1);
    if (o.fvx !== undefined) {
      o.fvx += dx * inv * a * dt;
      o.fvy += dy * inv * a * dt;
    } else {
      o.vx += dx * inv * a * dt;
      o.vy += dy * inv * a * dt;
    }
  }

  function nearestPlanet(x, y) {
    var best = null, bd = 1e9;
    for (var i = 0; i < game.planets.length; i++) {
      var d = U.dist(x, y, game.planets[i].x, game.planets[i].y);
      if (d < bd) { bd = d; best = game.planets[i]; }
    }
    return { p: best, d: bd };
  }

  function startRun(seedStr) {
    game.seed = (seedStr && seedStr.length ? seedStr.toUpperCase() : U.makeSeed());
    game.rng = new U.RNG(game.seed);
    game.mods = G.defaultMods(Save.data.meta);
    game.player = new G.Player(0, 0, game.mods);
    game.enemies = [];
    game.debris = [];
    game.bolts = [];
    game.shards = [];
    game.pickups = [];
    game.particles = [];
    game.texts = [];
    game.rings = [];
    game.planets = G.genPlanets(game.rng);
    game.wave = 1;
    game.waveTimer = 0;
    game.waveBudget = 26;
    game.spawnAcc = 0;
    game.debrisAcc = 0;
    game.trailAcc = 0;
    game.kills = 0;
    game.killScore = 0;
    game.bonus = 0;
    game.combo = 0;
    game.comboT = 0;
    game.bestCombo = 0;
    game.score = 0;
    game.runTime = 0;
    game.xp = 0;
    game.level = 1;
    game.xpNext = 68;
    game.perks = [];
    game.ult = 0;
    game.ultActive = null;
    game.timeScale = 1;
    game.deadT = 0;
    game.pendingPerk = false;
    game.shakeAmt = 0;
    game.flashAmt = 0;
    game.cam.x = 0; game.cam.y = 0; game.cam.zoom = 1;
    for (var i = 0; i < 130; i++) spawnDebris(true);
    for (var j = 0; j < 5; j++) spawnEnemy('mote', true);
    A.setIntensity(0);
    A.bpm = 96;
    game.state = 'playing';
    show(game.dom.title, false);
    show(game.dom.gameover, false);
    show(game.dom.pause, false);
    show(game.dom.perk, false);
    show(game.dom.hud, true);
    game.dom.hudSeed.textContent = game.seed;
    game.lastHud = {};
    updateHud(true);
  }

  function spawnDebris(anywhere) {
    var rng = game.rng, p = game.player;
    var ang;
    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > 60 && rng.chance(0.62)) {
      ang = Math.atan2(p.vy, p.vx) + rng.f(-1.25, 1.25);
    } else {
      ang = rng.f(0, U.TAU);
    }
    var dist = anywhere ? rng.f(300, 700) : rng.f(430, 900);
    var big = rng.chance(0.09);
    var d = new G.Debris(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, rng, big);
    game.debris.push(d);
    if (game.debris.length > 240) {
      var worst = -1, wd = -1;
      for (var i = 0; i < game.debris.length; i++) {
        var dd = U.dist2(game.debris[i].x, game.debris[i].y, p.x, p.y);
        if (dd > wd) { wd = dd; worst = i; }
      }
      if (worst >= 0) game.debris.splice(worst, 1);
    }
  }

  function spawnEnemy(type, near) {
    var rng = game.rng, p = game.player;
    var ang;
    var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (!near && sp > 70 && rng.chance(0.68)) {
      ang = Math.atan2(p.vy, p.vx) + rng.f(-1.15, 1.15);
    } else {
      ang = rng.f(0, U.TAU);
    }
    var dist = near ? rng.f(280, 480) : rng.f(480, 780);
    var e = new G.Enemy(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, type, game.wave, rng);
    game.enemies.push(e);
    if (type === 'warden') {
      A.sfx.boss();
      game.toast('WARDEN — ' + (game.wave % 10 === 0 ? 'APEX' : 'ELITE'), 'bad');
      game.shake(18);
    }
    return e;
  }

  game.flingShards = function (p, dx, dy) {
    var cap = Math.floor(16 * p.mods.volleyMul);
    var cr = p.captureR() * 2.4;
    var list = [];
    for (var i = 0; i < game.debris.length; i++) {
      var d = game.debris[i];
      var dd = U.dist(d.x, d.y, p.x, p.y);
      if (dd < cr) list.push({ o: d, d: dd });
    }
    list.sort(function (a, b) { return a.d - b.d; });
    var n = Math.min(list.length, cap);
    for (var j = 0; j < n; j++) {
      var it = list[j].o;
      var ox = it.x - p.x, oy = it.y - p.y;
      var ol = Math.sqrt(ox * ox + oy * oy) || 1;
      var sp = 560 + it.mass * 1.6;
      var vx = dx * sp + (ox / ol) * 170 + p.vx * 0.22;
      var vy = dy * sp + (oy / ol) * 170 + p.vy * 0.22;
      var dmg = it.mass * 2.3 * p.mods.dmgMul;
      var tint = it.big ? '#ffd2a0' : '#cfe6ff';
      var sh = new G.Shard(it.x, it.y, vx, vy, it.mass, dmg, tint, it.big ? 'amber' : 'cyan');
      sh.pierce = p.mods.pierce;
      game.shards.push(sh);
      game.burst(it.x, it.y, it.big ? '#ffc861' : '#5ef0ff', it.big ? 10 : 5, 160);
      it.alive = false;
    }
    if (p.mods.shockwave) {
      game.ring(p.x, p.y, '#ff4fd8', 260, 0.45);
      game.shake(12);
      for (var k = 0; k < game.enemies.length; k++) {
        var e = game.enemies[k];
        if (U.dist(e.x, e.y, p.x, p.y) < 260) {
          e.hp -= 34 * p.mods.dmgMul;
          e.flash = 0.2;
          e.stagger = 0.7;
          if (e.hp <= 0) killEnemy(e, p.x, p.y);
        }
      }
    }
  };

  function killEnemy(e, kx, ky) {
    if (!e.alive) return;
    e.alive = false;
    game.kills++;
    game.combo++;
    game.comboT = 4.2;
    if (game.combo > game.bestCombo) game.bestCombo = game.combo;
    game.killScore += e.score * (1 + Math.min(game.combo, 60) * 0.035);
    game.floatText(e.x, e.y - 26, '+' + e.score, e.boss ? '#ff6f9a' : '#ffd9a0');
    if (game.combo >= 5 && game.combo % 5 === 0) {
      game.floatText(game.player.x, game.player.y - 46, 'x' + game.combo + ' FEEDING FRENZY', '#ffc861');
      game.ring(game.player.x, game.player.y, '#ffc861', 200, 0.45);
    }
    game.xp += e.xp;
    var col = e.type === 'warden' ? '#ff3d6e' : (e.type === 'anchor' ? '#c98bff' : '#ff7a5c');
    game.burst(e.x, e.y, col, e.boss ? 60 : 16, e.boss ? 380 : 220);
    game.ring(e.x, e.y, col, e.boss ? 460 : 90, 0.4);
    game.shake(e.boss ? 26 : 4);
    A.sfx.kill();
    game.ult = Math.min(K.ULT_MAX, game.ult + (e.boss ? 50 : 4.2) * game.mods.ultRateMul);
    if (game.mods.healOnKill > 0 && game.player) {
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + game.mods.healOnKill);
    }
    if (Math.random() < 0.10 + game.mods.dropMul * 0.5) {
      game.pickups.push(new G.Pickup(e.x, e.y, 'mass'));
    }
    if (Math.random() < 0.11) {
      game.pickups.push(new G.Pickup(e.x + 14, e.y, 'heal'));
    }
    if (e.type === 'splitter') {
      for (var sp = 0; sp < 3; sp++) {
        var sa = (sp / 3) * U.TAU + Math.random();
        var nb = spawnEnemy('mote', true);
        nb.x = e.x + Math.cos(sa) * 18;
        nb.y = e.y + Math.sin(sa) * 18;
        nb.spawnT = 0.2;
      }
      game.ring(e.x, e.y, '#ff9a4d', 120, 0.3);
    }
    if (e.boss) {
      game.flash(0.55, [1, 0.75, 0.85]);
      game.toast('WARDEN COLLAPSED', 'gold');
      game.bonus += 1500;
    }
  }

  function openPerk() {
    game.pendingPerk = true;
    var pool = G.PERKS.slice();
    var counts = {};
    for (var i = 0; i < game.perks.length; i++) counts[game.perks[i]] = (counts[game.perks[i]] || 0) + 1;
    var choices = [];
    for (var c = 0; c < 3; c++) {
      var weighted = [];
      for (var j = 0; j < pool.length; j++) {
        var p = pool[j];
        var stack = counts[p.id] || 0;
        if (stack >= 3) continue;
        weighted.push(p);
      }
      if (!weighted.length) break;
      var pick = weighted[(Math.random() * weighted.length) | 0];
      if (choices.indexOf(pick) >= 0) {
        var alt = weighted.filter(function (x) { return choices.indexOf(x) < 0; });
        if (alt.length) pick = alt[(Math.random() * alt.length) | 0];
      }
      counts[pick.id] = (counts[pick.id] || 0) + 1;
      choices.push(pick);
    }
    game.perkChoices = choices;
    var wrap = game.dom.perkCards;
    wrap.innerHTML = '';
    for (var k = 0; k < choices.length; k++) {
      (function (perk, idx) {
        var card = document.createElement('div');
        card.className = 'perk-card';
        var col = perk.tier === 'EPIC' ? '#ff4fd8' : perk.tier === 'RARE' ? '#ffc861' : '#5ef0ff';
        card.style.setProperty('--pc', col);
        card.style.setProperty('--pcg', U.rgba(col, 0.4));
        var stack = (counts[perk.id] || 1) - 1;
        card.innerHTML = '<div class="key">' + (idx + 1) + '</div>' +
          '<div class="perk-icon">' + perk.icon + '</div>' +
          '<div class="perk-name">' + perk.name + '</div>' +
          '<div class="perk-desc">' + perk.desc + '</div>' +
          '<div class="perk-tier">' + perk.tier + (stack > 0 ? ' · STACK ' + (stack + 1) : '') + '</div>';
        card.onclick = function () { choosePerk(idx); };
        wrap.appendChild(card);
      })(choices[k], k);
    }
    game.state = 'perk';
    show(game.dom.perk, true);
    A.sfx.levelup();
  }

  function choosePerk(idx) {
    var perk = game.perkChoices[idx];
    if (!perk) return;
    var before = game.mods.maxHp;
    perk.apply(game.mods);
    game.mods.maxHp = K.MAX_HP + game.mods.maxHpAdd;
    game.player.maxHp = game.mods.maxHp;
    if (game.mods.maxHp > before) game.player.hp += (game.mods.maxHp - before);
    game.perks.push(perk.id);
    game.pendingPerk = false;
    game.state = 'playing';
    show(game.dom.perk, false);
    A.sfx.pickup();
    game.toast(perk.name + ' ACQUIRED', 'gold');
    game.ring(game.player.x, game.player.y, '#ffc861', 220, 0.5);
    game.burst(game.player.x, game.player.y, '#ffc861', 22, 220);
  }

  function startUlt() {
    var p = game.player;
    if (game.ult < K.ULT_MAX || game.ultActive) return;
    game.ult = 0;
    game.ultActive = { x: p.x, y: p.y, r: 20, t: 0, dur: 2.4, max: 900 * game.mods.ultRadiusMul };
    game.flash(0.7, [0.75, 0.35, 1]);
    game.shake(28);
    A.sfx.ult();
    game.toast('EVENT HORIZON', 'bad');
  }

  function updateWorld(dt) {
    var p = game.player;
    game.runTime += dt;

    p.update(dt, game);

    if (G.Input.hit(' ') || game.mouseDash) { p.dash(game); game.mouseDash = false; }

    var pspd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    game.trailAcc += dt;
    if (pspd > 90 && game.trailAcc > 0.016) {
      game.trailAcc = 0;
      var ta = Math.atan2(p.vy, p.vx) + Math.PI;
      game.particles.push({
        x: p.x + Math.cos(ta) * p.bodyR() * 0.8, y: p.y + Math.sin(ta) * p.bodyR() * 0.8,
        vx: Math.cos(ta) * 60 + U.rand(-18, 18), vy: Math.sin(ta) * 60 + U.rand(-18, 18),
        r: p.bodyR() * 0.2, life: 0.26, max: 0.26, c: '#a06bff', a: 0.32, grow: true
      });
      if (game.particles.length > 900) game.particles.shift();
    }

    if (p.starving) {
      p.starve(4.5 * dt);
      if (Math.random() < dt * 3) game.burst(p.x + U.rand(-30, 30), p.y + U.rand(-30, 30), '#ff9a4d', 2, 60);
    }

    var i, e, d, o;

    for (i = game.debris.length - 1; i >= 0; i--) {
      d = game.debris[i];
      if (!d.alive) { game.debris.splice(i, 1); continue; }
      fieldAccel(d, dt, U.clamp(12 / d.mass, 0.35, 1.5), 4);
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.rot += d.spin * dt;
      d.vx *= Math.pow(0.995, dt * 60);
      d.vy *= Math.pow(0.995, dt * 60);
      var dd = U.dist(d.x, d.y, p.x, p.y);
      if (dd < p.bodyR() * 1.35 && d.mass <= p.crushT()) {
        var gain = d.mass * p.mods.feedMul;
        p.mass += gain;
        p.hunger = 0;
        game.xp += 1;
        game.score += gain * 2;
        game.burst(d.x, d.y, d.big ? '#ffc861' : '#9fd8ff', d.big ? 16 : 6, 150);
        game.floatText(d.x, d.y - 12, '+' + Math.round(gain), d.big ? '#ffc861' : '#9fd8ff');
        d.alive = false;
        A.sfx.eat(0.8 + Math.min(gain, 30) / 40);
        game.debris.splice(i, 1);
      }
    }

    var debrisTarget = Math.min(200, 150 + Math.min(70, game.wave * 5));
    while (game.debris.length < debrisTarget) spawnDebris(false);
    game.debrisAcc += dt;
    while (game.debrisAcc > 0.17) { game.debrisAcc -= 0.17; spawnDebris(false); }

    for (i = game.enemies.length - 1; i >= 0; i--) {
      e = game.enemies[i];
      if (!e.alive) { game.enemies.splice(i, 1); continue; }
      e.flash = Math.max(0, e.flash - dt);
      e.spawnT = Math.max(0, e.spawnT - dt);
      e.phase += dt * 2;
      if (e.stagger > 0) { e.stagger -= dt; }
      var dx = p.x - e.x, dy = p.y - e.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dx / dist, ny = dy / dist;

      if (e.resist < 1) {
        fieldAccel(e, dt, U.clamp(14 / e.mass, 0.22, 0.95) * (1 - e.resist) * game.mods.enemyPullMul, 2.6);
      }

      if (e.stagger <= 0 && e.spawnT <= 0) {
        if (e.type === 'mote') {
          e.vx += nx * e.accel * dt;
          e.vy += ny * e.accel * dt;
        } else if (e.type === 'darter') {
          e.strafeT -= dt;
          if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = U.rand(0.7, 1.8); }
          e.vx += (nx * e.accel + -ny * e.strafe * e.accel * 0.7) * dt;
          e.vy += (ny * e.accel + nx * e.strafe * e.accel * 0.7) * dt;
        } else if (e.type === 'lancer') {
          e.strafeT -= dt;
          if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = U.rand(1.2, 2.6); }
          var want = dist > 380 ? 1 : dist < 250 ? -0.8 : 0;
          e.vx += (nx * want * e.accel - ny * e.strafe * e.accel * 0.5) * dt;
          e.vy += (ny * want * e.accel + nx * e.strafe * e.accel * 0.5) * dt;
          e.shootCd -= dt;
          if (e.shootCd <= 0 && dist < 620) {
            e.shootCd = 2.1 / Math.max(0.7, e.speed / 200);
            var sv = 330;
            var ang = Math.atan2(dy, dx) + U.rand(-0.08, 0.08);
            game.bolts.push(new G.Bolt(e.x + nx * e.r, e.y + ny * e.r, Math.cos(ang) * sv, Math.sin(ang) * sv, e.dmg));
            A.sfx.shoot();
          }
        } else if (e.type === 'anchor') {
          e.vx += nx * e.accel * dt;
          e.vy += ny * e.accel * dt;
        } else if (e.type === 'warden') {
          e.vx += nx * e.accel * dt;
          e.vy += ny * e.accel * dt;
          e.vulnT -= dt;
          if (e.vulnT <= 0) {
            e.vuln = e.vuln > 0 ? 0 : 1;
            e.vulnT = e.vuln > 0 ? 3.0 : 4.4;
            if (e.vuln > 0) game.toast('CORE EXPOSED', 'gold');
          }
          e.shootCd -= dt;
          if (e.shootCd <= 0) {
            e.shootCd = 3.1;
            var base = Math.atan2(dy, dx);
            for (var b = -4; b <= 4; b++) {
              var ang2 = base + b * 0.22;
              game.bolts.push(new G.Bolt(e.x, e.y, Math.cos(ang2) * 280, Math.sin(ang2) * 280, 14));
            }
            if (Math.random() < 0.6) {
              for (var s2 = 0; s2 < 3; s2++) {
                var ea = Math.random() * U.TAU;
                spawnEnemy('mote', true);
                var ne = game.enemies[game.enemies.length - 1];
                ne.x = e.x + Math.cos(ea) * e.r * 1.4;
                ne.y = e.y + Math.sin(ea) * e.r * 1.4;
              }
            }
            A.sfx.shoot();
          }
        }
      }

      var spd = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
      var maxSp = e.speed;
      if (e.type === 'mote') maxSp *= 1.15;
      if (spd > maxSp) { e.vx = e.vx / spd * maxSp; e.vy = e.vy / spd * maxSp; }
      e.fvx *= Math.pow(0.92, dt * 60);
      e.fvy *= Math.pow(0.92, dt * 60);
      e.x += (e.vx + e.fvx) * dt;
      e.y += (e.vy + e.fvy) * dt;
      e.rot += dt * (e.type === 'darter' ? 6 : 1.4);

      var np = nearestPlanet(e.x, e.y);
      if (np.p && np.d < np.p.r * 1.6 && e.type !== 'warden') {
        var gx = np.p.x - e.x, gy = np.p.y - e.y;
        var gd = Math.sqrt(gx * gx + gy * gy) || 1;
        var ga = K.PLANET_G * np.p.mass / (gd * gd);
        e.fvx += (gx / gd) * ga * dt;
        e.fvy += (gy / gd) * ga * dt;
        if (gd < np.p.r + e.r) {
          e.x = np.p.x + (gx / gd) * (np.p.r + e.r);
          e.y = np.p.y + (gy / gd) * (np.p.r + e.r);
        }
      }

      if (e.type !== 'warden') {
        for (var j = 0; j < game.enemies.length; j++) {
          var o2 = game.enemies[j];
          if (o2 === e || !o2.alive) continue;
          var ddx = o2.x - e.x, ddy = o2.y - e.y;
          var dd2s = ddx * ddx + ddy * ddy;
          var minSep = (o2.r + e.r) * 0.9;
          if (dd2s > 0.01 && dd2s < minSep * minSep) {
            var dd2 = Math.sqrt(dd2s);
            var push = (minSep - dd2) / minSep * 220 * dt;
            e.vx -= (ddx / dd2) * push;
            e.vy -= (ddy / dd2) * push;
          }
        }
      }

      var crushable = e.mass <= p.crushT() && e.resist < 1;
      if (crushable && dist < p.captureR() * 0.95) e.captured = true;
      if (dist < p.bodyR() + e.r * 0.85) {
        if (crushable) {
          var gain = e.mass * 0.85 * p.mods.feedMul;
          p.mass += gain;
          p.hunger = 0;
          game.floatText(e.x, e.y - 18, '+' + Math.round(gain), '#ff9a4d');
          killEnemy(e, p.x, p.y);
        } else if (!e.captured) {
          p.damage(e.dmg * e.contact, game);
        }
      }
      e.dashCd = Math.max(0, (e.dashCd || 0) - dt);
      if (p.dashT > 0 && e.dashCd <= 0 && dist < p.bodyR() + e.r + 6) {
        e.dashCd = 0.4;
        e.hp -= 34 * p.mods.dmgMul * (e.type === 'warden' ? 0.25 : 1);
        e.flash = 0.2;
        e.fvx += nx * 620;
        e.fvy += ny * 620;
        game.burst(e.x, e.y, '#5ef0ff', 8, 220);
        game.shake(4);
        A.sfx.hit();
        if (e.hp <= 0) killEnemy(e, p.x, p.y);
      }

      if (game.ultActive) {
        var ud = U.dist(e.x, e.y, game.ultActive.x, game.ultActive.y);
        if (ud < game.ultActive.r) {
          killEnemy(e, game.ultActive.x, game.ultActive.y);
        }
      }
    }

    for (i = game.bolts.length - 1; i >= 0; i--) {
      o = game.bolts[i];
      fieldAccel(o, dt, 1.5, 1.9);
      var np2 = nearestPlanet(o.x, o.y);
      if (np2.p) {
        var bdx = np2.p.x - o.x, bdy = np2.p.y - o.y;
        var bd = Math.sqrt(bdx * bdx + bdy * bdy) || 1;
        var ba = K.PLANET_G * np2.p.mass / (bd * bd);
        o.vx += (bdx / bd) * ba * dt;
        o.vy += (bdy / bd) * ba * dt;
        if (bd < np2.p.r) { game.burst(o.x, o.y, '#ff5a6e', 6, 120); game.bolts.splice(i, 1); continue; }
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0) { game.bolts.splice(i, 1); continue; }
      if (U.dist(o.x, o.y, p.x, p.y) < p.bodyR() * 0.9 + o.r) {
        p.damage(o.dmg, game);
        game.burst(o.x, o.y, '#ff5a6e', 8, 150);
        game.bolts.splice(i, 1);
      }
    }

    for (i = game.shards.length - 1; i >= 0; i--) {
      o = game.shards[i];
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.rot += o.spin * dt;
      o.life -= dt;
      var np3 = nearestPlanet(o.x, o.y);
      if (np3.p) {
        var sdx = np3.p.x - o.x, sdy = np3.p.y - o.y;
        var sd = Math.sqrt(sdx * sdx + sdy * sdy) || 1;
        var sa = K.PLANET_G * np3.p.mass / (sd * sd);
        o.vx += (sdx / sd) * sa * dt;
        o.vy += (sdy / sd) * sa * dt;
        if (sd < np3.p.r) {
          game.burst(o.x, o.y, '#ffc861', 8, 160);
          game.shards.splice(i, 1);
          continue;
        }
      }
      if (o.life <= 0) { game.shards.splice(i, 1); continue; }
      var hitSomething = false;
      for (var ei = 0; ei < game.enemies.length; ei++) {
        var en = game.enemies[ei];
        if (!en.alive) continue;
        if (U.dist(o.x, o.y, en.x, en.y) < en.r + o.r) {
          var mult = (en.type === 'warden' && en.vuln <= 0) ? 0.22 : 1;
          en.hp -= o.dmg * mult;
          en.flash = 0.18;
          en.fvx += o.vx * 0.06;
          en.fvy += o.vy * 0.06;
          game.burst(o.x, o.y, '#ffd9a0', 10, 200);
          game.shake(3);
          A.sfx.hit();
          if (en.hp <= 0) killEnemy(en, o.x, o.y);
          if (o.pierce > 0) { o.pierce--; }
          else { hitSomething = true; }
          break;
        }
      }
      if (hitSomething) game.shards.splice(i, 1);
    }

    for (i = game.pickups.length - 1; i >= 0; i--) {
      o = game.pickups[i];
      o.life -= dt;
      if (o.life <= 0) { game.pickups.splice(i, 1); continue; }
      fieldAccel(o, dt, 0.9, 2.4);
      o.x += o.vx * dt; o.y += o.vy * dt;
      o.vx *= Math.pow(0.9, dt * 60);
      o.vy *= Math.pow(0.9, dt * 60);
      if (U.dist(o.x, o.y, p.x, p.y) < p.bodyR() + o.r) {
        if (o.kind === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + 24);
          p.hunger = Math.max(0, p.hunger - 3);
          game.floatText(o.x, o.y, '+24', '#6ef7a5');
          A.sfx.pickup();
        } else {
          p.mass += 14;
          p.hunger = 0;
          game.floatText(o.x, o.y, '+14', '#ffc861');
          A.sfx.eat(1.2);
        }
        game.pickups.splice(i, 1);
      }
    }

    if (game.ultActive) {
      var ua = game.ultActive;
      ua.t += dt;
      ua.r = U.easeOut(Math.min(1, ua.t / ua.dur)) * ua.max;
      for (var di = game.debris.length - 1; di >= 0; di--) {
        var db = game.debris[di];
        if (U.dist(db.x, db.y, ua.x, ua.y) < ua.r) {
          p.mass += db.mass * 0.6 * p.mods.feedMul;
          p.hunger = 0;
          game.burst(db.x, db.y, '#a06bff', 4, 120);
          game.debris.splice(di, 1);
        }
      }
      if (ua.t >= ua.dur) {
        game.flash(0.85, [0.9, 0.7, 1]);
        game.shake(34);
        game.bonus += 900;
        game.ultActive = null;
        game.timeScale = 1;
      }
    }

    for (i = game.particles.length - 1; i >= 0; i--) {
      var q = game.particles[i];
      q.life -= dt;
      if (q.life <= 0) { game.particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= Math.pow(0.93, dt * 60);
      q.vy *= Math.pow(0.93, dt * 60);
    }
    for (i = game.rings.length - 1; i >= 0; i--) {
      var rg = game.rings[i];
      rg.t += dt;
      rg.r = 10 + U.easeOut(Math.min(1, rg.t / rg.life)) * rg.max;
      if (rg.t >= rg.life) game.rings.splice(i, 1);
    }
    for (i = game.texts.length - 1; i >= 0; i--) {
      var tx = game.texts[i];
      tx.life -= dt;
      tx.y -= 34 * dt;
      if (tx.life <= 0) game.texts.splice(i, 1);
    }

    if (game.comboT > 0) {
      game.comboT -= dt;
      if (game.comboT <= 0) game.combo = 0;
    }

    updateDirector(dt);

    if (!game.pendingPerk && game.state === 'playing' && game.xp >= game.xpNext) {
      game.xp -= game.xpNext;
      game.level++;
      game.xpNext = Math.round(42 + game.level * 26 + Math.pow(game.level, 1.4) * 3);
      openPerk();
    }

    var npp = nearestPlanet(p.x, p.y);
    var pspeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (npp.p && npp.d > npp.p.r * 1.15 && npp.d < npp.p.r * 3.6 && pspeed > 55) {
      game.ult = Math.min(K.ULT_MAX, game.ult + 2.4 * game.mods.orbitMul * game.mods.ultRateMul * dt);
    }
    if (p.mods.ultRateMul > 1 && game.ult < K.ULT_MAX) {
      game.ult = Math.min(K.ULT_MAX, game.ult + 0.9 * game.mods.ultRateMul * dt);
    }

    game.score = Math.floor((game.killScore + game.bonus + p.mass * 1.6 + game.wave * 130 + game.runTime * 4) * game.mods.scoreMul);

    if (p.dead && game.state === 'playing') {
      game.state = 'dying';
      game.deadT = 0;
      game.timeScale = 0.28;
      A.sfx.death();
      game.flash(0.8, [0.6, 0.2, 0.8]);
      game.shake(40);
      game.burst(p.x, p.y, '#c98bff', 90, 460);
      game.ring(p.x, p.y, '#ff4fd8', 700, 1.2);
    }
  }

  function updateDirector(dt) {
    game.waveTimer += dt;
    var newWave = 1 + Math.floor(game.runTime / 22);
    if (newWave !== game.wave) {
      game.wave = newWave;
      game.waveTimer = 0;
      game.bossSpawned = false;
      game.waveBudget = 24 + game.wave * 10 + Math.pow(game.wave, 1.5);
      game.banner('SECTOR ' + game.wave, game.wave % 5 === 0 ? 'A WARDEN IS COMING' : 'THE VOID DEEPENS');
      A.setIntensity(U.clamp((game.wave - 1) / 16, 0, 1));
      A.bpm = Math.min(152, 96 + game.wave * 2.2);
      game.flash(0.18, [0.35, 0.7, 1]);
    }
    if (game.waveBudget > 0) {
      game.spawnAcc += dt;
      var interval = Math.max(0.16, 0.85 - game.wave * 0.03);
      if (game.spawnAcc >= interval) {
        game.spawnAcc = 0;
        var type = pickSpawnType();
        var def = G.ENEMY_DEF[type];
        if (game.waveBudget >= def.xp * 0.55) {
          spawnEnemy(type, false);
          game.waveBudget -= def.xp;
        }
      }
    }
    if (game.wave % 5 === 0 && !game.bossSpawned && game.waveTimer < 1) {
      game.bossSpawned = true;
      spawnEnemy('warden', false);
    }
    if (game.wave % 5 !== 0) game.bossSpawned = false;
  }

  function pickSpawnType() {
    var w = game.wave;
    var r = Math.random();
    if (w < 2) return 'mote';
    if (w < 4) return r < 0.68 ? 'mote' : 'darter';
    if (w < 6) return r < 0.45 ? 'mote' : r < 0.85 ? 'darter' : 'lancer';
    if (w < 9) return r < 0.38 ? 'mote' : r < 0.68 ? 'darter' : r < 0.93 ? 'lancer' : 'anchor';
    if (w < 13) return r < 0.30 ? 'mote' : r < 0.54 ? 'darter' : r < 0.74 ? 'lancer' : r < 0.9 ? 'anchor' : 'splitter';
    return r < 0.28 ? 'mote' : r < 0.48 ? 'darter' : r < 0.66 ? 'lancer' : r < 0.82 ? 'anchor' : 'splitter';
  }

  function updateCamera(dt) {
    var p = game.player;
    var target = U.clamp(1.0 * Math.pow(K.START_MASS / Math.max(K.START_MASS, p.mass), 0.16), 0.4, 1.0);
    game.cam.zoom += (target - game.cam.zoom) * Math.min(1, dt * 2.4);
    var tx = p.x + p.vx * 0.22;
    var ty = p.y + p.vy * 0.22;
    var k = Math.min(1, dt * 8);
    game.cam.x += (tx - game.cam.x) * k;
    game.cam.y += (ty - game.cam.y) * k;
  }

  function updateHud(force) {
    var p = game.player;
    if (!p) return;
    var d = game.dom, L = game.lastHud;
    var mass = Math.floor(p.mass);
    if (force || L.mass !== mass) { d.hudMass.textContent = mass; L.mass = mass; }
    if (force || L.wave !== game.wave) { d.hudWave.textContent = game.wave; L.wave = game.wave; }
    if (force || L.score !== game.score) { d.hudScore.textContent = U.fmtNum(game.score); L.score = game.score; }
    if (force || L.kills !== game.kills) { d.hudKills.textContent = game.kills; L.kills = game.kills; }
    var t = U.fmtTime(game.runTime);
    if (force || L.time !== t) { d.hudTime.textContent = t; L.time = t; }
    var hpPct = Math.max(0, p.hp / p.maxHp);
    d.barHp.style.width = (hpPct * 100) + '%';
    d.txtHp.textContent = Math.ceil(p.hp) + ' / ' + Math.round(p.maxHp);
    var hunPct = U.clamp(1 - p.hunger / 9, 0, 1);
    d.barHunger.style.width = (hunPct * 100) + '%';
    d.barHunger.parentNode.classList.toggle('starving', p.hunger > 5.5);
    d.txtHunger.textContent = p.hunger > 7.5 ? 'STARVING' : p.hunger > 4.5 ? 'HUNGRY' : 'FED';
    var dashPct = 1 - U.clamp(p.dashCd / (K.DASH_CD * p.mods.dashCdMul), 0, 1);
    d.barDash.style.width = (dashPct * 100) + '%';
    d.txtDash.textContent = dashPct >= 1 ? 'READY' : 'CHARGING';
    var ultPct = game.ult / K.ULT_MAX;
    d.barUlt.style.width = (ultPct * 100) + '%';
    d.txtUlt.textContent = Math.floor(ultPct * 100) + '%';
    show(d.ultPrompt, ultPct >= 1 && !game.ultActive && game.state === 'playing');
    if (game.combo >= 3) {
      show(d.combo, true);
      if (L.combo !== game.combo) {
        d.combo.innerHTML = '<b>x' + game.combo + '</b><span>FEEDING FRENZY</span>';
        L.combo = game.combo;
      }
      d.combo.style.opacity = Math.min(1, game.comboT / 1.2);
    } else {
      show(d.combo, false);
      L.combo = -1;
    }
    var boss = null;
    for (var i = 0; i < game.enemies.length; i++) {
      if (game.enemies[i].boss && game.enemies[i].alive) { boss = game.enemies[i]; break; }
    }
    show(d.bossBar, !!boss);
    if (boss) {
      d.bossName.textContent = 'WARDEN';
      d.bossFill.style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
    }
  }

  function renderGame(ctx) {
    var cam = game.cam, zoom = cam.zoom;
    R.drawNebula(ctx, cam);
    R.drawStars(ctx, cam);
    var i, o;
    for (i = 0; i < game.planets.length; i++) R.drawPlanet(ctx, game.planets[i], cam, zoom);
    for (i = 0; i < game.debris.length; i++) R.drawDebris(ctx, game.debris[i], cam, zoom);
    for (i = 0; i < game.pickups.length; i++) R.drawPickup(ctx, game.pickups[i], cam, zoom, R.time);
    for (i = 0; i < game.bolts.length; i++) R.drawBolt(ctx, game.bolts[i], cam, zoom);
    for (i = 0; i < game.enemies.length; i++) R.drawEnemy(ctx, game.enemies[i], cam, zoom, R.time);
    var p = game.player;
    if (p) {
      R.drawPlayer(ctx, p, cam, zoom, R.time);
      for (var s = 0; s < p.satellites.length; s++) {
        var sat = p.satellites[s];
        var sx = (sat.x - cam.x) * zoom + R.W / 2;
        var sy = (sat.y - cam.y) * zoom + R.H / 2;
        R.glow(ctx, 'violet', sx, sy, 40 * zoom, 0.6);
        ctx.fillStyle = '#05010c';
        ctx.beginPath();
        ctx.arc(sx, sy, 8 * zoom, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,120,230,0.7)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    for (i = 0; i < game.shards.length; i++) R.drawShard(ctx, game.shards[i], cam, zoom);
    if (game.ultActive) R.drawUlt(ctx, game.ultActive, cam, zoom);
    for (i = 0; i < game.rings.length; i++) {
      var rg = game.rings[i];
      var a = 1 - rg.t / rg.life;
      var rx = (rg.x - cam.x) * zoom + R.W / 2;
      var ry = (rg.y - cam.y) * zoom + R.H / 2;
      ctx.strokeStyle = U.rgba(rg.c, a * 0.75);
      ctx.lineWidth = Math.max(1, 3 * a * zoom);
      ctx.beginPath();
      ctx.arc(rx, ry, rg.r * zoom, 0, U.TAU);
      ctx.stroke();
    }
    R.drawParticles(ctx, game.particles, cam, zoom);
    R.drawFloatingText(ctx, game.texts, cam, zoom);
  }

  function renderTitle(ctx) {
    var t = game.attractT;
    var pl = game.attractPlanet;
    var cam = game.attractCam;
    R.drawNebula(ctx, cam);
    R.drawStars(ctx, cam);
    if (pl) {
      R.drawPlanet(ctx, pl, cam, cam.zoom);
      var ang = t * 0.55;
      var ox = pl.x + Math.cos(ang) * (pl.r * 2.15);
      var oy = pl.y + Math.sin(ang) * (pl.r * 2.15);
      var fake = {
        x: ox, y: oy, bodyR: function () { return 34; },
        captureR: function () { return 140; }, phase: t * 2, spin: t * 1.2, iframe: 0
      };
      R.drawPlayer(ctx, fake, cam, cam.zoom, t);
      for (var w = 0; w < 11; w++) {
        var wa = t * (0.55 + w * 0.045) + w * 1.3;
        var wr = pl.r * (1.85 + w * 0.085);
        var wx = pl.x + Math.cos(wa) * wr;
        var wy = pl.y + Math.sin(wa) * wr * 0.97;
        var px = (wx - cam.x) * cam.zoom + R.W / 2;
        var py = (wy - cam.y) * cam.zoom + R.H / 2;
        var sz = (3.5 + (w % 4) * 2.2) * cam.zoom;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(wa * 2.3);
        ctx.fillStyle = w % 3 === 0 ? '#8fb6d8' : w % 3 === 1 ? '#7e6690' : '#6f8479';
        ctx.beginPath();
        ctx.moveTo(sz, 0); ctx.lineTo(-sz * 0.7, sz * 0.8);
        ctx.lineTo(-sz * 0.4, 0); ctx.lineTo(-sz * 0.7, -sz * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      for (var i = 0; i < 7; i++) {
        var aa = t * (0.9 + i * 0.17) + i;
        var rr = pl.r * (1.9 + i * 0.11);
        var dx = pl.x + Math.cos(aa) * rr;
        var dy = pl.y + Math.sin(aa) * rr * 0.98;
        var px2 = (dx - cam.x) * cam.zoom + R.W / 2;
        var py2 = (dy - cam.y) * cam.zoom + R.H / 2;
        ctx.fillStyle = 'rgba(180,200,225,0.75)';
        ctx.beginPath();
        ctx.arc(px2, py2, (4 + (i % 3)) * cam.zoom, 0, U.TAU);
        ctx.fill();
      }
    }
    cam.x = Math.cos(t * 0.06) * 340;
    cam.y = Math.sin(t * 0.05) * 260;
  }

  function postState() {
    var p = game.player;
    var cx = R.W / 2, cy = R.H / 2;
    var lens = 0.05, aberr = 1, bloom = 0.95, danger = 0;
    if (p && game.state !== 'title') {
      var hpf = p.hp / p.maxHp;
      if (hpf < 0.38) danger = (1 - hpf / 0.38) * (0.4 + 0.22 * Math.sin(R.time * 7));
      cx = (p.x - game.cam.x) * game.cam.zoom + R.W / 2;
      cy = (p.y - game.cam.y) * game.cam.zoom + R.H / 2;
      lens = 0.05 + Math.min(0.22, p.mass / 5200) + (game.ultActive ? 0.5 : 0);
      aberr = 1 + game.shakeAmt * 0.05 + (p.iframe > 0 ? 0.6 : 0);
      bloom = 0.95 + (game.ultActive ? 0.5 : 0) + Math.min(0.4, p.mass / 9000);
    } else {
      lens = 0.07;
    }
    return { centerX: cx, centerY: cy, lens: lens, aberr: aberr, bloom: bloom, danger: danger };
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (!game.last) game.last = ts;
    var raw = (ts - game.last) / 1000;
    game.last = ts;
    if (raw > 0.1) raw = 0.1;
    R.time += raw;

    if (game.state === 'playing' || game.state === 'dying') {
      var dt = raw * game.timeScale;
      if (game.state === 'dying') {
        game.deadT += raw;
        game.timeScale = Math.min(1, game.timeScale + raw * 0.5);
        dt = raw * game.timeScale;
        if (game.deadT > 1.5) { finishRun(); }
      }
      if (game.state !== 'perk') {
        updateWorld(dt);
        updateCamera(raw);
      }
      if (G.Input.hit('q')) startUlt();
    } else if (game.state === 'title') {
      game.attractT += raw;
      game.attractCam.zoom = 0.62 + Math.sin(game.attractT * 0.13) * 0.07;
    }

    game.shakeAmt *= Math.pow(0.0025, raw);
    if (game.shakeAmt < 0.05) game.shakeAmt = 0;
    game.flashAmt *= Math.pow(0.0009, raw);
    if (game.flashAmt < 0.002) game.flashAmt = 0;
    R.flash = game.flashAmt;
    R.flashColor = game.flashColor;

    var ctx = R.begin();
    var shx = 0, shy = 0;
    if (game.shakeAmt > 0.05) {
      shx = (Math.random() - 0.5) * game.shakeAmt * 2;
      shy = (Math.random() - 0.5) * game.shakeAmt * 2;
    }
    ctx.save();
    ctx.translate(shx, shy);
    if (game.state === 'title') renderTitle(ctx);
    else renderGame(ctx);
    ctx.restore();

    R.present(postState());
    if (game.state === 'playing' || game.state === 'dying') updateHud(false);
    G.Input.endFrame();
  }

  function finishRun() {
    game.state = 'gameover';
    var score = game.score;
    var echoes = Math.floor(score / 90 * game.mods.echoMul);
    Save.data.echoes += echoes;
    Save.data.runs = (Save.data.runs || 0) + 1;
    if (score > (Save.data.best || 0)) Save.data.best = score;
    if (game.wave > (Save.data.bestWave || 0)) Save.data.bestWave = game.wave;
    Save.save();
    game.dom.goTitle.textContent = 'COLLAPSED';
    game.dom.goSub.textContent = 'Your singularity dispersed across ' + game.wave + ' sector' + (game.wave > 1 ? 's' : '') + '.';
    var stats = [
      ['SCORE', U.fmtNum(score)],
      ['SECTOR', game.wave],
      ['KILLS', game.kills],
      ['MASS', Math.floor(game.player.mass)],
      ['TIME', U.fmtTime(game.runTime)],
      ['LEVEL', game.level]
    ];
    var html = '';
    for (var i = 0; i < stats.length; i++) {
      html += '<div class="go-stat"><span class="k">' + stats[i][0] + '</span><span class="v">' + stats[i][1] + '</span></div>';
    }
    game.dom.goStats.innerHTML = html;
    game.dom.goEchoes.innerHTML = 'ECHOES HARVESTED: <b>+' + echoes + '</b>';
    show(game.dom.gameover, true);
    show(game.dom.hud, false);
    refreshMeta();
  }

  function refreshMeta() {
    game.dom.bestScore.textContent = U.fmtNum(Save.data.best || 0);
    game.dom.bestWave.textContent = Save.data.bestWave ? String(Save.data.bestWave) : '—';
    game.dom.echoCount.textContent = Save.data.echoes || 0;
    game.dom.metaEchoes.textContent = Save.data.echoes || 0;
    var list = game.dom.metaList;
    list.innerHTML = '';
    for (var i = 0; i < G.META.length; i++) {
      (function (def) {
        var lv = Save.data.meta[def.id] || 0;
        var cost = Math.round(def.base * (1 + lv * 0.65));
        var el = document.createElement('div');
        el.className = 'meta-item';
        var can = (Save.data.echoes || 0) >= cost && lv < def.max;
        el.innerHTML = '<div><div class="mi-name">' + def.name + '</div>' +
          '<div class="mi-desc">' + def.desc + '</div>' +
          '<div class="mi-lv">RANK ' + lv + ' / ' + def.max + '</div></div>';
        var btn = document.createElement('button');
        btn.className = 'buy';
        btn.textContent = lv >= def.max ? 'MAX' : cost + ' E';
        btn.disabled = !can;
        btn.onclick = function () {
          if ((Save.data.echoes || 0) < cost || lv >= def.max) return;
          Save.data.echoes -= cost;
          Save.data.meta[def.id] = lv + 1;
          Save.save();
          A.sfx.ui();
          refreshMeta();
        };
        el.appendChild(btn);
        list.appendChild(el);
      })(G.META[i]);
    }
  }

  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'pause';
    game.dom.pauseSub.textContent = 'Sector ' + game.wave + ' · ' + U.fmtNum(game.score) + ' points · ' + U.fmtTime(game.runTime);
    show(game.dom.pause, true);
  }
  function resumeGame() {
    if (game.state !== 'pause') return;
    game.state = 'playing';
    show(game.dom.pause, false);
  }

  function bindUi() {
    game.dom.btnPlay.onclick = function () { A.resume(); A.sfx.ui(); startRun(game.dom.seedInput.value.trim()); };
    game.dom.btnMeta.onclick = function () { A.resume(); A.sfx.ui(); refreshMeta(); show(game.dom.meta, true); show(game.dom.title, false); };
    game.dom.btnHow.onclick = function () { A.resume(); A.sfx.ui(); show(game.dom.how, true); show(game.dom.title, false); };
    game.dom.btnSeed.onclick = function () { game.dom.seedInput.value = U.makeSeed(); A.sfx.ui(); };
    game.dom.btnDaily.onclick = function () { game.dom.seedInput.value = U.dailySeed(); A.sfx.ui(); };
    game.dom.btnResume.onclick = function () { A.sfx.ui(); resumeGame(); };
    game.dom.btnAbort.onclick = function () {
      A.sfx.ui();
      game.state = 'title';
      show(game.dom.pause, false);
      show(game.dom.hud, false);
      show(game.dom.title, true);
      refreshMeta();
    };
    game.dom.btnRetry.onclick = function () { A.sfx.ui(); startRun(game.seed); };
    game.dom.btnTitle.onclick = function () {
      A.sfx.ui();
      game.state = 'title';
      show(game.dom.gameover, false);
      show(game.dom.hud, false);
      show(game.dom.title, true);
      refreshMeta();
    };
    var closers = document.querySelectorAll('[data-close]');
    for (var i = 0; i < closers.length; i++) {
      closers[i].onclick = function () {
        A.sfx.ui();
        var id = this.getAttribute('data-close');
        show($(id), false);
        if (game.state === 'title') show(game.dom.title, true);
      };
    }
    game.dom.seedInput.value = U.dailySeed();

    window.addEventListener('keydown', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === 'Escape' || k === 'p') {
        if (game.state === 'playing') pauseGame();
        else if (game.state === 'pause') resumeGame();
      }
      if (k === 'm') {
        A.setMuted(!A.muted);
        Save.data.muted = A.muted;
        Save.save();
        game.toast(A.muted ? 'AUDIO MUTED' : 'AUDIO ON');
      }
      if (k === 'Enter' && game.state === 'title') {
        A.resume(); startRun(game.dom.seedInput.value.trim());
      }
      if (game.state === 'perk' && (k === '1' || k === '2' || k === '3')) {
        choosePerk(parseInt(k, 10) - 1);
      }
    });

    window.addEventListener('blur', function () { if (game.state === 'playing') pauseGame(); });

    game.dom.view.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      if (game.state !== 'playing') return;
      if (G.Input.mouse.moved) {
        var p = game.player;
        var dx = G.Input.mouse.x - ((p.x - game.cam.x) * game.cam.zoom + R.W / 2);
        var dy = G.Input.mouse.y - ((p.y - game.cam.y) * game.cam.zoom + R.H / 2);
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          game.player.dirX = dx;
          game.player.dirY = dy;
          game.mouseDash = true;
        }
      }
    });
    game.dom.view.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });

    if (G.Input.isTouch) {
      show(game.dom.touch, true);
      setupTouch();
    }
  }

  function setupTouch() {
    var stick = game.dom.stick, knob = game.dom.stickKnob;
    var active = null, cx = 0, cy = 0;
    function start(t) {
      var r = stick.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      active = t.identifier;
      move(t);
    }
    function move(t) {
      var dx = t.clientX - cx, dy = t.clientY - cy;
      var len = Math.sqrt(dx * dx + dy * dy);
      var max = 48;
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      game.touchVec = { x: dx / max, y: dy / max };
    }
    function end() {
      active = null; knob.style.transform = 'translate(0,0)';
      game.touchVec = { x: 0, y: 0 };
    }
    stick.addEventListener('touchstart', function (e) {
      e.preventDefault();
      var t = e.changedTouches[0];
      start(t);
      stick._move = function (ev) { ev.preventDefault(); move(ev.changedTouches[0]); };
    }, { passive: false });
    stick.addEventListener('touchmove', function (e) {
      e.preventDefault();
      move(e.changedTouches[0]);
    }, { passive: false });
    stick.addEventListener('touchend', function (e) { e.preventDefault(); end(); });
    stick.addEventListener('touchcancel', end);
    game.dom.btnDash.addEventListener('touchstart', function (e) {
      e.preventDefault(); A.resume(); if (game.player) game.player.dash(game);
    }, { passive: false });
    game.dom.btnUlt.addEventListener('touchstart', function (e) {
      e.preventDefault(); A.resume(); startUlt();
    }, { passive: false });
  }

  function init() {
    cacheDom();
    Save.load();
    R.init(game.dom.view);
    G.Input.init(game.dom.view);
    bindUi();
    refreshMeta();
    var rng = new U.RNG(4242);
    game.attractPlanet = new G.Planet(0, 0, 190, rng.pick([G.__proto__ ? null : null]) || { tint: '#4f9bd8', core: '#bfe4ff', mid: '#2f6ea8', edge: '#0d1a2c', band: '#8fd3ff' }, rng);
    game.attractPlanet.moons = [];
    show(game.dom.loading, false);
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.G = window.G || {});
