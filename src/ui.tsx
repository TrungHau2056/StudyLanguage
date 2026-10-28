import { useEffect, useState, type ReactNode } from 'react';
import { Volume2 } from 'lucide-react';
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

/** Body of the entry: sense, definition, example, collocations (headword as ~), word family. */
export function WordInfo({ word }: { word: Word }) {
  return (
    <>
      <div className="sense"><span className="num">1</span>{word.meaning}</div>
      <div className="def en">{word.definition}</div>
      {word.vi.length > 0 && <div className="alt">Nghĩa khác: {word.vi.join('; ')}</div>}
      <div className="ex">
        <button onClick={() => speak(word.example)} title="Nghe câu ví dụ">{word.example}</button>
        <div className="ex-vi">{word.exampleVi}</div>
      </div>
      {word.collocations.length > 0 && (
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
      {word.family.length > 0 && (
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
