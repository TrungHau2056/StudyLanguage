import { useState } from 'react';
import { addCard, type StudyCard, type Word } from '../db';
import { TOPICS, posAbbr, speak } from '../ui';

export default function WordList({ words, cards }: { words: Word[]; cards: StudyCard[] }) {
  const [q, setQ] = useState('');
  const [topic, setTopic] = useState('');
  const byWord = new Map(cards.map((c) => [c.wordId, c]));
  const query = q.trim().toLowerCase();
  const shown = words
    .filter((w) => (!topic || w.topic === topic) && (!query || w.word.includes(query) || w.meaning.toLowerCase().includes(query)))
    .slice(0, 200);
  return (
    <section>
      <h2>Từ vựng</h2>
      <div className="filters">
        <input className="search" type="search" aria-label="Tìm từ" placeholder="Tìm từ, tiếng Anh hoặc tiếng Việt" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Tất cả chủ đề</option>
          {Object.entries(TOPICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      {shown.length === 0 && <p className="hint center">Không tìm thấy từ nào khớp “{q}”.</p>}
      <table className="words">
        <thead><tr><th>#</th><th>Từ</th><th>Nghĩa</th><th>Ôn lại</th></tr></thead>
        <tbody>
          {shown.map((w) => {
            const c = byWord.get(w.id);
            return (
              <tr key={w.id}>
                <td>{w.id}</td>
                <td><a className="w" onClick={() => speak(w.word)}>{w.word}</a> <span className="pos">{posAbbr(w.pos)}</span></td>
                <td>{w.meaning}</td>
                <td>{c ? c.due.toLocaleDateString('vi-VN') : <button className="small" onClick={() => addCard(w.id)}>Học</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
