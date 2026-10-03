// Live conversation with a character: menu (new / replay) -> NPC speaks -> you type or speak -> repeat.
// Everything is saved by the server in Audio/<Character>/Conversation_<n>/.
import { say, stopSpeaking } from './dialog.js';
import { api } from './api.js';
import { record } from './mic.js';
import { settings } from './settings.js';

const $ = (id) => document.getElementById(id);
const panel = $('talk'), title = $('talk-title'), log = $('talk-log'), status = $('talk-status'), input = $('talk-input');
const HELP = 'Type + Enter · Tab = microphone · Click a line to edit it · Quit: button or Shift+Esc';
let current = null;       // { name, npc, conversation } of the open conversation
let interrupted = false;  // you clicked a line: remaining lines are shown but not played
let quit = false;         // you asked to leave the conversation
let abortWait = null;     // ends the current wait (menu / your turn) when you quit

// Quit button or Shift+Esc, at any moment. (Plain Esc only cancels the edit of a line.)
function quitConversation() {
  if (panel.hidden) return;
  quit = true;
  stopSpeaking();
  abortWait?.();
}
$('talk-quit').onclick = quitConversation;
addEventListener('keydown', (e) => {
  if (e.shiftKey && e.code === 'Escape') { e.preventDefault(); quitConversation(); }
});

const plain = (text) => text.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim(); // hide [audio tags] in subtitles
const label = (t) => `${t.speaker}: ${plain(t.text)}`;
function addLine(text, turn) {
  const row = document.createElement('div');
  row.textContent = turn ? label(turn) : text;
  row.turn = turn; // saved line (absent for error messages): click it to edit
  log.append(row);
  log.scrollTop = log.scrollHeight;
}

// Click a line = stop the conversation (cuts the audio) and edit that line (tags included).
// Enter saves and re-voices it with ElevenLabs. Esc or a click elsewhere cancels the edit, then the conversation goes on.
log.addEventListener('click', (e) => {
  const row = e.target.closest('div');
  if (!row?.turn || !current || row.querySelector('input')) return;
  interrupted = true;
  stopSpeaking();
  current.npc.talking = false;

  const turn = row.turn;
  const box = document.createElement('input');
  box.className = 'edit';
  box.value = turn.text;
  row.replaceChildren(box);
  box.focus();
  let saving = false;
  const outside = (ev) => { if (!saving && ev.target !== box) restore(); }; // misclick: press anywhere else to cancel
  const restore = () => {
    document.removeEventListener('pointerdown', outside, true);
    row.textContent = label(turn);
    if (!input.disabled) input.focus(); // back to the Hero's turn
  };
  document.addEventListener('pointerdown', outside, true);
  box.onkeydown = async (ev) => {
    if (ev.code === 'Escape' && !ev.shiftKey) return restore(); // (Shift+Esc quits the conversation)
    if (ev.code !== 'Enter') return;
    const text = box.value.trim();
    if (!text || text === turn.text) return restore();
    saving = true;
    box.disabled = true;
    status.textContent = 'voicing the new line…';
    try {
      Object.assign(turn, await api.patch(`/api/conversations/${current.name}/${current.conversation}/turns/${turn.n}`, { text }));
      restore();
      current.npc.talking = turn.speaker !== 'Hero';
      await say(turn.speaker, plain(turn.text), `${turn.audio}?v=${Date.now()}`); // hear the new version
      current.npc.talking = false;
    } catch (err) { restore(); addLine('⚠ ' + err.message); }
    status.textContent = HELP;
  };
});

// Resolves with the first non-undefined value returned by accept(keyEvent), or quitValue if you quit.
const keyPress = (accept, quitValue) => new Promise((resolve) => {
  if (quit) return resolve(quitValue);
  const finish = (v) => { removeEventListener('keydown', onKey); abortWait = null; resolve(v); };
  const onKey = (e) => {
    if (e.target.classList?.contains('edit')) return; // editing a line
    const v = accept(e);
    if (v !== undefined) finish(v);
  };
  abortWait = () => finish(quitValue);
  addEventListener('keydown', onKey);
});

// Plays saved turns (audio + subtitles); the NPC's mouth moves on its own lines.
async function play(turns, npc) {
  for (const t of turns) {
    if (quit) break;
    addLine(null, t);
    if (interrupted) continue; // you clicked a line: show the rest without playing it
    npc.talking = t.speaker !== 'Hero';
    await say(t.speaker, plain(t.text), t.audio);
    npc.talking = false;
  }
  interrupted = false;
}

function chooseMode(past) {
  status.textContent = 'N — new conversation · ' + past.map((c) => `${c.n} — replay #${c.n} (${c.turns.length} lines)`).join(' · ') + ' · Quit: button or Shift+Esc';
  return keyPress((e) => {
    if (e.code === 'KeyN') return 'new';
    return past.find((c) => e.code === `Digit${c.n}`);
  }, 'exit');
}

// The Hero's turn: typed text (Enter) or microphone (Tab to start / stop). Resolves null if you quit.
function askHero() {
  return new Promise((resolve) => {
    if (quit) return resolve(null);
    status.textContent = HELP;
    input.value = ''; input.disabled = false;
    if (!log.querySelector('input')) input.focus(); // don't steal the focus from a line being edited
    let stop = null;
    const done = (value) => {
      removeEventListener('keydown', onKey);
      abortWait = null;
      stop?.();
      input.disabled = true;
      resolve(value);
    };
    const onKey = async (e) => {
      if (e.target.classList?.contains('edit')) return; // editing a line
      if (e.code === 'Enter' && input.value.trim()) return done(input.value.trim());
      if (e.code !== 'Tab') return;
      e.preventDefault();
      if (!stop) {
        try { stop = await record(); status.textContent = '● recording… Tab to stop'; }
        catch (err) { status.textContent = 'Microphone: ' + err.message; }
        return;
      }
      const blob = await stop(); stop = null;
      status.textContent = 'transcribing…';
      try {
        const { text } = await api.stt(blob);
        if (text) return done(text);
        status.textContent = 'Heard nothing. ' + HELP;
      } catch (err) { status.textContent = err.message; }
    };
    abortWait = () => done(null);
    addEventListener('keydown', onKey);
  });
}

async function converse(name, npc) {
  interrupted = false;
  status.textContent = `${name} is thinking…`;
  const { conversation, turns } = await api.post(`/api/conversations/${name}`, { model: settings.model }); // NPC speaks first
  current = { name, npc, conversation };
  await play(turns, npc);
  while (!quit) {
    const text = await askHero();
    if (text === null || quit) return; // you quit: conversation ended (already saved)
    interrupted = false; // a click while you were typing must not mute the next reply
    status.textContent = `${name} is thinking…`;
    try { await play((await api.post(`/api/conversations/${name}/${conversation}/reply`, { text, model: settings.model })).turns, npc); }
    catch (err) { addLine('⚠ ' + err.message); }
  }
}

export async function talkTo(name, npc) {
  document.exitPointerLock(); // free the mouse so typing works
  quit = false;
  panel.hidden = false;
  title.textContent = name;
  log.replaceChildren();
  try {
    const past = await api.get(`/api/conversations/${name}`);
    const mode = past.length ? await chooseMode(past) : 'new';
    if (mode === 'new') await converse(name, npc);
    else if (mode !== 'exit') {
      current = { name, npc, conversation: mode.n };
      interrupted = false;
      status.textContent = 'Replay · click a line to stop and edit it · Quit: button or Shift+Esc';
      await play(mode.turns, npc);
      status.textContent = 'Click a line to edit it · Quit: button or Shift+Esc';
      await keyPress(() => undefined, true); // stay open so lines can be edited, until you quit
    } // replay a saved conversation
  } catch (err) {
    status.textContent = 'Error: ' + err.message + ' (Esc or Quit)';
    await keyPress((e) => (e.code === 'Escape' ? true : undefined), true);
  } finally {
    panel.hidden = true;
    npc.talking = false;
    current = null;
  }
}
