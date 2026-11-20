// EMBERDEEP — tile definitions, world cellular automaton, generation, lighting.

import { Rng, clamp } from './util.js';

// The world is far larger than the screen: one view = VIEW_W x VIEW_H tiles.
export const TW = 400;           // world width in tiles
export const TH = 240;           // world height in tiles
export const TILE = 4;           // internal pixels per tile
export const VIEW_W = 160;       // visible tiles across
export const VIEW_H = 90;        // visible tiles down
export const VW = VIEW_W * TILE; // 640 internal px
export const VH = VIEW_H * TILE; // 360 internal px
export const WW = TW * TILE;     // world pixel width
export const WH = TH * TILE;     // world pixel height

export const T = {
  AIR: 0, STONE: 1, DIRT: 2, SAND: 3, WOOD: 4, FOLIAGE: 5, WATER: 6, LAVA: 7,
  FIRE: 8, STEAM: 9, ACID: 10, ICE: 11, METAL: 12, OIL: 13, SPORE: 14,
  CRYSTAL: 15, GLASS: 16, EMBER: 17, OBSIDIAN: 18, ROOT: 19, COUNT: 20
};

// solid: blocks movement.  liquid: passable but buoyant.  powder: falls.
const def = (o) => ({
  name: 'air', solid: false, liquid: false, powder: false, gas: false, flammable: false,
  conductive: false, atten: 12, light: null, color: [0, 0, 0], ...o
});

export const TILES = [];
TILES[T.AIR] = def({ name: 'air', atten: 3, color: [58, 50, 74] });
TILES[T.STONE] = def({ name: 'stone', solid: true, atten: 58, color: [84, 86, 100] });
TILES[T.DIRT] = def({ name: 'dirt', solid: true, atten: 24, color: [114, 82, 54] });
TILES[T.SAND] = def({ name: 'sand', powder: true, atten: 13, color: [214, 186, 124] });
TILES[T.WOOD] = def({ name: 'wood', solid: true, flammable: true, atten: 24, color: [126, 86, 54] });
TILES[T.FOLIAGE] = def({ name: 'foliage', solid: true, flammable: true, atten: 17, color: [74, 148, 92], light: { i: 24, r: 90, g: 210, b: 130 } });
TILES[T.WATER] = def({ name: 'water', liquid: true, atten: 10, color: [52, 112, 196] });
TILES[T.LAVA] = def({ name: 'lava', liquid: true, atten: 9, color: [240, 116, 30], light: { i: 228, r: 255, g: 128, b: 44 }, hot: true });
TILES[T.FIRE] = def({ name: 'fire', gas: true, atten: 15, color: [255, 172, 58], light: { i: 188, r: 255, g: 172, b: 70 } });
TILES[T.STEAM] = def({ name: 'steam', gas: true, atten: 19, color: [186, 204, 214] });
TILES[T.ACID] = def({ name: 'acid', liquid: true, atten: 10, color: [158, 222, 66], corrosive: true });
TILES[T.ICE] = def({ name: 'ice', solid: true, atten: 12, color: [158, 210, 236] });
TILES[T.METAL] = def({ name: 'metal', solid: true, conductive: true, atten: 58, color: [148, 158, 172] });
TILES[T.OIL] = def({ name: 'oil', liquid: true, atten: 10, color: [62, 50, 74], flammable: true });
TILES[T.SPORE] = def({ name: 'spore', solid: true, flammable: true, atten: 16, color: [112, 186, 126], light: { i: 44, r: 110, g: 255, b: 170 } });
TILES[T.CRYSTAL] = def({ name: 'crystal', solid: true, atten: 58, color: [112, 214, 238], light: { i: 205, r: 130, g: 225, b: 255 } });
TILES[T.GLASS] = def({ name: 'glass', solid: true, atten: 6, color: [162, 200, 210] });
TILES[T.EMBER] = def({ name: 'ember', gas: true, atten: 10, color: [255, 196, 104], light: { i: 132, r: 255, g: 200, b: 120 } });
TILES[T.OBSIDIAN] = def({ name: 'obsidian', solid: true, atten: 58, color: [46, 40, 62] });
TILES[T.ROOT] = def({ name: 'root', solid: true, flammable: true, atten: 20, color: [96, 68, 46], light: { i: 18, r: 120, g: 220, b: 150 } });

export const SOLID = new Uint8Array(T.COUNT);
export const ATTEN = new Uint16Array(T.COUNT);
export const FLAMMABLE = new Uint8Array(T.COUNT);
export const LIQUID = new Uint8Array(T.COUNT);
export const CONDUCT = new Uint8Array(T.COUNT);
export const POWDER = new Uint8Array(T.COUNT);
for (let i = 0; i < T.COUNT; i++) {
  const d = TILES[i];
  SOLID[i] = d.solid ? 1 : 0;
  ATTEN[i] = d.atten;
  FLAMMABLE[i] = d.flammable ? 1 : 0;
  LIQUID[i] = d.liquid ? 1 : 0;
  CONDUCT[i] = d.conductive ? 1 : 0;
  POWDER[i] = d.powder ? 1 : 0;
}

// Which element pool a tile feeds when siphoned.
export const SIPHON = new Int8Array(T.COUNT).fill(-1);
SIPHON[T.LAVA] = 0; SIPHON[T.FIRE] = 0; SIPHON[T.EMBER] = 0;
SIPHON[T.WATER] = 1; SIPHON[T.ICE] = 1;
SIPHON[T.METAL] = 2;
SIPHON[T.SPORE] = 3; SIPHON[T.FOLIAGE] = 3; SIPHON[T.ROOT] = 3;
// Neutral matter feeds whatever body you currently wear.
export const NEUTRAL = new Uint8Array(T.COUNT);
NEUTRAL[T.STONE] = 1; NEUTRAL[T.DIRT] = 1; NEUTRAL[T.SAND] = 1; NEUTRAL[T.WOOD] = 1;

export const BIOMES = [
  {
    name: 'THE ASHFALL TERRACES', sub: 'where the sky forgot to end',
    rock: T.STONE, soil: T.DIRT, pockets: [T.SAND],
    water: 0.07, lava: 0.05, acid: 0.00, oil: 0.03, crystal: 0.02, spore: 0.05,
    enemies: ['crawler', 'drifter', 'sporepod'], sky: [0.085, 0.085, 0.125], music: 55
  },
  {
    name: 'THE VERDIGRIS', sub: 'a drowned garden of green fire',
    rock: T.STONE, soil: T.DIRT, pockets: [T.SAND, T.ROOT],
    water: 0.16, lava: 0.03, acid: 0.04, oil: 0.03, crystal: 0.02, spore: 0.18,
    enemies: ['crawler', 'drifter', 'wraith', 'sporepod'], sky: [0.06, 0.105, 0.105], music: 49
  },
  {
    name: 'CINDER REACH', sub: 'the furnaces never went out',
    rock: T.STONE, soil: T.DIRT, pockets: [T.METAL, T.SAND],
    water: 0.05, lava: 0.14, acid: 0.03, oil: 0.06, crystal: 0.02, spore: 0.04,
    enemies: ['crawler', 'brute', 'drifter'], sky: [0.13, 0.075, 0.055], music: 41
  },
  {
    name: 'THE HOLLOW DEEP', sub: 'the place the light gave up',
    rock: T.OBSIDIAN, soil: T.DIRT, pockets: [T.CRYSTAL, T.METAL],
    water: 0.06, lava: 0.09, acid: 0.07, oil: 0.04, crystal: 0.10, spore: 0.05,
    enemies: ['crawler', 'brute', 'wraith', 'sporepod', 'drifter'], sky: [0.07, 0.055, 0.12], music: 36
  }
];

export class World {
  constructor(seed) {
    this.W = TW; this.H = TH;
    this.tiles = new Uint8Array(TW * TH);
    this.life = new Uint8Array(TW * TH);
    this.charge = new Uint8Array(TW * TH);
    this.lightI = new Uint8Array(VIEW_W * VIEW_H);
    this.lightC = new Uint8Array(VIEW_W * VIEW_H * 3);
    this.sources = [];
    this.tick = 0;
    this.seed = seed >>> 0;
    this.rng = new Rng(seed);
    this.mut = { fireSpread: 1, chain: false, freeze: false, slowAura: 0, growth: 1 };
    this._buckets = [];
    for (let i = 0; i < 256; i++) this._buckets.push([]);
    this.heart = { x: TW >> 1, y: TH >> 1, alive: true };
    this.spawn = { x: TW >> 1, y: 8 };
    this.sim = { x0: 0, y0: 0, x1: TW, y1: TH };
    this.explored = new Uint8Array(TW * TH);
  }

  idx(x, y) { return y * TW + x; }
  at(x, y) {
    if (x < 0 || y < 0 || x >= TW || y >= TH) return T.STONE;
    return this.tiles[y * TW + x];
  }
  set(x, y, v) {
    if (x < 0 || y < 0 || x >= TW || y >= TH) return;
    const i = y * TW + x;
    this.tiles[i] = v;
    this.life[i] = 0;
  }
  isSolid(x, y) { return SOLID[this.at(x, y)] === 1; }
  isAir(x, y) { return this.at(x, y) === T.AIR; }

  // pixel-space helpers -------------------------------------------------
  tileAtPx(px, py) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    if (x < 0 || y < 0 || x >= TW || y >= TH) return T.STONE;
    return this.tiles[y * TW + x];
  }
  solidAtPx(px, py) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    if (x < 0 || y < 0 || x >= TW || y >= TH) return true;
    return SOLID[this.tiles[y * TW + x]] === 1;
  }
  setPx(px, py, v) {
    const x = Math.floor(px / TILE), y = Math.floor(py / TILE);
    if (x < 0 || y < 0 || x >= TW || y >= TH) return;
    this.tiles[y * TW + x] = v;
  }

  // ---------------------------------------------------------------- generation
  generate(stratum) {
    const r = this.rng;
    const b = BIOMES[Math.min(BIOMES.length - 1, Math.floor((stratum - 1) / 3))];
    this.biome = b;
    this.tiles.fill(b.rock);
    this.life.fill(0);
    this.charge.fill(0);
    this.explored.fill(0);
    this.shards = [];

    // --- carve cave networks with wandering agents
    const agents = 34 + Math.floor(stratum * 1.5);
    for (let a = 0; a < agents; a++) {
      let x = r.int(4, TW - 5), y = r.int(4, TH - 5);
      let vx = 0, vy = 0;
      const steps = r.int(160, 420);
      for (let s = 0; s < steps; s++) {
        vx += r.range(-1, 1); vy += r.range(-1, 1);
        const m = Math.hypot(vx, vy) || 1;
        vx = (vx / m) * 1.7; vy = (vy / m) * 1.7;
        x = clamp(x + vx, 2, TW - 3); y = clamp(y + vy, 2, TH - 3);
        const rad = r.range(1.5, 4.6);
        const ri = Math.ceil(rad);
        for (let oy = -ri; oy <= ri; oy++) for (let ox = -ri; ox <= ri; ox++) {
          if (ox * ox + oy * oy > rad * rad) continue;
          const px = x + ox, py = y + oy;
          if (px < 1 || py < 1 || px >= TW - 1 || py >= TH - 1) continue;
          this.tiles[py * TW + px] = T.AIR;
        }
      }
    }

    // --- winding galleries (makes navigation readable)
    const galleries = 22 + Math.floor(stratum / 2);
    for (let g = 0; g < galleries; g++) {
      let gx = r.int(2, TW - 3), gy = r.int(4, TH - 6);
      const len = r.int(60, TW - 30);
      let ph = r.range(0, 6.28);
      const dir = r.chance(0.5) ? 1 : -1;
      for (let i = 0; i < len; i++) {
        ph += r.range(-0.28, 0.28);
        gx += dir;
        if (gx < 3 || gx > TW - 4) break;
        const yy = clamp(Math.round(gy + Math.sin(ph) * 4), 2, TH - 3);
        const thick = r.int(1, 3);
        for (let t = -thick; t <= thick; t++) {
          const py = clamp(yy + t, 1, TH - 2);
          this.tiles[py * TW + gx] = T.AIR;
        }
      }
    }

    // --- soil skins: dirt above cave ceilings, sand in the mix
    const src = this.tiles.slice();
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const i = y * TW + x;
      if (src[i] !== T.AIR) continue;
      const up = y > 0 ? src[i - TW] : T.STONE;
      if (SOLID[up] && (up === T.STONE || up === T.OBSIDIAN)) {
        if (r.chance(0.5)) this.tiles[i] = b.soil;
        else if (r.chance(0.14)) this.tiles[i] = T.SAND;
      }
      const dn = y < TH - 1 ? src[i + TW] : T.STONE;
      if (SOLID[dn] && r.chance(0.10)) this.tiles[i] = b.soil;
    }

    // --- how much open cave is there? density of materials follows from it
    let caveArea = 0;
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] === T.AIR) caveArea++;

    const pocket = (type, density, rad) => {
      const count = Math.max(1, Math.round(caveArea * density / (Math.PI * rad * rad)));
      for (let n = 0; n < count; n++) {
        const cx = r.int(4, TW - 5), cy = r.int(4, TH - 5);
        const rr = r.range(rad * 0.6, rad);
        const ri = Math.ceil(rr);
        for (let oy = -ri; oy <= ri; oy++) for (let ox = -ri; ox <= ri; ox++) {
          if (ox * ox + oy * oy > rr * rr) continue;
          const px = cx + ox, py = cy + oy;
          if (px < 1 || py < 1 || px >= TW - 1 || py >= TH - 1) continue;
          this.tiles[py * TW + px] = type;
        }
      }
    };
    pocket(T.WATER, b.water, 6);
    pocket(T.LAVA, b.lava, 5);
    pocket(T.ACID, b.acid, 4);
    pocket(T.OIL, b.oil, 4);
    pocket(T.CRYSTAL, b.crystal, 3);
    pocket(T.SPORE, b.spore, 5);
    pocket(T.METAL, 0.012, 4);
    pocket(T.WOOD, 0.010, 4);
    pocket(T.FOLIAGE, 0.016, 4);
    pocket(T.ROOT, 0.012, 4);

    // let liquids settle before anything is placed, so pools stop flowing
    this.settle(26);

    // --- find a spawn in the upper-left region
    let best = null;
    for (let tries = 0; tries < 9000; tries++) {
      const x = r.int(Math.floor(TW * 0.22), Math.floor(TW * 0.78)), y = r.int(Math.floor(TH * 0.24), Math.floor(TH * 0.72));
      if (this.openArea(x, y, 2) && this.clearOf(x, y, 5, [T.LAVA, T.FIRE, T.ACID])) { best = { x, y }; break; }
    }
    if (!best) {
      for (let tries = 0; tries < 9000; tries++) {
        const x = r.int(Math.floor(TW * 0.22), Math.floor(TW * 0.78)), y = r.int(Math.floor(TH * 0.24), Math.floor(TH * 0.72));
        if (this.openArea(x, y, 2)) { best = { x, y }; break; }
      }
    }
    if (!best) best = { x: 24, y: 24 };
    this.spawn = best;
    this.clearArea(best.x, best.y, 5);

    // --- the Heart lies deep, in the far reaches of the stratum
    let heart = null, bestScore = -1e9;
    for (let tries = 0; tries < 6000; tries++) {
      const x = r.int(Math.floor(TW * 0.3), TW - 9), y = r.int(Math.floor(TH * 0.3), TH - 9);
      if (!this.openArea(x, y, 2)) continue;
      const s = (x - this.spawn.x) * 0.6 + (y - this.spawn.y);
      if (s > bestScore) { bestScore = s; heart = { x, y }; }
    }
    if (!heart) heart = { x: TW - 40, y: TH - 40 };
    this.heart = { x: heart.x, y: heart.y, alive: true };

    // --- guarantee reachability: flood from spawn, if heart unreachable carve a tunnel
    if (!this.reachable(this.spawn.x, this.spawn.y, this.heart.x, this.heart.y)) {
      this.carvePath(this.spawn.x, this.spawn.y, this.heart.x, this.heart.y);
    }
    // heart chamber
    for (let oy = -2; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
      const px = heart.x + ox, py = heart.y + oy;
      if (px > 1 && py > 1 && px < TW - 2 && py < TH - 2) this.tiles[py * TW + px] = T.AIR;
    }
    this.clearArea(heart.x, heart.y, 4);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      this.set(heart.x + Math.round(Math.cos(a) * 2), heart.y + Math.round(Math.sin(a) * 2), T.CRYSTAL);
    }
    this.set(heart.x, heart.y, T.CRYSTAL);

    // --- scattered crystal shards (light + score)
    for (let n = 0; n < 150; n++) {
      const x = r.int(2, TW - 3), y = r.int(2, TH - 3);
      if (this.at(x, y) !== T.AIR) continue;
      this.shards.push({ x, y, taken: false });
      this.set(x, y, T.CRYSTAL);
    }

    this.settle(16);
    // final safety: the spawn chamber must be dry and safe
    this.clearArea(this.spawn.x, this.spawn.y, 5);
    this.clearArea(this.heart.x, this.heart.y, 3);
    return b;
  }

  clearOf(x, y, rad, types) {
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      if (types.includes(this.at(x + ox, y + oy))) return false;
    }
    return true;
  }

  // Wipe a region to air (used to make safe chambers).
  clearArea(x, y, rad) {
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      const px = x + ox, py = y + oy;
      if (px < 1 || py < 1 || px >= TW - 1 || py >= TH - 1) continue;
      this.tiles[py * TW + px] = T.AIR;
      this.life[py * TW + px] = 0;
    }
  }

  openArea(x, y, rad) {
    for (let oy = -rad; oy <= rad; oy++) for (let ox = -rad; ox <= rad; ox++) {
      const t = this.at(x + ox, y + oy);
      if (t !== T.AIR && !LIQUID[t]) return false;
    }
    return true;
  }

  reachable(sx, sy, tx, ty) {
    const seen = new Uint8Array(TW * TH);
    const q = new Int32Array(TW * TH);
    let head = 0, tail = 0;
    q[tail++] = sy * TW + sx; seen[sy * TW + sx] = 1;
    while (head < tail) {
      const i = q[head++]; const x = i % TW, y = (i / TW) | 0;
      if (x === tx && y === ty) return true;
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= TW || ny >= TH) continue;
        const ni = ny * TW + nx;
        if (seen[ni]) continue;
        const t = this.tiles[ni];
        if (SOLID[t] && t !== T.WOOD && t !== T.FOLIAGE && t !== T.SPORE && t !== T.ROOT) continue;
        seen[ni] = 1; q[tail++] = ni;
      }
    }
    return false;
  }

  carvePath(sx, sy, tx, ty) {
    const prev = new Int32Array(TW * TH).fill(-1);
    const q = new Int32Array(TW * TH);
    let head = 0, tail = 0;
    const s = sy * TW + sx; q[tail++] = s; prev[s] = s;
    let found = false;
    while (head < tail) {
      const i = q[head++]; const x = i % TW, y = (i / TW) | 0;
      if (x === tx && y === ty) { found = true; break; }
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
      for (const [nx, ny] of nb) {
        if (nx < 1 || ny < 1 || nx >= TW - 1 || ny >= TH - 1) continue;
        const ni = ny * TW + nx;
        if (prev[ni] !== -1) continue;
        prev[ni] = i; q[tail++] = ni;
      }
    }
    const target = ty * TW + tx;
    if (!found || prev[target] === -1) {
      const steps = Math.max(Math.abs(tx - sx), Math.abs(ty - sy));
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(sx + (tx - sx) * k / steps), y = Math.round(sy + (ty - sy) * k / steps);
        this.tiles[y * TW + x] = T.AIR;
        if (y > 0) this.tiles[(y - 1) * TW + x] = T.AIR;
      }
      return;
    }
    let cur = target;
    while (cur !== s) {
      const x = cur % TW, y = (cur / TW) | 0;
      this.tiles[cur] = T.AIR;
      if (y > 0) this.tiles[cur - TW] = T.AIR;
      cur = prev[cur];
    }
  }

  // Run the sim for n ticks so liquids settle before play begins.
  settle(n) {
    const s = this.sim;
    s.x0 = 0; s.y0 = 0; s.x1 = TW; s.y1 = TH;
    for (let i = 0; i < n; i++) this.step();
  }

  // Restrict live simulation to a window around the camera.
  setSimWindow(x0, y0, x1, y1) {
    this.sim.x0 = clamp(x0, 0, TW - 1); this.sim.y0 = clamp(y0, 0, TH - 1);
    this.sim.x1 = clamp(x1, 1, TW); this.sim.y1 = clamp(y1, 1, TH);
  }

  // ---------------------------------------------------------------- simulation
  step() {
    const t = this.tiles, life = this.life, r = this.rng;
    const W = TW;
    this.tick++;
    const order = this.tick & 1;
    const sim = this.sim;
    const yStart = Math.min(TH - 2, sim.y1 - 1), yEnd = Math.max(0, sim.y0);
    for (let y = yStart; y >= yEnd; y--) {
      const rowOff = y * W;
      const flip = ((y + order) & 1) === 0;
      const xFrom = flip ? Math.max(0, sim.x0) : Math.min(W - 1, sim.x1 - 1);
      const xTo = flip ? Math.min(W, sim.x1) : Math.max(-1, sim.x0 - 1);
      const xStep = flip ? 1 : -1;
      for (let x = xFrom; x !== xTo; x += xStep) {
        const i = rowOff + x;
        const v = t[i];
        if (v === T.AIR || v === T.STONE || v === T.METAL || v === T.CRYSTAL || v === T.OBSIDIAN || v === T.GLASS || v === T.WOOD || v === T.DIRT || v === T.ROOT) {
          if (v === T.FOLIAGE || v === T.SPORE) this.grow(i, x, y);
          continue;
        }
        switch (v) {
          case T.SAND: this.stepSand(i, x, y); break;
          case T.WATER: this.stepWater(i, x, y); break;
          case T.LAVA: this.stepLava(i, x, y); break;
          case T.FIRE: this.stepFire(i, x, y); break;
          case T.STEAM: this.stepSteam(i, x, y); break;
          case T.ACID: this.stepAcid(i, x, y); break;
          case T.ICE: this.stepIce(i, x, y); break;
          case T.OIL: this.stepOil(i, x, y); break;
          case T.EMBER: this.stepEmber(i, x, y); break;
          case T.FOLIAGE: this.grow(i, x, y); break;
          case T.SPORE: this.grow(i, x, y); break;
        }
      }
    }
    // electricity decays
    if (this.tick % 6 === 0) {
      const ch = this.charge;
      for (let i = 0; i < ch.length; i++) if (ch[i]) ch[i]--;
    }
  }

  swap(a, b) {
    const t = this.tiles;
    const ta = t[a]; t[a] = t[b]; t[b] = ta;
    const la = this.life[a]; this.life[a] = this.life[b]; this.life[b] = la;
  }

  stepSand(i, x, y) {
    const t = this.tiles;
    const below = i + TW;
    const bt = t[below];
    if (bt === T.AIR || bt === T.WATER || bt === T.ACID || bt === T.OIL) { this.swap(i, below); return; }
    if (bt === T.LAVA) { t[i] = T.GLASS; return; }
    if (this.rng.chance(0.6)) {
      const dir = this.rng.chance(0.5) ? -1 : 1;
      const d = below + dir;
      if (d >= 0 && d < t.length && t[d] === T.AIR) { this.swap(i, d); return; }
      const d2 = i + dir;
      if (d2 >= 0 && d2 < t.length && t[d2] === T.AIR) { this.swap(i, d2); }
    }
  }

  stepWater(i, x, y) {
    const t = this.tiles;
    if (this.tiles[i - TW] === T.LAVA || this.tiles[i + TW] === T.LAVA || this.tiles[i - 1] === T.LAVA || this.tiles[i + 1] === T.LAVA) {
      t[i] = T.STEAM; this.life[i] = 40 + this.rng.int(30); return;
    }
    if (this.tiles[i - TW] === T.FIRE || this.tiles[i + TW] === T.FIRE || this.tiles[i - 1] === T.FIRE || this.tiles[i + 1] === T.FIRE) {
      t[i] = T.STEAM; this.life[i] = 30 + this.rng.int(20); return;
    }
    const below = i + TW;
    if (t[below] === T.AIR) { this.swap(i, below); return; }
    if (t[below] === T.WATER) {
      if (this.rng.chance(0.55)) {
        const dir = this.rng.chance(0.5) ? -1 : 1;
        const s = i + dir;
        if (t[s] === T.AIR && this.canFlow(i, s)) { this.swap(i, s); }
      }
    } else if (t[below] === T.OIL) { this.swap(i, below); return; }
    else {
      if (this.rng.chance(0.35)) {
        const dir = this.rng.chance(0.5) ? -1 : 1;
        const s = i + dir;
        if (t[s] === T.AIR && this.canFlow(i, s)) { this.swap(i, s); }
      }
    }
  }

  canFlow(from, to) {
    const t = this.tiles;
    const belowTo = to + TW;
    if (belowTo >= t.length) return false;
    const bt = t[belowTo];
    return bt !== T.AIR && !LIQUID[bt];
  }

  stepLava(i, x, y) {
    const t = this.tiles;
    if (this.rng.chance(0.35)) {
      for (const o of [-TW, TW, -1, 1]) {
        const j = i + o;
        if (j < 0 || j >= t.length) continue;
        if (t[j] === T.WATER) { t[j] = T.STEAM; this.life[j] = 40; t[i] = T.OBSIDIAN; return; }
        if (t[j] === T.ICE) { t[j] = T.WATER; return; }
      }
    }
    for (const o of [-TW, TW, -1, 1]) {
      const j = i + o;
      if (j < 0 || j >= t.length) continue;
      const tj = t[j];
      if (FLAMMABLE[tj]) { t[j] = T.FIRE; this.life[j] = 40 + this.rng.int(50); }
    }
    if (!this.rng.chance(0.18)) return;
    const below = i + TW;
    if (t[below] === T.AIR) { this.swap(i, below); return; }
    if (t[below] === T.WATER) { t[below] = T.STEAM; this.life[below] = 40; t[i] = T.OBSIDIAN; return; }
    const dir = this.rng.chance(0.5) ? -1 : 1;
    const s = i + dir;
    if (t[s] === T.AIR && this.canFlow(i, s)) this.swap(i, s);
  }

  stepFire(i, x, y) {
    const t = this.tiles;
    if (this.life[i] === 0) { t[i] = T.STEAM; this.life[i] = 60; return; }
    if (this.life[i] > 0) this.life[i]--;
    for (const o of [-TW, TW, -1, 1]) {
      const j = i + o;
      if (j < 0 || j >= t.length) continue;
      if (t[j] === T.WATER || t[j] === T.STEAM || t[j] === T.ICE) { t[i] = T.STEAM; this.life[i] = 30; return; }
    }
    const spread = this.mut.fireSpread;
    for (const o of [-TW, TW, -1, 1]) {
      const j = i + o;
      if (j < 0 || j >= t.length) continue;
      const tj = t[j];
      if (FLAMMABLE[tj] && this.rng.chance(0.05 * spread)) { t[j] = T.FIRE; this.life[j] = 40 + this.rng.int(60); }
      if (tj === T.OIL && this.rng.chance(0.16 * spread)) { t[j] = T.FIRE; this.life[j] = 70 + this.rng.int(50); }
      if (tj === T.LAVA && this.rng.chance(0.02)) { t[j] = T.FIRE; this.life[j] = 30; }
    }
    const up = i - TW;
    if (t[up] === T.AIR && this.rng.chance(0.12)) { this.swap(i, up); }
  }

  stepSteam(i, x, y) {
    const t = this.tiles;
    if (this.life[i] > 0) this.life[i]--;
    for (const o of [-TW, TW, -1, 1]) {
      const j = i + o;
      if (j < 0 || j >= t.length) continue;
      if (t[j] === T.ICE) { t[i] = T.WATER; return; }
    }
    const up = i - TW;
    if (up >= 0 && t[up] === T.AIR && this.rng.chance(0.35)) { this.swap(i, up); return; }
    if (this.life[i] === 0) { t[i] = T.WATER; }
  }

  stepAcid(i, x, y) {
    const t = this.tiles;
    for (const o of [-TW, TW, -1, 1]) {
      const j = i + o;
      if (j < 0 || j >= t.length) continue;
      const tj = t[j];
      if (tj === T.FIRE || tj === T.LAVA) { t[i] = T.STEAM; this.life[i] = 20; return; }
      if (SOLID[tj] && tj !== T.METAL && this.rng.chance(0.035)) {
        if (tj === T.ICE) t[j] = T.WATER; else if (tj !== T.OBSIDIAN) t[j] = T.AIR;
      }
    }
    const below = i + TW;
    if (t[below] === T.AIR) { this.swap(i, below); return; }
    if (this.rng.chance(0.4)) {
      const dir = this.rng.chance(0.5) ? -1 : 1;
      const s = i + dir;
      if (t[s] === T.AIR && this.canFlow(i, s)) this.swap(i, s);
    }
  }

  stepIce(i, x, y) {
    const t = this.tiles;
    for (const o of [-TW, TW, -1, 1]) {
      const j = i + o;
      if (j < 0 || j >= t.length) continue;
      if (t[j] === T.FIRE || t[j] === T.LAVA) { t[i] = T.WATER; return; }
    }
    if (this.rng.chance(0.0008)) t[i] = T.WATER;
  }

  stepOil(i, x, y) {
    const t = this.tiles;
    const below = i + TW;
    if (t[below] === T.WATER) { this.swap(i, below); return; }
    if (t[below] === T.AIR && this.rng.chance(0.5)) { this.swap(i, below); return; }
    if (this.rng.chance(0.25)) {
      const dir = this.rng.chance(0.5) ? -1 : 1;
      const s = i + dir;
      if (t[s] === T.AIR && this.canFlow(i, s)) this.swap(i, s);
    }
  }

  stepEmber(i, x, y) {
    const t = this.tiles;
    if (this.life[i] > 0) this.life[i]--;
    else { t[i] = T.AIR; return; }
    const up = i - TW;
    if (up >= 0 && t[up] === T.AIR && this.rng.chance(0.25)) { this.swap(i, up); return; }
    if (this.rng.chance(0.06)) { t[i] = T.AIR; }
  }

  grow(i, x, y) {
    const t = this.tiles;
    const v = t[i];
    if (v === T.FOLIAGE) {
      if (this.rng.chance(0.0016 * this.mut.growth)) {
        const d = i + TW;
        if (t[d] === T.AIR) t[d] = T.FOLIAGE;
      }
    } else if (v === T.SPORE) {
      if (this.rng.chance(0.006 * this.mut.growth)) {
        const dirs = [-TW, TW, -1, 1];
        const o = dirs[this.rng.int(0, 3)];
        const j = i + o;
        if (j >= 0 && j < t.length && t[j] === T.AIR) t[j] = T.SPORE;
      }
    }
  }

  // ---------------------------------------------------------------- lighting
  addSource(x, y, i, r, g, b) {
    this.sources.push({ x, y, i, r, g, b });
  }

  // Flood-fill light across the view window only (ox,oy = window origin in tiles).
  computeLight(ox, oy) {
    const I = this.lightI, C = this.lightC, t = this.tiles, buckets = this._buckets;
    this.lightOx = ox; this.lightOy = oy;
    I.fill(0);
    C.fill(0);
    for (let b = 0; b < 256; b++) buckets[b].length = 0;
    const VWt = VIEW_W;
    const inWin = (x, y) => x >= ox && y >= oy && x < ox + VIEW_W && y < oy + VIEW_H;

    // tile-based sources
    for (let y = oy; y < oy + VIEW_H; y++) {
      const row = y * TW;
      const ly = y - oy;
      for (let x = ox; x < ox + VIEW_W; x++) {
        const v = t[row + x];
        if (v === T.AIR) continue;
        const L = TILES[v].light;
        if (!L) continue;
        const i = ly * VWt + (x - ox);
        if (L.i > I[i]) { I[i] = L.i; C[i * 3] = L.r; C[i * 3 + 1] = L.g; C[i * 3 + 2] = L.b; buckets[L.i].push(i); }
      }
    }
    // dynamic sources (entities, projectiles)
    for (const s of this.sources) {
      if (!inWin(s.x, s.y)) continue;
      const si = s.i | 0;
      if (!(si > 0) || si > 255) continue;
      const i = (s.y - oy) * VWt + (s.x - ox);
      if (si > I[i]) { I[i] = si; C[i * 3] = s.r; C[i * 3 + 1] = s.g; C[i * 3 + 2] = s.b; buckets[si].push(i); }
    }

    for (let lv = 255; lv > 0; lv--) {
      const b = buckets[lv];
      for (let k = 0; k < b.length; k++) {
        const i = b[k];
        if (I[i] !== lv) continue;
        const lx = i % VWt, ly = (i / VWt) | 0;
        const wx = ox + lx, wy = oy + ly;
        const cr = C[i * 3], cg = C[i * 3 + 1], cb = C[i * 3 + 2];
        for (let d = 0; d < 4; d++) {
          const nx = wx + (d === 0 ? 1 : d === 1 ? -1 : 0);
          const ny = wy + (d === 2 ? 1 : d === 3 ? -1 : 0);
          if (nx < ox || ny < oy || nx >= ox + VIEW_W || ny >= oy + VIEW_H) continue;
          const j = (ny - oy) * VWt + (nx - ox);
          const cost = ATTEN[t[ny * TW + nx]];
          if (cost >= 60) continue;
          const v = lv - cost;
          if (v > I[j]) {
            I[j] = v; C[j * 3] = cr; C[j * 3 + 1] = cg; C[j * 3 + 2] = cb;
            buckets[v].push(j);
          }
        }
      }
    }
  }

  lightAt(x, y) {
    const lx = x - this.lightOx, ly = y - this.lightOy;
    if (lx < 0 || ly < 0 || lx >= VIEW_W || ly >= VIEW_H) return 0;
    return this.lightI[ly * VIEW_W + lx];
  }
}

// ------------------------------------------------------------------ tile art
let spriteCache = null;
export function tileSprites() {
  if (spriteCache) return spriteCache;
  spriteCache = [];
  for (let v = 0; v < T.COUNT; v++) {
    const base = TILES[v].color;
    const block = new Uint32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        let r = base[0], g = base[1], b = base[2];
        if (v === T.AIR) {
          const n = hashNoise(v + 7, x, y);
          const d = (n - 0.5) * 12;
          r = clamp(r + d, 0, 255); g = clamp(g + d, 0, 255); b = clamp(b + d, 0, 255);
        }
        else {
          const n = hashNoise(v, x, y);
          const d = (n - 0.5) * 34;
          r = clamp(r + d, 0, 255); g = clamp(g + d, 0, 255); b = clamp(b + d * 1.1, 0, 255);
          if (v === T.LAVA) {
            const n2 = hashNoise(v + 91, x, y);
            r = clamp(r + n2 * 70, 0, 255); g = clamp(g + n2 * 30, 0, 255);
          }
          if (v === T.WATER) {
            const n2 = hashNoise(v + 33, x, y);
            b = clamp(b + n2 * 24, 0, 255);
          }
          if (v === T.CRYSTAL) {
            const n2 = hashNoise(v + 17, x, y);
            r = clamp(r + n2 * 40, 0, 255); g = clamp(g + n2 * 40, 0, 255);
          }
          if (v === T.OBSIDIAN) {
            const n2 = hashNoise(v + 71, x, y);
            r = clamp(r + n2 * 26, 0, 255); b = clamp(b + n2 * 34, 0, 255);
          }
        }
        block[y * TILE + x] = 0xff000000 | (b << 16) | (g << 8) | r;
      }
    }
    spriteCache.push(block);
  }
  return spriteCache;
}

function hashNoise(v, x, y) {
  let h = Math.imul(v + 1, 2654435761) ^ Math.imul(x + 7, 40503) ^ Math.imul(y + 13, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
