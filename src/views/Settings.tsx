import { LEVELS, exportData, importData, type Level, type Settings } from '../db';
import type { Account } from '../AuthGate';
import { TOPICS } from '../ui';
import type { View } from '../App';

interface Props { settings: Settings; setSettings: (s: Settings) => void; go: (v: View) => void; account?: Account }

export default function SettingsView({ settings, setSettings, go, account }: Props) {
  const download = async () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([await exportData()], { type: 'application/json' }));
    a.download = `vocab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const upload = async (file?: File) => {
    if (!file || !confirm('Thay toàn bộ tiến độ hiện tại bằng file này?')) return;
    await importData(await file.text());
    location.reload();
  };
  return (
    <section className="settings">
      <h2>Cài đặt</h2>
      {account && (
        <div className="account">
          <div><b>{account.name}</b><div className="hint">{account.email} · tiến độ tự đồng bộ theo tài khoản</div></div>
          <button onClick={account.signOut}>Đăng xuất</button>
        </div>
      )}
      <h2>Học từ mới</h2>
      <label>
        Số từ mới mỗi ngày:{' '}
        <input type="number" min={0} max={100} value={settings.newPerDay}
          onChange={(e) => setSettings({ ...settings, newPerDay: Number(e.target.value) })} />
      </label>
      <p className="hint">Khuyến nghị 10–20. Mỗi từ mới sẽ sinh thêm lượt ôn trong những ngày sau.</p>

      <label>
        Thứ tự học:
        <select value={settings.order} onChange={(e) => setSettings({ ...settings, order: e.target.value as Settings['order'] })}>
          <option value="level">Theo trình độ, từ dễ hình dung trước (khuyên dùng)</option>
          <option value="frequency">Theo độ phổ biến</option>
        </select>
      </label>
      <label>
        Chủ đề:
        <select value={settings.topic} onChange={(e) => setSettings({ ...settings, topic: e.target.value })}>
          <option value="all">Mọi chủ đề</option>
          {Object.entries(TOPICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <p className="hint">
        Học theo chủ đề giúp gặp từ trong cùng một tình huống. Nhưng học dồn nhiều từ gần nghĩa cùng lúc
        (tên các loại quả, các màu) rất dễ nhầm, nên chỉ chọn chủ đề khi bạn cần từ cho một tình huống cụ thể.
      </p>

      <h2>Trình độ</h2>
      <label>
        Bắt đầu từ trình độ:
        <select value={settings.startLevel} onChange={(e) => setSettings({ ...settings, startLevel: e.target.value as Level })}>
          {LEVELS.map((l) => <option key={l} value={l}>{l}{l === 'A1' ? ' (mới bắt đầu)' : ''}</option>)}
        </select>
      </label>
      <p className="hint">
        Từ dưới trình độ này không bị dạy lại, mỗi ngày chỉ hỏi nhanh vài từ để chắc là bạn nhớ; quên thì từ đó được đưa lại vào phần học.
        {settings.testEstimate !== undefined && ` Bài kiểm tra gần nhất: biết khoảng ${settings.testEstimate} từ, bỏ qua ${settings.knownUpTo} từ phổ biến nhất.`}
      </p>
      <p className="hint"><a onClick={() => go('sounds')}>Cách đọc phiên âm</a> cho người mới bắt đầu.</p>
      <div className="row">
        <button onClick={() => go('test')}>Làm bài kiểm tra vốn từ</button>
        {settings.knownUpTo > 0 && <button onClick={() => setSettings({ ...settings, knownUpTo: 0 })}>Học lại từ đầu danh sách</button>}
      </div>

      <h2>Cài lên điện thoại</h2>
      {window.matchMedia('(display-mode: standalone)').matches ? (
        <p className="hint">Bạn đang dùng bản đã cài lên màn hình chính. Mất mạng vẫn học được; tiến độ tự đồng bộ khi có mạng lại.</p>
      ) : (
        <ol className="install">
          <li><b>iPhone:</b> mở trang này bằng <b>Safari</b> → bấm nút <b>Chia sẻ</b> (ô vuông có mũi tên lên) → <b>Thêm vào MH chính</b> → <b>Thêm</b>.</li>
          <li><b>Android:</b> mở bằng <b>Chrome</b> → menu ⋮ → <b>Cài đặt ứng dụng</b> (hoặc Thêm vào màn hình chính).</li>
          <li>Mở app bằng biểu tượng <b>Vocab</b> trên màn hình chính: toàn màn hình, học được cả khi mất mạng.</li>
        </ol>
      )}

      <h2>Sao lưu</h2>
      <p className="hint">
        {account ? 'Dữ liệu đã tự lưu theo tài khoản. Bạn vẫn có thể xuất file để giữ một bản dự phòng.' : 'Dữ liệu chỉ lưu trong trình duyệt này. Xuất file để chuyển sang máy khác.'}
      </p>
      <div className="row">
        <button onClick={download}>Xuất dữ liệu</button>
        <label className="button">Nhập dữ liệu<input type="file" accept=".json" hidden onChange={(e) => upload(e.target.files?.[0])} /></label>
      </div>
    </section>
  );
}
