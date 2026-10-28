import { useState } from 'react';
import { addCard, type StudyCard, type Word } from '../db';
import { TOPICS, speak } from '../ui';

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
      <div className="row">
        <input className="search" placeholder="Tìm từ (Anh hoặc Việt)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="">Tất cả chủ đề</option>
          {Object.entries(TOPICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <table>
        <thead><tr><th>#</th><th>Từ</th><th>Nghĩa</th><th>Ôn lại</th></tr></thead>
        <tbody>
          {shown.map((w) => {
            const c = byWord.get(w.id);
            return (
              <tr key={w.id}>
                <td>{w.id}</td>
                <td><a onClick={() => speak(w.word)}>{w.word}</a> <small>{w.pos}</small></td>
                <td>{w.meaning}</td>
                <td>{c ? c.due.toLocaleDateString('vi-VN') : <button className="small" onClick={() => addCard(w.id)}>+ Học</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
