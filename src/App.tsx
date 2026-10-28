import { useEffect, useMemo, useState } from 'react';
import { BookA, House, Map as MapIcon, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { LEVELS, addItems, dailyKey, db, isSkipped, loadSettings, saveSettings, startOfToday, type Level, type Reading, type Word } from './db';
import { grammarKey, phraseKey, type Exercise, type GrammarLesson, type Phrase, type PhraseSet } from './content';
import type { Account } from './AuthGate';
import Home from './views/Home';
import Learn from './views/Learn';
import Review from './views/Review';
import ItemReview from './views/ItemReview';
import Grammar from './views/Grammar';
import Phrases from './views/Phrases';
import Dictation from './views/Dictation';
import Writing from './views/Writing';
import ReadingView from './views/Reading';
import WordList from './views/WordList';
import SettingsView from './views/Settings';
import Placement from './views/Placement';
import Roadmap from './views/Roadmap';
import { NextPrompt, Rail, Welcome } from './views/Routine';
import Sounds from './views/Sounds';
import { TipsContext, shuffle } from './ui';
import './App.css';

export type View = 'home' | 'learn' | 'review' | 'review-grammar' | 'grammar' | 'phrases' | 'write' | 'read' | 'listen'
  | 'words' | 'settings' | 'test' | 'welcome' | 'sounds' | 'roadmap';

/** Per-day progress for the activities that don't live in the database. */
export interface Daily { date: string; written: number; read: number[]; spotDone?: boolean; grammar?: boolean; phrases?: boolean; listened?: boolean }
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
const PHRASE_GOAL = 5;
const DICTATION_COUNT = 5;

export type Track = 'vocab' | 'grammar';
export const TRACK_LABEL: Record<Track, string> = { vocab: 'Từ vựng', grammar: 'Ngữ pháp & giao tiếp' };
export interface Step { track: Track; view: View; label: string; detail: string; done: boolean }

export default function App({ account }: { account?: Account }) {
  const [words, setWords] = useState<Word[]>();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [lessons, setLessons] = useState<GrammarLesson[]>([]);
  const [sets, setSets] = useState<PhraseSet[]>([]);
  const [settings, setSettings] = useState(loadSettings);
  const [view, setView] = useState<View>(settings.onboarded ? 'home' : 'welcome');
  const [daily, setDaily] = useState(loadDaily);

  useEffect(() => {
    const load = <T,>(file: string, set: (v: T) => void) => fetch(`${import.meta.env.BASE_URL}${file}`).then((r) => r.json()).then(set);
    load('words.json', setWords);
    load('readings.json', setReadings);
    load('grammar.json', setLessons);
    load('phrases.json', setSets);
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
  const items = useLiveQuery(() => db.items.toArray(), []);

  const exercises = useMemo(() => new Map<string, Exercise>(
    lessons.flatMap((l) => l.exercises.map((ex, i) => [grammarKey(l.id, i), ex] as const))), [lessons]);
  const phraseByKey = useMemo(() => new Map<string, Phrase>(
    sets.flatMap((s) => s.phrases.map((p) => [phraseKey(p.id), p] as const))), [sets]);

  // Dictation material: example sentences of studied words, learned phrases and grammar examples.
  // Picked once per change of what you've studied, so the set doesn't reshuffle mid-exercise.
  const dictation = useMemo(() => {
    if (!words || !cards || !items) return [];
    const studiedWords = new Set(cards.map((c) => c.wordId));
    const keys = new Set(items.map((c) => c.key));
    const pool = [
      ...words.filter((w) => studiedWords.has(w.id) && w.example).map((w) => ({ en: w.example, vi: w.exampleVi })),
      ...sets.flatMap((s) => s.phrases).filter((p) => keys.has(phraseKey(p.id))).map((p) => ({ en: p.en, vi: p.vi })),
      ...lessons.filter((l) => l.exercises.some((_, i) => keys.has(grammarKey(l.id, i)))).flatMap((l) => l.examples),
    ];
    return shuffle(pool).slice(0, DICTATION_COUNT);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-pick only when the amount studied changes
  }, [words, cards?.length, items?.length, sets, lessons]);

  // Order of new words. Level order: CEFR level, then words learnable on their own before grammar/abstract
  // ones (those are better met in reading), then frequency. Frequency order: NGSL rank only.
  const ordered = useMemo(() => {
    if (!words) return [];
    if (settings.order === 'frequency') return words;
    return [...words].sort((a, b) =>
      LEVELS.indexOf(a.cefr) - LEVELS.indexOf(b.cefr) || Number(b.concrete) - Number(a.concrete) || a.id - b.id);
  }, [words, settings.order]);

  if (!words || !cards || !known || !items) return <p className="center">Đang tải…</p>;

  const now = new Date();
  const due = cards.filter((c) => c.due <= now).sort((a, b) => +a.due - +b.due);
  const learnedToday = cards.filter((c) => c.addedAt >= startOfToday() && !c.relearn).length;
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

  // Grammar and phrases follow the roadmap: everything up to the current level (first level not yet passed).
  const passed = new Set(settings.levelsPassed ?? []);
  const level: Level = LEVELS.find((l) => !passed.has(l) && LEVELS.indexOf(l) >= LEVELS.indexOf(settings.startLevel)) ?? 'C1';
  const upTo = (l: Level) => LEVELS.indexOf(l) <= LEVELS.indexOf(level);
  // Today's lesson/phrases come from the learner's level band (start level → current); lower levels stay browsable.
  const inBand = (l: Level) => upTo(l) && LEVELS.indexOf(l) >= LEVELS.indexOf(settings.startLevel);
  const itemKeys = new Set(items.map((c) => c.key));
  const doneLessons = new Set(lessons.filter((l) => itemKeys.has(grammarKey(l.id, 0))).map((l) => l.id));
  const nextLesson = lessons.find((l) => inBand(l.level) && !doneLessons.has(l.id));
  const learnedPhrases = new Set(sets.flatMap((s) => s.phrases).filter((p) => itemKeys.has(phraseKey(p.id))).map((p) => p.id));
  const fresh = current(daily);
  const phraseQueue = fresh.phrases ? [] : sets.filter((s) => inBand(s.level))
    .flatMap((s) => s.phrases.filter((p) => !learnedPhrases.has(p.id)).map((phrase) => ({ set: s, phrase })))
    .slice(0, PHRASE_GOAL);
  const itemsDue = items.filter((c) => c.due <= now && (exercises.has(c.key) || phraseByKey.has(c.key)))
    .sort((a, b) => +a.due - +b.due);

  // Two separate daily tracks, never mixed: vocabulary (words) and grammar & speaking (structures, phrases).
  // "Tiếp tục" goes to the first unfinished step of a track. Newly learned items become due at once,
  // so each track's review step reopens to practise them right away.
  const steps: Step[] = [
    // The daily spot-check of "known" words lives in this step too, so it isn't skipped when nothing is due.
    { track: 'vocab', view: 'review', label: 'Ôn từ',
      detail: due.length ? `${due.length} từ đến hạn` : spot.length ? `Kiểm tra nhanh ${spot.length} từ đã biết` : 'Không còn từ đến hạn',
      done: due.length === 0 && spot.length === 0 },
    { track: 'vocab', view: 'learn', label: 'Từ mới', detail: nextNew.length ? `Còn ${nextNew.length} từ` : 'Đủ chỉ tiêu hôm nay', done: nextNew.length === 0 },
    { track: 'vocab', view: 'write', label: 'Viết câu', detail: `${Math.min(fresh.written, WRITE_GOAL)}/${WRITE_GOAL} câu đúng`, done: fresh.written >= WRITE_GOAL },
    { track: 'vocab', view: 'read', label: 'Đọc', detail: fresh.read.length ? 'Đã đọc' : '1 bài đọc ngắn', done: fresh.read.length > 0 },
    { track: 'grammar', view: 'review-grammar', label: 'Ôn ngữ pháp', detail: itemsDue.length ? `${itemsDue.length} câu đến hạn` : 'Không còn câu đến hạn', done: itemsDue.length === 0 },
    { track: 'grammar', view: 'grammar', label: 'Bài ngữ pháp', detail: fresh.grammar ? 'Đã học 1 bài' : nextLesson ? nextLesson.title : 'Đã học hết bài', done: !!fresh.grammar || !nextLesson },
    { track: 'grammar', view: 'phrases', label: 'Mẫu câu', detail: phraseQueue.length ? `${phraseQueue.length} câu giao tiếp` : 'Đủ cho hôm nay', done: phraseQueue.length === 0 },
    { track: 'grammar', view: 'listen', label: 'Nghe chép', detail: fresh.listened ? 'Đã nghe' : '5 câu', done: !!fresh.listened },
  ];
  const track = steps.find((s) => s.view === view)?.track;
  const inRoutine = track !== undefined;

  const tabs: { view: View; label: string; icon: LucideIcon; badge?: number; mobile?: boolean }[] = [
    { view: 'home', label: 'Hôm nay', icon: House, mobile: true },
    { view: 'roadmap', label: 'Lộ trình', icon: MapIcon, mobile: true },
    { view: 'words', label: 'Sổ từ', icon: BookA, mobile: true },
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
      {track && <Rail steps={steps.filter((s) => s.track === track)} track={track} view={view} go={setView} />}
      <TipsContext.Provider value={{ seen: settings.tipsSeen ?? [], dismiss: (id) => setSettings((s) => ({ ...s, tipsSeen: [...(s.tipsSeen ?? []), id] })) }}>
      <main>
        {track && <NextPrompt steps={steps} track={track} view={view} go={setView} />}
        {view === 'home' && <Home words={words} cards={cards} known={known} steps={steps} settings={settings} go={setView} />}
        {view === 'roadmap' && <Roadmap words={words} cards={cards} known={known} settings={settings} setSettings={setSettings}
          lessons={lessons} doneLessons={doneLessons} sets={sets} learnedPhrases={learnedPhrases} current={level} go={setView} />}
        {view === 'learn' && <Learn queue={nextNew} words={words} settings={settings} go={setView} />}
        {view === 'review' && <Review due={due} byId={byId} cards={cards} words={words} spot={spot}
          onSpotDone={() => setDaily((d) => ({ ...current(d), spotDone: true }))} />}
        {view === 'review-grammar' && (itemsDue.length
          ? <ItemReview due={itemsDue} exercises={exercises} phrases={phraseByKey} />
          : <section className="empty"><h2>Không còn câu ngữ pháp, mẫu câu cần ôn</h2><p>Học bài ngữ pháp hoặc mẫu câu mới, chúng sẽ quay lại đây để ôn.</p></section>)}
        {view === 'grammar' && <Grammar lessons={lessons.filter((l) => upTo(l.level))} done={doneLessons} next={fresh.grammar ? undefined : nextLesson}
          onFinish={async (lesson) => {
            await addItems(lesson.exercises.map((_, i) => grammarKey(lesson.id, i)), 'grammar');
            setDaily((d) => ({ ...current(d), grammar: true }));
          }} />}
        {view === 'phrases' && <Phrases sets={sets.filter((s) => upTo(s.level))} learned={learnedPhrases} queue={phraseQueue}
          onLearned={async (ids) => {
            await addItems(ids.map(phraseKey), 'phrase');
            setDaily((d) => ({ ...current(d), phrases: true }));
          }} />}
        {view === 'write' && <Writing cards={cards} byId={byId} onWritten={() => setDaily((d) => ({ ...current(d), written: current(d).written + 1 }))} />}
        {view === 'read' && <ReadingView readings={readings} byId={byId} studied={studied} known={knownIds} beginner={settings.startLevel === 'A1'}
          onRead={(id) => setDaily((d) => ({ ...current(d), read: [...new Set([...current(d).read, id])] }))} />}
        {view === 'listen' && <Dictation sentences={dictation} onDone={() => setDaily((d) => ({ ...current(d), listened: true }))} />}
        {view === 'words' && <WordList words={words} cards={cards} known={known} settings={settings} />}
        {view === 'settings' && <SettingsView settings={settings} setSettings={setSettings} go={setView} account={account} />}
        {view === 'test' && <Placement words={words} settings={settings} setSettings={setSettings} go={setView} />}
        {view === 'sounds' && <Sounds go={setView} />}
      </main>
      </TipsContext.Provider>
      <footer>
        Dữ liệu: <a href="https://www.newgeneralservicelist.com/">NGSL</a> (CC BY-SA),{' '}
        <a href="https://github.com/openlanguageprofiles/olp-en-cefrj">CEFR-J Vocabulary Profile</a> (Tono Lab, TUFS) + Octanove C1/C2 (CC BY-SA),{' '}
        <a href="http://www.speech.cs.cmu.edu/cgi-bin/cmudict">CMU Pronouncing Dictionary</a>,{' '}
        <a href="https://tatoeba.org">Tatoeba</a> (CC BY 2.0 FR), từ điển Anh–Việt (Hồ Ngọc Đức),{' '}
        <a href="https://dictionaryapi.dev/">Free Dictionary API</a>. Nghĩa ngắn, phần còn thiếu, ngữ pháp, bài đọc do AI tạo. Lịch ôn: FSRS.
      </footer>
      <nav className="bottomnav" aria-label="Điều hướng">
        {tabs.filter((t) => t.mobile).map((t) => (
          <button key={t.view} className={view === t.view || (t.view === 'home' && inRoutine) ? 'active' : ''} onClick={() => setView(t.view)}>
            <t.icon className="icon" />{t.label}
            {t.badge ? <span className="badge">{t.badge}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}
