import { useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { addCard, markKnown, type Settings, type Word } from '../db';
import { Meter, TOPICS, Tip, WordHead, WordInfo, meaningOptions, useExtra } from '../ui';
import type { View } from '../App';

/** New words are shown in small batches, each followed straight away by a quiz (in Ôn tập). */
const BATCH = 5;

interface Props { queue: Word[]; words: Word[]; settings: Settings; go: (v: View) => void }

export default function Learn({ queue, words, settings, go }: Props) {
  const [seen, setSeen] = useState(0);
  // "Đã biết" must be proven: pick the meaning before the word leaves the queue for good.
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState<string>();
  const word = queue[0];
  const extra = useExtra(word);
  const options = useMemo(() => (word ? meaningOptions(word, words) : []), [word, words]);

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

  const advance = () => { setSeen((n) => n + 1); setChecking(false); setPicked(undefined); };
  const learn = async () => { await addCard(word.id); advance(); };
  const right = picked === word.meaning;
  const batch = Math.min(BATCH, seen + queue.length);

  if (checking) return (
    <section className="entry">
      <Meter value={seen} total={batch}>Kiểm tra nhanh</Meter>
      <div className="hw-line"><span className="hw">{word.word}</span></div>
      <p className="prompt">Bạn nói đã biết từ này. Chọn đúng nghĩa thì từ sẽ được xếp vào “Đã biết” và không phải học hay ôn lại.</p>
      <div className="options">
        {options.map((o) => (
          <button key={o} disabled={!!picked} onClick={() => setPicked(o)}
            className={picked ? (o === word.meaning ? 'right' : o === picked ? 'wrong' : '') : ''}>{o}</button>
        ))}
      </div>
      {picked && (
        <>
          <p className={`verdict ${right ? 'ok' : 'bad'}`}>
            {right ? <><Check className="icon" /> Đúng rồi, từ này đã vào mục Đã biết.</> : <><X className="icon" /> Chưa đúng, mình sẽ học từ này nhé.</>}
          </p>
          <div className="actions">
            <button className="primary" onClick={async () => {
              if (right) { await markKnown([word.id], 'self'); advance(); } else await learn();
            }}>Tiếp <ArrowRight className="icon" /></button>
          </div>
        </>
      )}
      {!picked && <div className="actions"><button onClick={() => setChecking(false)}>Quay lại</button></div>}
    </section>
  );

  return (
    <section className="entry">
      <Meter value={seen} total={batch}>
        Từ {seen + 1}/{batch} · {word.cefr}{settings.topic !== 'all' && ` · ${TOPICS[settings.topic]}`}
      </Meter>
      <Tip id="learn">
        Bấm nút loa để nghe, rồi <b>đọc to</b> từ và câu ví dụ. Từ nào bạn đã biết thì bấm “Đã biết từ này”:
        trả lời đúng nghĩa là từ đó được bỏ qua luôn. Mỗi lần 5 từ, xong sẽ kiểm tra ngay.
        Chưa đọc được phiên âm? <a onClick={() => go('sounds')}>Xem cách đọc phiên âm</a>.
      </Tip>
      <WordHead word={word} extra={extra} />
      <WordInfo key={word.id} word={word} compact />
      <div className="actions">
        <button onClick={() => setChecking(true)}>Đã biết từ này</button>
        <button className="primary" onClick={learn}>Đã hiểu, từ tiếp <ArrowRight className="icon" /></button>
      </div>
    </section>
  );
}
