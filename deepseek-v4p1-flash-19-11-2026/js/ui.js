import {
  clamp, formatScore, formatTime,
} from './util.js';
import {
  WEAPONS, META, RARITIES, UPGRADE_BY_ID, COLORS,
} from './data.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor({ game, audio, save }) {
    this.game = game;
    this.audio = audio;
    this.save = save;
    this.current = 'title';
    this.selectedWeapon = 'pulsar';
    this.lastRun = null;
    this.timers = {};
    this.screens = {
      title: $('screen-title'),
      loadout: $('screen-loadout'),
      meta: $('screen-meta'),
      how: $('screen-how'),
      levelup: $('screen-levelup'),
      pause: $('screen-pause'),
      gameover: $('screen-gameover'),
    };
    this.cursor = {
      dot: $('cursorDot'), ring: $('cursorRing'),
      x: innerWidth / 2, y: innerHeight / 2, rx: innerWidth / 2, ry: innerHeight / 2,
    };
    this.bind();
    this.setupCursor();
    this.refreshTitle();
    this.updateSoundIcons();
    if (this.game.isTouch) document.body.classList.add('touch');
  }

  // ============================================================
  // screen plumbing
  // ============================================================
  show(name) {
    for (const [k, el] of Object.entries(this.screens)) {
      el.classList.toggle('active', k === name);
    }
    this.current = name;
  }

  hideAll() {
    for (const el of Object.values(this.screens)) el.classList.remove('active');
    this.current = null;
  }

  showTitle() {
    this.game.state = 'menu';
    this.game.el.hud.classList.remove('on');
    this.game.el.bossBar.classList.remove('on');
    this.setTouchControls(false);
    this.game.audio.setIntensity(0);
    this.game.audio.setDanger(0);
    this.refreshTitle();
    this.show('title');
  }

  startRunUI() {
    this.hideAll();
    this.current = 'game';
  }

  showLoadout() {
    this.game.state = 'menu';
    this.game.el.hud.classList.remove('on');
    this.setTouchControls(false);
    this.buildLoadout();
    this.show('loadout');
  }

  showMeta() {
    if (this.game.state === 'dead') this.game.state = 'menu';
    this.game.el.hud.classList.remove('on');
    this.setTouchControls(false);
    this.game.audio.setIntensity(0);
    this.game.audio.setDanger(0);
    this.buildMeta();
    this.refreshTitle();
    this.show('meta');
  }

  showHow() {
    this.game.state = 'menu';
    this.game.el.hud.classList.remove('on');
    this.setTouchControls(false);
    this.show('how');
  }

  showPause() {
    $('pauseWeapon').textContent = this.game.weapon.name;
    $('pauseWeapon').style.color = this.game.weapon.color;
    const build = $('pauseBuild');
    build.innerHTML = '';
    const entries = Object.entries(this.game.upgrades || {});
    if (!entries.length) {
      build.innerHTML = '<span class="empty-build">no blessings yet</span>';
    } else {
      entries.slice(0, 10).forEach(([id, count]) => {
        const u = UPGRADE_BY_ID[id];
        if (!u) return;
        const chip = document.createElement('span');
        chip.className = 'build-chip';
        chip.style.setProperty('--rc', RARITIES[u.rarity].color);
        chip.innerHTML = `<svg><use href="#${u.icon}"/></svg>${u.name}${count > 1 ? ` <b>×${count}</b>` : ''}`;
        build.appendChild(chip);
      });
    }
    this.updateSoundIcons();
    this.show('pause');
  }

  hidePause() {
    if (this.current === 'pause') this.hideAll();
  }

  showLevelUp(level, choices, rerolls) {
    $('levelupKicker').textContent = `LEVEL ${level}`;
    const wrap = $('upgradeCards');
    wrap.innerHTML = '';
    choices.forEach((u, i) => {
      const r = RARITIES[u.rarity];
      const card = document.createElement('button');
      card.className = 'upgrade-card';
      card.style.setProperty('--rc', r.color);
      const stacks = this.game.upgrades[u.id] || 0;
      const stackLabel = stacks > 0 ? `LV ${stacks} → ${stacks + 1}` : 'NEW BLESSING';
      const maxLabel = u.max >= 90 ? 'REPEATABLE' : u.max > 1 ? `MAX ${u.max}` : 'UNIQUE';
      card.innerHTML = `
        <div class="u-watermark"><svg><use href="#${u.icon}"/></svg></div>
        <div class="urarity"><span>${r.name}</span><span class="unum">0${i + 1}</span></div>
        <div class="u-icon"><svg><use href="#${u.icon}"/></svg></div>
        <h3>${u.name}</h3>
        <p class="u-what">${u.what}</p>
        <p class="u-desc">${u.desc}</p>
        <div class="u-foot"><span>${stackLabel}</span><span class="ustack">${maxLabel}</span></div>`;
      card.addEventListener('click', () => {
        this.audio.uiClick();
        this.game.chooseUpgrade(u.id);
      });
      wrap.appendChild(card);
    });
    $('rerollCount').textContent = rerolls;
    $('btnReroll').disabled = rerolls <= 0;
    if (this.current !== 'levelup') this.show('levelup');
  }

  hideLevelUp() {
    if (this.current === 'levelup') this.hideAll();
  }

  setTouchControls(on) {
    const el = $('touchControls');
    if (!el) return;
    el.classList.toggle('hidden', !on);
  }

  // ============================================================
  // title
  // ============================================================
  refreshTitle() {
    $('titleDust').textContent = formatScore(this.save.dust);
    $('titleBest').textContent = formatScore(this.save.data.bestScore);
    $('titleBestWave').textContent = this.save.data.bestWave;
    $('dustAmount').textContent = formatScore(this.save.dust);
  }

  syncBest() {
    this.refreshTitle();
  }

  banner(title, sub, boss = false) {
    const el = this.game.el.banner;
    this.game.el.bannerTitle.textContent = title;
    this.game.el.bannerSub.textContent = sub || '';
    el.classList.toggle('boss', !!boss);
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this.timers.banner);
    this.timers.banner = setTimeout(() => el.classList.remove('show'), 3100);
  }

  toast(text, bad = false, ms = 2400) {
    const el = this.game.el.toast;
    el.textContent = text;
    el.classList.toggle('bad', !!bad);
    el.classList.add('on');
    clearTimeout(this.timers.toast);
    this.timers.toast = setTimeout(() => el.classList.remove('on'), ms);
  }

  // ============================================================
  // loadout
  // ============================================================
  buildLoadout() {
    if (!this.save.isUnlocked(this.selectedWeapon)) this.selectedWeapon = 'pulsar';
    const grid = $('weaponGrid');
    grid.innerHTML = '';
    WEAPONS.forEach((w, i) => {
      const unlocked = this.save.isUnlocked(w.id);
      const selected = this.selectedWeapon === w.id;
      const card = document.createElement('button');
      card.className = 'weapon-card' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked');
      card.style.setProperty('--wc', w.color);
      card.innerHTML = `
        <div class="weapon-top"><span class="weapon-index">0${i + 1}</span><span>${w.tag}</span></div>
        <div class="weapon-icon"><svg><use href="#${w.icon}"/></svg></div>
        <h3>${w.name}</h3>
        <p class="wp-desc">${w.desc}</p>
        <div class="wp-stats">
          ${Object.entries(w.bars).map(([k, v]) => `<div class="wp-stat"><span>${k}</span><i><b style="width:${v * 100}%"></b></i></div>`).join('')}
        </div>
        <div class="weapon-state">
          <span>${unlocked ? (selected ? 'EQUIPPED' : 'READY') : 'LOCKED'}</span>
          <span class="lock-glyph">${unlocked ? (selected ? '✦' : '›') : `✦ ${w.cost}`}</span>
        </div>`;
      card.addEventListener('click', () => {
        if (!unlocked) {
          this.audio.uiClick();
          this.toast(`UNLOCK ${w.name} IN THE CONSTELLATION · ✦ ${w.cost}`, true, 2600);
          return;
        }
        this.selectedWeapon = w.id;
        this.audio.uiClick();
        this.buildLoadout();
        this.audio.uiHover();
      });
      grid.appendChild(card);
    });
    this.buildMetaSummary();
  }

  buildMetaSummary() {
    const parts = [];
    for (const def of META) {
      const lv = this.save.level(def.id);
      if (!lv) continue;
      if (def.weapon) parts.push(`${def.name.replace('VESSEL · ', '')} UNLOCKED`);
      else parts.push(`${def.name} ×${lv}`);
    }
    const sum = $('metaSummary');
    if (!parts.length) {
      sum.innerHTML = 'NO STARS LIT YET · SPEND STARDUST IN THE CONSTELLATION';
    } else {
      sum.innerHTML = 'CONSTELLATION · ' + parts.slice(0, 6).map(p => `<b>${p}</b>`).join(' · ') + (parts.length > 6 ? ' · …' : '');
    }
  }

  // ============================================================
  // meta
  // ============================================================
  buildMeta() {
    const grid = $('metaGrid');
    grid.innerHTML = '';
    for (const def of META) {
      const lv = this.save.level(def.id);
      const maxed = lv >= def.max;
      const cost = this.save.metaCost(def);
      const can = this.save.canBuy(def);
      const pips = Array.from({ length: def.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const card = document.createElement('button');
      card.className = 'meta-card' + (maxed ? ' maxed' : can ? ' buyable' : ' cant');
      card.style.setProperty('--mc', maxed ? COLORS.gold : def.color);
      card.innerHTML = `
        <div class="meta-head">
          <div class="meta-icon"><svg><use href="#${def.icon}"/></svg></div>
          <div class="meta-lv">${def.kind}<b>${maxed ? 'COMPLETE' : `LV ${lv} / ${def.max}`}</b></div>
        </div>
        <h3>${def.name}</h3>
        <p>${def.desc}</p>
        <div class="meta-buy">
          <div class="meta-cost">${maxed ? '<span class="dust-glyph">✦</span> MAX' : `<span class="dust-glyph">✦</span> ${formatScore(cost)}`}</div>
          <div class="meta-action">${maxed ? 'KINDLED' : def.weapon ? 'UNLOCK' : 'KINDLE'}</div>
        </div>
        <div class="meta-pips">${pips}</div>`;
      card.addEventListener('click', () => this.buyMeta(def, card));
      grid.appendChild(card);
    }
    $('dustAmount').textContent = formatScore(this.save.dust);
  }

  buyMeta(def, card) {
    const cost = this.save.metaCost(def);
    if (cost === null) {
      this.toast(`${def.name} IS ALREADY COMPLETE`, false, 1600);
      return;
    }
    if (!this.save.canBuy(def)) {
      this.audio.uiClick();
      this.toast(`NOT ENOUGH STARDUST · NEED ✦ ${cost}`, true, 1900);
      return;
    }
    if (this.save.buy(def)) {
      this.audio.select();
      card.classList.add('buy-flash');
      this.toast(`${def.weapon ? 'VESSEL UNLOCKED' : 'KINDLED'} · ${def.name}`, false, 2200);
      this.refreshTitle();
      setTimeout(() => this.buildMeta(), 280);
    }
  }

  // ============================================================
  // game over
  // ============================================================
  showGameOver(data) {
    this.lastRun = data;
    $('deathLine').textContent = data.line;
    const grid = $('deathStats');
    grid.innerHTML = '';
    const stats = [
      ['WAVE', String(data.wave), true],
      ['SCORE', formatScore(data.score), true],
      ['KILLS', formatScore(data.kills), false],
      ['TIME', formatTime(data.time), false],
      ['MAX COMBO', String(data.maxCombo), false],
      ['GRAZES', formatScore(data.grazes), false],
    ];
    for (const [label, value, hi] of stats) {
      const d = document.createElement('div');
      d.className = 'stat' + (hi ? ' highlight' : '');
      d.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      grid.appendChild(d);
    }
    $('dustEarned').textContent = formatScore(data.dust);
    const recap = $('buildRecap');
    recap.innerHTML = '';
    const entries = Object.entries(data.upgrades || {});
    if (entries.length) {
      entries.slice(0, 8).forEach(([id, count]) => {
        const u = UPGRADE_BY_ID[id];
        if (!u) return;
        const chip = document.createElement('span');
        chip.className = 'build-chip';
        chip.style.setProperty('--rc', RARITIES[u.rarity].color);
        chip.innerHTML = `<svg><use href="#${u.icon}"/></svg>${u.name}${count > 1 ? ` <b>×${count}</b>` : ''}`;
        recap.appendChild(chip);
      });
      if (entries.length > 8) {
        const more = document.createElement('span');
        more.className = 'build-more';
        more.textContent = `+${entries.length - 8} MORE`;
        recap.appendChild(more);
      }
    }
    $('newBest').classList.toggle('hidden', !data.isBest);
    $('runSeed').textContent = data.seed;
    $('btnAgain').disabled = false;
    this.refreshTitle();
    this.setTouchControls(false);
    this.show('gameover');
    this.animateNumber($('dustEarned'), data.dust, 700, true);
    const scoreEl = grid.querySelectorAll('strong')[1];
    if (scoreEl) this.animateNumber(scoreEl, data.score, 900);
  }

  animateNumber(el, target, ms, dust = false) {
    const start = performance.now();
    const dur = ms || 800;
    const from = 0;
    const tick = now => {
      const t = clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (target - from) * eased);
      el.textContent = dust ? formatScore(val) : formatScore(val);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ============================================================
  // sound / settings
  // ============================================================
  toggleMusic() {
    const on = !this.save.settings.music;
    this.save.setMusic(on);
    this.audio.setMusic(on);
    this.updateSoundIcons();
  }

  toggleSfx() {
    const on = !this.save.settings.sfx;
    this.save.setSfx(on);
    this.audio.setSfx(on);
    this.updateSoundIcons();
  }

  toggleShake() {
    const on = !this.save.settings.shake;
    this.save.setShake(on);
    this.updateSoundIcons();
  }

  updateSoundIcons() {
    const music = this.save.settings.music;
    const sfx = this.save.settings.sfx;
    const shake = this.save.settings.shake;
    $('btnMusicTitle').classList.toggle('off', !music);
    $('btnMusicPause').classList.toggle('off', !music);
    $('btnSfxTitle').classList.toggle('off', !sfx);
    $('btnSfxPause').classList.toggle('off', !sfx);
    $('btnShakePause').classList.toggle('off', !shake);
  }

  // ============================================================
  // events
  // ============================================================
  bind() {
    $('btnStart').addEventListener('click', () => {
      this.audio.unlock();
      this.audio.uiClick();
      this.showLoadout();
    });
    $('btnMeta').addEventListener('click', () => {
      this.audio.unlock();
      this.audio.uiClick();
      this.showMeta();
    });
    $('btnHow').addEventListener('click', () => {
      this.audio.uiClick();
      this.showHow();
    });
    $('btnHowBack').addEventListener('click', () => {
      this.audio.uiClick();
      this.showTitle();
    });
    document.querySelectorAll('[data-back="title"]').forEach(b => {
      b.addEventListener('click', () => {
        this.audio.uiClick();
        if (this.current === 'meta' || this.current === 'loadout' || this.current === 'how') {
          if (this.current === 'loadout') this.showTitle();
          else if (this.current === 'meta') this.showTitle();
          else this.showTitle();
        }
      });
    });
    $('btnDescend').addEventListener('click', () => {
      this.audio.unlock();
      this.audio.uiClick();
      const raw = $('seedInput').value.trim();
      const seed = raw ? raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12) : undefined;
      $('seedInput').blur();
      this.game.startRun(this.selectedWeapon, seed);
    });
    $('btnReroll').addEventListener('click', () => {
      this.game.reroll();
    });

    $('btnResume').addEventListener('click', () => {
      this.audio.uiClick();
      this.game.resume();
    });
    $('btnRestartPause').addEventListener('click', () => {
      this.audio.uiClick();
      this.game.restartRun();
    });
    let abandonArm = false;
    const abandon = $('btnAbandon');
    abandon.addEventListener('click', () => {
      if (!abandonArm) {
        abandonArm = true;
        abandon.textContent = 'CLICK AGAIN TO ABANDON';
        clearTimeout(this.timers.abandon);
        this.timers.abandon = setTimeout(() => {
          abandonArm = false;
          abandon.textContent = 'ABANDON RUN';
        }, 2600);
      } else {
        this.audio.uiClick();
        abandonArm = false;
        abandon.textContent = 'ABANDON RUN';
        this.game.abandonRun();
      }
    });

    $('btnAgain').addEventListener('click', () => {
      this.audio.unlock();
      this.audio.uiClick();
      this.game.startRun(this.game.weaponId);
    });
    $('btnMetaAfter').addEventListener('click', () => {
      this.audio.uiClick();
      this.showMeta();
    });
    $('btnTitleAfter').addEventListener('click', () => {
      this.audio.uiClick();
      this.showTitle();
    });
    $('btnCopySeed').addEventListener('click', async () => {
      const seed = $('runSeed').textContent;
      try {
        await navigator.clipboard.writeText(seed);
        this.toast('SEED COPIED · SHARE THE GARDEN', false, 1800);
      } catch {
        this.toast(`SEED · ${seed}`, false, 2600);
      }
    });

    $('btnMusicTitle').addEventListener('click', () => { this.audio.unlock(); this.toggleMusic(); });
    $('btnSfxTitle').addEventListener('click', () => { this.audio.unlock(); this.toggleSfx(); });
    $('btnMusicPause').addEventListener('click', () => this.toggleMusic());
    $('btnSfxPause').addEventListener('click', () => this.toggleSfx());
    $('btnShakePause').addEventListener('click', () => this.toggleShake());

    $('btnTouchDash').addEventListener('click', e => {
      e.preventDefault();
      this.game.queueDash();
    });
    $('btnTouchNova').addEventListener('click', e => {
      e.preventDefault();
      this.game.queueNova();
    });
    $('btnTouchPause').addEventListener('click', e => {
      e.preventDefault();
      this.game.pause();
    });

    document.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const hit = e.target.closest('button, a, .meta-card, .upgrade-card');
      if (hit && e.relatedTarget && hit.contains(e.relatedTarget)) return;
      document.body.classList.toggle('cursor-hover', !!hit);
      if (hit) this.audio.uiHover();
    });
    document.addEventListener('pointerout', e => {
      if (!e.relatedTarget) document.body.classList.remove('cursor-hover');
    });

    document.addEventListener('keydown', e => {
      this.audio.unlock();
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || '');
      if (inField) {
        if (this.current === 'loadout' && e.code === 'Enter') {
          e.preventDefault();
          $('btnDescend').click();
        }
        return;
      }
      if (this.current === 'title' && e.code === 'Enter') {
        this.audio.uiClick();
        this.showLoadout();
      } else if (this.current === 'loadout' && e.code === 'Enter') {
        e.preventDefault();
        $('btnDescend').click();
      } else if (this.current === 'gameover' && (e.code === 'KeyR' || e.code === 'Enter')) {
        this.audio.uiClick();
        this.game.startRun(this.game.weaponId);
      } else if ((this.current === 'meta' || this.current === 'how') && e.code === 'Escape') {
        this.audio.uiClick();
        this.showTitle();
      }
    });
  }

  // ============================================================
  // cursor
  // ============================================================
  setupCursor() {
    if (this.game.isTouch) return;
    const c = this.cursor;
    window.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch') return;
      c.x = e.clientX;
      c.y = e.clientY;
      c.dot.style.transform = `translate(${c.x}px, ${c.y}px)`;
      document.body.classList.remove('cursor-hidden');
    });
    window.addEventListener('pointerdown', () => {
      document.body.classList.remove('cursor-hidden');
    });
    document.documentElement.addEventListener('mouseleave', () => {
      document.body.classList.add('cursor-hidden');
    });
    document.documentElement.addEventListener('mouseenter', () => {
      document.body.classList.remove('cursor-hidden');
    });
    const loop = () => {
      c.rx += (c.x - c.rx) * 0.16;
      c.ry += (c.y - c.ry) * 0.16;
      c.ring.style.transform = `translate(${c.rx}px, ${c.ry}px)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
