import { useEffect, useMemo, useState } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import { Rating, type Grade } from 'ts-fsrs';
import { previewIntervals, review, type StudyCard, type Word } from '../db';
import { Meter, Tip, WordHead, WordInfo, editDistance, meaningOptions, playWord, posAbbr, useExtra, wordPattern } from '../ui';
import SpotCheck from './SpotCheck';

type Mode = 'choice' | 'recognize' | 'listen' | 'type';

const MODE_LABEL: Record<Mode, string> = {
  choice: 'Chọn nghĩa đúng',
  recognize: 'Nhớ nghĩa',
  listen: 'Nghe và gõ lại từ',
  type: 'Nhớ từ tiếng Anh',
};

/** Easier modes for young cards, harder (production) modes once the word is familiar. */
function pickMode(card: StudyCard): Mode {
  const pool: Mode[] = card.reps === 0 ? ['choice'] : card.reps < 3 ? ['choice', 'recognize', 'listen'] : ['recognize', 'listen', 'type', 'type'];
  return pool[Math.floor(Math.random() * pool.length)];
}

const GRADES: [Grade, string, string, string][] = [
  [Rating.Again, 'Quên', 'again', 'không nhớ ra'],
  [Rating.Hard, 'Khó', 'hard', 'nghĩ lâu mới ra'],
  [Rating.Good, 'Nhớ', 'good', 'nhớ ra bình thường'],
  [Rating.Easy, 'Dễ', 'easy', 'nhớ ngay lập tức'],
];

interface Props {
  due: StudyCard[]; byId: Map<number, Word>; cards: StudyCard[]; words: Word[];
  /** Words assumed known, to verify with one quick question each once the due cards are done. */
  spot: Word[];
  onSpotDone: () => void;
}

/** Typos allowed in a typed answer: none for short words, one from 4 letters, two from 8. */
const typoBudget = (word: string) => (word.length >= 8 ? 2 : word.length >= 4 ? 1 : 0);

export default function Review({ due, byId, cards, words, spot, onSpotDone }: Props) {
  const card = due[0];
  const word = card && byId.get(card.wordId);
  const extra = useExtra(word);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [done, setDone] = useState(0);
  const mode = useMemo(() => (card ? pickMode(card) : 'recognize'), [card]);
  const options = useMemo(() => (word ? meaningOptions(word, words) : []), [word, words]);

  useEffect(() => { setRevealed(false); setAnswer(''); }, [card]);
  useEffect(() => {
    if (!word) return;
    if (mode === 'listen' && !revealed) playWord(word.word, extra);
    if (revealed && mode === 'type') playWord(word.word, extra);
  }, [word, extra, mode, revealed]);

  if (!card || !word) {
    if (spot.length) return <SpotCheck words={spot} all={words} onDone={onSpotDone} />;
    const soon = cards.filter((c) => c.due > new Date()).sort((a, b) => +a.due - +b.due)[0];
    return (
      <section className="empty">
        <h2>Không còn từ cần ôn lúc này</h2>
        {soon
          ? <p>Từ tiếp theo đến hạn lúc {soon.due.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {soon.due.toLocaleDateString('vi-VN')}.</p>
          : <p>Học vài từ mới, chúng sẽ xuất hiện ở đây để ôn.</p>}
      </section>
    );
  }

  const intervals = previewIntervals(card);
  const objective = mode !== 'recognize';
  const typed = answer.trim().toLowerCase();
  const target = word.word.toLowerCase();
  // A small typo still counts as remembering the word; the right spelling is shown, and "Dễ" is withheld.
  const near = mode !== 'choice' && typed !== target && typed.length > 0 && editDistance(typed, target) <= typoBudget(target);
  const correct = mode === 'choice' ? answer === word.meaning : typed === target || near;
  const submit = (value = answer) => { setAnswer(value); setRevealed(true); };
  const rate = async (g: Grade) => { await review(card, g); setDone((n) => n + 1); };

  return (
    <section className="entry">
      <Meter value={done} total={done + due.length}>Còn {due.length} · {MODE_LABEL[mode]}</Meter>
      <Tip id="review">
        Đây là phần ôn các từ đã học, đúng lúc bạn sắp quên. Luôn <b>tự nhớ ra trước</b> rồi mới xem đáp án.
        Sau đó chấm thật lòng: nhớ càng khó thì từ càng quay lại sớm. Gõ sai một chữ vẫn được tính là nhớ.
      </Tip>

      {(mode === 'choice' || mode === 'recognize' || revealed) && <WordHead word={word} extra={extra} />}
      {mode === 'recognize' && !revealed && <p className="prompt">Nghĩa của từ này là gì? Nghĩ ra rồi mới lật thẻ.</p>}

      {mode === 'choice' && (
        <div className="options">
          {options.map((o) => (
            <button key={o} disabled={revealed}
              className={revealed ? (o === word.meaning ? 'right' : o === answer ? 'wrong' : '') : ''}
              onClick={() => submit(o)}>
              {o}
            </button>
          ))}
        </div>
      )}

      {mode === 'listen' && !revealed && (
        <button className="listen" onClick={() => playWord(word.word, extra)}><Volume2 className="icon" /> Nghe lại</button>
      )}

      {mode === 'type' && !revealed && (
        <>
          <div className="sense"><span className="num">1</span>{word.meaning}</div>
          <div className="def en">{word.definition} <span className="pos">{posAbbr(word.pos)}</span></div>
          <div className="ex">{word.example.replace(wordPattern(word.word), '_____')}</div>
        </>
      )}

      {(mode === 'listen' || mode === 'type') && (
        <form id="answer" className="answer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input autoFocus value={answer} disabled={revealed} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            aria-label="Câu trả lời" placeholder={mode === 'listen' ? 'Gõ từ bạn nghe được' : 'Gõ từ tiếng Anh'} onChange={(e) => setAnswer(e.target.value)} />
        </form>
      )}

      {revealed && objective && (
        <p className={`verdict ${correct ? 'ok' : 'bad'}`}>
          {near ? <><Check className="icon" /> Gần đúng, viết đúng là “{word.word}”</>
            : correct ? <><Check className="icon" /> Chính xác</>
            : <><X className="icon" /> {mode === 'choice' || !answer ? 'Chưa đúng' : `Bạn gõ “${answer}”`}</>}
        </p>
      )}

      {revealed ? (
        <>
          <p className="grade-hint">
            {objective && !correct ? 'Không sao, từ này sẽ được hỏi lại sau ít phút.' : 'Bạn nhớ từ này dễ hay khó? Dòng dưới mỗi nút là khi nào hỏi lại.'}
          </p>
          <div className="grades">
            {GRADES
              // An objectively wrong answer is always "Quên"; a right one can't be.
              .filter(([g]) => !objective || (correct ? g !== Rating.Again : g === Rating.Again))
              .filter(([g]) => !near || g !== Rating.Easy)
              .map(([g, label, cls, help]) => (
                <button key={g} className={cls} onClick={() => rate(g)}>
                  <b>{label}</b><small>{help}</small><small>sau {intervals[g]}</small>
                </button>
              ))}
          </div>
          <WordInfo word={word} />
        </>
      ) : (
        <div className="actions">
          {mode === 'recognize' && <button className="primary" onClick={() => setRevealed(true)}>Lật thẻ</button>}
          {(mode === 'listen' || mode === 'type') && <>
            <button onClick={() => submit('')}>Không biết</button>
            <button className="primary" type="submit" form="answer">Kiểm tra</button>
          </>}
        </div>
      )}
    </section>
  );
}
