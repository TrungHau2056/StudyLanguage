import { useState } from 'react';
import { Plus, Star } from 'lucide-react';
import { State } from 'ts-fsrs';
import { LEVELS, addCard, deleteCustomWord, isSkipped, markKnown, relearn, type Known, type Settings, type StudyCard, type Word } from '../db';
import { TOPICS, Tip, posAbbr, speak } from '../ui';
import type { View } from '../App';

export type WordStatus = 'new' | 'skipped' | 'learning' | 'mastered' | 'known';

export const STATUS_LABEL: Record<WordStatus, string> = {
  new: 'Chưa học',
  skipped: 'Bỏ qua theo trình độ',
  learning: 'Đang học',
  mastered: 'Đã thuộc',
  known: 'Đã biết',
};

/** Where a word stands for this learner. Mastered = remembered for 3+ weeks; known = never needed teaching. */
export function wordStatus(w: Word, card: StudyCard | undefined, known: boolean, settings: Settings): WordStatus {
  if (known) return 'known';
  if (card) return card.state === State.Review && card.stability >= 21 ? 'mastered' : 'learning';
  return isSkipped(w, settings) ? 'skipped' : 'new';
}

interface Props { words: Word[]; cards: StudyCard[]; known: Known[]; settings: Settings; go: (v: View) => void }

export default function WordList({ words, cards, known, settings, go }: Props) {
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState('');
  const byWord = new Map(cards.map((c) => [c.wordId, c]));
  const knownIds = new Set(known.map((k) => k.wordId));
  const query = q.trim().toLowerCase();
  // The learner's own words first: they are the ones being looked for most.
  const rows = [...words.filter((w) => w.custom).reverse(), ...words.filter((w) => !w.custom)]
    .map((w) => ({ w, card: byWord.get(w.id), status: wordStatus(w, byWord.get(w.id), knownIds.has(w.id), settings) }));
  const shown = rows
    .filter(({ w, status: s }) => (!topic || w.topic === topic) && (!level || w.cefr === level)
      && (!status || (status === 'mine' ? w.custom : s === status))
      && (!query || w.word.includes(query) || w.meaning.toLowerCase().includes(query)))
    .slice(0, 200);

  return (
    <section>
      <div className="list-head">
        <h2>Sổ từ</h2>
        <button className="primary" onClick={() => go('add-word')}><Plus className="icon" /> Thêm từ</button>
      </div>
      <Tip id="words">
        Mỗi từ được xếp vào một nhóm: <b>Chưa học</b>, <b>Đang học</b>, <b>Đã thuộc</b> (nhớ được trên 3 tuần) hoặc <b>Đã biết</b>
        (bạn biết từ trước nên không phải học và ôn). Từ dưới trình độ bạn chọn là <b>Bỏ qua</b>: không bị dạy lại,
        thỉnh thoảng chỉ hỏi nhanh 1 câu để chắc là bạn nhớ. Bấm “Đã biết” hoặc “Học lại” để đổi nhóm của một từ.
      </Tip>
      <div className="filters">
        <input className="search" type="search" aria-label="Tìm từ" placeholder="Tìm từ, tiếng Anh hoặc tiếng Việt" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Trình độ" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">Mọi trình độ</option>
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select aria-label="Nhóm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Mọi nhóm</option>
          <option value="mine">Từ tôi thêm</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
        <select aria-label="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Mọi chủ đề</option>
          {Object.entries(TOPICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      {shown.length === 0 && <p className="hint center">Không có từ nào khớp bộ lọc.</p>}
      <table className="words">
        <thead><tr><th>#</th><th>Từ</th><th>Nghĩa</th><th>Nhóm</th></tr></thead>
        <tbody>
          {shown.map(({ w, card, status: s }) => (
            <tr key={w.id}>
              <td>{w.custom ? <Star className="icon" aria-label="Từ bạn thêm" /> : w.id}</td>
              <td>
                <a className="w" onClick={() => speak(w.word)}>{w.word}</a> <span className="pos">{posAbbr(w.pos)}</span>
                <span className="level">{w.cefr}</span>
              </td>
              <td>{w.meaning}</td>
              <td>
                <span className={`status ${s}`}>{STATUS_LABEL[s]}</span>
                {s === 'learning' && card && <div className="hint">ôn {card.due.toLocaleDateString('vi-VN')}</div>}
                <div className="row-actions">
                  {(s === 'new' || s === 'skipped') && <button className="small" onClick={() => addCard(w.id)}>Học</button>}
                  {s !== 'known' && <button className="small" onClick={() => markKnown([w.id], 'self')}>Đã biết</button>}
                  {s === 'known' && <button className="small" onClick={() => relearn(w.id)}>Học lại</button>}
                  {w.custom && <button className="small" onClick={() => { if (confirm(`Xoá “${w.word}” khỏi sổ từ?`)) deleteCustomWord(w.id); }}>Xoá</button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
