import { useLiveQuery } from 'dexie-react-hooks';
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

const ICONS: Record<string, string> = { review: '🔁', learn: '✨', write: '✍️', read: '📖' };

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

  return (
    <section>
      <div className="hero card">
        <div className="hint">Bài học hôm nay · {doneCount}/{steps.length} bước</div>
        <div className="progress"><div style={{ width: `${(100 * doneCount) / steps.length}%` }} /></div>
        {next ? (
          <button className="primary big" onClick={() => go(next.view)}>
            {doneCount === 0 ? 'Bắt đầu học' : 'Tiếp tục học'} → {next.label}
          </button>
        ) : (
          <p className="center-text">🎉 Xong bài hôm nay! Mai quay lại để ôn nhé.</p>
        )}
        <ol className="plan">
          {steps.map((s) => (
            <li key={s.view} className={s.done ? 'done' : s === next ? 'current' : ''} onClick={() => go(s.view)}>
              <span className="icon-lg">{s.done ? '✅' : ICONS[s.view]}</span>
              <div><b>{s.label}</b><div className="hint">{s.detail}</div></div>
              <span className="chev">›</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="stats">
        <Stat n={streak ?? 0} label="Ngày học liên tục 🔥" />
        <Stat n={estimate} label={`Vốn từ ước tính / ${words.length}`} />
        <Stat n={cards.length} label="Từ đã học" />
      </div>

      {settings.testEstimate === undefined && (
        <div className="callout">
          Đã biết khá nhiều từ cơ bản? <a onClick={() => go('test')}>Làm bài kiểm tra vốn từ (5 phút)</a> để web bỏ qua những từ bạn đã biết.
        </div>
      )}
    </section>
  );
}

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div className="stat"><div className="n">{n}</div><div>{label}</div></div>
);
