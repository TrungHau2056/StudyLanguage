import { useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, Mic, Snail, X } from 'lucide-react';
import { matches, normalize, type Phrase, type PhraseSet } from '../content';
import { Meter, SpeakButton, Tip, editDistance, speak } from '../ui';
import { listenOnce, scoreSpeech, speechSupported } from '../speech';
import './phrases.css';

type Item = { set: PhraseSet; phrase: Phrase };
interface Props { sets: PhraseSet[]; learned: Set<string>; queue: Item[]; onLearned: (ids: string[]) => void }

export default function Phrases({ sets, learned, queue, onLearned }: Props) {
  const [browsing, setBrowsing] = useState(false);
  const items = queue.slice(0, 5);
  if (browsing) return <Browse sets={sets} learned={learned} onClose={() => setBrowsing(false)} />;
  const browse = <button className="quiet" onClick={() => setBrowsing(true)}>Tất cả tình huống</button>;
  if (!items.length) return (
    <section className="empty">
      <h2>Đủ mẫu câu cho hôm nay</h2>
      <p>Câu đã học sẽ được ôn lại trong mục “Ôn ngữ pháp”. Bạn vẫn có thể xem lại các tình huống.</p>
      {browse}
    </section>
  );
  return <Study key={items.map((x) => x.phrase.id).join()} items={items} onLearned={onLearned} browse={browse} />;
}

function Study({ items, onLearned, browse }: { items: Item[]; onLearned: (ids: string[]) => void; browse: ReactNode }) {
  const [i, setI] = useState(0);
  const [recall, setRecall] = useState<boolean[]>([]);
  const n = items.length;

  if (i < n) {
    const { set, phrase } = items[i];
    return (
      <section className="entry">
        <Meter value={i} total={n}>Câu {i + 1}/{n}</Meter>
        <Tip id="phrases">
          Học <b>cả câu như một khối</b>: nghe rồi nói theo nhiều lần. Câu đã học sẽ được ôn lại trong mục “Ôn ngữ pháp”.
        </Tip>
        <p className="hint">{set.title}</p>
        <h2>{phrase.vi}</h2>
        <p className="phrase-en">{phrase.en}</p>
        <div className="row">
          <SpeakButton onClick={() => speak(phrase.en)} label="Nghe câu" />
          <button className="small" onClick={() => speak(phrase.en, 0.6)}><Snail className="icon" /> Nghe chậm</button>
        </div>
        {phrase.note && <p className="hint">{phrase.note}</p>}
        <SpeakPractice key={phrase.id} target={phrase.en} />
        {browse}
        <div className="actions">
          <button className="primary" onClick={() => setI(i + 1)}>Tiếp <ArrowRight className="icon" /></button>
        </div>
      </section>
    );
  }

  const r = recall.length;
  if (r < n) return (
    <Recall key={r} item={items[r]} index={r} total={n} onDone={(ok) => setRecall([...recall, ok])} />
  );

  const right = recall.filter(Boolean).length;
  return (
    <section className="empty">
      <h2>Bạn nhớ được {right}/{n} câu</h2>
      <p>{right === n ? 'Tuyệt vời!' : 'Các câu này sẽ quay lại trong mục “Ôn ngữ pháp” để bạn nhớ chắc hơn.'}</p>
      <div className="actions">
        <button className="primary" onClick={() => onLearned(items.map((x) => x.phrase.id))}>
          Hoàn thành <Check className="icon" />
        </button>
      </div>
    </section>
  );
}

function SpeakPractice({ target }: { target: string }) {
  const [state, setState] = useState<'idle' | 'listening'>('idle');
  const [heard, setHeard] = useState<string>();
  const [error, setError] = useState<string>();

  if (!speechSupported) return (
    <p className="hint">Trình duyệt này chưa hỗ trợ chấm phát âm; hãy nghe và đọc to theo. (Nên dùng Chrome hoặc Edge.)</p>
  );

  const record = async () => {
    setState('listening'); setError(undefined);
    try { setHeard(await listenOnce()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Có lỗi, hãy thử lại.'); }
    setState('idle');
  };
  const score = heard !== undefined ? scoreSpeech(target, heard) : undefined;
  const good = !!score && score.ratio >= 0.8;

  return (
    <div className="speak-practice">
      <button className="small" disabled={state === 'listening'} onClick={record}>
        <Mic className="icon" /> {state === 'listening' ? 'Đang nghe…' : heard !== undefined ? 'Nói lại' : 'Nói thử'}
      </button>
      {error && <p className="verdict bad"><X className="icon" /> {error}</p>}
      {score && !error && (
        <>
          <p className="phrase-score">
            {score.words.map((w, k) => <span key={k} className={w.ok ? 'ok' : 'bad'}>{w.text} </span>)}
          </p>
          <p className="hint">Bạn nói: “{heard}”</p>
          <p className={`verdict ${good ? 'ok' : 'bad'}`}>
            {good ? <Check className="icon" /> : <X className="icon" />} {Math.round(score.ratio * 100)}% ·{' '}
            {good ? 'Tốt lắm' : 'Nghe lại và nói chậm hơn'}
          </p>
        </>
      )}
    </div>
  );
}

function Recall({ item, index, total, onDone }: { item: Item; index: number; total: number; onDone: (ok: boolean) => void }) {
  const [given, setGiven] = useState('');
  const [result, setResult] = useState<'ok' | 'near' | 'bad'>();
  const { phrase } = item;

  const check = () => {
    if (!given.trim()) return;
    const ok = matches(given, [phrase.en]);
    const near = !ok && editDistance(normalize(given), normalize(phrase.en)) <= 3;
    setResult(ok ? 'ok' : near ? 'near' : 'bad');
    speak(phrase.en);
  };

  return (
    <section className="entry">
      <Meter value={index} total={total}>Nhớ lại {index + 1}/{total}</Meter>
      <p className="prompt">Viết câu tiếng Anh cho:</p>
      <h2>{phrase.vi}</h2>
      <form onSubmit={(e) => { e.preventDefault(); if (!result) check(); }}>
        <input value={given} disabled={!!result} autoFocus autoCapitalize="off" autoComplete="off"
          placeholder="Gõ câu tiếng Anh" onChange={(e) => setGiven(e.target.value)} />
      </form>
      {result && (
        <>
          <p className={`verdict ${result === 'bad' ? 'bad' : 'ok'}`}>
            {result === 'bad' ? <X className="icon" /> : <Check className="icon" />}{' '}
            {result === 'ok' ? 'Đúng rồi' : result === 'near' ? 'Gần đúng, xem lại chính tả' : 'Chưa đúng'}
          </p>
          <div className="row">
            <SpeakButton onClick={() => speak(phrase.en)} label="Nghe câu" />
            <span className="phrase-en">{phrase.en}</span>
          </div>
        </>
      )}
      <div className="actions">
        {result
          ? <button className="primary" onClick={() => onDone(result !== 'bad')}>Tiếp <ArrowRight className="icon" /></button>
          : <>
            <button onClick={() => { setResult('bad'); speak(phrase.en); }}>Xem đáp án</button>
            <button className="primary" disabled={!given.trim()} onClick={check}>Kiểm tra</button>
          </>}
      </div>
    </section>
  );
}

function Browse({ sets, learned, onClose }: { sets: PhraseSet[]; learned: Set<string>; onClose: () => void }) {
  const [open, setOpen] = useState<PhraseSet>();
  if (open) return (
    <section className="entry">
      <button className="back" onClick={() => setOpen(undefined)}><ArrowLeft className="icon" /> Tất cả tình huống</button>
      <h2>{open.title}</h2>
      <div className="list">
        {open.phrases.map((p) => (
          <div key={p.id} className="list-item phrase-row">
            <SpeakButton onClick={() => speak(p.en)} label="Nghe câu" />
            <span>{p.en}<small>{p.vi}</small></span>
            <small>{learned.has(p.id) ? <><Check className="icon" /> đã học</> : 'chưa học'}</small>
          </div>
        ))}
      </div>
    </section>
  );
  const levels = [...new Set(sets.map((s) => s.level))];
  return (
    <section className="entry">
      <button className="back" onClick={onClose}><ArrowLeft className="icon" /> Học mẫu câu hôm nay</button>
      <h2>Tất cả tình huống</h2>
      {levels.map((lv) => (
        <div key={lv}>
          <h3 className="group">{lv}</h3>
          <div className="list">
            {sets.filter((s) => s.level === lv).map((s) => (
              <button key={s.id} className="list-item" onClick={() => setOpen(s)}>
                <span>{s.title}</span>
                <small>đã học {s.phrases.filter((p) => learned.has(p.id)).length}/{s.phrases.length}</small>
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
