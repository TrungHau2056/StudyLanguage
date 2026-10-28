import { useEffect, useMemo, useState } from 'react';
import { BookA, BookOpen, House, PenLine, RotateCcw, Settings as SettingsIcon, Sparkles, type LucideIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LEVELS, dailyKey, db, isSkipped, loadSettings, saveSettings, startOfToday, type Reading, type Word } from './db';
import type { Account } from './AuthGate';
import Home from './views/Home';
import Learn from './views/Learn';
import Review from './views/Review';
import Writing from './views/Writing';
import ReadingView from './views/Reading';
import WordList from './views/WordList';
import SettingsView from './views/Settings';
import Placement from './views/Placement';
import { NextPrompt, Rail, Welcome } from './views/Routine';
import Sounds from './views/Sounds';
import { TipsContext } from './ui';
import './App.css';

export type View = 'home' | 'learn' | 'review' | 'write' | 'read' | 'words' | 'settings' | 'test' | 'welcome' | 'sounds';

/** Per-day progress for the activities that don't live in the database. */
export interface Daily { date: string; written: number; read: number[]; spotDone?: boolean }
const today = () => new Date().toDateString();
/** Progress resets when the day changes (also mid-session, e.g. studying past midnight). */
const current = (d: Daily): Daily => (d.date === today() ? d : { date: today(), written: 0, read: [] });
const loadDaily = () => current(JSON.parse(localStorage.getItem(dailyKey()) ?? 'null') ?? { date: '', written: 0, read: [] });
/** Stable per-day shuffle key, so the spot-check picks the same words all day but different ones tomorrow. */
const dayHash = (id: number) => {
  let h = id * 2654435761 + new Date().getDate() * 40503;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
};

export const WRITE_GOAL = 3;
const SPOT_COUNT = 3;

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
  const known = useLiveQuery(() => db.known.toArray(), []);

  // Order of new words. Level order: CEFR level, then words learnable on their own before grammar/abstract
  // ones (those are better met in reading), then frequency. Frequency order: NGSL rank only.
  const ordered = useMemo(() => {
    if (!words) return [];
    if (settings.order === 'frequency') return words;
    return [...words].sort((a, b) =>
      LEVELS.indexOf(a.cefr) - LEVELS.indexOf(b.cefr) || Number(b.concrete) - Number(a.concrete) || a.id - b.id);
  }, [words, settings.order]);

  if (!words || !cards || !known) return <p className="center">Đang tải…</p>;

  const now = new Date();
  const due = cards.filter((c) => c.due <= now).sort((a, b) => +a.due - +b.due);
  const learnedToday = cards.filter((c) => c.addedAt >= startOfToday()).length;
  const newLeft = Math.max(settings.newPerDay - learnedToday, 0);
  const studied = new Set(cards.map((c) => c.wordId));
  const knownIds = new Set(known.map((k) => k.wordId));
  const nextNew = ordered
    .filter((w) => !studied.has(w.id) && !knownIds.has(w.id) && !isSkipped(w, settings)
      && (settings.topic === 'all' || w.topic === settings.topic))
    .slice(0, newLeft);

  // Spot-check: a few words assumed known (marked known a month ago, or skipped by level/test) get a quick
  // meaning check once a day, so a wrong guess about what you know gets corrected without re-teaching everything.
  const monthAgo = Date.now() - 30 * 86400000;
  const spot = current(daily).spotDone ? [] : [
    ...known.filter((k) => (k.checkedAt ?? k.at).getTime() < monthAgo).map((k) => byId.get(k.wordId)),
    ...words.filter((w) => isSkipped(w, settings) && !studied.has(w.id) && !knownIds.has(w.id)),
  ].filter((w): w is Word => !!w)
    .sort((a, b) => dayHash(a.id) - dayHash(b.id))
    .slice(0, SPOT_COUNT);

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

  const tabs: { view: View; label: string; icon: LucideIcon; badge?: number; mobile?: boolean }[] = [
    { view: 'home', label: 'Hôm nay', icon: House, mobile: true },
    { view: 'review', label: 'Ôn tập', icon: RotateCcw, badge: due.length, mobile: true },
    { view: 'learn', label: 'Học mới', icon: Sparkles },
    { view: 'write', label: 'Viết', icon: PenLine },
    { view: 'read', label: 'Đọc', icon: BookOpen },
    { view: 'words', label: 'Từ vựng', icon: BookA, mobile: true },
    { view: 'settings', label: 'Cài đặt', icon: SettingsIcon, mobile: true },
  ];

  if (view === 'welcome') return (
    <div className="app no-nav"><Welcome settings={settings} setSettings={setSettings} go={setView} /></div>
  );

  return (
    <div className={`app ${inRoutine ? 'with-rail' : ''}`}>
      <header className="topbar">
        <span className="wordmark" onClick={() => setView('home')}>Vocab<i>.</i></span>
        <nav className="tabs" aria-label="Điều hướng">
          {tabs.map((t) => (
            <button key={t.view} className={view === t.view ? 'active' : ''} onClick={() => setView(t.view)}>
              {t.label}{t.badge ? <span className="badge">{t.badge}</span> : null}
            </button>
          ))}
        </nav>
        {account && (
          <button className="avatar" title={account.email} aria-label="Tài khoản" onClick={() => setView('settings')}>
            {account.photo ? <img src={account.photo} alt="" referrerPolicy="no-referrer" /> : account.name[0]}
          </button>
        )}
      </header>
      {inRoutine && <Rail steps={steps} view={view} go={setView} />}
      <TipsContext.Provider value={{ seen: settings.tipsSeen ?? [], dismiss: (id) => setSettings((s) => ({ ...s, tipsSeen: [...(s.tipsSeen ?? []), id] })) }}>
      <main>
        {inRoutine && <NextPrompt steps={steps} view={view} next={nextStep} go={setView} />}
        {view === 'home' && <Home words={words} cards={cards} known={known} steps={steps} next={nextStep} settings={settings} go={setView} />}
        {view === 'learn' && <Learn queue={nextNew} words={words} settings={settings} go={setView} />}
        {view === 'review' && <Review due={due} byId={byId} cards={cards} words={words} spot={spot}
          onSpotDone={() => setDaily((d) => ({ ...current(d), spotDone: true }))} />}
        {view === 'write' && <Writing cards={cards} byId={byId} onWritten={() => setDaily((d) => ({ ...current(d), written: current(d).written + 1 }))} />}
        {view === 'read' && <ReadingView readings={readings} byId={byId} studied={studied} known={knownIds} beginner={settings.startLevel === 'A1'}
          onRead={(id) => setDaily((d) => ({ ...current(d), read: [...new Set([...current(d).read, id])] }))} />}
        {view === 'words' && <WordList words={words} cards={cards} known={known} settings={settings} />}
        {view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} go={setView} account={account} />}
        {view === 'test' && <Placement words={words} settings={settings} setSettings={setSettings} go={setView} />}
        {view === 'sounds' && <Sounds go={setView} />}
      </main>
      </TipsContext.Provider>
      <footer>
        Dữ liệu: <a href="https://www.newgeneralservicelist.com/">NGSL</a> (CC BY-SA), từ điển Anh–Việt (Hồ Ngọc Đức),{' '}
        <a href="https://dictionaryapi.dev/">Free Dictionary API</a>; ví dụ, cụm từ, bài đọc do AI tạo. Lịch ôn: FSRS.
      </footer>
      <nav className="bottomnav" aria-label="Điều hướng">
        {tabs.filter((t) => t.mobile).map((t) => (
          <button key={t.view} className={view === t.view || (t.view === 'home' && inRoutine && view !== 'review') ? 'active' : ''} onClick={() => setView(t.view)}>
            <t.icon className="icon" />{t.label}
            {t.badge ? <span className="badge">{t.badge}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
