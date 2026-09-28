import type { Emotion } from '../types';

export const EMOTION_GROUPS = ['Anxious', 'Low', 'Hurt / angry', 'Tired', 'Okay / good', 'Unsure'] as const;

const raw: [string, string, string, string][] = [
  // group, label, emoji, colour: hard feelings in reds, good ones in greens, in-between in soft neutrals
  ['Anxious', 'Anxious', '😰', '#f47c6c'],
  ['Anxious', 'Worried', '😟', '#f9a898'],
  ['Anxious', 'Panicky', '😱', '#e67272'],
  ['Anxious', 'Overwhelmed', '🌊', '#ec6f86'],
  ['Anxious', 'On edge', '⚡', '#f7b9a8'],
  ['Low', 'Sad', '😢', '#e5788b'],
  ['Low', 'Empty', '🕳️', '#f3c4c9'],
  ['Low', 'Numb', '😶', '#ecd3d5'],
  ['Low', 'Heavy', '🪨', '#d37c86'],
  ['Low', 'Lonely', '🥀', '#f199ae'],
  ['Low', 'Hopeless', '🌧️', '#cd7e8b'],
  ['Hurt / angry', 'Angry', '😠', '#e37372'],
  ['Hurt / angry', 'Frustrated', '😤', '#ee7355'],
  ['Hurt / angry', 'Irritable', '🌶️', '#f58f6e'],
  ['Hurt / angry', 'Ashamed', '😳', '#f5b3c0'],
  ['Hurt / angry', 'Guilty', '😔', '#dc8797'],
  ['Tired', 'Exhausted', '😩', '#c9bfb2'],
  ['Tired', 'Drained', '🔋', '#d9d1c4'],
  ['Tired', 'Flat', '😐', '#e6e0d6'],
  ['Okay / good', 'Calm', '😌', '#9ad9ae'],
  ['Okay / good', 'Safe', '🏠', '#5fbf7f'],
  ['Okay / good', 'Content', '🙂', '#b9e4a3'],
  ['Okay / good', 'Hopeful', '🌱', '#8fd46a'],
  ['Okay / good', 'Grateful', '🙏', '#7fcf9c'],
  ['Okay / good', 'Joyful', '😄', '#4fb069'],
  ['Unsure', "Don't know / can't name it", '❓', '#d9d3e6'],
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

/** Colours the defaults shipped with in earlier versions; untouched ones are upgraded on load. */
export const LEGACY_DEFAULT_COLORS: Record<string, string[]> = {
  'default.anxious': ['#d4a24c', '#ffc93c'],
  'default.worried': ['#c8a96e', '#ffaa5c'],
  'default.panicky': ['#d98f63', '#ff7a6b'],
  'default.overwhelmed': ['#6f9cc2', '#5ec2f2'],
  'default.on-edge': ['#cdb452', '#ffe14d'],
  'default.sad': ['#7093b8', '#6e9cff'],
  'default.empty': ['#98a2ad', '#b6bccb'],
  'default.numb': ['#a9b0b8', '#c8ccd6'],
  'default.heavy': ['#80838b', '#9a97af'],
  'default.lonely': ['#9c88b6', '#c99af0'],
  'default.hopeless': ['#6d7b93', '#8795c4'],
  'default.angry': ['#c4705f', '#ff8577'],
  'default.frustrated': ['#c9825d', '#ffa26b'],
  'default.irritable': ['#cf8c62', '#f79ac0'],
  'default.ashamed': ['#c68e9c', '#f2b5d4'],
  'default.guilty': ['#a68ca0', '#c9a7e8'],
  'default.exhausted': ['#8f8aa8', '#b28cf0'],
  'default.drained': ['#98a48e', '#9fd3b5'],
  'default.flat': ['#aea797', '#d6cdb8'],
  'default.calm': ['#7db3a5', '#7fddbe'],
  'default.safe': ['#8db388', '#8fd86a'],
  'default.content': ['#a2c07e', '#a6e3e9'],
  'default.hopeful': ['#84b36c', '#9be15d'],
  'default.grateful': ['#d0b26a', '#ffb8d1'],
  'default.joyful': ['#e0b75a', '#ffd23f'],
  'default.don-t-know-can-t-name-it': ['#b3aca3', '#d8ccf5'],
};
