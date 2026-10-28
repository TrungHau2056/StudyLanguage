import { useState } from 'react';
import { Rating } from 'ts-fsrs';
import { addCard, db, review, type Settings, type Word } from '../db';
import { TOPICS, WordHead, WordInfo, useExtra } from '../ui';
import type { View } from '../App';

/** New words are shown in small batches, each followed straight away by a quiz (in Ôn tập). */
const BATCH = 5;

export default function Learn({ queue, settings, go }: { queue: Word[]; settings: Settings; go: (v: View) => void }) {
  const [seen, setSeen] = useState(0);
  const word = queue[0];
  const extra = useExtra(word);

  if (!word || seen >= BATCH) return (
    <section className="card center">
      <h2>{word ? `Bạn vừa xem ${seen} từ mới` : 'Đã đủ từ mới hôm nay'}</h2>
      <p>Giờ hãy <b>kiểm tra ngay</b>: tự nhớ lại vừa xong là cách nhanh nhất để từ “dính” vào đầu.</p>
      <div className="row">
        {word && <button onClick={() => setSeen(0)}>Xem thêm {Math.min(BATCH, queue.length)} từ</button>}
        <button className="primary" onClick={() => go('review')}>Kiểm tra các từ vừa học →</button>
      </div>
    </section>
  );

  const next = async (known: boolean) => {
    await addCard(word.id);
    if (known) {
      const card = await db.cards.get(word.id);
      if (card) await review(card, Rating.Easy);
    }
    setSeen((n) => n + 1);
  };

  return (
    <section className="card">
      <div className="hint">
        Từ {seen + 1}/{Math.min(BATCH, queue.length)} · {settings.topic === 'all' ? 'theo độ phổ biến' : TOPICS[settings.topic]}
      </div>
      <div className="progress"><div style={{ width: `${(100 * seen) / BATCH}%` }} /></div>
      <WordHead word={word} extra={extra} />
      <WordInfo word={word} />
      <p className="hint">👉 Bấm 🔊 nghe rồi đọc to theo, cả từ lẫn câu ví dụ.</p>
      <div className="row">
        <button onClick={() => next(true)}>Mình biết từ này rồi</button>
        <button className="primary" onClick={() => next(false)}>Đã hiểu, từ tiếp →</button>
      </div>
    </section>
  );
}
