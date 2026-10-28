import { useMemo, useState, type ReactNode } from 'react';
import { gradeSentence, type Grade, type Issue } from '../grammarCheck';
import { ArrowRight, Check, Sparkles, Volume2, X } from 'lucide-react';
import type { StudyCard, Word } from '../db';
import { Meter, Tip, WordHead, speak, useExtra, wordPattern } from '../ui';

const Mark = ({ ok }: { ok: boolean }) => (ok ? <Check className="icon" /> : <X className="icon" />);

/** The sentence with each mistake marked (first occurrence of each wrong fragment). */
function highlight(text: string, issues: Issue[]): ReactNode[] {
  const spans = issues
    .map((it) => ({ at: text.toLowerCase().indexOf(it.wrong.toLowerCase()), len: it.wrong.length }))
    .filter((s) => s.at >= 0 && s.len > 0)
    .sort((a, b) => a.at - b.at);
  const out: ReactNode[] = [];
  let at = 0;
  for (const [i, s] of spans.entries()) {
    if (s.at < at) continue; // overlapping: keep the first
    out.push(text.slice(at, s.at), <mark key={i} className="err">{text.slice(s.at, s.at + s.len)}</mark>);
    at = s.at + s.len;
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
  /** Result of the last check; null = no checker reachable (offline). */
  const [grade, setGrade] = useState<Grade | null>(null);
  const [done, setDone] = useState(0);
  const word = pool.length ? pool[index % pool.length] : undefined;
  const extra = useExtra(word);

  if (!word) return (
    <section className="empty"><h2>Chưa có từ để viết</h2><p>Học vài từ mới trước, rồi quay lại đây đặt câu.</p></section>
  );

  const usesWord = wordPattern(word.word).test(text);
  const next = () => { setIndex((i) => i + 1 + Math.floor(Math.random() * 3)); setText(''); setChecked(false); setGrade(null); };
  const check = async () => {
    setChecking(true);
    const g = await gradeSentence(text.trim(), word.word, word.meaning);
    setChecking(false);
    setGrade(g);
    setChecked(true);
    setDone((n) => n + 1);
    // Counts toward today's goal only when the sentence uses the word (in its meaning) and has no mistakes.
    if (usesWord && (g === null || (g.issues.length === 0 && g.usesWordCorrectly !== false))) onWritten();
  };
  const issues = grade?.issues ?? [];
  const correct = grade !== null && issues.length === 0 && grade.usesWordCorrectly !== false;

  return (
    <section className="entry">
      <Meter value={Math.min(done, 3)} total={3}>Đã viết {done} câu</Meter>
      <Tip id="write">
        Dùng được từ thì mới nhớ lâu. Viết một câu ngắn có từ này, tốt nhất là về chính bạn
        (ví dụ “I eat rice every day”). Bấm Kiểm tra: AI chấm câu, chỉ lỗi và giải thích bằng tiếng Việt, gợi ý cách viết tự nhiên hơn. Mỗi ngày 3 câu đúng.
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
            <li className={usesWord && grade?.usesWordCorrectly !== false ? 'ok' : 'bad'}>
              <Mark ok={usesWord && grade?.usesWordCorrectly !== false} />
              {!usesWord ? `Câu chưa có “${word.word}”` : grade?.usesWordCorrectly === false ? `Dùng “${word.word}” chưa đúng nghĩa` : `Dùng đúng “${word.word}”`}
            </li>
            {grade === null
              ? <li className="hint">Không kiểm tra được lúc này (mất mạng?). Hãy tự so với câu mẫu.</li>
              : <li className={issues.length === 0 ? 'ok' : 'bad'}><Mark ok={issues.length === 0} /> {issues.length === 0 ? 'Không có lỗi ngữ pháp, chính tả' : `Có ${issues.length} lỗi cần sửa`}</li>}
          </ul>
          {grade?.comment && <p className="grade-comment"><Sparkles className="icon" /> {grade.comment}</p>}
          {issues.length > 0 && (
            <>
              <p className="passage marked">{highlight(text, issues)}</p>
              <ol className="issues">
                {issues.map((it, i) => (
                  <li key={i}>
                    <s className="bad">{it.wrong}</s>
                    {it.fixes.length > 0 && <> → <b className="ok">{it.fixes.join(' / ')}</b></>}
                    <div className="hint">{it.why}</div>
                  </li>
                ))}
              </ol>
            </>
          )}
          {grade?.corrected && !correct && (
            <div className="ex">
              <span className="lbl">Câu đã sửa</span>
              <button onClick={() => speak(grade.corrected!)} title="Nghe">{grade.corrected}</button>
            </div>
          )}
          {grade?.better && grade.better.length > 0 && (
            <div className="ex">
              <span className="lbl">Cách nói tự nhiên hơn</span>
              {grade.better.map((b) => <div key={b}><button onClick={() => speak(b)} title="Nghe">{b}</button></div>)}
            </div>
          )}
          <div className="ex">
            <span className="lbl">Câu mẫu</span>
            <button onClick={() => speak(word.example)} title="Nghe">{word.example}</button>
            <div className="ex-vi">{word.exampleVi}</div>
          </div>
          {grade?.source === 'languagetool' && <p className="hint">Đang chấm bằng công cụ dự phòng (chỉ ngữ pháp, chính tả). Đăng nhập để được AI chấm chi tiết.</p>}
          <div className="actions">
            <button onClick={() => speak(text)}><Volume2 className="icon" /> Nghe câu của tôi</button>
            {!correct && grade !== null
              ? <button className="primary" onClick={() => setChecked(false)}>Sửa lại</button>
              : <button className="primary" onClick={next}>Từ tiếp <ArrowRight className="icon" /></button>}
          </div>
        </>
      )}
    </section>
  );
}
