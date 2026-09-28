import { useCallback, useMemo } from 'react';
import { DEFAULT_EMOTIONS } from '../data/emotions';
import { useStore } from '../store';
import type { Emotion, RegionId } from '../types';
import af from './af';
import en, { type Dict, type Key } from './en';
import es from './es';
import fr from './fr';
import pt from './pt';
import xh from './xh';
import zu from './zu';

export const LANGS = {
  en: 'English',
  af: 'Afrikaans',
  zu: 'isiZulu',
  xh: 'isiXhosa',
  es: 'Español',
  fr: 'Français',
  pt: 'Português',
} as const;
export type Lang = keyof typeof LANGS;

const DICTS: Record<Lang, Dict> = { en, af, zu, xh, es, fr, pt };

/** BCP 47 tag used for dates, numbers and the <html lang> attribute. */
export const LOCALE: Record<Lang, string> = { en: 'en', af: 'af-ZA', zu: 'zu-ZA', xh: 'xh-ZA', es: 'es', fr: 'fr', pt: 'pt' };

export const isLang = (v: unknown): v is Lang => typeof v === 'string' && v in LANGS;

/** First supported language from the browser's preferences, else English. */
export function detectLang(prefs: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): Lang {
  for (const p of prefs) {
    const base = p.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const s = DICTS[lang][key] ?? en[key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Look up a key built at runtime; falls back when it isn't a known key. */
export function translateDynamic(lang: Lang, key: string, fallback: string): string {
  return key in en ? translate(lang, key as Key, undefined) : fallback;
}

type PluralBase = { [K in Key]: K extends `${infer B}.one` ? B : never }[Key];

export type T = ReturnType<typeof makeT>;

export function makeT(lang: Lang) {
  const t = (key: Key, vars?: Vars) => translate(lang, key, vars);
  const tn = (base: PluralBase, n: number, vars?: Vars) => translate(lang, `${base}.${n === 1 ? 'one' : 'other'}` as Key, { n, ...vars });
  const dyn = (key: string, fallback: string) => translateDynamic(lang, key, fallback);

  const defaultLabel = new Map(DEFAULT_EMOTIONS.map((e) => [e.id, e.label]));
  const emotion = (e?: Emotion) => {
    if (!e) return t('common.unknownFeeling');
    // Only translate defaults the person hasn't renamed.
    if (e.isDefault && defaultLabel.get(e.id) === e.label) return dyn(`emo.${e.id.replace(/^default\./, '')}`, e.label);
    return e.label;
  };
  const group = (g: string) => dyn(`group.${GROUP_KEYS[g] ?? ''}`, g);
  const sensation = (s: string) => dyn(`sens.${s}`, s);
  const region = (id: RegionId) => dyn(`region.${id}`, id);
  const locale = LOCALE[lang];
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const country = (code: string) => {
    try {
      return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  return { lang, locale, t, tn, dyn, emotion, group, sensation, region, date, time, day, country };
}

const GROUP_KEYS: Record<string, string> = {
  Anxious: 'anxious',
  Low: 'low',
  'Hurt / angry': 'hurt',
  Tired: 'tired',
  'Okay / good': 'good',
  Unsure: 'unsure',
};

/** The current language, from settings or the browser. */
export function useLang(): Lang {
  const { settings } = useStore();
  return settings.language ?? detectLang();
}

export function useT() {
  const lang = useLang();
  const make = useCallback(() => makeT(lang), [lang]);
  return useMemo(make, [make]);
}
