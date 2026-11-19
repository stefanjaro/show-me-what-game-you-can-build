'use strict';
const UI = {
  save: null, screens: {}, bannerT: null, announceT: null, essTimer: null,
  charSel: 'necro',

  defaults: () => ({
    v: 1, essence: 0,
    meta: { might: 0, vitality: 0, swift: 0, wisdom: 0, greed: 0, mastery: 0, luck: 0, armor: 0, reroll: 0, revive: 0 },
    chars: { necro: true, doctor: false, witch: false },
    stats: { runs: 0, wins: 0, kills: 0, best: 0, raised: 0, endlessBest: 0 },
    opts: { music: true, sfx: true }
  }),

  boot: function () {
    UI.load();
    G.save = UI.save;
    const ids = ['scr-title', 'scr-chars', 'scr-altar', 'scr-help', 'scr-levelup', 'scr-chest', 'scr-pause', 'scr-death', 'scr-win', 'banner', 'announce', 'toast'];
    ids.forEach(id => UI.screens[id] = document.getElementById(id));
    UI.wire();
    UI.renderTitle();
    G.init();
    G.state = 'title';
    UI.show('scr-title');
    UI.setOpts();
    document.getElementById('cv').style.display = 'block';
    const unlockAudio = () => {
      A.ensure();
      A.setSfx(UI.save.opts.sfx);
      A.setMusic(UI.save.opts.music);
      if (G.state === 'title' || G.state === 'boot') { G.state = 'title'; A.startMusic('title'); }
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    document.addEventListener('pointerdown', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
  },

  load: function () {
    let s = null;
    try { s = JSON.parse(localStorage.getItem('gys_save')); } catch (e) { }
    const d = UI.defaults();
    if (s && s.v === 1) {
      UI.save = Object.assign(d, s);
      UI.save.meta = Object.assign(d.meta, s.meta || {});
      UI.save.chars = Object.assign(d.chars, s.chars || {});
      UI.save.stats = Object.assign(d.stats, s.stats || {});
      UI.save.opts = Object.assign(d.opts, s.opts || {});
    } else UI.save = d;
  },

  persist: function () {
    try { localStorage.setItem('gys_save', JSON.stringify(UI.save)); } catch (e) { }
  },

  wire: function () {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', e => { A.sfx('click'); fn(e); });
    };
    on('btn-play', () => { UI.renderChars(); UI.show('scr-chars', 'scr-title'); });
    on('btn-altar', () => { UI.renderAltar(); UI.show('scr-altar', 'scr-title'); });
    on('btn-help', () => UI.show('scr-help', 'scr-title'));
    on('btn-help-back', () => UI.show('scr-title', 'scr-help'));
    on('btn-char-back', () => { UI.renderTitle(); UI.show('scr-title', 'scr-chars'); });
    on('btn-char-start', () => { UI.hideAll(); G.beginRun(UI.charSel); });
    on('btn-altar-back', () => { UI.renderTitle(); UI.show('scr-title', 'scr-altar'); });
    on('btn-resume', () => UI.hidePause());
    on('btn-abandon', () => { UI.hidePause(); UI.toTitle(true); });
    on('btn-skip', () => { UI.hide('scr-levelup'); G.choiceDone(null, false); });
    on('btn-reroll', () => { if (G.rerolls > 0) G.choiceDone(null, true); });
    on('btn-chest-ok', () => { UI.hide('scr-chest'); G.chestDone(); });
    on('btn-death-retry', () => { UI.hideAll(); G.beginRun(G.char); });
    on('btn-death-title', () => UI.toTitle());
    on('btn-death-altar', () => { UI.renderAltar(); UI.show('scr-altar', 'scr-death'); });
    on('btn-win-title', () => UI.toTitle());
    on('btn-endless', () => { UI.hide('scr-win'); G.goEndless(); });
    on('opt-music', () => {
      UI.save.opts.music = !UI.save.opts.music;
      UI.persist(); UI.setOpts();
    });
    on('opt-sfx', () => {
      UI.save.opts.sfx = !UI.save.opts.sfx;
      UI.persist(); UI.setOpts();
    });
    const ab = document.getElementById('abwrap');
    if (ab) ab.addEventListener('click', () => {
      if (G.state === 'run' && !G.paused && !G.frozen && !G.p.dead) G.tryAbility();
    });
  },

  setOpts: function () {
    const m = document.getElementById('opt-music'), s = document.getElementById('opt-sfx');
    if (m) m.classList.toggle('off', !UI.save.opts.music);
    if (s) s.classList.toggle('off', !UI.save.opts.sfx);
    A.setSfx(UI.save.opts.sfx);
    A.setMusic(UI.save.opts.music);
  },

  show: function (id, hide) {
    if (hide) UI.hide(hide);
    const el = UI.screens[id];
    el.classList.remove('hidden');
    el.classList.add('active');
  },
  hide: function (id) {
    const el = UI.screens[id];
    el.classList.add('hidden');
    el.classList.remove('active');
  },
  hideAll: function () {
    for (const k in UI.screens) { UI.screens[k].classList.add('hidden'); UI.screens[k].classList.remove('active'); }
  },

  icon: function (name, size) {
    const img = document.createElement('img');
    img.src = (SPR[name] || SPR.iconAbility).toDataURL();
    if (size) { img.width = size; img.height = size; }
    img.alt = '';
    img.draggable = false;
    return img;
  },

  renderTitle: function () {
    const st = UI.save.stats;
    const el = document.getElementById('tstats');
    const nights = st.wins === 0 ? 'The dawn has never broken for you.' :
      st.wins === 1 ? 'You have survived ' + st.wins + ' night.' :
        'You have survived ' + st.wins + ' nights.';
    el.innerHTML =
      '<span>' + nights + '</span>' +
      '<span>' + st.runs + ' burials &middot; ' + st.kills.toLocaleString() + ' slain &middot; ' + st.raised.toLocaleString() + ' raised</span>' +
      (st.best > 0 ? '<span>Longest stand: ' + U.fmtTime(st.best) + '</span>' : '') +
      (st.endlessBest > 0 ? '<span>Reigned until ' + U.fmtTime(st.endlessBest) + '</span>' : '');
    document.getElementById('ess-title').textContent = UI.save.essence + ' ESSENCE';
  },

  renderChars: function () {
    const wrap = document.getElementById('char-cards');
    wrap.innerHTML = '';
    let sel = UI.charSel;
    for (const id in DATA.chars) {
      const c = DATA.chars[id];
      const owned = UI.save.chars[id];
      const card = document.createElement('div');
      card.className = 'char-card' + (owned ? '' : ' locked') + (id === sel ? ' sel' : '');
      const port = document.createElement('img');
      port.src = SPR[c.port].toDataURL();
      port.className = 'portrait';
      port.draggable = false;
      card.appendChild(port);
      const nm = document.createElement('div');
      nm.className = 'char-name';
      nm.textContent = c.name;
      card.appendChild(nm);
      const tt = document.createElement('div');
      tt.className = 'char-title2';
      tt.textContent = c.title;
      card.appendChild(tt);
      const inf = document.createElement('div');
      inf.className = 'char-info';
      inf.innerHTML =
        '<div class="char-row"><span>HEALTH</span><b>' + c.hp + '</b></div>' +
        '<div class="char-row"><span>SPEED</span><b>' + Math.round(c.spd * 100) + '%</b></div>' +
        '<div class="char-row"><span>STARTS WITH</span><b>' + DATA.weapons[c.weapon].name + '</b></div>' +
        '<div class="char-row perk"><span>BOON</span><b>' + c.perk + '</b></div>';
      card.appendChild(inf);
      if (!owned) {
        const lock = document.createElement('div');
        lock.className = 'char-lock';
        lock.innerHTML = 'SEALED<br><span>' + c.cost + ' ESSENCE</span>';
        card.appendChild(lock);
        card.addEventListener('click', () => {
          if (UI.save.essence >= c.cost) {
            UI.save.essence -= c.cost;
            UI.save.chars[id] = true;
            UI.persist();
            A.sfx('evolve');
            UI.toast(c.name + ' answers your call.');
            UI.renderChars();
          } else {
            A.sfx('error');
            UI.toast('Not enough essence. (' + UI.save.essence + ' / ' + c.cost + ')');
          }
        });
      } else {
        card.addEventListener('click', () => {
          A.sfx('hover');
          UI.charSel = id;
          UI.renderChars();
        });
      }
      wrap.appendChild(card);
    }
    const startBtn = document.getElementById('btn-char-start');
    const c = DATA.chars[UI.charSel];
    startBtn.textContent = UI.save.chars[UI.charSel] ? 'DESCEND AS ' + c.name.replace('The ', '').toUpperCase() : 'CHOOSE A SOUL';
    startBtn.classList.toggle('disabled', !UI.save.chars[UI.charSel]);
  },

  renderAltar: function () {
    document.getElementById('altar-ess').textContent = UI.save.essence + ' ESSENCE';
    const list = document.getElementById('altar-list');
    list.innerHTML = '';
    DATA.meta.forEach(up => {
      const rank = UI.save.meta[up.id] || 0;
      const row = document.createElement('div');
      row.className = 'altar-row';
      let pips = '';
      for (let i = 0; i < up.ranks; i++) pips += '<i class="' + (i < rank ? 'on' : '') + '"></i>';
      const maxed = rank >= up.ranks;
      const cost = maxed ? 0 : DATA.metaCost(up.base, rank);
      row.innerHTML =
        '<div class="altar-head"><span class="altar-name">' + up.name + '</span><span class="pips">' + pips + '</span></div>' +
        '<div class="altar-desc">' + up.desc + '</div>';
      const btn = document.createElement('button');
      if (maxed) { btn.className = 'altar-buy maxed'; btn.textContent = 'MASTERED'; btn.disabled = true; }
      else {
        btn.className = 'altar-buy';
        btn.textContent = cost + ' ESSENCE';
        btn.disabled = UI.save.essence < cost;
        if (btn.disabled) btn.classList.add('poor');
        btn.addEventListener('click', () => {
          if (UI.save.essence >= cost) {
            UI.save.essence -= cost;
            UI.save.meta[up.id] = rank + 1;
            UI.persist();
            A.sfx('chest');
            UI.renderAltar();
          }
        });
      }
      row.appendChild(btn);
      list.appendChild(row);
    });
  },

  setHUD: function (on) {
    document.getElementById('hud').classList.toggle('hidden', !on);
    const abIcon = document.getElementById('abicon');
    if (on && !abIcon.hasChildNodes()) abIcon.appendChild(UI.icon('iconAbility', 44));
  },

  banner: function (t, sub) {
    const b = UI.screens['banner'];
    b.querySelector('.banner-t').textContent = t;
    b.querySelector('.banner-s').textContent = sub || '';
    b.classList.remove('hidden');
    b.classList.remove('anim');
    void b.offsetWidth;
    b.classList.add('anim');
    if (UI.bannerT) clearTimeout(UI.bannerT);
    UI.bannerT = setTimeout(() => b.classList.add('hidden'), 3400);
  },

  announce: function (t, n, big) {
    const a = UI.screens['announce'];
    a.querySelector('.ann-t').textContent = t;
    a.querySelector('.ann-n').textContent = n !== undefined ? n + '' : '';
    a.classList.toggle('big', !!big);
    a.classList.remove('hidden');
    a.classList.remove('anim');
    void a.offsetWidth;
    a.classList.add('anim');
    if (UI.announceT) clearTimeout(UI.announceT);
    UI.announceT = setTimeout(() => a.classList.add('hidden'), big ? 2600 : 1800);
  },

  toast: function (t) {
    const el = UI.screens['toast'];
    el.textContent = t;
    el.classList.remove('hidden');
    el.classList.remove('anim');
    void el.offsetWidth;
    el.classList.add('anim');
    setTimeout(() => el.classList.add('hidden'), 2600);
  },

  showLevelUp: function (choices, rerolls) {
    const scr = UI.screens['scr-levelup'];
    const wrap = document.getElementById('lv-cards');
    wrap.innerHTML = '';
    choices.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'lcard ' + (c.kind === 'evolve' ? 'epic' : c.kind === 'weapon' ? 'weapon' : 'passive');
      const icon = UI.icon(c.icon, 76);
      icon.className = 'lcard-icon';
      card.appendChild(icon);
      const nm = document.createElement('div');
      nm.className = 'lcard-name';
      nm.textContent = c.name;
      card.appendChild(nm);
      if (c.kind === 'evolve') {
        const badge = document.createElement('div');
        badge.className = 'lcard-badge';
        badge.textContent = 'EVOLUTION';
        card.appendChild(badge);
      } else if (c.kind === 'weapon' && c.isNew) {
        const badge = document.createElement('div');
        badge.className = 'lcard-badge new';
        badge.textContent = 'NEW WEAPON';
        card.appendChild(badge);
      }
      if (c.max) {
        let pips = '<div class="lcard-pips">';
        for (let l = 1; l <= c.max; l++) pips += '<i class="' + (l < c.lv ? 'on' : (l === c.lv ? 'cur' : '')) + '"></i>';
        pips += '</div>';
        card.insertAdjacentHTML('beforeend', pips);
      }
      const fl = document.createElement('div');
      fl.className = 'lcard-flavor';
      fl.textContent = c.flavor;
      card.appendChild(fl);
      const ds = document.createElement('div');
      ds.className = 'lcard-desc';
      ds.textContent = c.desc;
      card.appendChild(ds);
      const key = document.createElement('div');
      key.className = 'lcard-key';
      key.textContent = (i + 1);
      card.appendChild(key);
      card.addEventListener('click', () => {
        UI.hide('scr-levelup');
        G.choiceDone(c, false);
      });
      card.addEventListener('mouseenter', () => A.sfx('hover'));
      card.classList.add('anim');
      wrap.appendChild(card);
    });
    const rr = document.getElementById('btn-reroll');
    if (rerolls > 0) {
      rr.classList.remove('hidden');
      document.getElementById('reroll-n').textContent = rerolls;
    } else rr.classList.add('hidden');
    UI.show('scr-levelup');
    const onKey = e => {
      if (G.state !== 'run' || !G.frozen) { document.removeEventListener('keydown', onKey); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= choices.length) {
        document.removeEventListener('keydown', onKey);
        UI.hide('scr-levelup');
        G.choiceDone(choices[n - 1], false);
      }
      if (e.key.toLowerCase() === 'r' && rerolls > 0) {
        document.removeEventListener('keydown', onKey);
        G.choiceDone(null, true);
      }
    };
    document.addEventListener('keydown', onKey);
  },

  showChest: function (reward) {
    const scr = UI.screens['scr-chest'];
    const card = document.getElementById('chest-card');
    card.innerHTML = '';
    const icon = UI.icon(reward.icon, 84);
    icon.className = 'lcard-icon';
    card.appendChild(icon);
    const nm = document.createElement('div');
    nm.className = 'lcard-name';
    nm.textContent = reward.name;
    card.appendChild(nm);
    const ds = document.createElement('div');
    ds.className = 'lcard-desc';
    ds.textContent = reward.text;
    card.appendChild(ds);
    UI.show('scr-chest');
    card.classList.remove('anim');
    void card.offsetWidth;
    card.classList.add('anim');
  },

  togglePause: function () {
    if (G.p.dead || G.frozen) return;
    if (UI.screens['scr-pause'].classList.contains('active')) { UI.hidePause(); return; }
    UI.showPause();
  },

  showPause: function () {
    const list = document.getElementById('pause-build');
    list.innerHTML = '';
    G.p.weapons.forEach(w => {
      const d = DATA.weapons[w.id];
      let pips = '';
      const mx = d.evolved ? 1 : d.max;
      for (let l = 1; l <= mx; l++) pips += '<i class="' + (l <= w.lv ? 'on' : '') + (l === mx && d.evolved ? 'gold' : '') + '"></i>';
      const row = document.createElement('div');
      row.className = 'build-row';
      row.innerHTML = '<img src="' + SPR[d.icon].toDataURL() + '" alt="" draggable="false">' +
        '<span class="build-name' + (d.evolved ? ' gold' : '') + '">' + d.name + '</span><span class="pips">' + pips + '</span>';
      list.appendChild(row);
    });
    for (const id in G.p.pas) {
      const d = DATA.passives[id];
      let pips = '';
      for (let l = 1; l <= d.max; l++) pips += '<i class="' + (l <= G.p.pas[id] ? 'on' : '') + '"></i>';
      const row = document.createElement('div');
      row.className = 'build-row passive';
      row.innerHTML = '<img src="' + SPR[d.icon].toDataURL() + '" alt="" draggable="false">' +
        '<span class="build-name">' + d.name + '</span><span class="pips">' + pips + '</span>';
      list.appendChild(row);
    }
    if (!G.p.weapons.length && !Object.keys(G.p.pas).length) list.innerHTML = '<div class="build-empty">Nothing yet. The night is young.</div>';
    G.paused = true;
    UI.show('scr-pause');
  },

  hidePause: function () {
    UI.hide('scr-pause');
    G.paused = false;
  },

  toTitle: function (abandoned) {
    if (abandoned) G.abandon();
    UI.hideAll();
    G.state = 'title';
    G.paused = false;
    G.frozen = false;
    UI.setHUD(false);
    A.startMusic('title');
    UI.renderTitle();
    UI.show('scr-title');
  },

  statGrid: function (s) {
    const rows = [
      ['Survived', U.fmtTime(s.time)],
      ['Level reached', s.level],
      ['Enemies slain', s.kills.toLocaleString()],
      ['Minions raised', s.raised.toLocaleString()],
      ['Elites devoured', s.elites],
      ['Champions felled', s.champs]
    ];
    if (s.endless) rows.push(['Reign ended', U.fmtTime(s.time)]);
    return rows.map(r => '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>').join('');
  },

  tallyEssence: function (el, target) {
    let cur = 0;
    if (UI.essTimer) clearInterval(UI.essTimer);
    const step = Math.max(1, Math.ceil(target / 40));
    el.textContent = '+0';
    UI.essTimer = setInterval(() => {
      cur = Math.min(target, cur + step);
      el.textContent = '+' + cur + ' ESSENCE';
      if (cur % (step * 3) === 0) A.sfx('tickup', cur / step);
      if (cur >= target) clearInterval(UI.essTimer);
    }, 34);
  },

  recordRun: function (s) {
    const st = UI.save.stats;
    st.runs++;
    st.kills += s.kills;
    st.raised += s.raised;
    st.best = Math.max(st.best, Math.floor(s.time));
    if (s.endless) st.endlessBest = Math.max(st.endlessBest, Math.floor(s.time));
    if (s.win) st.wins++;
    UI.save.essence += s.essence;
    UI.persist();
  },

  deathLines: [
    'The dawn was never yours to keep.',
    'Every army returns to the soil.',
    'The Order sings over your bones.',
    'Even empires of bone crumble.',
    'The moon closes one pale eye.',
    'Your last minion outlived you by seconds.'
  ],

  showDeath: function (s) {
    UI.recordRun(s);
    const scr = UI.screens['scr-death'];
    document.getElementById('death-title').textContent = U.pick(UI.deathLines);
    document.getElementById('death-stats').innerHTML = UI.statGrid(s);
    UI.show('scr-death');
    UI.tallyEssence(document.getElementById('death-ess'), s.essence);
    A.duck(false);
  },

  showWin: function (s) {
    UI.recordRun(s);
    const scr = UI.screens['scr-win'];
    document.getElementById('win-stats').innerHTML = UI.statGrid(s);
    UI.show('scr-win');
    UI.tallyEssence(document.getElementById('win-ess'), s.essence);
    A.duck(false);
  }
};

document.addEventListener('DOMContentLoaded', () => UI.boot());
