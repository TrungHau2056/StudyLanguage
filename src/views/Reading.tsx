import { useState, type ReactNode } from 'react';
import type { Reading, Word } from '../db';
import { speak, wordPattern } from '../ui';

interface Props { readings: Reading[]; byId: Map<number, Word>; studied: Set<number>; onRead: (id: number) => void }

export default function ReadingView({ readings, byId, studied, onRead }: Props) {
  const [open, setOpen] = useState<Reading>();
  const [showVi, setShowVi] = useState(false);
  const [tip, setTip] = useState<Word>();

  if (open) {
    // Highlight this passage's target words (and their inflections); tap to see the meaning.
    const targets = open.wordIds.map((id) => byId.get(id)).filter((w): w is Word => !!w)
      .map((w) => ({ w, re: new RegExp(`^${wordPattern(w.word).source}$`, 'i') }));
    const parts: ReactNode[] = open.text.split(/(\b[\w']+\b)/).map((tok, i) => {
      const w = targets.find((t) => t.re.test(tok))?.w;
      return w ? <mark key={i} className={studied.has(w.id) ? 'known' : ''} onClick={() => setTip(w)}>{tok}</mark> : tok;
    });
    return (
      <section className="card">
        <a onClick={() => { setOpen(undefined); setTip(undefined); speechSynthesis.cancel(); }}>← Danh sách bài</a>
        <h2>{open.title}</h2>
        <div className="row">
          <button onClick={() => speak(open.text, 0.85)}>🔊 Nghe cả bài</button>
          <button onClick={() => speechSynthesis.cancel()}>⏹ Dừng</button>
          <button onClick={() => setShowVi((v) => !v)}>{showVi ? 'Ẩn' : 'Xem'} bản dịch</button>
        </div>
        <p className="passage">{parts}</p>
        {tip && (
          <div className="callout" onClick={() => speak(tip.word)}>
            🔊 <b>{tip.word}</b> ({tip.pos}): {tip.meaning}
          </div>
        )}
        {showVi && <p className="passage def">{open.vi}</p>}
        <p className="hint">Cách đọc: đọc 1 lần để hiểu ý chính, nghe 1 lần, rồi đọc to theo. Chạm vào từ được tô để xem nghĩa.</p>
        <button className="primary" onClick={() => { onRead(open.id); setOpen(undefined); setTip(undefined); speechSynthesis.cancel(); }}>
          ✓ Đã đọc xong bài này
        </button>
      </section>
    );
  }

  return (
    <section>
      <p className="hint">Mỗi bài dùng khoảng 20 từ theo thứ tự tần suất. Bài có nhiều từ bạn đã học sẽ hiện lên trước.</p>
      <div className="list">
        {[...readings]
          .map((r) => ({ r, pct: Math.round((100 * r.wordIds.filter((id) => studied.has(id)).length) / r.wordIds.length) }))
          .sort((a, b) => b.pct - a.pct || a.r.id - b.r.id)
          .map(({ r, pct }) => (
            <button key={r.id} className="list-item" onClick={() => { setOpen(r); setShowVi(false); }}>
              <span>Bài {r.id}: {r.title}</span>
              <small>đã học {pct}% từ</small>
            </button>
          ))}
      </div>
    </section>
  );
}
