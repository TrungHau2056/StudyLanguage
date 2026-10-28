import { useMemo, useState } from 'react';
import type { StudyCard, Word } from '../db';
import { WordHead, speak, useExtra, wordPattern } from '../ui';

/** Output practice: write your own sentence with a recently studied word, then compare with a model sentence. */
export default function Writing({ cards, byId }: { cards: StudyCard[]; byId: Map<number, Word> }) {
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

  if (!word) return <section className="center"><p>Hãy học vài từ trước, rồi quay lại luyện viết.</p></section>;

  const usesWord = wordPattern(word.word).test(text);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const next = () => { setIndex((i) => i + 1 + Math.floor(Math.random() * 3)); setText(''); setChecked(false); };

  return (
    <section className="card">
      <div className="hint">Đặt một câu của riêng bạn với từ này · đã viết {done} câu trong buổi này</div>
      <WordHead word={word} extra={extra} />
      <div className="meaning">{word.meaning}</div>
      {word.collocations.length > 0 && (
        <div className="chips"><span className="def">Gợi ý cụm:</span>{word.collocations.map((c) => <span key={c} className="chip">{c}</span>)}</div>
      )}
      <textarea rows={3} value={text} placeholder={`Viết câu có “${word.word}”, tốt nhất là về chính cuộc sống của bạn…`}
        onChange={(e) => { setText(e.target.value); setChecked(false); }} />
      {!checked ? (
        <div className="row">
          <button onClick={next}>Bỏ qua</button>
          <button className="primary" disabled={!text.trim()} onClick={() => { setChecked(true); setDone((n) => n + 1); }}>Xong</button>
        </div>
      ) : (
        <>
          <ul className="checklist">
            <li className={usesWord ? 'ok' : 'bad'}>{usesWord ? '✔' : '✘'} Câu có dùng “{word.word}”</li>
            <li className={words >= 6 ? 'ok' : 'bad'}>{words >= 6 ? '✔' : '✘'} Câu đủ dài (≥ 6 từ)</li>
          </ul>
          <div className="example" onClick={() => speak(word.example)}>
            Câu mẫu: 🔊 {word.example}
            <div className="def">{word.exampleVi}</div>
          </div>
          <p className="hint">So sánh với câu mẫu: cách dùng từ, giới từ đi kèm, thì của động từ đã giống chưa? Đọc to câu của bạn 2 lần.</p>
          <div className="row">
            <button onClick={() => speak(text)}>🔊 Nghe câu của tôi</button>
            <button className="primary" onClick={next}>Từ tiếp theo →</button>
          </div>
        </>
      )}
    </section>
  );
}
