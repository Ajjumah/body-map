import type { Emotion } from '../types';

export const EMOTION_GROUPS = ['Anxious', 'Low', 'Hurt / angry', 'Tired', 'Okay / good', 'Unsure'] as const;

const raw: [string, string, string, string][] = [
  // group, label, emoji, colour (muted)
  ['Anxious', 'Anxious', '😰', '#d4a24c'],
  ['Anxious', 'Worried', '😟', '#c8a96e'],
  ['Anxious', 'Panicky', '😱', '#d98f63'],
  ['Anxious', 'Overwhelmed', '🌊', '#6f9cc2'],
  ['Anxious', 'On edge', '⚡', '#cdb452'],
  ['Low', 'Sad', '😢', '#7093b8'],
  ['Low', 'Empty', '🕳️', '#98a2ad'],
  ['Low', 'Numb', '😶', '#a9b0b8'],
  ['Low', 'Heavy', '🪨', '#80838b'],
  ['Low', 'Lonely', '🥀', '#9c88b6'],
  ['Low', 'Hopeless', '🌧️', '#6d7b93'],
  ['Hurt / angry', 'Angry', '😠', '#c4705f'],
  ['Hurt / angry', 'Frustrated', '😤', '#c9825d'],
  ['Hurt / angry', 'Irritable', '🌶️', '#cf8c62'],
  ['Hurt / angry', 'Ashamed', '😳', '#c68e9c'],
  ['Hurt / angry', 'Guilty', '😔', '#a68ca0'],
  ['Tired', 'Exhausted', '😩', '#8f8aa8'],
  ['Tired', 'Drained', '🔋', '#98a48e'],
  ['Tired', 'Flat', '😐', '#aea797'],
  ['Okay / good', 'Calm', '😌', '#7db3a5'],
  ['Okay / good', 'Safe', '🏠', '#8db388'],
  ['Okay / good', 'Content', '🙂', '#a2c07e'],
  ['Okay / good', 'Hopeful', '🌱', '#84b36c'],
  ['Okay / good', 'Grateful', '🙏', '#d0b26a'],
  ['Okay / good', 'Joyful', '😄', '#e0b75a'],
  ['Unsure', "Don't know / can't name it", '❓', '#b3aca3'],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export const DEFAULT_EMOTIONS: Emotion[] = raw.map(([group, label, emoji, color], i) => ({
  id: `default.${slug(label)}`,
  label,
  group,
  emoji,
  color,
  isDefault: true,
  archived: false,
  order: i,
}));

export const SENSATIONS = ['Tight', 'Heavy', 'Buzzing', 'Fluttery', 'Hot', 'Cold', 'Numb', 'Aching', 'Pressure', 'Restless', 'Hollow', 'Racing'];

export function groupEmotions(emotions: Emotion[]): [string, Emotion[]][] {
  const groups = new Map<string, Emotion[]>();
  for (const g of EMOTION_GROUPS) groups.set(g, []);
  for (const e of [...emotions].sort((a, b) => a.order - b.order)) {
    if (!groups.has(e.group)) groups.set(e.group, []);
    groups.get(e.group)!.push(e);
  }
  return [...groups.entries()].filter(([, list]) => list.length > 0);
}
