import { useEffect, useMemo, useState } from 'react';
import { Check, Volume2, X } from 'lucide-react';
import { Rating, type Grade } from 'ts-fsrs';
import { previewIntervals, review, type StudyCard, type Word } from '../db';
import { Meter, WordHead, WordInfo, playWord, posAbbr, shuffle, useExtra, wordPattern } from '../ui';

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

interface Props { due: StudyCard[]; byId: Map<number, Word>; cards: StudyCard[]; words: Word[] }

export default function Review({ due, byId, cards, words }: Props) {
  const card = due[0];
  const word = card && byId.get(card.wordId);
  const extra = useExtra(word);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
  const [done, setDone] = useState(0);
  const mode = useMemo(() => (card ? pickMode(card) : 'recognize'), [card]);
  const options = useMemo(() => {
    if (!word) return [];
    // Distractors share the part of speech so the answer can't be guessed from grammar.
    const pool = words.filter((w) => w.id !== word.id && w.pos === word.pos);
    return shuffle([word, ...shuffle(pool).slice(0, 3)]);
  }, [word, words]);

  useEffect(() => { setRevealed(false); setAnswer(''); }, [card]);
  useEffect(() => {
    if (!word) return;
    if (mode === 'listen' && !revealed) playWord(word.word, extra);
    if (revealed && mode === 'type') playWord(word.word, extra);
  }, [word, extra, mode, revealed]);

  if (!card || !word) {
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
  const correct = mode === 'choice' ? answer === String(word.id) : answer.trim().toLowerCase() === word.word.toLowerCase();
  const submit = (value = answer) => { setAnswer(value); setRevealed(true); };
  const rate = async (g: Grade) => { await review(card, g); setDone((n) => n + 1); };

  return (
    <section className="entry">
      <Meter value={done} total={done + due.length}>Còn {due.length} · {MODE_LABEL[mode]}</Meter>

      {(mode === 'choice' || mode === 'recognize' || revealed) && <WordHead word={word} extra={extra} />}
      {mode === 'recognize' && !revealed && <p className="prompt">Nghĩa của từ này là gì? Nghĩ ra rồi mới lật thẻ.</p>}

      {mode === 'choice' && (
        <div className="options">
          {options.map((o) => (
            <button key={o.id} disabled={revealed}
              className={revealed ? (o.id === word.id ? 'right' : String(o.id) === answer ? 'wrong' : '') : ''}
              onClick={() => submit(String(o.id))}>
              {o.meaning}
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
          {correct ? <><Check className="icon" /> Chính xác</> : <><X className="icon" /> {mode === 'choice' || !answer ? 'Chưa đúng' : `Bạn gõ “${answer}”`}</>}
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
