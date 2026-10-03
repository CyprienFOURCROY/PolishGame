// Static file server + the API used by the game. Run: npm start
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './config.js';
import * as ai from './ai.js';
import * as store from './store.js';

const PORT = 8000;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg' };

const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const readBody = async (req) => { const c = []; for await (const x of req) c.push(x); return Buffer.concat(c); };
const readJsonBody = async (req) => { const b = await readBody(req); return b.length ? JSON.parse(b) : {}; };
const voiceId = (name) => readJson('Audio/voices.json')[name].voice_id;

function systemPrompt(name, c) {
  return `You are ${name} (${c.persona}) in a language-learning game set in Poland. The player, "the Hero", is a foreigner learning Polish who walks up to you in the street.
Rules:
- Speak ONLY Polish, simple everyday words (A2 level), one or two SHORT sentences (max 15 words).
- Start the line with one or two ElevenLabs audio tags in square brackets that match your emotion, e.g. ${c.tags}. Other tags are allowed ([whispers], [laughs], [annoyed]...).
- Output only your spoken line: no name, no quotes, no stage directions, no emojis.
- Stay in character. React naturally if you don't understand the Hero. Say goodbye if the conversation ends.`;
}

// One NPC line: text from OpenAI, then its voice from ElevenLabs.
async function npcSay(name, character, messages, model) {
  for (let attempt = 0; attempt < 2; attempt++) { // the model sometimes answers with a tag only: ask again
    const text = await ai.chat([{ role: 'system', content: systemPrompt(name, character) }, ...messages], model);
    if (ai.stripTags(text)) return { text, audio: await ai.tts(text, voiceId(character.voice)) };
  }
  throw new Error(`${name} had nothing to say, try again`);
}

async function api(req, res, url) {
  const [, route, name, n, action, turnId] = url.pathname.split('/').filter(Boolean);
  if (route === 'usage') return json(res, ai.getUsage());
  if (route === 'stt' && req.method === 'POST') {
    return json(res, { text: await ai.stt(await readBody(req), req.headers['content-type'] || 'audio/webm') });
  }
  if (route === 'conversations') {
    const character = readJson('characters.json')[name];
    if (!character) return json(res, { error: 'unknown character' }, 404);
    if (req.method === 'GET') return json(res, store.list(name));

    if (!n) { // new conversation: the NPC speaks first
      const { model } = await readJsonBody(req);
      const num = store.create(name);
      const line = await npcSay(name, character, [{ role: 'user', content: '[The Hero walks up to you. Say your first line.]' }], model);
      return json(res, { conversation: num, turns: [store.addTurn(name, num, name, line.text, line.audio)] });
    }
    if (action === 'turns' && req.method === 'PATCH' && /^\d+$/.test(n) && /^\d+$/.test(turnId)) { // edit a line, re-voice it
      const text = ((await readJsonBody(req)).text ?? '').trim();
      if (!ai.stripTags(text)) return json(res, { error: 'Empty message, nothing to say' }, 400);
      const turn = store.read(name, n).turns.find((t) => t.n === Number(turnId));
      if (!turn) return json(res, { error: 'unknown line' }, 404);
      const audio = await ai.tts(text, voiceId(turn.speaker === 'Hero' ? 'Hero' : character.voice));
      return json(res, store.updateTurn(name, n, turn.n, text, audio));
    }
    if (action === 'reply' && /^\d+$/.test(n)) { // Hero speaks, NPC answers
      const { text: raw, model } = await readJsonBody(req);
      const text = (raw ?? '').trim();
      if (!ai.stripTags(text)) return json(res, { error: 'Empty message, nothing to say' }, 400);
      const history = store.read(name, n).turns.map((t) => ({ role: t.speaker === 'Hero' ? 'user' : 'assistant', content: t.text }));
      const [heroAudio, line] = await Promise.all([ // Hero voice while the NPC thinks
        ai.tts(text, voiceId('Hero')),
        npcSay(name, character, [...history, { role: 'user', content: text }], model),
      ]);
      const hero = store.addTurn(name, n, 'Hero', text, heroAudio);
      return json(res, { turns: [hero, store.addTurn(name, n, name, line.text, line.audio)] });
    }
  }
  json(res, { error: 'not found' }, 404);
}

function serve(res, url) {
  const rel = decodeURIComponent(url.pathname).slice(1) || 'index.html';
  const file = path.join(ROOT, rel);
  const blocked = /(^|\/)\.|^server(\/|$)|^usage\.json$|^package/.test(rel); // never serve .env, server code...
  if (blocked || !file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else serve(res, url);
  } catch (e) {
    console.error(e.message);
    json(res, { error: e.message }, 500);
  }
}).listen(PORT, () => console.log(`Game on http://localhost:${PORT}`));

process.on('unhandledRejection', (e) => console.error('Unhandled:', e?.message ?? e)); // never crash the game server
