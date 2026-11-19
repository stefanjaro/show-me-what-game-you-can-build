'use strict';
const SPR = {};
(function () {
  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    fn(x, w, h);
    return c;
  }
  function cir(x, cx, cy, r, f, s, lw) {
    x.beginPath(); x.arc(cx, cy, r, 0, TAU);
    if (f) { x.fillStyle = f; x.fill(); }
    if (s) { x.strokeStyle = s; x.lineWidth = lw || 2; x.stroke(); }
  }
  function ell(x, cx, cy, rx, ry, f, s, lw) {
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    if (f) { x.fillStyle = f; x.fill(); }
    if (s) { x.strokeStyle = s; x.lineWidth = lw || 2; x.stroke(); }
  }
  function rct(x, x0, y0, w, h, f, r) {
    if (r) {
      x.beginPath();
      x.moveTo(x0 + r, y0);
      x.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
      x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      x.arcTo(x0, y0 + h, x0, y0, r);
      x.arcTo(x0, y0, x0 + w, y0, r);
      x.closePath();
    } else x.rect(x0, y0, w, h);
    x.fillStyle = f; x.fill();
  }
  function poly(x, pts, f, s, lw) {
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath();
    if (f) { x.fillStyle = f; x.fill(); }
    if (s) { x.strokeStyle = s; x.lineWidth = lw || 2; x.stroke(); }
  }
  function seg(x, x0, y0, x1, y1, wd, col) {
    x.strokeStyle = col; x.lineWidth = wd; x.lineCap = 'round';
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
  }
  function glow(x, col, b) { x.shadowColor = col; x.shadowBlur = b; }
  function noglow(x) { x.shadowBlur = 0; }
  function star(x, cx, cy, r, n, inner, f) {
    x.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const rr = i % 2 === 0 ? r : r * inner;
      const a = (i / (n * 2)) * TAU - Math.PI / 2;
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath(); x.fillStyle = f; x.fill();
  }
  function whiteOf(spr) {
    return mk(spr.width, spr.height, x => {
      x.drawImage(spr, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = '#fff'; x.fillRect(0, 0, spr.width, spr.height);
    });
  }

  const bone = '#e9e6da', boneD = '#b3ad99', boneDD = '#8a8574';

  function drawNecro(x, f) {
    const sway = f === 0 ? 0 : f === 1 ? 3 : -3;
    const legA = f === 1 ? 4 : f === 2 ? -4 : 0;
    seg(x, 30 + legA, 70, 27 + legA, 82, 7, '#1c1530');
    seg(x, 40 - legA, 70, 43 - legA, 82, 7, '#1c1530');
    poly(x, [[34, 8], [51, 24], [56 + sway, 72], [46, 78], [34, 74], [22, 78], [12 - sway, 72], [17, 24]], '#241b38');
    poly(x, [[34, 8], [51, 24], [52, 40], [34, 30], [16, 40], [17, 24]], '#2c2145');
    seg(x, 16, 44, 50, 46, 3, 'rgba(150,100,230,0.35)');
    ell(x, 20, 27, 8, 5, bone, boneD, 1);
    ell(x, 48, 27, 8, 5, bone, boneD, 1);
    cir(x, 34, 15, 13, '#2c2145', '#1c1530', 1);
    ell(x, 34, 17, 8.5, 9, '#0a0812');
    glow(x, '#c07bff', 10);
    cir(x, 30, 17, 1.9, '#d29bff');
    cir(x, 38, 17, 1.9, '#d29bff');
    noglow(x);
    seg(x, 55, 24, 60, 76, 4, '#4a3a28');
    seg(x, 52, 30, 58, 32, 3, '#4a3a28');
    glow(x, '#7dff9a', 12);
    cir(x, 55, 19, 6, '#8dffb0');
    noglow(x);
    cir(x, 55, 19, 2.6, '#eafff0');
    return x;
  }
  SPR.player = [0, 1, 2].map(f => mk(72, 90, x => drawNecro(x, f)));
  SPR.playerFlash = SPR.player.map(whiteOf);

  function drawMinion(x, f) {
    const step = f === 0 ? 4 : -4;
    seg(x, 21 + step, 40, 19 + step, 52, 5, boneDD);
    seg(x, 29 - step, 40, 31 - step, 52, 5, boneDD);
    for (let i = 0; i < 3; i++) seg(x, 14, 24 + i * 5, 36, 25 + i * 5, 3, bone);
    seg(x, 14, 22, 7, 30, 3.4, bone);
    seg(x, 36, 22, 43, 30, 3.4, bone);
    cir(x, 7, 31, 3.4, bone, boneD, 1);
    cir(x, 43, 31, 3.4, bone, boneD, 1);
    cir(x, 25, 12, 9.5, bone, boneD, 1.4);
    ell(x, 25, 20, 6, 4.5, bone, boneD, 1);
    seg(x, 21, 21, 21, 24, 1.6, boneDD);
    seg(x, 25, 21, 25, 24, 1.6, boneDD);
    seg(x, 29, 21, 29, 24, 1.6, boneDD);
    glow(x, '#6bff8f', 8);
    cir(x, 21, 11, 2.1, '#8dffa8');
    cir(x, 29, 11, 2.1, '#8dffa8');
    noglow(x);
    return x;
  }
  SPR.minion = [0, 1].map(f => mk(50, 60, x => drawMinion(x, f)));
  SPR.minionFlash = SPR.minion.map(whiteOf);

  SPR.penitent = mk(56, 70, x => {
    poly(x, [[28, 6], [46, 20], [52, 58], [42, 66], [28, 62], [14, 66], [4, 58], [10, 20]], '#463f3a');
    poly(x, [[28, 6], [46, 20], [48, 38], [8, 38], [10, 20]], '#554c45');
    for (let i = 0; i < 5; i++) { poly(x, [[8 + i * 10, 58], [13 + i * 10, 70], [18 + i * 10, 58]], '#3a342f'); }
    seg(x, 14, 36, 44, 38, 3, '#6b5d4a');
    cir(x, 28, 13, 10, '#3a342f', '#28231f', 1);
    ell(x, 28, 14, 6, 6.4, '#100d0b');
    glow(x, '#ff5540', 6);
    cir(x, 24.5, 14, 1.6, '#ff7a5e');
    cir(x, 31.5, 14, 1.6, '#ff7a5e');
    noglow(x);
  });

  SPR.acolyte = mk(56, 74, x => {
    poly(x, [[28, 4], [44, 18], [50, 62], [40, 72], [28, 68], [16, 72], [6, 62], [12, 18]], '#ddd6c4');
    poly(x, [[28, 4], [44, 18], [46, 34], [10, 34], [12, 18]], '#e8e2d0');
    seg(x, 12, 44, 44, 52, 5, '#c9a34a');
    poly(x, [[24, 24], [32, 24], [29, 33], [27, 33]], '#c9a34a');
    poly(x, [[27, 20], [29, 20], [29, 40], [27, 40]], '#c9a34a');
    for (let i = 0; i < 5; i++) poly(x, [[8 + i * 10, 62], [13 + i * 10, 74], [18 + i * 10, 62]], '#c9bd9f');
    cir(x, 28, 12, 9.5, '#e8e2d0', '#c9bd9f', 1);
    ell(x, 28, 13, 5.5, 6, '#191410');
    glow(x, '#ffd97a', 5);
    cir(x, 25, 13, 1.5, '#ffe8ae');
    cir(x, 31, 13, 1.5, '#ffe8ae');
    noglow(x);
    seg(x, 46, 26, 52, 46, 2.6, '#8a6d3a');
    glow(x, '#ffca6a', 8);
    cir(x, 49, 20, 3, '#ffca6a');
    noglow(x);
    cir(x, 49, 20, 1.4, '#fff2cc');
  });

  SPR.hunter = mk(60, 76, x => {
    poly(x, [[30, 6], [48, 20], [54, 60], [44, 70], [30, 66], [16, 70], [6, 60], [12, 20]], '#39482f');
    poly(x, [[30, 6], [48, 20], [50, 36], [10, 36], [12, 20]], '#465a3a');
    cir(x, 30, 13, 10, '#39482f', '#242e1e', 1);
    ell(x, 30, 14, 5.5, 6, '#0c0f0a');
    glow(x, '#ffd97a', 6);
    cir(x, 26.5, 14, 1.7, '#ffd97a');
    cir(x, 33.5, 14, 1.7, '#ffd97a');
    noglow(x);
    seg(x, 10, 34, 50, 30, 4, '#5a4a30');
    seg(x, 16, 44, 46, 40, 3, '#6b5a3a');
    seg(x, 14, 32, 14, 40, 2.5, '#5a4a30');
    seg(x, 46, 28, 46, 36, 2.5, '#5a4a30');
    seg(x, 14, 32, 46, 28, 1.6, '#c9c2b0');
    for (let i = 0; i < 5; i++) poly(x, [[10 + i * 10, 60], [15 + i * 10, 76], [20 + i * 10, 60]], '#2c3826');
  });

  SPR.crusader = mk(68, 88, x => {
    poly(x, [[34, 30], [52, 36], [56, 74], [44, 84], [34, 80], [24, 84], [12, 74], [16, 36]], '#b9c1cc');
    poly(x, [[22, 34], [46, 34], [48, 58], [20, 58]], '#cfd6de');
    seg(x, 18, 40, 46, 44, 3, '#d8b45a');
    poly(x, [[31, 38], [37, 38], [34, 52]], '#d8b45a');
    seg(x, 26, 42, 42, 42, 3, '#d8b45a');
    ell(x, 18, 36, 9, 7, '#b9c1cc', '#8a93a2', 1.5);
    ell(x, 50, 36, 9, 7, '#b9c1cc', '#8a93a2', 1.5);
    cir(x, 34, 18, 11, '#cfd6de', '#8a93a2', 1.5);
    poly(x, [[34, 8], [36, 18], [34, 28], [32, 18]], '#d8b45a');
    ell(x, 34, 18, 7, 3, '#1a1e26');
    glow(x, '#ffe8ae', 6);
    cir(x, 31, 18, 1.6, '#ffe8ae');
    cir(x, 37, 18, 1.6, '#ffe8ae');
    noglow(x);
    poly(x, [[8, 44], [24, 40], [26, 78], [16, 86], [8, 74]], '#cfd6de');
    poly(x, [[17, 48], [17, 76], [23, 78]], '#d8b45a');
    seg(x, 12, 46, 22, 44, 3, '#8a93a2');
    seg(x, 52, 40, 60, 64, 4, '#6b5a3a');
    cir(x, 61, 68, 6, '#8a93a2', '#5a616e', 1.5);
    poly(x, [[61, 62], [67, 64], [61, 74], [55, 64]], '#b9c1cc');
  });

  SPR.hound = mk(76, 50, x => {
    ell(x, 38, 26, 26, 12, '#cfc4a8', '#8a8270', 1.5);
    poly(x, [[12, 22], [4, 26], [14, 30]], '#cfc4a8');
    poly(x, [[64, 20], [78, 24], [64, 30]], '#c4b898');
    cir(x, 8, 24, 7, '#cfc4a8', '#8a8270', 1);
    poly(x, [[10, 24], [20, 26], [10, 29]], '#3a342f');
    for (let i = 0; i < 4; i++) poly(x, [[26 + i * 8, 15], [30 + i * 8, 8], [34 + i * 8, 15]], '#8a8270');
    seg(x, 24, 36, 22, 48, 4, '#b3a98f');
    seg(x, 34, 36, 33, 48, 4, '#b3a98f');
    seg(x, 46, 36, 47, 48, 4, '#b3a98f');
    seg(x, 54, 36, 56, 48, 4, '#b3a98f');
    glow(x, '#ff5540', 7);
    cir(x, 6, 22, 2, '#ff7a5e');
    noglow(x);
  });

  SPR.elite = mk(92, 112, x => {
    poly(x, [[46, 18], [72, 34], [80, 92], [62, 108], [46, 102], [30, 108], [12, 92], [20, 34]], '#e8e2d2');
    poly(x, [[46, 18], [72, 34], [74, 52], [18, 52], [20, 34]], '#f2ecdc');
    seg(x, 20, 62, 72, 70, 6, '#a8302a');
    poly(x, [[40, 36], [52, 36], [46, 48], [42, 48]], '#d8b45a');
    poly(x, [[44, 30], [48, 30], [46, 56], [44, 56]], '#d8b45a');
    for (let i = 0; i < 6; i++) poly(x, [[12 + i * 12, 92], [18 + i * 12, 112], [24 + i * 12, 92]], '#d5cfba');
    poly(x, [[46, 2], [50, 26], [46, 32], [42, 26]], '#d8d2c0');
    seg(x, 39, 24, 53, 26, 4, '#d8b45a');
    ell(x, 46, 36, 8, 8.4, '#17130e');
    glow(x, '#ffd97a', 7);
    cir(x, 42.5, 36, 2.2, '#ffe8ae');
    cir(x, 49.5, 36, 2.2, '#ffe8ae');
    noglow(x);
    ell(x, 46, 8, 16, 4, 'rgba(255,220,130,0.0)', '#ffd97a', 2.5);
    glow(x, '#ffd97a', 14);
    ell(x, 46, 8, 13, 3, 'rgba(255,230,160,0.25)');
    noglow(x);
    seg(x, 72, 40, 82, 66, 3, '#8a6d3a');
    glow(x, '#ffca6a', 12);
    cir(x, 84, 36, 6.5, '#ffca6a');
    noglow(x);
    cir(x, 84, 36, 2.6, '#fff2cc');
  });

  SPR.champ = mk(124, 146, x => {
    poly(x, [[40, 84], [84, 84], [96, 140], [28, 140]], '#e8e2d2');
    poly(x, [[62, 24], [94, 36], [100, 96], [62, 108], [24, 96], [30, 36]], '#d8b45a');
    poly(x, [[62, 36], [86, 44], [88, 78], [62, 86], [36, 78], [38, 44]], '#e8cd8a');
    star(x, 62, 58, 14, 8, 0.5, '#fff2cc');
    ell(x, 28, 44, 13, 10, '#c9a34a', '#8a6d3a', 2);
    ell(x, 96, 44, 13, 10, '#c9a34a', '#8a6d3a', 2);
    cir(x, 62, 14, 13, '#e8cd8a', '#c9a34a', 2);
    ell(x, 62, 14, 8, 3.6, '#20180a');
    glow(x, '#ffe8ae', 8);
    cir(x, 58, 14, 2, '#fff');
    cir(x, 66, 14, 2, '#fff');
    noglow(x);
    glow(x, '#ffd97a', 16);
    ell(x, 62, 4, 20, 4.6, 'rgba(255,230,160,0.3)');
    noglow(x);
    seg(x, 106, 34, 118, 128, 7, '#cfd6de');
    poly(x, [[101, 36], [113, 24], [121, 32], [113, 44]], '#e8e2d2');
    seg(x, 108, 36, 118, 118, 3, '#8a93a2');
    poly(x, [[62, 4], [62, 24]], '#fff0');
  });

  SPR.seraphWings = mk(400, 240, x => {
    x.globalAlpha = 0.9;
    function wing(dir) {
      for (let layer = 0; layer < 3; layer++) {
        const sp = 200 - layer * 55;
        const ys = 120 + layer * 8;
        x.beginPath();
        x.moveTo(200 + dir * 24, ys);
        x.quadraticCurveTo(200 + dir * (sp * 0.45), ys - 40 - layer * 14, 200 + dir * sp, ys - 60 + layer * 6);
        for (let f = 3; f >= 0; f--) {
          x.quadraticCurveTo(
            200 + dir * (sp * (0.55 + f * 0.11)), ys - 34 + layer * 10 + f * 2,
            200 + dir * (sp * (0.5 + f * 0.115)), ys + 12 + layer * 8
          );
        }
        x.quadraticCurveTo(200 + dir * (sp * 0.4), ys + 20, 200 + dir * 24, ys + 8);
        x.closePath();
        x.fillStyle = layer === 0 ? 'rgba(255,240,205,0.95)' : layer === 1 ? 'rgba(255,225,170,0.8)' : 'rgba(240,205,140,0.65)';
        x.fill();
        x.strokeStyle = 'rgba(255,255,240,0.5)'; x.lineWidth = 1.5; x.stroke();
      }
    }
    glow(x, '#ffe8ae', 24);
    wing(-1); wing(1);
    noglow(x);
  });

  SPR.seraph = mk(190, 250, x => {
    poly(x, [[95, 40], [130, 70], [140, 200], [95, 232], [50, 200], [60, 70]], '#f4f0e6');
    poly(x, [[95, 40], [130, 70], [132, 110], [58, 110], [60, 70]], '#fbf8ef');
    seg(x, 62, 130, 128, 138, 6, '#d8b45a');
    star(x, 95, 88, 20, 8, 0.5, '#ffe8ae');
    poly(x, [[91, 66], [99, 66], [97, 112], [93, 112]], '#d8b45a');
    cir(x, 95, 24, 15, '#fbf8ef', '#d8b45a', 2);
    glow(x, '#fff', 18);
    cir(x, 89, 24, 3.2, '#fff');
    cir(x, 101, 24, 3.2, '#fff');
    noglow(x);
    glow(x, '#ffd97a', 30);
    ell(x, 95, 6, 26, 6, 'rgba(255,230,160,0.35)');
    noglow(x);
    seg(x, 140, 90, 158, 210, 6, '#f4f0e6');
    seg(x, 136, 88, 162, 92, 5, '#e8dfc8');
    seg(x, 50, 90, 32, 210, 6, '#f4f0e6');
    seg(x, 54, 88, 28, 92, 5, '#e8dfc8');
  });

  SPR.corpse = mk(60, 30, x => {
    ell(x, 30, 22, 27, 9, '#171522', '#0d0b12', 1);
    ell(x, 30, 20, 20, 7, '#221e2e');
    seg(x, 18, 16, 26, 4, 4, boneDD);
    cir(x, 28, 4, 3.4, boneD);
    seg(x, 40, 18, 48, 10, 3.4, boneDD);
  });

  SPR.projSpear = mk(84, 18, x => {
    seg(x, 10, 9, 62, 9, 5, bone);
    seg(x, 12, 7.4, 60, 7.4, 1.6, boneD);
    seg(x, 12, 10.6, 60, 10.6, 1.6, boneD);
    poly(x, [[60, 9], [74, 4], [82, 9], [74, 14]], bone);
    glow(x, '#8dffb0', 10);
    poly(x, [[70, 9], [76, 6.4], [80, 9], [76, 11.6]], '#8dffb0');
    noglow(x);
    seg(x, 8, 5, 14, 9, 3, boneD);
    seg(x, 8, 13, 14, 9, 3, boneD);
  });

  SPR.projBolt = mk(34, 34, x => {
    glow(x, '#7dff9a', 16);
    cir(x, 17, 17, 8, '#8dffb0');
    noglow(x);
    cir(x, 17, 17, 4.4, '#eafff0');
    cir(x, 13, 13, 1.8, '#fff');
  });

  SPR.projHoly = mk(30, 30, x => {
    poly(x, [[15, 1], [20, 12], [15, 15], [10, 12]], '#fff');
    glow(x, '#ffd97a', 14);
    poly(x, [[15, 3], [18.4, 11], [15, 13], [11.6, 11]], '#ffe8ae');
    noglow(x);
  });

  function drawWraith(x, f) {
    const w = f === 0 ? 0 : 4;
    x.globalAlpha = 0.92;
    x.beginPath();
    x.moveTo(26, 6);
    x.quadraticCurveTo(48, 10, 46, 38);
    x.quadraticCurveTo(46 + w, 50, 38, 58);
    x.quadraticCurveTo(34, 52, 30, 60);
    x.quadraticCurveTo(24, 52, 20, 58);
    x.quadraticCurveTo(16, 50, 12 - w, 42);
    x.quadraticCurveTo(4, 14, 26, 6);
    x.closePath();
    x.fillStyle = 'rgba(120,220,190,0.45)';
    x.fill();
    x.strokeStyle = 'rgba(190,255,235,0.9)'; x.lineWidth = 2.4; x.stroke();
    ell(x, 26, 22, 9, 10, 'rgba(20,40,36,0.9)');
    glow(x, '#dffff2', 8);
    cir(x, 22.5, 22, 2.4, '#eafff6');
    cir(x, 29.5, 22, 2.4, '#eafff6');
    noglow(x);
    x.globalAlpha = 1;
  }
  SPR.wraith = [0, 1].map(f => mk(56, 68, x => drawWraith(x, f)));

  SPR.ringRune = mk(150, 150, x => {
    glow(x, '#6bff8f', 12);
    cir(x, 75, 75, 62, null, 'rgba(140,255,170,0.8)', 2.4);
    cir(x, 75, 75, 50, null, 'rgba(140,255,170,0.5)', 1.4);
    noglow(x);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      seg(x, 75 + Math.cos(a) * 50, 75 + Math.sin(a) * 50, 75 + Math.cos(a) * 62, 75 + Math.sin(a) * 62, 2, 'rgba(140,255,170,0.8)');
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const cx = 75 + Math.cos(a) * 34, cy = 75 + Math.sin(a) * 34;
      cir(x, cx, cy, 3, 'rgba(140,255,170,0.9)');
    }
  });

  SPR.shockwave = mk(220, 220, x => {
    cir(x, 110, 110, 96, null, 'rgba(255,255,255,0.9)', 5);
    cir(x, 110, 110, 88, null, 'rgba(255,255,255,0.4)', 2);
  });

  SPR.soulS = mk(20, 20, x => {
    glow(x, '#b9c8ff', 10);
    cir(x, 10, 10, 6, '#ccd6ff');
    noglow(x);
    cir(x, 10, 10, 3, '#fff');
  });
  SPR.soulB = mk(34, 34, x => {
    glow(x, '#b9c8ff', 14);
    cir(x, 17, 17, 11, '#ccd6ff');
    noglow(x);
    cir(x, 17, 17, 5.4, '#fff');
    cir(x, 13, 12, 2.4, '#fff');
  });
  SPR.ess = mk(26, 26, x => {
    glow(x, '#ffd97a', 12);
    cir(x, 13, 13, 8, '#ffd97a');
    noglow(x);
    cir(x, 13, 13, 4, '#fff8e0');
  });
  SPR.heart = mk(26, 26, x => {
    x.beginPath();
    x.moveTo(13, 22);
    x.bezierCurveTo(2, 14, 2, 6, 8, 4);
    x.bezierCurveTo(11.6, 3, 13, 6, 13, 8);
    x.bezierCurveTo(13, 6, 14.4, 3, 18, 4);
    x.bezierCurveTo(24, 6, 24, 14, 13, 22);
    x.closePath();
    glow(x, '#ff5a6a', 12);
    x.fillStyle = '#ff6a78'; x.fill();
    noglow(x);
    cir(x, 9, 9, 2.2, '#ffd0d6');
  });
  SPR.chest = mk(60, 50, x => {
    rct(x, 6, 18, 48, 30, '#3a2a18');
    rct(x, 6, 18, 48, 8, '#4a3a20');
    seg(x, 8, 20, 52, 20, 2.4, '#241a10');
    seg(x, 10, 26, 10, 46, 2.4, '#241a10');
    seg(x, 50, 26, 50, 46, 2.4, '#241a10');
    glow(x, '#ffd97a', 10);
    rct(x, 25, 24, 10, 12, '#ffd97a');
    noglow(x);
    cir(x, 30, 30, 2.2, '#241a10');
    glow(x, '#ffca6a', 8);
    cir(x, 30, 12, 3.4, '#ffca6a');
    noglow(x);
  });

  SPR.tomb1 = mk(52, 62, x => {
    x.globalAlpha = 0.92;
    poly(x, [[26, 4], [46, 22], [46, 58], [6, 58], [6, 22]], '#3a3f4a');
    poly(x, [[26, 4], [46, 22], [46, 30], [6, 30], [6, 22]], '#474d5a');
    seg(x, 12, 20, 40, 24, 1.6, '#2c3038');
    ell(x, 30, 44, 9, 7, 'rgba(40,80,52,0.55)');
    seg(x, 20, 14, 24, 22, 1.4, '#2c3038');
    seg(x, 24, 12, 28, 22, 1.4, '#2c3038');
  });
  SPR.tomb2 = mk(46, 56, x => {
    x.globalAlpha = 0.92;
    poly(x, [[23, 6], [40, 18], [38, 54], [8, 54], [6, 18]], '#343945');
    x.save(); x.translate(23, 26); x.rotate(-0.1);
    poly(x, [[-4, -14], [4, -14], [2, 12], [-2, 12]], '#282c36');
    seg(x, -8, -8, 8, -8, 3.4, '#282c36');
    x.restore();
    ell(x, 16, 46, 8, 6, 'rgba(40,80,52,0.4)');
  });
  SPR.tomb3 = mk(56, 76, x => {
    x.globalAlpha = 0.92;
    rct(x, 10, 22, 36, 52, '#333844');
    poly(x, [[28, 2], [34, 12], [34, 22], [22, 22], [22, 12]], '#333844');
    seg(x, 28, 6, 28, 60, 4, '#282c36');
    seg(x, 16, 20, 40, 20, 4, '#282c36');
    ell(x, 36, 62, 9, 8, 'rgba(40,80,52,0.5)');
  });
  SPR.tree = mk(170, 200, x => {
    x.globalAlpha = 0.95;
    seg(x, 85, 196, 80, 90, 16, '#14100c');
    seg(x, 82, 120, 30, 70, 8, '#14100c');
    seg(x, 30, 70, 12, 52, 5, '#14100c');
    seg(x, 82, 100, 140, 56, 8, '#14100c');
    seg(x, 140, 56, 160, 40, 4, '#14100c');
    seg(x, 84, 80, 46, 30, 6, '#14100c');
    seg(x, 46, 30, 40, 18, 3.4, '#14100c');
    seg(x, 84, 90, 120, 22, 5, '#14100c');
    seg(x, 120, 22, 132, 10, 3, '#14100c');
  });
  SPR.fence = mk(70, 46, x => {
    x.globalAlpha = 0.95;
    for (let i = 0; i < 4; i++) {
      seg(x, 8 + i * 18, 8, 8 + i * 18, 44, 4, '#241f18');
      poly(x, [[5 + i * 18, 8], [11 + i * 18, 8], [8 + i * 18, 2]], '#241f18');
    }
    seg(x, 4, 18, 66, 18, 3, '#241f18');
    seg(x, 4, 32, 66, 32, 3, '#241f18');
  });
  SPR.tuft = mk(44, 26, x => {
    for (let i = 0; i < 7; i++) {
      seg(x, 22 + i * 2 - 6, 24, 22 + (i - 3) * 4.4, 6 - (i % 3) * 3, 2.2, '#1c2418');
    }
  });
  SPR.bonesP = mk(48, 30, x => {
    ell(x, 24, 24, 20, 7, '#15141c');
    seg(x, 12, 18, 32, 12, 3.4, '#5c584c');
    cir(x, 10, 18, 3, '#5c584c');
    cir(x, 34, 12, 3, '#5c584c');
    cir(x, 30, 18, 5.4, '#494538', '#332f26', 1);
    cir(x, 27, 16.6, 1.4, '#1a1812');
    cir(x, 33, 16.6, 1.4, '#1a1812');
  });
  SPR.rock = mk(52, 40, x => {
    poly(x, [[8, 36], [14, 14], [26, 6], [42, 12], [48, 34], [40, 38], [14, 38]], '#23262e');
    poly(x, [[14, 14], [26, 6], [30, 20], [18, 26]], '#2e323c');
  });
  SPR.shrine = mk(70, 56, x => {
    rct(x, 12, 30, 46, 18, '#2a2622');
    seg(x, 10, 30, 60, 30, 4, '#332e28');
    for (let i = 0; i < 3; i++) {
      const cx = 22 + i * 13;
      rct(x, cx - 2, 20, 5, 10, '#d8d2c0');
      glow(x, '#ffca6a', 10);
      cir(x, cx + 0.5, 16, 3, '#ffca6a');
      noglow(x);
      cir(x, cx + 0.5, 15, 1.2, '#fff2cc');
    }
    cir(x, 14, 36, 4, '#494538');
    cir(x, 56, 38, 3.4, '#494538');
  });

  SPR.blood = [0, 1, 2].map(v => mk(60, 40, x => {
    x.globalAlpha = 0.55;
    const pts = [[30, 20], [40, 12], [50, 22], [44, 34], [30, 30], [18, 36], [10, 24], [16, 12]];
    x.beginPath();
    x.moveTo(pts[v % 3][0], pts[v % 3][1]);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[(i + v) % pts.length];
      x.quadraticCurveTo(p[0] + 6, p[1] + 3, pts[(i + v + 1) % pts.length][0], pts[(i + v + 1) % pts.length][1]);
    }
    x.closePath();
    x.fillStyle = '#3a0d12'; x.fill();
    cir(x, 40 + v * 4, 18, 3.4, '#4a1016');
  }));

  SPR.shard = mk(12, 12, x => { poly(x, [[6, 1], [10, 5], [7, 11], [3, 7]], boneD); });
  SPR.spark = mk(10, 10, x => { glow(x, '#ffe8ae', 6); cir(x, 5, 5, 3, '#ffe8ae'); });
  SPR.gspark = mk(10, 10, x => { glow(x, '#ffd97a', 6); cir(x, 5, 5, 3, '#ffd97a'); });
  SPR.dirt = mk(12, 12, x => { cir(x, 6, 6, 4, '#26202c'); });
  SPR.wisp = mk(20, 20, x => { glow(x, '#8dffb0', 8); cir(x, 10, 10, 5, 'rgba(141,255,176,0.7)'); });
  SPR.puff = mk(28, 28, x => { cir(x, 14, 14, 11, 'rgba(127,196,95,0.28)'); cir(x, 10, 10, 6, 'rgba(160,220,110,0.2)'); });
  SPR.ghostSpr = mk(48, 60, x => {
    x.globalAlpha = 0.6;
    x.beginPath();
    x.moveTo(24, 4);
    x.quadraticCurveTo(44, 10, 42, 40);
    x.quadraticCurveTo(38, 54, 30, 44);
    x.quadraticCurveTo(24, 58, 18, 44);
    x.quadraticCurveTo(10, 54, 6, 40);
    x.quadraticCurveTo(4, 10, 24, 4);
    x.closePath();
    x.fillStyle = 'rgba(200,220,255,0.35)'; x.fill();
    x.strokeStyle = 'rgba(230,240,255,0.5)'; x.lineWidth = 2; x.stroke();
    cir(x, 19, 20, 2.6, '#e8f0ff');
    cir(x, 29, 20, 2.6, '#e8f0ff');
  });

  SPR.moon = mk(340, 340, x => {
    glow(x, '#e86a55', 40);
    cir(x, 170, 170, 92, '#d8756a');
    noglow(x);
    cir(x, 170, 170, 92, null, 'rgba(255,190,170,0.6)', 3);
    cir(x, 140, 140, 16, 'rgba(160,70,60,0.5)');
    cir(x, 200, 175, 22, 'rgba(160,70,60,0.4)');
    cir(x, 155, 210, 12, 'rgba(160,70,60,0.45)');
    cir(x, 195, 128, 9, 'rgba(170,80,70,0.4)');
    cir(x, 250, 90, 5, 'rgba(255,220,200,0.8)');
    cir(x, 90, 250, 4, 'rgba(255,220,200,0.8)');
  });
  SPR.cloud = [0, 1, 2].map(v => mk(420, 160, x => {
    x.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      ell(x, 60 + i * 75 + v * 8, 90 + (i % 3) * 16, 66 - (i % 2) * 18, 30 - (i % 3) * 6, '#0a0a12');
    }
  }));
  SPR.fogB = mk(480, 480, x => {
    const g = x.createRadialGradient(240, 240, 30, 240, 240, 230);
    g.addColorStop(0, 'rgba(26,32,52,0.34)');
    g.addColorStop(0.7, 'rgba(26,32,52,0.14)');
    g.addColorStop(1, 'rgba(26,32,52,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 480, 480);
  });
  SPR.shadow = mk(72, 40, x => {
    const g = x.createRadialGradient(36, 20, 4, 36, 20, 32);
    g.addColorStop(0, 'rgba(0,0,0,0.42)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 72, 40);
  });
  SPR.groundPat = mk(256, 256, x => {
    x.fillStyle = '#0d0f16';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 420; i++) {
      const px = U.hash2(i, 7, 1) * 256, py = U.hash2(i, 13, 2) * 256;
      const s = U.hash2(i, 21, 3);
      x.fillStyle = s < 0.5 ? '#0f1119' : s < 0.8 ? '#0b0d13' : '#10131c';
      x.fillRect(px, py, 2 + s * 3, 2 + s * 3);
    }
    for (let i = 0; i < 26; i++) {
      const px = U.hash2(i, 31, 4) * 256, py = U.hash2(i, 39, 5) * 256;
      x.fillStyle = 'rgba(30,38,30,0.5)';
      x.fillRect(px, py, 8, 3);
    }
  });

  function plate(x, fn) {
    rct(x, 4, 4, 64, 64, '#171226', 12);
    rct(x, 4, 4, 64, 64, null);
    x.strokeStyle = '#4a3a6a'; x.lineWidth = 2;
    x.strokeRect(5, 5, 62, 62);
    fn(x);
  }
  SPR.iconSpear = mk(72, 72, x => plate(x, () => {
    x.save(); x.translate(36, 36); x.rotate(-0.7);
    seg(x, -18, 0, 10, 0, 5, bone);
    poly(x, [[10, 0], [20, -5], [24, 0], [20, 5]], '#b89aff');
    x.restore();
  }));
  SPR.iconScythe = mk(72, 72, x => plate(x, () => {
    seg(x, 30, 58, 30, 18, 4, '#7a5a3a');
    x.beginPath(); x.arc(30, 26, 22, -2.4, 0.2);
    x.strokeStyle = '#d8d2c0'; x.lineWidth = 6; x.stroke();
    glow(x, '#b89aff', 8);
    x.stroke();
    noglow(x);
  }));
  SPR.iconBolt = mk(72, 72, x => plate(x, () => {
    glow(x, '#8dffb0', 10);
    cir(x, 36, 36, 10, '#8dffb0');
    noglow(x);
    cir(x, 36, 36, 5, '#eafff0');
    cir(x, 36, 14, 4, '#d8d2c0');
    cir(x, 55, 40, 4, '#d8d2c0');
    cir(x, 17, 40, 4, '#d8d2c0');
  }));
  SPR.iconWraith = mk(72, 72, x => plate(x, () => {
    x.globalAlpha = 0.9;
    x.beginPath();
    x.moveTo(36, 12);
    x.quadraticCurveTo(54, 18, 52, 44);
    x.quadraticCurveTo(48, 56, 40, 46);
    x.quadraticCurveTo(36, 58, 32, 46);
    x.quadraticCurveTo(24, 56, 20, 44);
    x.quadraticCurveTo(18, 18, 36, 12);
    x.closePath();
    x.fillStyle = 'rgba(141,255,196,0.3)'; x.fill();
    x.strokeStyle = '#b9ffd6'; x.lineWidth = 2.4; x.stroke();
    cir(x, 31, 28, 3, '#0c2418');
    cir(x, 41, 28, 3, '#0c2418');
  }));
  SPR.iconMiasma = mk(72, 72, x => plate(x, () => {
    for (let i = 0; i < 5; i++) cir(x, 22 + i * 7, 40 + (i % 2) * 6, 9 - i, 'rgba(140,200,90,0.35)');
    cir(x, 36, 34, 9, bone);
    cir(x, 32.4, 33, 2.4, '#171226');
    cir(x, 39.6, 33, 2.4, '#171226');
    seg(x, 31, 41, 41, 41, 1.6, boneDD);
  }));
  SPR.iconZap = mk(72, 72, x => plate(x, () => {
    glow(x, '#d8b4ff', 10);
    poly(x, [[40, 8], [24, 38], [34, 38], [28, 64], [48, 30], [38, 30]], '#d8b4ff');
    noglow(x);
  }));
  SPR.iconBoots = mk(72, 72, x => plate(x, () => {
    rct(x, 26, 14, 14, 26, '#d8b45a', 4);
    poly(x, [[26, 40], [46, 40], [48, 52], [24, 52]], '#d8b45a');
    seg(x, 26, 22, 40, 22, 2, '#171226');
    glow(x, '#ffe8ae', 6);
    seg(x, 24, 52, 48, 52, 3, '#ffe8ae');
    noglow(x);
  }));
  SPR.iconSigil = mk(72, 72, x => plate(x, () => {
    x.beginPath();
    x.moveTo(36, 54);
    x.bezierCurveTo(20, 42, 18, 26, 28, 22);
    x.bezierCurveTo(33, 20.6, 36, 25, 36, 28);
    x.bezierCurveTo(36, 25, 39, 20.6, 44, 22);
    x.bezierCurveTo(54, 26, 52, 42, 36, 54);
    x.closePath();
    glow(x, '#ff5a6a', 10);
    x.fillStyle = '#ff6a78'; x.fill();
    noglow(x);
    cir(x, 36, 36, 26, null, 'rgba(255,106,120,0.5)', 2);
  }));
  SPR.iconMagnet = mk(72, 72, x => plate(x, () => {
    x.beginPath(); x.arc(36, 34, 16, Math.PI, 0);
    x.strokeStyle = '#b89aff'; x.lineWidth = 9; x.stroke();
    x.beginPath(); x.arc(36, 34, 16, Math.PI * 0.94, Math.PI * 1.06);
    x.strokeStyle = '#8a6d3a'; x.lineWidth = 9; x.stroke();
    rct(x, 14, 30, 10, 14, '#d8d2c0');
    rct(x, 48, 30, 10, 14, '#d8d2c0');
    glow(x, '#b89aff', 6);
    cir(x, 19, 46, 3, '#b89aff');
    cir(x, 53, 46, 3, '#b89aff');
    noglow(x);
  }));
  SPR.iconOccult = mk(72, 72, x => plate(x, () => {
    rct(x, 20, 16, 34, 44, '#3a2a50', 3);
    rct(x, 24, 20, 26, 36, '#241b38', 2);
    seg(x, 20, 22, 20, 58, 4, '#d8b45a');
    ell(x, 37, 38, 8, 5, '#0a0812');
    glow(x, '#d8b4ff', 8);
    cir(x, 37, 38, 2.6, '#d8b4ff');
    noglow(x);
  }));
  SPR.iconCursed = mk(72, 72, x => plate(x, () => {
    poly(x, [[18, 14], [10, 4], [26, 8]], '#d8b45a');
    poly(x, [[54, 14], [62, 4], [46, 8]], '#d8b45a');
    cir(x, 36, 32, 14, bone);
    cir(x, 30, 31, 3.6, '#171226');
    cir(x, 42, 31, 3.6, '#171226');
    poly(x, [[30, 44], [42, 44], [40, 48], [34, 48], [32, 52], [38, 52]], bone);
    glow(x, '#ff8a5e', 8);
    cir(x, 30, 31, 1.4, '#ff8a5e');
    cir(x, 42, 31, 1.4, '#ff8a5e');
    noglow(x);
  }));
  SPR.iconCraft = mk(72, 72, x => plate(x, () => {
    x.save(); x.translate(36, 38);
    seg(x, -16, -14, 14, 16, 4.4, '#7a5a3a');
    poly(x, [[12, 14], [24, 26], [18, 32], [6, 20]], '#8a93a2');
    x.restore();
    x.save(); x.translate(36, 38); x.rotate(-0.9);
    seg(x, -14, -10, 12, 10, 4, boneD);
    cir(x, 13, 11, 4, boneD);
    x.restore();
  }));
  SPR.iconEvolve = mk(72, 72, x => plate(x, () => {
    glow(x, '#ffd97a', 14);
    poly(x, [[16, 20], [16, 8], [26, 16], [36, 6], [46, 16], [56, 8], [56, 20]], '#ffd97a');
    noglow(x);
    cir(x, 36, 38, 13, bone);
    cir(x, 30, 37, 3.4, '#171226');
    cir(x, 42, 37, 3.4, '#171226');
    poly(x, [[29, 48], [43, 48], [41, 53], [34, 53], [32, 57], [38, 57]], bone);
    star(x, 36, 30, 4.4, 4, 0.4, '#fff2cc');
  }));
  SPR.iconHeart = mk(72, 72, x => plate(x, () => {
    x.beginPath();
    x.moveTo(36, 56);
    x.bezierCurveTo(18, 44, 16, 24, 28, 20);
    x.bezierCurveTo(33, 18.6, 36, 24, 36, 28);
    x.bezierCurveTo(36, 24, 39, 18.6, 44, 20);
    x.bezierCurveTo(56, 24, 54, 44, 36, 56);
    x.closePath();
    glow(x, '#ff5a6a', 12);
    x.fillStyle = '#ff6a78'; x.fill();
    noglow(x);
    cir(x, 28, 30, 3.4, '#ffd0d6');
  }));
  SPR.iconEss = mk(72, 72, x => plate(x, () => {
    glow(x, '#ffd97a', 12);
    cir(x, 36, 38, 12, '#ffd97a');
    noglow(x);
    cir(x, 36, 38, 6, '#fff8e0');
    star(x, 36, 16, 6, 4, 0.4, '#fff2cc');
    star(x, 58, 44, 4, 4, 0.4, '#fff2cc');
  }));
  SPR.iconAbility = mk(72, 72, x => plate(x, () => {
    cir(x, 36, 36, 24, null, '#8dffb0', 2.4);
    cir(x, 36, 36, 17, null, 'rgba(141,255,176,0.5)', 1.6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      seg(x, 36 + Math.cos(a) * 17, 36 + Math.sin(a) * 17, 36 + Math.cos(a) * 24, 36 + Math.sin(a) * 24, 2, '#8dffb0');
    }
    cir(x, 32, 32, 2.4, '#eafff0');
    cir(x, 40, 32, 2.4, '#eafff0');
    seg(x, 31, 44, 41, 44, 1.8, '#8dffb0');
  }));

  SPR.portNecro = mk(130, 160, x => {
    rct(x, 0, 0, 130, 160, '#141021');
    x.drawImage(SPR.player[0], 0, 0, 72, 90, 29, 48, 72, 90);
    seg(x, 10, 150, 120, 150, 2, '#2c2145');
    glow(x, '#c07bff', 16);
    cir(x, 65, 24, 20, 'rgba(192,123,255,0.16)');
    noglow(x);
  });
  SPR.portDoctor = mk(130, 160, x => {
    rct(x, 0, 0, 130, 160, '#0f1410');
    poly(x, [[65, 20], [108, 60], [112, 130], [65, 150], [18, 130], [22, 60]], '#1a1d18');
    poly(x, [[65, 20], [108, 60], [100, 84], [30, 84], [22, 60]], '#242a20');
    poly(x, [[30, 16], [100, 16], [65, 44]], '#101208');
    poly(x, [[24, 20], [106, 20], [110, 28], [20, 28]], '#101208');
    poly(x, [[65, 40], [100, 72], [65, 96], [30, 72]], '#d8d2c0');
    poly(x, [[65, 44], [92, 72], [65, 90], [38, 72]], '#e8e2d0');
    cir(x, 56, 70, 4.4, '#151810');
    cir(x, 74, 70, 4.4, '#151810');
    glow(x, '#ff5540', 8);
    cir(x, 56, 70, 2, '#ff7a5e');
    cir(x, 74, 70, 2, '#ff7a5e');
    noglow(x);
    seg(x, 96, 80, 108, 130, 5, '#3a3630');
    glow(x, '#8dffb0', 14);
    cir(x, 98, 74, 8, '#8dffb0');
    noglow(x);
    cir(x, 98, 74, 3.4, '#eafff0');
  });
  SPR.portWitch = mk(130, 160, x => {
    rct(x, 0, 0, 130, 160, '#120f1a');
    poly(x, [[65, 34], [104, 72], [108, 138], [65, 152], [22, 138], [26, 72]], '#221533');
    poly(x, [[65, 34], [104, 72], [98, 96], [32, 96], [26, 72]], '#2c1c42');
    seg(x, 30, 52, 100, 58, 2.6, 'rgba(180,120,255,0.4)');
    poly(x, [[65, 10], [86, 34], [65, 40], [44, 34]], '#0c0a12');
    poly(x, [[36, 30], [94, 30], [94, 40], [36, 40]], '#0c0a12');
    cir(x, 65, 46, 14, '#cfc4b4');
    ell(x, 65, 50, 8, 8.4, '#d8d2c0');
    glow(x, '#d8b4ff', 10);
    cir(x, 59, 48, 2.4, '#d8b4ff');
    cir(x, 71, 48, 2.4, '#d8b4ff');
    noglow(x);
    for (let i = 0; i < 4; i++) poly(x, [[40 + i * 16, 30], [48 + i * 16, 12 + i * 3], [54 + i * 16, 32]], '#2c1c42');
    seg(x, 100, 70, 112, 128, 4, '#4a3a28');
    glow(x, '#d8b4ff', 14);
    cir(x, 102, 62, 8, '#d8b4ff');
    noglow(x);
    cir(x, 102, 62, 3.4, '#f4ecff');
  });

  SPR.heartFlash = whiteOf(SPR.heart);

  const ekeys = ['penitent', 'acolyte', 'hunter', 'crusader', 'hound', 'elite', 'champ', 'seraph'];
  SPR.flash = {};
  ekeys.forEach(k => { SPR.flash[k] = whiteOf(SPR[k]); });
})();
