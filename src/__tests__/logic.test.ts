import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { clearAll, loadAll, putEmotions, putEntry, putImage, putSession, replaceAll, setMeta } from '../db';
import { DEFAULT_EMOTIONS } from '../data/emotions';
import { ALL_REGIONS, BACK_REGIONS, FRONT_REGIONS } from '../data/regions';
import { entriesCsv, parseBackup, toBackup } from '../lib/backup';
import { applyFilters, dailyIntensity, regionCounts, topEmotions } from '../lib/insights';
import { hashPin, isValidPin, verifyPin } from '../lib/pin';
import { joinReflection, splitReflection } from '../components/SessionSummary';
import { makeT } from '../i18n';
import type { Entry } from '../types';

const entry = (over: Partial<Entry>): Entry => ({
  id: Math.random().toString(36).slice(2),
  sessionId: 's1',
  regionId: 'front.heart',
  emotionIds: ['default.anxious'],
  sensations: [],
  intensity: 5,
  createdAt: new Date().toISOString(),
  ...over,
});

describe('regions', () => {
  it('covers every region in the spec with unique ids', () => {
    expect(FRONT_REGIONS).toHaveLength(26);
    expect(BACK_REGIONS).toHaveLength(8);
    const ids = ALL_REGIONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('whole.body');
  });
});

describe('default emotions', () => {
  it('has the 26 spec emotions, each with emoji and colour', () => {
    expect(DEFAULT_EMOTIONS).toHaveLength(26);
    for (const e of DEFAULT_EMOTIONS) {
      expect(e.emoji).toBeTruthy();
      expect(e.color).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(DEFAULT_EMOTIONS.some((e) => e.label.startsWith("Don't know"))).toBe(true);
  });
});

describe('reflection text', () => {
  it('round-trips both prompts, including multi-line answers', () => {
    const r = joinReflection('Work\ndeadline', 'A walk');
    expect(splitReflection(r)).toEqual(['Work\ndeadline', 'A walk']);
    expect(splitReflection(joinReflection('', 'Tea'))).toEqual(['', 'Tea']);
    expect(joinReflection(' ', '')).toBeUndefined();
  });
});

describe('insights', () => {
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86_400_000).toISOString();
  const list = [
    entry({ createdAt: days(1), intensity: 8, emotionIds: ['a', 'b'] }),
    entry({ createdAt: days(10), regionId: 'back.neck', intensity: 2, emotionIds: ['a'] }),
    entry({ createdAt: days(40), intensity: 5, emotionIds: ['c'] }),
  ];
  it('filters by range, emotion and region', () => {
    expect(applyFilters(list, { range: '7' }, now)).toHaveLength(1);
    expect(applyFilters(list, { range: '30' }, now)).toHaveLength(2);
    expect(applyFilters(list, { range: 'all', emotionId: 'a' }, now)).toHaveLength(2);
    expect(applyFilters(list, { range: 'all', regionId: 'back.neck' }, now)).toHaveLength(1);
  });
  it('counts regions and top emotions', () => {
    expect(regionCounts(list).get('front.heart')).toBe(2);
    expect(topEmotions(list)[0]).toEqual(['a', 2]);
    expect(dailyIntensity(list)).toHaveLength(3);
  });
});

describe('pin', () => {
  it('validates, hashes with salt, and verifies', async () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('0000')).toBe(true);
    const a = await hashPin('2468');
    const b = await hashPin('2468');
    expect(a.hash).not.toBe(b.hash); // different salts
    expect(a.hash).not.toContain('2468');
    expect(await verifyPin('2468', a.hash, a.salt)).toBe(true);
    expect(await verifyPin('2469', a.hash, a.salt)).toBe(false);
  });
});

describe('csv', () => {
  it('quotes cells and neutralises formulas', () => {
    const csv = entriesCsv([entry({ note: '=HYPERLINK("x") "quoted", comma' })], [{ id: 's1', startedAt: new Date().toISOString() }], new Map(), makeT('en'));
    expect(csv).toContain(`"'=HYPERLINK(""x"") ""quoted"", comma"`);
    expect(csv.split('\r\n')[0]).toMatch(/^date,time,session_id/);
  });
});

describe('backup round trip (IndexedDB)', () => {
  it('export → delete all → import restores everything', async () => {
    await clearAll();
    const img = { id: 'img1', blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/webp' }), createdAt: '2026-01-01T00:00:00.000Z' };
    const custom = { id: 'custom.x', label: 'Storm', group: 'Unsure', imageId: 'img1', color: '#123456', isDefault: false, archived: false, order: 99 };
    await putEmotions([...DEFAULT_EMOTIONS, custom]);
    await putImage(img);
    await putSession({ id: 's1', startedAt: '2026-01-01T10:00:00.000Z', finishedAt: '2026-01-01T10:05:00.000Z', overallMood: 4, reflection: 'r' });
    await putSession({ id: 's2', startedAt: '2026-01-02T10:00:00.000Z' });
    await putEntry(entry({ id: 'e1', sessionId: 's1', emotionIds: ['custom.x'], note: 'hi', sensations: ['Tight'] }));
    await putEntry(entry({ id: 'e2', sessionId: 's2' }));
    await setMeta('settings', { theme: 'dark', supportName: 'T', pinHash: 'h', pinSalt: 's' });
    await setMeta('currentSessionId', 's2');

    const before = await loadAll();
    const json = JSON.stringify(await toBackup(before));
    expect(json).not.toContain('pinHash');

    await clearAll();
    expect((await loadAll()).entries).toHaveLength(0);

    await replaceAll(parseBackup(json, { theme: 'sticker', pinHash: 'h', pinSalt: 's' }));
    const after = await loadAll();

    const strip = (s: typeof before) => ({ ...s, images: undefined });
    const sortById = <T extends { id: string }>(l: T[]) => [...l].sort((a, b) => a.id.localeCompare(b.id));
    expect(sortById(after.emotions)).toEqual(sortById(before.emotions));
    expect(sortById(after.sessions)).toEqual(sortById(before.sessions));
    expect(sortById(after.entries)).toEqual(sortById(before.entries));
    expect(after.settings).toEqual(before.settings);
    expect(after.currentSessionId).toBe('s2');
    expect(strip(after).emotions.length).toBe(27);
    const bytes = new Uint8Array(await after.images[0].blob.arrayBuffer());
    expect([...bytes]).toEqual([1, 2, 3, 250]);
    expect(after.images[0].blob.type).toBe('image/webp');
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope', { theme: 'sticker' })).toThrow('errJson');
    expect(() => parseBackup('{"a":1}', { theme: 'sticker' })).toThrow('errFormat');
  });
});

describe('worlds', () => {
  it('maps old theme settings onto worlds, defaulting to Sticker Book', async () => {
    const { normalizeTheme, resolveWorld } = await import('../lib/world');
    expect(normalizeTheme(undefined)).toBe('sticker');
    expect(normalizeTheme('system')).toBe('sticker');
    expect(normalizeTheme('light')).toBe('sticker');
    expect(normalizeTheme('dark')).toBe('starlight');
    expect(normalizeTheme('island')).toBe('island');
    expect(resolveWorld('auto', true)).toBe('starlight');
    expect(resolveWorld('auto', false)).toBe('sticker');
  });

  it('upgrades untouched default emotion colours but keeps custom ones', async () => {
    const { LEGACY_DEFAULT_COLORS } = await import('../data/emotions');
    expect(Object.keys(LEGACY_DEFAULT_COLORS)).toHaveLength(26);
    for (const e of DEFAULT_EMOTIONS) expect(LEGACY_DEFAULT_COLORS[e.id]).toBeDefined();
  });

  it('normalises a legacy theme in an imported backup', () => {
    const b = JSON.stringify({ format: 'body-map-backup', version: 1, emotions: [], sessions: [], entries: [], images: [], settings: { theme: 'dark' } });
    expect(parseBackup(b, { theme: 'sticker' }).settings.theme).toBe('starlight');
  });
});

describe('translations', async () => {
  const { default: enDict } = await import('../i18n/en');
  const langs = { af: (await import('../i18n/af')).default, zu: (await import('../i18n/zu')).default, xh: (await import('../i18n/xh')).default, es: (await import('../i18n/es')).default, fr: (await import('../i18n/fr')).default, pt: (await import('../i18n/pt')).default };
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  for (const [code, dict] of Object.entries(langs)) {
    it(`${code} has every key, nothing extra, and keeps placeholders`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(enDict).sort());
      for (const [k, v] of Object.entries(enDict)) {
        const tr = (dict as Record<string, string>)[k];
        expect(tr.trim(), `${code}:${k} is empty`).not.toBe('');
        // Singular forms may drop {n} ("once"); everything else must keep every placeholder.
        const want = k.endsWith('.one') ? holes(v).filter((h) => h !== 'n') : holes(v);
        for (const h of want) expect(holes(tr), `${code}:${k} lost {${h}}`).toContain(h);
        for (const h of holes(tr)) expect(holes(v), `${code}:${k} has unknown {${h}}`).toContain(h);
      }
    });
  }

  it('translates default emotions, keeps renamed ones, and plural-picks', async () => {
    const { makeT, DEFAULT_LANG } = await import('../i18n');
    const tr = makeT('af');
    const anxious = DEFAULT_EMOTIONS.find((e) => e.id === 'default.anxious')!;
    expect(tr.emotion(anxious)).toBe('Angstig');
    expect(tr.emotion({ ...anxious, label: 'My own name' })).toBe('My own name');
    expect(tr.tn('map.feelings', 1)).toBe('1 gevoel');
    expect(tr.tn('map.feelings', 3)).toBe('3 gevoelens');
    expect(tr.region('front.heart')).toBe('Hartstreek');
    expect(DEFAULT_LANG).toBe('en');
  });
});

describe('helplines', async () => {
  const { HELPLINES, detectCountry, helpFor } = await import('../data/helplines');
  it('lists dialable numbers for each country', () => {
    for (const h of HELPLINES) {
      expect(h.code).toMatch(/^[A-Z]{2}$/);
      expect(h.lines.length).toBeGreaterThan(0);
      for (const l of h.lines) expect(l.tel).toMatch(/^\d{3,12}$/);
      expect(h.emergency).toMatch(/^\d{3}/);
    }
    expect(helpFor('ZA')!.lines[0].number).toBe('0800 567 567');
  });
  it('guesses the country from time zone, then language, defaulting to South Africa', () => {
    expect(detectCountry(['en-US'], 'Africa/Johannesburg')).toBe('ZA');
    expect(detectCountry(['en-US'], 'Australia/Sydney')).toBe('AU');
    expect(detectCountry(['en-GB'], 'Europe/Berlin')).toBe('GB');
    expect(detectCountry(['pt-BR'], 'UTC')).toBe('BR');
    expect(detectCountry(['de-DE', 'en'], 'Europe/Berlin')).toBe('ZA');
  });
});

describe('feeling colours', () => {
  it('keeps dark text readable (≥4.5:1) on every default feeling colour', () => {
    const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const lum = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16)));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ink = lum('#2b2b3a');
    for (const e of DEFAULT_EMOTIONS) expect((lum(e.color) + 0.05) / (ink + 0.05), e.label).toBeGreaterThanOrEqual(4.5);
  });
});

describe('calm exercises', async () => {
  const { EXERCISES, CATEGORIES, exerciseById, suggestExercises } = await import('../data/exercises');
  const emo = new Map(DEFAULT_EMOTIONS.map((e) => [e.id, e]));
  it('has unique ids, something in every category, and sane timings', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const c of CATEGORIES) expect(EXERCISES.some((e) => e.cat === c)).toBe(true);
    for (const e of EXERCISES) {
      if (e.kind === 'pace') for (const p of e.phases) expect(p.secs).toBeGreaterThan(0);
      if (e.kind === 'steps') expect(e.steps.length).toBeGreaterThan(0);
    }
  });
  it('suggests real exercises that fit the strongest feeling', () => {
    const cases: [string, number, string][] = [
      ['default.panicky', 9, 'sigh'],
      ['default.angry', 8, 'shake'],
      ['default.worried', 4, 'square'],
      ['default.sad', 6, 'kind'],
      ['default.numb', 5, 'senses'],
      ['default.exhausted', 5, 'rest'],
      ['default.calm', 5, 'savour'],
    ];
    for (const [id, intensity, first] of cases) {
      const ids = suggestExercises([entry({ emotionIds: [id], intensity })], emo);
      expect(ids[0], id).toBe(first);
      for (const x of ids) expect(exerciseById(x), x).toBeDefined();
    }
    expect(suggestExercises([], emo)).toEqual([]);
  });
});
