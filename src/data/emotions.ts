import type { Emotion } from '../types';

export const EMOTION_GROUPS = ['Anxious', 'Low', 'Hurt / angry', 'Tired', 'Okay / good', 'Unsure'] as const;

const raw: [string, string, string, string][] = [
  // group, label, emoji, colour
  ['Anxious', 'Anxious', '😰', '#ffc93c'],
  ['Anxious', 'Worried', '😟', '#ffaa5c'],
  ['Anxious', 'Panicky', '😱', '#ff7a6b'],
  ['Anxious', 'Overwhelmed', '🌊', '#5ec2f2'],
  ['Anxious', 'On edge', '⚡', '#ffe14d'],
  ['Low', 'Sad', '😢', '#6e9cff'],
  ['Low', 'Empty', '🕳️', '#b6bccb'],
  ['Low', 'Numb', '😶', '#c8ccd6'],
  ['Low', 'Heavy', '🪨', '#9a97af'],
  ['Low', 'Lonely', '🥀', '#c99af0'],
  ['Low', 'Hopeless', '🌧️', '#8795c4'],
  ['Hurt / angry', 'Angry', '😠', '#ff8577'],
  ['Hurt / angry', 'Frustrated', '😤', '#ffa26b'],
  ['Hurt / angry', 'Irritable', '🌶️', '#f79ac0'],
  ['Hurt / angry', 'Ashamed', '😳', '#f2b5d4'],
  ['Hurt / angry', 'Guilty', '😔', '#c9a7e8'],
  ['Tired', 'Exhausted', '😩', '#b28cf0'],
  ['Tired', 'Drained', '🔋', '#9fd3b5'],
  ['Tired', 'Flat', '😐', '#d6cdb8'],
  ['Okay / good', 'Calm', '😌', '#7fddbe'],
  ['Okay / good', 'Safe', '🏠', '#8fd86a'],
  ['Okay / good', 'Content', '🙂', '#a6e3e9'],
  ['Okay / good', 'Hopeful', '🌱', '#9be15d'],
  ['Okay / good', 'Grateful', '🙏', '#ffb8d1'],
  ['Okay / good', 'Joyful', '😄', '#ffd23f'],
  ['Unsure', "Don't know / can't name it", '❓', '#d8ccf5'],
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

/** Colours the defaults shipped with before the playful redesign; untouched ones are upgraded on load. */
export const LEGACY_DEFAULT_COLORS: Record<string, string> = {
  'default.anxious': '#d4a24c',
  'default.worried': '#c8a96e',
  'default.panicky': '#d98f63',
  'default.overwhelmed': '#6f9cc2',
  'default.on-edge': '#cdb452',
  'default.sad': '#7093b8',
  'default.empty': '#98a2ad',
  'default.numb': '#a9b0b8',
  'default.heavy': '#80838b',
  'default.lonely': '#9c88b6',
  'default.hopeless': '#6d7b93',
  'default.angry': '#c4705f',
  'default.frustrated': '#c9825d',
  'default.irritable': '#cf8c62',
  'default.ashamed': '#c68e9c',
  'default.guilty': '#a68ca0',
  'default.exhausted': '#8f8aa8',
  'default.drained': '#98a48e',
  'default.flat': '#aea797',
  'default.calm': '#7db3a5',
  'default.safe': '#8db388',
  'default.content': '#a2c07e',
  'default.hopeful': '#84b36c',
  'default.grateful': '#d0b26a',
  'default.joyful': '#e0b75a',
  'default.don-t-know-can-t-name-it': '#b3aca3',
};
