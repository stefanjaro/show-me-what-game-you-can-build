import { Save } from './save.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { UI } from './ui.js';

const fatalEl = document.getElementById('fatal');
function fatal(err) {
  console.error(err);
  if (!fatalEl) return;
  fatalEl.classList.remove('hidden');
  fatalEl.textContent = 'LUMENFALL encountered an error\n\n' + (err?.stack || err?.message || String(err));
}
window.addEventListener('error', e => fatal(e.error || e.message));
window.addEventListener('unhandledrejection', e => fatal(e.reason));

try {
  const save = new Save();
  const audio = new AudioEngine(save.settings);
  const game = new Game(document.getElementById('game'), { audio, save });
  const ui = new UI({ game, audio, save });
  game.ui = ui;

  document.body.classList.toggle('touch', game.isTouch);

  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('focus', () => {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  });

  window.LUMENFALL = { game, ui, audio, save };
} catch (err) {
  fatal(err);
}
