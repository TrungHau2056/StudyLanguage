import Dexie, { type EntityTable } from 'dexie';
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';
import { pullCollection, pullProfile, pushDoc, pushMany, pushProfile } from './firebase';

export interface Word {
  id: number; // NGSL frequency rank
  word: string;
  pos: string;
  definition: string;
  phonetic: string;
  meaning: string; // concise Vietnamese meaning of the NGSL sense
  vi: string[]; // extra dictionary meanings
  topic: string;
  example: string;
  exampleVi: string;
  collocations: string[];
  family: string[];
}

export interface Reading {
  id: number;
  title: string;
  text: string;
  vi: string;
  wordIds: number[];
}

export interface StudyCard extends Card {
  wordId: number;
  addedAt: Date;
}

export interface ReviewLog {
  id?: number | string; // number: local-only autoincrement; string: synced (UUID)
  wordId: number;
  rating: Grade;
  reviewedAt: Date;
}

export interface Extra {
  word: string;
  phonetic?: string;
  audio?: string;
}

export interface Settings {
  newPerDay: number;
  /** 'all' = frequency order (recommended), otherwise a topic key. */
  topic: string;
  /** Words ranked ≤ this are treated as already known (set by the placement test). */
  knownUpTo: number;
  /** Last placement-test estimate of known words, if taken. */
  testEstimate?: number;
  /** Welcome screen finished. */
  onboarded?: boolean;
}

const DEFAULT_SETTINGS: Settings = { newPerDay: 10, topic: 'all', knownUpTo: 0 };

type VocabDb = Dexie & {
  cards: EntityTable<StudyCard, 'wordId'>;
  logs: EntityTable<ReviewLog, 'id'>;
  extras: EntityTable<Extra, 'word'>;
};

function openDb(name: string, logKey: string): VocabDb {
  const d = new Dexie(name) as VocabDb;
  d.version(1).stores({ cards: 'wordId, due, addedAt', logs: `${logKey}, wordId, reviewedAt`, extras: 'word' });
  return d;
}

/** Local mirror of the signed-in user's data (or of anonymous local data when cloud is off). */
export let db = openDb('vocab', '++id');
/** Signed-in user id; undefined = local-only mode. */
let uid: string | undefined;

const settingsKey = () => (uid ? `settings-${uid}` : 'settings');
export const dailyKey = () => (uid ? `daily-${uid}` : 'daily');

export const loadSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...JSON.parse(localStorage.getItem(settingsKey()) ?? '{}'),
});

export function saveSettings(s: Settings) {
  localStorage.setItem(settingsKey(), JSON.stringify(s));
  if (uid) pushProfile(uid, { settings: s }).catch(console.error);
}

/**
 * Switch to a signed-in user: open their own local DB, then replace it with the cloud copy.
 * First sign-in on a device that already has anonymous progress uploads that progress instead.
 */
export async function selectUser(id: string) {
  uid = id;
  db = openDb(`vocab-${id}`, 'id');
  const [cards, logs, profile] = await Promise.all([
    pullCollection<StudyCard>(id, 'cards'),
    pullCollection<ReviewLog>(id, 'logs'),
    pullProfile<{ settings?: Settings }>(id),
  ]);
  if (cards.length || profile?.settings) {
    await db.transaction('rw', db.cards, db.logs, async () => {
      await db.cards.clear();
      await db.logs.clear();
      await db.cards.bulkPut(cards);
      await db.logs.bulkPut(logs);
    });
    if (profile?.settings) localStorage.setItem(settingsKey(), JSON.stringify(profile.settings));
    return;
  }
  const legacy = openDb('vocab', '++id');
  const oldCards = await legacy.cards.toArray();
  if (!oldCards.length) return;
  const oldLogs = (await legacy.logs.toArray()).map((l) => ({ ...l, id: crypto.randomUUID() }));
  await db.cards.bulkPut(oldCards);
  await db.logs.bulkPut(oldLogs);
  const oldSettings = localStorage.getItem('settings');
  if (oldSettings) saveSettings(JSON.parse(oldSettings));
  await pushMany(id, 'cards', oldCards.map((c) => ({ id: String(c.wordId), data: c })));
  await pushMany(id, 'logs', oldLogs.map((l) => ({ id: l.id, data: l })));
  // Hand the anonymous progress to this account only; another account signing in on this browser must not inherit it.
  await legacy.delete();
  localStorage.removeItem('settings');
  localStorage.removeItem('daily');
}

const scheduler = fsrs({ enable_fuzz: true });

// Cloud writes are fire-and-forget: Firestore's offline cache retries them when back online.
const pushCard = (c: StudyCard) => uid && pushDoc(uid, ['cards', String(c.wordId)], c).catch(console.error);

export async function addCard(wordId: number) {
  const card = { ...createEmptyCard(new Date()), wordId, addedAt: new Date() };
  await db.cards.put(card);
  pushCard(card);
}

export async function review(card: StudyCard, rating: Grade) {
  const now = new Date();
  const { card: next } = scheduler.next(card, now, rating);
  const updated = { ...next, wordId: card.wordId, addedAt: card.addedAt };
  // String ids so logs written on different devices never collide.
  const id = uid ? crypto.randomUUID() : undefined;
  const log: ReviewLog = { id, wordId: card.wordId, rating, reviewedAt: now };
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.put(updated);
    await db.logs.add(log);
  });
  pushCard(updated);
  if (uid && id) pushDoc(uid, ['logs', id], log).catch(console.error);
}

/** Probability (0–1) the word is recalled right now. */
export const retrievability = (card: StudyCard, now = new Date()) =>
  card.reps === 0 ? 0 : scheduler.get_retrievability(card, now, false);

/** Preview the next interval for each grade, e.g. "10 phút", "3 ngày". */
export function previewIntervals(card: StudyCard): Record<Grade, string> {
  const now = new Date();
  const preview = scheduler.repeat(card, now);
  const fmt = (due: Date) => {
    const min = Math.round((due.getTime() - now.getTime()) / 60000);
    if (min < 60) return `${Math.max(min, 1)} phút`;
    if (min < 1440) return `${Math.round(min / 60)} giờ`;
    const d = Math.round(min / 1440);
    return d < 30 ? `${d} ngày` : `${Math.round(d / 30)} tháng`;
  };
  return {
    1: fmt(preview[1].card.due),
    2: fmt(preview[2].card.due),
    3: fmt(preview[3].card.due),
    4: fmt(preview[4].card.due),
  } as Record<Grade, string>;
}

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Pronunciation audio/IPA from dictionaryapi.dev, cached locally. */
export async function getExtra(word: string): Promise<Extra> {
  const cached = await db.extras.get(word);
  if (cached) return cached;
  const extra: Extra = { word };
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (res.ok) {
      for (const entry of await res.json()) {
        extra.phonetic ??= entry.phonetic || undefined;
        for (const p of entry.phonetics ?? []) {
          if (p.audio && !extra.audio) extra.audio = p.audio;
          if (p.text && !extra.phonetic) extra.phonetic = p.text;
        }
      }
    } else if (res.status !== 404) {
      return extra; // transient error: don't cache
    }
  } catch {
    return extra; // offline: don't cache
  }
  await db.extras.put(extra);
  return extra;
}

export async function exportData() {
  return JSON.stringify({
    version: 1,
    cards: await db.cards.toArray(),
    logs: await db.logs.toArray(),
    settings: localStorage.getItem(settingsKey()),
  });
}

export async function importData(json: string) {
  const data: { cards: StudyCard[]; logs: ReviewLog[]; settings?: string | null } = JSON.parse(json);
  if (!Array.isArray(data.cards) || !Array.isArray(data.logs)) throw new Error('File không hợp lệ');
  // JSON turns Dates into strings; restore them.
  const cards = data.cards.map((c) => ({
    ...c,
    due: new Date(c.due),
    addedAt: new Date(c.addedAt),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  }));
  // Synced logs need string ids that can't collide across devices.
  const logs = data.logs.map((l) => ({ ...l, id: uid ? crypto.randomUUID() : l.id, reviewedAt: new Date(l.reviewedAt) }));
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.clear();
    await db.logs.clear();
    await db.cards.bulkPut(cards);
    await db.logs.bulkPut(logs);
  });
  if (data.settings) saveSettings(JSON.parse(data.settings));
  if (uid) {
    await pushMany(uid, 'cards', cards.map((c) => ({ id: String(c.wordId), data: c })));
    await pushMany(uid, 'logs', logs.map((l) => ({ id: String(l.id), data: l })));
  }
}
