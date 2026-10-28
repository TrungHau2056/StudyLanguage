import { ArrowLeft } from 'lucide-react';
import { SpeakButton, speak } from '../ui';
import type { View } from '../App';

type Row = [symbol: string, example: string, tip: string];

const VOWELS: Row[] = [
  ['iː', 'see', 'i kéo dài, miệng cười'],
  ['ɪ', 'sit', 'i ngắn, hơi giống “i” lơ lửng giữa i và ê'],
  ['e', 'bed', 'gần như “e” tiếng Việt'],
  ['æ', 'cat', 'giữa “a” và “e”, mở miệng rộng'],
  ['ʌ', 'cup', 'gần như “ă” ngắn'],
  ['ɑː', 'car', '“a” kéo dài'],
  ['ɒ', 'hot', '“o” ngắn, tròn môi'],
  ['ɔː', 'law', '“o” kéo dài'],
  ['ʊ', 'book', '“u” ngắn'],
  ['uː', 'food', '“u” kéo dài, chu môi'],
  ['ə', 'about', '“ơ” rất nhẹ, không nhấn; âm hay gặp nhất'],
  ['ɜː', 'bird', '“ơ” kéo dài'],
  ['eɪ', 'day', '“ây”'],
  ['aɪ', 'my', '“ai”'],
  ['ɔɪ', 'boy', '“oi”'],
  ['aʊ', 'now', '“ao”'],
  ['əʊ', 'go', '“âu” (Anh-Anh) / “ô-u” (Anh-Mỹ)'],
];

const CONSONANTS: Row[] = [
  ['θ', 'think', 'đặt đầu lưỡi giữa hai hàm răng rồi thổi hơi; không đọc là “th” hay “t”'],
  ['ð', 'this', 'như θ nhưng rung cổ họng; không đọc là “d” hay “đ”'],
  ['ʃ', 'she', '“s” cong lưỡi, chu môi (như “s” miền Bắc đọc nặng)'],
  ['s', 'see', '“x” tiếng Việt'],
  ['ʒ', 'vision', 'như ʃ nhưng rung cổ họng'],
  ['tʃ', 'chair', '“ch” bật hơi, chu môi'],
  ['dʒ', 'job', 'như tʃ nhưng rung cổ họng'],
  ['z', 'zoo', '“d” miền Bắc, rung'],
  ['v', 'very', 'răng trên chạm môi dưới'],
  ['r', 'red', 'cong lưỡi, không rung lưỡi'],
  ['ŋ', 'sing', '“ng” cuối'],
  ['j', 'yes', '“d” miền Nam (“y”)'],
];

const MISTAKES: [string, string, string[]][] = [
  ['Bỏ âm cuối', 'Tiếng Việt hay nuốt âm cuối, nhưng tiếng Anh phải đọc rõ: thiếu âm cuối là thành từ khác.', ['rice', 'five', 'like', 'bus', 'cats']],
  ['Đuôi -s', 'Đọc /s/ sau âm vô thanh (cats), /z/ sau âm hữu thanh (dogs), /ɪz/ sau s, x, sh, ch (buses).', ['cats', 'dogs', 'buses']],
  ['Đuôi -ed', 'Đọc /t/ sau âm vô thanh (worked), /d/ sau âm hữu thanh (played), /ɪd/ sau t, d (wanted).', ['worked', 'played', 'wanted']],
  ['Trọng âm', 'Dấu ˈ trong phiên âm đứng trước âm tiết được nhấn: đọc âm tiết đó to và dài hơn. Nhấn sai thì người nghe khó hiểu.', ['photograph', 'photographer', 'decision']],
];

function Table({ rows }: { rows: Row[] }) {
  return (
    <table className="sounds">
      <thead><tr><th>Ký hiệu</th><th>Ví dụ</th><th>Cách đọc</th></tr></thead>
      <tbody>
        {rows.map(([sym, ex, tip]) => (
          <tr key={sym}>
            <td className="sym">/{sym}/</td>
            <td><span className="w">{ex}</span> <SpeakButton onClick={() => speak(ex, 0.8)} label={`Nghe ${ex}`} /></td>
            <td>{tip}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Pronunciation primer for Vietnamese beginners: how to read the IPA shown on every word. */
export default function Sounds({ go }: { go: (v: View) => void }) {
  return (
    <section className="settings">
      <button className="quiet back" onClick={() => go('home')}><ArrowLeft className="icon" /> Hôm nay</button>
      <h2>Cách đọc phiên âm</h2>
      <p>
        Dòng chữ giữa hai dấu gạch chéo dưới mỗi từ, ví dụ <span className="sym">/dɪˈsɪʒ.ən/</span>, là phiên âm IPA:
        mỗi ký hiệu là một âm. Dấu <b>ˈ</b> đánh dấu âm tiết được nhấn, dấu <b>ː</b> nghĩa là kéo dài âm đứng trước.
        Bấm nút loa để nghe, rồi đọc theo.
      </p>
      <p className="hint">Cách đọc ghi bằng âm tiếng Việt chỉ là gần đúng, hãy luôn nghe để so.</p>

      <h2>Nguyên âm</h2>
      <Table rows={VOWELS} />

      <h2>Phụ âm khó với người Việt</h2>
      <Table rows={CONSONANTS} />

      <h2>Lỗi người Việt hay gặp</h2>
      {MISTAKES.map(([title, text, examples]) => (
        <div key={title} className="mistake">
          <b>{title}</b>
          <p>{text}</p>
          <div className="row">
            {examples.map((e) => <button key={e} className="small" onClick={() => speak(e, 0.8)}>{e}</button>)}
          </div>
        </div>
      ))}
    </section>
  );
}
