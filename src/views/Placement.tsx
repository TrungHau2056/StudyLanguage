import { useMemo, useState } from 'react';
import type { Settings, Word } from '../db';
import { shuffle } from '../ui';
import type { View } from '../App';

/**
 * Yes/No vocabulary size test (Meara's checklist method): real words sampled from each
 * frequency band plus made-up words. Saying "yes" to fake words reveals overestimation,
 * and the score is corrected for it: known = (hits − falseAlarms) / (1 − falseAlarms).
 */
const PSEUDOWORDS = [
  'plimp', 'drosk', 'fenture', 'quarb', 'stribble', 'clonter', 'vurnish', 'prostle', 'marplish', 'wonce',
  'trapment', 'disfave', 'clunter', 'frinch', 'melving', 'pradation', 'sorgle', 'bantic', 'eluctant', 'contrable',
];
const BAND = 500;
const PER_BAND = 10;
const FAKE_COUNT = 15;

type Item = { text: string; band: number }; // band −1 = fake word

interface Props { words: Word[]; settings: Settings; setSettings: (s: Settings) => void; go: (v: View) => void }

export default function Placement({ words, settings, setSettings, go }: Props) {
  const bands = Math.ceil(words.length / BAND);
  const items = useMemo<Item[]>(() => shuffle([
    ...Array.from({ length: bands }, (_, b) =>
      shuffle(words.slice(b * BAND, (b + 1) * BAND)).slice(0, PER_BAND).map((w) => ({ text: w.word, band: b }))).flat(),
    ...shuffle(PSEUDOWORDS).slice(0, FAKE_COUNT).map((text) => ({ text, band: -1 })),
  ]), [words, bands]);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<boolean[]>([]);

  if (!started) return (
    <section className="card">
      <h2>Kiểm tra vốn từ</h2>
      <p>Bạn sẽ thấy {items.length} từ. Với mỗi từ, chọn <b>Biết</b> nếu bạn chắc chắn biết nghĩa của nó, nếu không thì chọn <b>Không biết</b>.</p>
      <p className="hint">
        Trong bài có xen một số <b>từ bịa</b> (không có thật). Nếu bạn chọn "Biết" cho từ bịa, kết quả sẽ bị trừ điểm.
        Hãy trả lời thật lòng, không đoán. Mất khoảng 3–5 phút.
      </p>
      <button className="primary" onClick={() => setStarted(true)}>Bắt đầu</button>
    </section>
  );

  if (answers.length < items.length) {
    const item = items[answers.length];
    const answer = (yes: boolean) => setAnswers((a) => [...a, yes]);
    return (
      <section className="card center">
        <div className="hint">{answers.length + 1} / {items.length}</div>
        <div className="progress"><div style={{ width: `${(100 * answers.length) / items.length}%` }} /></div>
        <div className="word test-word">{item.text}</div>
        <div className="row grades">
          <button className="again" onClick={() => answer(false)}>Không biết</button>
          <button className="good" onClick={() => answer(true)}>Biết</button>
        </div>
      </section>
    );
  }

  const fakes = items.filter((it) => it.band === -1);
  const falseAlarm = fakes.filter((it) => answers[items.indexOf(it)]).length / fakes.length;
  const bandScores = Array.from({ length: bands }, (_, b) => {
    const real = items.map((it, i) => [it, answers[i]] as const).filter(([it]) => it.band === b);
    const hit = real.filter(([, yes]) => yes).length / real.length;
    const known = falseAlarm >= 1 ? 0 : Math.max(0, (hit - falseAlarm) / (1 - falseAlarm));
    const size = Math.min(BAND, words.length - b * BAND);
    return { b, known, size };
  });
  const estimate = Math.round(bandScores.reduce((s, x) => s + x.known * x.size, 0));
  // Skip leading bands you know ≥ 90% of; anything less is worth studying.
  let knownUpTo = 0;
  for (const s of bandScores) {
    if (s.known < 0.9) break;
    knownUpTo = s.b * BAND + s.size;
  }

  return (
    <section className="card">
      <h2>Kết quả: khoảng {estimate} / {words.length} từ</h2>
      {falseAlarm > 0.2 && (
        <p className="bad">⚠ Bạn chọn "Biết" cho {Math.round(falseAlarm * 100)}% từ bịa, nên kết quả kém tin cậy. Hãy làm lại và chỉ chọn "Biết" khi chắc chắn.</p>
      )}
      <table>
        <thead><tr><th>Nhóm từ (theo độ phổ biến)</th><th>Bạn biết</th></tr></thead>
        <tbody>
          {bandScores.map((s) => (
            <tr key={s.b}><td>Từ {s.b * BAND + 1}–{s.b * BAND + s.size}</td><td>{Math.round(s.known * 100)}%</td></tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        {knownUpTo > 0
          ? `Bạn đã nắm chắc ${knownUpTo} từ phổ biến nhất. Phần học mới sẽ bắt đầu từ từ thứ ${knownUpTo + 1}.`
          : 'Nên học từ đầu danh sách: ngay cả nhóm từ phổ biến nhất cũng còn từ bạn chưa chắc.'}{' '}
        Đây là ước lượng từ một mẫu nhỏ. Từ nào bị bỏ qua mà bạn chưa biết thì bạn vẫn tự thêm được ở trang Từ vựng.
      </p>
      <div className="row">
        <button onClick={() => { setAnswers([]); setStarted(false); }}>Làm lại</button>
        <button className="primary" onClick={() => { setSettings({ ...settings, knownUpTo, testEstimate: estimate }); go('home'); }}>
          Áp dụng kết quả
        </button>
      </div>
    </section>
  );
}
