import { useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Rating } from 'ts-fsrs';
import { reviewItem, type ItemCard } from '../db';
import { matches, normalize, type Exercise, type Phrase } from '../content';
import { Meter, SpeakButton, editDistance, speak } from '../ui';
import ExerciseCard from './Exercise';

interface Props {
  due: ItemCard[];
  exercises: Map<string, Exercise>;
  phrases: Map<string, Phrase>;
}

/**
 * Spaced review of grammar exercises and phrases, graded automatically:
 * right → "Nhớ", near-miss → "Khó", wrong → "Quên" (comes back in minutes).
 */
export default function ItemReview({ due, exercises, phrases }: Props) {
  const [done, setDone] = useState(0);
  const card = due[0];
  if (!card) return null;
  const grade = async (rating: Rating.Again | Rating.Hard | Rating.Good) => { await reviewItem(card, rating); setDone((n) => n + 1); };
  const meter = <Meter value={done} total={done + due.length}>Còn {due.length} · {card.kind === 'grammar' ? 'Ngữ pháp' : 'Mẫu câu'}</Meter>;

  if (card.kind === 'grammar') {
    const ex = exercises.get(card.key);
    if (!ex) return null; // App only passes cards whose content exists
    return <section className="entry">{meter}<ExerciseCard key={card.key} ex={ex} onNext={(ok) => grade(ok ? Rating.Good : Rating.Again)} /></section>;
  }
  const phrase = phrases.get(card.key);
  if (!phrase) return null;
  return <section className="entry">{meter}<PhraseRecall key={card.key} phrase={phrase} onGrade={grade} /></section>;
}

/** Vietnamese → type the English phrase; small slips count as "Khó". */
function PhraseRecall({ phrase, onGrade }: { phrase: Phrase; onGrade: (r: Rating.Again | Rating.Hard | Rating.Good) => void }) {
  const [answer, setAnswer] = useState('');
  const [shown, setShown] = useState(false);
  const exact = matches(answer, [phrase.en]);
  const near = !exact && answer.trim() !== '' && editDistance(normalize(answer), normalize(phrase.en)) <= 3;
  const reveal = () => { setShown(true); speak(phrase.en); };

  return (
    <>
      <p className="prompt">Nói câu này bằng tiếng Anh:</p>
      <div className="sense">{phrase.vi}</div>
      <form id="phrase-answer" className="answer" onSubmit={(e) => { e.preventDefault(); reveal(); }}>
        <input autoFocus value={answer} disabled={shown} aria-label="Câu tiếng Anh" placeholder="Gõ câu tiếng Anh"
          autoCapitalize="off" autoCorrect="off" spellCheck={false} onChange={(e) => setAnswer(e.target.value)} />
      </form>
      {shown && (
        <>
          <p className={`verdict ${exact || near ? 'ok' : 'bad'}`}>
            {exact ? <><Check className="icon" /> Chính xác</> : near ? <><Check className="icon" /> Gần đúng</> : <><X className="icon" /> Chưa đúng</>}
          </p>
          <div className="ex">
            <span className="lbl">Câu đúng</span>
            <button onClick={() => speak(phrase.en)}>{phrase.en}</button> <SpeakButton onClick={() => speak(phrase.en, 0.6)} label="Nghe chậm" />
            {phrase.note && <div className="ex-vi">{phrase.note}</div>}
          </div>
        </>
      )}
      <div className="actions">
        {shown
          ? <button className="primary" onClick={() => onGrade(exact ? Rating.Good : near ? Rating.Hard : Rating.Again)}>Tiếp <ArrowRight className="icon" /></button>
          : <>
            <button onClick={reveal}>Không nhớ</button>
            <button className="primary" type="submit" form="phrase-answer" disabled={!answer.trim()}>Kiểm tra</button>
          </>}
      </div>
    </>
  );
}
