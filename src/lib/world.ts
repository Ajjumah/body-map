export type World = 'sticker' | 'island' | 'starlight';
export type ThemeSetting = World | 'auto';

export const WORLDS: Record<World, { name: string; buddy: string; blurb: string; themeColor: string; swatches: string[] }> = {
  sticker: { name: 'Sticker Book', buddy: 'Sunny', blurb: 'Crayons, stickers and a sunshine friend.', themeColor: '#fff9ee', swatches: ['#5ec2f2', '#ff7a6b', '#ffc93c', '#6bd08b'] },
  island: { name: 'Cozy Island', buddy: 'Sprout', blurb: 'Blue sky, soft clouds and a little sprout.', themeColor: '#bfe6ff', swatches: ['#7bcb5b', '#ffd45c', '#6fc3ff', '#ffb86b'] },
  starlight: { name: 'Starlight Pocket', buddy: 'Twinkle', blurb: 'A cosy night sky with a friendly star.', themeColor: '#2e2461', swatches: ['#ff8fc8', '#7fe3e0', '#ffe173', '#c6b2ff'] },
};

export const DEFAULT_THEME: ThemeSetting = 'sticker';

/** Map older light/dark/system settings (and junk) onto the worlds. */
export function normalizeTheme(v: unknown): ThemeSetting {
  if (v === 'sticker' || v === 'island' || v === 'starlight' || v === 'auto') return v;
  if (v === 'dark') return 'starlight';
  return DEFAULT_THEME;
}

export function resolveWorld(setting: ThemeSetting, prefersDark: boolean): World {
  if (setting === 'auto') return prefersDark ? 'starlight' : 'sticker';
  return setting;
}
