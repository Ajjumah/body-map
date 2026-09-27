import { useSyncExternalStore } from 'react';
import { useStore } from '../store';
import { resolveWorld, type World } from './world';

const mq = () => window.matchMedia('(prefers-color-scheme: dark)');
const subscribe = (cb: () => void) => {
  const m = mq();
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};

/** The world currently shown, resolving "auto" against the device's dark-mode setting. */
export function useWorld(): World {
  const { settings } = useStore();
  const prefersDark = useSyncExternalStore(subscribe, () => mq().matches, () => false);
  return resolveWorld(settings.theme, prefersDark);
}
