// Builds public/words.json and public/readings.json from:
// - NGSL 1.01 (CC BY-SA) word list
// - an English-Vietnamese dictionary (extra meanings, IPA)
// - scripts/data/enrich.json: AI-generated per-word data (topic, concise meaning, example, collocations, word family)
// - scripts/data/levels.json: AI-classified CEFR level + concrete flag per word
// - scripts/data/readings_a1.json, readings.json: AI-generated A1 and A2–B1 reading passages
// Usage: node scripts/build-words.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const NGSL_URL = 'https://raw.githubusercontent.com/koba-ninkigumi/ngsl/master/NGSL-1.01_en_ja.csv';
const EV_URL = 'https://raw.githubusercontent.com/namduongit/english-vietnamese/main/data/eng-vietnamese.json';

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
};

// Minimal CSV parser (handles quoted fields).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Dictionary meanings embed sub-headers ("\n*  ngoại động từ") and idioms ("\n!idiom"); keep only the gloss.
const cleanMeaning = (m) => m.split('\n')[0].trim();

const [ngslCsv, evJson] = await Promise.all([fetchText(NGSL_URL), fetchText(EV_URL)]);
const dict = new Map();
for (const e of JSON.parse(evJson)) {
  const key = e.word.toLowerCase();
  if (!dict.has(key)) dict.set(key, []);
  dict.get(key).push(e);
}

const enrich = JSON.parse(await readFile('scripts/data/enrich.json', 'utf8'));
// AI-classified CEFR level of each NGSL sense, and whether it can be learned in isolation (vs. grammar/abstract words).
const levels = JSON.parse(await readFile('scripts/data/levels.json', 'utf8'));
const words = [];
const missing = [];
for (const [rank, lemma, pos, definition] of parseCsv(ngslCsv).slice(1)) {
  if (!lemma) continue;
  const entries = dict.get(lemma.toLowerCase()) ?? [];
  const meanings = [...new Set(entries.flatMap((e) => e.meaning.map(cleanMeaning)))]
    .filter((m) => m && !m.startsWith('!') && !m.startsWith('*'))
    .slice(0, 3);
  const e = enrich[rank];
  if (!e) missing.push(lemma);
  words.push({
    id: Number(rank),
    word: lemma,
    pos,
    definition,
    // Source has truncated transcriptions like "/w"; keep only complete /.../ ones.
    phonetic: entries.map((e) => e.phonetic).find((p) => /^\/[^/,]+\/$/.test(p ?? '')) ?? '',
    meaning: e?.vi ?? meanings[0] ?? '',
    vi: meanings.filter((m) => m !== e?.vi),
    topic: e?.topic ?? 'general',
    example: e?.example ?? '',
    exampleVi: e?.example_vi ?? '',
    collocations: e?.collocations ?? [],
    family: e?.family ?? [],
    cefr: levels[rank]?.cefr ?? 'B1',
    concrete: levels[rank]?.concrete ?? false,
  });
}

await mkdir('public', { recursive: true });
await writeFile('public/words.json', JSON.stringify(words));
// A1 passages (ids ≥ 1000) for absolute beginners first, then the A2–B1 frequency-band passages.
const readings = [
  ...JSON.parse(await readFile('scripts/data/readings_a1.json', 'utf8')),
  ...JSON.parse(await readFile('scripts/data/readings.json', 'utf8')).map((r) => ({ ...r, level: 'A2–B1' })),
];
await writeFile('public/readings.json', JSON.stringify(readings));
// AI-written, AI-audited A1–A2 grammar lessons and situation phrases.
await writeFile('public/grammar.json', JSON.stringify(JSON.parse(await readFile('scripts/data/grammar.json', 'utf8'))));
await writeFile('public/phrases.json', JSON.stringify(JSON.parse(await readFile('scripts/data/phrases.json', 'utf8'))));
console.log(`wrote ${words.length} words; missing enrichment: ${missing.join(', ') || 'none'}`);
