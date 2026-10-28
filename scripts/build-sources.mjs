// Builds scripts/data/sources.json from open, citable datasets (downloaded to /tmp/od, see README):
// - CEFR level: CEFR-J Vocabulary Profile 1.5 (A1–B2, Tono Lab, TUFS; free with citation)
//              + Octanove Vocabulary Profile C1/C2 (CC BY-SA 4.0)
// - IPA: CMU Pronouncing Dictionary (BSD), US pronunciation, converted from ARPAbet
// - Examples: Tatoeba English sentences with Vietnamese translations (CC BY 2.0 FR), sentence id kept for attribution
// Usage: node scripts/build-sources.mjs [dataDir=/tmp/od]
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';

const dir = process.argv[2] ?? '/tmp/od';
const words = JSON.parse(await readFile('public/words.json', 'utf8'));

// ---------- CEFR ----------
const POS = { noun: 'noun', verb: 'verb', adjective: 'adjective', adverb: 'adverb', preposition: 'preposition', pronoun: 'pronoun',
  determiner: 'determiner', conjunction: 'conjunction', article: 'determiner', number: 'number', interjection: 'interjection' };
const cefr = new Map(); // "word|pos" and "word" → lowest level
const add = (key, lvl) => { if (!cefr.has(key) || cefr.get(key) > lvl) cefr.set(key, lvl); };
for (const f of ['cefrj-vocabulary-profile-1.5.csv', 'octanove-vocabulary-profile-c1c2-1.0.csv']) {
  const rows = (await readFile(`${dir}/${f}`, 'utf8')).split('\n').slice(1);
  for (const r of rows) {
    const [head, pos, lvl] = r.split(',');
    if (!lvl || !/^[ABC][12]$/.test(lvl)) continue;
    const level = lvl === 'C2' ? 'C1' : lvl; // the app's scale stops at C1
    for (const h of head.split('/').map((s) => s.trim().toLowerCase())) { add(`${h}|${pos}`, level); add(h, level); }
  }
}

// ---------- IPA from CMUdict ----------
const ARPA = { AA: 'ɑ', AE: 'æ', AH: 'ʌ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ', ER: 'ɝ', EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ', K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'r', S: 's', SH: 'ʃ',
  T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ' };
const VOWEL = /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)/;
function toIpa(phones) {
  const ph = phones.split(' ');
  const out = ph.map((p) => {
    const base = p.replace(/\d/, '');
    if (base === 'AH' && p.endsWith('0')) return 'ə';
    if (base === 'ER' && p.endsWith('0')) return 'ɚ';
    return ARPA[base] ?? '';
  });
  // Mark primary stress before the stressed syllable's onset (simplified: the one consonant right before its vowel).
  const vowels = ph.filter((p) => VOWEL.test(p)).length;
  const v = ph.findIndex((p) => p.endsWith('1'));
  if (vowels > 1 && v >= 0) {
    const start = v > 0 && !VOWEL.test(ph[v - 1]) ? v - 1 : v;
    out[start] = 'ˈ' + out[start];
  }
  return `/${out.join('')}/`;
}
const cmu = new Map();
for (const line of (await readFile(`${dir}/cmudict.dict`, 'utf8')).split('\n')) {
  const m = line.match(/^([a-z'.-]+)\s+(.+?)(\s*#.*)?$/);
  if (m && !cmu.has(m[1])) cmu.set(m[1], toIpa(m[2])); // first entry = most common pronunciation
}

// ---------- Tatoeba EN–VI pairs ----------
const bz = (f) => execSync(`bzcat ${dir}/${f}`, { maxBuffer: 1 << 30 }).toString();
const vie = new Map(bz('vie_sentences.tsv.bz2').split('\n').map((l) => l.split('\t')).filter((c) => c[2]).map((c) => [c[0], c[2]]));
const eng = new Map(bz('eng_sentences.tsv.bz2').split('\n').map((l) => l.split('\t')).filter((c) => c[2]).map((c) => [c[0], c[2]]));
const pairs = [];
// links.csv is several GB uncompressed: filter to links whose target is a Vietnamese sentence before reading it.
await writeFile('/tmp/vie_ids.txt', [...vie.keys()].join('\n'));
const links = execSync(`tar -xOjf ${dir}/links.tar.bz2 | awk -F'\\t' 'NR==FNR{v[$1];next} ($2 in v)' /tmp/vie_ids.txt -`,
  { maxBuffer: 1 << 30, shell: '/bin/bash' });
for (const l of links.toString().split('\n')) {
  const [a, b] = l.split('\t');
  if (eng.has(a) && vie.has(b)) pairs.push({ id: Number(a), en: eng.get(a), vi: vie.get(b) });
}
const byEn = new Map(pairs.map((p) => [p.id, p]));
const goodPairs = [...byEn.values()].filter((p) => {
  const n = p.en.split(/\s+/).length;
  return n >= 4 && n <= 14 && !/[“"]{2}|\d{3,}/.test(p.en);
});
// Index sentences by lowercased word tokens for lookup.
const index = new Map();
for (const p of goodPairs) for (const t of new Set(p.en.toLowerCase().match(/[a-z']+/g) ?? [])) {
  if (!index.has(t)) index.set(t, []);
  index.get(t).push(p);
}
const forms = (w) => {
  const x = w.toLowerCase();
  const f = [x, `${x}s`, `${x}es`, `${x}ed`, `${x}d`, `${x}ing`];
  if (x.endsWith('e')) f.push(`${x.slice(0, -1)}ing`);
  if (x.endsWith('y')) f.push(`${x.slice(0, -1)}ies`, `${x.slice(0, -1)}ied`);
  return f;
};

// ---------- Merge ----------
const out = {};
let nCefr = 0, nIpa = 0, nEx = 0;
for (const w of words) {
  const key = w.word.toLowerCase();
  const level = cefr.get(`${key}|${POS[w.pos] ?? w.pos}`) ?? cefr.get(key);
  const ipa = cmu.get(key);
  // Shortest natural sentences first: easiest to read for learners.
  const cands = [...new Set(forms(key).flatMap((f) => index.get(f) ?? []))].sort((a, b) => a.en.length - b.en.length);
  const ex = cands.find((p) => p.en.length >= 15) ?? cands[0];
  out[w.id] = { ...(level && { cefr: level }), ...(ipa && { ipa }), ...(ex && { example: ex.en, exampleVi: ex.vi, tatoeba: ex.id }) };
  if (level) nCefr++; if (ipa) nIpa++; if (ex) nEx++;
}
await writeFile('scripts/data/sources.json', JSON.stringify(out));
console.log(`EN–VI pairs ${goodPairs.length}; CEFR ${nCefr}, IPA ${nIpa}, Tatoeba examples ${nEx} of ${words.length}`);
