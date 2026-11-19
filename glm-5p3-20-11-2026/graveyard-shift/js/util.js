'use strict';
const TAU = Math.PI * 2;
const U = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  rand(a, b) { return a + Math.random() * (b - a); },
  irand(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  chance(p) { return Math.random() < p; },
  pick(arr) { return arr[(Math.random() * arr.length) | 0]; },
  pickW(arr, wf) {
    let tot = 0;
    for (const it of arr) tot += wf(it);
    let r = Math.random() * tot;
    for (const it of arr) { r -= wf(it); if (r <= 0) return it; }
    return arr[arr.length - 1];
  },
  dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
  dist(ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); },
  ang(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); },
  hash2(x, y, s) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 2246822519;
    h = (h ^ (h >>> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  },
  swapRemove(arr, i) { arr[i] = arr[arr.length - 1]; arr.pop(); },
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  },
  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
};
