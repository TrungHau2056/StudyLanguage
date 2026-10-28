import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { GrammarLesson } from '../content';
import { Meter, SpeakButton, Tip, speak } from '../ui';
import ExerciseCard from './Exercise';
import './grammar.css';

interface Props {
  lessons: GrammarLesson[];
  done: Set<string>;
  next?: GrammarLesson;
  onFinish: (lesson: GrammarLesson, score: number) => void;
}

export default function Grammar({ lessons, done, next, onFinish }: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [picked, setPicked] = useState<GrammarLesson>();
  const lesson = picked ?? (listOpen ? undefined : next);

  if (lesson) {
    return (
      <Lesson key={lesson.id} lesson={lesson}
        onAll={() => { setPicked(undefined); setListOpen(true); }}
        onFinish={(score) => { onFinish(lesson, score); setPicked(undefined); setListOpen(false); }} />
    );
  }

  if (!listOpen) {
    return (
      <section className="empty">
        <h2>Bạn đã học hết bài ngữ pháp của trình độ hiện tại</h2>
        <p>Bạn có thể học lại bất kỳ bài nào để nhớ chắc hơn.</p>
        <button onClick={() => setListOpen(true)}>Xem tất cả bài ngữ pháp</button>
      </section>
    );
  }

  const levels = [...new Set(lessons.map((l) => l.level))];
  return (
    <section className="entry">
      {next && <button className="quiet back" onClick={() => setListOpen(false)}><ChevronLeft className="icon" /> Bài hôm nay</button>}
      <h2>Tất cả bài ngữ pháp</h2>
      {levels.map((lv) => (
        <div key={lv}>
          <h3 className="group">{lv}</h3>
          <div className="list">
            {lessons.filter((l) => l.level === lv).map((l) => (
              <button key={l.id} className="list-item" onClick={() => setPicked(l)}>
                <span>{l.title}</span>
                <small>{done.has(l.id) ? 'đã học' : 'chưa học'}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

type Part = 'read' | 'practice' | 'result';

function Lesson({ lesson, onAll, onFinish }: { lesson: GrammarLesson; onAll: () => void; onFinish: (score: number) => void }) {
  const [part, setPart] = useState<Part>('read');
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const n = lesson.exercises.length;
  const restart = () => { setI(0); setCorrect(0); setPart('practice'); };

  if (part === 'practice') {
    return (
      <section className="entry">
        <Meter value={i} total={n}>Câu {i + 1}/{n}</Meter>
        <ExerciseCard key={i} ex={lesson.exercises[i]} onNext={(ok) => {
          if (ok) setCorrect((c) => c + 1);
          if (i + 1 < n) setI(i + 1); else setPart('result');
        }} />
      </section>
    );
  }

  if (part === 'result') {
    return (
      <section className="entry">
        <h2>{lesson.title}</h2>
        <p className="hw">Đúng {correct}/{n}</p>
        <p>{correct >= 9
          ? 'Tốt lắm! Bạn đã nắm được bài này. Các câu sẽ được ôn lại trong mục “Ôn ngữ pháp”.'
          : 'Bạn nên đọc lại phần “Lỗi hay gặp” rồi làm lại bài tập để nhớ chắc hơn.'}</p>
        <div className="actions">
          <button onClick={restart}>Làm lại bài tập</button>
          <button className="primary" onClick={() => onFinish(correct)}>Hoàn thành bài</button>
        </div>
      </section>
    );
  }

  return (
    <section className="entry grammar">
      <button className="quiet back" onClick={onAll}>Tất cả bài ngữ pháp</button>
      <Tip id="grammar">
        Đọc phần giải thích, nghe các ví dụ và đọc to theo, rồi làm {n} câu bài tập.
        Câu làm xong sẽ được ôn lại trong mục “Ôn ngữ pháp”.
      </Tip>
      <h2>{lesson.title}</h2>
      <p>{lesson.summary}</p>

      <span className="lbl">Công thức</span>
      <div className="formulas">
        {lesson.formulas.map((f) => <div key={f}>{f}</div>)}
      </div>

      <span className="lbl">Khi nào dùng</span>
      <ul>{lesson.usage.map((u) => <li key={u}>{u}</li>)}</ul>

      <span className="lbl">Lỗi hay gặp</span>
      <ul className="mistakes">
        {lesson.mistakes.map((m) => (
          <li key={m.wrong}>
            <s className="bad">{m.wrong}</s> → <span className="ok">{m.right}</span>
            <div className="hint">{m.why}</div>
          </li>
        ))}
      </ul>

      <span className="lbl">Ví dụ</span>
      {lesson.examples.map((e) => (
        <div key={e.en} className="ex">
          <div className="hw-line">
            <button onClick={() => speak(e.en)} title="Nghe câu ví dụ">{e.en}</button>
            <SpeakButton onClick={() => speak(e.en)} label="Nghe câu ví dụ" />
          </div>
          <div className="ex-vi">{e.vi}</div>
        </div>
      ))}

      <div className="actions">
        <button className="primary" onClick={restart}>Làm bài tập ({n} câu)</button>
      </div>
    </section>
  );
}
