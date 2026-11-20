// EMBERDEEP — DOM/UI controller.

import { TILES } from './tiles.js';

const $ = (id) => document.getElementById(id);
const TILE_COLORS = TILES.map(t => t.color);

export class Dom {
  constructor() {
    this.cWorld = $('cWorld');
    this.cLight = $('cLight');
    this.cGlow = $('cGlow');
    this.stage = $('stage');
    this.overlays = {
      title: $('screen-title'), pause: $('screen-pause'), death: $('screen-death'),
      draft: $('screen-draft'), shop: $('screen-shop'), help: $('screen-help')
    };
    this.hud = $('hud');
    this.btnStart = $('btnStart'); this.btnShop = $('btnShop'); this.btnHelp = $('btnHelp');
    this.btnHelpBack = $('btnHelpBack'); this.btnResume = $('btnResume');
    this.btnPauseShop = $('btnPauseShop'); this.btnAbandon = $('btnAbandon');
    this.btnDeathShop = $('btnDeathShop'); this.btnAgain = $('btnAgain');
    this.btnSurface = $('btnSurface'); this.btnShopBack = $('btnShopBack');
    this.btnPause = $('btnPause');
    this.shopRows = $('shopRows');
    this.cinders = $('cinderCount');
    this.cinderBank = document.querySelector('.cinderBank');
    this.announceEl = $('announce');
    this.announceA = $('announceA');
    this.announceB = $('announceB');
    this.toastEl = $('toast');
    this.hpFill = $('hpFill'); this.hpGhost = $('hpGhost'); this.hpText = $('hpText');
    this.depthLabel = $('depthLabel'); this.biomeLabel = $('biomeLabel');
    this.objLabel = $('objLabel'); this.objDist = $('objDist');
    this.comboBox = $('comboBox'); this.comboVal = $('comboVal');
    this.scoreVal = $('scoreVal'); this.cinderVal = $('cinderVal');
    this.formName = $('formName'); this.dashPips = $('dashPips');
    this.bossBar = $('bossBar'); this.bossFill = $('bossFill');
    this.meters = Array.from(document.querySelectorAll('.meter')).map(el => ({
      el, fill: el.querySelector('.mTrack i')
    }));
    this.statDeep = $('statDeep'); this.statRuns = $('statRuns');
    this.statBest = $('statBest'); this.statCinders = $('statCinders');
    this.deathStats = $('deathStats'); this.deathCinders = $('deathCinders');
    this.draftCards = $('draftCards');
    this.minimap = $('minimap');
    this.mapCtx = this.minimap.getContext('2d');
    this.mapImg = this.mapCtx.createImageData(200, 120);
    this.mapBuf = new Uint32Array(this.mapImg.data.buffer);
    this.MW = 200; this.MH = 120; this.MSCALE = 2;
    this._toastT = null;
  }

  drawMinimap(g) {
    const w = g.world, t = w.tiles, ex = w.explored;
    const buf = this.mapBuf;
    const scale = this.MSCALE; // 1 minimap pixel = 2x2 world tiles
    for (let my = 0; my < this.MH; my++) {
      const wy = my * scale;
      if (wy >= 240) break;
      for (let mx = 0; mx < this.MW; mx++) {
        const wx = mx * scale;
        if (wx >= 400) break;
        const i = wy * 400 + wx;
        const idx = my * this.MW + mx;
        if (!ex[i]) { buf[idx] = 0x00000000; continue; }
        const tile = t[i];
        if (tile === 0) { buf[idx] = 0x00000000; continue; }
        const c = TILE_COLORS[tile] || [40, 40, 50];
        const r = Math.min(255, c[0] * 0.72) | 0, g = Math.min(255, c[1] * 0.72) | 0, b = Math.min(255, c[2] * 0.72) | 0;
        buf[idx] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
    this.mapCtx.putImageData(this.mapImg, 0, 0);
    const ctx = this.mapCtx;
    // viewport rectangle
    ctx.strokeStyle = 'rgba(255,190,120,0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(g.cam.tx / scale + 0.5, g.cam.ty / scale + 0.5, 160 / scale, 90 / scale);
    // the heart — always charted, always calling
    const hx = w.heart.x / scale, hy = w.heart.y / scale;
    if (w.heart.alive) {
      const pulse = 2.4 + Math.sin(performance.now() / 320) * 1.1;
      ctx.fillStyle = '#7fe6ff';
      ctx.beginPath(); ctx.arc(hx, hy, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(127,230,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(hx, hy, pulse + 2.6, 0, Math.PI * 2); ctx.stroke();
    }
    // the player
    const p = g.player;
    if (p) {
      const px = p.x / 4 / scale, py = p.y / 4 / scale;
      ctx.fillStyle = '#fff0c8';
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,200,120,0.55)';
      ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.stroke();
    }
  }

  show(name) {
    for (const k in this.overlays) this.overlays[k].classList.add('hidden');
    const keepHud = (name === 'hud' || name === 'pause' || name === 'draft');
    this.hud.classList.toggle('hidden', !keepHud);
    if (this.overlays[name]) this.overlays[name].classList.remove('hidden');
  }

  announce(a, b) {
    this.announceA.textContent = a;
    this.announceB.textContent = b || '';
    this.announceEl.classList.remove('hidden');
    this.announceEl.style.animation = 'none';
    void this.announceEl.offsetWidth;
    this.announceEl.style.animation = '';
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.add('hidden'), 1500);
  }

  shopFlash(msg) { this.toast(msg); }

  cinderPulse() {
    this.cinderBank.classList.add('pulse');
    setTimeout(() => this.cinderBank.classList.remove('pulse'), 220);
  }

  showDeath(s) {
    const rows = [
      ['SCORE', s.score.toLocaleString()],
      ['STRATUM', s.stratum],
      ['FOES SLAIN', s.kills],
      ['TILES EARNED', s.tiles.toLocaleString()],
      ['SHARDS', s.shards],
      ['TIME', Math.floor(s.time / 60) + ':' + String(Math.floor(s.time % 60)).padStart(2, '0')]
    ];
    this.deathStats.innerHTML = rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    this.deathCinders.textContent = '+' + s.cinders;
    this.show('death');
  }

  showDraft(options, onPick) {
    this.draftCards.innerHTML = '';
    options.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<div class="cardIcon">${m.icon}</div><div class="cardName">${m.name}</div><div class="cardDesc">${m.desc}</div><div class="cardKey">PRESS ${i + 1}</div>`;
      card.addEventListener('click', () => onPick(m));
      this.draftCards.appendChild(card);
    });
    this.show('draft');
    this._draftOpts = options;
    this._draftPick = onPick;
  }

  pickDraft(i) {
    if (this._draftOpts && this._draftOpts[i]) {
      const m = this._draftOpts[i];
      this._draftOpts = null;
      this._draftPick(m);
    }
  }

  updateStats(save) {
    this.statDeep.textContent = save.stats.deepest ? 'STRATUM ' + save.stats.deepest : '—';
    this.statRuns.textContent = save.stats.runs;
    this.statBest.textContent = save.stats.best ? save.stats.best.toLocaleString() : '—';
    this.statCinders.textContent = save.cinders.toLocaleString();
  }

  updateHUD(g) {
    const p = g.player;
    if (!p) return;
    const pct = Math.max(0, p.hp / p.maxHp) * 100;
    this.hpFill.style.width = pct + '%';
    this.hpGhost.style.width = pct + '%';
    this.hpText.textContent = Math.ceil(Math.max(0, p.hp));
    this.depthLabel.textContent = 'STRATUM ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][Math.min(11, g.run.stratum - 1)];
    this.biomeLabel.textContent = g.world.biome.name;
    this.scoreVal.textContent = g.run.score.toLocaleString();
    const combo = g.run.combo || 0;
    this.comboBox.classList.toggle('hidden', combo < 2);
    if (combo >= 2) this.comboVal.textContent = Math.min(5, 1 + (combo - 1) * 0.25).toFixed(2).replace('.00', '');
    if (g.world.heart.alive) {
      const dx = g.world.heart.x * 4 - p.x, dy = g.world.heart.y * 4 - p.y;
      const steps = Math.round(Math.hypot(dx, dy) / 4);
      this.objDist.textContent = steps + ' STEPS';
    } else {
      this.objDist.textContent = '—';
    }
    this.cinderVal.textContent = g.save.cinders.toLocaleString();
    this.formName.textContent = ['EMBER', 'TIDE', 'SPARK', 'BLOOM'][p.form];
    this.formName.style.color = ['#ffc98c', '#8fd0ff', '#fff3a0', '#a9f5b8'][p.form];
    for (let i = 0; i < 4; i++) {
      const m = this.meters[i];
      m.fill.style.width = Math.min(100, (p.meters[i] / p.cap) * 100) + '%';
      m.el.classList.toggle('active', p.form === i);
    }
    // dash pips
    const want = p.dashMax;
    if (this.dashPips.childElementCount !== want) {
      this.dashPips.innerHTML = '';
      for (let i = 0; i < want; i++) this.dashPips.appendChild(document.createElement('i'));
    }
    const pips = this.dashPips.children;
    for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < p.dash);
    // boss
    const boss = g.enemies.find(e => e.type === 'warden');
    if (boss) {
      this.bossBar.classList.remove('hidden');
      this.bossFill.style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + '%';
    } else {
      this.bossBar.classList.add('hidden');
    }
  }
}
