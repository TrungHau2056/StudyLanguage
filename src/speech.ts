import { normalize } from './content';

interface RecognitionAlternative { transcript: string; confidence: number }
interface RecognitionResultEvent { results: ArrayLike<ArrayLike<RecognitionAlternative>> }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
}
type RecognitionCtor = new () => Recognition;

const w = typeof window === 'undefined' ? undefined
  : (window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor });
const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;

export const speechSupported = !!Ctor;

export function listenOnce(lang = 'en-US'): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!Ctor) { reject(new Error('Trình duyệt này chưa hỗ trợ nhận giọng nói.')); return; }
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let done = false;
    rec.onresult = (e) => {
      done = true;
      const alt = e.results[0]?.[0];
      if (alt?.transcript) resolve(alt.transcript);
      else reject(new Error('Không nghe thấy gì, hãy thử lại.'));
    };
    rec.onerror = (e) => {
      done = true;
      reject(new Error(
        e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Bạn chưa cho phép dùng micro.'
          : e.error === 'no-speech' ? 'Không nghe thấy gì, hãy thử lại.'
            : 'Không nhận được giọng nói, hãy thử lại.',
      ));
    };
    rec.onend = () => { if (!done) reject(new Error('Không nghe thấy gì, hãy thử lại.')); };
    rec.start();
  });
}

/** Marks each target word heard, aligning by longest common subsequence so order matters. */
export function scoreSpeech(target: string, heard: string) {
  const shown = target.split(/\s+/).filter(Boolean);
  const t = shown.map((x) => normalize(x));
  const h = normalize(heard).split(/\s+/).filter(Boolean);
  const dp = Array.from({ length: t.length + 1 }, () => new Array<number>(h.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--)
    for (let j = h.length - 1; j >= 0; j--)
      dp[i][j] = t[i] && t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array<boolean>(t.length).fill(false);
  let i = 0, j = 0;
  while (i < t.length && j < h.length) {
    if (t[i] && t[i] === h[j]) { ok[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const words = shown.map((text, k) => ({ text, ok: ok[k] || !t[k] }));
  const counted = t.filter(Boolean).length;
  const ratio = counted ? ok.filter(Boolean).length / counted : 0;
  return { words, ratio };
}
