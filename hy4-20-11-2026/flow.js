'use strict';
let choiceCtx = null;

function buildChoices(n) {
  const p = G.p, pool = [];
  const has = id => p.weapons.find(w => w.id === id);
  for (const w of p.weapons) if (w.level < WEAPONS[w.id].max) pool.push({ kind: 'wlvl', id: w.id });
  if (p.weapons.length < 6) for (const id in WEAPONS) { if (WEAPONS[id].evo || has(id)) continue; pool.push({ kind: 'wnew', id }); }
  for (const w of p.weapons) {
    if (w.evo) continue;
    const def = WEAPONS[w.id];
    if (def.evolve && w.level >= def.max && (p.passives[def.evolve.passive] || 0) >= 1) for (let k = 0; k < 6; k++) pool.push({ kind: 'evolve', id: def.evolve.into, from: w.id });
  }
  for (const id in PASSIVES) { const lv = p.passives[id] || 0; if (lv < PASSIVES[id].max) pool.push({ kind: 'passive', id }); }
  pool.push({ kind: 'heal' }); pool.push({ kind: 'magnet' }); pool.push({ kind: 'bomb' });
  shuffle(pool);
  const evos = pool.filter(c => c.kind === 'evolve');
  const rest = pool.filter(c => c.kind !== 'evolve');
  const out = [];
  if (evos.length) out.push(pick(evos));
  while (out.length < n && rest.length) out.push(rest.shift());
  return out;
}
function choiceInfo(c) {
  if (c.kind === 'wlvl' || c.kind === 'wnew') {
    const d = WEAPONS[c.id], w = G.p.weapons.find(x => x.id === c.id);
    return { name: d.name, tag: d.tag, color: d.color, desc: d.desc, lvl: c.kind === 'wnew' ? 'NEW WEAPON' : 'LV ' + (w.level + 1) + ' / ' + d.max, evo: false };
  }
  if (c.kind === 'evolve') { const d = WEAPONS[c.id]; return { name: d.name, tag: 'FUSION', color: '#ffd76a', desc: d.desc, lvl: 'ULTIMATE FORM', evo: true }; }
  if (c.kind === 'passive') { const d = PASSIVES[c.id]; return { name: d.name, tag: d.tag, color: d.color, desc: d.desc, lvl: 'PASSIVE · LV ' + ((G.p.passives[c.id] || 0) + 1) + ' / ' + d.max, evo: false }; }
  if (c.kind === 'heal') return { name: 'RESTORE', tag: 'HP', color: '#ff5c7c', desc: 'Instantly heal 45% of your max HP.', lvl: 'CONSUMABLE', evo: false };
  if (c.kind === 'magnet') return { name: 'GRAVITON', tag: 'MAG', color: '#9dffef', desc: 'Pull in every XP gem on screen.', lvl: 'CONSUMABLE', evo: false };
  return { name: 'DETONATE', tag: 'BOM', color: '#ffd76a', desc: 'Damage every enemy on screen.', lvl: 'CONSUMABLE', evo: false };
}
function applyChoice(c) {
  const p = G.p;
  if (c.kind === 'wlvl') { const w = p.weapons.find(x => x.id === c.id); w.level++; }
  else if (c.kind === 'wnew') p.weapons.push({ id: c.id, level: 1, cd: rand(0, 0.3), angle: rand(0, TAU) });
  else if (c.kind === 'evolve') {
    const w = p.weapons.find(x => x.id === c.from);
    if (w) { w.id = c.id; w.evo = true; w.level = 1; w.cd = 0; }
    G.evolved++;
    unlockAch('evolve');
    banner(WEAPONS[c.id].name, '#ffd76a');
    flash('#ffd76a', 0.4);
  }
  else if (c.kind === 'passive') {
    p.passives[c.id] = (p.passives[c.id] || 0) + 1;
    recalc();
    if (c.id === 'vitality') p.hp = Math.min(p.maxHp, p.hp + 22);
  }
  else if (c.kind === 'heal') p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.45);
  else if (c.kind === 'magnet') { for (const g of G.pickups) if (g.type === 'gem') { g.x = p.x + rand(-20, 20); g.y = p.y + rand(-20, 20); } }
  else if (c.kind === 'bomb') { for (const e of G.enemies) if (!e.dead) dmgEnemy(e, 45 * p.dmgMul, true); flash('#ffd76a', 0.5); shake(12); }
  A.sfx('button');
  renderWeaponBar();
  closeChoice();
}
function openChoice(title, sub, choices, isLevel) {
  choiceCtx = { choices, isLevel };
  $('luCards').innerHTML = '';
  $('luSub').textContent = sub;
  document.querySelector('#levelupScreen h2.title').textContent = title;
  choices.forEach((c, i) => {
    const inf = choiceInfo(c);
    const el = document.createElement('div');
    el.className = 'card' + (inf.evo ? ' evo' : '');
    el.style.setProperty('--c', inf.color);
    el.innerHTML = '<div class="ic">' + inf.tag.slice(0, 3) + '</div><div class="nm">' + inf.name + '</div><div class="tp">' + inf.tag + '</div><div class="ds">' + inf.desc + '</div><div class="lv">' + inf.lvl + ' · [' + (i + 1) + ']</div>';
    el.addEventListener('click', () => applyChoice(c));
    $('luCards').appendChild(el);
  });
  $('rrCount').textContent = G.rerollsLeft;
  $('btnReroll').disabled = G.rerollsLeft <= 0;
  setScene('levelup');
}
function closeChoice() { choiceCtx = null; setScene('play'); }
function rerollChoices() {
  if (!choiceCtx || G.rerollsLeft <= 0) return;
  G.rerollsLeft--;
  A.sfx('button');
  const n = 3 + (G.p.luck > 1.6 ? 1 : 0);
  openChoice(choiceCtx.isLevel ? 'YOUR LIGHT GROWS' : 'A GIFT FROM THE VOID', choiceCtx.isLevel ? 'CHOOSE ONE · LEVEL ' + G.p.level : 'CHOOSE ONE', buildChoices(n), choiceCtx.isLevel);
}
function openLevelChoice() { openChoice('YOUR LIGHT GROWS', 'CHOOSE ONE · LEVEL ' + G.p.level, buildChoices(3 + (G.p.luck > 1.6 ? 1 : 0)), true); }
function openChestChoice() { openChoice('A GIFT FROM THE VOID', 'THE DARK OFFERS A BARGAIN', buildChoices(3), false); }
function maybeOpenChoice() {
  if (scene !== 'play' || !G || !G.active) return;
  if (G.pendingLevels > 0) { G.pendingLevels--; openLevelChoice(); }
  else if (G.chestQueue > 0) { G.chestQueue--; openChestChoice(); }
}

function unlockAch(id) {
  const a = ACH.find(x => x.id === id);
  if (!a || Save.data.achievements.indexOf(id) >= 0) return;
  Save.data.achievements.push(id);
  if (a.reward) Save.data.stardust += a.reward;
  if (a.unlock && Save.data.characters.indexOf(a.unlock) < 0) Save.data.characters.push(a.unlock);
  Save.save();
  A.sfx('ach');
  const extra = (a.reward ? '+' + a.reward + ' STARDUST' : '') + (a.unlock ? ' · NEW PILOT UNLOCKED' : '');
  toast('FEAT · ' + a.name, extra);
}
function checkAchievements() {
  for (const a of ACH) {
    if (Save.data.achievements.indexOf(a.id) >= 0) continue;
    let ok = false;
    if (a.persistent) ok = a.check();
    else if (G) ok = a.check(G);
    if (ok) unlockAch(a.id);
  }
}

function newGame() {
  const ch = CHAR_BY_ID[Save.data.selectedChar] || CHARACTERS[0];
  const startLv = Math.min(WEAPONS[ch.start].max, 1 + (Save.data.upgrades.focus || 0) + (ch.startLv ? ch.startLv - 1 : 0));
  G = {
    active: true, time: 0, score: 0, kills: 0, bossKills: 0, evolved: 0, grazes: 0, novas: 0,
    bossSpawned: 0, boss: null, bossTimes: [90, 210, 330, 450, 600], nextBossIdx: 0, extraBossAt: 750,
    nextMilestone: 30, lastPhase: 0, spawnAcc: 0, eliteTimer: 24, swarmTimer: 40,
    pendingLevels: 0, chestQueue: 0, rerollsLeft: 1 + (Save.data.upgrades.reroll || 0),
    revives: Save.data.upgrades.revive || 0, transcended: false, won: false, endless: false,
    achAtStart: Save.data.achievements.slice(),
    p: {
      x: 0, y: 0, facing: -Math.PI / 2, hp: 100, maxHp: 100, level: 1, xp: 0, xpNext: Math.round(CFG.xpBase),
      weapons: [{ id: ch.start, level: startLv, cd: 0, angle: 0 }], passives: {},
      combo: 0, comboTimer: 0, comboMult: 1, od: 0, dashCd: 0, dashTimer: 0, dashDir: { x: 1, y: 0 },
      invuln: 1.4, trail: [], kills: 0,
    },
    enemies: [], projectiles: [], pickups: [], particles: [], floaters: [], arcs: [], rings: [],
  };
  recalc();
  G.p.hp = G.p.maxHp;
  cam.x = 0; cam.y = 0;
  entityId = 1;
  effects.shake = 0; effects.flash = 0; effects.slowmo = 0; effects.hitstop = 0;
  renderWeaponBar();
  $('bossWrap').classList.add('hidden');
}
function startRun() {
  newGame();
  A.resume();
  A.sfx('button');
  setScene('play');
  banner('SURVIVE', playerColor());
  A.intensity = 0.2;
}
function continueEndless() {
  if (!G) return;
  G.won = false; G.active = true; G.endless = true;
  G.p.hp = G.p.maxHp; G.p.invuln = 2.5;
  G.extraBossAt = G.time + 120;
  A.sfx('button');
  setScene('play');
  banner('ENDLESS', '#ffffff');
}
function gameOver(win) {
  if (!G || !G.active) return;
  G.active = false;
  G.won = win;
  const earned = Math.floor(G.time / 3 + G.kills * 0.55 + G.p.level * 2 + G.bossKills * 25 + (win ? 220 : 0));
  Save.data.stardust += earned;
  Save.data.bestTime = Math.max(Save.data.bestTime, Math.floor(G.time));
  Save.data.bestScore = Math.max(Save.data.bestScore, G.score);
  Save.data.bestLevel = Math.max(Save.data.bestLevel, G.p.level);
  Save.data.totalKills += G.kills;
  Save.data.runs += 1;
  Save.save();
  checkAchievements();
  const newAch = Save.data.achievements.filter(a => G.achAtStart.indexOf(a) < 0);
  $('goTitle').textContent = win ? 'TRANSCENDED' : 'CONSUMED';
  $('goTitle').className = win ? 'go-title win-title' : 'go-title';
  $('goSub').textContent = win ? 'You became the bloom. The dark will remember your name.' : 'The dark took you. It always wants more.';
  $('goStats').innerHTML =
    statbox(fmtTime(G.time), 'TIME') + statbox('LV ' + G.p.level, 'LEVEL') + statbox(fmtNum(G.kills), 'KILLS') +
    statbox(fmtNum(G.score), 'SCORE') + statbox(fmtNum(G.bossKills), 'BOSSES') + statbox(fmtNum(G.evolved), 'FUSIONS');
  $('goDust').textContent = '+' + earned + ' STARDUST EARNED';
  const unlocks = newAch.map(id => { const a = ACH.find(x => x.id === id); return a && a.unlock ? CHAR_BY_ID[a.unlock].name : null; }).filter(Boolean);
  $('goUnlocks').textContent = unlocks.length ? 'NEW PILOT UNLOCKED: ' + unlocks.join(', ') : (win ? 'PRESS CONTINUE TO BRAVE THE ENDLESS VOID' : 'SPEND STARDUST IN ASCEND TO GROW STRONGER');
  $('btnAgain').textContent = win ? 'CONTINUE ENDLESS' : 'ONE MORE RUN';
  setScene(win ? 'victory' : 'gameover');
  A.sfx(win ? 'win' : 'gameover');
  A.intensity = 0.1;
}
function statbox(v, k) { return '<div class="statbox"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>'; }
function victory() { if (G && G.active) gameOver(true); }
