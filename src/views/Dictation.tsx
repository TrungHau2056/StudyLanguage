import { useEffect, useState } from 'react';
import { Check, Snail, Volume2, X } from 'lucide-react';
import { normalize } from '../content';
import { Meter, SpeakButton, Tip, speak } from '../ui';
import './dictation.css';

type Sentence = { en: string; vi: string };
type Result = { words: { text: string; ok: boolean }[]; extra: string[]; hit: number; total: number };

/** Word-level LCS between the original sentence and what was typed. */
function grade(en: string, typed: string): Result {
  const words = en.split(/\s+/).map((text) => ({ text, key: normalize(text) })).filter((w) => w.key);
  const given = normalize(typed).split(' ').filter(Boolean);
  const n = words.length, m = given.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = words[i].key === given[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ok = new Array<boolean>(n).fill(false);
  const extra: string[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (words[i].key === given[j]) { ok[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else extra.push(given[j++]);
  }
  extra.push(...given.slice(j));
  return { words: words.map((w, k) => ({ text: w.text, ok: ok[k] })), extra, hit: dp[0][0], total: n };
}

export default function Dictation({ sentences, onDone }: { sentences: Sentence[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const current = sentences[index];

  useEffect(() => { if (current) speak(current.en, 0.85); }, [current]);

  if (!sentences.length) return (
    <section className="empty">
      <h2>Chưa có câu để nghe</h2>
      <p>Học vài từ hoặc mẫu câu trước để có câu nghe chép.</p>
    </section>
  );

  if (!current) {
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / Math.max(scores.length, 1));
    return (
      <section className="entry">
        <h2>Xong bài nghe chép</h2>
        <p className="prompt">Trung bình bạn nghe đúng {avg}% số từ.</p>
        <p className="hint">Hãy nghe lại các câu còn sai và đọc to theo vài lần để quen tai.</p>
        <div className="actions"><button className="primary" onClick={onDone}>Xong</button></div>
      </section>
    );
  }

  const check = (typed: string) => {
    const r = grade(current.en, typed);
    setResult(r);
    setScores((s) => [...s, r.total ? (r.hit / r.total) * 100 : 0]);
  };
  const next = () => { setIndex((i) => i + 1); setAnswer(''); setResult(null); };

  return (
    <section className="entry">
      <Meter value={index} total={sentences.length}>Câu {index + 1}/{sentences.length}</Meter>
      <Tip id="dictation">
        Nghe câu rồi gõ lại đúng những gì nghe được. Không cần lo viết hoa hay dấu câu.
      </Tip>

      <div className="row">
        <button className="listen" onClick={() => speak(current.en, 0.85)}><Volume2 className="icon" /> Nghe</button>
        <button className="small" onClick={() => speak(current.en, 0.6)}><Snail className="icon" /> Nghe chậm</button>
      </div>

      <form id="dictation" onSubmit={(e) => { e.preventDefault(); check(answer); }}>
        <textarea className="dictation-input" autoFocus rows={3} value={answer} disabled={!!result}
          autoCapitalize="off" autoCorrect="off" spellCheck={false} aria-label="Câu bạn nghe được"
          placeholder="Gõ câu bạn nghe được" onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(answer); } }} />
      </form>

      {result ? (
        <>
          <p className={`verdict ${result.hit === result.total ? 'ok' : 'bad'}`}>
            {result.hit === result.total ? <Check className="icon" /> : <X className="icon" />} Đúng {result.hit}/{result.total} từ
          </p>
          <div className="ex">
            <p className="dictation-words">
              {result.words.map((w, k) => <span key={k} className={w.ok ? '' : 'bad'}>{w.text} </span>)}
            </p>
            <div className="ex-vi">{current.vi}</div>
            <SpeakButton onClick={() => speak(current.en, 0.85)} label="Nghe lại câu" />
          </div>
          {result.extra.length > 0 && (
            <p className="hint">Gõ thừa hoặc sai: {result.extra.map((w, k) => <s key={k}>{w} </s>)}</p>
          )}
          <div className="actions"><button className="primary" onClick={next}>Tiếp</button></div>
        </>
      ) : (
        <div className="actions">
          <button onClick={() => check('')}>Không nghe được</button>
          <button className="primary" type="submit" form="dictation">Kiểm tra</button>
        </div>
      )}
    </section>
  );
}
