import { useMemo, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { confirmKnown, relearn, type Word } from '../db';
import { Meter, meaningOptions } from '../ui';

/**
 * Quick check of words the app assumes you know (marked known, or skipped by level/test).
 * Right: stays known, not asked again for a month. Wrong: goes back into learning.
 */
export default function SpotCheck({ words, all, onDone }: { words: Word[]; all: Word[]; onDone: () => void }) {
  const [list] = useState(words); // freeze the set; answering changes the props underneath
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<string>();
  const [wrong, setWrong] = useState<string[]>([]);
  const word = list[i];
  const options = useMemo(() => (word ? meaningOptions(word, all) : []), [word, all]);

  if (!word) return (
    <section className="empty">
      <h2>Xong phần kiểm tra nhanh</h2>
      <p>{wrong.length
        ? `Có ${wrong.length} từ bạn chưa nhớ (${wrong.join(', ')}); chúng đã được đưa lại vào phần học.`
        : 'Bạn vẫn nhớ hết các từ đã biết. Mai sẽ kiểm tra vài từ khác.'}</p>
      <div className="actions"><button className="primary" onClick={onDone}>Xong</button></div>
    </section>
  );

  const right = picked === word.meaning;
  const next = async () => {
    if (right) {
      // Skipped words that pass become "known" for real; already-known ones just get a fresh check date.
      await confirmKnown(word.id, 'test');
    } else {
      await relearn(word.id);
      setWrong((w) => [...w, word.word]);
    }
    setPicked(undefined);
    setI((n) => n + 1);
  };

  return (
    <section className="entry">
      <Meter value={i} total={list.length}>Kiểm tra từ đã biết · {i + 1}/{list.length}</Meter>
      <p className="prompt">Đây là những từ web đang coi là bạn đã biết. Trả lời nhanh để chắc chắn là vẫn nhớ.</p>
      <div className="hw-line"><span className="hw">{word.word}</span></div>
      <div className="options">
        {options.map((o) => (
          <button key={o} disabled={!!picked} onClick={() => setPicked(o)}
            className={picked ? (o === word.meaning ? 'right' : o === picked ? 'wrong' : '') : ''}>{o}</button>
        ))}
        {!picked && <button className="quiet" onClick={() => setPicked('?')}>Không nhớ</button>}
      </div>
      {picked && (
        <>
          <p className={`verdict ${right ? 'ok' : 'bad'}`}>
            {right ? <><Check className="icon" /> Vẫn nhớ, giữ ở mục Đã biết.</> : <><X className="icon" /> Từ này sẽ được học lại.</>}
          </p>
          <div className="actions"><button className="primary" onClick={next}>Tiếp <ArrowRight className="icon" /></button></div>
        </>
      )}
    </section>
  );
}
