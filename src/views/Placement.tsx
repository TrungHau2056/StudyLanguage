import { useMemo, useState } from 'react';
import type { Settings, Word } from '../db';
import { Meter, shuffle } from '../ui';
import type { View } from '../App';

/**
 * Vocabulary size test in two steps, so the score does not rest on self-report alone:
 * 1. Yes/No checklist (Meara): real words sampled from each frequency band plus made-up words.
 * 2. Every "Biết" answer must be proven by picking the Vietnamese meaning out of 4 (or "Không chắc").
 * A word counts as known only when the meaning is right. Wrong picks are penalised with the
 * standard formula-score correction, right − wrong / (options − 1), so blind guessing averages 0.
 * Fake words get decoy options too (none correct), so the test never reveals which ones are fake.
 */
const PSEUDOWORDS = [
  'plimp', 'drosk', 'fenture', 'quarb', 'stribble', 'clonter', 'vurnish', 'prostle', 'marplish', 'wonce',
  'trapment', 'disfave', 'clunter', 'frinch', 'melving', 'pradation', 'sorgle', 'bantic', 'eluctant', 'contrable',
];
const BAND = 500;
const PER_BAND = 10;
const FAKE_COUNT = 15;

type Item = { text: string; band: number; word?: Word; options: string[] }; // band −1 = fake word
type Answer = 'no' | 'unsure' | 'right' | 'wrong';
const OPTIONS = 4;

interface Props { words: Word[]; settings: Settings; setSettings: (s: Settings) => void; go: (v: View) => void }

export default function Placement({ words, settings, setSettings, go }: Props) {
  const bands = Math.ceil(words.length / BAND);
  const items = useMemo<Item[]>(() => {
    const decoys = (except?: Word) => shuffle(words.filter((w) => w !== except && w.pos === (except?.pos ?? w.pos))).slice(0, OPTIONS - 1).map((w) => w.meaning);
    return shuffle([
      ...Array.from({ length: bands }, (_, b) =>
        shuffle(words.slice(b * BAND, (b + 1) * BAND)).slice(0, PER_BAND)
          .map((w) => ({ text: w.word, band: b, word: w, options: shuffle([w.meaning, ...decoys(w)]) }))).flat(),
      ...shuffle(PSEUDOWORDS).slice(0, FAKE_COUNT).map((text) => ({ text, band: -1, options: shuffle([...decoys(), ...decoys()]).slice(0, OPTIONS) })),
    ]);
  }, [words, bands]);
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [checking, setChecking] = useState(false); // step 2 for the current item

  if (!started) return (
    <section>
      <h2>Kiểm tra vốn từ</h2>
      <p>Bạn sẽ thấy {items.length} từ. Chọn <b>Biết</b> nếu bạn biết nghĩa, ngược lại chọn <b>Không biết</b>.</p>
      <p className="hint">
        Mỗi khi chọn “Biết”, bạn phải chọn đúng nghĩa trong 4 đáp án thì từ đó mới được tính. Chọn sai sẽ bị trừ điểm,
        nên nếu không chắc thì bấm “Không chắc”. Trong bài có xen một số từ bịa để phát hiện việc đoán mò. Mất khoảng 5 phút.
      </p>
      <div className="actions"><button className="primary" onClick={() => setStarted(true)}>Bắt đầu</button></div>
    </section>
  );

  if (answers.length < items.length) {
    const item = items[answers.length];
    const answer = (a: Answer) => { setAnswers((xs) => [...xs, a]); setChecking(false); };
    return (
      <section>
        <Meter value={answers.length} total={items.length}>{answers.length + 1}/{items.length}</Meter>
        <div className="test-word">{item.text}</div>
        {!checking ? (
          <div className="yesno">
            <button onClick={() => answer('no')}>Không biết</button>
            <button className="primary" onClick={() => setChecking(true)}>Biết</button>
          </div>
        ) : (
          <div className="options">
            <p className="prompt">Nghĩa của từ này là:</p>
            {item.options.map((o, i) => (
              <button key={i} onClick={() => answer(item.word && o === item.word.meaning ? 'right' : 'wrong')}>{o}</button>
            ))}
            <button className="quiet" onClick={() => answer('unsure')}>Không chắc</button>
          </div>
        )}
      </section>
    );
  }

  const fakes = items.filter((it) => it.band === -1);
  const falseAlarm = fakes.filter((it) => answers[items.indexOf(it)] !== 'no').length / fakes.length;
  const bandScores = Array.from({ length: bands }, (_, b) => {
    const real = items.map((it, i) => [it, answers[i]] as const).filter(([it]) => it.band === b);
    const right = real.filter(([, a]) => a === 'right').length;
    const wrong = real.filter(([, a]) => a === 'wrong').length;
    const known = Math.max(0, (right - wrong / (OPTIONS - 1)) / real.length);
    const size = Math.min(BAND, words.length - b * BAND);
    return { b, known, size, right, total: real.length };
  });
  const estimate = Math.round(bandScores.reduce((s, x) => s + x.known * x.size, 0));
  const overclaimed = items.filter((it, i) => it.band >= 0 && answers[i] === 'wrong').length;
  // Skip leading bands you know ≥ 90% of; anything less is worth studying.
  let knownUpTo = 0;
  for (const s of bandScores) {
    if (s.known < 0.9) break;
    knownUpTo = s.b * BAND + s.size;
  }

  return (
    <section>
      <h2>Kết quả: khoảng {estimate} / {words.length} từ</h2>
      {falseAlarm > 0.2 && (
        <p className="bad">Bạn chọn “Biết” cho {Math.round(falseAlarm * 100)}% từ bịa, có vẻ bạn đang đoán. Kết quả kém tin cậy, nên làm lại.</p>
      )}
      {overclaimed > 0 && <p className="hint">Có {overclaimed} từ bạn chọn "Biết" nhưng chọn sai nghĩa, nên không được tính và còn bị trừ điểm.</p>}
      <table>
        <thead><tr><th>Nhóm từ (theo độ phổ biến)</th><th>Đúng nghĩa</th><th>Ước tính biết</th></tr></thead>
        <tbody>
          {bandScores.map((s) => (
            <tr key={s.b}><td>Từ {s.b * BAND + 1}–{s.b * BAND + s.size}</td><td>{s.right}/{s.total}</td><td>{Math.round(s.known * 100)}%</td></tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        {knownUpTo > 0
          ? `Bạn đã nắm chắc ${knownUpTo} từ phổ biến nhất. Phần học mới sẽ bắt đầu từ từ thứ ${knownUpTo + 1}.`
          : 'Nên học từ đầu danh sách: ngay cả nhóm từ phổ biến nhất cũng còn từ bạn chưa chắc.'}{' '}
        Đây là ước lượng từ một mẫu nhỏ. Từ nào bị bỏ qua mà bạn chưa biết thì bạn vẫn tự thêm được ở trang Từ vựng.
      </p>
      <div className="actions">
        <button onClick={() => { setAnswers([]); setChecking(false); setStarted(false); }}>Làm lại</button>
        <button className="primary" onClick={() => { setSettings({ ...settings, knownUpTo, testEstimate: estimate }); go('home'); }}>
          Áp dụng kết quả
        </button>
      </div>
    </section>
  );
}
