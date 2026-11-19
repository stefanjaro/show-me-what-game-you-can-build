'use strict';
let isTouch = false;

const SCREEN_IDS = {
  title: 'titleScreen', levelup: 'levelupScreen', paused: 'pauseScreen',
  gameover: 'gameoverScreen', victory: 'gameoverScreen', shop: 'shopScreen',
  char: 'charScreen', ach: 'achScreen', help: 'helpScreen', settings: 'settingsScreen',
};
function setScene(s) {
  scene = s;
  const all = document.querySelectorAll('.screen');
  for (let i = 0; i < all.length; i++) all[i].classList.add('hidden');
  if (SCREEN_IDS[s]) $(SCREEN_IDS[s]).classList.remove('hidden');
  const showHud = (s === 'play' || s === 'levelup' || s === 'paused') && G && G.active;
  $('hud').classList.toggle('hidden', !showHud);
  $('novaBtn').style.display = (s === 'play' && isTouch) ? 'flex' : 'none';
  if (s === 'title') updateTitleBest();
}
function openScreen(id, from) { backTarget = from; setScene(id); }
function updateTitleBest() {
  const s = Save.data;
  $('titleBest').textContent = 'BEST ' + (s.bestTime > 0 ? fmtTime(s.bestTime) : '--:--') + '   ·   ' + fmtNum(s.bestScore) + ' PTS   ·   LV ' + s.bestLevel + '   ·   ' + fmtNum(s.stardust) + ' STARDUST';
}

function renderShop() {
  $('shopDust').textContent = fmtNum(Save.data.stardust);
  const grid = $('shopGrid'); grid.innerHTML = '';
  for (const s of SHOP) {
    const lv = Save.data.upgrades[s.id] || 0, cost = shopCost(s, lv), maxed = lv >= s.max;
    const el = document.createElement('div');
    el.className = 'tile' + (maxed ? ' sel' : '');
    let pips = ''; for (let i = 0; i < s.max; i++) pips += '<i class="' + (i < lv ? 'on' : '') + '"></i>';
    el.innerHTML = '<div class="th"><div class="dot" style="background:' + s.color + '">' + s.tag.slice(0, 2) + '</div><div><div class="tn">' + s.name + '</div><div class="td">' + s.desc + '</div></div></div><div class="lvls">' + pips + '</div><div class="cost">' + (maxed ? 'MAXED' : cost + ' STARDUST · [CLICK]') + '</div>';
    if (!maxed) el.addEventListener('click', () => buyUpgrade(s));
    grid.appendChild(el);
  }
}
function buyUpgrade(s) {
  const lv = Save.data.upgrades[s.id] || 0;
  if (lv >= s.max) return;
  const cost = shopCost(s, lv);
  if (Save.data.stardust < cost) { A.sfx('hurt'); toast('NOT ENOUGH STARDUST', 'Survive longer, earn more.'); return; }
  Save.data.stardust -= cost; Save.data.upgrades[s.id] = lv + 1;
  Save.save(); A.sfx('ach'); renderShop(); updateTitleBest();
}
function renderChars() {
  const grid = $('charGrid'); grid.innerHTML = '';
  for (const c of CHARACTERS) {
    const unlocked = Save.data.characters.indexOf(c.id) >= 0, sel = Save.data.selectedChar === c.id;
    const el = document.createElement('div');
    el.className = 'tile' + (unlocked ? '' : ' locked') + (sel ? ' sel' : '');
    el.innerHTML = '<div class="th"><div class="dot" style="background:' + c.color + '">' + c.tag + '</div><div><div class="tn">' + c.name + '</div><div class="td">' + c.desc + '</div></div></div><div class="td" style="margin-top:8px;color:var(--gold)">' + (unlocked ? (sel ? 'SELECTED' : 'CLICK TO SELECT') : 'LOCKED · ' + c.unlock) + '</div>';
    if (unlocked) el.addEventListener('click', () => { Save.data.selectedChar = c.id; Save.save(); A.sfx('button'); renderChars(); });
    grid.appendChild(el);
  }
}
function renderAch() {
  const list = $('achList'); list.innerHTML = '';
  for (const a of ACH) {
    const done = Save.data.achievements.indexOf(a.id) >= 0;
    const el = document.createElement('div');
    el.className = 'achrow' + (done ? ' done' : '');
    el.innerHTML = '<div class="mark">' + (done ? '◆' : '·') + '</div><div><div class="an">' + a.name + '</div><div class="ad">' + a.desc + '</div></div><div class="ar">' + (done ? 'CLAIMED' : (a.reward ? '+' + a.reward + ' DUST' : '') + (a.unlock ? ' · PILOT' : '')) + '</div>';
    list.appendChild(el);
  }
}
function renderHelp() {
  const rows = [
    ['MOVE', 'WASD / Arrow keys, or drag anywhere to steer a virtual joystick.'],
    ['DASH', 'SHIFT — a quick burst with brief invulnerability. Escape certain death.'],
    ['NOVA', 'SPACE (or the NOVA button) when the bar is full. Slow-motion, screen-wide destruction.'],
    ['AUTO-ATTACK', 'Your weapons fire themselves at the nearest foe. You only steer and survive.'],
    ['GRAZE', 'Skim past enemies without being hit to charge NOVA and build your combo. Risk = reward.'],
    ['LEVEL UP', 'Collect glowing XP gems. Each level offers a choice — forge your build.'],
    ['FUSIONS', 'Max a weapon AND own its matching passive to unlock its ULTIMATE evolved form.'],
    ['BOSSES', 'Heralds arrive at 1:30, 3:30, 5:30, 7:30. THE DEVOURER at 10:00. Defeat it to TRANSCEND.'],
    ['ASCEND', 'Death is not the end. Spend STARDUST on permanent power between runs.'],
    ['SECRET', 'Some rhythms are older than the void. A classic sequence on the title screen hides a gift.'],
  ];
  $('helpList').innerHTML = rows.map(r => '<div class="row"><span>' + r[0] + '</span><span>' + r[1] + '</span></div>').join('');
}
function abandonRun() {
  if (G) G.active = false;
  A.intensity = 0.12;
  setScene('title');
}

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
let konamiIdx = 0;
function handleKonami(k) {
  if (scene !== 'title') return;
  if (k === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx >= KONAMI.length) {
      konamiIdx = 0;
      if (Save.data.characters.indexOf('chromatic') < 0) {
        Save.data.characters.push('chromatic'); Save.save(); A.sfx('win');
        toast('A PRISM AWAKENS', 'CHROMATIC pilot unlocked.');
        flash('#ffffff', 0.8);
      } else toast('THE PRISM REMEMBERS', 'CHROMATIC is already yours.');
    }
  } else konamiIdx = (k === KONAMI[0]) ? 1 : 0;
}

function wire() {
  const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { A.resume(); fn(); }); };
  on('btnPlay', startRun);
  on('btnChar', () => { renderChars(); setScene('char'); });
  on('btnShop', () => { renderShop(); setScene('shop'); });
  on('btnAch', () => { renderAch(); setScene('ach'); });
  on('btnHelp', () => { renderHelp(); openScreen('help', 'title'); });
  on('btnSet', () => openScreen('settings', 'title'));
  on('btnCharBack', () => setScene('title'));
  on('btnShopBack', () => setScene('title'));
  on('btnAchBack', () => setScene('title'));
  on('btnHelpBack', () => setScene(backTarget));
  on('btnSetBack', () => setScene(backTarget));
  on('btnReroll', rerollChoices);
  on('btnResume', () => setScene('play'));
  on('btnPauseSet', () => openScreen('settings', 'paused'));
  on('btnPauseHelp', () => { renderHelp(); openScreen('help', 'paused'); });
  on('btnQuit', abandonRun);
  on('btnAgain', () => { if (G && G.won && !G.endless) continueEndless(); else startRun(); });
  on('btnGoMenu', () => { A.intensity = 0.12; setScene('title'); });
  $('novaBtn').addEventListener('pointerdown', e => { e.preventDefault(); A.resume(); nova(); });

  $('setMusic').addEventListener('input', e => { Save.data.settings.music = e.target.value / 100; A.applyVolumes(); Save.save(); });
  $('setSfx').addEventListener('input', e => { Save.data.settings.sfx = e.target.value / 100; A.applyVolumes(); Save.save(); });
  $('setShake').addEventListener('change', e => { Save.data.settings.shake = e.target.checked; Save.save(); });
  $('setReduced').addEventListener('change', e => { Save.data.settings.reduced = e.target.checked; Save.save(); });

  window.addEventListener('keydown', e => {
    A.resume();
    const k = e.key.toLowerCase();
    keys[k] = true;
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    handleKonami(k);
    if (k === 'p' || k === 'escape') { if (scene === 'play') setScene('paused'); else if (scene === 'paused') setScene('play'); }
    if ((k === ' ' || k === 'spacebar') && scene === 'play') nova();
    if (k === 'shift' && scene === 'play') dash();
    if (k === 'r' && scene === 'levelup') rerollChoices();
    if (scene === 'levelup' && /^[1-4]$/.test(k) && choiceCtx && choiceCtx.choices[parseInt(k) - 1]) applyChoice(choiceCtx.choices[parseInt(k) - 1]);
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('pointerdown', () => A.resume());

  canvas.addEventListener('pointerdown', e => {
    if (scene !== 'play') return;
    pointer.active = true; pointer.ox = e.clientX; pointer.oy = e.clientY; pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.dx = 0; pointer.dy = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointer.active) return;
    pointer.x = e.clientX; pointer.y = e.clientY;
    let dx = (pointer.x - pointer.ox) / 70, dy = (pointer.y - pointer.oy) / 70;
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    pointer.dx = dx; pointer.dy = dy;
  });
  const endPointer = () => { pointer.active = false; pointer.dx = 0; pointer.dy = 0; };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', endPointer);
}

let last = performance.now();
function loop(ts) {
  const dtReal = Math.min((ts - last) / 1000, 0.05);
  last = ts;
  effects.shake *= Math.pow(0.86, dtReal * 60);
  if (effects.shake < 0.2) effects.shake = 0;
  effects.flash = Math.max(0, effects.flash - dtReal * 2.2);
  if (effects.slowmo > 0) effects.slowmo -= dtReal;
  if (effects.hitstop > 0) effects.hitstop -= dtReal;
  if (warnTimer > 0) { warnTimer -= dtReal; if (warnTimer <= 0) $('warn').style.opacity = '0'; }
  if (scene === 'play' && G && G.active) {
    let dt = dtReal * (effects.slowmo > 0 ? 0.35 : 1);
    if (effects.hitstop > 0) dt *= 0.08;
    update(dt);
  }
  updateAmbient(dtReal);
  render();
  requestAnimationFrame(loop);
}

function init() {
  resize();
  initStars();
  initAmbient();
  Save.load();
  isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  wire();
  $('setMusic').value = Math.round(Save.data.settings.music * 100);
  $('setSfx').value = Math.round(Save.data.settings.sfx * 100);
  $('setShake').checked = Save.data.settings.shake;
  $('setReduced').checked = Save.data.settings.reduced;
  checkAchievements();
  setScene('title');
  requestAnimationFrame(loop);
}
init();
