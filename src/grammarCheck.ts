/** A grammar/spelling problem found in a sentence. */
export interface Issue {
  offset: number;
  length: number;
  message: string;
  replacements: string[];
}

interface LtMatch {
  offset: number;
  length: number;
  message: string;
  replacements: { value: string }[];
  rule: { issueType?: string };
}

/**
 * Checks English grammar and spelling with the public LanguageTool API (free, no key, CORS-enabled).
 * Returns null when the check could not run (offline, rate limit), so callers can fall back gracefully.
 */
export async function checkGrammar(text: string): Promise<Issue[] | null> {
  try {
    const res = await fetch('https://api.languagetool.org/v2/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ text, language: 'en-US', level: 'picky' }),
    });
    if (!res.ok) return null;
    const data: { matches: LtMatch[] } = await res.json();
    return data.matches
      // Style-only hints ("consider a shorter word") are noise for a learner's single sentence.
      .filter((m) => m.rule.issueType !== 'style' && m.rule.issueType !== 'whitespace')
      .map((m) => ({ offset: m.offset, length: m.length, message: m.message, replacements: m.replacements.slice(0, 3).map((r) => r.value) }));
  } catch {
    return null;
  }
}
