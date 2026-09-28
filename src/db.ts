import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ContextTags } from './data/context';
import type { Lang } from './i18n';
import { DEFAULT_THEME, normalizeTheme, type ThemeSetting } from './lib/world';
import type { Emotion, Entry, ImageRecord, Session } from './types';

export type Settings = {
  theme: ThemeSetting;
  /** Unset means "follow the browser". */
  language?: Lang;
  /** ISO country code for the Help screen, or OTHER. Unset means "guess from the browser". */
  helplineCountry?: string;
  /** The person's own context tags (without the custom prefix). */
  customTags?: ContextTags;
  supportName?: string;
  supportContact?: string;
  pinHash?: string;
  pinSalt?: string;
};

export const DEFAULT_SETTINGS: Settings = { theme: DEFAULT_THEME };

interface BodyMapDB extends DBSchema {
  emotions: { key: string; value: Emotion };
  sessions: { key: string; value: Session; indexes: { startedAt: string } };
  entries: { key: string; value: Entry; indexes: { sessionId: string; createdAt: string } };
  images: { key: string; value: ImageRecord };
  meta: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<BodyMapDB>> | null = null;

export function db() {
  dbp ??= openDB<BodyMapDB>('body-map', 1, {
    upgrade(d) {
      d.createObjectStore('emotions', { keyPath: 'id' });
      const s = d.createObjectStore('sessions', { keyPath: 'id' });
      s.createIndex('startedAt', 'startedAt');
      const e = d.createObjectStore('entries', { keyPath: 'id' });
      e.createIndex('sessionId', 'sessionId');
      e.createIndex('createdAt', 'createdAt');
      d.createObjectStore('images', { keyPath: 'id' });
      d.createObjectStore('meta');
    },
  });
  return dbp;
}

export type Snapshot = {
  emotions: Emotion[];
  sessions: Session[];
  entries: Entry[];
  images: ImageRecord[];
  settings: Settings;
  currentSessionId?: string;
};

export async function loadAll(): Promise<Snapshot> {
  const d = await db();
  const [emotions, sessions, entries, images, settings, currentSessionId] = await Promise.all([
    d.getAll('emotions'),
    d.getAll('sessions'),
    d.getAll('entries'),
    d.getAll('images'),
    d.get('meta', 'settings') as Promise<Settings | undefined>,
    d.get('meta', 'currentSessionId') as Promise<string | undefined>,
  ]);
  return { emotions, sessions, entries, images, settings: { ...DEFAULT_SETTINGS, ...settings, theme: normalizeTheme(settings?.theme) }, currentSessionId };
}

export async function putEmotions(list: Emotion[]) {
  const tx = (await db()).transaction('emotions', 'readwrite');
  await Promise.all([...list.map((e) => tx.store.put(e)), tx.done]);
}
export async function deleteEmotion(id: string) {
  await (await db()).delete('emotions', id);
}
export async function putSession(s: Session) {
  await (await db()).put('sessions', s);
}
export async function putEntry(e: Entry) {
  await (await db()).put('entries', e);
}
export async function deleteEntry(id: string) {
  await (await db()).delete('entries', id);
}
export async function putImage(img: ImageRecord) {
  await (await db()).put('images', img);
}
export async function deleteImage(id: string) {
  await (await db()).delete('images', id);
}
export async function setMeta(key: string, value: unknown) {
  const d = await db();
  if (value === undefined) await d.delete('meta', key);
  else await d.put('meta', value, key);
}

export async function clearAll() {
  const d = await db();
  const tx = d.transaction(['emotions', 'sessions', 'entries', 'images', 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('emotions').clear(),
    tx.objectStore('sessions').clear(),
    tx.objectStore('entries').clear(),
    tx.objectStore('images').clear(),
    tx.objectStore('meta').clear(),
    tx.done,
  ]);
}

/** Replace everything in one transaction (used by import). */
export async function replaceAll(s: Omit<Snapshot, 'currentSessionId'> & { currentSessionId?: string }) {
  const d = await db();
  const tx = d.transaction(['emotions', 'sessions', 'entries', 'images', 'meta'], 'readwrite');
  const em = tx.objectStore('emotions'), se = tx.objectStore('sessions'), en = tx.objectStore('entries'), im = tx.objectStore('images'), me = tx.objectStore('meta');
  await Promise.all([em.clear(), se.clear(), en.clear(), im.clear(), me.clear()]);
  const ops: Promise<unknown>[] = [
    ...s.emotions.map((x) => em.put(x)),
    ...s.sessions.map((x) => se.put(x)),
    ...s.entries.map((x) => en.put(x)),
    ...s.images.map((x) => im.put(x)),
    me.put(s.settings, 'settings'),
  ];
  if (s.currentSessionId) ops.push(me.put(s.currentSessionId, 'currentSessionId'));
  await Promise.all([...ops, tx.done]);
}
