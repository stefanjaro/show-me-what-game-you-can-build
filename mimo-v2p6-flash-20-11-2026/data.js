/* POLARIS — game data: balance, content, tables */

export const COLORS = {
  crimson: '#ff2d78',
  cyan: '#2de1ff',
  gold: '#ffd166',
  xp: '#7dffb2',
  hp: '#ff6b8a',
  violet: '#8b6cff',
  white: '#ffffff',
  void: '#05060e',
};
export const POLARITY_COLOR = [COLORS.crimson, COLORS.cyan];
export const POLARITY_NAME = ['CRIMSON', 'CYAN'];

export const WORLD = { w: 2680, h: 1840 };

export const BAL = {
  player: {
    speed: 268,
    radius: 13,
    hp: 100,
    dashSpeed: 1250,
    dashTime: 0.145,
    dashCd: 1.15,
    dashIFrames: 0.24,
    hitIFrames: 0.8,
    fireInterval: 0.118,
    bulletSpeed: 780,
    bulletDmg: 11,
    bulletR: 5,
    novaMax: 100,
    absorbRadius: 54,
  },
  xpNeed(lvl) {
    return Math.max(4, Math.floor(6 + lvl * 3.1 + Math.pow(lvl, 1.68) * 0.95));
  },
  levelHeal: 7,
  comboWindow: 2.6,
  comboMax: 5,
  director: {
    maxAlive(t) { return Math.min(96, 13 + t * 0.095); },
    spawnInterval(t) { return Math.max(0.14, 0.8 - t * 0.00082); },
    eliteChance(t) { return Math.max(0, Math.min(0.3, (t - 100) / 1500)); },
    bossSpawnMul: 0.5,
  },
};

/* ---------------------------------------------------------------- ENEMIES */
/* behavior: chase | swarm | shooter | darter | tank | splitter | spawner |
             bomber | sniper | shard                                               */

export const ENEMIES = {
  grunt: {
    name: 'Drifter', behavior: 'chase', hp: 26, speed: 116, radius: 14,
    contact: 9, xp: 1, score: 10, unlock: 0, w: 10, shape: 'jag',
  },
  swarm: {
    name: 'Mote', behavior: 'swarm', hp: 11, speed: 186, radius: 9,
    contact: 6, xp: 1, score: 8, unlock: 30, w: 8, shape: 'diamond',
  },
  shooter: {
    name: 'Spitter', behavior: 'shooter', hp: 36, speed: 96, radius: 15,
    contact: 9, xp: 2, score: 22, unlock: 70, w: 8, shape: 'pent',
    range: 330, burst: 3, burstGap: 0.14, fireGap: 1.9,
    bulletSpeed: 330, bulletDmg: 11, bulletR: 6,
  },
  darter: {
    name: 'Dart', behavior: 'darter', hp: 26, speed: 74, radius: 13,
    contact: 12, xp: 2, score: 24, unlock: 130, w: 7, shape: 'arrow',
    windup: 0.62, lunge: 560, lungeTime: 0.34, recover: 0.5, sight: 460,
  },
  tank: {
    name: 'Bulwark', behavior: 'tank', hp: 135, speed: 64, radius: 25,
    contact: 17, xp: 5, score: 55, unlock: 175, w: 5, shape: 'hex',
  },
  splitter: {
    name: 'Mitote', behavior: 'splitter', hp: 46, speed: 104, radius: 18,
    contact: 10, xp: 3, score: 34, unlock: 230, w: 6, shape: 'blob',
    splits: 2,
  },
  shard: {
    name: 'Splinter', behavior: 'shard', hp: 13, speed: 168, radius: 10,
    contact: 7, xp: 1, score: 9, unlock: 9999, w: 0, shape: 'diamond',
  },
  bomber: {
    name: 'Cinder', behavior: 'bomber', hp: 30, speed: 132, radius: 14,
    contact: 8, xp: 2, score: 26, unlock: 290, w: 6, shape: 'circle',
    blastR: 104, blastDmg: 24, fuse: 1.15,
  },
  spawner: {
    name: 'Womb', behavior: 'spawner', hp: 78, speed: 58, radius: 21,
    contact: 12, xp: 6, score: 66, unlock: 355, w: 4, shape: 'ring',
    spawnGap: 3.6, spawnType: 'grunt',
  },
  sniper: {
    name: 'Gazer', behavior: 'sniper', hp: 48, speed: 66, radius: 15,
    contact: 9, xp: 4, score: 48, unlock: 420, w: 4, shape: 'eye',
    range: 560, telegraph: 1.05, bulletSpeed: 760, bulletDmg: 24, bulletR: 8,
    fireGap: 3.1,
  },
};

export const ELITE = {
  hpMul: 3.4, speedMul: 1.1, radiusMul: 1.32, contactMul: 1.35,
  xpMul: 3.5, scoreMul: 4,
};

/* ------------------------------------------------------------------ BOSSES */
export const BOSSES = [
  { t: 180, id: 'warden', name: 'THE WARDEN', sub: 'herald of the first gate' },
  { t: 390, id: 'splitmind', name: 'SPLIT MIND', sub: 'herald of the mirrored road' },
  { t: 600, id: 'choir', name: 'THE CHOIR', sub: 'herald of ten thousand mouths' },
  { t: 810, id: 'voidheart', name: 'VOID HEART', sub: 'the dark that wants you' },
];

export const BOSS_DEFS = {
  warden: {
    radius: 46, hp: 1750, contact: 22, score: 1500, xp: 40,
    ramSpeed: 235,
  },
  splitmind: {
    radius: 40, hp: 2500, contact: 20, score: 2200, xp: 55,
  },
  choir: {
    radius: 44, hp: 3100, contact: 22, score: 3000, xp: 70,
  },
  voidheart: {
    radius: 52, hp: 4600, contact: 26, score: 6000, xp: 120,
  },
};

/* ------------------------------------------------------------------ CARDS */
/* mods keys are set to the card's new rank on pick (idempotent)             */

export const CARDS = [
  /* ---- GUN ---- */
  {
    id: 'spread', name: 'SPLIT PRISM', rarity: 'common', max: 4, icon: '⇶', tag: 'PRISM GUN',
    desc: '+1 projectile per rank, wider firing cone.', mods: { spread: 1 },
  },
  {
    id: 'pierce', name: 'NEEDLE', rarity: 'common', max: 3, icon: '➵', tag: 'PRISM GUN',
    desc: 'Bolts punch through +1 target.', mods: { pierce: 1 },
  },
  {
    id: 'caliber', name: 'HEAVY CALIBER', rarity: 'common', max: 4, icon: '◈', tag: 'PRISM GUN',
    desc: '+24% bolt damage.', mods: { caliber: 1 },
  },
  {
    id: 'overcharge', name: 'OVERCHARGE', rarity: 'common', max: 3, icon: '⚡', tag: 'PRISM GUN',
    desc: '+15% rate of fire.', mods: { overcharge: 1 },
  },
  {
    id: 'velocity', name: 'RAILGUIDE', rarity: 'common', max: 3, icon: '»', tag: 'PRISM GUN',
    desc: '+20% bolt speed, +8% damage.', mods: { velocity: 1 },
  },
  {
    id: 'chain', name: 'ARC CHAIN', rarity: 'rare', max: 3, icon: '⌁', tag: 'PRISM GUN',
    desc: 'Bolts leap to a nearby enemy for 55% damage.', mods: { chain: 1 },
  },
  {
    id: 'homing', name: 'SEEKER', rarity: 'rare', max: 3, icon: '➹', tag: 'PRISM GUN',
    desc: 'Bolts gently home toward their prey.', mods: { homing: 1 },
  },

  /* ---- SURVIVAL ---- */
  {
    id: 'vigor', name: 'VIGOR', rarity: 'common', max: 5, icon: '♥', tag: 'BODY',
    desc: '+16 max light (heals you now).', mods: { vigor: 1 },
  },
  {
    id: 'swift', name: 'SWIFT WIND', rarity: 'common', max: 3, icon: '🌬', tag: 'BODY',
    desc: '+9% movement speed.', mods: { swift: 1 },
  },
  {
    id: 'quickstep', name: 'QUICKSTEP', rarity: 'common', max: 3, icon: '»', tag: 'DASH',
    desc: '-13% dash cooldown.', mods: { quickstep: 1 },
  },
  {
    id: 'phase', name: 'PHASE WIDTH', rarity: 'rare', max: 2, icon: '◍', tag: 'DASH',
    desc: 'Longer invulnerability while phasing.', mods: { phase: 1 },
  },
  {
    id: 'aegis', name: 'AEGIS', rarity: 'rare', max: 3, icon: '⛨', tag: 'BODY',
    desc: 'Take 11% less damage from everything.', mods: { aegis: 1 },
  },
  {
    id: 'thorns', name: 'THORN LIGHT', rarity: 'common', max: 3, icon: '✳', tag: 'BODY',
    desc: 'Enemies that touch you burn for 20.', mods: { thorns: 1 },
  },

  /* ---- ECONOMY ---- */
  {
    id: 'magnet', name: 'GRAVITY WELL', rarity: 'common', max: 3, icon: '◎', tag: 'PULL',
    desc: '+50% essence pickup radius.', mods: { magnet: 1 },
  },
  {
    id: 'fortune', name: 'RESONANT COLLECTOR', rarity: 'common', max: 3, icon: '✦', tag: 'GROWTH',
    desc: '+13% essence from kills.', mods: { fortune: 1 },
  },
  {
    id: 'starlight', name: 'STARLIGHT', rarity: 'rare', max: 3, icon: '☀', tag: 'GROWTH',
    desc: 'Heal +9 light every level.', mods: { starlight: 1 },
  },

  /* ---- POLARITY / NOVA ---- */
  {
    id: 'hungry', name: 'HUNGRY LIGHT', rarity: 'common', max: 3, icon: '◉', tag: 'NOVA',
    desc: '+32% Nova charge per devoured bolt.', mods: { hungry: 1 },
  },
  {
    id: 'novacore', name: 'NOVA CORE', rarity: 'common', max: 3, icon: '☀', tag: 'NOVA',
    desc: '+38% Nova damage, +12% reach.', mods: { novacore: 1 },
  },
  {
    id: 'devour', name: 'DEVOUR', rarity: 'rare', max: 3, icon: '☄', tag: 'NOVA',
    desc: 'Devoured bolts arc lightning into nearby enemies.', mods: { devour: 1 },
  },
  {
    id: 'poldrift', name: 'POLAR DRIFT', rarity: 'epic', max: 1, icon: '⇄', tag: 'POLARITY',
    desc: 'Switching polarity unleashes a cutting shockwave (2.5s cd).', mods: { poldrift: 1 },
  },
  {
    id: 'mirror', name: 'MIRROR', rarity: 'epic', max: 1, icon: '⧉', tag: 'POLARITY',
    desc: 'Devoured bolts are also fired back at the Void at 60% power.', mods: { mirror: 1 },
  },

  /* ---- WEAPON SYSTEMS ---- */
  {
    id: 'orbit', name: 'ORBITAL BLADES', rarity: 'rare', max: 4, icon: '◍', tag: 'WEAPON',
    desc: 'A blade of light circles you, shredding on contact.', mods: { orbit: 1 },
  },
  {
    id: 'pulse', name: 'NOVA PULSE', rarity: 'rare', max: 4, icon: '◎', tag: 'WEAPON',
    desc: 'A ring of force expands from you on a timer.', mods: { pulse: 1 },
  },
  {
    id: 'drone', name: 'SENTINEL', rarity: 'rare', max: 3, icon: '△', tag: 'WEAPON',
    desc: 'A loyal spark orbits you and shoots what you shoot.', mods: { drone: 1 },
  },
  {
    id: 'missile', name: 'SEEKER SWARM', rarity: 'epic', max: 3, icon: '➹', tag: 'WEAPON',
    desc: 'Missiles launch periodically and detonate in colour-blind fury.', mods: { missile: 1 },
  },
  {
    id: 'beam', name: 'SUNCUTTER', rarity: 'epic', max: 3, icon: '━', tag: 'WEAPON',
    desc: 'A searing beam in your aim direction melts everything of the wrong colour.', mods: { beam: 1 },
  },

  /* ---- EVOLUTIONS (legendary) ---- */
  {
    id: 'evo_needle', name: 'NEEDLE STORM', rarity: 'legendary', max: 1, icon: '✦', tag: 'EVOLUTION',
    desc: 'Your gun fires a wall of 9 piercing needles. Damage +40%. No colour survives you.',
    req: { spread: 3, pierce: 2 }, mods: { evo_needle: 1 },
  },
  {
    id: 'evo_halo', name: 'VOID HALO', rarity: 'legendary', max: 1, icon: '◎', tag: 'EVOLUTION',
    desc: 'Orbital blades grow huge, faster, and set enemies ablaze.',
    req: { orbit: 3, caliber: 2 }, mods: { evo_halo: 1 },
  },
  {
    id: 'evo_graviton', name: 'GRAVITON NOVA', rarity: 'legendary', max: 1, icon: '◉', tag: 'EVOLUTION',
    desc: 'Nova Pulse drags the Void inward before tearing it apart. Double damage.',
    req: { pulse: 2, magnet: 2 }, mods: { evo_graviton: 1 },
  },
  {
    id: 'evo_swarm', name: 'SWARM PROTOCOL', rarity: 'legendary', max: 1, icon: '✺', tag: 'EVOLUTION',
    desc: 'Seeker missiles split into three on impact. Damage +30%.',
    req: { missile: 2, chain: 2 }, mods: { evo_swarm: 1 },
  },
  {
    id: 'evo_rift', name: 'PHANTOM RIFT', rarity: 'legendary', max: 1, icon: '⌇', tag: 'EVOLUTION',
    desc: 'Your dash tears a burning rift through the world.',
    req: { quickstep: 2, thorns: 2 }, mods: { evo_rift: 1 },
  },
  {
    id: 'evo_dawn', name: 'MIRROR OF DAWN', rarity: 'legendary', max: 1, icon: '⧉', tag: 'EVOLUTION',
    desc: 'Devouring burns everything near you, and Nova charges twice as fast.',
    req: { mirror: 1, hungry: 2 }, mods: { evo_dawn: 1 },
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map(c => [c.id, c]));

/* rarity weights for the draw */
export const RARITY_W = { common: 60, rare: 27, epic: 9, legendary: 4.5 };

/* ---------------------------------------------------------------- META MAP */
export const META = {
  tracks: [
    { id: 'dmg', name: 'LUMINOSITY', icon: '✦', per: '+5% damage', max: 5, base: 20, growth: 26, shape: 'star',
      tip: 'Your light burns harder. +5% damage per star.' },
    { id: 'hp', name: 'VITALITY', icon: '♥', per: '+14 max light', max: 5, base: 18, growth: 22, shape: 'star',
      tip: 'A bigger heart. +14 maximum light per star.' },
    { id: 'spd', name: 'SWIFT WIND', icon: '🌬', per: '+4% speed', max: 5, base: 18, growth: 24, shape: 'star',
      tip: 'Move faster through the dark. +4% speed per star.' },
    { id: 'dash', name: 'BLINK', icon: '»', per: '-7% dash cooldown', max: 5, base: 22, growth: 26, shape: 'star',
      tip: 'Phase more often. -7% dash cooldown per star.' },
    { id: 'magnet', name: 'GRAVITY', icon: '◎', per: '+18% pickup', max: 5, base: 16, growth: 20, shape: 'star',
      tip: 'Draw essence to you. +18% pickup radius per star.' },
    { id: 'reson', name: 'RESONANCE', icon: '◉', per: '+9% Nova charge', max: 5, base: 24, growth: 28, shape: 'star',
      tip: 'Swallow bolts greedier. +9% Nova charge per star.' },
    { id: 'fortune', name: 'FORTUNE', icon: '✦', per: '+7% essence', max: 5, base: 22, growth: 26, shape: 'star',
      tip: 'Grow brighter, faster. +7% essence per star.' },
  ],
  gifts: [
    { id: 'ember', name: 'EMBER', cost: 130, x: 320, y: 108, icon: '◍',
      tip: 'Begin each run with 1 Orbital Blade.', },
    { id: 'ripple', name: 'RIPPLE', cost: 150, x: 520, y: 108, icon: '◎',
      tip: 'Begin each run with Nova Pulse.' },
    { id: 'wings', name: 'WINGS', cost: 170, x: 720, y: 108, icon: '🌬',
      tip: 'Begin each run with +12% movement speed.' },
    { id: 'prismcore', name: 'PRISM CORE', cost: 210, x: 920, y: 108, icon: '⇶',
      tip: 'Begin each run with Split Prism.' },
  ],
};

export function metaCost(track, lvl) {
  return track.base + track.growth * lvl + Math.floor(lvl * lvl * 7);
}

/* ---------------------------------------------------------------- RUN FLOW */
export const SPAWN_SCHEDULE = [
  { t: 0, type: 'grunt' },
  { t: 25, type: 'swarm' },
  { t: 70, type: 'shooter' },
  { t: 130, type: 'darter' },
  { t: 175, type: 'tank' },
  { t: 230, type: 'splitter' },
  { t: 290, type: 'bomber' },
  { t: 355, type: 'spawner' },
  { t: 420, type: 'sniper' },
];

export const SAVE_KEY = 'polaris_save_v1';

export function defaultSave() {
  return {
    v: 1,
    stardust: 0,
    meta: { dmg: 0, hp: 0, spd: 0, dash: 0, magnet: 0, reson: 0, fortune: 0 },
    gifts: {},
    best: { score: 0, time: 0, kills: 0, wins: 0 },
    runs: 0,
    wins: 0,
    muted: false,
    seenHowto: false,
  };
}
