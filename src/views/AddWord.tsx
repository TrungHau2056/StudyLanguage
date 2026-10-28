import { useState } from 'react';
import { ArrowLeft, Check, Plus, Search } from 'lucide-react';
import { addCard, addCustomWord, relearn, type Known, type StudyCard, type Word } from '../db';
import { lookupWord } from '../lookup';
import { Tip, WordHead, WordInfo } from '../ui';
import type { View } from '../App';

interface Props { words: Word[]; cards: StudyCard[]; known: Known[]; go: (v: View) => void }

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'preview'; word: Word }
  | { kind: 'exists'; word: Word }
  | { kind: 'error'; message: string; suggestion?: string }
  | { kind: 'saved'; word: Word };

/** Add a word met in the wild: AI looks up the Vietnamese meaning (in the sentence's sense), IPA, example; then it joins reviews. */
export default function AddWord({ words, cards, known, go }: Props) {
  const [input, setInput] = useState('');
  const [context, setContext] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [meaning, setMeaning] = useState('');

  const studied = new Set(cards.map((c) => c.wordId));
  const knownIds = new Set(known.map((k) => k.wordId));

  const search = async (raw = input) => {
    const q = raw.trim();
    if (!q) return;
    // Already in the word list (or added before): learn that entry instead of creating a duplicate.
    const existing = words.find((w) => w.word.toLowerCase() === q.toLowerCase());
    if (existing && !context.trim()) { setState({ kind: 'exists', word: existing }); return; }
    setState({ kind: 'loading' });
    const r = await lookupWord(q, context.trim());
    if (r.ok) { setMeaning(r.word.meaning); setState({ kind: 'preview', word: r.word }); return; }
    if (r.reason === 'not-found') setState({ kind: 'error', message: `Không tìm thấy từ “${q}”.`, suggestion: r.suggestion });
    else if (r.reason === 'signin') setState({ kind: 'error', message: 'Cần đăng nhập để AI tra từ.' });
    else setState({ kind: 'error', message: 'Không tra được lúc này (mất mạng hoặc AI đang bận). Thử lại sau nhé.' });
  };

  const reset = () => { setInput(''); setContext(''); setState({ kind: 'idle' }); };

  return (
    <section>
      <button className="quiet back" onClick={() => go('words')}><ArrowLeft className="icon" /> Sổ từ</button>
      <h2>Thêm từ mới</h2>
      <Tip id="add-word">
        Gặp từ lạ khi đọc, xem phim? Gõ từ đó (và câu bạn gặp nó, nếu có). AI sẽ tìm nghĩa tiếng Việt <b>đúng với câu đó</b>,
        phiên âm, ví dụ; bạn xem lại rồi bấm Lưu. Từ sẽ vào phần ôn từ ngay, không tính vào số từ mới mỗi ngày.
      </Tip>

      {state.kind !== 'saved' && (
        <form className="add-form" onSubmit={(e) => { e.preventDefault(); search(); }}>
          <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Từ hoặc cụm từ, ví dụ: procrastinate"
            aria-label="Từ cần thêm" autoCapitalize="off" autoCorrect="off" spellCheck={false} maxLength={60} />
          <textarea rows={2} value={context} onChange={(e) => setContext(e.target.value)} maxLength={300}
            placeholder="Câu bạn gặp từ này (không bắt buộc, giúp chọn đúng nghĩa)" aria-label="Câu chứa từ" />
          <button className="primary" type="submit" disabled={!input.trim() || state.kind === 'loading'}>
            <Search className="icon" /> {state.kind === 'loading' ? 'Đang tra…' : 'Tra từ'}
          </button>
        </form>
      )}

      {state.kind === 'error' && (
        <p className="bad">
          {state.message}{' '}
          {state.suggestion && <a onClick={() => { setInput(state.suggestion!); search(state.suggestion); }}>Ý bạn là “{state.suggestion}”?</a>}
        </p>
      )}

      {state.kind === 'exists' && (
        <div className="entry found">
          <p className="hint">Từ này đã có trong danh sách:</p>
          <WordHead word={state.word} />
          <WordInfo word={state.word} compact />
          <div className="actions">
            {knownIds.has(state.word.id)
              ? <button className="primary" onClick={async () => { await relearn(state.word.id); setState({ kind: 'saved', word: state.word }); }}>Học lại từ này</button>
              : studied.has(state.word.id)
                ? <p className="ok"><Check className="icon" /> Bạn đang học từ này rồi.</p>
                : <button className="primary" onClick={async () => { await addCard(state.word.id, true); setState({ kind: 'saved', word: state.word }); }}><Plus className="icon" /> Học từ này</button>}
          </div>
          <p className="hint">Nghĩa trong câu bạn gặp khác? Nhập câu đó vào ô thứ hai rồi tra lại để AI tìm đúng nghĩa.</p>
        </div>
      )}

      {state.kind === 'preview' && (
        <div className="entry found">
          <WordHead word={state.word} />
          <label className="edit-meaning">
            <span className="lbl">Nghĩa (sửa được)</span>
            <input value={meaning} onChange={(e) => setMeaning(e.target.value)} aria-label="Nghĩa tiếng Việt" />
          </label>
          <WordInfo word={{ ...state.word, meaning }} />
          {state.word.context && <p className="hint">Câu bạn gặp: “{state.word.context}”</p>}
          <p className="hint">Nội dung do AI tra, trình độ ước tính {state.word.cefr}. Kiểm tra lại nghĩa trước khi lưu.</p>
          <div className="actions">
            <button onClick={reset}>Huỷ</button>
            <button className="primary" disabled={!meaning.trim()} onClick={async () => {
              const w = { ...state.word, meaning: meaning.trim() };
              await addCustomWord(w);
              setState({ kind: 'saved', word: w });
            }}><Plus className="icon" /> Lưu và học</button>
          </div>
        </div>
      )}

      {state.kind === 'saved' && (
        <div className="empty">
          <h2>Đã thêm “{state.word.word}”</h2>
          <p>Từ này sẽ xuất hiện ngay trong phần Ôn từ.</p>
          <div className="actions">
            <button onClick={reset}><Plus className="icon" /> Thêm từ khác</button>
            <button className="primary" onClick={() => go('review')}>Ôn ngay</button>
          </div>
        </div>
      )}
    </section>
  );
}
