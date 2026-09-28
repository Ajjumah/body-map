import { useEffect, useRef, useState } from 'react';
import Backdrop from './components/Backdrop';
import Icon, { type IconName } from './components/Icon';
import LockScreen from './components/LockScreen';
import { LOCALE, useT } from './i18n';
import type { Key } from './i18n/en';
import { useRoute } from './lib/route';
import { useWorld } from './lib/useWorld';
import { WORLDS, type World } from './lib/world';
import BodyMapScreen from './screens/BodyMapScreen';
import HelpScreen from './screens/HelpScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import { StoreProvider, useStore } from './store';

export type Screen = 'map' | 'history' | 'settings' | 'help';
const SCREENS: { id: Screen; label: Key; icon: IconName }[] = [
  { id: 'map', label: 'nav.body', icon: 'body' },
  { id: 'history', label: 'nav.memories', icon: 'memories' },
  { id: 'settings', label: 'nav.settings', icon: 'settings' },
  { id: 'help', label: 'nav.help', icon: 'help' },
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
  const world = useWorld();
  const tr = useT();
  const { t } = tr;
  const route = useRoute();
  const screen: Screen = SCREENS.some((s) => s.id === route[0]) ? (route[0] as Screen) : 'map';
  useApplyWorld(world);
  const [locked, setLocked] = useLock(ready, !!settings.pinHash);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.join('/')]);
  useEffect(() => {
    document.title = `${t(SCREENS.find((s) => s.id === screen)!.label)} · ${t('app.name')}`;
    document.documentElement.lang = LOCALE[tr.lang];
  }, [screen, t, tr.lang]);

  if (locked)
    return (
      <>
        <Backdrop world={world} />
        <LockScreen onUnlock={() => setLocked(false)} />
      </>
    );

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col">
      <Backdrop world={world} />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 on-surface">{t('app.skip')}</a>
      <header className="flex items-center justify-between px-4 pt-3 pb-1">
        <h1 className="text-3xl text-ink">{t('app.name')}</h1>
      </header>
      <main id="main" tabIndex={-1} className="flex-1 px-4 pb-32 outline-none">
        {!ready ? (
          <p className="py-10 text-center text-muted">{t('app.loading')}</p>
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
      <nav aria-label={t('nav.main')} className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ul className="card on-surface mx-auto flex max-w-lg gap-1.5 p-1.5">
          {SCREENS.map((s) => {
            const on = screen === s.id;
            return (
              <li key={s.id} className="flex-1">
                <a
                  href={`#/${s.id}`}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-3 text-xs font-bold text-ink ${on ? 'border-outline bg-accent-2' : 'border-transparent'}`}
                >
                  <Icon name={s.icon} />
                  {t(s.label)}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function useApplyWorld(world: World) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.world = world;
    root.classList.toggle('dark', world === 'starlight');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', WORLDS[world].themeColor);
    try {
      localStorage.setItem('bm-world', world);
    } catch {
      /* first-paint hint only */
    }
  }, [world]);
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
