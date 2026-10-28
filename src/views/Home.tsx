import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { db, retrievability, type Settings, type StudyCard, type Word } from '../db';
import type { Step, View } from '../App';

interface Props {
  words: Word[];
  cards: StudyCard[];
  steps: Step[];
  next?: Step;
  settings: Settings;
  go: (v: View) => void;
}

export default function Home({ words, cards, steps, next, settings, go }: Props) {
  const streak = useLiveQuery(async () => {
    const days = new Set((await db.logs.toArray()).map((l) => l.reviewedAt.toDateString()));
    let n = 0;
    const d = new Date();
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not done yet keeps the streak
    while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }, []);

  const now = new Date();
  // Vocabulary estimate = words the placement test showed you know + studied words you currently remember (≥90%).
  const remembered = cards.filter((c) => c.wordId > settings.knownUpTo && retrievability(c, now) >= 0.9).length;
  const estimate = settings.knownUpTo + remembered;
  const doneCount = steps.filter((s) => s.done).length;
  const date = now.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });

  return (
    <section className="today">
      <h1>{next ? (doneCount === 0 ? 'Bài hôm nay' : `Còn ${steps.length - doneCount} phần nữa`) : 'Xong bài hôm nay'}</h1>
      <p className="sub">{date.charAt(0).toUpperCase() + date.slice(1)} · {doneCount}/{steps.length} phần</p>
      {next ? (
        <button className="primary big" onClick={() => go(next.view)}>
          {doneCount === 0 ? 'Bắt đầu học' : 'Tiếp tục học'}: {next.label.toLowerCase()} <ArrowRight className="icon" />
        </button>
      ) : (
        <p>Mai quay lại để ôn nhé. Muốn học thêm thì mở phần Đọc hoặc Từ vựng.</p>
      )}

      <ol className="plan">
        {steps.map((s, i) => (
          <li key={s.view} className={s.done ? 'done' : s === next ? 'current' : ''} onClick={() => go(s.view)}>
            <span className="num">{i + 1}</span>
            <div><b>{s.label}</b><span className="meta">{s.detail}</span></div>
            <ChevronRight className="icon chev" />
          </li>
        ))}
      </ol>

      <dl className="ledger">
        <div><dt>ngày liên tục</dt><dd>{streak ?? 0}</dd></div>
        <div><dt>vốn từ ước tính / {words.length}</dt><dd>{estimate}</dd></div>
        <div><dt>từ đã học</dt><dd>{cards.length}</dd></div>
      </dl>

      {settings.testEstimate === undefined && (
        <p className="aside">
          Đã biết khá nhiều từ cơ bản? <a onClick={() => go('test')}>Làm bài kiểm tra vốn từ</a> (5 phút) để bỏ qua những từ bạn đã biết.
        </p>
      )}
    </section>
  );
}
