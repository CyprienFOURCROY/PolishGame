// User settings (voice/music volume, OpenAI model), remembered in the browser.
const KEY = 'polishgame.settings';
const listeners = new Set();

export const settings = { voice: 1, music: 0.3, model: 'gpt-4o-mini' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY))); } catch { /* first run */ }

export function setSetting(name, value) {
  settings[name] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
  listeners.forEach((fn) => fn());
}
export const onSettings = (fn) => listeners.add(fn);
