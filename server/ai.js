// OpenAI (text), ElevenLabs (voice + speech-to-text) and local usage estimates.
// No balance is ever requested: costs are estimated from what this game consumed (usage.json).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJson } from './config.js';

const TTS_MODEL = process.env.ELEVEN_TTS_MODEL || 'eleven_v3'; // v3 understands tags like [irritated]
const CREDITS_PER_CHAR = /flash|turbo/.test(TTS_MODEL) ? 0.5 : 1;

const empty = () => ({ openai: { models: {} }, eleven: { tts_chars: 0, stt_requests: 0 } });
const USAGE_FILE = path.join(ROOT, 'usage.json');
const usage = (() => {
  if (!fs.existsSync(USAGE_FILE)) return empty();
  const u = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
  if (u.openai.models) return u;
  const { requests, prompt_tokens, completion_tokens } = u.openai; // older file format
  return { ...u, openai: { models: { 'gpt-4o-mini': { requests, in: prompt_tokens, out: completion_tokens } } } };
})();
const session = empty(); // since the server started
const save = () => fs.writeFileSync(USAGE_FILE, JSON.stringify(usage, null, 2));

// Text without [audio tags] and (sound events): what is really spoken.
export const stripTags = (text) => text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

export const models = () => readJson('models.json');

async function check(res) {
  if (!res.ok) throw new Error(`${new URL(res.url).host} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res;
}
const eleven = (url, init = {}) => fetch('https://api.elevenlabs.io' + url, {
  ...init, headers: { 'xi-api-key': process.env.ELEVEN_LABS_API_KEY, ...init.headers },
});

export async function chat(messages, model) {
  if (!models()[model]) model = Object.keys(models())[0];
  const res = await check(await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPEN_AI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: 0.9, max_tokens: 100 }),
  }));
  const data = await res.json();
  for (const u of [usage, session]) {
    const m = (u.openai.models[model] ??= { requests: 0, in: 0, out: 0 });
    m.requests++; m.in += data.usage.prompt_tokens; m.out += data.usage.completion_tokens;
  }
  save();
  return data.choices[0].message.content.trim();
}

export async function tts(text, voiceId) {
  const res = await check(await eleven(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
  }));
  for (const u of [usage, session]) u.eleven.tts_chars += text.length;
  save();
  return Buffer.from(await res.arrayBuffer());
}

export async function stt(buffer, mime) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'pol');
  form.append('tag_audio_events', 'false'); // no "(music)" / "(laughter)" in the transcript
  form.append('file', new Blob([buffer], { type: mime }), 'speech.webm');
  const res = await check(await eleven('/v1/speech-to-text', { method: 'POST', body: form }));
  for (const u of [usage, session]) u.eleven.stt_requests++;
  save();
  return stripTags(((await res.json()).text ?? '')); // may be empty (silence, only music)
}

function summarize(u) {
  const prices = models();
  const byModel = {};
  let requests = 0, tin = 0, tout = 0, cost = 0;
  for (const [name, m] of Object.entries(u.openai.models)) {
    const p = prices[name] ?? { in: 0, out: 0 };
    const c = (m.in * p.in + m.out * p.out) / 1e6;
    byModel[name] = { ...m, cost_usd: c };
    requests += m.requests; tin += m.in; tout += m.out; cost += c;
  }
  return {
    eleven: { ...u.eleven, credits: u.eleven.tts_chars * CREDITS_PER_CHAR },
    openai: { requests, in: tin, out: tout, cost_usd: cost, byModel },
  };
}

export const getUsage = () => ({ total: summarize(usage), session: summarize(session), models: Object.keys(models()) });
