import { exportData, importData, type Settings } from '../db';
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
        Học từ mới theo:{' '}
        <select value={settings.topic} onChange={(e) => setSettings({ ...settings, topic: e.target.value })}>
          <option value="all">Tần suất, từ phổ biến trước (khuyên dùng)</option>
          {Object.entries(TOPICS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <p className="hint">
        Học theo chủ đề giúp gặp từ trong cùng một tình huống. Nhưng nếu học dồn nhiều từ gần nghĩa cùng lúc
        (như tên các loại quả, các từ chỉ màu) thì rất dễ nhầm lẫn. Vì vậy mặc định học theo tần suất, còn chủ đề
        dùng khi bạn cần từ cho một tình huống cụ thể.
      </p>

      <h2>Trình độ</h2>
      <p className="hint">
        {settings.testEstimate === undefined
          ? 'Chưa làm bài kiểm tra.'
          : `Lần kiểm tra gần nhất: biết khoảng ${settings.testEstimate} từ. Đang bỏ qua ${settings.knownUpTo} từ phổ biến nhất khi học mới.`}
      </p>
      <div className="row">
        <button onClick={() => go('test')}>Làm bài kiểm tra vốn từ</button>
        {settings.knownUpTo > 0 && <button onClick={() => setSettings({ ...settings, knownUpTo: 0 })}>Học lại từ đầu danh sách</button>}
      </div>

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
