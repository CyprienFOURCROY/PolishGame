// Saves conversations on disk: Audio/<Character>/Conversation_<n>/{First_speaker_<Character>/,Hero/,transcription.json}
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

const dir = (char, n) => path.join(ROOT, 'Audio', char, `Conversation_${n}`);
const file = (char, n) => path.join(dir(char, n), 'transcription.json');
const write = (char, n, data) => fs.writeFileSync(file(char, n), JSON.stringify(data, null, 2));

export const read = (char, n) => JSON.parse(fs.readFileSync(file(char, n), 'utf8'));

export function list(char) {
  const base = path.join(ROOT, 'Audio', char);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base)
    .map((d) => d.match(/^Conversation_(\d+)$/)?.[1]).filter(Boolean).map(Number)
    .filter((n) => fs.existsSync(file(char, n)))
    .sort((a, b) => a - b)
    .map((n) => ({ n, ...read(char, n) }));
}

// New conversation = next free number; old ones are never touched.
export function create(char) {
  const n = (list(char).at(-1)?.n ?? 0) + 1;
  fs.mkdirSync(path.join(dir(char, n), `First_speaker_${char}`), { recursive: true });
  fs.mkdirSync(path.join(dir(char, n), 'Hero'));
  write(char, n, { character: char, first_speaker: char, turns: [] });
  return n;
}

export function addTurn(char, n, speaker, text, audio) {
  const conv = read(char, n);
  const num = conv.turns.length + 1;
  const rel = `${speaker === 'Hero' ? 'Hero' : `First_speaker_${char}`}/${String(num).padStart(2, '0')}.mp3`;
  fs.writeFileSync(path.join(dir(char, n), rel), audio);
  const turn = { n: num, speaker, text, audio: `Audio/${char}/Conversation_${n}/${rel}` };
  conv.turns.push(turn);
  write(char, n, conv);
  return turn;
}

// Edit a line: new text + new audio replace the old ones (the first version is kept as `original`).
export function updateTurn(char, n, turnNumber, text, audio) {
  const conv = read(char, n);
  const turn = conv.turns.find((t) => t.n === turnNumber);
  fs.writeFileSync(path.join(ROOT, turn.audio), audio);
  turn.original ??= turn.text;
  turn.text = text;
  write(char, n, conv);
  return turn;
}
