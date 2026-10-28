import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Rating } from 'ts-fsrs';
import { addCard, db, review, type Settings, type Word } from '../db';
import { Meter, TOPICS, WordHead, WordInfo, useExtra } from '../ui';
import type { View } from '../App';

/** New words are shown in small batches, each followed straight away by a quiz (in Ôn tập). */
const BATCH = 5;

export default function Learn({ queue, settings, go }: { queue: Word[]; settings: Settings; go: (v: View) => void }) {
  const [seen, setSeen] = useState(0);
  const word = queue[0];
  const extra = useExtra(word);

  if (!word || seen >= BATCH) return (
    <section className="empty">
      <h2>{word ? `Bạn vừa xem ${seen} từ mới` : 'Đủ từ mới cho hôm nay'}</h2>
      <p>Giờ hãy kiểm tra ngay: tự nhớ lại vừa xong là cách nhanh nhất để từ ở lại trong đầu.</p>
      <div className="actions">
        {word && <button onClick={() => setSeen(0)}>Xem thêm {Math.min(BATCH, queue.length)} từ</button>}
        <button className="primary" onClick={() => go('review')}>Kiểm tra từ vừa học <ArrowRight className="icon" /></button>
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

  const batch = Math.min(BATCH, seen + queue.length);
  return (
    <section className="entry">
      <Meter value={seen} total={batch}>
        Từ {seen + 1}/{batch}{settings.topic !== 'all' && ` · ${TOPICS[settings.topic]}`}
      </Meter>
      <WordHead word={word} extra={extra} />
      <WordInfo word={word} />
      <p className="hint">Bấm nghe rồi đọc to theo, cả từ lẫn câu ví dụ.</p>
      <div className="actions">
        <button onClick={() => next(true)}>Đã biết từ này</button>
        <button className="primary" onClick={() => next(false)}>Từ tiếp <ArrowRight className="icon" /></button>
      </div>
    </section>
  );
}
