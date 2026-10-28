import { useState, type ReactNode } from 'react';
import { ArrowLeft, Check, Languages, Pause, Volume2 } from 'lucide-react';
import type { Reading, Word } from '../db';
import { SpeakButton, Tip, posAbbr, speak, wordPattern } from '../ui';

interface Props {
  readings: Reading[]; byId: Map<number, Word>; studied: Set<number>; known: Set<number>;
  /** Beginners see the A1 passages first. */
  beginner: boolean;
  onRead: (id: number) => void;
}

export default function ReadingView({ readings, byId, studied, known, beginner, onRead }: Props) {
  const [open, setOpen] = useState<Reading>();
  const [showVi, setShowVi] = useState(false);
  const [tip, setTip] = useState<Word>();

  if (open) {
    // Highlight this passage's target words (and their inflections); tap to see the meaning.
    const targets = open.wordIds.map((id) => byId.get(id)).filter((w): w is Word => !!w)
      .map((w) => ({ w, re: new RegExp(`^${wordPattern(w.word).source}$`, 'i') }));
    const paragraph = (text: string): ReactNode[] => text.split(/(\b[\w']+\b)/).map((tok, i) => {
      const w = targets.find((t) => t.re.test(tok))?.w;
      return w ? <mark key={i} className={studied.has(w.id) || known.has(w.id) ? 'known' : ''} onClick={() => setTip(w)}>{tok}</mark> : tok;
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

  const familiar = (id: number) => studied.has(id) || known.has(id);
  const groups: [Reading['level'], string][] = beginner
    ? [['A1', 'Dễ (A1)'], ['A2–B1', 'Trung bình (A2–B1)']]
    : [['A2–B1', 'Trung bình (A2–B1)'], ['A1', 'Dễ (A1)']];
  return (
    <section>
      <h2>Bài đọc</h2>
      <Tip id="read">
        Đọc giúp bạn gặp lại từ đã học trong câu thật. Mỗi ngày đọc 1 bài: chọn bài có nhiều từ bạn đã học
        (số % bên phải), đọc, nghe, rồi bấm “Đã đọc xong”.
      </Tip>
      {groups.map(([level, label]) => (
        <div key={level}>
          <h3 className="group">{label}</h3>
          <div className="list">
            {readings.filter((r) => r.level === level)
              .map((r) => ({ r, pct: Math.round((100 * r.wordIds.filter(familiar).length) / r.wordIds.length) }))
              .sort((a, b) => b.pct - a.pct || a.r.id - b.r.id)
              .map(({ r, pct }) => (
                <button key={r.id} className="list-item" onClick={() => { setOpen(r); setShowVi(false); }}>
                  <span>{r.title}</span>
                  <small>đã học {pct}%</small>
                </button>
              ))}
          </div>
        </div>
      ))}
    </section>
  );
}
