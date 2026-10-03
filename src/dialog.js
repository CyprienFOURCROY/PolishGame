// Plays one voice line with a subtitle; resolves when the audio ends.
import { settings } from './settings.js';

const subtitle = document.getElementById('subtitle');

let stopCurrent = null;

export function say(who, text, audio) {
  subtitle.textContent = `${who}: ${text}`;
  return new Promise((resolve) => {
    const a = new Audio(audio);
    a.volume = settings.voice;
    const done = () => { stopCurrent = null; subtitle.textContent = ''; resolve(); };
    stopCurrent = () => { a.pause(); done(); };
    a.onended = done;
    a.onerror = done;
    a.play().catch(done);
  });
}

// Cut the line that is playing (its say() promise resolves).
export const stopSpeaking = () => stopCurrent?.();
