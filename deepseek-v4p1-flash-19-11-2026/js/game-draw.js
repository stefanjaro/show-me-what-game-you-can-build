import {
  TAU, clamp, lerp, rand, pick, easeOutCubic, rgba,
} from './util.js';
import { COLORS } from './data.js';
import {
  glowSprite, drawGlow, shapePath, starPath, polyPath, lightning,
} from './render.js';

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.7);
  ctx.bezierCurveTo(x - s * 1.25, y - s * 0.1, x - s * 0.6, y - s, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.25, y - s * 0.1, x, y + s * 0.7);
  ctx.closePath();
}

export const drawMethods = {

  render(rawDt) {
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const showWorld = ['running', 'paused', 'levelup', 'dying', 'dead'].includes(this.state);
    this.bg.draw(ctx, this.time, {
      menu: !showWorld,
      mouseX: this.mouse.x,
      mouseY: this.mouse.y,
    });

    if (!showWorld) {
      this.drawFireflies(ctx);
      this.drawMenuFlare(ctx);
      return;
    }

    ctx.save();
    if (this.shake > 0.2 && this.save.settings.shake && (this.state === 'running' || this.state === 'dying')) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
    }
    this.drawZones(ctx);
    this.drawMotes(ctx);
    this.drawHearts(ctx);
    this.drawEnemies(ctx);
    this.drawBullets(ctx);
    if (!this.player.dead) this.drawPlayer(ctx);
    this.drawEnemyBullets(ctx);
    this.drawParticles(ctx);
    ctx.restore();

    if (this.bossRef && !this.bossRef.dead) {
      const e = this.bossRef;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, rgba(e.color, 0));
      g.addColorStop(1, rgba(e.color, 0.06 + 0.03 * Math.sin(this.time * 2)));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state === 'running' && this.player.hp <= 2 && !this.player.dead) {
      const a = 0.1 + 0.05 * Math.sin(this.time * 4);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, 'rgba(255,60,80,0)');
      g.addColorStop(1, `rgba(255,40,70,${a.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.flashA > 0.003) {
      ctx.fillStyle = rgba(this.flashColor, Math.min(0.6, this.flashA));
      ctx.fillRect(0, 0, W, H);
    }

    if (this.state === 'running' && this.isTouch) this.drawTouchSticks(ctx);
  },

  drawMenuFlare(ctx) {
    const W = this.W, H = this.H;
    const g = ctx.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, Math.min(W, H) * 0.22);
    g.addColorStop(0, 'rgba(90,190,220,0.035)');
    g.addColorStop(1, 'rgba(90,190,220,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  },

  drawFireflies(ctx) {
    if (!this.fireflies) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const a = clamp(f.life / 6, 0, 1) * (0.35 + 0.25 * Math.sin(this.time * 2 + f.hue));
      const color = f.hue > 3.14 ? COLORS.gold : COLORS.cyan;
      drawGlow(ctx, color, f.x, f.y, f.r * 5, a * 0.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = color;
      ctx.fillRect(f.x - 0.7, f.y - 0.7, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  },

  drawTouchSticks(ctx) {
    const t = this.touch;
    const draw = (start, vec, color) => {
      const len = Math.hypot(vec.x, vec.y);
      const m = Math.min(1, len / 55);
      const dx = len > 0 ? (vec.x / len) * 38 * m : 0;
      const dy = len > 0 ? (vec.y / len) * 38 * m : 0;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(start.x, start.y, 46, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(start.x, start.y, 46, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(start.x + dx, start.y + dy, 18, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    if (t.moveId !== null) draw(t.moveStart, t.moveVec, COLORS.cyan);
    if (t.aimId !== null) draw(t.aimStart, t.aimVec, COLORS.gold);
  },

  // ============================================================
  // zones & pickups
  // ============================================================
  drawZones(ctx) {
    for (const z of this.zones) {
      const k = z.life / z.maxLife;
      const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      g.addColorStop(0, rgba(COLORS.gold, 0.12 * k));
      g.addColorStop(0.6, rgba(COLORS.orange, 0.06 * k));
      g.addColorStop(1, rgba(COLORS.gold, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(COLORS.gold, 0.3 * k);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 10]);
      ctx.lineDashOffset = -this.time * 30;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r * (0.85 + 0.05 * Math.sin(this.time * 4)), 0, TAU);
      ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 2; i++) {
        const a = this.time * 0.6 + i * Math.PI;
        drawGlow(ctx, COLORS.gold, z.x + Math.cos(a) * z.r * 0.4, z.y + Math.sin(a) * z.r * 0.4, 22, 0.2 * k);
      }
    }
  },

  drawMotes(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const pulse = 0.75 + 0.25 * Math.sin(m.phase);
      drawGlow(ctx, COLORS.gold, m.x, m.y, m.r * 4.2, 0.38 * pulse);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(m.phase * 0.8);
      ctx.fillStyle = '#fff6d8';
      const s = m.r * (0.65 + 0.1 * pulse);
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.5);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s * 1.5);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  drawHearts(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const h of this.hearts) {
      const pulse = 1 + 0.12 * Math.sin(h.phase * 2);
      drawGlow(ctx, COLORS.rose, h.x, h.y, h.r * 3.6, 0.42);
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.scale(pulse, pulse);
      heartPath(ctx, 0, 0, h.r * 0.85);
      ctx.fillStyle = 'rgba(255,130,170,0.95)';
      ctx.fill();
      ctx.strokeStyle = '#ffe1ec';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  // ============================================================
  // enemies
  // ============================================================
  drawEnemies(ctx) {
    const normal = [];
    const bosses = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.isBoss) bosses.push(e); else normal.push(e);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of normal) {
      drawGlow(ctx, e.color, e.x, e.y, e.r * (e.elite ? 4.4 : 3.4), e.elite ? 0.34 : 0.23);
      if (e.burnT > 0) drawGlow(ctx, COLORS.orange, e.x, e.y, e.r * 3.4, 0.2);
      if (e.slowAmt > 0) drawGlow(ctx, COLORS.cyan, e.x, e.y, e.r * 2.6, 0.14);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
    for (const e of normal) this.drawEnemy(ctx, e);
    for (const e of bosses) this.drawBoss(ctx, e);
  },

  drawEnemy(ctx, e) {
    ctx.save();
    if (e.beamT > 0) {
      ctx.save();
      const ready = e.beamT < 0.3;
      ctx.strokeStyle = ready ? 'rgba(220,240,255,.85)' : 'rgba(190,215,255,.28)';
      ctx.lineWidth = ready ? 1.6 : 1;
      ctx.setLineDash(ready ? [] : [6, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.beamAngle) * 1400, e.y + Math.sin(e.beamAngle) * 1400);
      ctx.stroke();
      ctx.restore();
    }

    if (e.stage === 'wind') {
      ctx.globalCompositeOperation = 'lighter';
      const k = 1 - e.stageT / 0.42;
      ctx.strokeStyle = rgba(e.color, 0.35 + k * 0.45);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (1.6 + k * 1.4), 0, TAU);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.behavior === 'darter' && e.stage === 'dash') ctx.rotate(Math.atan2(e.vy, e.vx) + Math.PI / 2);
    else ctx.rotate(e.rot);
    const scale = e.stage === 'wind' ? 1 + 0.15 * Math.sin(this.time * 30) : 1;
    ctx.scale(scale, scale);
    shapePath(ctx, e.shape, 0, 0, e.r, 0);
    ctx.fillStyle = e.flash > 0.04 ? 'rgba(255,255,255,0.75)' : 'rgba(5,7,14,0.9)';
    ctx.fill();
    ctx.strokeStyle = e.flash > 0.04 ? '#ffffff' : e.color;
    ctx.lineWidth = e.elite ? 2.4 : 1.8;
    ctx.stroke();
    if (e.shape === 'ringed') {
      ctx.strokeStyle = e.flash > 0.04 ? '#ffffff' : rgba(e.color, 0.8);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.68, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = e.color;
      const oa = this.time * 3 + e.seed;
      ctx.beginPath();
      ctx.arc(Math.cos(oa) * e.r * 0.95, Math.sin(oa) * e.r * 0.95, e.r * 0.2, 0, TAU);
      ctx.fill();
    }
    if (e.behavior === 'darter' && e.stage === 'dash') {
      ctx.strokeStyle = rgba(e.color, 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.5, Math.PI * 0.6, Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.fillStyle = e.flash > 0.04 ? '#ffffff' : e.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.28, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.1, 0, TAU);
    ctx.fill();
    if (e.type === 'splitter') {
      ctx.strokeStyle = rgba(e.color, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.55, 0);
      ctx.lineTo(e.r * 0.55, 0);
      ctx.stroke();
    }
    if (e.elite) {
      ctx.strokeStyle = rgba(COLORS.gold, 0.6);
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.45, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    if ((e.elite || e.maxHp > 120) && e.hp < e.maxHp) {
      const w = e.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 3);
      ctx.fillStyle = e.elite ? COLORS.gold : e.color;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
    ctx.restore();
  },

  drawBoss(ctx, e) {
    const intro = e.introT > 0;
    const alpha = intro ? clamp(1 - e.introT / 1.9, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, e.color, e.x, e.y, e.r * 3.2, 0.3 + (e.enraged ? 0.1 : 0));
    ctx.globalCompositeOperation = 'source-over';

    if (intro) {
      ctx.strokeStyle = rgba(e.color, 0.4);
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 12]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (1.8 + 0.3 * Math.sin(this.time * 3)), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (e.bossType === 0) this.drawChoir(ctx, e);
    else if (e.bossType === 1) this.drawSeraph(ctx, e);
    else this.drawDevourer(ctx, e);

    if (e.hp < e.maxHp * 0.5 && !e.enraged) {
      ctx.strokeStyle = rgba(COLORS.gold, 0.4);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 1.35, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawChoir(ctx, e) {
    const flash = e.flash > 0.04;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot * 0.6);
    ctx.strokeStyle = flash ? '#ffffff' : rgba(e.color, 0.65);
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, e.r * (1.02 + i * 0.13), i * 1.4, i * 1.4 + 1.9);
      ctx.stroke();
    }
    ctx.rotate(-e.rot * 1.4);
    ctx.strokeStyle = rgba(e.color, 0.35);
    ctx.setLineDash([2, 9]);
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.35, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      const r0 = e.r * 1.02;
      const r1 = e.r * (1.26 + 0.08 * Math.sin(this.time * 2 + i));
      ctx.strokeStyle = rgba(e.color, 0.45);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(e.x, e.y);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r * 0.8);
    g.addColorStop(0, flash ? '#ffffff' : 'rgba(3,4,10,0.98)');
    g.addColorStop(0.7, flash ? '#ffffff' : 'rgba(10,6,18,0.98)');
    g.addColorStop(1, flash ? '#ffffff' : rgba(e.color, 0.22));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = flash ? '#ffffff' : rgba(e.color, 0.85);
    ctx.lineWidth = 2;
    ctx.stroke();

    const a = Math.atan2(this.player.y - e.y, this.player.x - e.x);
    ctx.save();
    ctx.rotate(a);
    ctx.strokeStyle = flash ? '#ffffff' : e.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(e.r * 0.22, 0, e.r * 0.4, e.r * 0.24, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : COLORS.white;
    ctx.beginPath();
    ctx.arc(e.r * 0.36, 0, e.r * 0.14, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (let i = 0; i < 3; i++) {
      const oa = this.time * 0.9 + i * TAU / 3;
      const ox = Math.cos(oa) * e.r * 1.5;
      const oy = Math.sin(oa) * e.r * 1.5;
      drawGlow(ctx, e.color, ox, oy, e.r * 0.16, 0.7);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(ox, oy, e.r * 0.05, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  drawSeraph(ctx, e) {
    const flash = e.flash > 0.04;
    const wing = Math.sin(this.time * 3) * 0.14;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot * 0.2);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(side, 1);
      ctx.rotate(wing * side);
      ctx.strokeStyle = flash ? '#ffffff' : rgba(e.color, 0.68);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(e.r * 0.25, -e.r * 0.25);
      ctx.quadraticCurveTo(e.r * 1.45, -e.r * 1.25, e.r * 2.3, -e.r * 0.32);
      ctx.quadraticCurveTo(e.r * 1.5, -e.r * 0.1, e.r * 0.3, e.r * 0.2);
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = rgba(e.color, 0.26);
      ctx.lineWidth = 1;
      for (let i = 1; i <= 5; i++) {
        const t = i / 6;
        const x = e.r * (0.42 + t * 1.7);
        const y = -e.r * (0.18 + t * 0.72);
        ctx.beginPath();
        ctx.moveTo(x, y + e.r * 0.18);
        ctx.lineTo(x + e.r * 0.16, y - e.r * 0.24);
        ctx.stroke();
        ctx.fillStyle = rgba(e.color, 0.5);
        ctx.beginPath();
        ctx.arc(x + e.r * 0.18, y - e.r * 0.24, 1.4, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = rgba(e.color, 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 2.1, 0, TAU);
    ctx.fill();
    ctx.rotate(e.rot * 1.4);
    polyPath(ctx, 0, 0, e.r * 0.82, 4, Math.PI / 4);
    ctx.fillStyle = flash ? '#ffffff' : 'rgba(10,6,12,0.94)';
    ctx.fill();
    ctx.strokeStyle = flash ? '#ffffff' : e.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.rotate(-e.rot * 2.2);
    polyPath(ctx, 0, 0, e.r * 0.55, 4, Math.PI / 4);
    ctx.strokeStyle = rgba(e.color, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.3, 0, TAU);
    ctx.strokeStyle = rgba(e.color, 0.8);
    ctx.stroke();
    ctx.save();
    ctx.rotate(-e.rot * 1.4 - this.time * 0.6);
    ctx.strokeStyle = flash ? '#ffffff' : e.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r * 0.28, e.r * 0.12, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = flash ? '#ffffff' : COLORS.white;
    ctx.beginPath();
    ctx.arc(e.r * 0.06, 0, e.r * 0.09, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = rgba(e.color, 0.28);
    ctx.setLineDash([2, 12]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 1.55, this.time, this.time + TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  drawDevourer(ctx, e) {
    const flash = e.flash > 0.04;
    ctx.save();
    ctx.translate(e.x, e.y);
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(e.rot * (0.5 + i * 0.45) + i * 2.1);
      ctx.strokeStyle = rgba(i === 1 ? COLORS.rose : e.color, 0.32 + i * 0.1);
      ctx.lineWidth = 1.8 - i * 0.3;
      ctx.beginPath();
      ctx.ellipse(0, 0, e.r * (1.25 + i * 0.16), e.r * (0.5 + i * 0.08), i * 0.25, 0, TAU * 0.72);
      ctx.stroke();
      ctx.restore();
    }
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, e.r);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.66, '#020106');
    g.addColorStop(0.86, flash ? '#ffffff' : rgba(e.color, 0.35));
    g.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 1.05, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = flash ? '#ffffff' : rgba(e.color, 0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, e.r * 0.72, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = this.time * (0.3 + (i % 3) * 0.12) + i * TAU / 14;
      const r = e.r * (0.95 + (i % 4) * 0.09);
      ctx.fillStyle = rgba(i % 2 ? COLORS.violet : e.color, 0.7);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 0.62, 1.4 + (i % 3), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    const pull = ctx.createRadialGradient(e.x, e.y, e.r, e.x, e.y, e.r * 3);
    pull.addColorStop(0, rgba(e.color, 0.09));
    pull.addColorStop(1, rgba(e.color, 0));
    ctx.fillStyle = pull;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 3, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },

  // ============================================================
  // player & bullets
  // ============================================================
  drawPlayer(ctx) {
    const p = this.player;
    const s = this.S;
    const flicker = p.iframes > 0 && Math.floor(this.time * 22) % 2 === 0;
    if (flicker) return;

    // trail
    if (p.trail.length > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 1; i < p.trail.length; i++) {
        const a = i / p.trail.length;
        const t0 = p.trail[i - 1], t1 = p.trail[i];
        ctx.strokeStyle = rgba(COLORS.cyan, a * 0.16);
        ctx.lineWidth = a * 4 * s;
        ctx.beginPath();
        ctx.moveTo(t0.x, t0.y);
        ctx.lineTo(t1.x, t1.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, COLORS.cyan, p.x, p.y, 38 * s, 0.35);
    drawGlow(ctx, COLORS.gold, p.x, p.y, 16 * s, 0.4);
    ctx.globalCompositeOperation = 'source-over';

    const pulse = 1 + 0.06 * Math.sin(this.time * 5);
    ctx.translate(p.x, p.y);
    ctx.rotate(this.time * 1.4);
    ctx.scale(pulse, pulse);
    starPath(ctx, 0, 0, 12 * s, 4.2 * s, 4, 0);
    ctx.fillStyle = 'rgba(255,252,235,0.98)';
    ctx.fill();
    ctx.strokeStyle = rgba(COLORS.cyan, 0.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x, p.y);
    const aim = p.aim;
    ctx.rotate(aim);
    ctx.fillStyle = rgba(COLORS.cyan, 0.5);
    ctx.beginPath();
    ctx.moveTo(15 * s, 0);
    ctx.lineTo(8 * s, -3.2 * s);
    ctx.lineTo(8 * s, 3.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // focus ring
    const focusR = 23 * s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(COLORS.cyan, 0.16);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, focusR, 0, TAU);
    ctx.stroke();
    if (p.focus > 0) {
      const ready = p.focus >= 100;
      const col = ready ? COLORS.gold : COLORS.cyan;
      ctx.strokeStyle = rgba(col, ready ? 0.95 : 0.7);
      ctx.lineWidth = ready ? 2.6 : 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, focusR, -Math.PI / 2, -Math.PI / 2 + (p.focus / 100) * TAU);
      ctx.stroke();
      if (ready) {
        const a = 0.25 + 0.15 * Math.sin(this.time * 6);
        drawGlow(ctx, COLORS.gold, p.x, p.y, 34 * s, a);
      }
    }
    ctx.restore();

    // shields
    if (p.shield > 0) {
      ctx.save();
      ctx.strokeStyle = rgba(COLORS.cyan, 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30 * s, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < p.shield; i++) {
        const a = this.time * 1.5 + (i / p.shield) * TAU;
        drawGlow(ctx, COLORS.cyan, p.x + Math.cos(a) * 30 * s, p.y + Math.sin(a) * 30 * s, 7 * s, 0.8);
      }
      ctx.restore();
    }

    // orbital blades
    for (let i = 0; i < this.stats.orbit; i++) {
      const a = p.orbitAngle + (i / this.stats.orbit) * TAU;
      const bx = p.x + Math.cos(a) * 68 * s;
      const by = p.y + Math.sin(a) * 68 * s;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + this.time * 3);
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, COLORS.violet, 0, 0, 13 * s, 0.5);
      ctx.strokeStyle = '#e5e0ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, 7 * s, 0.4, 2.6);
      ctx.stroke();
      ctx.restore();
    }

    // companions
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const c of this.companions) {
      drawGlow(ctx, COLORS.gold, c.x, c.y, 12 * s, 0.65);
      ctx.fillStyle = '#fff6d8';
      starPath(ctx, c.x, c.y, 5 * s, 1.8 * s, 4, this.time * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(COLORS.gold, 0.6);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9 * s, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    if (p.reviveGlow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(COLORS.gold, clamp(p.reviveGlow / 2, 0, 1) * 0.6);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (34 + (2 - p.reviveGlow) * 40) * s, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  },

  drawBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const s = this.S;
      drawGlow(ctx, b.color, b.x, b.y, b.r * 5, b.crit ? 0.65 : 0.4);
      if (b.shape === 'spear') {
        const a = Math.atan2(b.vy, b.vx);
        ctx.strokeStyle = rgba(b.color, 0.85);
        ctx.lineWidth = b.r * 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(a) * 34 * s, b.y - Math.sin(a) * 34 * s);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = b.r * 0.5;
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(a) * 30 * s, b.y - Math.sin(a) * 30 * s);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if (b.shape === 'chakram') {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        ctx.strokeStyle = '#efeaff';
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.arc(0, 0, b.r, k * Math.PI, k * Math.PI + 1.7);
          ctx.stroke();
        }
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(0, 0, b.r * 0.32, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.strokeStyle = rgba(b.color, 0.55);
        const spd = Math.hypot(b.vx, b.vy) || 1;
        ctx.lineWidth = b.r * 1.1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(b.x - (b.vx / spd) * b.r * 3.4, b.y - (b.vy / spd) * b.r * 3.4);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
        ctx.fill();
      }
      if (b.crit) {
        ctx.fillStyle = rgba(COLORS.gold, 0.9);
        starPath(ctx, b.x, b.y, b.r * 2.2, b.r * 0.5, 4, this.time * 8);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  drawEnemyBullets(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(2,3,8,0.82)';
    for (const b of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of this.enemyBullets) {
      const spd = Math.hypot(b.vx, b.vy) || 1;
      const nx = b.vx / spd, ny = b.vy / spd;
      drawGlow(ctx, b.color, b.x, b.y, b.r * 4.6, 0.6);
      ctx.strokeStyle = rgba(b.color, 0.5);
      ctx.lineWidth = b.r * 1.1;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * b.r * (b.shape === 'beam' ? 14 : 3.4), b.y - ny * b.r * (b.shape === 'beam' ? 14 : 3.4));
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.82, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.36, 0, TAU);
      ctx.fill();
      if (b.grazed) {
        ctx.strokeStyle = rgba(COLORS.gold, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 5, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  },

  // ============================================================
  // particles
  // ============================================================
  drawParticles(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      const k = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'glow') {
        drawGlow(ctx, p.color, p.x, p.y, p.size * (0.5 + k * 1.1), k * 0.8);
      } else if (p.type === 'spark') {
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * (0.4 + k);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.028, p.y - p.vy * 0.028);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.type === 'ring') {
        const t = 1 - k;
        const r = lerp(p.r0, p.r1, easeOutCubic(t));
        ctx.globalAlpha = k * 0.8;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = (p.width || 1.5) * (0.4 + k * 0.8);
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.1, r), 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.type === 'lightning') {
        ctx.globalAlpha = k;
        lightning(ctx, p.x1, p.y1, p.x2, p.y2, p.color, 0.8 * k, 16);
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.particles) {
      const k = clamp(p.life / p.maxLife, 0, 1);
      if (p.type === 'debris') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-p.size, -p.size * 0.5);
        ctx.lineTo(p.size * 0.8, -p.size * 0.2);
        ctx.lineTo(0, p.size);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (p.type === 'text') {
        const size = p.size * (p.style === 'crit' ? (1 + (1 - k) * 0.33) : 1);
        ctx.globalAlpha = k;
        ctx.font = `600 ${size}px 'Space Grotesk', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  },
};
