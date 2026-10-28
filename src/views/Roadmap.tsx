import { useMemo, useState } from 'react';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { LEVELS, type Known, type Level, type Settings, type StudyCard, type Word } from '../db';
import type { Exercise, GrammarLesson, PhraseSet } from '../content';
import { Meter, Tip, meaningOptions, shuffle } from '../ui';
import { wordStatus } from './WordList';
import ExerciseCard from './Exercise';
import type { View } from '../App';

/** Levels with grammar lessons and phrases; higher levels have vocabulary only for now. */
const FULL_LEVELS: Level[] = ['A1', 'A2'];
const PASS = 0.8;

interface Props {
  words: Word[];
  cards: StudyCard[];
  known: Known[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  lessons: GrammarLesson[];
  doneLessons: Set<string>;
  sets: PhraseSet[];
  learnedPhrases: Set<string>;
  current: Level;
  go: (v: View) => void;
}

export default function Roadmap(props: Props) {
  const { words, cards, known, settings, lessons, doneLessons, sets, learnedPhrases, current, go } = props;
  const [testing, setTesting] = useState<Level>();
  const byWord = new Map(cards.map((c) => [c.wordId, c]));
  const knownIds = new Set(known.map((k) => k.wordId));
  const passed = new Set(settings.levelsPassed ?? []);

  if (testing) return <LevelTest {...props} level={testing} onClose={() => setTesting(undefined)} />;

  return (
    <section>
      <h2>Lộ trình</h2>
      <Tip id="roadmap">
        Mỗi trình độ gồm từ vựng, ngữ pháp và mẫu câu giao tiếp. Học đều mỗi ngày theo trang Hôm nay; khi thấy đã vững,
        làm bài kiểm tra cuối trình độ (đúng từ 80%) để lên trình độ tiếp theo.
      </Tip>
      <ol className="roadmap">
        {LEVELS.map((level) => {
          const inLevel = words.filter((w) => w.cefr === level);
          const studied = inLevel.filter((w) => wordStatus(w, byWord.get(w.id), knownIds.has(w.id), settings) !== 'new').length;
          const lvLessons = lessons.filter((l) => l.level === level);
          const lvPhrases = sets.filter((s) => s.level === level).flatMap((s) => s.phrases);
          const state = passed.has(level) ? 'done' : level === current ? 'current' : LEVELS.indexOf(level) < LEVELS.indexOf(current) ? 'done' : 'later';
          const full = FULL_LEVELS.includes(level);
          return (
            <li key={level} className={state}>
              <div className="lv-head">
                <span className="lv">{level}</span>
                <b>{state === 'done' ? 'Đã qua' : state === 'current' ? 'Đang học' : 'Sắp tới'}</b>
                {state === 'done' && <Check className="icon ok" />}
                {state === 'later' && <Lock className="icon" />}
              </div>
              <Progress label="Từ vựng" got={studied} total={inLevel.length} />
              {full ? (
                <>
                  <Progress label="Ngữ pháp" got={lvLessons.filter((l) => doneLessons.has(l.id)).length} total={lvLessons.length} />
                  <Progress label="Mẫu câu" got={lvPhrases.filter((p) => learnedPhrases.has(p.id)).length} total={lvPhrases.length} />
                </>
              ) : <p className="hint">Ngữ pháp và mẫu câu cho trình độ này sẽ có sau.</p>}
              {state === 'current' && (
                <div className="row">
                  <button onClick={() => go('grammar')}>Bài ngữ pháp</button>
                  <button className="primary" onClick={() => setTesting(level)}>Kiểm tra lên trình độ <ArrowRight className="icon" /></button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Progress({ label, got, total }: { label: string; got: number; total: number }) {
  return (
    <div className="lv-row">
      <span>{label}</span>
      <span className="bar"><i style={{ width: `${total ? (100 * got) / total : 0}%` }} /></span>
      <small>{got}/{total}</small>
    </div>
  );
}

type Question = { kind: 'word'; word: Word; options: string[] } | { kind: 'grammar'; ex: Exercise };

/** End-of-level test: 12 vocabulary meanings + 8 grammar items; 80% to pass. */
function LevelTest({ level, words, lessons, settings, setSettings, onClose }: Props & { level: Level; onClose: () => void }) {
  const questions = useMemo<Question[]>(() => {
    const vocab = shuffle(words.filter((w) => w.cefr === level)).slice(0, 12)
      .map((w): Question => ({ kind: 'word', word: w, options: meaningOptions(w, words) }));
    const grammar = shuffle(lessons.filter((l) => l.level === level).flatMap((l) => l.exercises.filter((e) => e.type === 'choice' || e.type === 'gap')))
      .slice(0, 8).map((ex): Question => ({ kind: 'grammar', ex }));
    return shuffle([...vocab, ...grammar]);
  }, [level, words, lessons]);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string>();
  const q = questions[i];

  if (!q) {
    const ok = score / questions.length >= PASS;
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    return (
      <section className="empty">
        <h2>Đúng {score}/{questions.length}</h2>
        <p>{ok
          ? `Chúc mừng, bạn đã qua trình độ ${level}!${next ? ` Từ giờ từ mới bắt đầu ở ${next}; từ ${level} chưa học vẫn được hỏi nhanh để kiểm tra.` : ''}`
          : `Cần đúng từ ${Math.ceil(questions.length * PASS)} câu để qua. Học thêm vài hôm rồi thử lại nhé.`}</p>
        <div className="actions">
          <button className="primary" onClick={() => {
            if (ok) setSettings({
              ...settings,
              levelsPassed: [...new Set([...(settings.levelsPassed ?? []), level])],
              startLevel: next && LEVELS.indexOf(settings.startLevel) <= LEVELS.indexOf(level) ? next : settings.startLevel,
            });
            onClose();
          }}>Xong</button>
        </div>
      </section>
    );
  }

  const advance = (correct: boolean) => { if (correct) setScore((s) => s + 1); setPicked(undefined); setI((n) => n + 1); };
  return (
    <section className="entry">
      <Meter value={i} total={questions.length}>Kiểm tra {level} · {i + 1}/{questions.length}</Meter>
      {q.kind === 'grammar' ? <ExerciseCard key={i} ex={q.ex} onNext={advance} /> : (
        <>
          <p className="prompt">Nghĩa của từ này là:</p>
          <div className="hw-line"><span className="hw">{q.word.word}</span></div>
          <div className="options">
            {q.options.map((o) => (
              <button key={o} disabled={!!picked} onClick={() => setPicked(o)}
                className={picked ? (o === q.word.meaning ? 'right' : o === picked ? 'wrong' : '') : ''}>{o}</button>
            ))}
          </div>
          {picked && <div className="actions"><button className="primary" onClick={() => advance(picked === q.word.meaning)}>Tiếp <ArrowRight className="icon" /></button></div>}
        </>
      )}
    </section>
  );
}
