/* POLARIS — DOM UI: screens, cards, star map, toasts, banners */

import { META, metaCost, COLORS } from './data.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      title: $('screen-title'),
      howto: $('screen-howto'),
      starmap: $('screen-starmap'),
      levelup: $('levelup'),
      cardRow: $('card-row'),
      pause: $('pause'),
      pauseStats: $('pause-stats'),
      endscreen: $('endscreen'),
      victory: $('victory'),
      banner: $('banner'),
      bannerText: $('banner-text'),
      toastStack: $('toast-stack'),
      stardustLabel: $('stardust-label'),
      stardustValue: $('stardust-value'),
      bestRecord: $('best-record'),
      muteBtn: $('btn-mute'),
      starmapTip: $('starmap-tip'),
      svg: $('starmap-svg'),
    };
    this.game = null;
    this.starmapFrom = 'title';
    this._bannerT = null;
    this._bind();
  }

  attach(game) {
    this.game = game;
    this.refreshMeta(game);
    this.updateMute();
  }

  /* ---------------- helpers ---------------- */
  show(el) { el.classList.remove('hidden'); }
  hide(el) { el.classList.add('hidden'); }

  hideAllScreens() {
    this.hide(this.el.title);
    this.hide(this.el.howto);
    this.hide(this.el.starmap);
    this.hide(this.el.endscreen);
    this.hide(this.el.victory);
    this.hide(this.el.pause);
    this.hide(this.el.levelup);
  }

  requestStart() {
    const game = this.game;
    if (!game) return;
    if (!game.save.seenHowto) {
      this.hide(this.el.title);
      this.show(this.el.howto);
      this._pendingStart = true;
      return;
    }
    game.startRun();
  }

  /* ---------------- title / meta ---------------- */
  showTitle() {
    this.hideAllScreens();
    this.show(this.el.title);
    this.refreshMeta(this.game);
  }

  refreshMeta(game) {
    if (!game) return;
    const s = game.save;
    this.el.stardustLabel.textContent = `${s.stardust} stardust`;
    this.el.stardustValue.textContent = s.stardust;
    const best = s.best || {};
    if (best.score > 0) {
      const mins = Math.floor((best.time || 0) / 60), secs = Math.floor((best.time || 0) % 60);
      this.el.bestRecord.textContent = `best ${best.score} · ${mins}:${secs < 10 ? '0' : ''}${secs}` + (best.wins ? ` · ${best.wins} dawn${best.wins > 1 ? 's' : ''}` : '');
    } else {
      this.el.bestRecord.textContent = 'no record yet';
    }
  }

  updateMute() {
    if (this.game) {
      this.el.muteBtn.textContent = this.game.save.muted ? '♪ SOUND: OFF' : '♪ SOUND: ON';
    }
  }

  /* ---------------- banner / toast ---------------- */
  banner(text, dur = 1.8, win = false) {
    const b = this.el.banner;
    this.el.bannerText.textContent = text;
    b.classList.remove('hidden', 'banner-out', 'win-banner');
    if (win) b.classList.add('win-banner');
    /* restart animation */
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => {
      b.classList.add('banner-out');
      setTimeout(() => b.classList.add('hidden'), 450);
    }, dur * 1000);
  }

  toast(text, cls = '') {
    const t = document.createElement('div');
    t.className = `toast ${cls}`;
    t.textContent = text;
    this.el.toastStack.appendChild(t);
    setTimeout(() => {
      t.classList.add('toast-out');
      setTimeout(() => t.remove(), 420);
    }, 2800);
    while (this.el.toastStack.children.length > 4) this.el.toastStack.firstChild.remove();
  }

  /* ---------------- cards ---------------- */
  showCards(game, cards) {
    const row = this.el.cardRow;
    row.innerHTML = '';
    this.show(this.el.levelup);
    if (!cards.length) {
      /* fallback: heal */
      game.player.hp = Math.min(game.player.maxHp, game.player.hp + 40);
      this.hide(this.el.levelup);
      game.state = 'playing';
      this.toast('The light mends you', 'gold');
      return;
    }
    cards.forEach((c, i) => {
      const rank = game.player.mods[c.id] || 0;
      const div = document.createElement('div');
      div.className = `card rarity-${c.rarity}`;
      div.dataset.idx = i;
      const rarityLabel = c.rarity === 'legendary' ? 'EVOLUTION' : c.rarity.toUpperCase();
      div.innerHTML = `
        <span class="card-key">${i + 1}</span>
        <div class="card-icon" style="color:${iconColor(c)}">${c.icon}</div>
        <div class="card-rarity">${rarityLabel} · ${c.tag}</div>
        <div class="card-name">${c.name}</div>
        <div class="card-desc">${c.desc}</div>
        <div class="card-tag">${c.rarity === 'legendary' ? 'consumes its ingredients' : `rank ${rank} → ${rank + 1}`}</div>
      `;
      div.addEventListener('mouseenter', () => this.game?.audio.cardHover());
      div.addEventListener('click', () => this.game?.press('card', i));
      row.appendChild(div);
    });
  }

  hideCards() { this.hide(this.el.levelup); }

  /* ---------------- pause ---------------- */
  showPause(game) {
    const p = game.player;
    this.el.pauseStats.innerHTML = `
      <span>TIME<b>${fmtT(game.t)}</b></span>
      <span>LEVEL<b>${game.level}</b></span>
      <span>SHATTERED<b>${game.kills}</b></span>
      <span>RESONANCE<b>${Math.floor(game.score)}</b></span>
    `;
    this.show(this.el.pause);
  }
  hidePause() { this.hide(this.el.pause); }

  /* ---------------- end screens ---------------- */
  showEnd(game, stardust) {
    const s = game.save;
    const isBest = Math.floor(game.score) >= (s.best.score || 0) && game.score > 0;
    $('end-eyebrow').textContent = game.t > 600 ? 'THE VOID REMEMBERS YOU' : 'THE VOID TAKES YOU';
    $('end-title').textContent = 'EXTINGUISHED';
    $('end-score').textContent = Math.floor(game.score).toLocaleString();
    $('end-grid').innerHTML = cells([
      [fmtT(game.t), 'survived'],
      [game.kills, 'shattered'],
      [`LV ${game.level}`, 'light'],
      [game.bossesKilled + '/4', 'heralds'],
    ]);
    $('end-stardust').textContent = stardust;
    const un = $('end-unlock');
    if (isBest) {
      un.classList.remove('hidden');
      un.textContent = '✦ NEW RESONANCE RECORD ✦';
    } else un.classList.add('hidden');
    this.hideAllScreens();
    this.show(this.el.endscreen);
  }

  showVictory(game, stardust) {
    $('victory-grid').innerHTML = cells([
      [fmtT(game.t), 'survived'],
      [game.kills, 'shattered'],
      [`LV ${game.level}`, 'light'],
      [Math.floor(game.score).toLocaleString(), 'resonance'],
    ]);
    $('victory-stardust').textContent = stardust;
    this.hideAllScreens();
    this.show(this.el.victory);
  }

  /* ---------------- star map ---------------- */
  showStarMap(from = 'title') {
    this.starmapFrom = from;
    this.hideAllScreens();
    this.show(this.el.starmap);
    this.buildStarMap();
    this.el.starmapTip.textContent = 'Hover a star to read its light. Click the bright one to ignite it.';
  }

  hideStarMap() { this.hide(this.el.starmap); }

  buildStarMap() {
    const svg = this.el.svg;
    const NS = 'http://www.w3.org/2000/svg';
    const game = this.game;
    const save = game.save;
    svg.innerHTML = '';

    const mk = (tag, attrs = {}) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    };

    /* defs */
    const defs = mk('defs');
    defs.innerHTML = `
      <radialGradient id="smGlow"><stop offset="0%" stop-color="#ffd166" stop-opacity="0.9"/><stop offset="100%" stop-color="#ffd166" stop-opacity="0"/></radialGradient>
      <radialGradient id="smGlowC"><stop offset="0%" stop-color="#2de1ff" stop-opacity="0.8"/><stop offset="100%" stop-color="#2de1ff" stop-opacity="0"/></radialGradient>
      <filter id="smSoft" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4"/></filter>
    `;
    svg.appendChild(defs);

    /* decorative background stars */
    const bg = mk('g', { opacity: '0.75' });
    let seed = 7717;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 150; i++) {
      const x = rnd() * 1200, y = rnd() * 720, r = rnd() * 1.5 + 0.4;
      const tw = rnd();
      bg.appendChild(mk('circle', {
        cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1),
        fill: tw > 0.9 ? '#2de1ff' : tw > 0.8 ? '#ff2d78' : '#aab4ff',
        opacity: (0.15 + rnd() * 0.5).toFixed(2),
      }));
    }
    svg.appendChild(bg);

    /* title constellation label */
    const label = mk('text', {
      x: 600, y: 42, 'text-anchor': 'middle', fill: 'rgba(233,236,255,0.9)',
      'font-family': '"Chakra Petch", sans-serif', 'font-size': '22', 'letter-spacing': '10',
    });
    label.textContent = '✦ CONSTELLATION OF THE LAST STAR ✦';
    svg.appendChild(label);

    /* tracks */
    const trackNodes = {};
    META.tracks.forEach((track, ti) => {
      const lvl = save.meta[track.id] || 0;
      const baseX = 108 + ti * 164;
      const arc = Math.sin((ti / (META.tracks.length - 1)) * Math.PI) * -34;
      const pts = [];
      for (let n = 0; n < track.max; n++) {
        const x = baseX + Math.sin(n * 1.35 + ti * 1.1) * 26;
        const y = 492 - n * 88 + arc * (n / (track.max - 1));
        pts.push({ x, y });
      }
      trackNodes[track.id] = pts;

      /* connecting line */
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let n = 1; n < pts.length; n++) d += ` L ${pts[n].x} ${pts[n].y}`;
      svg.appendChild(mk('path', {
        d, fill: 'none', stroke: 'rgba(120,130,200,0.32)', 'stroke-width': '2',
        'stroke-dasharray': '1 0',
      }));
      /* lit portion */
      if (lvl > 0) {
        let dl = `M ${pts[0].x} ${pts[0].y}`;
        for (let n = 1; n < lvl; n++) dl += ` L ${pts[n].x} ${pts[n].y}`;
        svg.appendChild(mk('path', {
          d: dl, fill: 'none', stroke: '#ffd166', 'stroke-width': '2.5', opacity: '0.9',
        }));
      }

      /* track name */
      const nm = mk('text', {
        x: pts[0].x, y: 524, 'text-anchor': 'middle', fill: lvl >= track.max ? '#ffd166' : 'rgba(160,168,220,0.9)',
        'font-family': '"Chakra Petch", sans-serif', 'font-size': '11', 'letter-spacing': '2.5',
      });
      nm.textContent = track.name;
      svg.appendChild(nm);

      /* nodes */
      pts.forEach((pt, n) => {
        const lit = n < lvl;
        const frontier = n === lvl;
        const cost = metaCost(track, n);
        const g = mk('g', {
          class: `sm-node${!frontier ? ' maxed' : ''}`,
          'data-kind': 'track', 'data-id': track.id, 'data-node': n,
        });
        const afford = save.stardust >= cost;
        const r = lit ? 13 : frontier ? 12 : 9;

        if (frontier && afford) {
          const glow = mk('circle', { cx: pt.x, cy: pt.y, r: 30, fill: 'url(#smGlowC)', class: 'sm-glow', opacity: '0.55' });
          g.appendChild(glow);
          const pulse = mk('circle', {
            cx: pt.x, cy: pt.y, r: 17, fill: 'none', stroke: '#2de1ff', 'stroke-width': '1.5',
            opacity: '0.85',
          });
          pulse.appendChild(mk('animate', { attributeName: 'r', values: '15;22;15', dur: '1.8s', repeatCount: 'indefinite' }));
          pulse.appendChild(mk('animate', { attributeName: 'opacity', values: '0.9;0.2;0.9', dur: '1.8s', repeatCount: 'indefinite' }));
          g.appendChild(pulse);
        }
        if (lit) {
          const glow = mk('circle', { cx: pt.x, cy: pt.y, r: 26, fill: 'url(#smGlow)', class: 'sm-glow', opacity: '0.75' });
          g.appendChild(glow);
        }
        const ring = mk('circle', {
          class: 'sm-ring', cx: pt.x, cy: pt.y, r,
          fill: lit ? '#1a1408' : '#0a0d1e',
          stroke: lit ? '#ffd166' : frontier ? '#2de1ff' : 'rgba(130,140,200,0.5)',
          'stroke-width': lit ? 2.5 : frontier ? 2.2 : 1.5,
        });
        g.appendChild(ring);
        const core = mk('circle', {
          cx: pt.x, cy: pt.y, r: lit ? 5 : frontier ? 4.5 : 3,
          fill: lit ? '#ffd166' : frontier ? '#2de1ff' : 'rgba(130,140,200,0.6)',
        });
        g.appendChild(core);

        const tip = mk('title');
        tip.textContent = lit ? `${track.name} ${n + 1}/${track.max} — lit`
          : frontier ? `${track.name} → ${track.per} — ✦ ${cost}` : `${track.name} — locked`;
        g.appendChild(tip);
        svg.appendChild(g);
      });
    });

    /* gifts row */
    const giftsLine = mk('path', {
      d: `M ${META.gifts[0].x} 600 L ${META.gifts[META.gifts.length - 1].x} 600`,
      fill: 'none', stroke: 'rgba(255,45,120,0.35)', 'stroke-width': '2', 'stroke-dasharray': '6 8',
    });
    svg.appendChild(giftsLine);

    META.gifts.forEach(gift => {
      const owned = !!save.gifts[gift.id];
      const afford = save.stardust >= gift.cost;
      const g = mk('g', { class: `sm-node${owned ? ' maxed' : ''}`, 'data-kind': 'gift', 'data-id': gift.id });
      const x = gift.x, y = 600;
      if (!owned && afford) {
        const glow = mk('circle', { cx: x, cy: y, r: 34, fill: 'url(#smGlow)', class: 'sm-glow', opacity: '0.5' });
        g.appendChild(glow);
      }
      /* diamond */
      const s = owned ? 15 : 13;
      const dia = mk('path', {
        d: `M ${x} ${y - s} L ${x + s} ${y} L ${x} ${y + s} L ${x - s} ${y} Z`,
        fill: owned ? '#2a1608' : '#0a0d1e',
        stroke: owned ? '#ffd166' : afford ? '#ff2d78' : 'rgba(140,150,210,0.55)',
        'stroke-width': owned ? 2.6 : 2,
      });
      g.appendChild(dia);
      const core = mk('path', {
        d: `M ${x} ${y - 5} L ${x + 5} ${y} L ${x} ${y + 5} L ${x - 5} ${y} Z`,
        fill: owned ? '#ffd166' : afford ? '#ff2d78' : 'rgba(140,150,210,0.6)',
      });
      g.appendChild(core);
      const nm = mk('text', {
        x, y: y + 34, 'text-anchor': 'middle',
        fill: owned ? '#ffd166' : 'rgba(190,196,240,0.95)',
        'font-family': '"Chakra Petch", sans-serif', 'font-size': '12', 'letter-spacing': '2',
      });
      nm.textContent = owned ? gift.name : `${gift.name} ✦${gift.cost}`;
      g.appendChild(nm);
      const tip = mk('title');
      tip.textContent = owned ? `${gift.name} — owned` : `${gift.name} — ${gift.tip} (✦ ${gift.cost})`;
      g.appendChild(tip);
      svg.appendChild(g);
    });

    /* footer hint */
    const foot = mk('text', {
      x: 600, y: 692, 'text-anchor': 'middle', fill: 'rgba(140,148,205,0.85)',
      'font-family': '"Rajdhani", sans-serif', 'font-size': '15', 'letter-spacing': '3',
    });
    foot.textContent = 'Stardust is earned by surviving, shattering, and toppling heralds.';
    svg.appendChild(foot);

    /* events (delegated once) */
    if (!this._svgBound) {
      this._svgBound = true;
      svg.addEventListener('mouseover', e => {
        const node = e.target.closest('.sm-node');
        if (!node || !this.game) return;
        const tip = node.querySelector('title');
        if (tip) this.el.starmapTip.textContent = tip.textContent;
        this.game.audio.ensure();
        this.game.audio.ui('hover');
      });
      svg.addEventListener('mouseout', e => {
        if (e.target.closest('.sm-node')) {
          this.el.starmapTip.textContent = 'Hover a star to read its light. Click the bright one to ignite it.';
        }
      });
      svg.addEventListener('click', e => {
        const node = e.target.closest('.sm-node');
        if (!node) return;
        this.buyNode(node.dataset.kind, node.dataset.id, parseInt(node.dataset.node, 10));
      });
    }
  }

  buyNode(kind, id, nodeIdx) {
    const game = this.game;
    const save = game.save;
    const audio = game.audio;
    audio.ensure();
    if (kind === 'track') {
      const track = META.tracks.find(t => t.id === id);
      if (!track) return;
      const lvl = save.meta[id] || 0;
      if (nodeIdx !== lvl || lvl >= track.max) { audio.deny(); return; }
      const cost = metaCost(track, lvl);
      if (save.stardust < cost) { audio.deny(); this.toast(`Need ${cost} ✦ stardust`, 'crimson'); return; }
      save.stardust -= cost;
      save.meta[id] = lvl + 1;
      persistSave(save);
      audio.buy();
      this.toast(`${track.name} ${lvl + 1} lit — ${track.per}`, 'gold');
      this.refreshMeta(game);
      this.buildStarMap();
    } else if (kind === 'gift') {
      const gift = META.gifts.find(t => t.id === id);
      if (!gift) return;
      if (save.gifts[id]) { audio.deny(); return; }
      if (save.stardust < gift.cost) { audio.deny(); this.toast(`Need ${gift.cost} ✦ stardust`, 'crimson'); return; }
      save.stardust -= gift.cost;
      save.gifts[id] = true;
      persistSave(save);
      audio.buy();
      this.toast(`${gift.name} unlocked — ${gift.tip}`, 'gold');
      this.refreshMeta(game);
      this.buildStarMap();
    }
  }

  /* ---------------- wiring ---------------- */
  _bind() {
    const g = () => this.game;
    const click = (id, fn) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener('click', e => {
        e.currentTarget.blur?.();
        g()?.audio.ensure();
        g()?.audio.ui('click');
        fn();
      });
      el.addEventListener('mouseenter', () => g()?.audio.ui('hover'));
    };

    click('btn-start', () => this.requestStart());
    click('btn-starmap', () => this.showStarMap('title'));
    click('btn-howto', () => { this.hide(this.el.title); this.show(this.el.howto); });
    click('btn-howto-back', () => {
      this.hide(this.el.howto);
      if (this._pendingStart) {
        this._pendingStart = false;
        const game = this.game;
        game.save.seenHowto = true;
        try { localStorage.setItem('polaris_save_v1', JSON.stringify(game.save)); } catch (e) {}
        game.startRun();
      } else {
        this.show(this.el.title);
      }
    });
    click('btn-starmap-back', () => {
      this.hideStarMap();
      if (this.starmapFrom === 'end' || this.starmapFrom === 'victory') {
        /* return to end screen */
        if (g().state === 'dead') this.show(this.el.endscreen);
        else if (g().state === 'victory') this.show(this.el.victory);
        else this.showTitle();
      } else this.showTitle();
    });
    click('btn-mute', () => { g()?.press('mute'); this.updateMute(); });
    click('btn-resume', () => g()?.press('pause'));
    click('btn-quit', () => g()?.press('quit'));
    click('btn-retry', () => g()?.startRun());
    click('btn-tostarmap', () => this.showStarMap('end'));
    click('btn-tomenu', () => { g().state = 'menu'; this.showTitle(); });
    click('btn-win-retry', () => g()?.startRun());
    click('btn-win-menu', () => { g().state = 'menu'; this.showTitle(); });
  }
}

function iconColor(c) {
  if (c.rarity === 'legendary') return COLORS.gold;
  if (c.rarity === 'epic') return COLORS.violet;
  if (c.rarity === 'rare') return COLORS.cyan;
  return '#dfe4ff';
}
function cells(list) {
  return list.map(([v, l]) => `<div class="end-cell"><b>${v}</b><span>${l}</span></div>`).join('');
}
function fmtT(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
export function persistSave(save) {
  try { localStorage.setItem('polaris_save_v1', JSON.stringify(save)); } catch (e) { /* ignore */ }
}
