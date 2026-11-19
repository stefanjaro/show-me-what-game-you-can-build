(function (G) {
  'use strict';
  var U = (G.U = {});

  U.TAU = Math.PI * 2;
  U.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.smooth = function (t) { return t * t * (3 - 2 * t); };
  U.sign = function (v) { return v < 0 ? -1 : v > 0 ? 1 : 0; };
  U.rand = function (a, b) { return a + Math.random() * (b - a); };
  U.randInt = function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); };
  U.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  U.chance = function (p) { return Math.random() < p; };
  U.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.dist2 = function (ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  U.dist = function (ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); };
  U.angDiff = function (a, b) {
    var d = (b - a) % U.TAU;
    if (d > Math.PI) d -= U.TAU;
    if (d < -Math.PI) d += U.TAU;
    return d;
  };
  U.angTo = function (a, b, t) { return a + U.angDiff(a, b) * U.clamp(t, 0, 1); };
  U.easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  U.easeIn = function (t) { return t * t * t; };

  U.fmtTime = function (s) {
    var m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + (r < 10 ? '0' : '') + r;
  };

  U.fmtNum = function (n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(Math.floor(n));
  };

  U.hexToRgb = function (hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  U.rgba = function (hex, a) {
    var c = U.hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  };

  U.mixHex = function (h1, h2, t) {
    var a = U.hexToRgb(h1), b = U.hexToRgb(h2);
    return 'rgb(' + ((a[0] + (b[0] - a[0]) * t) | 0) + ',' + ((a[1] + (b[1] - a[1]) * t) | 0) + ',' + ((a[2] + (b[2] - a[2]) * t) | 0) + ')';
  };

  U.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.hashStr = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  U.RNG = function (seed) {
    this.r = U.mulberry32(typeof seed === 'string' ? U.hashStr(seed) : (seed >>> 0));
  };
  U.RNG.prototype.f = function (a, b) {
    if (a === undefined) return this.r();
    if (b === undefined) return this.r() * a;
    return a + this.r() * (b - a);
  };
  U.RNG.prototype.i = function (a, b) { return Math.floor(this.f(a, b + 1)); };
  U.RNG.prototype.pick = function (arr) { return arr[(this.r() * arr.length) | 0]; };
  U.RNG.prototype.chance = function (p) { return this.r() < p; };
  U.RNG.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (this.r() * (i + 1)) | 0, t = arr[i];
      arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  U.SEED_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY3479';

  U.makeSeed = function () {
    var s = '', a = U.SEED_ALPHABET;
    for (var i = 0; i < 6; i++) s += a[(Math.random() * a.length) | 0];
    return s;
  };

  U.dailySeed = function (d) {
    d = d || new Date();
    var str = d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
    var h = U.hashStr(str).toString(36).toUpperCase();
    return h.slice(0, 6);
  };

  U.Storage = {
    get: function (key, def) {
      try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return def;
        var v = JSON.parse(raw);
        return v === null || v === undefined ? def : v;
      } catch (e) { return def; }
    },
    set: function (key, val) {
      try { window.localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
    }
  };

  G.Input = {
    keys: {},
    pressed: {},
    mouse: { x: 0, y: 0, down: false, moved: false },
    isTouch: (('ontouchstart' in window) || navigator.maxTouchPoints > 0),
    init: function (canvas) {
      var self = this;
      window.addEventListener('keydown', function (e) {
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (!self.keys[k]) self.pressed[k] = true;
        self.keys[k] = true;
        if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) {
        var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        self.keys[k] = false;
      });
      window.addEventListener('blur', function () { self.keys = {}; });
      canvas.addEventListener('mousemove', function (e) {
        var r = canvas.getBoundingClientRect();
        self.mouse.x = e.clientX - r.left;
        self.mouse.y = e.clientY - r.top;
        self.mouse.moved = true;
      });
      canvas.addEventListener('mousedown', function (e) { if (e.button === 0) self.mouse.down = true; });
      window.addEventListener('mouseup', function (e) { if (e.button === 0) self.mouse.down = false; });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },
    down: function (k) { return !!this.keys[k]; },
    hit: function (k) { return !!this.pressed[k]; },
    endFrame: function () { this.pressed = {}; this.mouse.moved = false; },
    axis: function () {
      var x = 0, y = 0;
      if (this.down('a') || this.down('ArrowLeft')) x -= 1;
      if (this.down('d') || this.down('ArrowRight')) x += 1;
      if (this.down('w') || this.down('ArrowUp')) y -= 1;
      if (this.down('s') || this.down('ArrowDown')) y += 1;
      if (x && y) { var inv = 0.7071067811865476; x *= inv; y *= inv; }
      return { x: x, y: y };
    }
  };
})(window.G = window.G || {});
