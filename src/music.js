// Looping background music; browsers only allow it after the first key press / click.
import { settings, onSettings } from './settings.js';

export function initMusic() {
  const music = new Audio('src/sounds/background.mp3');
  music.loop = true;
  const applyVolume = () => (music.volume = settings.music);
  applyVolume();
  onSettings(applyVolume);

  const start = () => music.play().then(() => {
    removeEventListener('keydown', start);
    removeEventListener('pointerdown', start);
  }).catch(() => {});
  addEventListener('keydown', start);
  addEventListener('pointerdown', start);
}
