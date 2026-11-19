'use strict';
function hash(n) { const h = Math.sin(n) * 43758.5453; return h - Math.floor(h); }
function polyPath(n, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < n; i++) { const a = rot + i * TAU / n, x = Math.cos(a) * r, y = Math.sin(a) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath();
}

function updateAmbient(dt) {
  for (const a of ambient) {
    a.x += a.vx * dt; a.y += a.vy * dt;
    if (a.y < -20) { a.y = H + 20; a.x = rand(0, W); }
    if (a.x < -20) a.x = W + 20;
    if (a.x > W + 20) a.x = -20;
  }
  const menu = ['title', 'shop', 'char', 'ach', 'help', 'settings'];
  if (menu.indexOf(scene) >= 0) { cam.x = Math.sin(now() * 0.11) * 70; cam.y = Math.cos(now() * 0.09) * 70; }
}

function drawBackground() {
  const ph = phase(), t = now();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, ph.bg); g.addColorStop(1, '#02030a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const nx = W * (0.18 + 0.32 * i) + Math.sin(t * 0.05 + i) * W * 0.12;
    const ny = H * (0.3 + 0.2 * ((i * 2) % 3)) + Math.cos(t * 0.04 + i) * H * 0.1;
    glow(ph.neb[i % 2], nx, ny, Math.max(W, H) * 0.5, 0.14);
  }
  ctx.fillStyle = '#cfe6ff';
  for (const s of stars) {
    const px = ((s.x * W - cam.x * s.z * 0.03) % W + W) % W;
    const py = ((s.y * H - cam.y * s.z * 0.03) % H + H) % H;
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.tw);
    ctx.globalAlpha = (0.18 + 0.42 * tw) * s.z;
    ctx.fillRect(px, py, s.r, s.r);
  }
  ctx.globalAlpha = 1;
  for (const a of ambient) {
    const px = ((a.x - cam.x * 0.04) % (W + 40) + (W + 40)) % (W + 40);
    const py = ((a.y - cam.y * 0.04) % (H + 40) + (H + 40)) % (H + 40);
    glow(activeAccent(), px, py, a.r * 3.2, a.a * 0.45);
  }
  const menu = ['title', 'shop', 'char', 'ach', 'help', 'settings'];
  if (menu.indexOf(scene) >= 0) {
    const pulse = 1 + 0.06 * Math.sin(t * 1.5);
    glow(activeAccent(), W / 2, H * 0.42, 200 * pulse, 0.22);
    glow('#ffffff', W / 2, H * 0.42, 66 * pulse, 0.16);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function drawGrid() {
  const ph = phase(), step = 64;
  ctx.strokeStyle = ph.grid; ctx.lineWidth = 1;
  const left = cam.x - W / 2 - 64, right = cam.x + W / 2 + 64;
  const top = cam.y - H / 2 - 64, bottom = cam.y + H / 2 + 64;
  ctx.beginPath();
  for (let x = Math.floor(left / step) * step; x < right; x += step) { ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
  for (let y = Math.floor(top / step) * step; y < bottom; y += step) { ctx.moveTo(left, y); ctx.lineTo(right, y); }
  ctx.stroke();
}

function drawRing(r) {
  const a = clamp(r.life * 1.6, 0, 1) * 0.65;
  ctx.globalAlpha = a; ctx.strokeStyle = r.color; ctx.lineWidth = r.width;
  ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  ctx.globalAlpha = a * 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, r.width * 0.15);
  ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawArc(a) {
  const dx = a.x2 - a.x1, dy = a.y2 - a.y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const al = clamp(a.life * 7, 0, 1);
  ctx.globalAlpha = al * 0.9; ctx.strokeStyle = a.color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(a.x1, a.y1);
  for (let i = 1; i < 7; i++) { const t = i / 7, off = (hash(a.seed + i * 3.7) * 2 - 1) * 18; ctx.lineTo(a.x1 + dx * t + nx * off, a.y1 + dy * t + ny * off); }
  ctx.lineTo(a.x2, a.y2); ctx.stroke();
  ctx.globalAlpha = al * 0.85; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawProjectile(pr) {
  for (const tr of pr.trail) glow(pr.color, tr.x, tr.y, pr.r * 1.4, 0.12);
  glow(pr.color, pr.x, pr.y, pr.r * 3, 0.85);
  glow('#ffffff', pr.x, pr.y, pr.r * 0.9, 0.9);
}
function drawParticle(q) { const a = clamp(q.life / q.max, 0, 1); glow(q.color, q.x, q.y, q.r * 2.2, a * 0.8); }
function drawPickupGlow(g) { glow(g.color, g.x, g.y, g.r * 2.6, 0.75 + 0.2 * Math.sin(g.t)); }
function drawPickupShape(g) {
  ctx.save(); ctx.translate(g.x, g.y);
  ctx.strokeStyle = g.color; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(6,10,24,0.6)';
  if (g.type === 'gem') { polyPath(4, g.r, Math.PI / 4); ctx.fill(); ctx.stroke(); }
  else if (g.type === 'chest') { ctx.beginPath(); ctx.rect(-g.r, -g.r * 0.7, g.r * 2, g.r * 1.4); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-g.r, -g.r * 0.2); ctx.lineTo(g.r, -g.r * 0.2); ctx.stroke(); glow('#ffffff', 0, 0, 6, 0.8); }
  else { ctx.beginPath(); ctx.arc(0, 0, g.r * 0.8, 0, TAU); ctx.fill(); ctx.stroke(); }
  if (g.type === 'heart') { ctx.fillStyle = g.color; ctx.fillRect(-1.5, -5, 3, 10); ctx.fillRect(-5, -1.5, 10, 3); }
  if (g.type === 'bomb') { ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.moveTo(4, -4); ctx.lineTo(-4, 4); ctx.stroke(); }
  if (g.type === 'magnet') { ctx.beginPath(); ctx.arc(0, 0, 4, Math.PI, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawEnemyGlow(e) {
  glow(e.color, e.x, e.y, e.r * (e.boss ? 3.4 : 2.6), e.boss ? 0.95 : 0.5);
  if (e.flash > 0) glow('#ffffff', e.x, e.y, e.r * 2.2, Math.min(1, e.flash * 5));
  if (e.elite || e.boss) glow(e.color, e.x, e.y, e.r * 1.6, 0.35 + 0.2 * Math.sin(now() * 4));
}
function drawEnemyShape(e) {
  ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
  ctx.strokeStyle = e.color; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(5,8,18,0.62)';
  let n = 4, r = e.r, rot = 0;
  if (e.type === 'mote') { n = 3; r = e.r; }
  else if (e.type === 'dart') { n = 3; r = e.r * 1.4; }
  else if (e.type === 'brute') { n = 6; r = e.r; }
  else if (e.type === 'spinner') { n = 4; r = e.r; }
  else if (e.type === 'shooter') { n = 4; r = e.r; rot = Math.PI / 4; }
  else if (e.type === 'wisp') { n = 7; r = e.r; }
  else if (e.elite) { n = 8; r = e.r; }
  else if (e.boss) { n = 10; r = e.r; }
  if (e.type === 'wisp') { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); }
  else polyPath(n, r, rot);
  ctx.fill(); ctx.stroke();
  ctx.restore();
  if (e.boss) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(-e.angle * 0.6);
    ctx.strokeStyle = e.color; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
    polyPath(6, e.r * 1.45, 0); ctx.stroke();
    ctx.globalAlpha = 1; ctx.restore();
    glow('#ffffff', e.x, e.y, e.r * 0.5, 0.9);
    glow('#ff2d55', e.x, e.y, e.r * 0.28, 0.9);
  }
  if (e.elite || e.boss) {
    const w = e.r * 2, hpf = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
    ctx.fillStyle = e.color; ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * hpf, 4);
  }
}

function drawPlayerGlow() {
  const p = G.p, c = playerColor();
  for (let i = 0; i < p.trail.length; i++) { const t = p.trail[i], f = (i + 1) / p.trail.length; glow(c, t.x, t.y, 7 * f + 2, 0.05 * f); }
  if (p.dashTimer > 0) glow('#ffffff', p.x, p.y, 34, 0.5);
  for (const w of p.weapons) {
    const def = WEAPONS[w.id], s = ws(w);
    if (def.type === 'orbit' && w._orbs) for (const o of w._orbs) { glow(def.color, o.x, o.y, 15, 0.9); glow('#ffffff', o.x, o.y, 5, 0.9); }
    if (def.type === 'aura') { ctx.strokeStyle = def.color; ctx.globalAlpha = 0.22; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, s.radius, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; glow(def.color, p.x, p.y, s.radius, 0.045); }
  }
  glow(c, p.x, p.y, 28, 0.9);
  glow('#ffffff', p.x, p.y, 11, 0.9);
}
function drawPlayerShape() {
  const p = G.p, c = playerColor();
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.facing + Math.PI / 2);
  polyPath(4, CFG.playerR + 3, 0);
  ctx.fillStyle = 'rgba(6,10,24,0.7)'; ctx.fill();
  ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(now() * 1.4);
  ctx.strokeStyle = c; ctx.globalAlpha = p.invuln > 0 ? 0.35 + 0.4 * Math.sin(now() * 24) : 0.55; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, CFG.playerR + 9, 0, TAU * 0.72); ctx.stroke();
  ctx.globalAlpha = 1; ctx.restore();
}
function drawFloater(f) {
  const a = clamp(f.life / f.max, 0, 1);
  ctx.globalAlpha = a; ctx.textAlign = 'center';
  ctx.font = (f.big ? '900 22px ' : '800 13px ') + '"Segoe UI",Arial,sans-serif';
  ctx.shadowColor = f.color; ctx.shadowBlur = 14;
  ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

function drawGlowPass() {
  for (const r of G.rings) drawRing(r);
  for (const a of G.arcs) drawArc(a);
  for (const g of G.pickups) drawPickupGlow(g);
  for (const e of G.enemies) if (!e.dead) drawEnemyGlow(e);
  for (const pr of G.projectiles) drawProjectile(pr);
  for (const q of G.particles) drawParticle(q);
  drawPlayerGlow();
}
function drawOutlinePass() {
  for (const g of G.pickups) drawPickupShape(g);
  for (const e of G.enemies) if (!e.dead) drawEnemyShape(e);
  drawPlayerShape();
  for (const f of G.floaters) drawFloater(f);
}
function drawForeground() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  if (G && G.active && G.p.hp / G.p.maxHp < 0.3) {
    ctx.globalAlpha = 0.05 + 0.045 * Math.sin(now() * 7);
    ctx.fillStyle = '#ff1440'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
  if (effects.flash > 0) {
    ctx.globalAlpha = Math.min(1, effects.flash);
    ctx.fillStyle = effects.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  }
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground();
  let sx = 0, sy = 0;
  if (effects.shake > 0.2 && Save.data.settings.shake && !Save.data.settings.reduced) {
    sx = rand(-effects.shake, effects.shake); sy = rand(-effects.shake, effects.shake);
  }
  ctx.save();
  ctx.translate(W / 2 - cam.x + sx, H / 2 - cam.y + sy);
  drawGrid();
  if (G) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlowPass();
    ctx.globalCompositeOperation = 'source-over';
    drawOutlinePass();
  }
  ctx.restore();
  drawForeground();
  if (G) updateHUD();
}

function updateHUD() {
  const p = G.p;
  $('hpFill').style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
  $('hpText').textContent = Math.max(0, Math.ceil(p.hp)) + ' / ' + p.maxHp;
  $('xpFill').style.width = clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
  $('lvlText').textContent = 'LV ' + p.level;
  $('timeText').textContent = fmtTime(G.time);
  $('phaseText').textContent = phase().name;
  $('killsText').textContent = fmtNum(G.kills);
  $('scoreText').textContent = fmtNum(G.score);
  $('comboMult').textContent = 'x' + p.comboMult.toFixed(1);
  $('comboFill').style.width = clamp(p.combo / 60 * 100, 0, 100) + '%';
  const ready = p.od >= 100;
  $('odFill').style.width = p.od + '%';
  $('odBox').classList.toggle('ready', ready);
  const nb = $('novaBtn');
  if (isTouch && scene === 'play') nb.style.display = 'flex';
  nb.classList.toggle('ready', ready);
  if (G.boss && !G.boss.dead) {
    $('bossWrap').classList.remove('hidden');
    $('bossFill').style.width = clamp(G.boss.hp / G.boss.maxHp * 100, 0, 100) + '%';
    $('bossName').textContent = G.boss.name;
  } else $('bossWrap').classList.add('hidden');
}
function renderWeaponBar() {
  const wb = $('weaponBar'); wb.innerHTML = '';
  for (const w of G.p.weapons) {
    const d = WEAPONS[w.id], el = document.createElement('div');
    el.className = 'wchip' + (w.evo ? ' evo' : '');
    el.style.color = d.color; el.style.borderColor = d.color; el.style.boxShadow = '0 0 12px ' + d.color + '55';
    el.innerHTML = d.tag + '<span class="lvl">' + w.level + '</span>';
    wb.appendChild(el);
  }
  const pb = $('passiveBar'); pb.innerHTML = '';
  for (const id in G.p.passives) {
    const lv = G.p.passives[id]; if (lv <= 0) continue;
    const d = PASSIVES[id], el = document.createElement('div');
    el.className = 'pchip'; el.style.color = d.color; el.title = d.name + ' · LV ' + lv;
    el.innerHTML = d.tag.slice(0, 2) + '<b>' + lv + '</b>';
    pb.appendChild(el);
  }
}
