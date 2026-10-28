import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, loadSettings, startOfToday, type Reading, type Word } from './db';
import Home from './views/Home';
import Learn from './views/Learn';
import Review from './views/Review';
import Writing from './views/Writing';
import ReadingView from './views/Reading';
import WordList from './views/WordList';
import SettingsView from './views/Settings';
import Placement from './views/Placement';
import './App.css';

export type View = 'home' | 'learn' | 'review' | 'write' | 'read' | 'words' | 'settings' | 'test';

export default function App() {
  const [words, setWords] = useState<Word[]>();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [view, setView] = useState<View>('home');
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}words.json`).then((r) => r.json()).then(setWords);
    fetch(`${import.meta.env.BASE_URL}readings.json`).then((r) => r.json()).then(setReadings);
  }, []);
  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // Re-render periodically so short learning steps (e.g. "1 phút") come back into the queue.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const byId = useMemo(() => new Map(words?.map((w) => [w.id, w])), [words]);
  const cards = useLiveQuery(() => db.cards.toArray(), []);

  if (!words || !cards) return <p className="center">Đang tải…</p>;

  const now = new Date();
  const due = cards.filter((c) => c.due <= now).sort((a, b) => +a.due - +b.due);
  const learnedToday = cards.filter((c) => c.addedAt >= startOfToday()).length;
  const newLeft = Math.max(settings.newPerDay - learnedToday, 0);
  const studied = new Set(cards.map((c) => c.wordId));
  const nextNew = words
    .filter((w) => !studied.has(w.id) && (settings.topic === 'all' ? w.id > settings.knownUpTo : w.topic === settings.topic))
    .slice(0, newLeft);

  const tabs: [View, string][] = [
    ['home', 'Tổng quan'],
    ['learn', `Học mới (${nextNew.length})`],
    ['review', `Ôn tập (${due.length})`],
    ['write', 'Luyện viết'],
    ['read', 'Đọc'],
    ['words', 'Từ vựng'],
    ['settings', 'Cài đặt'],
  ];

  return (
    <div className="app">
      <nav>
        <b>📚 Vocab</b>
        {tabs.map(([v, label]) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{label}</button>
        ))}
      </nav>
      <main>
        {view === 'home' && <Home words={words} cards={cards} due={due.length} newLeft={nextNew.length} settings={settings} go={setView} />}
        {view === 'learn' && <Learn queue={nextNew} settings={settings} go={setView} />}
        {view === 'review' && <Review due={due} byId={byId} cards={cards} words={words} />}
        {view === 'write' && <Writing cards={cards} byId={byId} />}
        {view === 'read' && <ReadingView readings={readings} byId={byId} studied={studied} />}
        {view === 'words' && <WordList words={words} cards={cards} />}
        {view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} go={setView} />}
        {view === 'test' && <Placement words={words} settings={settings} setSettings={setSettings} go={setView} />}
      </main>
      <footer>
        Dữ liệu: <a href="https://www.newgeneralservicelist.com/">NGSL</a> (CC BY-SA), từ điển Anh–Việt (Hồ Ngọc Đức),{' '}
        <a href="https://dictionaryapi.dev/">Free Dictionary API</a>; ví dụ, cụm từ, bài đọc do AI tạo. Lịch ôn: FSRS.
      </footer>
    </div>
  );
}
