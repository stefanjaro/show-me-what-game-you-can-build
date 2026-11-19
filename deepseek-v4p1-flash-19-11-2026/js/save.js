import { loadSafe, saveSafe } from './util.js';
import { META } from './data.js';

const KEY = 'lumenfall_save_v1';

const DEFAULT_SAVE = {
  v: 1,
  dust: 25,
  bestScore: 0,
  bestWave: 0,
  bestCombo: 0,
  totalRuns: 0,
  totalKills: 0,
  totalTime: 0,
  meta: {},
  settings: { music: true, sfx: true, shake: true },
  runs: [],
  lastSeed: '',
};

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object') return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(extra)) {
    if (extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k]) && base[k]) {
      out[k] = deepMerge(base[k], extra[k]);
    } else if (extra[k] !== undefined) {
      out[k] = extra[k];
    }
  }
  return out;
}

export class Save {
  constructor() {
    this.data = deepMerge(DEFAULT_SAVE, loadSafe(KEY) || {});
    if (!this.data.meta) this.data.meta = {};
    this.data.runs = Array.isArray(this.data.runs) ? this.data.runs.slice(-12) : [];
  }

  write() { saveSafe(KEY, this.data); }

  get dust() { return this.data.dust; }
  get meta() { return this.data.meta; }
  get settings() { return this.data.settings; }

  level(id) { return this.data.meta[id] || 0; }
  isUnlocked(weaponId) {
    if (weaponId === 'pulsar') return true;
    return this.level('w_' + weaponId) > 0;
  }

  addDust(n) {
    this.data.dust += Math.max(0, Math.floor(n));
    this.write();
  }

  applyMeta(stats) {
    for (const def of META) {
      const lv = this.level(def.id);
      if (lv > 0 && def.apply) {
        for (let i = 0; i < lv; i++) def.apply(stats);
      }
    }
    return stats;
  }

  metaCost(def) {
    const lv = this.level(def.id);
    if (lv >= def.max) return null;
    return def.costs[Math.min(lv, def.costs.length - 1)];
  }

  canBuy(def) {
    const cost = this.metaCost(def);
    return cost !== null && this.data.dust >= cost;
  }

  buy(def) {
    const cost = this.metaCost(def);
    if (cost === null || this.data.dust < cost) return false;
    this.data.dust -= cost;
    this.data.meta[def.id] = this.level(def.id) + 1;
    this.write();
    return true;
  }

  recordRun(run) {
    const d = this.data;
    const isBest = run.score > d.bestScore;
    d.bestScore = Math.max(d.bestScore, Math.floor(run.score));
    d.bestWave = Math.max(d.bestWave, run.wave);
    d.bestCombo = Math.max(d.bestCombo, run.maxCombo || 0);
    d.totalRuns += 1;
    d.totalKills += run.kills || 0;
    d.totalTime += run.time || 0;
    d.dust += Math.max(0, Math.floor(run.dust || 0));
    d.lastSeed = run.seed || '';
    d.runs.push({
      seed: run.seed,
      score: Math.floor(run.score),
      wave: run.wave,
      kills: run.kills,
      time: Math.floor(run.time),
      weapon: run.weapon,
      date: Date.now(),
    });
    if (d.runs.length > 12) d.runs = d.runs.slice(-12);
    this.write();
    return isBest;
  }

  toggleMusic() {
    this.data.settings.music = !this.data.settings.music;
    this.write();
    return this.data.settings.music;
  }
  toggleSfx() {
    this.data.settings.sfx = !this.data.settings.sfx;
    this.write();
    return this.data.settings.sfx;
  }
  toggleShake() {
    this.data.settings.shake = !this.data.settings.shake;
    this.write();
    return this.data.settings.shake;
  }
  setMusic(on) { this.data.settings.music = !!on; this.write(); }
  setSfx(on) { this.data.settings.sfx = !!on; this.write(); }
  setShake(on) { this.data.settings.shake = !!on; this.write(); }
}

