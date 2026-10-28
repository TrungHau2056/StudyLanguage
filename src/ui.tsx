import { useEffect, useState } from 'react';
import { getExtra, type Extra, type Word } from './db';

export const TOPICS: Record<string, string> = {
  people: '👪 Con người & gia đình',
  body_health: '🩺 Cơ thể & sức khỏe',
  home: '🏠 Nhà cửa & đời sống',
  food: '🍜 Ăn uống',
  work: '💼 Công việc',
  education: '🎓 Học tập',
  time_numbers: '⏰ Thời gian & số lượng',
  travel: '✈️ Du lịch & giao thông',
  nature: '🌳 Thiên nhiên',
  feelings: '💭 Cảm xúc & tính cách',
  communication: '💬 Giao tiếp',
  society: '🏛️ Xã hội',
  money_shopping: '💰 Tiền bạc & mua sắm',
  science_tech: '🔬 Khoa học & công nghệ',
  arts_leisure: '🎨 Nghệ thuật & giải trí',
  general: '🧩 Từ thông dụng chung',
};

export function speak(text: string, rate = 0.9) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

export function playWord(word: string, extra?: Extra) {
  if (extra?.audio) new Audio(extra.audio).play().catch(() => speak(word));
  else speak(word);
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Matches the word and its regular inflections (decide → decides, decided, deciding; study → studies, studied). */
export function wordPattern(word: string) {
  const w = word.toLowerCase();
  const forms = [w, `${w}s`, `${w}es`, `${w}ed`, `${w}d`, `${w}ing`, `${w}${w.at(-1)}ed`, `${w}${w.at(-1)}ing`];
  if (w.endsWith('e')) forms.push(`${w.slice(0, -1)}ing`);
  if (w.endsWith('y')) forms.push(`${w.slice(0, -1)}ies`, `${w.slice(0, -1)}ied`);
  return new RegExp(`\\b(?:${forms.join('|')})\\b`, 'gi');
}

export function useExtra(word?: Word) {
  const [extra, setExtra] = useState<Extra>();
  useEffect(() => {
    setExtra(undefined);
    if (word) getExtra(word.word).then(setExtra);
  }, [word]);
  return extra;
}

export function WordHead({ word, extra }: { word: Word; extra?: Extra }) {
  return (
    <div className="head">
      <span className="word">{word.word}</span>
      <button className="icon" onClick={() => playWord(word.word, extra)} title="Nghe">🔊</button>
      <div className="meta">{extra?.phonetic || word.phonetic} · {word.pos}</div>
    </div>
  );
}

export function WordInfo({ word }: { word: Word }) {
  return (
    <>
      <div className="meaning">{word.meaning}</div>
      {word.vi.length > 0 && <div className="def">Nghĩa khác: {word.vi.join('; ')}</div>}
      <div className="def">EN: {word.definition}</div>
      <div className="example" onClick={() => speak(word.example)}>
        🔊 {word.example}
        <div className="def">{word.exampleVi}</div>
      </div>
      {word.collocations.length > 0 && (
        <div className="chips">
          <span className="def">Cụm hay gặp:</span>
          {word.collocations.map((c) => <span key={c} className="chip" onClick={() => speak(c)}>{c}</span>)}
        </div>
      )}
      {word.family.length > 0 && (
        <div className="chips">
          <span className="def">Họ từ:</span>
          {word.family.map((f) => <span key={f} className="chip">{f}</span>)}
        </div>
      )}
    </>
  );
}
