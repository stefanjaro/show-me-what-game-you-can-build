export const COLORS = {
  cyan: '#7df9ff',
  teal: '#48e6c4',
  gold: '#ffd27d',
  rose: '#ff7ad9',
  coral: '#ff646e',
  violet: '#9b8cff',
  white: '#eaffff',
  orange: '#ffa25e',
  mint: '#9dffd8',
  blue: '#5bafff',
};

export const RARITIES = {
  common: { name: 'COMMON', color: COLORS.teal, weight: 57 },
  rare:   { name: 'RARE',   color: COLORS.violet, weight: 32 },
  epic:   { name: 'EPIC',   color: COLORS.gold, weight: 11 },
};

export const WEAPONS = [
  {
    id: 'pulsar', name: 'PULSAR', tag: 'BALANCED · RAPID',
    desc: 'A metronome of light. Quick, forgiving, and endlessly hungry.',
    color: COLORS.cyan, icon: 'i-pulsar',
    bars: { RATE: 0.86, POWER: 0.52, REACH: 0.82 },
    cost: 0,
    fire: { cd: 0.118, damage: 9.5, speed: 1020, radius: 4.2, spread: 0.022, count: 1, life: 1.35, shape: 'bolt' },
  },
  {
    id: 'lance', name: 'LANCE', tag: 'HEAVY · PIERCING',
    desc: 'A spear of condensed dawn. Punches a clean hole through the dark.',
    color: COLORS.rose, icon: 'i-lance',
    bars: { RATE: 0.32, POWER: 0.94, REACH: 0.92 },
    cost: 70,
    fire: { cd: 0.37, damage: 38, speed: 1750, radius: 6, spread: 0, count: 1, pierce: 2, life: 1.0, shape: 'spear' },
  },
  {
    id: 'scatter', name: 'SCATTER', tag: 'CLOSE · CHAOTIC',
    desc: 'Seven sparks, one breath. Get close. Make it hurt.',
    color: COLORS.gold, icon: 'i-scatter',
    bars: { RATE: 0.42, POWER: 0.88, REACH: 0.28 },
    cost: 80,
    fire: { cd: 0.56, damage: 7.2, speed: 1100, radius: 3.4, spread: 0.66, count: 6, life: 0.62, shape: 'pellet' },
  },
  {
    id: 'halo', name: 'HALO', tag: 'ORBITAL · RETURNING',
    desc: 'Throw a crescent of moonlight. It always comes home.',
    color: COLORS.violet, icon: 'i-halo',
    bars: { RATE: 0.46, POWER: 0.78, REACH: 0.66 },
    cost: 100,
    fire: { cd: 0.62, damage: 17, speed: 700, radius: 15, spread: 0.05, count: 1, life: 1.9, shape: 'chakram' },
  },
];

export const UPGRADES = [
  {
    id: 'dmg', name: 'PHOTON DENSITY', what: 'Heavier light.',
    desc: 'Projectiles deal <b>+12%</b> damage.', rarity: 'common', icon: 'i-sun', max: 99,
    apply(s) { s.damage += 0.12; },
  },
  {
    id: 'rate', name: 'OVERCLOCK', what: 'Faster. Hotter.',
    desc: 'Fire <b>12%</b> faster.', rarity: 'common', icon: 'i-bolt', max: 12,
    apply(s) { s.rate += 0.12; },
  },
  {
    id: 'speed', name: 'STELLAR WIND', what: 'Unhurried.',
    desc: 'Move <b>8%</b> faster.', rarity: 'common', icon: 'i-wind', max: 8,
    apply(s) { s.speed += 0.08; },
  },
  {
    id: 'pierce', name: 'PIERCING LIGHT', what: 'Through, not around.',
    desc: 'Projectiles pierce <b>+1</b> enemy.', rarity: 'common', icon: 'i-pierce', max: 4,
    apply(s) { s.pierce += 1; },
  },
  {
    id: 'projSpeed', name: 'SWIFT BOLTS', what: 'Arrive before the thought.',
    desc: 'Projectile speed <b>+16%</b>.', rarity: 'common', icon: 'i-arrow', max: 3,
    apply(s) { s.projSpeed += 0.16; },
  },
  {
    id: 'magnet', name: 'MAGNETISM', what: 'The garden bends toward you.',
    desc: 'Pickup radius <b>+40%</b>.', rarity: 'common', icon: 'i-magnet', max: 4,
    apply(s) { s.magnet += 0.4; },
  },
  {
    id: 'xp', name: 'ATTUNEMENT', what: 'Every spark a seed.',
    desc: 'Motes grant <b>+18%</b> experience.', rarity: 'common', icon: 'i-gem', max: 5,
    apply(s) { s.xpMul += 0.18; },
  },
  {
    id: 'graze', name: 'FOCUSED MIND', what: 'Fear, refined.',
    desc: 'Grazing charges <b>+30%</b> more Nova.', rarity: 'common', icon: 'i-eye', max: 4,
    apply(s) { s.grazeMul += 0.3; },
  },
  {
    id: 'hp', name: 'VITALITY', what: 'A little more morning.',
    desc: 'Gain <b>+1 max light</b> and heal 1.', rarity: 'common', icon: 'i-heart', max: 5,
    apply(s, game) { s.maxHp += 1; game.player.hp = Math.min(game.player.maxHp, game.player.hp + 1); },
  },
  {
    id: 'dashRate', name: 'LIGHTFOOT', what: 'Gone before the wound.',
    desc: 'Dash recharges <b>18%</b> faster.', rarity: 'common', icon: 'i-dash', max: 4,
    apply(s) { s.dashRecharge += 0.18; },
  },
  {
    id: 'warmth', name: 'WARMTH', what: 'A small mercy.',
    desc: 'Restore <b>2 light</b>.', rarity: 'common', icon: 'i-heal', max: 99, needsHurt: true,
    apply(s, game) { game.player.hp = Math.min(game.player.maxHp, game.player.hp + 2); },
  },
  {
    id: 'twin', name: 'TWIN FANGS', what: 'One is never enough.',
    desc: 'Fire <b>+1 projectile</b> each shot.', rarity: 'rare', icon: 'i-twin', max: 3,
    apply(s) { s.count += 1; },
  },
  {
    id: 'crit', name: 'DEADEYE', what: 'Aim for the seam.',
    desc: 'Crit chance <b>+7%</b>, crit damage <b>+10%</b>.', rarity: 'rare', icon: 'i-target', max: 5,
    apply(s) { s.crit += 0.07; s.critMul += 0.1; },
  },
  {
    id: 'critDmg', name: 'EXECUTIONER', what: 'Mercy is inefficient.',
    desc: 'Crit damage <b>+45%</b>.', rarity: 'rare', icon: 'i-skull', max: 4,
    apply(s) { s.critMul += 0.45; },
  },
  {
    id: 'leech', name: 'LEECH', what: 'Take a little back.',
    desc: 'Kills have a <b>5%</b> chance to restore 1 light.', rarity: 'rare', icon: 'i-drop', max: 4,
    apply(s) { s.leech += 0.05; },
  },
  {
    id: 'ricochet', name: 'RICOCHET', what: 'The dark has corners.',
    desc: 'Shots <b>bounce</b> to a new foe after hitting.', rarity: 'rare', icon: 'i-bounce', max: 3,
    apply(s) { s.ricochet += 1; },
  },
  {
    id: 'chain', name: 'STATIC', what: 'The air remembers.',
    desc: 'Hits <b>arc lightning</b> to a nearby foe.', rarity: 'rare', icon: 'i-zap', max: 3,
    apply(s) { s.chain += 1; },
  },
  {
    id: 'burn', name: 'PYRE', what: 'Let it smolder.',
    desc: 'Hits <b>ignite</b>, burning enemies over time.', rarity: 'rare', icon: 'i-flame', max: 3,
    apply(s) { s.burn += 1; },
  },
  {
    id: 'frost', name: 'FROSTBITE', what: 'Winter in miniature.',
    desc: 'Hits <b>slow</b> enemies by 18%.', rarity: 'rare', icon: 'i-snow', max: 2,
    apply(s) { s.frost += 1; },
  },
  {
    id: 'shield', name: 'AEGIS', what: 'A promise, worn outside.',
    desc: 'Gain <b>+1 shield</b> that recharges after 7s unharmed.', rarity: 'rare', icon: 'i-shield', max: 2,
    apply(s, game) { s.shieldMax += 1; game.player.shield = Math.min(s.shieldMax, game.player.shield + 1); },
  },
  {
    id: 'orbit', name: 'SENTINEL', what: 'A small moon, loyal.',
    desc: 'A blade <b>orbits</b> you, cutting what comes close.', rarity: 'rare', icon: 'i-orbit', max: 3,
    apply(s) { s.orbit += 1; },
  },
  {
    id: 'novaCore', name: 'NOVA CORE', what: 'A bigger ending.',
    desc: 'Nova damage and radius <b>+35%</b>.', rarity: 'rare', icon: 'i-nova', max: 4,
    apply(s) { s.novaPower += 0.35; },
  },
  {
    id: 'dashCharge', name: 'AFTERIMAGE', what: 'Be somewhere else.',
    desc: 'Gain <b>+1 dash charge</b>.', rarity: 'rare', icon: 'i-dash', max: 2,
    apply(s) { s.dashCharges += 1; },
  },
  {
    id: 'bounty', name: 'BOUNTY', what: 'The garden provides.',
    desc: 'Enemies have a <b>6%</b> chance to drop light.', rarity: 'rare', icon: 'i-heart', max: 3,
    apply(s) { s.bounty += 0.06; },
  },
  {
    id: 'supernova', name: 'SUPERNOVA', what: 'Leave a scar of sunlight.',
    desc: 'Nova leaves a <b>searing bloom</b> that burns for 6s.', rarity: 'epic', icon: 'i-sun', max: 1,
    apply(s) { s.supernova = true; },
  },
  {
    id: 'starChild', name: 'STAR CHILD', what: 'You are not alone.',
    desc: 'A companion mote <b>fights beside you</b>.', rarity: 'epic', icon: 'i-star', max: 2,
    apply(s) { s.starChild += 1; },
  },
  {
    id: 'overcharge', name: 'OVERCHARGE', what: 'Cornered things burn brightest.',
    desc: 'Deal <b>+35% damage</b> while at half light or less.', rarity: 'epic', icon: 'i-bolt', max: 1,
    apply(s) { s.overcharge = true; },
  },
  {
    id: 'reaper', name: "REAPER'S CADENCE", what: 'The rhythm of ruin.',
    desc: 'Gain <b>+1% damage</b> per 5 combo (up to +60%).', rarity: 'epic', icon: 'i-skull', max: 1,
    apply(s) { s.reaper = true; },
  },
  {
    id: 'solar', name: 'SOLAR FLARE', what: 'A heartbeat made of noon.',
    desc: 'Every <b>4.5s</b>, a pulse of sunlight damages nearby foes.', rarity: 'epic', icon: 'i-nova', max: 2,
    apply(s) { s.solar += 1; },
  },
  {
    id: 'prism', name: 'PRISM', what: 'One becomes many.',
    desc: 'Every <b>6th shot</b> erupts into a fan of five.', rarity: 'epic', icon: 'i-prism', max: 1,
    apply(s) { s.prism = true; },
  },
  {
    id: 'timeField', name: 'TEMPORAL FIELD', what: 'Let them wade.',
    desc: 'Enemies and their bullets move <b>8% slower</b>.', rarity: 'epic', icon: 'i-clock', max: 2,
    apply(s) { s.timeField += 1; },
  },
  {
    id: 'phoenix', name: 'PHOENIX FEATHER', what: 'A second, smaller dawn.',
    desc: 'Once per run, <b>revive</b> with 3 light.', rarity: 'epic', icon: 'i-flame', max: 1,
    apply(s) { s.phoenix = true; },
  },
];

export const META = [
  {
    id: 'hp', name: 'KINDLED HEART', desc: '+1 max light at the start of every run.',
    max: 3, costs: [35, 75, 130], icon: 'i-heart', color: COLORS.gold, kind: 'BODY',
    apply(s) { s.maxHp += 1; },
  },
  {
    id: 'dmg', name: 'HONED RADIANCE', desc: '+7% projectile damage.',
    max: 4, costs: [35, 65, 105, 160], icon: 'i-sun', color: COLORS.cyan, kind: 'MIGHT',
    apply(s) { s.damage += 0.07; },
  },
  {
    id: 'rate', name: 'QUICKENED PULSE', desc: '+6% fire rate.',
    max: 3, costs: [35, 65, 105], icon: 'i-bolt', color: COLORS.teal, kind: 'MIGHT',
    apply(s) { s.rate += 0.06; },
  },
  {
    id: 'speed', name: 'COMET STEP', desc: '+5% move speed.',
    max: 3, costs: [30, 60, 95], icon: 'i-wind', color: COLORS.mint, kind: 'BODY',
    apply(s) { s.speed += 0.05; },
  },
  {
    id: 'graze', name: 'VEIL DANCER', desc: '+20% Nova charge from grazing.',
    max: 3, costs: [30, 60, 100], icon: 'i-eye', color: COLORS.cyan, kind: 'SPIRIT',
    apply(s) { s.grazeMul += 0.2; },
  },
  {
    id: 'magnet', name: "GRAVITY'S FAVOR", desc: '+25% pickup radius.',
    max: 2, costs: [25, 55], icon: 'i-magnet', color: COLORS.violet, kind: 'SPIRIT',
    apply(s) { s.magnet += 0.25; },
  },
  {
    id: 'dash', name: 'THIRD EMBER', desc: '+1 dash charge.',
    max: 1, costs: [160], icon: 'i-dash', color: COLORS.violet, kind: 'BODY',
    apply(s) { s.dashCharges += 1; },
  },
  {
    id: 'reroll', name: "FATE'S COIN", desc: '+1 blessing reroll each run.',
    max: 2, costs: [70, 140], icon: 'i-clock', color: COLORS.rose, kind: 'FATE',
    apply(s) { s.rerolls += 1; },
  },
  {
    id: 'greed', name: 'MIDAS DUST', desc: '+15% stardust earned from runs.',
    max: 3, costs: [85, 150, 230], icon: 'i-gem', color: COLORS.gold, kind: 'FATE',
    apply(s) { s.greed += 0.15; },
  },
  {
    id: 'revive', name: 'SECOND DAWN', desc: 'Rise once per run with 3 light.',
    max: 1, costs: [300], icon: 'i-flame', color: COLORS.gold, kind: 'FATE',
    apply(s) { s.revive += 1; },
  },
  {
    id: 'first', name: 'FIRST BLOSSOM', desc: 'Begin every run with a random blessing.',
    max: 1, costs: [120], icon: 'i-star', color: COLORS.teal, kind: 'SPIRIT',
    apply(s) { s.firstBlessing = true; },
  },
  {
    id: 'ward', name: 'BORN WARDED', desc: 'Begin every run with 1 shield.',
    max: 1, costs: [90], icon: 'i-shield', color: COLORS.cyan, kind: 'BODY',
    apply(s) { s.startShield += 1; },
  },
  {
    id: 'w_lance', name: 'VESSEL · LANCE', desc: 'Unlock the piercing Lance vessel.',
    max: 1, costs: [70], icon: 'i-lance', color: COLORS.rose, kind: 'VESSEL', weapon: 'lance',
  },
  {
    id: 'w_scatter', name: 'VESSEL · SCATTER', desc: 'Unlock the close-range Scatter vessel.',
    max: 1, costs: [80], icon: 'i-scatter', color: COLORS.gold, kind: 'VESSEL', weapon: 'scatter',
  },
  {
    id: 'w_halo', name: 'VESSEL · HALO', desc: 'Unlock the returning-blade Halo vessel.',
    max: 1, costs: [100], icon: 'i-halo', color: COLORS.violet, kind: 'VESSEL', weapon: 'halo',
  },
];

export const ENEMY_TYPES = {
  drifter: {
    name: 'DRIFTER', hp: 26, speed: 108, radius: 14, dmg: 1, xp: 1, score: 10,
    color: COLORS.rose, shape: 'diamond', minWave: 1, weight: 30, behavior: 'seek',
  },
  wisp: {
    name: 'WISP', hp: 15, speed: 190, radius: 10, dmg: 1, xp: 1, score: 8,
    color: COLORS.teal, shape: 'circle', minWave: 2, weight: 17, behavior: 'weave',
  },
  darter: {
    name: 'DARTER', hp: 22, speed: 100, radius: 12, dmg: 1, xp: 1, score: 13,
    color: COLORS.gold, shape: 'tri', minWave: 3, weight: 19, behavior: 'darter',
  },
  spitter: {
    name: 'SPITTER', hp: 40, speed: 78, radius: 16, dmg: 1, xp: 2, score: 18,
    color: COLORS.coral, shape: 'hex', minWave: 4, weight: 15, behavior: 'spitter',
  },
  splitter: {
    name: 'SPLITTER', hp: 44, speed: 96, radius: 18, dmg: 1, xp: 2, score: 19,
    color: COLORS.orange, shape: 'star', minWave: 4, weight: 13, behavior: 'splitter',
  },
  weaver: {
    name: 'WEAVER', hp: 56, speed: 112, radius: 16, dmg: 1, xp: 2, score: 22,
    color: COLORS.violet, shape: 'ringed', minWave: 6, weight: 14, behavior: 'weaver',
  },
  bulwark: {
    name: 'BULWARK', hp: 190, speed: 48, radius: 27, dmg: 2, xp: 4, score: 38,
    color: COLORS.blue, shape: 'square', minWave: 7, weight: 8, behavior: 'bulwark',
  },
  sniper: {
    name: 'WATCHER', hp: 32, speed: 62, radius: 14, dmg: 1, xp: 2, score: 24,
    color: '#b6c7ff', shape: 'needle', minWave: 8, weight: 9, behavior: 'sniper',
  },
  shard: {
    name: 'SHARD', hp: 12, speed: 260, radius: 8, dmg: 1, xp: 1, score: 6,
    color: COLORS.orange, shape: 'tri', minWave: 99, weight: 0, behavior: 'seek', hidden: true,
  },
};

export const BOSSES = [
  {
    name: 'THE HOLLOW CHOIR', line: 'It sings the names of dead stars.',
    color: COLORS.rose, hp: 1050, radius: 68, shape: 'choir',
  },
  {
    name: 'SERAPH OF RUST', line: 'Wings of oxidized dawn.',
    color: COLORS.orange, hp: 2500, radius: 62, shape: 'seraph',
  },
  {
    name: 'THE DEVOURER', line: 'A hunger older than light.',
    color: COLORS.violet, hp: 4800, radius: 64, shape: 'devourer',
  },
];

export const WHISPERS = [
  'the garden stirs', 'graze fire to grow your nova', 'the dark is patient',
  'feed the garden', 'do not stop moving', 'something is listening',
  'light attracts teeth', 'one more wave', 'the void wants a garden',
  'they remember your shape', 'keep the ember close', 'the roots go down forever',
  'nothing here is empty', 'burn beautifully', 'your light is a wound',
];

export const DEATH_LINES = [
  'The dark leans closer.',
  'The garden goes quiet.',
  'Somewhere, a seed remains.',
  'Your light joins the others.',
  'The stars will remember your shape.',
  'It was always going to end here. Rise anyway.',
  'The void takes what it is given.',
];

export const GAME_TIPS = [
  'TIP · GRAZE HOSTILE FIRE TO CHARGE YOUR NOVA',
  'TIP · LEVEL UP TO CHOOSE BLESSINGS',
  'TIP · DASH GRANTS INVULNERABILITY',
  'TIP · BOSSES WAKE EVERY 5 WAVES',
  'TIP · COMBO MULTIPLIES YOUR SCORE',
  'TIP · DEATH EARNS STARDUST FOR THE CONSTELLATION',
];

export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
export const META_BY_ID = Object.fromEntries(META.map(m => [m.id, m]));
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

export function unlockedWeapons(meta) {
  return WEAPONS.filter(w => !w.cost || (meta[w.costId || ('w_' + w.id)] || 0) > 0);
}

export function bossForWave(wave) {
  const index = Math.floor(wave / 5) - 1;
  const base = BOSSES[index % BOSSES.length];
  const cycle = Math.floor(index / BOSSES.length);
  return {
    ...base,
    name: cycle === 0 ? base.name : `ECHO OF ${base.name.replace('THE ', '')}`,
    cycle,
    hp: base.hp * Math.pow(1.55, index),
    radius: base.radius,
  };
}
