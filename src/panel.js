// Side panel. U = open/close, S = open on the sound settings. Credits, OpenAI model, volumes.
import { api } from './api.js';
import { settings, setSetting } from './settings.js';

const panel = document.getElementById('panel');
const n = (x) => Math.round(x).toLocaleString('en-US');

panel.innerHTML = `
  <h2>Panel <small>U close · S sound · Esc back to game</small></h2>
  <h3>Credits used <small>(estimates)</small></h3>
  <div id="p-credits">…</div>
  <h3>OpenAI model</h3>
  <select id="p-model"></select>
  <h3>Sound</h3>
  <label>Voices <input id="p-voice" type="range" min="0" max="1" step="0.05"></label>
  <label>Background <input id="p-music" type="range" min="0" max="1" step="0.05"></label>`;
const $ = (id) => document.getElementById(id);

function creditsHtml(label, u) {
  const rows = Object.entries(u.openai.byModel).map(([m, x]) => `<br>&nbsp;· ${m}: ${n(x.requests)} req, $${x.cost_usd.toFixed(4)}`).join('');
  return `<p><b>${label}</b><br>ElevenLabs ≈ <b>${n(u.eleven.credits)}</b> credits (${n(u.eleven.tts_chars)} chars, ${n(u.eleven.stt_requests)} transcriptions*)
    <br>OpenAI ≈ <b>$${u.openai.cost_usd.toFixed(4)}</b> (${n(u.openai.requests)} req, ${n(u.openai.in)} in / ${n(u.openai.out)} out tokens)${rows}</p>`;
}

async function refresh() {
  try {
    const u = await api.get('/api/usage');
    $('p-credits').innerHTML = creditsHtml('Since the beginning', u.total) + creditsHtml('This session', u.session)
      + '<small>*transcriptions are not counted in credits. Estimated locally, no balance requested.</small>';
    if (!$('p-model').options.length) {
      $('p-model').innerHTML = u.models.map((m) => `<option>${m}</option>`).join('');
      $('p-model').value = u.models.includes(settings.model) ? settings.model : u.models[0];
      setSetting('model', $('p-model').value);
    }
  } catch (err) { $('p-credits').textContent = err.message; }
}

// controls <-> settings
$('p-voice').value = settings.voice;
$('p-music').value = settings.music;
$('p-voice').oninput = (e) => setSetting('voice', Number(e.target.value));
$('p-music').oninput = (e) => setSetting('music', Number(e.target.value));
$('p-model').onchange = (e) => { setSetting('model', e.target.value); e.target.blur(); };

export function initPanel() {
  let timer;
  const close = () => { panel.hidden = true; clearInterval(timer); document.activeElement.blur(); };
  const open = (focusSound) => {
    panel.hidden = false;
    document.exitPointerLock(); // free the mouse to use the controls
    refresh(); timer = setInterval(refresh, 5000);
    if (focusSound) $('p-voice').focus();
  };
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type === 'text') return; // typing in a conversation
    if (e.code === 'Escape' && !panel.hidden) return close();
    if (e.code !== 'KeyU' && e.code !== 'KeyS') return;
    if (!panel.hidden) return close();
    open(e.code === 'KeyS');
  });
}
