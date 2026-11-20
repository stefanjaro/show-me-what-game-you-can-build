"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  titlePanel: document.getElementById("titlePanel"),
  upgradePanel: document.getElementById("upgradePanel"),
  pausePanel: document.getElementById("pausePanel"),
  gameOverPanel: document.getElementById("gameOverPanel"),
  bottomHud: document.getElementById("bottomHud"),
  titleBestScore: document.getElementById("titleBestScore"),
  titleRuns: document.getElementById("titleRuns"),
  soundButton: document.getElementById("soundButton"),
  pauseButton: document.getElementById("pauseButton"),
  resumeButton: document.getElementById("resumeButton"),
  quitButton: document.getElementById("quitButton"),
  restartButton: document.getElementById("restartButton"),
  shareButton: document.getElementById("shareButton"),
  startButton: document.getElementById("startButton"),
  dailyButton: document.getElementById("dailyButton"),
  howToButton: document.getElementById("howToButton"),
  howToPanel: document.getElementById("howToPanel"),
  upgradeCards: document.getElementById("upgradeCards"),
  sectorLabel: document.getElementById("sectorLabel"),
  waveLabel: document.getElementById("waveLabel"),
  hullValue: document.getElementById("hullValue"),
  hullBar: document.getElementById("hullBar"),
  novaValue: document.getElementById("novaValue"),
  novaBar: document.getElementById("novaBar"),
  scoreValue: document.getElementById("scoreValue"),
  comboReadout: document.getElementById("comboReadout"),
  comboValue: document.getElementById("comboValue"),
  coordReadout: document.getElementById("coordReadout"),
  threatReadout: document.getElementById("threatReadout"),
  seedReadout: document.getElementById("seedReadout"),
  fpsReadout: document.getElementById("fpsReadout"),
  finalScore: document.getElementById("finalScore"),
  finalWave: document.getElementById("finalWave"),
  finalShards: document.getElementById("finalShards"),
  gameOverTitle: document.getElementById("gameOverTitle"),
  gameOverCopy: document.getElementById("gameOverCopy"),
  newRecord: document.getElementById("newRecord"),
  toastStack: document.getElementById("toastStack"),
  touchStick: document.getElementById("touchStick"),
  touchStickKnob: document.querySelector("#touchStick i"),
  dashTouch: document.getElementById("dashTouch"),
  novaTouch: document.getElementById("novaTouch")
};

const palette = {
  cyan: "#6ee9ff",
  pink: "#ff6fb5",
  amber: "#ffc86b",
  violet: "#9b8cff",
  danger: "#ff5e7d",
  white: "#edf4ff"
};

const view = { width: window.innerWidth, height: window.innerHeight, dpr: 1 };
const pointer = { x: view.width * 0.68, y: view.height * 0.45, down: false, active: false };
const keys = new Set();
const touchVector = { x: 0, y: 0, active: false, pointerId: null };
let lastFrame = performance.now();
let uiClock = 0;
let audioContext = null;
let soundOn = readStorage("starforgeSound", "on") !== "off";
let rng = Math.random;

const state = {
  mode: "title",
  daily: false,
  runDate: "",
  time: 0,
  wave: 1,
  waveTimer: 0,
  waveDuration: 34,
  sector: 1,
  seed: 0,
  score: 0,
  shards: 0,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  spawnClock: 0,
  shake: 0,
  flash: 0,
  slowMo: 0,
  fps: 60,
  enemyId: 0,
  player: null,
  enemies: [],
  bullets: [],
  enemyBullets: [],
  pickups: [],
  particles: [],
  floaters: [],
  rings: [],
  stars: [],
  upgradeChoices: [],
  lastShotSound: -1
};

const upgradePool = [
  {
    id: "twin",
    icon: "//",
    name: "Twin Comets",
    tag: "WEAPON / SPREAD",
    description: "Add one comet to every volley. Your spread widens just enough to make the void nervous.",
    apply() {
      state.player.shots += 1;
      state.player.spread += 0.055;
    }
  },
  {
    id: "overclock",
    icon: ">>",
    name: "Overclock",
    tag: "WEAPON / TEMPO",
    description: "Fire rate improves by 18%. More light, less waiting, considerably more trouble.",
    apply() {
      state.player.fireRate = Math.max(0.055, state.player.fireRate * 0.82);
    }
  },
  {
    id: "heavy",
    icon: "++",
    name: "Heavy Pulse",
    tag: "WEAPON / FORCE",
    description: "Increase projectile damage by 34%. Each hit now arrives with a personal grudge.",
    apply() {
      state.player.damage *= 1.34;
      state.player.bulletSize += 1;
    }
  },
  {
    id: "prism",
    icon: "*",
    name: "Prism Heart",
    tag: "WEAPON / CRITICAL",
    description: "Gain 14% critical chance. Critical comets burst into a small flash on impact.",
    apply() {
      state.player.crit += 0.14;
    }
  },
  {
    id: "moonlets",
    icon: "()",
    name: "Moonlets",
    tag: "DEFENSE / ORBITAL",
    description: "Summon an orbiting blade that shreds anything reckless enough to get close.",
    apply() {
      state.player.orbiters += 1;
      state.player.orbitHitTimers.push(0);
    }
  },
  {
    id: "slipstream",
    icon: "^",
    name: "Slipstream",
    tag: "PILOT / MOBILITY",
    description: "Move 17% faster and reduce dash cooldown by 16%. Motion is a survival strategy.",
    apply() {
      state.player.speed *= 1.17;
      state.player.dashMax = Math.max(0.7, state.player.dashMax * 0.84);
    }
  },
  {
    id: "faraday",
    icon: "[]",
    name: "Faraday Skin",
    tag: "HULL / RESILIENCE",
    description: "Max hull rises by 24 and the new plating arrives fully charged.",
    apply() {
      state.player.maxHp += 24;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 24);
    }
  },
  {
    id: "magnet",
    icon: "O",
    name: "Star Magnet",
    tag: "SALVAGE / RANGE",
    description: "Pull star-shards from twice as far away. Salvage value increases by 20%.",
    apply() {
      state.player.magnet += 115;
      state.player.shardBonus += 0.2;
    }
  },
  {
    id: "nova",
    icon: "@@",
    name: "Nova Bloom",
    tag: "NOVA / CATASTROPHE",
    description: "Nova damage and radius increase by 28%. The emergency button becomes a lifestyle.",
    apply() {
      state.player.novaDamage *= 1.28;
      state.player.novaRadius += 42;
    }
  },
  {
    id: "needle",
    icon: "|",
    name: "Needlepoint",
    tag: "WEAPON / PIERCING",
    description: "Comets pierce one extra target. Lines are about to become your favorite shape.",
    apply() {
      state.player.piercing += 1;
    }
  },
  {
    id: "resonance",
    icon: "~",
    name: "Resonance",
    tag: "NOVA / CHARGE",
    description: "All star-shards and kills feed 28% more Nova charge. Keep the rhythm alive.",
    apply() {
      state.player.energyGain *= 1.28;
    }
  },
  {
    id: "bloodlight",
    icon: "+",
    name: "Bloodlight",
    tag: "HULL / LEECH",
    description: "Recover 1 hull for every 4 kills. The dark can pay its debts after all.",
    apply() {
      state.player.healEvery += 1;
    }
  }
];

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (error) {
    // Storage can be disabled in private browsing; the run still works.
  }
}

function numberStorage(key) {
  const value = Number(readStorage(key, "0"));
  return Number.isFinite(value) ? value : 0;
}

function pad(value, length) {
  return String(Math.max(0, Math.floor(value))).padStart(length, "0");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

function randomBetween(min, max) {
  return min + (max - min) * rng();
}

function choose(list) {
  return list[Math.floor(rng() * list.length)];
}

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function resizeCanvas() {
  view.width = window.innerWidth;
  view.height = window.innerHeight;
  view.dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(view.width * view.dpr);
  canvas.height = Math.floor(view.height * view.dpr);
  canvas.style.width = `${view.width}px`;
  canvas.style.height = `${view.height}px`;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  if (state.player) {
    state.player.x = clamp(state.player.x, 26, view.width - 26);
    state.player.y = clamp(state.player.y, 92, view.height - 90);
  }
}

function createStars() {
  state.stars = [];
  for (let i = 0; i < 145; i += 1) {
    state.stars.push({
      x: Math.random() * view.width,
      y: Math.random() * view.height,
      size: Math.random() * 1.6 + 0.25,
      depth: Math.random() * 0.9 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
      tint: Math.random() > 0.84 ? (Math.random() > 0.5 ? palette.pink : palette.cyan) : palette.white
    });
  }
}

function createPlayer() {
  return {
    x: view.width * 0.5,
    y: view.height * 0.52,
    vx: 0,
    vy: 0,
    r: 12,
    angle: -Math.PI / 2,
    speed: 245,
    maxHp: 100,
    hp: 100,
    maxEnergy: 100,
    energy: 0,
    energyGain: 1,
    damage: 22,
    fireRate: 0.18,
    fireTimer: 0,
    bulletSpeed: 710,
    bulletSize: 3.4,
    shots: 1,
    spread: 0.07,
    piercing: 0,
    crit: 0.08,
    magnet: 80,
    shardBonus: 0,
    novaRadius: 215,
    novaDamage: 105,
    dashMax: 1.75,
    dashCooldown: 0,
    dashTimer: 0,
    dashVX: 0,
    dashVY: 0,
    invuln: 1.5,
    orbiters: 0,
    orbitAngle: 0,
    orbitHitTimers: [],
    healEvery: 0,
    killCounter: 0,
    lastMoveX: 0,
    lastMoveY: -1,
    upgrades: {}
  };
}

function initAudio() {
  if (!soundOn) return;
  if (!audioContext) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioContext = new AudioCtor();
  }
  if (audioContext.state === "suspended") audioContext.resume();
}

function tone(frequency, duration, type = "sine", volume = 0.035, slide = 0) {
  if (!soundOn || !audioContext) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slide) oscillator.frequency.linearRampToValueAtTime(frequency + slide, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.018, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.015);
}

function noise(duration = 0.06, volume = 0.018) {
  if (!soundOn || !audioContext) return;
  const buffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * duration), audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  gain.gain.value = volume;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
}

function playSfx(name) {
  if (!soundOn) return;
  if (name === "fire") tone(240, 0.045, "triangle", 0.018, 110);
  if (name === "hit") tone(110, 0.055, "square", 0.018, -30);
  if (name === "crit") tone(470, 0.12, "sine", 0.038, 210);
  if (name === "dash") { tone(160, 0.16, "sawtooth", 0.03, 440); noise(0.08, 0.012); }
  if (name === "nova") { tone(90, 0.48, "sine", 0.05, 520); tone(280, 0.24, "triangle", 0.035, -90); noise(0.24, 0.024); }
  if (name === "pickup") tone(660, 0.11, "sine", 0.028, 260);
  if (name === "wave") { tone(320, 0.12, "triangle", 0.035, 120); tone(480, 0.22, "sine", 0.034, 140); }
  if (name === "upgrade") { tone(390, 0.16, "sine", 0.04, 180); tone(620, 0.24, "sine", 0.035, 80); }
  if (name === "hurt") { tone(90, 0.16, "square", 0.04, -45); noise(0.1, 0.022); }
}

function showToast(message, color = "cyan") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  if (color === "amber") toast.style.color = palette.amber;
  if (color === "pink") toast.style.color = palette.pink;
  ui.toastStack.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2850);
}

function setMode(mode) {
  state.mode = mode;
  ui.titlePanel.hidden = mode !== "title";
  ui.upgradePanel.hidden = mode !== "upgrade";
  ui.pausePanel.hidden = mode !== "paused";
  ui.gameOverPanel.hidden = mode !== "gameover";
  ui.bottomHud.style.opacity = mode === "title" ? "0" : "1";
  ui.pauseButton.style.visibility = mode === "title" || mode === "gameover" ? "hidden" : "visible";
  if (mode === "paused") ui.pauseButton.textContent = "RESUME  P";
  else ui.pauseButton.innerHTML = "PAUSE <kbd>P</kbd>";
  updateTitleStats();
}

function updateTitleStats() {
  ui.titleBestScore.textContent = pad(numberStorage("starforgeBest"), 6);
  ui.titleRuns.textContent = pad(numberStorage("starforgeRuns"), 2);
}

function dailyDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function dailySeed() {
  let hash = 2166136261;
  for (const character of dailyDateKey()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function beginRun(seedOverride = null, daily = false) {
  initAudio();
  const seed = seedOverride === null ? (Date.now() ^ Math.floor(Math.random() * 0xFFFFFFFF)) >>> 0 : seedOverride;
  state.seed = seed;
  state.daily = daily;
  state.runDate = daily ? dailyDateKey() : "";
  rng = mulberry32(seed);
  state.wave = 1;
  state.waveTimer = -2.2;
  state.waveDuration = 34;
  state.sector = 1;
  state.score = 0;
  state.shards = 0;
  state.kills = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.spawnClock = 1.3;
  state.shake = 0;
  state.flash = 0.22;
  state.slowMo = 0;
  state.enemyId = 0;
  state.player = createPlayer();
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.pickups = [];
  state.particles = [];
  state.floaters = [];
  state.rings = [];
  pointer.down = false;
  pointer.active = false;
  ui.seedReadout.textContent = seed.toString(36).toUpperCase().padStart(8, "0").slice(-8);
  setMode("playing");
  showToast(`${daily ? "DAILY SIGNAL" : "SIGNAL LOCKED"} // WAVE 01`, daily ? "amber" : "cyan");
  tone(220, 0.22, "sine", 0.04, 180);
  tone(440, 0.34, "triangle", 0.025, 80);
}

function abandonRun() {
  state.player = null;
  state.enemies = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.pickups = [];
  setMode("title");
  pointer.down = false;
}

function togglePause() {
  if (state.mode === "playing") {
    setMode("paused");
    pointer.down = false;
  } else if (state.mode === "paused") {
    initAudio();
    setMode("playing");
  }
}

function completeWave() {
  if (state.mode !== "playing") return;
  state.score += state.wave * 500;
  state.flash = 0.13;
  state.shake = 7;
  state.rings.push({ x: view.width * 0.5, y: view.height * 0.5, radius: 30, maxRadius: Math.max(view.width, view.height) * 0.55, life: 1, maxLife: 1, color: palette.amber, width: 3 });
  for (let i = 0; i < 38; i += 1) emitParticle(view.width * 0.5, view.height * 0.5, palette.amber, { speed: randomBetween(80, 330), life: randomBetween(0.5, 1.4), size: randomBetween(1, 3) });
  state.upgradeChoices = buildUpgradeChoices();
  renderUpgradeCards();
  setMode("upgrade");
  playSfx("wave");
}

function buildUpgradeChoices() {
  const choices = [];
  const pool = [...upgradePool];
  while (choices.length < 3 && pool.length) {
    const index = Math.floor(rng() * pool.length);
    choices.push(pool.splice(index, 1)[0]);
  }
  return choices;
}

function renderUpgradeCards() {
  ui.upgradeCards.innerHTML = "";
  state.upgradeChoices.forEach((upgrade, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "upgrade-card";
    card.innerHTML = `<span class="card-number">0${index + 1} / SIGNAL</span><span class="card-icon">${upgrade.icon}</span><span class="card-name">${upgrade.name}</span><span class="card-tag">${upgrade.tag}</span><span class="card-description">${upgrade.description}</span>`;
    card.addEventListener("click", () => chooseUpgrade(index));
    ui.upgradeCards.appendChild(card);
  });
}

function chooseUpgrade(index) {
  if (state.mode !== "upgrade" || !state.upgradeChoices[index]) return;
  const upgrade = state.upgradeChoices[index];
  upgrade.apply();
  state.player.upgrades[upgrade.id] = (state.player.upgrades[upgrade.id] || 0) + 1;
  state.wave += 1;
  state.sector = Math.ceil(state.wave / 3);
  state.waveDuration = Math.min(49, 34 + state.wave * 1.5);
  state.waveTimer = -2.35;
  state.spawnClock = 1.4;
  state.enemies = [];
  state.enemyBullets = [];
  state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + 17);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + 6);
  state.flash = 0.18;
  state.rings.push({ x: state.player.x, y: state.player.y, radius: 8, maxRadius: 110, life: 0.7, maxLife: 0.7, color: palette.cyan, width: 2 });
  setMode("playing");
  showToast(`${upgrade.name.toUpperCase()} // WAVE ${pad(state.wave, 2)}`);
  playSfx("upgrade");
}

function movementVector() {
  let x = 0;
  let y = 0;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
  if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
  if (touchVector.active) {
    x = touchVector.x;
    y = touchVector.y;
  }
  const length = Math.hypot(x, y);
  if (length > 1) return { x: x / length, y: y / length };
  return { x, y };
}

function aimAngle() {
  if (pointer.active) return Math.atan2(pointer.y - state.player.y, pointer.x - state.player.x);
  return Math.atan2(state.player.lastMoveY, state.player.lastMoveX);
}

function updatePlayer(dt) {
  const p = state.player;
  const movement = movementVector();
  p.angle = aimAngle();
  if (movement.x || movement.y) {
    p.lastMoveX = movement.x;
    p.lastMoveY = movement.y;
  }

  p.fireTimer -= dt;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.orbitAngle += dt * (1.5 + p.orbiters * 0.08);

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    p.x += p.dashVX * dt;
    p.y += p.dashVY * dt;
    if (Math.random() < 0.8) emitParticle(p.x, p.y, palette.cyan, { speed: 20, life: 0.35, size: randomBetween(2, 5), drag: 0.8 });
  } else {
    const targetX = movement.x * p.speed;
    const targetY = movement.y * p.speed;
    p.vx = lerp(p.vx, targetX, Math.min(1, dt * 10));
    p.vy = lerp(p.vy, targetY, Math.min(1, dt * 10));
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  p.x = clamp(p.x, 25, view.width - 25);
  p.y = clamp(p.y, 88, view.height - (view.width < 720 ? 235 : 88));

  if ((pointer.down || keys.has("Space")) && state.waveTimer >= 0) firePlayer();
  updateOrbiters(dt);
}

function firePlayer() {
  const p = state.player;
  if (p.fireTimer > 0 || p.dashTimer > 0) return;
  p.fireTimer = p.fireRate;
  const volley = p.shots;
  const baseAngle = p.angle;
  for (let i = 0; i < volley; i += 1) {
    const centered = i - (volley - 1) / 2;
    const angle = baseAngle + centered * p.spread + randomBetween(-0.009, 0.009);
    state.bullets.push({
      x: p.x + Math.cos(angle) * 16,
      y: p.y + Math.sin(angle) * 16,
      vx: Math.cos(angle) * p.bulletSpeed,
      vy: Math.sin(angle) * p.bulletSpeed,
      r: p.bulletSize,
      damage: p.damage,
      life: 1.5,
      piercing: p.piercing,
      hits: new Set(),
      color: i % 2 ? palette.cyan : palette.white
    });
  }
  emitParticle(p.x + Math.cos(baseAngle) * 15, p.y + Math.sin(baseAngle) * 15, palette.cyan, { speed: 75, angle: baseAngle, spread: 0.45, life: 0.22, size: 2 });
  if (state.time - state.lastShotSound > 0.075) {
    playSfx("fire");
    state.lastShotSound = state.time;
  }
}

function triggerDash() {
  if (state.mode !== "playing" || !state.player || state.player.dashCooldown > 0) return;
  initAudio();
  const p = state.player;
  let direction = movementVector();
  if (!direction.x && !direction.y) direction = { x: Math.cos(p.angle), y: Math.sin(p.angle) };
  p.dashVX = direction.x * 700;
  p.dashVY = direction.y * 700;
  p.dashTimer = 0.2;
  p.dashCooldown = p.dashMax;
  p.invuln = Math.max(p.invuln, 0.42);
  state.shake = Math.max(state.shake, 5);
  state.rings.push({ x: p.x, y: p.y, radius: 8, maxRadius: 74, life: 0.42, maxLife: 0.42, color: palette.cyan, width: 2 });
  for (let i = 0; i < 18; i += 1) emitParticle(p.x, p.y, palette.cyan, { speed: randomBetween(80, 230), angle: Math.atan2(direction.y, direction.x) + Math.PI + randomBetween(-0.5, 0.5), spread: 0.4, life: randomBetween(0.25, 0.55), size: randomBetween(1, 3) });
  playSfx("dash");
}

function triggerNova() {
  if (state.mode !== "playing" || !state.player) return;
  initAudio();
  const p = state.player;
  if (p.energy < p.maxEnergy) {
    showToast("NOVA CHARGE INCOMPLETE", "amber");
    tone(130, 0.07, "square", 0.02, -20);
    return;
  }
  p.energy = 0;
  state.flash = 0.42;
  state.shake = 16;
  state.enemyBullets = [];
  state.rings.push({ x: p.x, y: p.y, radius: 10, maxRadius: p.novaRadius, life: 0.9, maxLife: 0.9, color: palette.amber, width: 5 });
  for (let i = 0; i < 110; i += 1) emitParticle(p.x, p.y, i % 3 ? palette.amber : palette.cyan, { speed: randomBetween(120, 580), life: randomBetween(0.45, 1.35), size: randomBetween(1, 4) });
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const d = distance(p.x, p.y, enemy.x, enemy.y);
    if (d < p.novaRadius * 1.25) {
      const falloff = 1 - Math.min(0.7, d / (p.novaRadius * 1.5));
      damageEnemy(enemy, p.novaDamage * falloff, true);
    }
  }
  showToast("NOVA RELEASED // THE SKY BREAKS", "amber");
  playSfx("nova");
}

function updateOrbiters(dt) {
  const p = state.player;
  for (let i = 0; i < p.orbiters; i += 1) {
    p.orbitHitTimers[i] = Math.max(0, (p.orbitHitTimers[i] || 0) - dt);
    const angle = p.orbitAngle + (Math.PI * 2 * i) / Math.max(1, p.orbiters);
    const ox = p.x + Math.cos(angle) * (28 + p.orbiters * 2);
    const oy = p.y + Math.sin(angle) * (28 + p.orbiters * 2);
    if (p.orbitHitTimers[i] <= 0) {
      const target = state.enemies.find(enemy => !enemy.dead && distance(ox, oy, enemy.x, enemy.y) < enemy.r + 8);
      if (target) {
        damageEnemy(target, p.damage * 0.5, false);
        p.orbitHitTimers[i] = 0.28;
        state.rings.push({ x: ox, y: oy, radius: 5, maxRadius: 25, life: 0.2, maxLife: 0.2, color: palette.violet, width: 2 });
      }
    }
  }
}

function spawnEnemy() {
  const edge = Math.floor(rng() * 4);
  const margin = 42;
  let x;
  let y;
  if (edge === 0) { x = randomBetween(-margin, view.width + margin); y = 76 - margin; }
  if (edge === 1) { x = view.width + margin; y = randomBetween(90, view.height - 90); }
  if (edge === 2) { x = randomBetween(-margin, view.width + margin); y = view.height - 72 + margin; }
  if (edge === 3) { x = -margin; y = randomBetween(90, view.height - 90); }
  const wave = state.wave;
  const roll = rng();
  let type = "shard";
  if (wave >= 2 && roll > 0.68) type = "hunter";
  if (wave >= 3 && roll > 0.82) type = "charger";
  if (wave >= 4 && roll > 0.91) type = "splitter";
  if (wave >= 6 && roll > 0.96) type = "warden";
  const scale = 1 + (wave - 1) * 0.105;
  const definitions = {
    shard: { r: 13, hp: 36, speed: 55, damage: 15, value: 82, energy: 5, color: palette.cyan },
    hunter: { r: 16, hp: 66, speed: 81, damage: 20, value: 145, energy: 8, color: palette.pink },
    charger: { r: 17, hp: 92, speed: 48, damage: 27, value: 205, energy: 11, color: palette.amber },
    splitter: { r: 20, hp: 145, speed: 40, damage: 25, value: 260, energy: 16, color: palette.violet },
    warden: { r: 29, hp: 390, speed: 28, damage: 33, value: 700, energy: 30, color: palette.danger }
  };
  const definition = definitions[type];
  state.enemies.push({
    id: state.enemyId += 1,
    type,
    x,
    y,
    r: definition.r * (type === "warden" ? 1 + Math.min(0.3, (wave - 6) * 0.03) : 1),
    hp: definition.hp * scale,
    maxHp: definition.hp * scale,
    speed: definition.speed * (1 + Math.min(0.35, (wave - 1) * 0.025)),
    damage: definition.damage * (1 + (wave - 1) * 0.035),
    value: Math.round(definition.value * (1 + (wave - 1) * 0.07)),
    energy: definition.energy,
    color: definition.color,
    phase: rng() * Math.PI * 2,
    hitTimer: 0,
    shootTimer: randomBetween(1.1, 2.4),
    telegraph: 0,
    burst: 0,
    dirX: 0,
    dirY: 0,
    dead: false
  });
}

function chooseEnemyTypeName(type) {
  if (type === "hunter") return "HUNTER";
  if (type === "charger") return "CHARGER";
  if (type === "splitter") return "SPLITTER";
  if (type === "warden") return "WARDEN";
  return "SHARD";
}

function updateSpawning(dt) {
  if (state.waveTimer < 0) return;
  state.spawnClock -= dt;
  const cap = Math.min(44, 5 + state.wave * 2 + Math.floor(state.wave / 3));
  if (state.spawnClock <= 0 && state.enemies.filter(enemy => !enemy.dead).length < cap) {
    spawnEnemy();
    state.spawnClock = Math.max(0.25, randomBetween(0.65, 1.15) - state.wave * 0.018);
  }
}

function updateEnemies(dt) {
  const p = state.player;
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    let targetSpeed = enemy.speed;
    let moveAngle = Math.atan2(dy, dx);

    if (enemy.type === "hunter") {
      moveAngle += Math.sin(state.time * 3.3 + enemy.phase) * 0.55;
      targetSpeed *= 1 + Math.sin(state.time * 2 + enemy.phase) * 0.13;
    }

    if (enemy.type === "charger") {
      enemy.shootTimer -= dt;
      if (enemy.telegraph > 0) {
        enemy.telegraph -= dt;
        targetSpeed = 4;
        if (enemy.telegraph <= 0) enemy.burst = 0.65;
      } else if (enemy.burst > 0) {
        enemy.burst -= dt;
        moveAngle = Math.atan2(enemy.dirY, enemy.dirX);
        targetSpeed = enemy.speed * 4.4;
      } else {
        if (enemy.shootTimer <= 0 && d < 470) {
          enemy.telegraph = 0.62;
          enemy.dirX = dx / d;
          enemy.dirY = dy / d;
          enemy.shootTimer = 2.7;
          state.rings.push({ x: enemy.x, y: enemy.y, radius: enemy.r + 5, maxRadius: enemy.r + 17, life: 0.62, maxLife: 0.62, color: palette.amber, width: 2 });
        }
      }
    }

    if (enemy.type === "warden") {
      targetSpeed = enemy.speed;
      enemy.shootTimer -= dt;
      if (enemy.shootTimer <= 0) {
        enemy.shootTimer = Math.max(1.3, 2.55 - state.wave * 0.04);
        fireWarden(enemy, Math.atan2(dy, dx));
      }
    }

    const steer = enemy.type === "charger" && enemy.telegraph > 0 ? 0.05 : 0.11;
    enemy.x = lerp(enemy.x, enemy.x + Math.cos(moveAngle) * targetSpeed * dt, steer * 10);
    enemy.y = lerp(enemy.y, enemy.y + Math.sin(moveAngle) * targetSpeed * dt, steer * 10);

    if (d < enemy.r + p.r + 2 && enemy.hitTimer <= 0) {
      damagePlayer(enemy.damage);
      enemy.hitTimer = 0.75;
      const push = Math.atan2(enemy.y - p.y, enemy.x - p.x);
      enemy.x += Math.cos(push) * 12;
      enemy.y += Math.sin(push) * 12;
    }
  }
  state.enemies = state.enemies.filter(enemy => !enemy.dead && enemy.x > -150 && enemy.x < view.width + 150 && enemy.y > -150 && enemy.y < view.height + 150);
}

function fireWarden(enemy, angle) {
  for (let i = 0; i < 7; i += 1) {
    const direction = angle + (i - 3) * 0.16;
    state.enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(direction) * 190,
      vy: Math.sin(direction) * 190,
      r: 5,
      life: 4,
      damage: 14 + state.wave,
      color: palette.danger
    });
  }
  state.rings.push({ x: enemy.x, y: enemy.y, radius: enemy.r, maxRadius: enemy.r + 17, life: 0.4, maxLife: 0.4, color: palette.danger, width: 2 });
  noise(0.08, 0.01);
}

function damagePlayer(amount) {
  const p = state.player;
  if (!p || p.invuln > 0 || state.mode !== "playing") return;
  p.hp -= amount;
  p.invuln = 0.72;
  state.shake = Math.max(state.shake, 10);
  state.flash = Math.max(state.flash, 0.16);
  for (let i = 0; i < 18; i += 1) emitParticle(p.x, p.y, palette.pink, { speed: randomBetween(45, 190), life: randomBetween(0.25, 0.7), size: randomBetween(1, 3) });
  playSfx("hurt");
  if (p.hp <= 0) endRun();
}

function damageEnemy(enemy, amount, critical = false) {
  if (enemy.dead) return;
  enemy.hp -= amount;
  const burstColor = critical ? palette.amber : enemy.color;
  for (let i = 0; i < (critical ? 5 : 2); i += 1) emitParticle(enemy.x, enemy.y, burstColor, { speed: randomBetween(25, 120), life: randomBetween(0.18, 0.4), size: randomBetween(1, 2.5) });
  if (critical) {
    state.rings.push({ x: enemy.x, y: enemy.y, radius: 5, maxRadius: 34, life: 0.24, maxLife: 0.24, color: palette.amber, width: 2 });
    playSfx("crit");
  } else if (Math.random() < 0.16) playSfx("hit");
  if (enemy.hp <= 0) destroyEnemy(enemy);
}

function destroyEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  state.kills += 1;
  state.combo += 1;
  state.comboTimer = 3.4;
  const multiplier = 1 + Math.min(12, state.combo) * 0.075;
  state.score += Math.round(enemy.value * multiplier);
  state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + enemy.energy * state.player.energyGain);
  state.player.killCounter += 1;
  if (state.player.healEvery && state.player.killCounter % (4 / state.player.healEvery) === 0) state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1);
  if (rng() < 0.72 || enemy.type === "warden") {
    state.pickups.push({ x: enemy.x, y: enemy.y, r: 7, value: 1, life: 10, phase: rng() * 6.28, color: enemy.type === "warden" ? palette.amber : palette.cyan });
  }
  const burstCount = enemy.type === "warden" ? 38 : enemy.type === "splitter" ? 24 : 13;
  for (let i = 0; i < burstCount; i += 1) emitParticle(enemy.x, enemy.y, i % 4 ? enemy.color : palette.white, { speed: randomBetween(45, enemy.type === "warden" ? 360 : 220), life: randomBetween(0.35, enemy.type === "warden" ? 1.3 : 0.75), size: randomBetween(1, enemy.type === "warden" ? 4 : 2.8) });
  state.rings.push({ x: enemy.x, y: enemy.y, radius: enemy.r * 0.5, maxRadius: enemy.r * 2.5, life: 0.42, maxLife: 0.42, color: enemy.color, width: enemy.type === "warden" ? 3 : 1.5 });
  state.shake = Math.max(state.shake, enemy.type === "warden" ? 8 : 2.5);
  addFloater(enemy.x, enemy.y - enemy.r - 8, `+${Math.round(enemy.value * multiplier)}`, enemy.color);
  if (enemy.type === "splitter") {
    for (let i = 0; i < 2; i += 1) spawnFragment(enemy.x, enemy.y, i);
  }
}

function spawnFragment(x, y, index) {
  state.enemies.push({
    id: state.enemyId += 1,
    type: "shard",
    x: x + (index ? 12 : -12),
    y: y + (index ? -8 : 8),
    r: 8,
    hp: 20 * (1 + state.wave * 0.1),
    maxHp: 20 * (1 + state.wave * 0.1),
    speed: 92,
    damage: 10,
    value: 58,
    energy: 3,
    color: palette.violet,
    phase: rng() * 6.28,
    hitTimer: 0,
    shootTimer: 4,
    telegraph: 0,
    burst: 0,
    dirX: index ? 1 : -1,
    dirY: -0.3,
    dead: false
  });
}

function updateBullets(dt) {
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (Math.random() < 0.7) emitParticle(bullet.x, bullet.y, bullet.color, { speed: 5, life: 0.15, size: bullet.r * 0.7, drag: 0.7 });
    for (const enemy of state.enemies) {
      if (enemy.dead || bullet.hits.has(enemy.id)) continue;
      if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < bullet.r + enemy.r) {
        bullet.hits.add(enemy.id);
        const critical = rng() < state.player.crit;
        damageEnemy(enemy, bullet.damage * (critical ? 2.2 : 1), critical);
        bullet.piercing -= 1;
        if (bullet.piercing < 0) {
          bullet.life = 0;
          break;
        }
      }
    }
  }
  state.bullets = state.bullets.filter(bullet => bullet.life > 0 && bullet.x > -60 && bullet.x < view.width + 60 && bullet.y > 40 && bullet.y < view.height + 60);

  for (const bullet of state.enemyBullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (state.player && distance(bullet.x, bullet.y, state.player.x, state.player.y) < bullet.r + state.player.r) {
      bullet.life = 0;
      damagePlayer(bullet.damage);
    }
  }
  state.enemyBullets = state.enemyBullets.filter(bullet => bullet.life > 0 && bullet.x > -50 && bullet.x < view.width + 50 && bullet.y > 40 && bullet.y < view.height + 50);
}

function updatePickups(dt) {
  const p = state.player;
  for (const pickup of state.pickups) {
    pickup.life -= dt;
    pickup.phase += dt * 3;
    const d = distance(pickup.x, pickup.y, p.x, p.y);
    if (d < p.magnet) {
      const pull = 1 - d / p.magnet;
      pickup.x = lerp(pickup.x, p.x, dt * (3 + pull * 8));
      pickup.y = lerp(pickup.y, p.y, dt * (3 + pull * 8));
    }
    if (d < p.r + pickup.r + 7) {
      pickup.life = 0;
      state.shards += 1;
      const value = Math.round(90 * (1 + p.shardBonus));
      state.score += value;
      p.energy = Math.min(p.maxEnergy, p.energy + 8 * p.energyGain);
      state.comboTimer = Math.max(state.comboTimer, 2.1);
      addFloater(pickup.x, pickup.y - 11, `+${value}`, pickup.color);
      for (let i = 0; i < 7; i += 1) emitParticle(pickup.x, pickup.y, pickup.color, { speed: randomBetween(30, 100), life: 0.4, size: randomBetween(1, 2.5) });
      playSfx("pickup");
    }
  }
  state.pickups = state.pickups.filter(pickup => pickup.life > 0);
}

function emitParticle(x, y, color, options = {}) {
  const speed = options.speed === undefined ? randomBetween(20, 110) : options.speed;
  const angle = options.angle === undefined ? randomBetween(0, Math.PI * 2) : options.angle + randomBetween(-(options.spread || Math.PI), options.spread || Math.PI);
  state.particles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: options.size === undefined ? randomBetween(1, 3) : options.size,
    life: options.life === undefined ? randomBetween(0.3, 0.8) : options.life,
    maxLife: options.life === undefined ? 0.8 : options.life,
    drag: options.drag === undefined ? 0.93 : options.drag,
    gravity: options.gravity || 0,
    color,
    square: options.square || false
  });
  if (state.particles.length > 900) state.particles.splice(0, 100);
}

function addFloater(x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9, vy: -24 });
}

function updateEffects(dt) {
  state.shake = Math.max(0, state.shake - dt * 19);
  state.flash = Math.max(0, state.flash - dt * 0.9);
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.vx *= Math.pow(particle.drag, dt * 60);
    particle.vy *= Math.pow(particle.drag, dt * 60);
    particle.vy += particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
  state.particles = state.particles.filter(particle => particle.life > 0);
  for (const floater of state.floaters) {
    floater.life -= dt;
    floater.y += floater.vy * dt;
  }
  state.floaters = state.floaters.filter(floater => floater.life > 0);
  for (const ring of state.rings) {
    ring.life -= dt;
    const progress = 1 - ring.life / ring.maxLife;
    ring.radius = lerp(ring.radius, ring.maxRadius, Math.min(1, progress + dt * 0.8));
  }
  state.rings = state.rings.filter(ring => ring.life > 0);
}

function updateStars(dt) {
  for (const star of state.stars) {
    star.y += star.depth * dt * 4.5;
    star.twinkle += dt * (0.6 + star.depth * 1.4);
    if (star.y > view.height + 3) {
      star.y = -3;
      star.x = Math.random() * view.width;
    }
  }
}

function update(dt) {
  state.time += dt;
  updateStars(dt);
  updateEffects(dt);
  if (state.mode === "title") return;
  if (state.mode === "paused" || state.mode === "upgrade") return;
  if (state.mode === "gameover") return;
  if (!state.player) return;

  if (state.waveTimer < 0) {
    state.waveTimer += dt;
    updatePlayer(dt);
    if (state.waveTimer >= 0) {
      showToast(`WAVE ${pad(state.wave, 2)} // SURVIVE`, "amber");
      playSfx("wave");
    }
  } else {
    state.waveTimer += dt;
    updateSpawning(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePickups(dt);
    if (state.waveTimer >= state.waveDuration) completeWave();
  }
  state.comboTimer -= dt;
  if (state.comboTimer <= 0) state.combo = 0;
}

function endRun() {
  if (state.mode === "gameover") return;
  setMode("gameover");
  pointer.down = false;
  state.flash = 0.28;
  state.shake = 14;
  const bestKey = state.daily ? `starforgeDailyBest_${state.runDate}` : "starforgeBest";
  const best = numberStorage(bestKey);
  const isRecord = state.score > best;
  writeStorage(bestKey, Math.max(best, state.score));
  writeStorage("starforgeBest", Math.max(numberStorage("starforgeBest"), state.score));
  writeStorage("starforgeRuns", numberStorage("starforgeRuns") + 1);
  ui.finalScore.textContent = pad(state.score, 6);
  ui.finalWave.textContent = pad(state.wave, 2);
  ui.finalShards.textContent = pad(state.shards, 3);
  ui.newRecord.hidden = !isRecord;
  ui.gameOverTitle.textContent = state.wave >= 8 ? "You bent the dark." : "The void remembers.";
  ui.gameOverCopy.textContent = state.daily
    ? (isRecord ? "A new daily signal burns across the local stars." : "The daily signal will reset when the stars do.")
    : (isRecord ? "A new signal burns across the local stars." : "Your light made it further than most.");
  ui.bottomHud.style.opacity = "1";
  playSfx("hurt");
  for (let i = 0; i < 65; i += 1) emitParticle(state.player.x, state.player.y, i % 2 ? palette.pink : palette.cyan, { speed: randomBetween(70, 370), life: randomBetween(0.6, 1.5), size: randomBetween(1, 4) });
  updateTitleStats();
}

async function shareRun() {
  if (state.mode !== "gameover") return;
  const mode = state.daily ? `DAILY SIGNAL ${state.runDate}` : "VOIDRUN";
  const result = `STARFORGE: VOIDRUN // ${mode}\nSCORE ${pad(state.score, 6)} // WAVE ${pad(state.wave, 2)} // SHARDS ${pad(state.shards, 3)}\nSEED ${state.seed.toString(36).toUpperCase().padStart(8, "0").slice(-8)}\nCan you forge a better run? ${window.location.href}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "STARFORGE: VOIDRUN", text: result });
      showToast("SIGNAL SHARED // CHALLENGE SENT");
      return;
    }
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(result);
    } else {
      const copyField = document.createElement("textarea");
      copyField.value = result;
      copyField.setAttribute("readonly", "");
      copyField.style.position = "fixed";
      copyField.style.opacity = "0";
      document.body.appendChild(copyField);
      copyField.select();
      document.execCommand("copy");
      copyField.remove();
    }
    showToast("SIGNAL COPIED // CHALLENGE READY");
  } catch (error) {
    showToast("SIGNAL SHARE CANCELLED", "amber");
  }
}

function drawBackground() {
  const gradient = ctx.createRadialGradient(view.width * 0.5, view.height * 0.46, 0, view.width * 0.5, view.height * 0.46, Math.max(view.width, view.height) * 0.78);
  gradient.addColorStop(0, "#111a3a");
  gradient.addColorStop(0.44, "#090e24");
  gradient.addColorStop(1, "#040610");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, view.width, view.height);

  const nebula = ctx.createRadialGradient(view.width * 0.22, view.height * 0.25, 0, view.width * 0.22, view.height * 0.25, view.width * 0.45);
  nebula.addColorStop(0, "rgba(100, 54, 143, 0.11)");
  nebula.addColorStop(1, "rgba(100, 54, 143, 0)");
  ctx.fillStyle = nebula;
  ctx.fillRect(0, 0, view.width, view.height);

  const gridSize = 82;
  ctx.save();
  ctx.translate(0, (state.time * 5) % gridSize);
  ctx.strokeStyle = "rgba(100, 137, 220, 0.055)";
  ctx.lineWidth = 1;
  for (let x = -gridSize; x < view.width + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 78);
    ctx.lineTo(x, view.height);
    ctx.stroke();
  }
  for (let y = 78; y < view.height + gridSize; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.width, y);
    ctx.stroke();
  }
  ctx.restore();

  for (const star of state.stars) {
    const alpha = 0.18 + (Math.sin(star.twinkle) + 1) * 0.2 * star.depth;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.tint;
    ctx.fillRect(star.x, star.y, star.size, star.size);
    if (star.size > 1.3) {
      ctx.globalAlpha = alpha * 0.35;
      ctx.fillRect(star.x - star.size * 1.8, star.y, star.size * 4, 0.5);
      ctx.fillRect(star.x, star.y - star.size * 1.8, 0.5, star.size * 4);
    }
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(view.width * 0.5, view.height * 0.5);
  ctx.rotate(state.time * 0.025);
  ctx.strokeStyle = "rgba(110, 233, 255, 0.065)";
  ctx.setLineDash([2, 13]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(view.width, view.height) * 0.31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255, 111, 181, 0.045)";
  ctx.beginPath();
  ctx.arc(0, 0, Math.min(view.width, view.height) * 0.48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawAmbientCore() {
  const x = view.width * 0.5;
  const y = view.height * 0.46;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(state.time * 0.2);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i += 1) {
    ctx.strokeStyle = i === 1 ? "rgba(255, 111, 181, 0.2)" : "rgba(110, 233, 255, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 88 + i * 24, 29 + i * 11, i * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 75);
  glow.addColorStop(0, "rgba(110, 233, 255, 0.32)");
  glow.addColorStop(0.32, "rgba(110, 233, 255, 0.1)");
  glow.addColorStop(1, "rgba(110, 233, 255, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 75, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.cyan;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(13, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(-13, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.white;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRings() {
  for (const ring of state.rings) {
    const alpha = clamp(ring.life / ring.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
}

function drawParticles() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const particle of state.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    if (particle.square) ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size * (0.55 + alpha * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawPickups() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const pickup of state.pickups) {
    const pulse = 1 + Math.sin(pickup.phase) * 0.16;
    ctx.globalAlpha = pickup.life < 2 ? pickup.life / 2 : 1;
    ctx.translate(pickup.x, pickup.y);
    ctx.rotate(pickup.phase * 0.35);
    ctx.shadowBlur = 18;
    ctx.shadowColor = pickup.color;
    ctx.fillStyle = pickup.color;
    ctx.beginPath();
    ctx.moveTo(0, -pickup.r * pulse);
    ctx.lineTo(pickup.r * pulse, 0);
    ctx.lineTo(0, pickup.r * pulse);
    ctx.lineTo(-pickup.r * pulse, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBullets() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const bullet of state.bullets) {
    const angle = Math.atan2(bullet.vy, bullet.vx);
    ctx.save();
    ctx.translate(bullet.x, bullet.y);
    ctx.rotate(angle);
    ctx.shadowBlur = 15;
    ctx.shadowColor = bullet.color;
    ctx.fillStyle = bullet.color;
    ctx.fillRect(-11, -bullet.r * 0.45, 18, bullet.r * 0.9);
    ctx.fillStyle = palette.white;
    ctx.fillRect(1, -bullet.r * 0.7, 5, bullet.r * 1.4);
    ctx.restore();
  }
  for (const bullet of state.enemyBullets) {
    ctx.shadowBlur = 13;
    ctx.shadowColor = bullet.color;
    ctx.fillStyle = bullet.color;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(enemy) {
  const pulse = 1 + Math.sin(state.time * 4 + enemy.phase) * 0.06;
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.rotate(enemy.phase + state.time * (enemy.type === "warden" ? 0.25 : 0.7));
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = enemy.type === "warden" ? 25 : 14;
  ctx.shadowColor = enemy.color;
  ctx.strokeStyle = enemy.color;
  ctx.fillStyle = enemy.color;
  ctx.lineWidth = enemy.type === "warden" ? 2.5 : 1.7;

  if (enemy.type === "shard") {
    ctx.beginPath();
    ctx.moveTo(0, -enemy.r * pulse);
    ctx.lineTo(enemy.r * 0.75, 0);
    ctx.lineTo(0, enemy.r * pulse);
    ctx.lineTo(-enemy.r * 0.75, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.24;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.white;
    ctx.fillRect(-2, -2, 4, 4);
  } else if (enemy.type === "hunter") {
    ctx.beginPath();
    ctx.moveTo(enemy.r, 0);
    ctx.lineTo(-enemy.r * 0.65, -enemy.r * 0.75);
    ctx.lineTo(-enemy.r * 0.25, 0);
    ctx.lineTo(-enemy.r * 0.65, enemy.r * 0.75);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.23;
    ctx.fill();
  } else if (enemy.type === "charger") {
    if (enemy.telegraph > 0) {
      ctx.globalAlpha = 0.42 + Math.sin(state.time * 20) * 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r + 10 + Math.sin(state.time * 10) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(enemy.r * 1.1, 0);
    ctx.lineTo(0, enemy.r * 0.8);
    ctx.lineTo(-enemy.r * 0.85, 0);
    ctx.lineTo(0, -enemy.r * 0.8);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.fill();
  } else if (enemy.type === "splitter") {
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.white;
    ctx.beginPath();
    ctx.moveTo(-8, -5);
    ctx.lineTo(8, 5);
    ctx.moveTo(8, -5);
    ctx.lineTo(-8, 5);
    ctx.stroke();
  } else {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.white;
    ctx.beginPath();
    ctx.arc(0, 0, enemy.r * 0.45, state.time, state.time + Math.PI * 1.35);
    ctx.stroke();
  }
  ctx.restore();

  if (enemy.hp < enemy.maxHp && enemy.type !== "shard") {
    const width = enemy.r * 2.3;
    ctx.fillStyle = "rgba(4, 7, 18, 0.72)";
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 8, width, 2);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.r - 8, width * clamp(enemy.hp / enemy.maxHp, 0, 1), 2);
  }
}

function drawPlayer() {
  const p = state.player;
  if (!p) return;
  const flicker = p.invuln > 0 && Math.floor(state.time * 18) % 2 === 0;
  if (flicker) ctx.globalAlpha = 0.38;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 24;
  ctx.shadowColor = palette.cyan;
  ctx.fillStyle = palette.cyan;
  ctx.beginPath();
  ctx.moveTo(19, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-5, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.white;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.pink;
  ctx.fillRect(-10, -2, 7, 4);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < p.orbiters; i += 1) {
    const angle = p.orbitAngle + (Math.PI * 2 * i) / Math.max(1, p.orbiters);
    const radius = 28 + p.orbiters * 2;
    const x = p.x + Math.cos(angle) * radius;
    const y = p.y + Math.sin(angle) * radius;
    ctx.shadowBlur = 14;
    ctx.shadowColor = palette.violet;
    ctx.fillStyle = palette.violet;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.white;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "10px SFMono-Regular, Consolas, monospace";
  for (const floater of state.floaters) {
    ctx.globalAlpha = clamp(floater.life / floater.maxLife, 0, 1);
    ctx.fillStyle = floater.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.clearRect(0, 0, view.width, view.height);
  drawBackground();
  if (state.mode === "title" && !state.player) drawAmbientCore();
  const offsetX = state.shake ? randomBetween(-state.shake, state.shake) : 0;
  const offsetY = state.shake ? randomBetween(-state.shake, state.shake) : 0;
  ctx.save();
  ctx.translate(offsetX, offsetY);
  drawRings();
  drawPickups();
  drawParticles();
  drawBullets();
  for (const enemy of state.enemies) drawEnemy(enemy);
  drawPlayer();
  drawFloaters();
  ctx.restore();
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(185, 229, 255, ${state.flash * 0.24})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

function updateUi(dt) {
  uiClock -= dt;
  if (uiClock > 0) return;
  uiClock = 0.06;
  const p = state.player;
  ui.sectorLabel.textContent = `SECTOR ${pad(state.sector, 2)}`;
  ui.waveLabel.textContent = `WAVE ${pad(state.wave, 2)}`;
  ui.scoreValue.textContent = pad(state.score, 6);
  ui.fpsReadout.textContent = String(Math.round(state.fps));
  if (!p) return;
  ui.hullValue.textContent = `${Math.round(clamp(p.hp / p.maxHp, 0, 1) * 100)}%`;
  ui.hullBar.style.transform = `scaleX(${clamp(p.hp / p.maxHp, 0, 1)})`;
  ui.novaValue.textContent = `${pad((p.energy / p.maxEnergy) * 100, 2)}%`;
  ui.novaBar.style.transform = `scaleX(${clamp(p.energy / p.maxEnergy, 0, 1)})`;
  ui.comboReadout.hidden = state.combo < 2;
  ui.comboValue.textContent = `x${(1 + Math.min(12, state.combo) * 0.075).toFixed(2)}`;
  ui.coordReadout.textContent = `${(p.x / view.width * 99).toFixed(2)} / ${(p.y / view.height * 99).toFixed(2)}`;
  const threat = state.enemies.filter(enemy => !enemy.dead).length;
  ui.threatReadout.textContent = threat > 25 ? "CRITICAL" : threat > 14 ? "ELEVATED" : threat > 5 ? "ACTIVE" : "NOMINAL";
  ui.threatReadout.style.color = threat > 25 ? palette.danger : threat > 14 ? palette.amber : "";
}

function updateTouchStick(event) {
  const rect = ui.touchStick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  let x = event.clientX - centerX;
  let y = event.clientY - centerY;
  const max = rect.width * 0.38;
  const length = Math.hypot(x, y);
  if (length > max) {
    x = x / length * max;
    y = y / length * max;
  }
  touchVector.x = x / max;
  touchVector.y = y / max;
  touchVector.active = true;
  ui.touchStickKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function resetTouchStick() {
  touchVector.x = 0;
  touchVector.y = 0;
  touchVector.active = false;
  ui.touchStickKnob.style.transform = "translate(-50%, -50%)";
}

function toggleSound() {
  soundOn = !soundOn;
  writeStorage("starforgeSound", soundOn ? "on" : "off");
  ui.soundButton.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
  if (soundOn) {
    initAudio();
    tone(520, 0.12, "sine", 0.03, 120);
  }
}

window.addEventListener("resize", () => {
  resizeCanvas();
  createStars();
});

window.addEventListener("keydown", event => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) event.preventDefault();
  if (event.code === "KeyP" && !event.repeat) togglePause();
  if (event.code === "Escape" && state.mode === "paused") abandonRun();
  if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
    if (!event.repeat) triggerDash();
  }
  if (event.code === "KeyE" || event.code === "Numpad0") {
    if (!event.repeat) triggerNova();
  }
  if (state.mode === "upgrade" && ["Digit1", "Digit2", "Digit3"].includes(event.code) && !event.repeat) chooseUpgrade(Number(event.code.slice(-1)) - 1);
  keys.add(event.code);
  if (event.code === "Space" && (state.mode === "title" || state.mode === "gameover")) beginRun();
});

window.addEventListener("keyup", event => {
  keys.delete(event.code);
});

canvas.addEventListener("pointermove", event => {
  const rect = canvas.getBoundingClientRect();
  pointer.x = event.clientX - rect.left;
  pointer.y = event.clientY - rect.top;
  pointer.active = true;
});

canvas.addEventListener("pointerdown", event => {
  if (event.button === 2) {
    event.preventDefault();
    triggerNova();
    return;
  }
  if (event.button === 0) {
    initAudio();
    pointer.down = true;
    pointer.active = true;
    canvas.setPointerCapture?.(event.pointerId);
  }
});

canvas.addEventListener("pointerup", event => {
  if (event.button === 0) pointer.down = false;
});
canvas.addEventListener("pointercancel", () => { pointer.down = false; });
canvas.addEventListener("contextmenu", event => event.preventDefault());

ui.touchStick.addEventListener("pointerdown", event => {
  event.preventDefault();
  touchVector.pointerId = event.pointerId;
  ui.touchStick.setPointerCapture?.(event.pointerId);
  updateTouchStick(event);
});
ui.touchStick.addEventListener("pointermove", event => {
  if (event.pointerId === touchVector.pointerId) updateTouchStick(event);
});
ui.touchStick.addEventListener("pointerup", event => {
  if (event.pointerId === touchVector.pointerId) resetTouchStick();
});
ui.touchStick.addEventListener("pointercancel", resetTouchStick);

ui.dashTouch.addEventListener("pointerdown", event => {
  event.preventDefault();
  triggerDash();
});
ui.novaTouch.addEventListener("pointerdown", event => {
  event.preventDefault();
  triggerNova();
});

ui.startButton.addEventListener("click", () => beginRun());
ui.restartButton.addEventListener("click", () => beginRun());
ui.dailyButton.addEventListener("click", () => beginRun(dailySeed(), true));
ui.pauseButton.addEventListener("click", togglePause);
ui.resumeButton.addEventListener("click", togglePause);
ui.quitButton.addEventListener("click", abandonRun);
ui.shareButton.addEventListener("click", shareRun);
ui.soundButton.addEventListener("click", toggleSound);
ui.howToButton.addEventListener("click", () => {
  ui.howToPanel.hidden = !ui.howToPanel.hidden;
  ui.howToButton.innerHTML = ui.howToPanel.hidden ? "HOW TO PLAY <span>+</span>" : "HIDE CONTROLS <span>-</span>";
});

ui.soundButton.textContent = soundOn ? "SOUND ON" : "SOUND OFF";
resizeCanvas();
createStars();
updateTitleStats();
setMode("title");

function frame(now) {
  const rawDelta = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  state.fps = lerp(state.fps, 1 / rawDelta, 0.08);
  update(rawDelta);
  updateUi(rawDelta);
  draw();
  window.requestAnimationFrame(frame);
}

window.requestAnimationFrame(frame);
