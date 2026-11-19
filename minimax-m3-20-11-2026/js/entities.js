(function (G) {
  'use strict';
  var U = G.U;

  var K = (G.K = {
    MOVE_ACCEL: 1500,
    FRICTION: 2.55,
    MAX_SPEED: 455,
    DASH_IMPULSE: 780,
    DASH_CD: 1.25,
    DASH_IFRAME: 0.26,
    FIELD_K: 1420,
    PLANET_G: 330,
    START_MASS: 60,
    CRUSH_RATIO: 0.55,
    BASE_CAPTURE: 88,
    BASE_BODY: 22,
    MAX_HP: 110,
    ULT_MAX: 100
  });

  function randPoly(rng, n, rough) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * U.TAU + rng.f(-0.18, 0.18);
      var r = rng.f(1 - rough, 1 + rough);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  function pickTone(rng) {
    var sets = [
      { base: '#3a4358', lit: '#6d7a95', dark: '#141a28', edge: '#8fb6d8' },
      { base: '#4a3b56', lit: '#7e6690', dark: '#1b1424', edge: '#c79ae0' },
      { base: '#3d4a44', lit: '#6f8479', dark: '#141c18', edge: '#8fd9b8' },
      { base: '#4d4234', lit: '#87735a', dark: '#1c1710', edge: '#e0b578' },
      { base: '#333a4c', lit: '#5f6a86', dark: '#10131c', edge: '#9fb6ff' }
    ];
    return rng.pick(sets);
  }

  G.Debris = function (x, y, rng, big) {
    this.x = x; this.y = y;
    this.vx = rng.f(-24, 24); this.vy = rng.f(-24, 24);
    this.rot = rng.f(0, U.TAU);
    this.spin = rng.f(-0.7, 0.7);
    this.big = !!big;
    this.mass = big ? rng.f(32, 74) : rng.f(1.5, 6);
    this.r = big ? rng.f(15, 26) : rng.f(4.5, 10.5);
    this.pts = randPoly(rng, big ? 8 : 6, big ? 0.34 : 0.26);
    var tone = pickTone(rng);
    this.base = tone.base; this.lit = tone.lit; this.dark = tone.dark; this.edge = tone.edge;
    this.alive = true;
  };

  G.Bolt = function (x, y, vx, vy, dmg, tint) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dmg = dmg; this.r = 5; this.life = 7; this.alive = true;
    this.tint = tint || 'red';
  };

  G.Shard = function (x, y, vx, vy, mass, dmg, tint, glowKey) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.mass = mass; this.dmg = dmg; this.r = Math.max(3, Math.min(16, 3 + mass * 0.22));
    this.rot = Math.atan2(vy, vx);
    this.spin = U.rand(-7, 7);
    this.life = 4.5; this.pierce = 0; this.alive = true;
    this.tint = tint || '#ffd9a0'; this.glowKey = glowKey || 'amber';
  };

  G.Pickup = function (x, y, kind) {
    this.x = x; this.y = y; this.vx = U.rand(-30, 30); this.vy = U.rand(-30, 30);
    this.kind = kind; this.r = 7; this.ph = U.rand(0, 6.28); this.life = 14; this.alive = true;
  };

  var ENEMY_DEF = {
    mote: { hp: 9, r: 8, mass: 6, speed: 190, accel: 470, dmg: 8, contact: 0.9, xp: 4, score: 30 },
    darter: { hp: 16, r: 10, mass: 14, speed: 300, accel: 1050, dmg: 11, contact: 0.8, xp: 7, score: 55 },
    lancer: { hp: 46, r: 14, mass: 62, speed: 195, accel: 400, dmg: 13, contact: 1.0, xp: 14, score: 110, shoot: 2.1 },
    anchor: { hp: 130, r: 22, mass: 260, speed: 96, accel: 210, dmg: 20, contact: 1.4, xp: 34, score: 300, resist: 1 },
    splitter: { hp: 74, r: 16, mass: 46, speed: 158, accel: 430, dmg: 12, contact: 1.0, xp: 20, score: 165 },
    warden: { hp: 820, r: 46, mass: 900, speed: 118, accel: 220, dmg: 22, contact: 1.8, xp: 140, score: 1800, resist: 1, boss: true }
  };

  G.ENEMY_DEF = ENEMY_DEF;

  G.Enemy = function (x, y, type, wave, rng) {
    var d = ENEMY_DEF[type];
    this.type = type;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.fvx = 0; this.fvy = 0;
    this.r = d.r; this.mass = d.mass;
    var hpScale = d.boss ? 1 + Math.max(0, wave - 5) * 0.3 : 1 + Math.max(0, wave - 1) * 0.17;
    this.hp = d.hp * hpScale; this.maxHp = this.hp;
    this.speed = d.speed * (1 + Math.min(wave, 16) * 0.028);
    this.accel = d.accel;
    this.dmg = d.dmg * (1 + Math.max(0, wave - 1) * 0.055);
    this.contact = d.contact;
    this.xp = d.xp; this.score = d.score;
    this.shootCd = d.shoot ? rng.f(0.6, d.shoot) : 0;
    this.resist = d.resist || 0;
    this.boss = !!d.boss;
    this.rot = rng.f(0, U.TAU);
    this.flash = 0;
    this.vuln = 0;
    this.vulnT = 0;
    this.stagger = 0;
    this.dashCd = 0;
    this.captured = false;
    this.phase = rng.f(0, 6.28);
    this.alive = true;
    this.spawnT = 0.55;
    this.strafe = rng.chance(0.5) ? 1 : -1;
    this.strafeT = rng.f(0.8, 2.4);
    if (this.boss) { this.vulnT = 3.2; this.vuln = 0; this.shootCd = 2.2; }
  };

  G.Planet = function (x, y, r, tone, rng) {
    this.x = x; this.y = y; this.r = r;
    this.mass = r * r * 1.05;
    this.tint = tone.tint; this.core = tone.core; this.mid = tone.mid; this.edge = tone.edge;
    this.band = tone.band;
    this.ring = rng.chance(0.35);
    this.moons = [];
    if (rng.chance(0.5)) {
      var n = rng.i(1, 2);
      for (var i = 0; i < n; i++) {
        this.moons.push({ d: r * rng.f(1.6, 2.4), r: rng.f(3, 7), sp: rng.f(0.05, 0.16) * (rng.chance(0.5) ? 1 : -1), ph: rng.f(0, 6.28) });
      }
    }
  };

  var PLANET_TONES = [
    { tint: '#4f9bd8', core: '#bfe4ff', mid: '#2f6ea8', edge: '#0d1a2c', band: '#8fd3ff' },
    { tint: '#c06bd8', core: '#f3ccff', mid: '#8a3f9e', edge: '#1c0d26', band: '#ff9ff0' },
    { tint: '#4fd8a8', core: '#c4ffe9', mid: '#2a9470', edge: '#0b2019', band: '#7effd0' },
    { tint: '#e0a35a', core: '#ffe0b0', mid: '#a06a2c', edge: '#221607', band: '#ffcf8a' },
    { tint: '#7a8fe0', core: '#d5ddff', mid: '#4351a8', edge: '#0e1130', band: '#aebdff' }
  ];

  G.genPlanets = function (rng) {
    var out = [];
    var n = 15;
    for (var k = 0; k < n; k++) {
      var ang = k * 2.39996 + rng.f(-0.25, 0.25);
      var rad = 780 + 250 * Math.sqrt(k) + rng.f(-90, 90);
      var pr = rng.f(140, 275);
      out.push(new G.Planet(Math.cos(ang) * rad, Math.sin(ang) * rad, pr, rng.pick(PLANET_TONES), rng));
    }
    return out;
  };

  G.Player = function (x, y, mods) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.mass = mods.startMass;
    this.hp = mods.maxHp;
    this.maxHp = mods.maxHp;
    this.mods = mods;
    this.spin = 0;
    this.phase = 0;
    this.iframe = 0;
    this.dashCd = 0;
    this.dashT = 0;
    this.dirX = 1; this.dirY = 0;
    this.ult = 0;
    this.dead = false;
    this.hunger = 0;
    this.starving = false;
    this.sinceHit = 0;
    this.satellites = [];
    this.satCd = 0;
    this.orbitCharge = 0;
    this.recoil = 0;
  };

  G.Player.prototype.bodyR = function () {
    return K.BASE_BODY + 9.5 * Math.log(1 + (this.mass - K.START_MASS) / 60);
  };
  G.Player.prototype.captureR = function () {
    var m = this.mods;
    return K.BASE_CAPTURE * m.captureMul * Math.pow(this.mass / K.START_MASS, 0.13);
  };
  G.Player.prototype.crushT = function () {
    return 24 * Math.pow(this.mass / K.START_MASS, 0.5) * this.mods.crushMul;
  };
  G.Player.prototype.maxSpeed = function () {
    return K.MAX_SPEED * this.mods.speedMul * Math.pow(K.START_MASS / this.mass, 0.22);
  };

  G.Player.prototype.update = function (dt, g) {
    var inp = g.inputDir();
    this.spin += dt * (1.4 + this.mass / 220);
    this.phase += dt * 1.9;
    if (this.iframe > 0) this.iframe -= dt;
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.dashT > 0) this.dashT -= dt;
    if (this.recoil > 0) this.recoil -= dt;
    this.hunger += dt;
    this.sinceHit += dt;
    if (this.sinceHit > 7 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 2.2 * dt);
    }
    if (this.hunger > 4.5) {
      this.mass = Math.max(K.START_MASS * 0.35, this.mass * (1 - 0.028 * dt));
    }
    this.starving = this.hunger > 7.5;

    if (inp.x || inp.y) {
      this.dirX = inp.x; this.dirY = inp.y;
      var acc = K.MOVE_ACCEL * this.mods.speedMul * Math.pow(K.START_MASS / this.mass, 0.42);
      this.vx += inp.x * acc * dt;
      this.vy += inp.y * acc * dt;
    }

    var fr = Math.pow(Math.exp(-K.FRICTION), dt);
    this.vx *= fr; this.vy *= fr;

    var pl = g.planets;
    for (var i = 0; i < pl.length; i++) {
      var p = pl[i];
      var dx = p.x - this.x, dy = p.y - this.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var ad = Math.max(d, p.r * 0.9);
      var a = K.PLANET_G * p.mass / (ad * ad);
      this.vx += (dx / d) * a * dt;
      this.vy += (dy / d) * a * dt;
      var minD = p.r + this.bodyR() * 0.8;
      if (d < minD) {
        var nx = dx / d, ny = dy / d;
        this.x = p.x + nx * minD;
        this.y = p.y + ny * minD;
        var vn = this.vx * nx + this.vy * ny;
        if (vn < 0) { this.vx -= vn * nx * 1.4; this.vy -= vn * ny * 1.4; }
      }
    }

    var ms = this.maxSpeed();
    var sp = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (sp > ms) { this.vx = this.vx / sp * ms; this.vy = this.vy / sp * ms; }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    var cr = this.captureR();
    for (var s = 0; s < this.satellites.length; s++) {
      var sat = this.satellites[s];
      sat.a += sat.sp * dt;
      sat.x = this.x + Math.cos(sat.a) * sat.dist;
      sat.y = this.y + Math.sin(sat.a) * sat.dist;
      var rr = 34 * this.mods.captureMul;
      for (var di = 0; di < g.debris.length; di++) {
        var d2 = g.debris[di];
        var ddx = sat.x - d2.x, ddy = sat.y - d2.y;
        var dd = Math.sqrt(ddx * ddx + ddy * ddy);
        if (dd < rr * 1.5) {
          var resp = U.clamp(12 / d2.mass, 0.25, 1.6);
          var aa = 520 * resp / (1 + (dd / rr) * (dd / rr));
          d2.vx += (ddx / (dd || 1)) * aa * dt;
          d2.vy += (ddy / (dd || 1)) * aa * dt;
        }
      }
    }
    if (this.mods.satellites > this.satellites.length && this.satCd <= 0) {
      this.satellites.push({ a: U.rand(0, 6.28), dist: 62, sp: 1.5, x: this.x, y: this.y });
      this.satCd = 0.5;
    }
    if (this.satCd > 0) this.satCd -= dt;
  };

  G.Player.prototype.damage = function (amt, g) {
    if (this.dead) return;
    if (this.iframe > 0) return;
    if (this.mods.phase > 0 && Math.random() < this.mods.phase) {
      g.floatText(this.x, this.y - 30, 'PHASE', '#6ef7a5');
      return;
    }
    this.hp -= amt;
    this.iframe = 0.85;
    this.sinceHit = 0;
    if (g) { if (g.combo > 2) g.floatText(this.x, this.y - 34, 'COMBO LOST', '#ff5a6e'); g.combo = 0; g.comboT = 0; }
    if (g && g.player) {
      var dd = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
      this.vx -= (this.vx / dd) * 60;
      this.vy -= (this.vy / dd) * 60;
    }
    g.shake(7 + amt * 0.25);
    g.flash(0.22, [1, 0.22, 0.3]);
    G.Audio.sfx.hit();
    g.burst(this.x, this.y, '#ff5a6e', 12, 180);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  };

  G.Player.prototype.starve = function (amt) {
    if (this.dead) return;
    this.hp -= amt;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  };

  G.Player.prototype.dash = function (g) {
    if (this.dashCd > 0 || this.dead) return;
    var inp = g.inputDir();
    var dx = inp.x || this.dirX, dy = inp.y || this.dirY;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= len; dy /= len;
    this.dirX = dx; this.dirY = dy;
    var imp = K.DASH_IMPULSE * this.mods.dashDistMul * Math.pow(K.START_MASS / this.mass, 0.2);
    this.vx += dx * imp;
    this.vy += dy * imp;
    this.iframe = Math.max(this.iframe, K.DASH_IFRAME);
    this.dashT = 0.22;
    this.dashCd = K.DASH_CD * this.mods.dashCdMul;
    g.shake(9);
    g.flingShards(this, dx, dy);
    G.Audio.sfx.dash();
    g.ring(this.x, this.y, '#5ef0ff', 60, 0.4);
  };

  G.Satellite = function (a, dist) {
    this.a = a; this.dist = dist; this.sp = 1.5; this.x = 0; this.y = 0;
  };

  G.PERKS = [
    {
      id: 'eventHorizon', name: 'EVENT HORIZON', icon: '◉', tier: 'COMMON', weight: 10,
      desc: 'Your capture radius expands by 30%. More of the void answers to you.',
      apply: function (m) { m.captureMul *= 1.30; }
    },
    {
      id: 'graviton', name: 'GRAVITON LENS', icon: '◈', tier: 'COMMON', weight: 10,
      desc: 'Gravity strength +40%. Matter accelerates into your orbit.',
      apply: function (m) { m.pullMul *= 1.40; }
    },
    {
      id: 'kinetic', name: 'KINETIC CHARGE', icon: '⟡', tier: 'COMMON', weight: 10,
      desc: 'Dash cooldown −35% and dash force +20%. Slingshot faster.',
      apply: function (m) { m.dashCdMul *= 0.65; m.dashDistMul *= 1.20; }
    },
    {
      id: 'denseShrapnel', name: 'DENSE SHRAPNEL', icon: '✦', tier: 'COMMON', weight: 9,
      desc: 'Flung debris deals 75% more damage. Mass is ammunition.',
      apply: function (m) { m.dmgMul *= 1.75; }
    },
    {
      id: 'feeding', name: 'FEEDING FRENZY', icon: '◐', tier: 'COMMON', weight: 9,
      desc: 'Devoured mass yields +55%. The void is generous.',
      apply: function (m) { m.feedMul *= 1.55; }
    },
    {
      id: 'denseCore', name: 'DENSE CORE', icon: '⬢', tier: 'COMMON', weight: 9,
      desc: '+35 maximum integrity, restored instantly.',
      apply: function (m) { m.maxHpAdd += 35; }
    },
    {
      id: 'volley', name: 'SPLINTER VOLLEY', icon: '⋔', tier: 'RARE', weight: 6,
      desc: 'Dash flings twice as much shrapnel from your field.',
      apply: function (m) { m.volleyMul *= 2; }
    },
    {
      id: 'ricochet', name: 'RICOCHET', icon: '➤', tier: 'RARE', weight: 6,
      desc: 'Shrapnel punches through 2 additional targets.',
      apply: function (m) { m.pierce += 2; }
    },
    {
      id: 'predator', name: 'PREDATORY VACUUM', icon: '❖', tier: 'RARE', weight: 6,
      desc: 'Every kill restores 6 integrity.',
      apply: function (m) { m.healOnKill += 6; }
    },
    {
      id: 'orbital', name: 'ORBITAL HARVEST', icon: '⊛', tier: 'RARE', weight: 6,
      desc: 'Orbiting a planet charges your Event Horizon 3× faster.',
      apply: function (m) { m.orbitMul *= 3; }
    },
    {
      id: 'superluminous', name: 'SUPERLUMINOUS', icon: '✸', tier: 'RARE', weight: 5,
      desc: 'Event Horizon is 45% larger and charges 30% faster.',
      apply: function (m) { m.ultRadiusMul *= 1.45; m.ultRateMul *= 1.30; }
    },
    {
      id: 'tidal', name: 'TIDAL PULL', icon: '≈', tier: 'RARE', weight: 6,
      desc: 'Enemies are 45% lighter in your field. They cannot escape.',
      apply: function (m) { m.enemyPullMul *= 1.45; }
    },
    {
      id: 'phase', name: 'PHASE SHELL', icon: '◊', tier: 'EPIC', weight: 4,
      desc: '28% chance to phase straight through any damage.',
      apply: function (m) { m.phase += 0.28; }
    },
    {
      id: 'midas', name: 'MIDAS FIELD', icon: '◆', tier: 'EPIC', weight: 4,
      desc: 'Kills have a high chance to drop condensed mass worth 14.',
      apply: function (m) { m.dropMul += 0.34; }
    },
    {
      id: 'cataclysm', name: 'CATACLYSM', icon: '✷', tier: 'EPIC', weight: 4,
      desc: 'Dash releases a shockwave that damages and staggers foes.',
      apply: function (m) { m.shockwave = true; }
    },
    {
      id: 'twin', name: 'TWIN HORIZON', icon: '◍', tier: 'EPIC', weight: 4,
      desc: 'A miniature singularity orbits you, hauling in debris.',
      apply: function (m) { m.satellites += 1; }
    }
  ];

  G.META = [
    {
      id: 'reinforced', name: 'REINFORCED SHELL', desc: '+20 maximum integrity per rank.',
      base: 22, max: 6, apply: function (m, l) { m.maxHpAdd += 20 * l; }
    },
    {
      id: 'dense', name: 'DENSE MATTER', desc: '+14% starting mass per rank.',
      base: 26, max: 6, apply: function (m, l) { m.startMass *= 1 + 0.14 * l; }
    },
    {
      id: 'field', name: 'TIGHTER FIELD', desc: '+9% capture radius per rank.',
      base: 32, max: 6, apply: function (m, l) { m.captureMul *= 1 + 0.09 * l; }
    },
    {
      id: 'dash', name: 'QUICK CHARGE', desc: '−9% dash cooldown per rank.',
      base: 32, max: 6, apply: function (m, l) { m.dashCdMul *= Math.pow(0.91, l); }
    },
    {
      id: 'resonance', name: 'RESONANCE', desc: '+14% Event Horizon charge rate per rank.',
      base: 40, max: 5, apply: function (m, l) { m.ultRateMul *= 1 + 0.14 * l; }
    },
    {
      id: 'grip', name: 'VOID GRIP', desc: '+8% gravity strength per rank.',
      base: 30, max: 6, apply: function (m, l) { m.pullMul *= 1 + 0.08 * l; }
    },
    {
      id: 'swift', name: 'SWIFT COLLAPSE', desc: '+7% thrust authority per rank.',
      base: 26, max: 6, apply: function (m, l) { m.speedMul *= 1 + 0.07 * l; }
    },
    {
      id: 'scavenger', name: 'SCAVENGER', desc: '+18% echoes harvested per rank.',
      base: 30, max: 6, apply: function (m, l) { m.echoMul *= 1 + 0.18 * l; }
    }
  ];

  G.defaultMods = function (metaLevels) {
    var m = {
      startMass: K.START_MASS,
      maxHp: K.MAX_HP,
      maxHpAdd: 0,
      captureMul: 1,
      pullMul: 1,
      speedMul: 1,
      dashCdMul: 1,
      dashDistMul: 1,
      dmgMul: 1,
      feedMul: 1,
      crushMul: 1,
      volleyMul: 1,
      pierce: 0,
      healOnKill: 0,
      orbitMul: 1,
      ultRateMul: 1,
      ultRadiusMul: 1,
      enemyPullMul: 1,
      phase: 0,
      dropMul: 0,
      shockwave: false,
      satellites: 0,
      echoMul: 1,
      scoreMul: 1
    };
    if (metaLevels) {
      for (var i = 0; i < G.META.length; i++) {
        var def = G.META[i];
        var l = metaLevels[def.id] || 0;
        if (l > 0) def.apply(m, l);
      }
    }
    m.maxHp += m.maxHpAdd;
    return m;
  };
})(window.G = window.G || {});
