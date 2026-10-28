import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { Settings } from '../db';
import type { Step, View } from '../App';

/** Today's routine as the book's thumb index: the current step's tab extends, finished ones are struck through. */
export function Rail({ steps, view, go }: { steps: Step[]; view: View; go: (v: View) => void }) {
  return (
    <nav className="rail" aria-label="Các bước hôm nay">
      {steps.map((s) => (
        <button key={s.view} className={`${s.done ? 'done' : ''} ${s.view === view ? 'here' : ''}`}
          aria-current={s.view === view ? 'step' : undefined} onClick={() => go(s.view)}>
          {s.done && <Check className="icon" aria-label="Đã xong" />}{s.label}
        </button>
      ))}
    </nav>
  );
}

/** Appears once the current step is finished and points to the next unfinished one. */
export function NextPrompt({ steps, view, next, go }: { steps: Step[]; view: View; next?: Step; go: (v: View) => void }) {
  const here = steps.find((s) => s.view === view);
  if (!here?.done) return null;
  return (
    <div className="next" role="status">
      {next ? (
        <>
          <span>Xong phần {here.label.toLowerCase()}.</span>
          <button className="primary" onClick={() => go(next.view)}>{next.label} <ArrowRight className="icon" /></button>
        </>
      ) : (
        <>
          <span>Xong hết bài hôm nay.</span>
          <button onClick={() => go('home')}>Về trang Hôm nay</button>
        </>
      )}
    </div>
  );
}

const INTRO: [string, string][] = [
  ['Ôn tập', 'Hỏi lại các từ đã học đúng lúc bạn sắp quên. Đây là bước quan trọng nhất.'],
  ['Học từ mới', 'Mỗi lần 5 từ: xem nghĩa, nghe, đọc câu ví dụ, rồi kiểm tra ngay.'],
  ['Viết', 'Tự đặt 3 câu với từ vừa học, vì dùng được từ thì mới nhớ lâu.'],
  ['Đọc', 'Đọc và nghe một đoạn văn ngắn chứa các từ đó.'],
];

const PACES: [number, string, string][] = [[5, 'Nhẹ nhàng', '~10 phút'], [10, 'Vừa phải', '~20 phút'], [20, 'Tăng tốc', '~35 phút']];

/** First-run screen: explains the routine and sets the daily goal. */
export function Welcome({ settings, setSettings, go }: { settings: Settings; setSettings: (s: Settings) => void; go: (v: View) => void }) {
  const [perDay, setPerDay] = useState(settings.newPerDay);
  const finish = (to: View) => { setSettings({ ...settings, newPerDay: perDay, onboarded: true }); go(to); };
  return (
    <section className="welcome">
      <h1>Mỗi ngày một trang từ điển.</h1>
      <p>Bấm <b>Tiếp tục học</b> và làm lần lượt 4 phần. Web tự chọn từ cần học và cần ôn cho bạn.</p>
      <ol className="intro">
        {INTRO.map(([title, text], i) => (
          <li key={title}><span className="num">{i + 1}</span><div><b>{title}</b><p>{text}</p></div></li>
        ))}
      </ol>
      <h2>Mỗi ngày học bao nhiêu từ mới?</h2>
      <div className="choice" role="radiogroup">
        {PACES.map(([n, label, time]) => (
          <button key={n} role="radio" aria-checked={perDay === n} className={perDay === n ? 'on' : ''} onClick={() => setPerDay(n)}>
            {n} từ<small>{label} · {time}</small>
          </button>
        ))}
      </div>
      <p className="hint">Đừng chọn quá nhiều: từ mới hôm nay sẽ thành bài ôn của những ngày sau.</p>
      <div className="actions">
        <button onClick={() => finish('test')}>Kiểm tra trình độ</button>
        <button className="primary" onClick={() => finish('learn')}>Bắt đầu học <ArrowRight className="icon" /></button>
      </div>
    </section>
  );
}
