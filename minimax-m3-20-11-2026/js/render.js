(function (G) {
  'use strict';
  var U = G.U;

  var R = (G.Render = {
    canvas: null,
    scene: null,
    sctx: null,
    gl: null,
    W: 0, H: 0, q: 1,
    useGL: false,
    glReady: false,
    prog: null, blurProg: null,
    texScene: null, texBloomA: null, texBloomB: null,
    fboA: null, fboB: null,
    quad: null,
    stars: null,
    nebula: [],
    glowCache: {},
    time: 0,
    flash: 0,
    flashColor: [1, 1, 1],
    aberr: 1,
    lens: 0,
    bloom: 1,
    vignette: 1,
    grain: 0.035,
    shakeX: 0, shakeY: 0,
    zoom: 1
  });

  var VS = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}';
  var FS_COMPOSITE = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uScene;',
    'uniform sampler2D uBloom;',
    'uniform vec2 uRes;',
    'uniform vec2 uCenter;',
    'uniform float uTime;',
    'uniform float uAberr;',
    'uniform float uLens;',
    'uniform float uVignette;',
    'uniform float uGrain;',
    'uniform float uFlash;',
    'uniform float uBloomK;',
    'uniform float uDanger;',
    'uniform vec3 uFlashColor;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'void main(){',
    ' vec2 uv=vUv;',
    ' vec2 c=uCenter/uRes;',
    ' vec2 d=uv-c;',
    ' float r=length(d);',
    ' float ang=atan(d.y,d.x);',
    ' float swirl=uLens*exp(-r*3.2)/(0.22+r*2.2);',
    ' float cs=cos(swirl),sn=sin(swirl);',
    ' vec2 suv=vec2(d.x*cs-d.y*sn,d.x*sn+d.y*cs)+c;',
    ' vec2 dirv=r>0.0002?d/r:vec2(0.0);',
    ' float ca=0.0075*uAberr*(0.18+r*1.35);',
    ' vec2 off=dirv*ca;',
    ' vec3 col;',
    ' col.r=texture2D(uScene,suv+off).r;',
    ' col.g=texture2D(uScene,suv).g;',
    ' col.b=texture2D(uScene,suv-off).b;',
    ' col+=texture2D(uBloom,suv).rgb*uBloomK;',
    ' float v=smoothstep(1.05,0.30,length(uv-0.5)*1.45);',
    ' col*=mix(1.0,v,uVignette);',
    ' float dv=smoothstep(0.24,0.72,length(uv-0.5)*1.35);',
    ' col=mix(col,vec3(0.85,0.06,0.14),dv*uDanger);',
    ' float g=hash(uv*uRes+fract(uTime)*vec2(53.0,17.0));',
    ' col+=(g-0.5)*uGrain;',
    ' col=mix(col,uFlashColor,uFlash);',
    ' gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  var FS_BLUR = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uTexel;',
    'uniform vec2 uDir;',
    'void main(){',
    ' vec3 c=texture2D(uTex,vUv).rgb*0.227027;',
    ' c+=texture2D(uTex,vUv+uDir*uTexel*1.3846154).rgb*0.3162162;',
    ' c+=texture2D(uTex,vUv-uDir*uTexel*1.3846154).rgb*0.3162162;',
    ' c+=texture2D(uTex,vUv+uDir*uTexel*3.2307692).rgb*0.0702703;',
    ' c+=texture2D(uTex,vUv-uDir*uTexel*3.2307692).rgb*0.0702703;',
    ' gl_FragColor=vec4(c,1.0);',
    '}'
  ].join('\n');

  R.init = function (canvas) {
    R.canvas = canvas;
    R.scene = document.createElement('canvas');
    R.sctx = R.scene.getContext('2d', { alpha: false });
    R.gl = initGL(canvas);
    R.useGL = !!R.gl;
    buildGlowSprites();
    buildNebula();
    R.resize();
    window.addEventListener('resize', R.resize);
    return R.useGL;
  };

  R.resize = function () {
    var w = Math.max(320, window.innerWidth);
    var h = Math.max(240, window.innerHeight);
    R.W = w; R.H = h;
    var q = Math.min(window.devicePixelRatio || 1, 1.5);
    var maxPix = 2600000;
    if (w * h * q * q > maxPix) q = Math.max(0.7, Math.sqrt(maxPix / (w * h)));
    R.q = q;
    R.scene.width = Math.floor(w * q);
    R.scene.height = Math.floor(h * q);
    if (!R.useGL) {
      R.canvas.width = R.scene.width;
      R.canvas.height = R.scene.height;
      R.ctx2d = R.canvas.getContext('2d');
      R.ctx2d.setTransform(q, 0, 0, q, 0, 0);
    }
    if (R.gl) {
      buildGLResources();
      R.canvas.width = R.scene.width;
      R.canvas.height = R.scene.height;
    }
    buildNebula();
  };

  function initGL(canvas) {
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl', { alpha: false, antialias: false });
    } catch (e) { gl = null; }
    if (!gl) return null;
    R.gl = gl;
    try { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); } catch (e) { }
    R.prog = makeProgram(gl, VS, FS_COMPOSITE);
    R.blurProg = makeProgram(gl, VS, FS_BLUR);
    R.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    R.glReady = !!R.prog && !!R.blurProg;
    return R.glReady ? gl : null;
  }

  function makeProgram(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn('shader error', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('link error', gl.getProgramInfoLog(p));
      return null;
    }
    return p;
  }

  function makeTex(gl, w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  }

  function buildGLResources() {
    var gl = R.gl;
    var w = R.scene.width, h = R.scene.height;
    var bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    R.bw = bw; R.bh = bh;
    if (R.texScene) gl.deleteTexture(R.texScene);
    if (R.texBloomA) gl.deleteTexture(R.texBloomA);
    if (R.texBloomB) gl.deleteTexture(R.texBloomB);
    R.texScene = makeTex(gl, w, h);
    R.texBloomA = makeTex(gl, bw, bh);
    R.texBloomB = makeTex(gl, bw, bh);
    if (!R.fboA) R.fboA = gl.createFramebuffer();
    if (!R.fboB) R.fboB = gl.createFramebuffer();
  }

  function buildGlowSprites() {
    var defs = {
      cyan: '#5ef0ff', magenta: '#ff4fd8', amber: '#ffc861', red: '#ff5a6e',
      green: '#6ef7a5', white: '#ffffff', violet: '#a06bff', orange: '#ff9a4d'
    };
    for (var k in defs) {
      var c = document.createElement('canvas');
      c.width = c.height = 128;
      var x = c.getContext('2d');
      var gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, U.rgba(defs[k], 1));
      gr.addColorStop(0.22, U.rgba(defs[k], 0.55));
      gr.addColorStop(0.55, U.rgba(defs[k], 0.16));
      gr.addColorStop(1, U.rgba(defs[k], 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, 128, 128);
      R.glowCache[k] = c;
    }
  }

  function buildNebula() {
    R.nebula = [];
    var size = 900;
    for (var i = 0; i < 1; i++) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var x = c.getContext('2d');
      var rng = new U.RNG(9000 + i * 7717);
      var cols = ['#2a1b5e', '#0d3b55', '#4a1048', '#12324a'];
      for (var b = 0; b < 26; b++) {
        var bx = rng.f(0, size), by = rng.f(0, size), br = rng.f(70, 230);
        var col = cols[rng.i(0, cols.length - 1)];
        for (var oy = -1; oy <= 1; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            var px = bx + ox * size, py = by + oy * size;
            if (px + br < 0 || px - br > size || py + br < 0 || py - br > size) continue;
            var gr = x.createRadialGradient(px, py, 0, px, py, br);
            gr.addColorStop(0, U.rgba(col, 0.38));
            gr.addColorStop(0.45, U.rgba(col, 0.13));
            gr.addColorStop(1, U.rgba(col, 0));
            x.fillStyle = gr;
            x.fillRect(px - br, py - br, br * 2, br * 2);
          }
        }
      }
      R.nebula.push(c);
    }
  }

  R.glow = function (ctx, color, x, y, radius, alpha) {
    var sp = R.glowCache[color];
    if (!sp) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  R.begin = function () {
    var ctx = R.sctx;
    ctx.setTransform(R.q, 0, 0, R.q, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, R.W, R.H);
    return ctx;
  };

  R.starAt = function (cx, cy, k, out) {
    var h = U.hashStr(cx + ':' + cy + ':' + k);
    var rng = new U.RNG(h);
    out.x = cx * 430 + rng.f(0, 430);
    out.y = cy * 430 + rng.f(0, 430);
    out.b = rng.f(0.25, 1);
    out.s = rng.f(0.5, 1.9) * (rng.chance(0.08) ? 2.1 : 1);
    out.t = rng.f(0, U.TAU);
    out.c = rng.chance(0.18) ? (rng.chance(0.5) ? '#9fd8ff' : '#ffd9a8') : '#ffffff';
    return out;
  };

  var tmpStar = { x: 0, y: 0, b: 0, s: 0, t: 0, c: '#fff' };

  R.drawStars = function (ctx, cam) {
    var layers = [
      { p: 0.06, sp: 0.0, a: 0.5, n: 1 },
      { p: 0.14, sp: 0.0, a: 0.7, n: 1 },
      { p: 0.26, sp: 0.0, a: 0.95, n: 2 }
    ];
    ctx.globalCompositeOperation = 'lighter';
    for (var li = 0; li < layers.length; li++) {
      var L = layers[li];
      var ox = -cam.x * L.p, oy = -cam.y * L.p;
      var cw = R.W + 200, ch = R.H + 200;
      var x0 = Math.floor((-ox - 100) / 430), x1 = Math.floor((-ox + cw) / 430);
      var y0 = Math.floor((-oy - 100) / 430), y1 = Math.floor((-oy + ch) / 430);
      for (var cy = y0; cy <= y1; cy++) {
        for (var cx = x0; cx <= x1; cx++) {
          for (var k = 0; k < L.n; k++) {
            R.starAt(cx, cy, k + li * 7, tmpStar);
            var sx = tmpStar.x * L.p + ox;
            var sy = tmpStar.y * L.p + oy;
            if (sx < -50 || sx > R.W + 50 || sy < -50 || sy > R.H + 50) continue;
            var tw = 0.62 + 0.38 * Math.sin(R.time * 1.6 + tmpStar.t);
            var a = tmpStar.b * L.a * tw;
            ctx.globalAlpha = a;
            ctx.fillStyle = tmpStar.c;
            var s = tmpStar.s * (1 + li * 0.35);
            ctx.beginPath();
            ctx.arc(sx, sy, s * 0.6, 0, U.TAU);
            ctx.fill();
            if (tmpStar.s > 1.8) {
              ctx.globalAlpha = a * 0.5;
              ctx.fillRect(sx - s * 2.2, sy - 0.35, s * 4.4, 0.7);
              ctx.fillRect(sx - 0.35, sy - s * 2.2, 0.7, s * 4.4);
            }
          }
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  R.drawNebula = function (ctx, cam) {
    var size = 620;
    ctx.globalCompositeOperation = 'lighter';
    var p = 0.07;
    var ox = -cam.x * p, oy = -cam.y * p;
    var x0 = Math.floor((-ox - size) / size), x1 = Math.floor((-ox + R.W) / size);
    var y0 = Math.floor((-oy - size) / size), y1 = Math.floor((-oy + R.H) / size);
    var maxI = Math.min((x1 - x0 + 1) * (y1 - y0 + 1), 24);
    var count = 0;
    for (var iy = y0; iy <= y1 && count < maxI; iy++) {
      for (var ix = x0; ix <= x1 && count < maxI; ix++) {
        var img = R.nebula[0];
        if (!img) continue;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(img, ix * size + ox, iy * size + oy, size, size);
        count++;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  R.drawPlanet = function (ctx, p, cam, zoom) {
    var sx = (p.x - cam.x) * zoom + R.W / 2;
    var sy = (p.y - cam.y) * zoom + R.H / 2;
    var r = p.r * zoom;
    if (sx + r * 2.6 < -40 || sx - r * 2.6 > R.W + 40 || sy + r * 2.6 < -40 || sy - r * 2.6 > R.H + 40) return;

    R.glow(ctx, p.tint, sx, sy, r * 2.5, 0.20);
    R.glow(ctx, p.tint, sx, sy, r * 1.35, 0.28);

    var g = ctx.createRadialGradient(sx - r * 0.35, sy - r * 0.4, r * 0.06, sx, sy, r);
    g.addColorStop(0, p.core);
    g.addColorStop(0.55, p.mid);
    g.addColorStop(1, p.edge);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, U.TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, U.TAU);
    ctx.clip();
    ctx.globalAlpha = 0.20;
    for (var i = 0; i < 7; i++) {
      var yy = sy - r + (i / 7) * r * 2 + Math.sin(R.time * 0.05 + i) * 3 * zoom;
      ctx.fillStyle = i % 2 ? p.band : '#000';
      ctx.beginPath();
      ctx.ellipse(sx, yy, r * 1.05, r * (0.055 + 0.03 * Math.sin(i * 2.3)), 0, 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.strokeStyle = U.rgba(p.tint, 0.35);
    ctx.lineWidth = 1.2 * zoom;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.045, 0, U.TAU);
    ctx.stroke();

    if (p.ring) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.35);
      ctx.scale(1, 0.22);
      ctx.strokeStyle = U.rgba(p.tint, 0.45);
      ctx.lineWidth = 7 * zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.75, 0, U.TAU);
      ctx.stroke();
      ctx.strokeStyle = U.rgba('#ffffff', 0.12);
      ctx.lineWidth = 2 * zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.95, 0, U.TAU);
      ctx.stroke();
      ctx.restore();
    }

    if (p.moons) {
      for (var m = 0; m < p.moons.length; m++) {
        var mo = p.moons[m];
        var ang = R.time * mo.sp + mo.ph;
        var mx = sx + Math.cos(ang) * mo.d * zoom;
        var my = sy + Math.sin(ang) * mo.d * zoom * 0.55;
        ctx.fillStyle = U.rgba('#cfd8e6', 0.85);
        ctx.beginPath();
        ctx.arc(mx, my, mo.r * zoom, 0, U.TAU);
        ctx.fill();
      }
    }
  };

  R.drawDebris = function (ctx, d, cam, zoom) {
    var sx = (d.x - cam.x) * zoom + R.W / 2;
    var sy = (d.y - cam.y) * zoom + R.H / 2;
    var r = d.r * zoom;
    if (sx < -60 || sx > R.W + 60 || sy < -60 || sy > R.H + 60) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(d.rot);
    ctx.beginPath();
    var pts = d.pts;
    for (var i = 0; i < pts.length; i++) {
      var px = pts[i][0] * r, py = pts[i][1] * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    var g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, d.lit);
    g.addColorStop(0.55, d.base);
    g.addColorStop(1, d.dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = U.rgba(d.edge, 0.55);
    ctx.lineWidth = Math.max(0.6, 1.1 * zoom);
    ctx.stroke();
    ctx.restore();
    if (d.big) R.glow(ctx, d.edge, sx, sy, r * 2.4, 0.16);
  };

  R.drawPlayer = function (ctx, p, cam, zoom, t) {
    var sx = (p.x - cam.x) * zoom + R.W / 2;
    var sy = (p.y - cam.y) * zoom + R.H / 2;
    var br = p.bodyR() * zoom;
    var cr = p.captureR() * zoom;

    if (cr > 12) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var fg = ctx.createRadialGradient(sx, sy, br * 0.6, sx, sy, cr);
      fg.addColorStop(0, 'rgba(150,80,255,0.20)');
      fg.addColorStop(0.55, 'rgba(90,60,220,0.075)');
      fg.addColorStop(1, 'rgba(40,30,140,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(sx, sy, cr, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(160,110,255,0.16)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 11]);
      ctx.lineDashOffset = -t * 26;
      ctx.beginPath();
      ctx.arc(sx, sy, cr, 0, U.TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    R.glow(ctx, 'violet', sx, sy, br * 3.4, 0.30);
    R.glow(ctx, 'magenta', sx, sy, br * 2.1, 0.34);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.spin);

    var ph = p.phase;
    ctx.strokeStyle = 'rgba(255,190,120,0.85)';
    ctx.lineWidth = Math.max(1.2, br * 0.11);
    for (var a = 0; a < 3; a++) {
      var start = ph + a * (U.TAU / 3);
      ctx.beginPath();
      ctx.arc(0, 0, br * 1.32, start, start + 1.25);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,120,220,0.55)';
    ctx.lineWidth = Math.max(0.8, br * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, br * 1.62, ph * 0.7, ph * 0.7 + 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, br * 1.78, ph * 1.3 + 2, ph * 1.3 + 3.1);
    ctx.stroke();

    var bg = ctx.createRadialGradient(0, 0, 0, 0, 0, br);
    bg.addColorStop(0, '#000000');
    bg.addColorStop(0.72, '#03010a');
    bg.addColorStop(0.93, '#120326');
    bg.addColorStop(1, 'rgba(70,20,120,0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, br, 0, U.TAU);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(0.7, 1.1 * zoom);
    ctx.beginPath();
    ctx.arc(sx, sy, br * 0.98, 0, U.TAU);
    ctx.stroke();

    if (p.iframe > 0) {
      ctx.strokeStyle = 'rgba(120,230,255,' + (0.35 + 0.4 * Math.sin(t * 30)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, br * 1.35, 0, U.TAU);
      ctx.stroke();
    }

    if (p.dashT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(sx, sy);
      ctx.rotate(p.spin * 0.2);
      for (var s2 = 0; s2 < 14; s2++) {
        var sa = (s2 / 14) * U.TAU + p.phase * 0.3;
        var sr = br * (1.5 + (s2 % 4) * 0.55);
        var len = br * (1.4 + (s2 % 3) * 0.9);
        ctx.strokeStyle = 'rgba(140,240,255,' + (0.5 - (s2 % 3) * 0.13) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * sr, Math.sin(sa) * sr);
        ctx.lineTo(Math.cos(sa) * (sr + len), Math.sin(sa) * (sr + len));
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  var ENEMY_STYLE = {
    mote: { c: '#ff7a5c', g: 'orange' },
    darter: { c: '#ff4fd8', g: 'magenta' },
    lancer: { c: '#ff5a6e', g: 'red' },
    anchor: { c: '#c98bff', g: 'violet' },
    splitter: { c: '#ff9a4d', g: 'orange' },
    warden: { c: '#ff3d6e', g: 'red' }
  };

  R.drawEnemy = function (ctx, e, cam, zoom, t) {
    var sx = (e.x - cam.x) * zoom + R.W / 2;
    var sy = (e.y - cam.y) * zoom + R.H / 2;
    var r = e.r * zoom;
    if (sx < -140 || sx > R.W + 140 || sy < -140 || sy > R.H + 140) return;
    var st = ENEMY_STYLE[e.type] || ENEMY_STYLE.mote;
    var hurt = e.flash > 0 ? 1 : 0;

    R.glow(ctx, st.g, sx, sy, r * 3.2, 0.26 + hurt * 0.3);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(e.rot);

    if (e.type === 'mote') {
      ctx.fillStyle = st.c;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = '#2a0a08';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, U.TAU);
      ctx.fill();
    } else if (e.type === 'darter') {
      ctx.fillStyle = st.c;
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var a = i * (U.TAU / 3) - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r * 1.45, Math.sin(a) * r * 1.45);
        ctx.lineTo(Math.cos(a + 0.45) * r * 0.72, Math.sin(a + 0.45) * r * 0.72);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1b0418';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, U.TAU);
      ctx.fill();
    } else if (e.type === 'lancer') {
      ctx.rotate(Math.atan2(e.vy, e.vx));
      ctx.fillStyle = st.c;
      ctx.beginPath();
      ctx.moveTo(r * 1.9, 0);
      ctx.lineTo(r * 0.2, r * 0.95);
      ctx.lineTo(-r * 1.1, r * 0.6);
      ctx.lineTo(-r * 1.1, -r * 0.6);
      ctx.lineTo(r * 0.2, -r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(r * 0.1, 0, r * 0.32, 0, U.TAU);
      ctx.fill();
    } else if (e.type === 'anchor') {
      ctx.strokeStyle = st.c;
      ctx.lineWidth = Math.max(1.5, r * 0.2);
      for (var a2 = 0; a2 < 6; a2++) {
        var an = a2 * (U.TAU / 6) + t * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.25, an, an + 0.8);
        ctx.stroke();
      }
      ctx.fillStyle = '#170a28';
      ctx.beginPath();
      for (var i2 = 0; i2 < 6; i2++) {
        var av = i2 * (U.TAU / 6);
        var px = Math.cos(av) * r, py = Math.sin(av) * r;
        if (i2 === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = st.c;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, U.TAU);
      ctx.fill();
    } else if (e.type === 'splitter') {
      ctx.fillStyle = st.c;
      ctx.beginPath();
      for (var sp2 = 0; sp2 < 10; sp2++) {
        var spa = sp2 * (U.TAU / 10) + e.phase * 0.6;
        var spr = r * (sp2 % 2 ? 1.25 : 1.0);
        if (sp2 === 0) ctx.moveTo(Math.cos(spa) * spr, Math.sin(spa) * spr);
        else ctx.lineTo(Math.cos(spa) * spr, Math.sin(spa) * spr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#2a1204';
      for (var nu = 0; nu < 3; nu++) {
        var na = e.phase * 0.8 + nu * (U.TAU / 3);
        ctx.beginPath();
        ctx.arc(Math.cos(na) * r * 0.38, Math.sin(na) * r * 0.38, r * 0.2, 0, U.TAU);
        ctx.fill();
      }
    } else if (e.type === 'warden') {
      ctx.strokeStyle = st.c;
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.28, 0, U.TAU);
      ctx.stroke();
      ctx.rotate(-t * 0.7);
      for (var k = 0; k < 8; k++) {
        var ak = k * (U.TAU / 8);
        ctx.beginPath();
        ctx.moveTo(Math.cos(ak) * r * 0.9, Math.sin(ak) * r * 0.9);
        ctx.lineTo(Math.cos(ak) * r * 1.45, Math.sin(ak) * r * 1.45);
        ctx.stroke();
      }
      ctx.rotate(t * 0.7);
      var open = e.vuln > 0;
      ctx.fillStyle = open ? '#ffe08a' : '#2b0715';
      ctx.beginPath();
      ctx.arc(0, 0, r * (open ? 0.72 : 0.5), 0, U.TAU);
      ctx.fill();
      if (open) R.glow(ctx, 'amber', 0, 0, r * 2.6, 0.5);
    }
    ctx.restore();

    if (e.hp < e.maxHp && e.maxHp > 0) {
      var bw = Math.max(22, r * 2.4), bh = 3;
      var by = sy - r * 1.9;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(sx - bw / 2, by, bw, bh);
      ctx.fillStyle = e.type === 'warden' ? '#ff3d6e' : '#ffb36b';
      ctx.fillRect(sx - bw / 2, by, bw * (e.hp / e.maxHp), bh);
    }
  };

  R.drawBolt = function (ctx, b, cam, zoom) {
    var sx = (b.x - cam.x) * zoom + R.W / 2;
    var sy = (b.y - cam.y) * zoom + R.H / 2;
    var r = b.r * zoom;
    if (sx < -40 || sx > R.W + 40 || sy < -40 || sy > R.H + 40) return;
    var tx = sx - b.vx * zoom * 0.045, ty = sy - b.vy * zoom * 0.045;
    ctx.globalCompositeOperation = 'lighter';
    var g = ctx.createLinearGradient(tx, ty, sx, sy);
    g.addColorStop(0, 'rgba(255,80,110,0)');
    g.addColorStop(1, 'rgba(255,150,120,0.85)');
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.2, r * 1.5);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';
    R.glow(ctx, 'red', sx, sy, r * 5, 0.5);
  };

  R.drawShard = function (ctx, s, cam, zoom) {
    var sx = (s.x - cam.x) * zoom + R.W / 2;
    var sy = (s.y - cam.y) * zoom + R.H / 2;
    var r = s.r * zoom;
    if (sx < -60 || sx > R.W + 60 || sy < -60 || sy > R.H + 60) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(s.rot);
    ctx.fillStyle = s.tint;
    ctx.beginPath();
    ctx.moveTo(r * 1.5, 0);
    ctx.lineTo(-r * 0.7, r * 0.8);
    ctx.lineTo(-r * 0.3, 0);
    ctx.lineTo(-r * 0.7, -r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    R.glow(ctx, s.glowKey, sx, sy, r * 4.5, 0.5);
  };

  R.drawPickup = function (ctx, p, cam, zoom, t) {
    var sx = (p.x - cam.x) * zoom + R.W / 2;
    var sy = (p.y - cam.y) * zoom + R.H / 2;
    if (sx < -40 || sx > R.W + 40 || sy < -40 || sy > R.H + 40) return;
    var r = p.r * zoom * (1 + Math.sin(t * 5 + p.ph) * 0.14);
    R.glow(ctx, 'green', sx, sy, r * 6, 0.5);
    ctx.fillStyle = '#b6ffd6';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = '#0d3a1f';
    ctx.fillRect(sx - r * 0.22, sy - r * 0.75, r * 0.44, r * 1.5);
    ctx.fillRect(sx - r * 0.75, sy - r * 0.22, r * 1.5, r * 0.44);
  };

  R.drawParticles = function (ctx, list, cam, zoom) {
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var sx = (p.x - cam.x) * zoom + R.W / 2;
      var sy = (p.y - cam.y) * zoom + R.H / 2;
      if (sx < -30 || sx > R.W + 30 || sy < -30 || sy > R.H + 30) continue;
      var a = p.life / p.max;
      if (a <= 0) continue;
      ctx.globalAlpha = a * (p.a || 1);
      ctx.fillStyle = p.c;
      var s = p.r * zoom * (p.grow ? (1 + (1 - a) * 2.2) : a * 1.1 + 0.25);
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(0.4, s), 0, U.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  R.drawFloatingText = function (ctx, list, cam, zoom) {
    ctx.textAlign = 'center';
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var sx = (t.x - cam.x) * zoom + R.W / 2;
      var sy = (t.y - cam.y) * zoom + R.H / 2;
      var a = t.life / t.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '700 ' + (t.size * zoom).toFixed(1) + 'px "JetBrains Mono", monospace';
      ctx.fillStyle = t.c;
      ctx.fillText(t.txt, sx, sy);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  };

  R.drawUlt = function (ctx, u, cam, zoom) {
    var sx = (u.x - cam.x) * zoom + R.W / 2;
    var sy = (u.y - cam.y) * zoom + R.H / 2;
    var r = u.r * zoom;
    R.glow(ctx, 'violet', sx, sy, r * 2.6, 0.42);
    R.glow(ctx, 'magenta', sx, sy, r * 1.5, 0.4);
    var g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, '#000');
    g.addColorStop(0.8, '#04000c');
    g.addColorStop(1, 'rgba(160,60,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,230,0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.98, 0, U.TAU);
    ctx.stroke();
  };

  function loc(p, name) {
    if (!p._u) p._u = {};
    if (!(name in p._u)) p._u[name] = R.gl.getUniformLocation(p, name);
    return p._u[name];
  }

  function blurPass(gl, srcTex, dstTex, fbo, texelX, texelY, dirX, dirY) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, R.bw, R.bh);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dstTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(loc(R.blurProg, 'uTex'), 0);
    gl.uniform2f(loc(R.blurProg, 'uTexel'), texelX, texelY);
    gl.uniform2f(loc(R.blurProg, 'uDir'), dirX, dirY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  R.present = function (state) {
    var gl = R.gl;
    if (!gl) {
      if (!R.ctx2d) return;
      R.ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      R.ctx2d.drawImage(R.scene, 0, 0);
      return;
    }
    var w = R.scene.width, h = R.scene.height;
    gl.bindTexture(gl.TEXTURE_2D, R.texScene);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, R.scene);

    gl.useProgram(R.blurProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    blurPass(gl, R.texScene, R.texBloomA, R.fboA, 1 / w, 1 / h, 1, 0);
    blurPass(gl, R.texBloomA, R.texBloomB, R.fboB, 1 / R.bw, 1 / R.bh, 0, 1);
    blurPass(gl, R.texBloomB, R.texBloomA, R.fboA, 1 / R.bw, 1 / R.bh, 1.35, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(R.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, R.texScene);
    gl.uniform1i(loc(R.prog, 'uScene'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, R.texBloomA);
    gl.uniform1i(loc(R.prog, 'uBloom'), 1);
    gl.uniform2f(loc(R.prog, 'uRes'), w, h);
    gl.uniform2f(loc(R.prog, 'uCenter'), state.centerX * R.q, state.centerY * R.q);
    gl.uniform1f(loc(R.prog, 'uTime'), R.time);
    gl.uniform1f(loc(R.prog, 'uAberr'), state.aberr);
    gl.uniform1f(loc(R.prog, 'uLens'), state.lens);
    gl.uniform1f(loc(R.prog, 'uVignette'), R.vignette);
    gl.uniform1f(loc(R.prog, 'uGrain'), R.grain);
    gl.uniform1f(loc(R.prog, 'uFlash'), R.flash);
    gl.uniform1f(loc(R.prog, 'uBloomK'), state.bloom);
    gl.uniform1f(loc(R.prog, 'uDanger'), state.danger || 0);
    gl.uniform3f(loc(R.prog, 'uFlashColor'), R.flashColor[0], R.flashColor[1], R.flashColor[2]);
    gl.bindBuffer(gl.ARRAY_BUFFER, R.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  };

  R.setFlash = function (a, color) {
    R.flash = Math.max(R.flash, a);
    if (color) R.flashColor = color;
  };
})(window.G = window.G || {});
