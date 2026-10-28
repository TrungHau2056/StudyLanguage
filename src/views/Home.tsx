import { useLiveQuery } from 'dexie-react-hooks';
import { State } from 'ts-fsrs';
import { db, retrievability, startOfToday, type Settings, type StudyCard, type Word } from '../db';
import type { View } from '../App';

interface Props {
  words: Word[];
  cards: StudyCard[];
  due: number;
  newLeft: number;
  settings: Settings;
  go: (v: View) => void;
}

export default function Home({ words, cards, due, newLeft, settings, go }: Props) {
  const logs = useLiveQuery(() => db.logs.where('reviewedAt').aboveOrEqual(startOfToday()).toArray(), []);
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
  const mature = cards.filter((c) => c.state === State.Review && c.stability >= 21).length;
  const todayLogs = logs ?? [];
  const accuracy = todayLogs.length ? Math.round((100 * todayLogs.filter((l) => l.rating > 1).length) / todayLogs.length) : null;

  return (
    <section>
      <div className="stats">
        <Stat n={due} label="Cần ôn bây giờ" />
        <Stat n={newLeft} label="Từ mới còn lại hôm nay" />
        <Stat n={todayLogs.length} label={`Lượt ôn hôm nay${accuracy === null ? '' : ` · đúng ${accuracy}%`}`} />
        <Stat n={streak ?? 0} label="Ngày học liên tục 🔥" />
        <Stat n={estimate} label={`Vốn từ ước tính / ${words.length}`} />
        <Stat n={mature} label="Đã thuộc lâu (≥21 ngày)" />
      </div>
      <div className="row">
        {due > 0 && <button className="primary" onClick={() => go('review')}>Ôn {due} từ</button>}
        {newLeft > 0 && <button className="primary" onClick={() => go('learn')}>Học {newLeft} từ mới</button>}
        {!due && !newLeft && <p>🎉 Xong phần thẻ hôm nay! Sang <a onClick={() => go('read')}>Đọc</a> hoặc <a onClick={() => go('write')}>Luyện viết</a> để dùng từ.</p>}
      </div>
      {settings.testEstimate === undefined && (
        <div className="callout">
          Chưa biết trình độ? <a onClick={() => go('test')}>Làm bài kiểm tra vốn từ (5 phút)</a> để bỏ qua những từ bạn đã biết.
        </div>
      )}
      <h3>Lộ trình mỗi ngày</h3>
      <ol className="hint">
        <li><b>Ôn tập</b> hết từ đến hạn (quan trọng nhất, đừng bỏ ngày nào).</li>
        <li><b>Học mới</b> 10–20 từ: đọc to từ, câu ví dụ và cụm từ.</li>
        <li><b>Luyện viết</b>: tự đặt 3–5 câu với từ vừa học.</li>
        <li><b>Đọc</b> 1 bài ngắn chứa từ đã học, nghe và đọc theo.</li>
      </ol>
    </section>
  );
}

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div className="stat"><div className="n">{n}</div><div>{label}</div></div>
);
