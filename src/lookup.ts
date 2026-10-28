import { LEVELS, type Level, type Word } from './db';
import { idToken } from './firebase';

const GRADER_URL = import.meta.env.VITE_GRADER_URL as string | undefined;

export type Lookup =
  | { ok: true; word: Word }
  | { ok: false; reason: 'not-found'; suggestion?: string }
  | { ok: false; reason: 'signin' | 'offline' };

interface LookupResponse {
  found: boolean;
  suggestion: string;
  word: string;
  pos: string;
  phonetic: string;
  meaning: string;
  otherMeanings: string[];
  definition: string;
  example: string;
  exampleVi: string;
  collocations: string[];
  family: string[];
  cefr: string;
}

export const lookupAvailable = () => Boolean(GRADER_URL);

/** Look a word up with AI (via our Worker): Vietnamese meaning in the given context, IPA, example, collocations… */
export async function lookupWord(input: string, context: string): Promise<Lookup> {
  const token = await idToken();
  if (!GRADER_URL || !token) return { ok: false, reason: 'signin' };
  try {
    const res = await fetch(`${GRADER_URL}/lookup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: input, context }),
    });
    if (!res.ok) return { ok: false, reason: 'offline' };
    const r: LookupResponse = await res.json();
    if (!r.found) return { ok: false, reason: 'not-found', suggestion: r.suggestion || undefined };
    const cefr: Level = LEVELS.find((l) => l === r.cefr) ?? 'B1';
    return {
      ok: true,
      word: {
        id: Date.now(),
        word: r.word || input,
        pos: r.pos,
        definition: r.definition,
        phonetic: r.phonetic,
        meaning: r.meaning,
        vi: r.otherMeanings,
        topic: 'general',
        example: r.example,
        exampleVi: r.exampleVi,
        collocations: r.collocations,
        family: r.family,
        cefr,
        cefrSource: 'AI',
        concrete: true,
        custom: true,
        ...(context && { context }),
      },
    };
  } catch {
    return { ok: false, reason: 'offline' };
  }
}
