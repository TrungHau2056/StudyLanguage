import type { Level } from './db';

export type ExerciseType = 'gap' | 'choice' | 'order' | 'error' | 'translate';

export interface Exercise {
  type: ExerciseType;
  /** gap/choice: sentence with ___; order: the correct sentence (shuffled in the UI); error: sentence with one mistake; translate: Vietnamese. */
  prompt: string;
  /** Accepted answers. error: [wrong word as written, correction]. */
  answers: string[];
  options: string[];
  explain: string;
}

export interface GrammarLesson {
  id: string;
  level: Level;
  title: string;
  summary: string;
  formulas: string[];
  usage: string[];
  mistakes: { wrong: string; right: string; why: string }[];
  examples: { en: string; vi: string }[];
  exercises: Exercise[];
}

export interface Phrase { id: string; en: string; vi: string; note: string }
export interface PhraseSet { id: string; level: Level; title: string; phrases: Phrase[] }

/** Item keys for spaced review of non-word material. */
export const grammarKey = (lessonId: string, i: number) => `g:${lessonId}:${i}`;
export const phraseKey = (phraseId: string) => `p:${phraseId}`;

/** Lowercase, unify apostrophes, drop punctuation and extra spaces: "Don’t  go!" → "don't go". */
export const normalize = (s: string) =>
  s.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();

const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'm\b/g, 'i am'], [/\b(\w+)'re\b/g, '$1 are'], [/\b(he|she|it|that|there|what|who)'s\b/g, '$1 is'],
  [/\bcan't\b/g, 'cannot'], [/\bwon't\b/g, 'will not'], [/\b(\w+)n't\b/g, '$1 not'], [/\b(\w+)'ll\b/g, '$1 will'],
  [/\b(\w+)'ve\b/g, '$1 have'], [/\b(\w+)'d\b/g, '$1 would'],
];
/** Contractions expanded, so "isn't" and "is not" compare equal. */
const expand = (s: string) => CONTRACTIONS.reduce((acc, [re, to]) => acc.replace(re, to), normalize(s)).replace(/\bcan not\b/g, 'cannot');

/** True when the learner's answer matches any accepted answer (case, punctuation and contractions ignored). */
export const matches = (given: string, accepted: string[]) => accepted.some((a) => expand(a) === expand(given));
