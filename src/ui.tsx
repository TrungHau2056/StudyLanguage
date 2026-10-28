import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, Lightbulb, Volume2 } from 'lucide-react';
import { getExtra, type Extra, type Word } from './db';

export const TOPICS: Record<string, string> = {
  people: 'Con người & gia đình',
  body_health: 'Cơ thể & sức khỏe',
  home: 'Nhà cửa & đời sống',
  food: 'Ăn uống',
  work: 'Công việc',
  education: 'Học tập',
  time_numbers: 'Thời gian & số lượng',
  travel: 'Du lịch & giao thông',
  nature: 'Thiên nhiên',
  feelings: 'Cảm xúc & tính cách',
  communication: 'Giao tiếp',
  society: 'Xã hội',
  money_shopping: 'Tiền bạc & mua sắm',
  science_tech: 'Khoa học & công nghệ',
  arts_leisure: 'Nghệ thuật & giải trí',
  general: 'Từ thông dụng chung',
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

const POS_ABBR: Record<string, string> = {
  noun: 'n.', verb: 'v.', adjective: 'adj.', adverb: 'adv.', preposition: 'prep.', pronoun: 'pron.',
  conjunction: 'conj.', determiner: 'det.', article: 'art.', number: 'num.', interjection: 'interj.',
};
export const posAbbr = (pos: string) => POS_ABBR[pos] ?? pos;

export function SpeakButton({ onClick, label = 'Nghe phát âm' }: { onClick: () => void; label?: string }) {
  return (
    <button className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      <Volume2 className="icon" />
    </button>
  );
}

/** Headword line of a dictionary entry: word, pronunciation, part of speech. */
export function WordHead({ word, extra }: { word: Word; extra?: Extra }) {
  return (
    <div>
      <div className="hw-line">
        <span className="hw">{word.word}</span>
        <SpeakButton onClick={() => playWord(word.word, extra)} />
      </div>
      <div className="ipa">{extra?.phonetic || word.phonetic}<span className="pos">{posAbbr(word.pos)}</span></div>
    </div>
  );
}

/**
 * Body of the entry: sense, definition, example, collocations (headword as ~), word family.
 * Compact shows only the meaning and one example (less to take in at first sight); the rest is one tap away.
 */
export function WordInfo({ word, compact = false }: { word: Word; compact?: boolean }) {
  const [more, setMore] = useState(!compact);
  return (
    <>
      <div className="sense"><span className="num">1</span>{word.meaning}</div>
      {more && <div className="def en">{word.definition}</div>}
      {more && word.vi.length > 0 && <div className="alt">Nghĩa khác: {word.vi.join('; ')}</div>}
      <div className="ex">
        <button onClick={() => speak(word.example)} title="Nghe câu ví dụ">{word.example}</button>
        <div className="ex-vi">{word.exampleVi}</div>
      </div>
      {!more && (
        <button className="quiet more" onClick={() => setMore(true)}>
          Xem thêm: định nghĩa, cụm từ, họ từ <ChevronDown className="icon" />
        </button>
      )}
      {more && word.collocations.length > 0 && (
        <div className="colls">
          <span className="lbl">Cụm hay gặp</span>
          {word.collocations.map((c, i) => (
            <span key={c}>
              {i > 0 && <span className="sep">·</span>}
              <button onClick={() => speak(c)} title="Nghe">{c.replace(wordPattern(word.word), '~')}</button>
            </span>
          ))}
        </div>
      )}
      {more && word.family.length > 0 && (
        <div className="family">
          <span className="lbl">Họ từ</span>
          {word.family.map((f, i) => {
            const [, w, pos] = f.match(/^(.*?)\s*\((\w+)\)$/) ?? [f, f, ''];
            return <span key={f}>{i > 0 && <span className="sep">·</span>}{w} {pos && <i>{posAbbr(pos)}</i>}</span>;
          })}
        </div>
      )}
    </>
  );
}

/** Thin progress rule with a count, used at the top of each study screen. */
export function Meter({ value, total, children }: { value: number; total: number; children: ReactNode }) {
  return (
    <div className="meter">
      <div className="bar"><i style={{ width: `${total ? (100 * value) / total : 0}%` }} /></div>
      <span>{children}</span>
    </div>
  );
}

export const TipsContext = createContext<{ seen: string[]; dismiss: (id: string) => void }>({ seen: [], dismiss: () => {} });

/** One-time explanation shown the first time a screen is opened; "Đã hiểu" hides it for good. */
export function Tip({ id, children }: { id: string; children: ReactNode }) {
  const { seen, dismiss } = useContext(TipsContext);
  if (seen.includes(id)) return null;
  return (
    <aside className="tip" role="note">
      <Lightbulb className="icon" />
      <div>{children}</div>
      <button className="small" onClick={() => dismiss(id)}>Đã hiểu</button>
    </aside>
  );
}

/** Edit distance, for accepting small typos in typed answers. */
export function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Four meaning options: the answer plus distractors of the same part of speech, topped up from any word. */
export function meaningOptions(word: Word, words: Word[]): string[] {
  const others = shuffle(words.filter((w) => w.id !== word.id && w.meaning !== word.meaning));
  const samePos = others.filter((w) => w.pos === word.pos);
  const picks = [...samePos, ...others.filter((w) => w.pos !== word.pos)].slice(0, 3);
  return shuffle([word.meaning, ...picks.map((w) => w.meaning)]);
}
