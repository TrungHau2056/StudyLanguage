import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { LEVELS, db, retrievability, type Known, type Settings, type StudyCard, type Word } from '../db';
import { wordStatus } from './WordList';
import type { Step, View } from '../App';

interface Props {
  words: Word[];
  cards: StudyCard[];
  known: Known[];
  steps: Step[];
  next?: Step;
  settings: Settings;
  go: (v: View) => void;
}

export default function Home({ words, cards, known, steps, next, settings, go }: Props) {
  const streak = useLiveQuery(async () => {
    const days = new Set((await db.logs.toArray()).map((l) => l.reviewedAt.toDateString()));
    let n = 0;
    const d = new Date();
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not done yet keeps the streak
    while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }, []);

  const now = new Date();
  const byWord = new Map(cards.map((c) => [c.wordId, c]));
  const knownIds = new Set(known.map((k) => k.wordId));
  // Vocabulary estimate: words known or skipped as known, plus studied words you currently remember (≥90%).
  const statuses = words.map((w) => ({ w, s: wordStatus(w, byWord.get(w.id), knownIds.has(w.id), settings) }));
  const remembered = cards.filter((c) => retrievability(c, now) >= 0.9).length;
  const estimate = statuses.filter(({ s }) => s === 'known' || s === 'skipped').length + remembered;
  const perLevel = LEVELS.map((level) => {
    const inLevel = statuses.filter(({ w }) => w.cefr === level);
    const count = (...k: string[]) => inLevel.filter(({ s }) => k.includes(s)).length;
    return { level, total: inLevel.length, got: count('known', 'mastered'), learning: count('learning'), skipped: count('skipped') };
  });
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

      <h2 className="section">Theo trình độ</h2>
      <table className="levels">
        <thead><tr><th>Trình độ</th><th>Đã biết + đã thuộc</th><th>Đang học</th><th>Tổng</th></tr></thead>
        <tbody>
          {perLevel.map((l) => (
            <tr key={l.level}>
              <td>
                <b>{l.level}</b>{l.skipped > 0 && <span className="hint"> · bỏ qua {l.skipped}</span>}
                <span className="bar"><i style={{ width: `${(100 * l.got) / l.total}%` }} /></span>
              </td>
              <td>{l.got}</td><td>{l.learning}</td><td>{l.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Xem và đổi nhóm từng từ ở trang <a onClick={() => go('words')}>Từ vựng</a>.</p>

      {settings.testEstimate === undefined && (
        <p className="aside">
          Đã biết khá nhiều từ cơ bản? <a onClick={() => go('test')}>Làm bài kiểm tra vốn từ</a> (5 phút) để bỏ qua những từ bạn đã biết.
        </p>
      )}
    </section>
  );
}
