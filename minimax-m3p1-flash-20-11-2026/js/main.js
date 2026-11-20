// EMBERDEEP — bootstrap.
import { Game } from './game.js';
import { Dom } from './ui.js';
import { Input } from './util.js';

const dom = new Dom();
const game = new Game(dom);
dom.updateStats(game.save);

window.addEventListener('keydown', (e) => {
  if (game.state === 'draft' && ['1', '2', '3'].includes(e.key)) {
    dom.pickDraft(parseInt(e.key, 10) - 1);
  }
});

game.last = performance.now();
requestAnimationFrame(game.loop.bind(game));

// expose for debugging / automated checks
window.EMBERDEEP = game;
game.Input = Input;
