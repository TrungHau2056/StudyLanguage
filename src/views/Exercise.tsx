import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { matches, normalize, type Exercise } from '../content';
import { SpeakButton, editDistance, shuffle, speak } from '../ui';
import './grammar.css';

const BLANK = /_{2,}/;
const fill = (prompt: string, word: string) => prompt.replace(BLANK, word);

/** The correct English sentence to listen to after answering. */
function solution(ex: Exercise): string {
  switch (ex.type) {
    case 'gap': return fill(ex.prompt, ex.answers[0]);
    case 'choice': return BLANK.test(ex.prompt) ? fill(ex.prompt, ex.answers[0]) : ex.answers[0];
    case 'error': {
      let replaced = false;
      // Replace only the first token equal to the wrong word.
      return ex.prompt.split(' ').map((t) => {
        if (!replaced && normalize(t) === normalize(ex.answers[0])) { replaced = true; return t.replace(/[\p{L}\p{N}'’]+/u, ex.answers[1]); }
        return t;
      }).join(' ');
    }
    default: return ex.answers[0];
  }
}

export default function ExerciseCard({ ex, onNext }: { ex: Exercise; onNext: (correct: boolean) => void }) {
  return <Card key={`${ex.type}|${ex.prompt}`} ex={ex} onNext={onNext} />;
}

function Card({ ex, onNext }: { ex: Exercise; onNext: (correct: boolean) => void }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<number[]>([]); // order: chip indexes placed; error/choice: [index]
  const [answered, setAnswered] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const tokens = useMemo(() => ex.prompt.split(/\s+/).filter(Boolean), [ex]);
  const chips = useMemo(() => shuffle(tokens.map((t, i) => ({ t, i }))), [tokens]);
  const options = ex.options;

  const built = picked.map((i) => tokens[i]).join(' ');
  const hasInput = ex.type === 'gap' || ex.type === 'translate' ? text.trim() !== ''
    : ex.type === 'order' ? picked.length === tokens.length : picked.length > 0;

  let correct = false;
  let near = false;
  if (!gaveUp) {
    if (ex.type === 'gap') correct = matches(text, ex.answers);
    else if (ex.type === 'choice') correct = picked.length > 0 && matches(options[picked[0]], ex.answers);
    else if (ex.type === 'order') correct = matches(built, ex.answers);
    else if (ex.type === 'error') correct = picked.length > 0 && normalize(tokens[picked[0]]) === normalize(ex.answers[0]);
    else {
      correct = matches(text, ex.answers);
      if (!correct && text.trim()) {
        near = ex.answers.some((a) => editDistance(normalize(text), normalize(a)) <= 2);
        correct = near;
      }
    }
  }

  const check = () => { if (hasInput) setAnswered(true); };
  const typed = ex.type === 'gap' || ex.type === 'translate';

  return (
    <div className="exercise">
      {ex.type === 'gap' && <p className="prompt">Điền vào chỗ trống</p>}
      {ex.type === 'choice' && <p className="prompt">Chọn đáp án đúng</p>}
      {ex.type === 'order' && <p className="prompt">Chạm vào các từ để xếp thành câu đúng</p>}
      {ex.type === 'error' && <p className="prompt">Chạm vào từ bị sai trong câu</p>}
      {ex.type === 'translate' && <p className="prompt">Dịch sang tiếng Anh</p>}

      {(ex.type === 'gap' || ex.type === 'choice' || ex.type === 'translate') && <p className="q-sentence">{ex.prompt}</p>}

      {typed && (
        <form id="ex-answer" className="answer" onSubmit={(e) => { e.preventDefault(); check(); }}>
          <input autoFocus value={text} disabled={answered} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            aria-label="Câu trả lời" placeholder={ex.type === 'gap' ? 'Gõ từ còn thiếu' : 'Gõ câu tiếng Anh'}
            onChange={(e) => setText(e.target.value)} />
        </form>
      )}

      {ex.type === 'choice' && (
        <div className="options">
          {options.map((o, i) => (
            <button key={o} disabled={answered}
              className={answered ? (matches(o, ex.answers) ? 'right' : picked[0] === i ? 'wrong' : '') : picked[0] === i ? 'chosen' : ''}
              onClick={() => setPicked([i])}>{o}</button>
          ))}
        </div>
      )}

      {ex.type === 'order' && (
        <>
          <div className="built" aria-label="Câu bạn xếp">
            {picked.length === 0 && <span className="hint">Câu của bạn sẽ hiện ở đây</span>}
            {picked.map((i) => (
              <button key={i} className="chip" disabled={answered} title="Bỏ từ này"
                onClick={() => setPicked(picked.filter((p) => p !== i))}>{tokens[i]}</button>
            ))}
          </div>
          <div className="chips">
            {chips.filter((c) => !picked.includes(c.i)).map((c) => (
              <button key={c.i} className="chip" disabled={answered} onClick={() => setPicked([...picked, c.i])}>{c.t}</button>
            ))}
          </div>
        </>
      )}

      {ex.type === 'error' && (
        <div className="chips">
          {tokens.map((t, i) => {
            const wrongWord = normalize(t) === normalize(ex.answers[0]);
            const cls = answered ? (wrongWord ? 'chip right' : picked[0] === i ? 'chip wrong' : 'chip') : picked[0] === i ? 'chip chosen' : 'chip';
            return <button key={i} className={cls} disabled={answered} onClick={() => setPicked([i])}>{t}</button>;
          })}
        </div>
      )}

      {answered && (
        <>
          <p className={`verdict ${correct ? 'ok' : 'bad'}`}>
            {near ? <><Check className="icon" /> Gần đúng, chú ý chính tả</>
              : correct ? <><Check className="icon" /> Chính xác</>
              : <><X className="icon" /> Chưa đúng</>}
          </p>
          <div className="ex">
            {ex.type === 'error'
              ? <div>Sửa: <s className="bad">{ex.answers[0]}</s> → <b className="ok">{ex.answers[1]}</b></div>
              : <div>Đáp án: <b>{ex.answers[0]}</b>{ex.answers.length > 1 && <span className="ex-vi"> (cũng đúng: {ex.answers.slice(1).join('; ')})</span>}</div>}
            <div className="hw-line">
              <span>{solution(ex)}</span>
              <SpeakButton onClick={() => speak(solution(ex))} label="Nghe câu đúng" />
            </div>
          </div>
          {ex.explain && <p className="hint">{ex.explain}</p>}
        </>
      )}

      <div className="actions">
        {answered ? (
          <button className="primary" onClick={() => onNext(correct)}>Tiếp</button>
        ) : (
          <>
            <button onClick={() => { setGaveUp(true); setAnswered(true); }}>Không biết</button>
            <button className="primary" disabled={!hasInput} onClick={check}>Kiểm tra</button>
          </>
        )}
      </div>
    </div>
  );
}
