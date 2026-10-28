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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(req.headers.get('Origin'), env);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/grade') return json({ error: 'not found' }, 404);

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
    if (!body || typeof body !== 'object' || !('sentence' in body) || !('word' in body) || !('meaning' in body)) return json({ error: 'bad request' }, 400);
    const { sentence, word, meaning } = body;
    if (typeof sentence !== 'string' || typeof word !== 'string' || typeof meaning !== 'string'
      || !sentence.trim() || sentence.length > MAX_LEN || word.length > 40 || meaning.length > 200) return json({ error: 'bad request' }, 400);

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT(sentence.trim(), word, meaning) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    if (!res.ok) return json({ error: 'model error', status: res.status }, 502);
    const data: { candidates?: { content?: { parts?: { text?: string }[] } }[] } = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: 'empty response' }, 502);
    return new Response(text, { headers: { ...headers, 'Content-Type': 'application/json' } });
  },
};
