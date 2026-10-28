import { useEffect, useMemo, useState } from 'react';
import { Rating, type Grade } from 'ts-fsrs';
import { previewIntervals, review, type StudyCard, type Word } from '../db';
import { WordHead, WordInfo, playWord, shuffle, useExtra, wordPattern } from '../ui';

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

const GRADES: [Grade, string, string][] = [
  [Rating.Again, 'Quên', 'again'], [Rating.Hard, 'Khó', 'hard'], [Rating.Good, 'Nhớ', 'good'], [Rating.Easy, 'Dễ', 'easy'],
];

interface Props { due: StudyCard[]; byId: Map<number, Word>; cards: StudyCard[]; words: Word[] }

export default function Review({ due, byId, cards, words }: Props) {
  const card = due[0];
  const word = card && byId.get(card.wordId);
  const extra = useExtra(word);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState('');
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
      <section className="center">
        <p>✅ Không còn từ cần ôn lúc này.</p>
        {soon && <p className="hint">Từ tiếp theo đến hạn lúc {soon.due.toLocaleString('vi-VN')}</p>}
      </section>
    );
  }

  const intervals = previewIntervals(card);
  const objective = mode !== 'recognize';
  const correct = mode === 'choice' ? answer === String(word.id) : answer.trim().toLowerCase() === word.word.toLowerCase();
  const submit = (value = answer) => { setAnswer(value); setRevealed(true); };

  return (
    <section className="card">
      <div className="hint">Còn {due.length} từ · {MODE_LABEL[mode]}</div>

      {(mode === 'choice' || mode === 'recognize') && <WordHead word={word} extra={extra} />}
      {mode === 'recognize' && !revealed && <p className="hint">Nghĩa của từ này là gì? Nghĩ ra rồi mới lật thẻ.</p>}

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

      {mode === 'listen' && (
        <button className="big-listen" onClick={() => playWord(word.word, extra)}>🔊 Nghe lại</button>
      )}

      {mode === 'type' && (
        <>
          <div className="meaning">{word.meaning}</div>
          <div className="def">{word.pos} · {word.definition}</div>
          <div className="def">“{word.example.replace(wordPattern(word.word), '_____')}”</div>
        </>
      )}

      {(mode === 'listen' || mode === 'type') && (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input autoFocus value={answer} disabled={revealed} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            placeholder={mode === 'listen' ? 'Gõ từ bạn nghe được…' : 'Gõ từ tiếng Anh…'} onChange={(e) => setAnswer(e.target.value)} />
          {!revealed && <button className="primary full" type="submit">Kiểm tra</button>}
        </form>
      )}

      {revealed && objective && <p className={correct ? 'ok' : 'bad'}>{correct ? '✔ Chính xác' : mode === 'choice' ? '✘ Chưa đúng' : `✘ Bạn gõ: “${answer}”`}</p>}

      {revealed ? (
        <>
          {(mode === 'listen' || mode === 'type') && <WordHead word={word} extra={extra} />}
          <WordInfo word={word} />
          <div className="row grades">
            {GRADES
              // An objectively wrong answer is always "Quên"; a right one can't be.
              .filter(([g]) => !objective || (correct ? g !== Rating.Again : g === Rating.Again))
              .map(([g, label, cls]) => (
                <button key={g} className={cls} onClick={() => review(card, g)}>
                  {label}<small>{intervals[g]}</small>
                </button>
              ))}
          </div>
        </>
      ) : (
        mode === 'recognize' && <button className="primary" onClick={() => setRevealed(true)}>Lật thẻ</button>
      )}
      {!revealed && mode !== 'recognize' && mode !== 'choice' && (
        <a className="hint" onClick={() => submit('')}>Không biết, xem đáp án</a>
      )}
    </section>
  );
}
