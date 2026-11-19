(() => {
  'use strict';

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d', { alpha: false });
  const $ = (id) => document.getElementById(id);
  const ui = {
    home: $('home-screen'),
    homeSound: $('home-sound'),
    homeRecord: $('home-record'),
    start: $('start-button'),
    daily: $('daily-button'),
    dailyDate: $('daily-date'),
    hud: $('hud'),
    timer: $('timer'),
    score: $('score'),
    kills: $('kill-count'),
    health: $('health-fill'),
    healthLabel: $('health-label'),
    ink: $('ink-fill'),
    xp: $('xp-fill'),
    xpLabel: $('xp-label'),
    level: $('level-number'),
    dashReady: $('dash-ready'),
    bossPanel: $('boss-panel'),
    bossFill: $('boss-fill'),
    bossLabel: $('boss-hp-label'),
    toast: $('toast'),
    combo: $('combo-display'),
    comboNumber: $('combo-number'),
    mobileHelp: $('mobile-help'),
    levelScreen: $('level-screen'),
    upgrades: $('upgrade-options'),
    pauseScreen: $('pause-screen'),
    overScreen: $('over-screen'),
    overQuip: $('over-quip'),
    finalTime: $('final-time'),
    finalKills: $('final-kills'),
    finalScore: $('final-score'),
    newRecord: $('new-record'),
    dashTouch: $('dash-touch'),
    sound: $('sound-button')
  };

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const fmtTime = (seconds) => {
    const total = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let mode = 'menu';
  let frameTime = performance.now();
  let ambientTime = 0;
  let lastHudRefresh = 0;
  let toastTimeout = 0;
  let audioContext = null;
  let masterGain = null;
  let soundEnabled = true;
  let random = Math.random;
  let spawnRandom = Math.random;
  let cosmeticRandom = Math.random;
  let pointer = { x: width * 0.65, y: height * 0.5 };
  let stroke = null;
  let joystick = null;
  let stars = [];
  let shake = 0;
  let shakeX = 0;
  let shakeY = 0;
  const keys = new Set();

  const saveKey = 'inkshift-save-v1';
  let saveData = loadSave();

  let run = null;
  let player = null;
  let enemies = [];
  let bullets = [];
  let orbs = [];
  let particles = [];
  let beams = [];
  let rings = [];
  let floatingText = [];
  let echoes = [];

  const upgradeDefinitions = [
    {
      id: 'edge', glyph: '╱', title: 'Sharper by the stroke', max: 5,
      desc: (rank) => `All your spells deal ${(rank + 1) * 22}% more damage in total.`,
      apply: () => { player.upgrades.edge += 1; }
    },
    {
      id: 'aperture', glyph: '◉', title: 'Make room for magic', max: 4,
      desc: (rank) => `Nova grows ${(rank + 1) * 23}% in radius and gains +${(rank + 1) * 4} base damage.`,
      apply: () => { player.upgrades.aperture += 1; }
    },
    {
      id: 'fork', glyph: 'ϟ', title: 'The line goes on', max: 4,
      desc: (rank) => `Chain can reach ${5 + rank} targets and gains +${(rank + 1) * 3} damage per jump.`,
      apply: () => { player.upgrades.fork += 1; }
    },
    {
      id: 'quick', glyph: '⌁', title: 'Quick as a thought', max: 5,
      desc: (rank) => `Regenerate ${(rank + 1) * 1.3} extra ink per second. Cast cooldown shrinks 8% per rank.`,
      apply: () => { player.upgrades.quick += 1; }
    },
    {
      id: 'long', glyph: '⟶', title: 'Write in the margins', max: 4,
      desc: () => 'Lances reach 18% farther per rank, with a wider cutting edge.',
      apply: () => { player.upgrades.long += 1; }
    },
    {
      id: 'carbon', glyph: '〃', title: 'A second opinion', max: 3,
      desc: (rank) => `Every ${Math.max(2, 4 - rank)}th spell echoes at ${55 + rank * 12}% power. Free.`,
      apply: () => { player.upgrades.carbon += 1; }
    },
    {
      id: 'familiar', glyph: '✦', title: 'Hire a tiny genius', max: 3,
      desc: () => 'A little star joins you, automatically zapping nearby monsters.',
      apply: () => { player.upgrades.familiar += 1; }
    },
    {
      id: 'vitality', glyph: '♥', title: 'A little more life', max: 4,
      desc: (rank) => `Gain 18 maximum health and recover 34 health right now.`,
      apply: () => {
        player.upgrades.vitality += 1;
        player.maxHealth += 18;
        player.health = Math.min(player.maxHealth, player.health + 34);
      }
    },
    {
      id: 'blink', glyph: '»', title: 'Leave no shadow', max: 4,
      desc: () => 'Dash recharges 0.28s sooner per rank, with a longer blink of safety.',
      apply: () => { player.upgrades.blink += 1; }
    },
    {
      id: 'magnet', glyph: '⌖', title: 'Keep what you kill', max: 4,
      desc: (rank) => `XP reaches you 53px farther away; fragments are worth ${(rank + 1) * 12}% more in total.`,
      apply: () => { player.upgrades.magnet += 1; }
    }
  ];

  function loadSave() {
    const fresh = { bestTime: 0, bestScore: 0, runs: 0, totalKills: 0, daily: {} };
    try {
      const stored = JSON.parse(localStorage.getItem(saveKey) || 'null');
      if (!stored || typeof stored !== 'object') return fresh;
      return {
        bestTime: Number(stored.bestTime) || 0,
        bestScore: Number(stored.bestScore) || 0,
        runs: Number(stored.runs) || 0,
        totalKills: Number(stored.totalKills) || 0,
        daily: stored.daily && typeof stored.daily === 'object' ? stored.daily : {}
      };
    } catch (_) {
      return fresh;
    }
  }

  function persistSave() {
    try { localStorage.setItem(saveKey, JSON.stringify(saveData)); } catch (_) { /* Private browsing can disable storage. */ }
  }

  function dailyKey(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function dateSeed(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function refreshHomeRecord() {
    const today = dailyKey();
    const dateLabel = new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', timeZone: 'UTC' }).format(new Date()).toUpperCase();
    const todayResult = saveData.daily[today];
    ui.dailyDate.textContent = todayResult && todayResult.score ? `${dateLabel} · ${Number(todayResult.score).toLocaleString()} PB` : dateLabel;
    if (saveData.bestTime > 0 || saveData.bestScore > 0) {
      ui.homeRecord.textContent = `PERSONAL BEST  /  ${fmtTime(saveData.bestTime)} HELD  ·  ${saveData.bestScore.toLocaleString()} POINTS  ·  ${saveData.totalKills.toLocaleString()} INKSLAIN`;
    } else {
      ui.homeRecord.textContent = 'FIRST NIGHT? MAKE IT LEGENDARY.';
    }
  }

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: clamp(Math.floor(width * height / 8500), 65, 190) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.3 + 0.25,
      phase: Math.random() * TAU,
      speed: Math.random() * 1.1 + 0.25,
      alpha: Math.random() * 0.44 + 0.12
    }));
    if (player) {
      player.x = clamp(player.x, 26, width - 26);
      player.y = clamp(player.y, 26, height - 26);
    }
  }

  function initAudio() {
    if (audioContext) {
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      return;
    }
    const AudioClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioClass) return;
    try {
      audioContext = new AudioClass();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.58;
      masterGain.connect(audioContext.destination);
    } catch (_) {
      audioContext = null;
    }
  }

  function tone(frequency, duration, waveform = 'sine', volume = 0.07, slide = 0) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioContext || !masterGain) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const envelope = audioContext.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency + slide), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + Math.min(0.015, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope);
    envelope.connect(masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  function sound(name) {
    if (!soundEnabled) return;
    if (name === 'cast') {
      tone(360, 0.11, 'triangle', 0.055, 260);
    } else if (name === 'nova') {
      tone(240, 0.3, 'sine', 0.085, 560);
      tone(80, 0.35, 'triangle', 0.04, -36);
    } else if (name === 'chain') {
      tone(560, 0.12, 'sawtooth', 0.035, -250);
      tone(830, 0.1, 'sine', 0.035, -380);
    } else if (name === 'hit') {
      tone(125, 0.19, 'sawtooth', 0.07, -70);
    } else if (name === 'kill') {
      tone(540, 0.07, 'sine', 0.035, 290);
    } else if (name === 'level') {
      tone(440, 0.14, 'triangle', 0.07, 180);
      window.setTimeout(() => tone(660, 0.18, 'triangle', 0.06, 210), 75);
    } else if (name === 'dash') {
      tone(210, 0.17, 'sawtooth', 0.045, 360);
    } else if (name === 'boss') {
      tone(94, 0.75, 'sawtooth', 0.08, -28);
      tone(141, 0.65, 'triangle', 0.045, -20);
    } else if (name === 'win') {
      tone(390, 0.16, 'triangle', 0.06, 240);
      window.setTimeout(() => tone(585, 0.22, 'triangle', 0.055, 300), 90);
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    ui.homeSound.querySelector('span').textContent = soundEnabled ? 'ON' : 'OFF';
    ui.sound.textContent = soundEnabled ? '♫' : '×';
    ui.homeSound.setAttribute('aria-label', `Turn sound ${soundEnabled ? 'off' : 'on'}`);
    ui.sound.setAttribute('aria-label', `Turn sound ${soundEnabled ? 'off' : 'on'}`);
    if (soundEnabled) {
      initAudio();
      tone(520, 0.08, 'sine', 0.035, 180);
    }
  }

  function makePlayer() {
    return {
      x: width * 0.5,
      y: height * 0.5,
      vx: 0,
      vy: 0,
      facing: -Math.PI / 2,
      health: 100,
      maxHealth: 100,
      ink: 100,
      maxInk: 100,
      xp: 0,
      level: 1,
      xpNeed: 42,
      speed: 238,
      invulnerable: 0,
      hurtFlash: 0,
      dashCooldown: 0,
      dashTimer: 0,
      dashVector: { x: 0, y: 0 },
      castCooldown: 0,
      familiarTimer: 1.5,
      upgrades: {
        edge: 0, aperture: 0, fork: 0, quick: 0, long: 0,
        carbon: 0, familiar: 0, vitality: 0, blink: 0, magnet: 0
      }
    };
  }

  function startRun(daily = false) {
    initAudio();
    if (audioContext && audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    const today = dailyKey();
    const seed = dateSeed(today);
    random = daily ? seededRandom(seed ^ 0x85ebca6b) : Math.random;
    spawnRandom = daily ? seededRandom(seed) : Math.random;
    cosmeticRandom = daily ? seededRandom(seed ^ 0xc2b2ae35) : Math.random;
    run = {
      daily,
      day: today,
      elapsed: 0,
      score: 0,
      kills: 0,
      combo: 0,
      comboTimer: 0,
      spawnTimer: 0.7,
      nextBossAt: 53,
      bossNumber: 0,
      bossAlive: false,
      levelChoices: [],
      pendingLevels: 0,
      echoCounter: 0,
      hudTimer: 0,
      mobileHintTimer: 0,
      ended: false
    };
    player = makePlayer();
    enemies = [];
    bullets = [];
    orbs = [];
    particles = [];
    beams = [];
    rings = [];
    floatingText = [];
    echoes = [];
    stroke = null;
    joystick = null;
    shake = 0;
    keys.clear();
    saveData.runs += 1;
    persistSave();
    mode = 'playing';
    ui.home.classList.add('hidden');
    ui.levelScreen.classList.add('hidden');
    ui.pauseScreen.classList.add('hidden');
    ui.overScreen.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    ui.bossPanel.classList.add('hidden');
    ui.mobileHelp.classList.remove('hidden');
    ui.mobileHelp.setAttribute('aria-hidden', 'false');
    ui.newRecord.classList.add('hidden');
    refreshHud();
    showToast(daily ? 'TODAY’S DRAFT. SAME NIGHT FOR EVERYONE.' : 'MAKE A MARK. ANY MARK.', 2100);
    frameTime = performance.now();
  }

  function showToast(text, duration = 1450) {
    window.clearTimeout(toastTimeout);
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    toastTimeout = window.setTimeout(() => ui.toast.classList.remove('show'), duration);
  }

  function pauseGame() {
    if (mode !== 'playing') return;
    mode = 'paused';
    stroke = null;
    joystick = null;
    keys.clear();
    ui.pauseScreen.classList.remove('hidden');
  }

  function resumeGame() {
    if (mode !== 'paused') return;
    mode = 'playing';
    ui.pauseScreen.classList.add('hidden');
    frameTime = performance.now();
  }

  function finishRun() {
    if (!run || run.ended) return;
    run.ended = true;
    mode = 'over';
    stroke = null;
    joystick = null;
    keys.clear();
    saveData.totalKills += run.kills;
    let newRecord = false;
    if (run.daily) {
      const previous = saveData.daily[run.day] || { time: 0, score: 0 };
      if (run.elapsed > (Number(previous.time) || 0) || run.score > (Number(previous.score) || 0)) newRecord = true;
      saveData.daily[run.day] = {
        time: Math.max(Number(previous.time) || 0, run.elapsed),
        score: Math.max(Number(previous.score) || 0, run.score)
      };
      const dayKeys = Object.keys(saveData.daily).sort();
      while (dayKeys.length > 35) delete saveData.daily[dayKeys.shift()];
    } else {
      if (run.elapsed > saveData.bestTime || run.score > saveData.bestScore) newRecord = true;
      saveData.bestTime = Math.max(saveData.bestTime, run.elapsed);
      saveData.bestScore = Math.max(saveData.bestScore, run.score);
    }
    persistSave();
    refreshHomeRecord();
    ui.hud.classList.remove('hidden');
    ui.finalTime.textContent = fmtTime(run.elapsed);
    ui.finalKills.textContent = run.kills.toLocaleString();
    ui.finalScore.textContent = run.score.toLocaleString();
    ui.overQuip.textContent = run.kills >= 65
      ? 'The margins are covered in monsters. You did that.'
      : run.elapsed >= 100
        ? 'The night will be telling stories about you.'
        : 'The night got the last word. This time.';
    ui.newRecord.classList.toggle('hidden', !newRecord);
    ui.overScreen.classList.remove('hidden');
    sound('hit');
  }

  function currentDamage() {
    return 1 + player.upgrades.edge * 0.22;
  }

  function currentInkRate() {
    return 10 + player.upgrades.quick * 1.3;
  }

  function startDash() {
    if (mode !== 'playing' || !player || player.dashCooldown > 0) return;
    let dx = 0;
    let dy = 0;
    if (joystick && (Math.abs(joystick.x) + Math.abs(joystick.y) > 0.08)) {
      dx = joystick.x;
      dy = joystick.y;
    }
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (Math.hypot(dx, dy) < 0.1) {
      let closest = null;
      let closestD = Infinity;
      for (const enemy of enemies) {
        const d = distance(player.x, player.y, enemy.x, enemy.y);
        if (d < closestD) { closest = enemy; closestD = d; }
      }
      if (closest) {
        dx = player.x - closest.x;
        dy = player.y - closest.y;
      } else {
        dx = Math.cos(player.facing);
        dy = Math.sin(player.facing);
      }
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    player.dashVector.x = dx;
    player.dashVector.y = dy;
    player.dashTimer = 0.17;
    player.dashCooldown = Math.max(1.05, 2.35 - player.upgrades.blink * 0.28);
    player.invulnerable = Math.max(player.invulnerable, 0.36 + player.upgrades.blink * 0.035);
    player.vx = dx * 650;
    player.vy = dy * 650;
    shake = Math.max(shake, 2.6);
    for (let i = 0; i < 8; i += 1) addParticle(player.x, player.y, '#a5f6cf', 0.34, 85);
    sound('dash');
  }

  function keyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (mode === 'playing') pauseGame();
      else if (mode === 'paused') resumeGame();
      return;
    }
    if (event.code === 'KeyM') { toggleSound(); return; }
    if (mode === 'menu' && (event.code === 'Enter' || event.code === 'Space')) { event.preventDefault(); startRun(false); return; }
    if (mode === 'over' && (event.code === 'Enter' || event.code === 'Space')) { event.preventDefault(); startRun(run ? run.daily : false); return; }
    if (mode === 'paused' && (event.code === 'Enter' || event.code === 'Space')) { event.preventDefault(); resumeGame(); return; }
    if (mode === 'levelup' && /^Digit[1-3]$/.test(event.code)) {
      chooseUpgrade(Number(event.code.slice(-1)) - 1);
      return;
    }
    if (mode !== 'playing') return;
    if (!event.repeat) keys.add(event.code);
    if ((event.code === 'ShiftLeft' || event.code === 'ShiftRight' || event.code === 'Space') && !event.repeat) startDash();
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: clamp(event.clientX - rect.left, 0, width), y: clamp(event.clientY - rect.top, 0, height) };
  }

  function pointerDown(event) {
    if (mode !== 'playing') return;
    event.preventDefault();
    initAudio();
    const point = pointFromEvent(event);
    pointer = point;
    try { canvas.setPointerCapture(event.pointerId); } catch (_) { /* Pointer capture is not available in every embedded browser. */ }
    if (event.pointerType === 'touch' && point.x < width * 0.44) {
      if (!joystick) {
        joystick = { id: event.pointerId, originX: point.x, originY: point.y, x: 0, y: 0 };
      }
      return;
    }
    if (!stroke) stroke = { id: event.pointerId, points: [point], length: 0 };
  }

  function pointerMove(event) {
    const point = pointFromEvent(event);
    pointer = point;
    if (stroke && stroke.id === event.pointerId) {
      const previous = stroke.points[stroke.points.length - 1];
      const step = distance(previous.x, previous.y, point.x, point.y);
      if (step >= 2.5 && stroke.points.length < 130) {
        stroke.points.push(point);
        stroke.length += step;
      }
    }
    if (joystick && joystick.id === event.pointerId) {
      const dx = point.x - joystick.originX;
      const dy = point.y - joystick.originY;
      const len = Math.hypot(dx, dy);
      const amount = clamp(len / 46, 0, 1);
      joystick.x = len > 5 ? (dx / len) * amount : 0;
      joystick.y = len > 5 ? (dy / len) * amount : 0;
    }
  }

  function pointerUp(event) {
    if (stroke && stroke.id === event.pointerId) {
      const point = pointFromEvent(event);
      const last = stroke.points[stroke.points.length - 1];
      if (distance(last.x, last.y, point.x, point.y) > 1.5) {
        stroke.points.push(point);
        stroke.length += distance(last.x, last.y, point.x, point.y);
      }
      castStroke(stroke);
      stroke = null;
    }
    if (joystick && joystick.id === event.pointerId) joystick = null;
  }

  function pointerCancel(event) {
    if (stroke && stroke.id === event.pointerId) stroke = null;
    if (joystick && joystick.id === event.pointerId) joystick = null;
  }

  function classifyStroke(points, totalLength) {
    if (points.length < 2) return 'lance';
    const first = points[0];
    const last = points[points.length - 1];
    const direct = distance(first.x, first.y, last.x, last.y);
    let minX = first.x;
    let maxX = first.x;
    let minY = first.y;
    let maxY = first.y;
    let turn = 0;
    let lastAngle = null;
    for (let i = 1; i < points.length; i += 1) {
      minX = Math.min(minX, points[i].x);
      maxX = Math.max(maxX, points[i].x);
      minY = Math.min(minY, points[i].y);
      maxY = Math.max(maxY, points[i].y);
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      if (Math.hypot(dx, dy) < 2) continue;
      const angle = Math.atan2(dy, dx);
      if (lastAngle !== null) {
        let diff = angle - lastAngle;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        turn += Math.abs(diff);
      }
      lastAngle = angle;
    }
    const diagonal = Math.hypot(maxX - minX, maxY - minY);
    const closedness = direct / Math.max(38, diagonal);
    const straightness = direct / Math.max(1, totalLength);
    if (totalLength > 80 && diagonal > 34 && closedness < 0.31) return 'nova';
    if (straightness < 0.63 || turn > 3.8) return 'chain';
    return 'lance';
  }

  function castStroke(drawing) {
    if (!drawing || mode !== 'playing' || !player) return;
    const points = drawing.points;
    if (!points.length) return;
    let angle;
    if (points.length > 1 && drawing.length > 20) {
      const dx = points[points.length - 1].x - points[0].x;
      const dy = points[points.length - 1].y - points[0].y;
      angle = Math.atan2(dy, dx);
    } else {
      angle = Math.atan2(points[0].y - player.y, points[0].x - player.x);
    }
    if (!Number.isFinite(angle)) angle = player.facing;
    const type = drawing.length < 22 ? 'lance' : classifyStroke(points, drawing.length);
    const color = type === 'nova' ? '#83dcff' : type === 'chain' ? '#ff91d3' : '#a5f6cf';
    if (points.length > 1) {
      rings.push({ x: points[0].x, y: points[0].y, radius: 3, maxRadius: 29, life: 0.24, maxLife: 0.24, color, line: true });
    }
    castRune(type, angle);
  }

  function castRune(type, angle, options = {}) {
    if (mode !== 'playing' || !player) return;
    const freeEcho = Boolean(options.echo);
    const power = options.power || 1;
    if (!freeEcho) {
      if (player.castCooldown > 0) return;
      const costs = { lance: 12, nova: 29, chain: 23 };
      const cost = costs[type] || 12;
      if (player.ink < cost) {
        showToast('LOW INK · KEEP MOVING', 720);
        tone(125, 0.11, 'triangle', 0.035, -45);
        return;
      }
      player.ink -= cost;
      player.castCooldown = Math.max(0.075, 0.17 - player.upgrades.quick * 0.014);
      player.facing = angle;
      run.echoCounter += 1;
    }

    const damage = currentDamage() * power;
    if (type === 'lance') {
      castLance(angle, damage, freeEcho);
      if (!freeEcho) sound('cast');
    } else if (type === 'nova') {
      castNova(damage, freeEcho);
      if (!freeEcho) sound('nova');
    } else {
      castChain(angle, damage, freeEcho);
      if (!freeEcho) sound('chain');
    }

    if (!freeEcho && player.upgrades.carbon > 0) {
      const every = Math.max(2, 5 - player.upgrades.carbon);
      if (run.echoCounter % every === 0) {
        echoes.push({ at: run.elapsed + 0.22, type, angle, power: 0.43 + player.upgrades.carbon * 0.12 });
        showToast('CARBON COPY IN THE MARGINS', 900);
      }
    }
  }

  function castLance(angle, damage, echo = false) {
    const range = Math.max(width, height) * 0.79 * (1 + player.upgrades.long * 0.18);
    const edge = 13 + player.upgrades.long * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const endX = player.x + dx * range;
    const endY = player.y + dy * range;
    addBeam(player.x, player.y, endX, endY, echo ? '#e4ffef' : '#a5f6cf', 0.19, 12);
    let hitCount = 0;
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      const ex = enemy.x - player.x;
      const ey = enemy.y - player.y;
      const along = ex * dx + ey * dy;
      if (along < 0 || along > range) continue;
      const across = Math.abs(ex * dy - ey * dx);
      if (across <= enemy.radius + edge) {
        damageEnemy(enemy, damage * 31, player.x, player.y, 82);
        hitCount += 1;
      }
    }
    if (hitCount >= 2 && !echo) showToast(`${hitCount} CUT WITH ONE STROKE`, 850);
  }

  function castNova(damage, echo = false) {
    const radius = 128 * (1 + player.upgrades.aperture * 0.23);
    rings.push({ x: player.x, y: player.y, radius: 8, maxRadius: radius, life: 0.46, maxLife: 0.46, color: echo ? '#c1f5ff' : '#83dcff', line: false });
    rings.push({ x: player.x, y: player.y, radius: 7, maxRadius: radius * 0.74, life: 0.55, maxLife: 0.55, color: '#c5f4ff', line: true });
    for (const enemy of enemies) {
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (d <= radius + enemy.radius) {
        const falloff = 1 - Math.max(0, d / (radius * 1.65)) * 0.3;
        damageEnemy(enemy, damage * (35 + player.upgrades.aperture * 4) * falloff, player.x, player.y, 210);
      }
    }
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      if (distance(player.x, player.y, bullets[i].x, bullets[i].y) < radius * 1.25) {
        addParticle(bullets[i].x, bullets[i].y, '#83dcff', 0.34, 35);
        bullets.splice(i, 1);
      }
    }
    player.invulnerable = Math.max(player.invulnerable, 0.32);
    shake = Math.max(shake, echo ? 2 : 5);
    for (let i = 0; i < 32; i += 1) addParticle(player.x, player.y, i % 3 ? '#83dcff' : '#d5f7ff', 0.7, 190);
  }

  function castChain(angle, damage, echo = false) {
    const maxTargets = 4 + player.upgrades.fork;
    const chosen = [];
    const first = pickChainTarget(player.x, player.y, angle, enemies, new Set());
    if (!first) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      addBeam(player.x, player.y, player.x + dx * 120, player.y + dy * 120, '#ff91d3', 0.16, 15);
      return;
    }
    let previousX = player.x;
    let previousY = player.y;
    let target = first;
    for (let i = 0; i < maxTargets && target; i += 1) {
      chosen.push(target);
      const color = echo ? '#ffd0ed' : (i % 2 ? '#ffc2e6' : '#ff91d3');
      addBeam(previousX, previousY, target.x, target.y, color, 0.23, 22);
      damageEnemy(target, damage * (29 + player.upgrades.fork * 3) * Math.max(0.58, 1 - i * 0.095), previousX, previousY, 75);
      addParticle(target.x, target.y, color, 5, 72);
      previousX = target.x;
      previousY = target.y;
      const visited = new Set(chosen);
      target = pickChainTarget(previousX, previousY, null, enemies, visited, 245);
    }
    if (chosen.length >= 3 && !echo) showToast(`CHAIN REACTION ×${chosen.length}`, 850);
  }

  function pickChainTarget(x, y, angle, pool, excluded, maxRange = 440) {
    let best = null;
    let bestScore = Infinity;
    for (const enemy of pool) {
      if (enemy.dead || excluded.has(enemy)) continue;
      const d = distance(x, y, enemy.x, enemy.y);
      if (d > maxRange) continue;
      let penalty = 0;
      if (angle !== null && angle !== undefined) {
        const a = Math.atan2(enemy.y - y, enemy.x - x);
        const alignment = Math.cos(a - angle);
        if (alignment < -0.18) penalty = 95 + Math.abs(alignment) * 90;
        else penalty = (1 - alignment) * 34;
      }
      const score = d + penalty;
      if (score < bestScore) { bestScore = score; best = enemy; }
    }
    return best;
  }

  function addBeam(x1, y1, x2, y2, color, life = 0.2, jitter = 10) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const pieces = Math.max(3, Math.min(22, Math.ceil(len / 38)));
    const points = [];
    for (let i = 0; i <= pieces; i += 1) {
      const t = i / pieces;
      const offset = i === 0 || i === pieces ? 0 : (cosmeticRandom() - 0.5) * jitter * 2;
      points.push({ x: x1 + dx * t - (dy / (len || 1)) * offset, y: y1 + dy * t + (dx / (len || 1)) * offset });
    }
    beams.push({ points, color, life, maxLife: life, width: Math.max(1.5, Math.min(4, jitter * 0.17)) });
  }

  function addParticle(x, y, color, life = 0.45, speed = 100) {
    const angle = cosmeticRandom() * TAU;
    const force = speed * (0.22 + cosmeticRandom() * 0.78);
    particles.push({ x, y, vx: Math.cos(angle) * force, vy: Math.sin(angle) * force, radius: cosmeticRandom() * 2.3 + 0.8, color, life, maxLife: life });
  }

  function addBurst(x, y, color, count = 10, speed = 110) {
    for (let i = 0; i < count; i += 1) addParticle(x, y, color, 0.32 + cosmeticRandom() * 0.45, speed);
  }

  function addText(x, y, text, color = '#e9e6de', size = 11) {
    floatingText.push({ x, y, text, color, size, life: 0.72, maxLife: 0.72 });
  }

  function spawnOrb(x, y, value, boss = false) {
    orbs.push({ x, y, vx: (random() - 0.5) * 90, vy: (random() - 0.5) * 90, value, radius: boss ? 9 : clamp(3.4 + value * 0.1, 4, 7), boss, phase: random() * TAU });
  }

  function spawnEnemy(type, x, y) {
    const diff = Math.min(1, run.elapsed / 210);
    const definitions = {
      mote: { radius: 12, hp: 26, speed: 60 + run.elapsed * 0.13, damage: 12, xp: 9, score: 72, color: '#e1bdff' },
      rake: { radius: 10, hp: 19, speed: 112 + run.elapsed * 0.15, damage: 10, xp: 7, score: 86, color: '#ffb0cf' },
      shooter: { radius: 15, hp: 42 + diff * 12, speed: 52 + run.elapsed * 0.04, damage: 12, xp: 13, score: 118, color: '#ff88cb' },
      brute: { radius: 22, hp: 106 + diff * 35, speed: 39 + run.elapsed * 0.035, damage: 23, xp: 21, score: 165, color: '#ffd18d' },
      splitter: { radius: 17, hp: 66 + diff * 18, speed: 64 + run.elapsed * 0.06, damage: 16, xp: 16, score: 138, color: '#a8a3ff' },
      runt: { radius: 7, hp: 14, speed: 142 + run.elapsed * 0.08, damage: 8, xp: 3, score: 36, color: '#d1bbff' }
    };
    const stats = definitions[type] || definitions.mote;
    const ex = x === undefined ? random() * width : x;
    const ey = y === undefined ? random() * height : y;
    enemies.push({
      type, x: ex, y: ey, vx: 0, vy: 0, radius: stats.radius, hp: stats.hp, maxHp: stats.hp,
      speed: stats.speed, damage: stats.damage, xp: stats.xp, score: stats.score, color: stats.color,
      age: 0, phase: random() * TAU, flash: 0, fireTimer: 1.4 + random() * 1.2,
      dead: false, boss: false
    });
  }

  function spawnAtEdge(type) {
    const margin = 28;
    let x;
    let y;
    const edge = Math.floor(spawnRandom() * 4);
    if (edge === 0) { x = spawnRandom() * width; y = -margin; }
    else if (edge === 1) { x = width + margin; y = spawnRandom() * height; }
    else if (edge === 2) { x = spawnRandom() * width; y = height + margin; }
    else { x = -margin; y = spawnRandom() * height; }
    if (player && distance(x, y, player.x, player.y) < Math.min(width, height) * 0.45) {
      const a = Math.atan2(y - player.y, x - player.x);
      x = player.x + Math.cos(a) * Math.min(width, height) * 0.58;
      y = player.y + Math.sin(a) * Math.min(width, height) * 0.58;
      x = clamp(x, -margin, width + margin);
      y = clamp(y, -margin, height + margin);
    }
    spawnEnemy(type, x, y);
  }

  function chooseEnemyType() {
    const t = run.elapsed;
    const value = spawnRandom();
    if (t < 12) return value < 0.68 ? 'mote' : 'rake';
    if (t < 28) return value < 0.39 ? 'mote' : value < 0.77 ? 'rake' : 'shooter';
    if (t < 55) return value < 0.28 ? 'mote' : value < 0.57 ? 'rake' : value < 0.82 ? 'shooter' : 'brute';
    if (value < 0.22) return 'mote';
    if (value < 0.46) return 'rake';
    if (value < 0.68) return 'shooter';
    if (value < 0.86) return 'brute';
    return 'splitter';
  }

  function spawnBoss() {
    run.bossNumber += 1;
    run.bossAlive = true;
    const radius = 39 + Math.min(10, run.bossNumber * 1.5);
    const hp = 520 + run.bossNumber * 145 + run.elapsed * 1.15;
    const side = Math.floor(spawnRandom() * 4);
    const x = side === 1 ? width + 30 : side === 3 ? -30 : width * (0.3 + spawnRandom() * 0.4);
    const y = side === 0 ? -30 : side === 2 ? height + 30 : height * (0.3 + spawnRandom() * 0.4);
    const boss = {
      type: 'boss', x, y, vx: 0, vy: 0, radius, hp, maxHp: hp,
      speed: 43 + run.bossNumber * 2, damage: 28, xp: 130, score: 1350,
      color: '#ff669f', age: 0, phase: random() * TAU, flash: 0,
      attackTimer: 2.4, pattern: 0, dead: false, boss: true, fireTimer: 0
    };
    enemies.push(boss);
    ui.bossPanel.classList.remove('hidden');
    showToast('THE REDACTOR IS IN THE MARGINS', 2600);
    sound('boss');
    shake = Math.max(shake, 5);
  }

  function shootBullet(x, y, angle, speed, damage = 10, color = '#ff8aca', radius = 4) {
    if (bullets.length > 190) return;
    bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, color, radius, life: 5.2, age: 0 });
  }

  function bossAttack(enemy) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    if (enemy.pattern % 3 === 2) {
      const count = 17;
      const offset = enemy.age * 0.27;
      for (let i = 0; i < count; i += 1) {
        shootBullet(enemy.x, enemy.y, offset + i * TAU / count, 137 + run.bossNumber * 5, 12, '#ff77ad', 4.4);
      }
      showToast('THE REDACTOR REWRITES THE RULES', 1250);
    } else {
      const count = enemy.pattern % 3 === 1 ? 7 : 5;
      const spread = count === 7 ? 0.92 : 0.64;
      for (let i = 0; i < count; i += 1) {
        const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread;
        shootBullet(enemy.x, enemy.y, angle + offset, 178 + run.bossNumber * 6, 11, '#ff91bd', 4.2);
      }
    }
    enemy.pattern += 1;
  }

  function updatePlayer(dt) {
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.castCooldown = Math.max(0, player.castCooldown - dt);
    player.ink = Math.min(player.maxInk, player.ink + currentInkRate() * dt);

    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (joystick) {
      dx += joystick.x;
      dy += joystick.y;
    }
    const magnitude = Math.hypot(dx, dy);
    if (magnitude > 1) { dx /= magnitude; dy /= magnitude; }
    if (Math.hypot(dx, dy) > 0.08) player.facing = Math.atan2(dy, dx);

    if (player.dashTimer > 0) {
      player.dashTimer = Math.max(0, player.dashTimer - dt);
      player.vx = player.dashVector.x * 650;
      player.vy = player.dashVector.y * 650;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      if (cosmeticRandom() < 0.8) addParticle(player.x, player.y, '#a5f6cf', 0.26, 38);
    } else {
      const responsiveness = Math.min(1, dt * 11);
      player.vx = lerp(player.vx, dx * player.speed, responsiveness);
      player.vy = lerp(player.vy, dy * player.speed, responsiveness);
      if (magnitude < 0.08) {
        player.vx *= Math.exp(-5 * dt);
        player.vy *= Math.exp(-5 * dt);
      }
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      if (Math.hypot(player.vx, player.vy) > 30) {
        for (let i = 0; i < 2; i += 1) {
          if (cosmeticRandom() < 0.72) addParticle(player.x, player.y, '#8fe7c5', 0.23, 25);
        }
      }
    }
    player.x = clamp(player.x, 23, width - 23);
    player.y = clamp(player.y, 23, height - 23);
  }

  function updateEnemies(dt) {
    for (const enemy of enemies) {
      if (enemy.dead) continue;
      enemy.age += dt;
      enemy.flash = Math.max(0, enemy.flash - dt);
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      let moveX = dx / d;
      let moveY = dy / d;

      if (enemy.type === 'shooter') {
        if (d < 155) { moveX *= -0.88; moveY *= -0.88; }
        else if (d < 240) { moveX = -dy / d * 0.46; moveY = dx / d * 0.46; }
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= 0) {
          enemy.fireTimer = Math.max(1.45, 2.65 - run.elapsed * 0.004) + random() * 0.45;
          const aim = Math.atan2(dy, dx);
          shootBullet(enemy.x, enemy.y, aim, 198, enemy.damage, '#ff9acb', 3.8);
        }
      } else if (enemy.type === 'rake') {
        const weave = Math.sin(enemy.age * 4.5 + enemy.phase) * 0.45;
        moveX += (-dy / d) * weave;
        moveY += (dx / d) * weave;
      } else if (enemy.type === 'boss') {
        const wantedDistance = 205;
        if (d < wantedDistance - 24) { moveX = -moveX * 0.75 - dy / d * 0.35; moveY = -moveY * 0.75 + dx / d * 0.35; }
        else if (d < wantedDistance + 28) { moveX = -dy / d * 0.58; moveY = dx / d * 0.58; }
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          bossAttack(enemy);
          enemy.attackTimer = Math.max(1.65, 2.45 - run.bossNumber * 0.12);
        }
      }

      const targetVX = moveX * enemy.speed;
      const targetVY = moveY * enemy.speed;
      const ease = Math.min(1, dt * (enemy.type === 'rake' ? 3.1 : 2.5));
      enemy.vx = lerp(enemy.vx, targetVX, ease);
      enemy.vy = lerp(enemy.vy, targetVY, ease);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.vx *= Math.exp(-1.1 * dt);
      enemy.vy *= Math.exp(-1.1 * dt);

      if (distance(player.x, player.y, enemy.x, enemy.y) < playerRadius() + enemy.radius - 2) {
        const didHit = hurtPlayer(enemy.damage);
        if (didHit) {
          const push = Math.atan2(enemy.y - player.y, enemy.x - player.x);
          enemy.vx += Math.cos(push) * (enemy.type === 'boss' ? 145 : 230);
          enemy.vy += Math.sin(push) * (enemy.type === 'boss' ? 145 : 230);
        }
      }
    }
    enemies = enemies.filter((enemy) => !enemy.dead);
    if (run.bossAlive && !enemies.some((enemy) => enemy.type === 'boss' && !enemy.dead)) {
      run.bossAlive = false;
      ui.bossPanel.classList.add('hidden');
    }
  }

  function playerRadius() {
    return 12;
  }

  function hurtPlayer(amount) {
    if (player.invulnerable > 0 || mode !== 'playing') return false;
    player.health = Math.max(0, player.health - amount);
    player.invulnerable = 0.82;
    player.hurtFlash = 0.26;
    run.combo = 0;
    run.comboTimer = 0;
    shake = Math.max(shake, 9);
    addBurst(player.x, player.y, '#ff8aca', 16, 170);
    addText(player.x, player.y - 20, `−${Math.ceil(amount)}`, '#ff9bc8', 14);
    sound('hit');
    if (player.health <= 0) finishRun();
    return true;
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.age += dt;
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0 || bullet.x < -45 || bullet.x > width + 45 || bullet.y < -45 || bullet.y > height + 45) {
        bullets.splice(i, 1);
        continue;
      }
      if (distance(player.x, player.y, bullet.x, bullet.y) < playerRadius() + bullet.radius) {
        hurtPlayer(bullet.damage);
        addParticle(bullet.x, bullet.y, bullet.color, 0.32, 50);
        bullets.splice(i, 1);
        if (mode !== 'playing') return;
      }
    }
  }

  function updateOrbs(dt) {
    const magnetRadius = 100 + player.upgrades.magnet * 53;
    for (let i = orbs.length - 1; i >= 0; i -= 1) {
      const orb = orbs[i];
      orb.phase += dt * 3;
      const d = distance(player.x, player.y, orb.x, orb.y);
      if (d < magnetRadius) {
        const pull = 280 + (magnetRadius - d) * 1.65;
        orb.vx += (player.x - orb.x) / Math.max(1, d) * pull * dt;
        orb.vy += (player.y - orb.y) / Math.max(1, d) * pull * dt;
      }
      orb.vx *= Math.exp(-2.2 * dt);
      orb.vy *= Math.exp(-2.2 * dt);
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
      if (d < playerRadius() + orb.radius + 3) {
        const multiplier = 1 + player.upgrades.magnet * 0.12;
        player.xp += orb.value * multiplier;
        addText(orb.x, orb.y, `+${Math.round(orb.value * multiplier)} XP`, '#f6d69e', 10);
        addBurst(orb.x, orb.y, orb.boss ? '#ffe0a1' : '#ffd998', orb.boss ? 12 : 5, 56);
        orbs.splice(i, 1);
        checkLevelUp();
        if (mode !== 'playing') return;
      }
    }
  }

  function checkLevelUp() {
    while (player.xp >= player.xpNeed) {
      player.xp -= player.xpNeed;
      player.level += 1;
      player.xpNeed = Math.floor(42 + player.level * 21 + Math.pow(player.level - 1, 1.25) * 4);
      run.pendingLevels += 1;
    }
    if (run.pendingLevels > 0 && mode === 'playing') openUpgradeChoice();
  }

  function updateFamiliars(dt) {
    if (player.upgrades.familiar <= 0) return;
    player.familiarTimer -= dt;
    if (player.familiarTimer > 0) return;
    player.familiarTimer = Math.max(1.15, 3.05 - player.upgrades.familiar * 0.42);
    let target = null;
    let nearest = 430;
    for (const enemy of enemies) {
      const d = distance(player.x, player.y, enemy.x, enemy.y);
      if (!enemy.dead && d < nearest) { target = enemy; nearest = d; }
    }
    if (!target) return;
    const a = Math.atan2(target.y - player.y, target.x - player.x);
    const familiarX = player.x + Math.cos(a - 0.62) * 26;
    const familiarY = player.y + Math.sin(a - 0.62) * 26;
    addBeam(familiarX, familiarY, target.x, target.y, '#ffe6a5', 0.24, 8);
    damageEnemy(target, 17 + player.upgrades.familiar * 7, familiarX, familiarY, 45);
    sound('kill');
  }

  function updateSmallEffects(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-2.7 * dt);
      p.vy *= Math.exp(-2.7 * dt);
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = beams.length - 1; i >= 0; i -= 1) {
      beams[i].life -= dt;
      if (beams[i].life <= 0) beams.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; i -= 1) {
      const ring = rings[i];
      ring.life -= dt;
      const progress = 1 - Math.max(0, ring.life) / ring.maxLife;
      ring.radius = lerp(8, ring.maxRadius, 1 - Math.pow(1 - progress, 2));
      if (ring.life <= 0) rings.splice(i, 1);
    }
    for (let i = floatingText.length - 1; i >= 0; i -= 1) {
      floatingText[i].life -= dt;
      floatingText[i].y -= dt * 25;
      if (floatingText[i].life <= 0) floatingText.splice(i, 1);
    }
    shake = Math.max(0, shake - dt * 22);
    shakeX = (cosmeticRandom() - 0.5) * shake;
    shakeY = (cosmeticRandom() - 0.5) * shake;
  }

  function damageEnemy(enemy, amount, fromX, fromY, knock = 0) {
    if (!enemy || enemy.dead) return;
    enemy.hp -= amount;
    enemy.flash = 0.12;
    if (knock > 0) {
      const angle = Math.atan2(enemy.y - fromY, enemy.x - fromX);
      enemy.vx += Math.cos(angle) * knock;
      enemy.vy += Math.sin(angle) * knock;
    }
    if (enemy.type !== 'boss' && amount > 25) addParticle(enemy.x, enemy.y, enemy.color, 0.24, 60);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
    run.kills += 1;
    run.combo += 1;
    run.comboTimer = 4.1;
    const multiplier = 1 + Math.min(2, Math.floor(Math.max(0, run.combo - 1) / 5) * 0.25);
    run.score += Math.floor(enemy.score * multiplier);
    spawnOrb(enemy.x, enemy.y, enemy.xp, enemy.type === 'boss');
    addBurst(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 44 : enemy.type === 'brute' ? 18 : 11, enemy.type === 'boss' ? 260 : 145);
    addText(enemy.x, enemy.y - enemy.radius, `+${Math.floor(enemy.score * multiplier)}`, '#ffe3ad', 10);
    if (enemy.type !== 'boss' && cosmeticRandom() < 0.34) sound('kill');

    if (enemy.type === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const angle = random() * TAU;
        spawnEnemy('runt', enemy.x + Math.cos(angle) * 10, enemy.y + Math.sin(angle) * 10);
      }
    }
    if (enemy.type === 'boss') {
      run.bossAlive = false;
      run.nextBossAt = run.elapsed + 88;
      bullets.length = 0;
      player.health = Math.min(player.maxHealth, player.health + 24);
      player.ink = player.maxInk;
      spawnOrb(enemy.x + 20, enemy.y - 10, 112, true);
      rings.push({ x: enemy.x, y: enemy.y, radius: 10, maxRadius: 250, life: 0.75, maxLife: 0.75, color: '#ff83b6', line: true });
      ui.bossPanel.classList.add('hidden');
      showToast('THE REDACTOR HAS BEEN REDACTED', 2600);
      sound('win');
      shake = Math.max(shake, 14);
    }
    if (run.combo > 0 && run.combo % 5 === 0) {
      showToast(`${run.combo} THINGS UNWRITTEN · THE INK RUNS HOT`, 1300);
      tone(640 + Math.min(300, run.combo * 4), 0.13, 'triangle', 0.055, 210);
    }
  }

  function openUpgradeChoice() {
    if (mode !== 'playing') return;
    mode = 'levelup';
    stroke = null;
    joystick = null;
    keys.clear();
    const available = upgradeDefinitions.filter((entry) => player.upgrades[entry.id] < entry.max);
    const pool = available.slice();
    const choices = [];
    while (choices.length < 3 && pool.length) {
      const index = Math.floor(random() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    if (!choices.length) choices.push(upgradeDefinitions[0]);
    run.levelChoices = choices;
    ui.upgrades.replaceChildren();
    choices.forEach((upgrade, index) => {
      const rank = player.upgrades[upgrade.id];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'upgrade-card';
      button.innerHTML = `<span class="upgrade-index"><span>FIELD NOTE 0${index + 1}</span><span class="upgrade-glyph">${upgrade.glyph}</span></span><h3>${upgrade.title}</h3><p>${upgrade.desc(rank)}</p><div class="upgrade-rank">RANK ${rank + 1} / ${upgrade.max}</div>`;
      button.addEventListener('click', () => chooseUpgrade(index));
      ui.upgrades.append(button);
    });
    ui.levelScreen.classList.remove('hidden');
    sound('level');
  }

  function chooseUpgrade(index) {
    if (mode !== 'levelup' || !run.levelChoices[index]) return;
    const selected = run.levelChoices[index];
    selected.apply();
    run.pendingLevels = Math.max(0, run.pendingLevels - 1);
    ui.levelScreen.classList.add('hidden');
    addText(player.x, player.y - 28, selected.title.toUpperCase(), '#a5f6cf', 12);
    if (run.pendingLevels > 0) {
      mode = 'playing';
      openUpgradeChoice();
    } else {
      mode = 'playing';
    }
    refreshHud();
    frameTime = performance.now();
  }

  function update(dt) {
    if (mode !== 'playing' || !run || !player) return;
    run.elapsed += dt;
    run.hudTimer += dt;
    run.mobileHintTimer += dt;
    if (run.mobileHintTimer > 12) {
      ui.mobileHelp.classList.add('hidden');
      ui.mobileHelp.setAttribute('aria-hidden', 'true');
    }
    updatePlayer(dt);
    if (run.elapsed >= run.nextBossAt && !run.bossAlive) spawnBoss();

    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0 && enemies.filter((enemy) => enemy.type !== 'boss' && !enemy.dead).length < 44) {
      spawnAtEdge(chooseEnemyType());
      const interval = Math.max(0.34, 1.02 - run.elapsed * 0.0033);
      run.spawnTimer += interval * (0.82 + spawnRandom() * 0.38);
    }

    for (let i = echoes.length - 1; i >= 0; i -= 1) {
      if (run.elapsed >= echoes[i].at) {
        const echo = echoes.splice(i, 1)[0];
        castRune(echo.type, echo.angle, { echo: true, power: echo.power });
      }
    }

    updateEnemies(dt);
    if (mode !== 'playing') return;
    updateBullets(dt);
    if (mode !== 'playing') return;
    updateOrbs(dt);
    if (mode !== 'playing') return;
    updateFamiliars(dt);
    updateSmallEffects(dt);
    run.comboTimer = Math.max(0, run.comboTimer - dt);
    if (run.comboTimer <= 0) run.combo = 0;
    if (run.hudTimer >= 0.1) {
      run.hudTimer = 0;
      refreshHud();
    }
  }

  function refreshHud() {
    if (!run || !player) return;
    ui.timer.textContent = fmtTime(run.elapsed);
    ui.score.textContent = String(run.score).padStart(6, '0');
    ui.kills.textContent = String(run.kills);
    ui.health.style.width = `${clamp(player.health / player.maxHealth, 0, 1) * 100}%`;
    ui.healthLabel.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
    ui.ink.style.width = `${clamp(player.ink / player.maxInk, 0, 1) * 100}%`;
    ui.xp.style.width = `${clamp(player.xp / player.xpNeed, 0, 1) * 100}%`;
    ui.xpLabel.textContent = `${Math.floor(player.xp)} / ${player.xpNeed} XP`;
    ui.level.textContent = String(player.level);
    ui.dashReady.classList.toggle('cooling', player.dashCooldown > 0.08);
    const boss = enemies.find((enemy) => enemy.type === 'boss' && !enemy.dead);
    if (boss) {
      ui.bossPanel.classList.remove('hidden');
      ui.bossFill.style.width = `${clamp(boss.hp / boss.maxHp, 0, 1) * 100}%`;
      ui.bossLabel.textContent = `${Math.ceil(clamp(boss.hp / boss.maxHp, 0, 1) * 100)}%`;
    }
    ui.comboNumber.textContent = String(run.combo);
    ui.combo.classList.toggle('visible', run.combo >= 3 && run.comboTimer > 0);
  }

  function drawBackground(time) {
    ctx.fillStyle = '#090b12';
    ctx.fillRect(0, 0, width, height);
    const glowX = width * (mode === 'menu' ? 0.75 : 0.52);
    const glowY = height * (mode === 'menu' ? 0.52 : 0.47);
    const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(width, height) * 0.72);
    glow.addColorStop(0, mode === 'menu' ? 'rgba(39, 54, 62, .36)' : 'rgba(28, 42, 52, .26)');
    glow.addColorStop(0.52, 'rgba(18, 23, 36, .16)');
    glow.addColorStop(1, 'rgba(6, 8, 13, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = 0.6 + Math.sin(time * star.speed + star.phase) * 0.4;
      ctx.globalAlpha = star.alpha * twinkle;
      ctx.fillStyle = star.phase > 3.7 ? '#a5f6cf' : '#d9d9e9';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const spacing = 68;
    const offset = (time * 4) % spacing;
    ctx.strokeStyle = 'rgba(176, 196, 215, .027)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -spacing + offset; x < width + spacing; x += spacing) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = -spacing + offset; y < height + spacing; y += spacing) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    const vignette = ctx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.2, width * 0.5, height * 0.5, Math.max(width, height) * 0.74);
    vignette.addColorStop(0, 'rgba(2, 3, 7, 0)');
    vignette.addColorStop(1, 'rgba(2, 3, 7, .48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function drawAmbientSigil(time) {
    const cx = width * (width < 700 ? 0.72 : 0.77);
    const cy = height * 0.51;
    const scale = Math.min(width, height) * (width < 700 ? 0.29 : 0.3);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(time * 0.018);
    ctx.globalAlpha = 0.26;
    ctx.strokeStyle = '#80d9c1';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, scale * 0.89, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 3; i += 1) {
      const radius = scale * (0.38 + i * 0.2);
      ctx.beginPath();
      ctx.ellipse(0, 0, radius, radius * (i % 2 ? 0.7 : 1), time * 0.12 + i * 0.8, 0, TAU);
      ctx.strokeStyle = i === 1 ? 'rgba(255, 138, 202, .52)' : 'rgba(165, 246, 207, .45)';
      ctx.stroke();
    }
    ctx.rotate(-time * 0.06);
    ctx.beginPath();
    for (let i = 0; i <= 8; i += 1) {
      const angle = -Math.PI / 2 + i * TAU / 8;
      const radius = i % 2 ? scale * 0.43 : scale * 0.78;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = 'rgba(245, 223, 166, .38)';
    ctx.stroke();
    const core = ctx.createRadialGradient(0, 0, 1, 0, 0, scale * 0.2);
    core.addColorStop(0, 'rgba(174, 255, 220, .75)');
    core.addColorStop(0.2, 'rgba(131, 220, 255, .15)');
    core.addColorStop(1, 'rgba(131, 220, 255, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, scale * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(time) {
    if (!player) return;
    const visible = player.invulnerable <= 0 || Math.floor(time * 20) % 2 === 0;
    if (!visible) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing + Math.PI / 2);
    const familiarCount = player.upgrades.familiar;
    for (let i = 0; i < familiarCount; i += 1) {
      const a = time * (1.3 + i * 0.12) + i * TAU / familiarCount;
      const fx = Math.cos(a) * 28;
      const fy = Math.sin(a) * 28;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffe5a0';
      ctx.fillStyle = '#ffe4a0';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.6, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, 30);
    glow.addColorStop(0, 'rgba(165, 246, 207, .56)');
    glow.addColorStop(0.42, 'rgba(105, 222, 183, .16)');
    glow.addColorStop(1, 'rgba(105, 222, 183, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();
    ctx.shadowColor = '#a5f6cf';
    ctx.shadowBlur = 18;
    ctx.fillStyle = player.hurtFlash > 0 ? '#fff4f7' : '#cfffe8';
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.quadraticCurveTo(13, -8, 9, 3);
    ctx.lineTo(0, 12);
    ctx.lineTo(-9, 3);
    ctx.quadraticCurveTo(-13, -8, 0, -15);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(232, 255, 244, .85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, 9);
    ctx.moveTo(-7, 1);
    ctx.lineTo(0, -2);
    ctx.lineTo(7, 1);
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(enemy, time) {
    if (enemy.dead) return;
    const pulse = 1 + Math.sin(time * 3.1 + enemy.phase) * 0.045;
    const fill = enemy.flash > 0 ? '#fff5fa' : enemy.color;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.age * (enemy.type === 'rake' ? 1.7 : 0.28) + enemy.phase);
    ctx.scale(pulse, pulse);
    ctx.shadowBlur = enemy.type === 'boss' ? 31 : 17;
    ctx.shadowColor = enemy.color;
    ctx.globalAlpha = enemy.type === 'boss' ? 0.95 : 0.91;

    if (enemy.type === 'boss') {
      ctx.strokeStyle = 'rgba(255, 107, 162, .4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * (1.12 + i * 0.21), time * (i % 2 ? -0.45 : 0.35) + i, time * (i % 2 ? -0.45 : 0.35) + i + Math.PI * (1.25 + i * 0.13));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(243, 74, 132, .2)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, TAU);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i < 16; i += 1) {
        const a = i * TAU / 16;
        const r = i % 2 ? enemy.radius * 0.69 : enemy.radius * 1.04;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#401c3a';
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.radius * 0.42, enemy.radius * 0.28, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff1d9';
      ctx.shadowBlur = 17;
      ctx.shadowColor = '#ffc1dc';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.12, 0, TAU);
      ctx.fill();
    } else if (enemy.type === 'shooter') {
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 1.14, 0, TAU);
      ctx.stroke();
      ctx.rotate(-enemy.age * 1.5);
      ctx.fillStyle = fill;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(Math.cos(i * TAU / 4) * enemy.radius * 0.76, Math.sin(i * TAU / 4) * enemy.radius * 0.76, 4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#271523';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.46, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe0f0';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, TAU);
      ctx.fill();
    } else if (enemy.type === 'brute') {
      ctx.fillStyle = 'rgba(255, 201, 137, .25)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 1.24, 0, TAU);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = i * TAU / 10;
        const r = enemy.radius * (i % 2 ? 0.79 : 1.08);
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3b2a27';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe8c1';
      ctx.fillRect(-5, -2, 3, 3);
      ctx.fillRect(3, -2, 3, 3);
    } else if (enemy.type === 'rake' || enemy.type === 'runt') {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(0, -enemy.radius * 1.45);
      ctx.lineTo(enemy.radius * 0.8, -enemy.radius * 0.16);
      ctx.lineTo(enemy.radius * 0.55, enemy.radius * 0.8);
      ctx.lineTo(0, enemy.radius * 0.38);
      ctx.lineTo(-enemy.radius * 0.55, enemy.radius * 0.8);
      ctx.lineTo(-enemy.radius * 0.8, -enemy.radius * 0.16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#302039';
      ctx.fillRect(-4, -1, 2.5, 3);
      ctx.fillRect(2, -1, 2.5, 3);
    } else {
      ctx.fillStyle = 'rgba(207, 180, 255, .22)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 1.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, enemy.radius * 0.82, enemy.radius * 0.68, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#30253e';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#f5eaff';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius * 0.16, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    if (enemy.type !== 'boss' && enemy.hp < enemy.maxHp) {
      const barWidth = enemy.radius * 2.1;
      ctx.fillStyle = 'rgba(5, 6, 11, .75)';
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 8, barWidth, 2.5);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - barWidth / 2, enemy.y - enemy.radius - 8, barWidth * clamp(enemy.hp / enemy.maxHp, 0, 1), 2.5);
    }
    if (enemy.type === 'boss' && enemy.attackTimer < 0.48) {
      const alpha = (0.48 - enemy.attackTimer) * 1.2;
      ctx.strokeStyle = `rgba(255, 97, 145, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + 18 + Math.sin(time * 30) * 3, 0, TAU);
      ctx.stroke();
    }
  }

  function drawOrbs(time) {
    for (const orb of orbs) {
      const pulse = 1 + Math.sin(time * 4 + orb.phase) * 0.2;
      const color = orb.boss ? '#ffe09a' : '#f3cc88';
      ctx.save();
      ctx.shadowBlur = orb.boss ? 21 : 12;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * pulse, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, .8)';
      ctx.beginPath();
      ctx.arc(orb.x - orb.radius * 0.22, orb.y - orb.radius * 0.22, orb.radius * 0.32, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBullets() {
    for (const bullet of bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      ctx.globalAlpha = clamp(bullet.life * 2, 0, 1);
      ctx.shadowBlur = 13;
      ctx.shadowColor = bullet.color;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, bullet.radius * 1.9, bullet.radius, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const particle of particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius * (0.45 + alpha * 0.65), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawBeams() {
    for (const beam of beams) {
      const alpha = clamp(beam.life / beam.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = beam.width;
      ctx.shadowBlur = 18;
      ctx.shadowColor = beam.color;
      ctx.beginPath();
      beam.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255, 255, 255, .85)';
      ctx.lineWidth = Math.max(0.8, beam.width * 0.32);
      ctx.beginPath();
      beam.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRings() {
    for (const ring of rings) {
      const alpha = clamp(ring.life / ring.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * (ring.line ? 0.85 : 0.36);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.line ? 2 : Math.max(1, 8 * alpha);
      ctx.shadowBlur = ring.line ? 15 : 20;
      ctx.shadowColor = ring.color;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawStroke() {
    if (!stroke || stroke.points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(195, 255, 226, .92)';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 17;
    ctx.shadowColor = '#a5f6cf';
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawText() {
    for (const item of floatingText) {
      ctx.save();
      ctx.globalAlpha = clamp(item.life / item.maxLife, 0, 1);
      ctx.fillStyle = item.color;
      ctx.textAlign = 'center';
      ctx.font = `500 ${item.size}px "DM Mono", monospace`;
      ctx.shadowBlur = 9;
      ctx.shadowColor = 'rgba(5, 6, 10, .8)';
      ctx.fillText(item.text, item.x, item.y);
      ctx.restore();
    }
  }

  function render() {
    drawBackground(ambientTime);
    if (mode === 'menu') {
      drawAmbientSigil(ambientTime);
      return;
    }
    ctx.save();
    if (shake > 0.1) ctx.translate(shakeX, shakeY);
    drawRings();
    drawOrbs(ambientTime);
    drawBullets();
    for (const enemy of enemies) drawEnemy(enemy, ambientTime);
    drawParticles();
    drawBeams();
    drawPlayer(ambientTime);
    drawStroke();
    drawText();
    ctx.restore();
  }

  function animationFrame(now) {
    const dt = Math.min(0.034, Math.max(0, (now - frameTime) / 1000));
    frameTime = now;
    ambientTime += dt;
    if (mode === 'playing') update(dt);
    render();
    window.requestAnimationFrame(animationFrame);
  }

  ui.start.addEventListener('click', () => startRun(false));
  ui.daily.addEventListener('click', () => startRun(true));
  ui.homeSound.addEventListener('click', toggleSound);
  ui.sound.addEventListener('click', toggleSound);
  $('pause-button').addEventListener('click', pauseGame);
  $('resume-button').addEventListener('click', resumeGame);
  $('again-button').addEventListener('click', () => startRun(run ? run.daily : false));
  ui.dashTouch.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    startDash();
  });

  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  canvas.addEventListener('pointermove', pointerMove, { passive: true });
  canvas.addEventListener('pointerup', pointerUp, { passive: false });
  canvas.addEventListener('pointercancel', pointerCancel, { passive: true });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', () => { keys.clear(); joystick = null; stroke = null; });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') pauseGame();
    frameTime = performance.now();
  });

  resize();
  refreshHomeRecord();
  window.requestAnimationFrame(animationFrame);
})();
