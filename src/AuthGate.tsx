import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { cloudEnabled, signInWithGoogle, signOutUser, watchUser } from './firebase';
import { selectUser } from './db';
import App from './App';

export interface Account { name: string; email: string; photo?: string; signOut: () => void }

/** Requires Google sign-in when Firebase is configured; each account gets its own data. */
export default function AuthGate() {
  const [user, setUser] = useState<User | null | undefined>(cloudEnabled ? undefined : null);
  const [readyFor, setReadyFor] = useState<string>();
  const [error, setError] = useState('');

  useEffect(() => watchUser((u) => {
    setUser(u);
    if (u) selectUser(u.uid).then(() => setReadyFor(u.uid)).catch((e) => setError(String(e)));
  }), []);

  if (!cloudEnabled) return <App />;
  if (error) return <p className="center bad">Lỗi tải dữ liệu: {error}</p>;
  if (user === undefined || (user && readyFor !== user.uid)) return <p className="center">Đang tải…</p>;

  if (!user) return (
    <div className="app">
      <section className="login">
        <h1>Vocab<i style={{ color: 'var(--red)', fontStyle: 'normal' }}>.</i></h1>
        <p>Mỗi ngày một trang từ điển tiếng Anh. Tiến độ lưu theo tài khoản, học tiếp được trên mọi thiết bị.</p>
        <button className="primary big" onClick={() => signInWithGoogle().catch((e) => setError(String(e)))}>
          <GoogleIcon /> Đăng nhập bằng Google
        </button>
      </section>
    </div>
  );

  const account: Account = {
    name: user.displayName ?? user.email ?? '',
    email: user.email ?? '',
    photo: user.photoURL ?? undefined,
    // Reload so every module drops the previous user's in-memory state.
    signOut: () => signOutUser().then(() => location.reload()),
  };
  return <App key={user.uid} account={account} />;
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" style={{ verticalAlign: '-3px', marginRight: 8, background: '#fff', borderRadius: 2 }}>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
  </svg>
);
