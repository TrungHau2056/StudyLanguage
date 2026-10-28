import Dexie, { type EntityTable } from 'dexie';
import { createEmptyCard, fsrs, type Card, type Grade } from 'ts-fsrs';

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
  id?: number;
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
}

const DEFAULT_SETTINGS: Settings = { newPerDay: 10, topic: 'all', knownUpTo: 0 };

export const loadSettings = (): Settings => ({
  ...DEFAULT_SETTINGS,
  ...JSON.parse(localStorage.getItem('settings') ?? '{}'),
});

export const db = new Dexie('vocab') as Dexie & {
  cards: EntityTable<StudyCard, 'wordId'>;
  logs: EntityTable<ReviewLog, 'id'>;
  extras: EntityTable<Extra, 'word'>;
};

db.version(1).stores({
  cards: 'wordId, due, addedAt',
  logs: '++id, wordId, reviewedAt',
  extras: 'word',
});

const scheduler = fsrs({ enable_fuzz: true });

export async function addCard(wordId: number) {
  await db.cards.put({ ...createEmptyCard(new Date()), wordId, addedAt: new Date() });
}

export async function review(card: StudyCard, rating: Grade) {
  const now = new Date();
  const { card: next } = scheduler.next(card, now, rating);
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.put({ ...next, wordId: card.wordId, addedAt: card.addedAt });
    await db.logs.add({ wordId: card.wordId, rating, reviewedAt: now });
  });
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
    settings: localStorage.getItem('settings'),
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
  const logs = data.logs.map((l) => ({ ...l, reviewedAt: new Date(l.reviewedAt) }));
  await db.transaction('rw', db.cards, db.logs, async () => {
    await db.cards.clear();
    await db.logs.clear();
    await db.cards.bulkPut(cards);
    await db.logs.bulkPut(logs);
  });
  if (data.settings) localStorage.setItem('settings', data.settings);
}
