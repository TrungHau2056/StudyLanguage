import { Rating } from 'ts-fsrs';
import { addCard, db, review, type Settings, type Word } from '../db';
import { TOPICS, WordHead, WordInfo, useExtra } from '../ui';
import type { View } from '../App';

export default function Learn({ queue, settings, go }: { queue: Word[]; settings: Settings; go: (v: View) => void }) {
  const word = queue[0];
  const extra = useExtra(word);
  if (!word) return (
    <section className="center">
      <p>Đã đủ từ mới hôm nay. Chuyển sang ôn tập để ghi nhớ.</p>
      <button className="primary" onClick={() => go('review')}>Ôn tập</button>
    </section>
  );
  const markKnown = async () => {
    await addCard(word.id);
    const card = await db.cards.get(word.id);
    if (card) await review(card, Rating.Easy);
  };
  return (
    <section className="card">
      <div className="hint">
        Còn {queue.length} từ mới · {settings.topic === 'all' ? 'theo tần suất' : TOPICS[settings.topic]} ·{' '}
        <a onClick={() => go('settings')}>đổi</a>
      </div>
      <WordHead word={word} extra={extra} />
      <WordInfo word={word} />
      <p className="hint">Đọc to từ, câu ví dụ và cụm từ. Thử tự nghĩ thêm một câu của riêng bạn.</p>
      <div className="row">
        <button onClick={markKnown}>Đã biết rồi</button>
        <button className="primary" onClick={() => addCard(word.id)}>Học từ này →</button>
      </div>
    </section>
  );
}
