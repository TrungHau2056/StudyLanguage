import { useMemo, useState } from 'react';
import { ArrowRight, Check, Volume2, X } from 'lucide-react';
import type { StudyCard, Word } from '../db';
import { Meter, WordHead, speak, useExtra, wordPattern } from '../ui';

const Mark = ({ ok }: { ok: boolean }) => (ok ? <Check className="icon" /> : <X className="icon" />);

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
  const [done, setDone] = useState(0);
  const word = pool.length ? pool[index % pool.length] : undefined;
  const extra = useExtra(word);

  if (!word) return (
    <section className="empty"><h2>Chưa có từ để viết</h2><p>Học vài từ mới trước, rồi quay lại đây đặt câu.</p></section>
  );

  const usesWord = wordPattern(word.word).test(text);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const next = () => { setIndex((i) => i + 1 + Math.floor(Math.random() * 3)); setText(''); setChecked(false); };

  return (
    <section className="entry">
      <Meter value={Math.min(done, 3)} total={3}>Đã viết {done} câu</Meter>
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
          <button className="primary" disabled={!text.trim()} onClick={() => {
            setChecked(true);
            setDone((n) => n + 1);
            if (usesWord) onWritten(); // only sentences that really use the word count toward the goal
          }}>Xong</button>
        </div>
      ) : (
        <>
          <ul className="checklist">
            <li className={usesWord ? 'ok' : 'bad'}><Mark ok={usesWord} /> Câu có dùng “{word.word}”</li>
            <li className={words >= 6 ? 'ok' : 'bad'}><Mark ok={words >= 6} /> Câu đủ dài (từ 6 từ trở lên)</li>
          </ul>
          <div className="ex">
            <span className="lbl">Câu mẫu</span>
            <button onClick={() => speak(word.example)} title="Nghe">{word.example}</button>
            <div className="ex-vi">{word.exampleVi}</div>
          </div>
          <p className="hint">So với câu mẫu: cách dùng từ, giới từ đi kèm, thì của động từ đã giống chưa? Đọc to câu của bạn 2 lần.</p>
          <div className="actions">
            <button onClick={() => speak(text)}><Volume2 className="icon" /> Nghe câu của tôi</button>
            <button className="primary" onClick={next}>Từ tiếp <ArrowRight className="icon" /></button>
          </div>
        </>
      )}
    </section>
  );
}
