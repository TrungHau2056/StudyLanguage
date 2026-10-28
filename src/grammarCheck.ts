import { idToken } from './firebase';

/** A grammar/spelling problem found in a sentence. */
export interface Issue {
  /** Exact text of the mistake as written by the learner. */
  wrong: string;
  /** Suggested replacement(s). */
  fixes: string[];
  /** Explanation (Vietnamese from the AI grader; English from LanguageTool). */
  why: string;
}

export interface Grade {
  source: 'ai' | 'languagetool';
  issues: Issue[];
  /** Whether the target word is used in the right meaning (AI only; LanguageTool can't tell). */
  usesWordCorrectly?: boolean;
  corrected?: string;
  better?: string[];
  comment?: string;
}

const GRADER_URL = import.meta.env.VITE_GRADER_URL as string | undefined;

interface AiGrade {
  correct: boolean;
  usesWordCorrectly: boolean;
  errors: { wrong: string; fix: string; why: string }[];
  corrected: string;
  better: string[];
  comment: string;
}

/** AI grading (Gemini via our Cloudflare Worker): grammar, word meaning, naturalness, explained in Vietnamese. */
async function gradeWithAi(sentence: string, word: string, meaning: string): Promise<Grade | null> {
  const token = await idToken();
  if (!GRADER_URL || !token) return null;
  try {
    const res = await fetch(`${GRADER_URL}/grade`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence, word, meaning }),
    });
    if (!res.ok) return null;
    const g: AiGrade = await res.json();
    return {
      source: 'ai',
      issues: g.errors.map((e) => ({ wrong: e.wrong, fixes: [e.fix], why: e.why })),
      usesWordCorrectly: g.usesWordCorrectly,
      corrected: g.corrected,
      better: g.better,
      comment: g.comment,
    };
  } catch {
    return null;
  }
}

interface LtMatch {
  offset: number;
  length: number;
  message: string;
  replacements: { value: string }[];
  rule: { issueType?: string };
}

/** Fallback: public LanguageTool API (free, no key) — grammar and spelling only. */
async function gradeWithLanguageTool(text: string): Promise<Grade | null> {
  try {
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'en-US', level: 'picky' }),
    });
    if (!res.ok) return null;
    const data: { matches: LtMatch[] } = await res.json();
    return {
      source: 'languagetool',
      issues: data.matches
        // Style-only hints ("consider a shorter word") are noise for a learner's single sentence.
        .filter((m) => m.rule.issueType !== 'style' && m.rule.issueType !== 'whitespace')
        .map((m) => ({ wrong: text.slice(m.offset, m.offset + m.length), fixes: m.replacements.slice(0, 3).map((r) => r.value), why: m.message })),
    };
  } catch {
    return null;
  }
}

/** Grade a learner's sentence: AI first, LanguageTool if the AI grader is unavailable; null when offline. */
export async function gradeSentence(sentence: string, word: string, meaning: string): Promise<Grade | null> {
  return (await gradeWithAi(sentence, word, meaning)) ?? gradeWithLanguageTool(sentence);
}
