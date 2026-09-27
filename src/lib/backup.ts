import type { Settings, Snapshot } from '../db';
import { regionLabel } from '../data/regions';
import type { Emotion, Entry, Session } from '../types';
import { blobToDataUrl, dataUrlToBlob } from './image';
import { normalizeTheme } from './world';

export const BACKUP_FORMAT = 'body-map-backup';

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  exportedAt: string;
  emotions: Emotion[];
  sessions: Session[];
  entries: Entry[];
  images: { id: string; createdAt: string; dataUrl: string }[];
  settings: Omit<Settings, 'pinHash' | 'pinSalt'>;
  currentSessionId?: string;
};

export async function toBackup(s: Snapshot): Promise<BackupFile> {
  // The PIN is a device lock, not data: it is never exported.
  const { pinHash: _h, pinSalt: _s, ...settings } = s.settings;
  return {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    emotions: s.emotions,
    sessions: s.sessions,
    entries: s.entries,
    images: await Promise.all(s.images.map(async (i) => ({ id: i.id, createdAt: i.createdAt, dataUrl: await blobToDataUrl(i.blob) }))),
    settings,
    currentSessionId: s.currentSessionId,
  };
}

const isStr = (x: unknown): x is string => typeof x === 'string';
const isArr = Array.isArray;

export function parseBackup(text: string, keepSettings: Settings): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t valid JSON.');
  }
  const b = raw as Partial<BackupFile>;
  if (!b || b.format !== BACKUP_FORMAT) throw new Error('That file doesn’t look like a Body Map backup.');
  if (b.version !== 1) throw new Error(`Unsupported backup version: ${String(b.version)}`);
  if (!isArr(b.emotions) || !isArr(b.sessions) || !isArr(b.entries) || !isArr(b.images)) throw new Error('The backup is missing some data.');
  for (const e of b.emotions) if (!isStr(e?.id) || !isStr(e.label) || !isStr(e.color)) throw new Error('A feeling in the backup is malformed.');
  for (const s of b.sessions) if (!isStr(s?.id) || !isStr(s.startedAt)) throw new Error('A check-in in the backup is malformed.');
  for (const e of b.entries) {
    if (!isStr(e?.id) || !isStr(e.sessionId) || !isStr(e.regionId) || !isArr(e.emotionIds) || typeof e.intensity !== 'number' || !isStr(e.createdAt))
      throw new Error('An entry in the backup is malformed.');
    if (!isArr(e.sensations)) e.sensations = [];
  }
  const images = b.images.map((i) => {
    if (!isStr(i?.id) || !isStr(i.dataUrl)) throw new Error('An image in the backup is malformed.');
    return { id: i.id, createdAt: i.createdAt ?? new Date().toISOString(), blob: dataUrlToBlob(i.dataUrl) };
  });
  const emotions = b.emotions.map((e, i) => ({ ...e, order: typeof e.order === 'number' ? e.order : i, archived: !!e.archived, isDefault: !!e.isDefault }));
  return {
    emotions,
    sessions: b.sessions,
    entries: b.entries,
    images,
    // Keep this device's PIN; take everything else from the file.
    settings: { ...(b.settings ?? {}), theme: normalizeTheme(b.settings?.theme), pinHash: keepSettings.pinHash, pinSalt: keepSettings.pinSalt },
    currentSessionId: b.currentSessionId,
  };
}

function csvCell(v: string | number | undefined) {
  const s = v === undefined ? '' : String(v);
  // Guard against spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function entriesCsv(entries: Entry[], sessions: Session[], emotionById: Map<string, Emotion>): string {
  const sById = new Map(sessions.map((s) => [s.id, s]));
  const header = ['date', 'time', 'session_id', 'region_id', 'region', 'emotions', 'sensations', 'intensity', 'note', 'session_overall_mood', 'session_reflection'];
  const rows = [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((e) => {
      const d = new Date(e.createdAt);
      const s = sById.get(e.sessionId);
      return [
        d.toLocaleDateString('en-CA'),
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        e.sessionId,
        e.regionId,
        regionLabel(e.regionId),
        e.emotionIds.map((id) => emotionById.get(id)?.label ?? id).join('; '),
        e.sensations.join('; '),
        e.intensity,
        e.note,
        s?.overallMood,
        s?.reflection,
      ]
        .map(csvCell)
        .join(',');
    });
  return [header.join(','), ...rows].join('\r\n') + '\r\n';
}

/** Save a file locally via a temporary object URL (no network). */
export function download(name: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
