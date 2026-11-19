/* POLARIS — bootstrap: input, resize, main loop */

import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { UI } from './ui.js';
import { Enemy, Boss } from './actors.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const audio = new AudioEngine();
const ui = new UI();
const game = new Game(canvas, audio, ui);
ui.attach(game);

/* ---------------- resize ---------------- */
let W = 1280, H = 720;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  game.view.w = W;
  game.view.h = H;
}
window.addEventListener('resize', resize);
resize();

/* ---------------- input ---------------- */
function setKey(code, down) {
  switch (code) {
    case 'KeyW': case 'ArrowUp': game.input.up = down; break;
    case 'KeyS': case 'ArrowDown': game.input.down = down; break;
    case 'KeyA': case 'ArrowLeft': game.input.left = down; break;
    case 'KeyD': case 'ArrowRight': game.input.right = down; break;
  }
}

window.addEventListener('keydown', e => {
  audio.ensure();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  setKey(e.code, true);
  if (e.repeat) return;
  switch (e.code) {
    case 'Space': game.press('dash'); break;
    case 'KeyQ': game.press('switch'); break;
    case 'KeyE': game.press('nova'); break;
    case 'KeyP': case 'Escape': game.press('pause'); break;
    case 'Enter': game.press('confirm'); break;
    case 'Digit1': game.press('card', 0); break;
    case 'Digit2': game.press('card', 1); break;
    case 'Digit3': game.press('card', 2); break;
    case 'Digit4': game.press('card', 3); break;
    case 'KeyM': game.press('mute'); ui.updateMute(); break;
  }
});
window.addEventListener('keyup', e => setKey(e.code, false));

window.addEventListener('mousemove', e => {
  game.input.mx = e.clientX;
  game.input.my = e.clientY;
});
window.addEventListener('mousedown', e => {
  audio.ensure();
  if (e.button === 2) game.press('switch');
});
window.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') game.press('pause');
});

/* ---------------- main loop ---------------- */
let last = performance.now();
let renderedState = null;
let renderedW = 0, renderedH = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt < 0) dt = 0;
  game.frame(dt);
  /* world is frozen during level-up/pause — canvas content doesn't change,
     so only repaint on state entry or resize */
  const st = game.state;
  const frozen = st === 'levelup' || st === 'paused';
  const sizeChanged = W !== renderedW || H !== renderedH;
  if (!frozen || st !== renderedState || sizeChanged) {
    game.render(ctx, W, H);
    renderedState = st;
    renderedW = W; renderedH = H;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* expose for debugging / tests */
window.__polaris = { game, audio, ui, Enemy, Boss };
