import { useEffect, useRef, useState } from 'react';
import LockScreen from './components/LockScreen';
import { useRoute } from './lib/route';
import BodyMapScreen from './screens/BodyMapScreen';
import HelpScreen from './screens/HelpScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import { StoreProvider, useStore } from './store';

export type Screen = 'map' | 'history' | 'settings' | 'help';
const SCREENS: { id: Screen; label: string; icon: string }[] = [
  { id: 'map', label: 'Body map', icon: '🫧' },
  { id: 'history', label: 'History', icon: '🗓️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'help', label: 'Help', icon: '🤝' },
];


export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { ready, settings } = useStore();
  const route = useRoute();
  const screen: Screen = SCREENS.some((s) => s.id === route[0]) ? (route[0] as Screen) : 'map';
  useTheme(settings.theme);
  const [locked, setLocked] = useLock(ready, !!settings.pinHash);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.join('/')]);
  useEffect(() => {
    document.title = `${SCREENS.find((s) => s.id === screen)!.label} · Body Map`;
  }, [screen]);

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <h1 className="text-lg font-semibold text-ink">Body Map</h1>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 px-4 pb-28 outline-none">
        {!ready ? (
          <p className="py-10 text-center text-muted">Loading…</p>
        ) : screen === 'map' ? (
          <BodyMapScreen />
        ) : screen === 'history' ? (
          <HistoryScreen route={route} />
        ) : screen === 'settings' ? (
          <SettingsScreen />
        ) : (
          <HelpScreen />
        )}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto flex max-w-5xl">
          {SCREENS.map((s) => (
            <li key={s.id} className="flex-1">
              <a
                href={`#/${s.id}`}
                aria-current={screen === s.id ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${screen === s.id ? 'font-semibold text-accent' : 'text-muted'}`}
              >
                <span aria-hidden="true" className="text-lg">{s.icon}</span>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function useTheme(theme: 'system' | 'light' | 'dark') {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b2124' : '#6d8a96');
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

const RELOCK_AFTER_MS = 60_000;

/** Locked on launch when a PIN is set, and again after the app has been hidden for a minute. */
function useLock(ready: boolean, hasPin: boolean) {
  const [locked, setLocked] = useState(false);
  const initialised = useRef(false);
  useEffect(() => {
    if (ready && !initialised.current) {
      initialised.current = true;
      setLocked(hasPin);
    }
  }, [ready, hasPin]);
  useEffect(() => {
    if (!hasPin) {
      setLocked(false);
      return;
    }
    let hiddenAt = 0;
    const on = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_AFTER_MS) setLocked(true);
    };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [hasPin]);
  return [locked, setLocked] as const;
}
