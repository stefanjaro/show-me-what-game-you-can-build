/* POLARIS — util */

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const sign = v => (v < 0 ? -1 : 1);

export function rand(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  return a + Math.random() * (b - a);
}
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[(Math.random() * arr.length) | 0];
export const chance = p => Math.random() < p;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/* weighted pick: items = [{w, ...}] */
export function weightedPick(items, wKey = 'w') {
  let total = 0;
  for (const it of items) total += it[wKey] || 0;
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= it[wKey] || 0;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

export const approach = (cur, target, rate) =>
  cur < target ? Math.min(cur + rate, target) : Math.max(cur - rate, target);

export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
export const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function mixHex(h1, h2, t) {
  const a = hexToRgb(h1), b = hexToRgb(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

/* simple object pool with swap-remove */
export class Pool {
  constructor() { this.items = []; }
  add(item) { this.items.push(item); return item; }
  removeAt(i) {
    const it = this.items[i];
    const last = this.items.length - 1;
    this.items[i] = this.items[last];
    this.items[last] = it;
    this.items.pop();
    return it;
  }
  clear() { this.items.length = 0; }
  get length() { return this.items.length; }
}

export const now = () => performance.now() / 1000;
