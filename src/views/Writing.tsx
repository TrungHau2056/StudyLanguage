import { useMemo, useState, type ReactNode } from 'react';
import { checkGrammar, type Issue } from '../grammarCheck';
import { ArrowRight, Check, Volume2, X } from 'lucide-react';
import type { StudyCard, Word } from '../db';
import { Meter, Tip, WordHead, speak, useExtra, wordPattern } from '../ui';

const Mark = ({ ok }: { ok: boolean }) => (ok ? <Check className="icon" /> : <X className="icon" />);

/** The sentence with each detected mistake marked. */
function highlight(text: string, issues: Issue[]): ReactNode[] {
  const out: ReactNode[] = [];
  let at = 0;
  for (const [i, it] of [...issues].sort((a, b) => a.offset - b.offset).entries()) {
    if (it.offset < at) continue; // overlapping matches: keep the first
    out.push(text.slice(at, it.offset), <mark key={i} className="err">{text.slice(it.offset, it.offset + it.length)}</mark>);
    at = it.offset + it.length;
  }
  out.push(text.slice(at));
  return out;
}

/** Output practice: write your own sentence with a recently studied word, then compare with a model sentence. */
export default function Writing({ cards, byId, onWritten }: { cards: StudyCard[]; byId: Map<number, Word>; onWritten: () => void }) {
  // Most recently studied words first: they benefit most from being used right away.
  const pool = useMemo(
    () => [...cards].sort((a, b) => +(b.last_review ?? b.addedAt) - +(a.last_review ?? a.addedAt)).slice(0, 30)
      .map((c) => byId.get(c.wordId)).filter((w): w is Word => !!w),
    [cards, byId],
  );
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);
  /** Grammar/spelling issues of the checked sentence; null = the checker was unreachable. */
  const [issues, setIssues] = useState<Issue[] | null>([]);
  const [done, setDone] = useState(0);
  const word = pool.length ? pool[index % pool.length] : undefined;
  const extra = useExtra(word);

  if (!word) return (
    <section className="empty"><h2>Chưa có từ để viết</h2><p>Học vài từ mới trước, rồi quay lại đây đặt câu.</p></section>
  );

  const usesWord = wordPattern(word.word).test(text);
  const next = () => { setIndex((i) => i + 1 + Math.floor(Math.random() * 3)); setText(''); setChecked(false); setIssues([]); };
  const check = async () => {
    setChecking(true);
    const found = await checkGrammar(text.trim());
    setChecking(false);
    setIssues(found);
    setChecked(true);
    setDone((n) => n + 1);
    // Counts toward today's goal only when the sentence uses the word and has no detected mistakes.
    if (usesWord && (found === null || found.length === 0)) onWritten();
  };
  const correct = issues !== null && issues.length === 0;

  return (
    <section className="entry">
      <Meter value={Math.min(done, 3)} total={3}>Đã viết {done} câu</Meter>
      <Tip id="write">
        Dùng được từ thì mới nhớ lâu. Viết một câu ngắn có từ này, tốt nhất là về chính bạn
        (ví dụ “I eat rice every day”). Bấm Kiểm tra: web chỉ ra lỗi ngữ pháp, chính tả để bạn sửa, rồi so với câu mẫu. Mỗi ngày 3 câu đúng.
      </Tip>
      <WordHead word={word} extra={extra} />
      <div className="sense"><span className="num">1</span>{word.meaning}</div>
      {word.collocations.length > 0 && (
        <div className="colls"><span className="lbl">Gợi ý cụm</span>{word.collocations.join(' · ')}</div>
      )}
      <textarea rows={3} value={text} aria-label="Câu của bạn" placeholder={`Viết một câu có “${word.word}”, tốt nhất là về chính cuộc sống của bạn`}
        onChange={(e) => { setText(e.target.value); setChecked(false); }} />
      {!checked ? (
        <div className="actions">
          <button onClick={next}>Bỏ qua</button>
          <button className="primary" disabled={!text.trim() || checking} onClick={check}>{checking ? 'Đang kiểm tra…' : 'Kiểm tra'}</button>
        </div>
      ) : (
        <>
          <ul className="checklist">
            <li className={usesWord ? 'ok' : 'bad'}><Mark ok={usesWord} /> Câu có dùng “{word.word}”</li>
            {issues === null
              ? <li className="hint">Không kiểm tra được ngữ pháp lúc này (mất mạng?). Hãy tự so với câu mẫu.</li>
              : <li className={correct ? 'ok' : 'bad'}><Mark ok={correct} /> {correct ? 'Không thấy lỗi ngữ pháp, chính tả' : `Có ${issues.length} lỗi cần sửa`}</li>}
          </ul>
          {issues && issues.length > 0 && (
            <>
              <p className="passage marked">{highlight(text, issues)}</p>
              <ol className="issues">
                {issues.map((it, i) => (
                  <li key={i}>
                    <b>“{text.slice(it.offset, it.offset + it.length)}”</b>
                    {it.replacements.length > 0 && <> → <span className="ok">{it.replacements.join(' / ')}</span></>}
                    <div className="hint">{it.message}</div>
                  </li>
                ))}
              </ol>
              <p className="hint">Sửa câu trong ô phía trên rồi bấm Kiểm tra lại.</p>
            </>
          )}
          <div className="ex">
            <span className="lbl">Câu mẫu</span>
            <button onClick={() => speak(word.example)} title="Nghe">{word.example}</button>
            <div className="ex-vi">{word.exampleVi}</div>
          </div>
          <p className="hint">So với câu mẫu: cách dùng từ, giới từ đi kèm, thì của động từ đã giống chưa? Đọc to câu của bạn 2 lần.</p>
          <div className="actions">
            <button onClick={() => speak(text)}><Volume2 className="icon" /> Nghe câu của tôi</button>
            {issues && issues.length > 0
              ? <button className="primary" onClick={() => setChecked(false)}>Sửa lại</button>
              : <button className="primary" onClick={next}>Từ tiếp <ArrowRight className="icon" /></button>}
          </div>
        </>
      )}
    </section>
  );
}
