import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { Level, Settings } from '../db';
import { TRACK_LABEL, type Step, type Track, type View } from '../App';

/** One track's routine as the book's thumb index: the current step's tab extends, finished ones are struck through. */
export function Rail({ steps, track, view, go }: { steps: Step[]; track: Track; view: View; go: (v: View) => void }) {
  return (
    <nav className={`rail ${track}`} aria-label={`Các bước ${TRACK_LABEL[track]} hôm nay`}>
      <span className="rail-title">{track === 'vocab' ? 'Từ vựng' : 'Ngữ pháp'}</span>
      {steps.map((s) => (
        <button key={s.view} className={`${s.done ? 'done' : ''} ${s.view === view ? 'here' : ''}`}
          aria-current={s.view === view ? 'step' : undefined} onClick={() => go(s.view)}>
          {s.done && <Check className="icon" aria-label="Đã xong" />}{s.label}
        </button>
      ))}
    </nav>
  );
}

/** Appears once the current step is finished: next step of the same track, or the other track when this one is done. */
export function NextPrompt({ steps, track, view, go }: { steps: Step[]; track: Track; view: View; go: (v: View) => void }) {
  const here = steps.find((s) => s.view === view);
  if (!here?.done) return null;
  const next = steps.find((s) => s.track === track && !s.done);
  const other: Track = track === 'vocab' ? 'grammar' : 'vocab';
  const otherNext = steps.find((s) => s.track === other && !s.done);
  return (
    <div className="next" role="status">
      {next ? (
        <>
          <span>Xong phần {here.label.toLowerCase()}.</span>
          <button className="primary" onClick={() => go(next.view)}>{next.label} <ArrowRight className="icon" /></button>
        </>
      ) : otherNext ? (
        <>
          <span>Xong {TRACK_LABEL[track].toLowerCase()} hôm nay.</span>
          <button className="primary" onClick={() => go(otherNext.view)}>Sang {TRACK_LABEL[other].toLowerCase()} <ArrowRight className="icon" /></button>
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
  ['Từ vựng', 'Ôn từ cũ đúng lúc sắp quên → học từ mới (mỗi lần 5 từ) → tự đặt câu → đọc bài ngắn.'],
  ['Ngữ pháp & giao tiếp', 'Ôn câu cũ → học 1 bài ngữ pháp có bài tập → 5 mẫu câu giao tiếp, nghe và nói theo → nghe chép chính tả.'],
];

const PACES: [number, string, string][] = [[5, 'Nhẹ nhàng', '~10 phút'], [10, 'Vừa phải', '~20 phút'], [20, 'Tăng tốc', '~35 phút']];

const STARTS: [Level, string, string][] = [
  ['A1', 'Mới bắt đầu', 'Học từ những từ dễ, cụ thể nhất'],
  ['A2', 'Biết cơ bản', 'Bỏ qua từ A1, chỉ hỏi nhanh để kiểm tra'],
  ['B1', 'Khá trở lên', 'Bỏ qua từ A1–A2, chỉ hỏi nhanh để kiểm tra'],
];

/** First-run screen: explains the routine, asks the starting level and the daily goal. */
export function Welcome({ settings, setSettings, go }: { settings: Settings; setSettings: (s: Settings) => void; go: (v: View) => void }) {
  const [perDay, setPerDay] = useState(settings.newPerDay);
  const [start, setStart] = useState<Level>(settings.startLevel);
  const finish = (to: View) => { setSettings({ ...settings, newPerDay: perDay, startLevel: start, onboarded: true }); go(to); };
  return (
    <section className="welcome">
      <h1>Mỗi ngày một trang từ điển.</h1>
      <p>Mỗi ngày có <b>2 phần học riêng biệt</b>, mỗi phần có nút <b>Tiếp tục</b> riêng. Web tự chọn nội dung cần học và cần ôn cho bạn.</p>
      <ol className="intro">
        {INTRO.map(([title, text], i) => (
          <li key={title}><span className="num">{i + 1}</span><div><b>{title}</b><p>{text}</p></div></li>
        ))}
      </ol>
      <h2>Tiếng Anh của bạn đang ở mức nào?</h2>
      <div className="choice" role="radiogroup">
        {STARTS.map(([level, label, note]) => (
          <button key={level} role="radio" aria-checked={start === level} className={start === level ? 'on' : ''} onClick={() => setStart(level)}>
            {label}<small>{note}</small>
          </button>
        ))}
      </div>
      <p className="hint">
        Từ đã biết sẽ không bị dạy lại. Không chắc thì chọn thấp hơn, hoặc làm bài kiểm tra 5 phút để web tự xếp.
        {start === 'A1' && <> Mới học tiếng Anh? Đọc trước <a onClick={() => finish('sounds')}>cách đọc phiên âm</a>.</>}
      </p>
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
        <button onClick={() => finish('test')}>Làm bài kiểm tra</button>
        <button className="primary" onClick={() => finish('learn')}>Bắt đầu học <ArrowRight className="icon" /></button>
      </div>
    </section>
  );
}
