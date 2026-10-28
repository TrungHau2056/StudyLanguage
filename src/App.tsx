import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { dailyKey, db, loadSettings, saveSettings, startOfToday, type Reading, type Word } from './db';
import type { Account } from './AuthGate';
import Home from './views/Home';
import Learn from './views/Learn';
import Review from './views/Review';
import Writing from './views/Writing';
import ReadingView from './views/Reading';
import WordList from './views/WordList';
import SettingsView from './views/Settings';
import Placement from './views/Placement';
import { StepBar, Welcome } from './views/Routine';
import './App.css';

export type View = 'home' | 'learn' | 'review' | 'write' | 'read' | 'words' | 'settings' | 'test' | 'welcome';

/** Per-day progress for the activities that don't live in the database. */
export interface Daily { date: string; written: number; read: number[] }
const today = () => new Date().toDateString();
/** Progress resets when the day changes (also mid-session, e.g. studying past midnight). */
const current = (d: Daily): Daily => (d.date === today() ? d : { date: today(), written: 0, read: [] });
const loadDaily = () => current(JSON.parse(localStorage.getItem(dailyKey()) ?? 'null') ?? { date: '', written: 0, read: [] });

export const WRITE_GOAL = 3;

export interface Step { view: View; label: string; detail: string; done: boolean }

export default function App({ account }: { account?: Account }) {
  const [words, setWords] = useState<Word[]>();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [settings, setSettings] = useState(loadSettings);
  const [view, setView] = useState<View>(settings.onboarded ? 'home' : 'welcome');
  const [daily, setDaily] = useState(loadDaily);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}words.json`).then((r) => r.json()).then(setWords);
    fetch(`${import.meta.env.BASE_URL}readings.json`).then((r) => r.json()).then(setReadings);
  }, []);
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);
  useEffect(() => {
    localStorage.setItem(dailyKey(), JSON.stringify(daily));
  }, [daily]);
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

  // The daily routine, in order. "Tiếp tục" always goes to the first unfinished step.
  // Learning new words makes them due at once, so step 1 reopens to practise them right away.
  const fresh = current(daily);
  const steps: Step[] = [
    { view: 'review', label: 'Ôn tập', detail: due.length ? `${due.length} từ đến hạn` : 'Không còn từ đến hạn', done: due.length === 0 },
    { view: 'learn', label: 'Học từ mới', detail: nextNew.length ? `Còn ${nextNew.length} từ` : 'Đủ chỉ tiêu hôm nay', done: nextNew.length === 0 },
    { view: 'write', label: 'Luyện viết', detail: `${Math.min(fresh.written, WRITE_GOAL)}/${WRITE_GOAL} câu`, done: fresh.written >= WRITE_GOAL },
    { view: 'read', label: 'Đọc 1 bài', detail: fresh.read.length ? 'Đã đọc' : 'Chưa đọc', done: fresh.read.length > 0 },
  ];
  const nextStep = steps.find((s) => !s.done);
  const inRoutine = steps.some((s) => s.view === view);

  const tabs: [View, string][] = [
    ['home', 'Hôm nay'],
    ['review', `Ôn tập (${due.length})`],
    ['learn', `Học mới (${nextNew.length})`],
    ['write', 'Viết'],
    ['read', 'Đọc'],
    ['words', 'Từ vựng'],
    ['settings', 'Cài đặt'],
  ];

  if (view === 'welcome') return (
    <div className="app"><Welcome settings={settings} setSettings={setSettings} go={setView} /></div>
  );

  return (
    <div className="app">
      <nav>
        <b>📚 Vocab</b>
        {account && (
          <button className="avatar" title={account.email} onClick={() => setView('settings')}>
            {account.photo ? <img src={account.photo} alt="" referrerPolicy="no-referrer" /> : account.name[0]}
          </button>
        )}
        {tabs.map(([v, label]) => (
          <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{label}</button>
        ))}
      </nav>
      {inRoutine && <StepBar steps={steps} view={view} next={nextStep} go={setView} />}
      <main>
        {view === 'home' && <Home words={words} cards={cards} steps={steps} next={nextStep} settings={settings} go={setView} />}
        {view === 'learn' && <Learn queue={nextNew} settings={settings} go={setView} />}
        {view === 'review' && <Review due={due} byId={byId} cards={cards} words={words} />}
        {view === 'write' && <Writing cards={cards} byId={byId} onWritten={() => setDaily((d) => ({ ...current(d), written: current(d).written + 1 }))} />}
        {view === 'read' && <ReadingView readings={readings} byId={byId} studied={studied}
          onRead={(id) => setDaily((d) => ({ ...current(d), read: [...new Set([...current(d).read, id])] }))} />}
        {view === 'words' && <WordList words={words} cards={cards} />}
        {view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} go={setView} account={account} />}
        {view === 'test' && <Placement words={words} settings={settings} setSettings={setSettings} go={setView} />}
      </main>
      <footer>
        Dữ liệu: <a href="https://www.newgeneralservicelist.com/">NGSL</a> (CC BY-SA), từ điển Anh–Việt (Hồ Ngọc Đức),{' '}
        <a href="https://dictionaryapi.dev/">Free Dictionary API</a>; ví dụ, cụm từ, bài đọc do AI tạo. Lịch ôn: FSRS.
      </footer>
    </div>
  );
}
