import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as DB from './db';
import { DEFAULT_SETTINGS, type Settings } from './db';
import { DEFAULT_EMOTIONS, LEGACY_DEFAULT_COLORS } from './data/emotions';
import { parseBackup, toBackup, type BackupFile } from './lib/backup';
import { uid } from './lib/id';
import type { Emotion, Entry, ImageRecord, Session } from './types';

export type EntryDraft = Omit<Entry, 'id' | 'sessionId' | 'createdAt'>;

type Store = {
  ready: boolean;
  emotions: Emotion[];
  emotionById: Map<string, Emotion>;
  sessions: Session[];
  entries: Entry[];
  settings: Settings;
  current: Session | null;
  currentEntries: Entry[];
  imageUrl: (id?: string) => string | undefined;
  addEntry: (draft: EntryDraft) => Promise<Entry>;
  removeEntry: (id: string) => Promise<void>;
  finishSession: () => Promise<Session | null>;
  updateSession: (id: string, patch: Partial<Session>) => Promise<void>;
  saveEmotion: (e: Emotion) => Promise<void>;
  removeEmotion: (id: string) => Promise<'deleted' | 'archived'>;
  reorderEmotion: (id: string, dir: -1 | 1) => Promise<void>;
  addImage: (blob: Blob) => Promise<string>;
  removeImage: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
  exportBackup: () => Promise<BackupFile>;
  importBackup: (text: string) => Promise<{ sessions: number; entries: number }>;
  deleteAll: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

function requestPersistence() {
  try {
    navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [emotions, setEmotions] = useState<Emotion[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [currentId, setCurrentId] = useState<string | undefined>();

  const reload = useCallback(async () => {
    const snap = await DB.loadAll();
    let em = snap.emotions;
    if (em.length === 0) {
      em = DEFAULT_EMOTIONS;
      await DB.putEmotions(em);
    } else {
      // Upgrade default emotions still wearing their original muted colour; user-picked colours are left alone.
      const upgraded = em.flatMap((e) => {
        const next = DEFAULT_EMOTIONS.find((d) => d.id === e.id);
        return next && e.isDefault && LEGACY_DEFAULT_COLORS[e.id]?.includes(e.color) ? [{ ...e, color: next.color }] : [];
      });
      if (upgraded.length) {
        await DB.putEmotions(upgraded);
        em = em.map((e) => upgraded.find((u) => u.id === e.id) ?? e);
      }
    }
    setEmotions(em.sort((a, b) => a.order - b.order));
    setSessions(snap.sessions);
    setEntries(snap.entries);
    setImages(snap.images);
    setSettings(snap.settings);
    const cur = snap.currentSessionId && snap.sessions.find((s) => s.id === snap.currentSessionId && !s.finishedAt);
    setCurrentId(cur ? cur.id : undefined);
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Object URLs for stored image blobs.
  const urls = useRef(new Map<string, string>());
  const imageUrls = useMemo(() => {
    const next = new Map<string, string>();
    for (const img of images) next.set(img.id, urls.current.get(img.id) ?? URL.createObjectURL(img.blob));
    for (const [id, u] of urls.current) if (!next.has(id)) URL.revokeObjectURL(u);
    urls.current = next;
    return next;
  }, [images]);
  const imageUrl = useCallback((id?: string) => (id ? imageUrls.get(id) : undefined), [imageUrls]);

  const current = useMemo(() => sessions.find((s) => s.id === currentId) ?? null, [sessions, currentId]);
  const currentEntries = useMemo(
    () => (currentId ? entries.filter((e) => e.sessionId === currentId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)) : []),
    [entries, currentId],
  );

  const addEntry = useCallback(
    async (draft: EntryDraft) => {
      let session = current;
      if (!session) {
        session = { id: uid(), startedAt: new Date().toISOString() };
        await DB.putSession(session);
        await DB.setMeta('currentSessionId', session.id);
        setSessions((l) => [...l, session!]);
        setCurrentId(session.id);
        requestPersistence();
      }
      const entry: Entry = { ...draft, id: uid(), sessionId: session.id, createdAt: new Date().toISOString() };
      await DB.putEntry(entry);
      setEntries((l) => [...l, entry]);
      return entry;
    },
    [current],
  );

  const removeEntry = useCallback(async (id: string) => {
    await DB.deleteEntry(id);
    setEntries((l) => l.filter((e) => e.id !== id));
  }, []);

  const finishSession = useCallback(async () => {
    if (!current) return null;
    const done = { ...current, finishedAt: new Date().toISOString() };
    await DB.putSession(done);
    await DB.setMeta('currentSessionId', undefined);
    setSessions((l) => l.map((s) => (s.id === done.id ? done : s)));
    setCurrentId(undefined);
    return done;
  }, [current]);

  const updateSession = useCallback(
    async (id: string, patch: Partial<Session>) => {
      const s = sessions.find((x) => x.id === id);
      if (!s) return;
      const next = { ...s, ...patch };
      await DB.putSession(next);
      setSessions((l) => l.map((x) => (x.id === id ? next : x)));
    },
    [sessions],
  );

  const saveEmotion = useCallback(async (e: Emotion) => {
    await DB.putEmotions([e]);
    setEmotions((l) => {
      const exists = l.some((x) => x.id === e.id);
      return (exists ? l.map((x) => (x.id === e.id ? e : x)) : [...l, e]).sort((a, b) => a.order - b.order);
    });
  }, []);

  const removeEmotion = useCallback(
    async (id: string) => {
      const e = emotions.find((x) => x.id === id);
      if (!e) return 'deleted' as const;
      // Keep emotions that history refers to; archive them instead.
      if (entries.some((en) => en.emotionIds.includes(id))) {
        await saveEmotion({ ...e, archived: true });
        return 'archived' as const;
      }
      await DB.deleteEmotion(id);
      if (e.imageId) {
        await DB.deleteImage(e.imageId);
        setImages((l) => l.filter((i) => i.id !== e.imageId));
      }
      setEmotions((l) => l.filter((x) => x.id !== id));
      return 'deleted' as const;
    },
    [emotions, entries, saveEmotion],
  );

  const reorderEmotion = useCallback(
    async (id: string, dir: -1 | 1) => {
      const e = emotions.find((x) => x.id === id);
      if (!e) return;
      const peers = emotions.filter((x) => x.group === e.group).sort((a, b) => a.order - b.order);
      const i = peers.findIndex((x) => x.id === id);
      const other = peers[i + dir];
      if (!other) return;
      const a = { ...e, order: other.order }, b = { ...other, order: e.order };
      await DB.putEmotions([a, b]);
      setEmotions((l) => l.map((x) => (x.id === a.id ? a : x.id === b.id ? b : x)).sort((p, q) => p.order - q.order));
    },
    [emotions],
  );

  const addImage = useCallback(async (blob: Blob) => {
    const img: ImageRecord = { id: uid(), blob, createdAt: new Date().toISOString() };
    await DB.putImage(img);
    setImages((l) => [...l, img]);
    return img.id;
  }, []);

  const removeImage = useCallback(async (id: string) => {
    await DB.deleteImage(id);
    setImages((l) => l.filter((i) => i.id !== id));
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      const next = { ...settings, ...patch };
      for (const k of Object.keys(next) as (keyof Settings)[]) if (next[k] === undefined) delete next[k];
      await DB.setMeta('settings', next);
      setSettings(next);
    },
    [settings],
  );

  const exportBackup = useCallback(async () => toBackup(await DB.loadAll()), []);

  const importBackup = useCallback(
    async (text: string) => {
      const snap = parseBackup(text, settings);
      await DB.replaceAll(snap);
      await reload();
      return { sessions: snap.sessions.length, entries: snap.entries.length };
    },
    [settings, reload],
  );

  const deleteAll = useCallback(async () => {
    await DB.clearAll();
    await reload();
  }, [reload]);

  const emotionById = useMemo(() => new Map(emotions.map((e) => [e.id, e])), [emotions]);

  const value: Store = {
    ready, emotions, emotionById, sessions, entries, settings, current, currentEntries, imageUrl,
    addEntry, removeEntry, finishSession, updateSession, saveEmotion, removeEmotion, reorderEmotion, addImage, removeImage, updateSettings, reload, exportBackup, importBackup, deleteAll,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

export function useImageUrl(imageId?: string): string | undefined {
  return useStore().imageUrl(imageId);
}
