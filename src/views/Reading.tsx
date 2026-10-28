import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Languages, Pause, Volume2 } from 'lucide-react';
import type { Reading, Word } from '../db';
import { SpeakButton, posAbbr, speak, wordPattern } from '../ui';

interface Props { readings: Reading[]; byId: Map<number, Word>; studied: Set<number>; onRead: (id: number) => void }

export default function ReadingView({ readings, byId, studied, onRead }: Props) {
  const [open, setOpen] = useState<Reading>();
  const [showVi, setShowVi] = useState(false);
  const [tip, setTip] = useState<Word>();

  if (open) {
    // Highlight this passage's target words (and their inflections); tap to see the meaning.
    const targets = open.wordIds.map((id) => byId.get(id)).filter((w): w is Word => !!w)
      .map((w) => ({ w, re: new RegExp(`^${wordPattern(w.word).source}$`, 'i') }));
    const paragraph = (text: string): ReactNode[] => text.split(/(\b[\w']+\b)/).map((tok, i) => {
      const w = targets.find((t) => t.re.test(tok))?.w;
      return w ? <mark key={i} className={studied.has(w.id) ? 'known' : ''} onClick={() => setTip(w)}>{tok}</mark> : tok;
    });
    const close = () => { setOpen(undefined); setTip(undefined); speechSynthesis.cancel(); };
    return (
      <section>
        <button className="quiet back" onClick={close}><ArrowLeft className="icon" /> Danh sách bài</button>
        <h2>{open.title}</h2>
        <div className="row">
          <button onClick={() => speak(open.text, 0.85)}><Volume2 className="icon" /> Nghe cả bài</button>
          <button onClick={() => speechSynthesis.cancel()}><Pause className="icon" /> Dừng</button>
          <button onClick={() => setShowVi((v) => !v)}><Languages className="icon" /> {showVi ? 'Ẩn' : 'Xem'} bản dịch</button>
        </div>
        {open.text.split(/\n\s*\n/).map((p, i) => <p key={i} className="passage">{paragraph(p)}</p>)}
        {showVi && open.vi.split(/\n\s*\n/).map((p, i) => <p key={i} className="passage vi">{p}</p>)}
        <p className="hint">Đọc một lần để hiểu ý chính, nghe một lần, rồi đọc to theo. Chạm vào từ được gạch chân để xem nghĩa.</p>
        {tip && (
          <div className="gloss" role="status">
            <div className="hw-line"><b className="w">{tip.word}</b><span className="pos">{posAbbr(tip.pos)}</span><SpeakButton onClick={() => speak(tip.word)} /></div>
            {tip.meaning}
          </div>
        )}
        <div className="actions">
          <button className="primary" onClick={() => { onRead(open.id); close(); }}><Check className="icon" /> Đã đọc xong bài này</button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2>Bài đọc</h2>
      <p className="hint">Mỗi bài dùng khoảng 20 từ theo thứ tự phổ biến. Bài có nhiều từ bạn đã học được xếp lên trước.</p>
      <div className="list">
        {[...readings]
          .map((r) => ({ r, pct: Math.round((100 * r.wordIds.filter((id) => studied.has(id)).length) / r.wordIds.length) }))
          .sort((a, b) => b.pct - a.pct || a.r.id - b.r.id)
          .map(({ r, pct }) => (
            <button key={r.id} className="list-item" onClick={() => { setOpen(r); setShowVi(false); }}>
              <span>{r.title}</span>
              <small>đã học {pct}%</small>
            </button>
          ))}
      </div>
    </section>
  );
}
