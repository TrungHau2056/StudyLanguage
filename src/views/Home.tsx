import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, BookA, ChevronRight, MessageSquareText } from 'lucide-react';
import { LEVELS, db, retrievability, type Known, type Settings, type StudyCard, type Word } from '../db';
import { wordStatus } from './WordList';
import { TRACK_LABEL, type Step, type Track, type View } from '../App';

interface Props {
  words: Word[];
  cards: StudyCard[];
  known: Known[];
  steps: Step[];
  settings: Settings;
  go: (v: View) => void;
}

const TRACK_NOTE: Record<Track, string> = {
  vocab: 'Học từ mới và ôn từ đã học.',
  grammar: 'Học cấu trúc câu, mẫu câu giao tiếp, luyện nghe và nói.',
};

/** One track of today's plan, with its own progress and "continue" button. */
function TrackBlock({ track, steps, go }: { track: Track; steps: Step[]; go: (v: View) => void }) {
  const next = steps.find((s) => !s.done);
  const doneCount = steps.filter((s) => s.done).length;
  const Icon = track === 'vocab' ? BookA : MessageSquareText;
  return (
    <section className={`track ${track}`}>
      <h2><Icon className="icon" /> {TRACK_LABEL[track]} <small>{doneCount}/{steps.length}</small></h2>
      <p className="hint">{TRACK_NOTE[track]}</p>
      {next
        ? <button className="primary big" onClick={() => go(next.view)}>{doneCount === 0 ? 'Bắt đầu' : 'Tiếp tục'}: {next.label.toLowerCase()} <ArrowRight className="icon" /></button>
        : <p className="ok">Xong phần {TRACK_LABEL[track].toLowerCase()} hôm nay.</p>}
      <ol className="plan">
        {steps.map((s, i) => (
          <li key={s.view} className={s.done ? 'done' : s === next ? 'current' : ''} onClick={() => go(s.view)}>
            <span className="num">{i + 1}</span>
            <div><b>{s.label}</b><span className="meta">{s.detail}</span></div>
            <ChevronRight className="icon chev" />
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function Home({ words, cards, known, steps, settings, go }: Props) {
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
      <h1>{doneCount === steps.length ? 'Xong bài hôm nay' : 'Bài hôm nay'}</h1>
      <p className="sub">{date.charAt(0).toUpperCase() + date.slice(1)} · 2 phần học riêng, làm phần nào trước cũng được</p>
      <TrackBlock track="vocab" steps={steps.filter((s) => s.track === 'vocab')} go={go} />
      <TrackBlock track="grammar" steps={steps.filter((s) => s.track === 'grammar')} go={go} />

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
