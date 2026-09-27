import type { Entry, RegionId } from '../types';

export type Range = '7' | '30' | 'all' | 'custom';
export type Filters = { range: Range; from?: string; to?: string; emotionId?: string; regionId?: RegionId };

const DAY = 86_400_000;

export function localDayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function applyFilters(entries: Entry[], f: Filters, now = Date.now()): Entry[] {
  return entries.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    if (f.range === '7' && t < now - 7 * DAY) return false;
    if (f.range === '30' && t < now - 30 * DAY) return false;
    if (f.range === 'custom') {
      const day = localDayKey(e.createdAt);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    if (f.emotionId && !e.emotionIds.includes(f.emotionId)) return false;
    if (f.regionId && e.regionId !== f.regionId) return false;
    return true;
  });
}

export function countBy<T>(items: T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const x of items) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

export function regionCounts(entries: Entry[]) {
  return new Map(countBy(entries.map((e) => e.regionId)));
}

export function topEmotions(entries: Entry[], n = 3) {
  return countBy(entries.flatMap((e) => e.emotionIds)).slice(0, n);
}

export function topSensations(entries: Entry[], n = 3) {
  return countBy(entries.flatMap((e) => e.sensations)).slice(0, n);
}

export function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/** Average intensity per local day, oldest first. */
export function dailyIntensity(entries: Entry[]): { day: string; avg: number; n: number }[] {
  const m = new Map<string, number[]>();
  for (const e of entries) {
    const k = localDayKey(e.createdAt);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(e.intensity);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([day, xs]) => ({ day, avg: avg(xs), n: xs.length }));
}
