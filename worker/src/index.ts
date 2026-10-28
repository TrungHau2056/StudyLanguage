/**
 * Sentence grader for the Vocab app's writing step.
 * POST /grade { sentence, word, meaning } with "Authorization: Bearer <Firebase ID token>".
 * Only signed-in users of the Firebase project may call it, so the Gemini key can't be abused.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

interface Env {
  GEMINI_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  ALLOWED_ORIGINS: string; // comma-separated
}

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const MODEL = 'gemini-2.5-flash';
const MAX_LEN = 300;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    correct: { type: 'BOOLEAN', description: 'true only if grammatical, natural, and uses the target word correctly in its meaning' },
    usesWordCorrectly: { type: 'BOOLEAN' },
    errors: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          wrong: { type: 'STRING', description: 'the exact wrong part, copied from the sentence' },
          fix: { type: 'STRING' },
          why: { type: 'STRING', description: 'short explanation in Vietnamese' },
        },
        required: ['wrong', 'fix', 'why'],
      },
    },
    corrected: { type: 'STRING', description: 'the sentence with minimal corrections (same as input if correct)' },
    better: { type: 'ARRAY', items: { type: 'STRING' }, description: '1-2 more natural ways to say it' },
    comment: { type: 'STRING', description: 'one encouraging sentence in Vietnamese' },
  },
  required: ['correct', 'usesWordCorrectly', 'errors', 'corrected', 'better', 'comment'],
};

const PROMPT = (sentence: string, word: string, meaning: string) =>
  `Bạn là giáo viên tiếng Anh chấm câu cho người Việt mới học (A1–B1).
Từ cần dùng: "${word}" (nghĩa: ${meaning}).
Câu của học viên: """${sentence}"""
Chấm: ngữ pháp, chính tả, dùng từ "${word}" đúng nghĩa không, câu có tự nhiên không.
Chỉ ra từng lỗi (phần sai chép nguyên văn từ câu), cách sửa, giải thích ngắn bằng tiếng Việt.
"corrected": sửa tối thiểu, giữ ý của học viên. "better": 1-2 cách nói tự nhiên hơn, cùng ý, đơn giản.
Câu đúng và tự nhiên thì errors rỗng. Bỏ qua lỗi viết hoa đầu câu và thiếu dấu chấm cuối câu.`;

function cors(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

const LOOKUP_SCHEMA = {
  type: 'OBJECT',
  properties: {
    found: { type: 'BOOLEAN', description: 'false if this is not a real English word/phrase (typo or nonsense)' },
    suggestion: { type: 'STRING', description: 'if found=false: the most likely intended word, else empty' },
    word: { type: 'STRING', description: 'dictionary form (lemma), lowercase unless a proper noun' },
    pos: { type: 'STRING', enum: ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'pronoun', 'conjunction', 'determiner', 'interjection', 'phrase'] },
    phonetic: { type: 'STRING', description: 'IPA (US), in slashes' },
    meaning: { type: 'STRING', description: 'short natural Vietnamese meaning of this sense (max ~8 words)' },
    otherMeanings: { type: 'ARRAY', items: { type: 'STRING' }, description: '0-2 other common Vietnamese meanings' },
    definition: { type: 'STRING', description: 'simple English learner definition' },
    example: { type: 'STRING', description: 'natural simple English example sentence using this sense' },
    exampleVi: { type: 'STRING' },
    collocations: { type: 'ARRAY', items: { type: 'STRING' } },
    family: { type: 'ARRAY', items: { type: 'STRING' }, description: 'word family members like "decision (n)"' },
    cefr: { type: 'STRING', enum: ['A1', 'A2', 'B1', 'B2', 'C1'] },
  },
  required: ['found', 'suggestion', 'word', 'pos', 'phonetic', 'meaning', 'otherMeanings', 'definition', 'example', 'exampleVi', 'collocations', 'family', 'cefr'],
};

const LOOKUP_PROMPT = (word: string, context: string) =>
  `Tra từ tiếng Anh cho người Việt đang học: "${word}".${context ? `\nHọc viên gặp từ này trong câu: """${context}""" — chọn ĐÚNG nghĩa trong câu này.` : '\nChọn nghĩa phổ biến nhất.'}
Trả về dạng từ điển (lemma), từ loại, phiên âm IPA, nghĩa tiếng Việt ngắn gọn tự nhiên, định nghĩa tiếng Anh đơn giản,
1 câu ví dụ đơn giản dùng đúng nghĩa đó (kèm bản dịch), 2-3 cụm từ hay đi kèm, họ từ, và trình độ CEFR của nghĩa này.
Nếu không phải từ tiếng Anh có thật (gõ sai), đặt found=false và gợi ý từ đúng.`;

async function gemini(env: Env, prompt: string, schema: object): Promise<string | null> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) return null;
  const data: { candidates?: { content?: { parts?: { text?: string }[] } }[] } = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
}

const str = (body: object, key: string, max: number, optional = false): string | null => {
  const v: unknown = Object.entries(body).find(([k]) => k === key)?.[1];
  if (v === undefined && optional) return '';
  return typeof v === 'string' && v.length <= max && (optional || v.trim()) ? v.trim() : null;
};

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req.headers.get('Origin'), env);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    const path = new URL(req.url).pathname;
    if (req.method !== 'POST' || (path !== '/grade' && path !== '/lookup')) return json({ error: 'not found' }, 404);

    // Firebase ID token check: signed by Google, issued for our project.
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    try {
      await jwtVerify(token, JWKS, {
        issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
        audience: env.FIREBASE_PROJECT_ID,
      });
    } catch {
      return json({ error: 'unauthorized' }, 401);
    }

    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return json({ error: 'bad request' }, 400);

    let text: string | null;
    if (path === '/lookup') {
      const word = str(body, 'word', 60);
      const context = str(body, 'context', MAX_LEN, true);
      if (word === null || context === null) return json({ error: 'bad request' }, 400);
      text = await gemini(env, LOOKUP_PROMPT(word, context), LOOKUP_SCHEMA);
    } else {
      const sentence = str(body, 'sentence', MAX_LEN);
      const word = str(body, 'word', 60);
      const meaning = str(body, 'meaning', 200);
      if (sentence === null || word === null || meaning === null) return json({ error: 'bad request' }, 400);
      text = await gemini(env, PROMPT(sentence, word, meaning), SCHEMA);
    }
    if (!text) return json({ error: 'model error' }, 502);
    return new Response(text, { headers: { ...headers, 'Content-Type': 'application/json' } });
  },
};
