import type { Key } from '../i18n/en';
import type { Emotion, Entry } from '../types';

export type Category = 'breathe' | 'body' | 'senses' | 'rest';
export type Visual = 'balloon' | 'square' | 'wave' | 'hand' | 'bubble';

/** One timed breath phase. `scale` drives the visual (0.6 = small, 1 = full). */
export type Phase = { label: Key; secs: number; scale: number };
export type Step = { text: Key; timed?: { label: Key; secs: number }[] };

type Base = { id: string; cat: Category; title: Key; intro: Key; minutes: number };
export type Exercise =
  | (Base & { kind: 'pace'; visual: Visual; phases: Phase[]; rounds: number })
  | (Base & { kind: 'steps'; steps: Step[] })
  | (Base & { kind: 'butterfly'; secs: number })
  | (Base & { kind: 'senses' })
  | (Base & { kind: 'text' });

const IN = 1, OUT = 0.6;

export const EXERCISES: Exercise[] = [
  // Breathing
  {
    id: 'balloon', cat: 'breathe', kind: 'pace', visual: 'balloon', rounds: 4, minutes: 1,
    title: 'ground.breathing.title', intro: 'ground.breathing.intro',
    phases: [{ label: 'ground.in', secs: 4, scale: IN }, { label: 'ground.hold', secs: 7, scale: IN }, { label: 'ground.out', secs: 8, scale: OUT }],
  },
  {
    id: 'square', cat: 'breathe', kind: 'pace', visual: 'square', rounds: 4, minutes: 1,
    title: 'ex.square.title', intro: 'ex.square.intro',
    phases: [
      { label: 'phase.in', secs: 4, scale: IN },
      { label: 'phase.hold', secs: 4, scale: IN },
      { label: 'phase.out', secs: 4, scale: OUT },
      { label: 'phase.hold', secs: 4, scale: OUT },
    ],
  },
  {
    id: 'waves', cat: 'breathe', kind: 'pace', visual: 'wave', rounds: 6, minutes: 1,
    title: 'ex.waves.title', intro: 'ex.waves.intro',
    phases: [{ label: 'phase.in', secs: 5, scale: IN }, { label: 'phase.out', secs: 5, scale: OUT }],
  },
  {
    id: 'sigh', cat: 'breathe', kind: 'pace', visual: 'bubble', rounds: 5, minutes: 1,
    title: 'ex.sigh.title', intro: 'ex.sigh.intro',
    phases: [{ label: 'phase.in', secs: 2, scale: 0.9 }, { label: 'phase.sniff', secs: 1, scale: IN }, { label: 'phase.sigh', secs: 6, scale: OUT }],
  },
  {
    id: 'bee', cat: 'breathe', kind: 'pace', visual: 'bubble', rounds: 5, minutes: 1,
    title: 'ex.bee.title', intro: 'ex.bee.intro',
    phases: [{ label: 'phase.in', secs: 4, scale: IN }, { label: 'phase.hum', secs: 6, scale: OUT }],
  },
  {
    id: 'hand', cat: 'breathe', kind: 'pace', visual: 'hand', rounds: 5, minutes: 1,
    title: 'ex.hand.title', intro: 'ex.hand.intro',
    phases: [{ label: 'phase.in', secs: 4, scale: IN }, { label: 'phase.out', secs: 4, scale: OUT }],
  },

  // Moving and tapping
  { id: 'butterfly', cat: 'body', kind: 'butterfly', secs: 60, minutes: 1, title: 'ex.butterfly.title', intro: 'ex.butterfly.intro' },
  {
    id: 'squeeze', cat: 'body', kind: 'steps', minutes: 2, title: 'ex.squeeze.title', intro: 'ex.squeeze.intro',
    steps: (['hands', 'shoulders', 'face', 'tummy', 'feet'] as const)
      .map((p): Step => ({ text: `ex.squeeze.${p}`, timed: [{ label: 'phase.squeeze', secs: 5 }, { label: 'phase.release', secs: 7 }] }))
      .concat([{ text: 'ex.squeeze.end', timed: [{ label: 'phase.release', secs: 10 }] }]),
  },
  {
    id: 'shake', cat: 'body', kind: 'steps', minutes: 1, title: 'ex.shake.title', intro: 'ex.shake.intro',
    steps: (['hands', 'arms', 'legs', 'body'] as const)
      .map((p): Step => ({ text: `ex.shake.${p}`, timed: [{ label: 'phase.shake', secs: 10 }] }))
      .concat([{ text: 'ex.shake.still', timed: [{ label: 'phase.notice', secs: 10 }] }]),
  },

  // Senses and imagination
  { id: 'senses', cat: 'senses', kind: 'senses', minutes: 2, title: 'ground.senses.title', intro: 'ground.senses.intro' },
  {
    id: 'place', cat: 'senses', kind: 'steps', minutes: 3, title: 'ex.place.title', intro: 'ex.place.intro',
    steps: (['pick', 'see', 'hear', 'feel', 'who', 'name'] as const).map((p) => ({ text: `ex.place.${p}` as const })),
  },

  // Rest and comfort
  {
    id: 'kind', cat: 'rest', kind: 'steps', minutes: 2, title: 'ex.kind.title', intro: 'ex.kind.intro',
    steps: (['place', 'warm', 'breathe', 'words', 'words2'] as const).map((p) => ({ text: `ex.kind.${p}` as const })),
  },
  { id: 'rest', cat: 'rest', kind: 'text', minutes: 1, title: 'ground.rest.title', intro: 'ground.rest.intro' },
  { id: 'savour', cat: 'rest', kind: 'text', minutes: 1, title: 'ground.savour.title', intro: 'ground.savour.intro' },
];

export const CATEGORIES: Category[] = ['breathe', 'body', 'senses', 'rest'];

export const exerciseById = (id?: string) => EXERCISES.find((e) => e.id === id);

/**
 * Exercises that suit the strongest feeling in a check-in, best first.
 * Big, buzzing feelings get breathing or movement; heavy or numb ones get
 * senses, tapping or comfort; okay feelings get savouring.
 */
export function suggestExercises(entries: Entry[], emotionById: Map<string, Emotion>): string[] {
  if (!entries.length) return [];
  const top = entries.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const ids = new Set(top.emotionIds);
  const groups = new Set(top.emotionIds.map((id) => emotionById.get(id)?.group));
  const big = top.intensity >= 7;

  if (ids.has('default.panicky') || (ids.has('default.overwhelmed') && big)) return ['sigh', 'senses', 'butterfly', 'square'];
  if (ids.has('default.numb') || ids.has('default.empty')) return ['senses', 'shake', 'butterfly', 'place'];
  if (groups.has('Hurt / angry')) return big ? ['shake', 'squeeze', 'sigh', 'bee'] : ['squeeze', 'bee', 'waves', 'shake'];
  if (groups.has('Anxious')) return big ? ['sigh', 'square', 'butterfly', 'hand'] : ['square', 'balloon', 'hand', 'waves'];
  if (groups.has('Low')) return ['kind', 'butterfly', 'place', 'waves'];
  if (groups.has('Tired')) return ['rest', 'waves', 'kind'];
  if (groups.has('Okay / good')) return ['savour', 'place', 'waves'];
  if (groups.has('Unsure')) return ['butterfly', 'senses', 'waves', 'kind'];
  return ['balloon', 'waves', 'senses'];
}
