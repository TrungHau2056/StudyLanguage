import { useState } from 'react';
import type { Settings } from '../db';
import type { Step, View } from '../App';

/** Progress through today's routine, shown above each routine screen. */
export function StepBar({ steps, view, next, go }: { steps: Step[]; view: View; next?: Step; go: (v: View) => void }) {
  const here = steps.find((s) => s.view === view);
  return (
    <div className="stepbar">
      <div className="steps">
        {steps.map((s, i) => (
          <button key={s.view} className={`step ${s.done ? 'done' : ''} ${s.view === view ? 'here' : ''}`} onClick={() => go(s.view)}>
            <span className="dot">{s.done ? '✓' : i + 1}</span>{s.label}
          </button>
        ))}
      </div>
      {here?.done && (
        <div className="callout next">
          {next ? (
            <>✅ Xong bước “{here.label}”. <button className="primary" onClick={() => go(next.view)}>Tiếp: {next.label} →</button></>
          ) : (
            <>🎉 Xong hết bài hôm nay! <button className="primary" onClick={() => go('home')}>Về trang Hôm nay</button></>
          )}
        </div>
      )}
    </div>
  );
}

const INTRO: [string, string, string][] = [
  ['🔁', 'Ôn tập', 'Hỏi lại các từ bạn đã học đúng lúc bạn sắp quên. Đây là bước quan trọng nhất.'],
  ['✨', 'Học từ mới', 'Mỗi lần 5 từ: xem nghĩa, nghe, đọc câu ví dụ, rồi được kiểm tra ngay.'],
  ['✍️', 'Luyện viết', 'Tự đặt 3 câu với từ vừa học, vì dùng được từ thì mới nhớ lâu.'],
  ['📖', 'Đọc', 'Đọc và nghe một đoạn văn ngắn chứa các từ đó.'],
];

/** First-run screen: explains the routine and sets the daily goal. */
export function Welcome({ settings, setSettings, go }: { settings: Settings; setSettings: (s: Settings) => void; go: (v: View) => void }) {
  const [perDay, setPerDay] = useState(settings.newPerDay);
  const finish = (to: View) => { setSettings({ ...settings, newPerDay: perDay, onboarded: true }); go(to); };
  return (
    <section className="card welcome">
      <h2>👋 Chào bạn!</h2>
      <p>Mỗi ngày bạn chỉ cần bấm <b>“Tiếp tục học”</b> và làm theo 4 bước. Web tự chọn từ cần học và cần ôn cho bạn:</p>
      <ol className="intro">
        {INTRO.map(([icon, title, text]) => <li key={title}><span>{icon}</span><div><b>{title}</b><div className="hint">{text}</div></div></li>)}
      </ol>
      <p><b>Mỗi ngày học bao nhiêu từ mới?</b></p>
      <div className="row choice">
        {[[5, 'Nhẹ nhàng', '~10 phút'], [10, 'Vừa phải', '~20 phút'], [20, 'Tăng tốc', '~35 phút']].map(([n, label, time]) => (
          <button key={n} className={perDay === n ? 'primary' : ''} onClick={() => setPerDay(Number(n))}>
            <b>{n} từ</b><small>{label} · {time}</small>
          </button>
        ))}
      </div>
      <p className="hint">Đừng chọn quá nhiều: từ mới hôm nay sẽ thành bài ôn của những ngày sau.</p>
      <div className="row">
        <button onClick={() => finish('test')}>Kiểm tra trình độ trước (5 phút)</button>
        <button className="primary" onClick={() => finish('learn')}>Bắt đầu học ngay →</button>
      </div>
    </section>
  );
}
