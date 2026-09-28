export type ContextGroup = 'doing' | 'with' | 'where';
export type ContextTags = Record<ContextGroup, string[]>;

export const CONTEXT_GROUPS: ContextGroup[] = ['doing', 'with', 'where'];

/** Built-in tags, stored by id and translated for display. */
export const DEFAULT_TAGS: ContextTags = {
  doing: ['resting', 'working', 'studying', 'eating', 'moving', 'chores', 'phone', 'bed', 'travelling', 'talking'],
  with: ['alone', 'family', 'friends', 'partner', 'pets', 'coworkers', 'classmates', 'strangers'],
  where: ['home', 'work', 'school', 'outside', 'transport', 'online', 'someone'],
};

/** Custom tags are stored with this prefix so they never collide with built-in ids. */
export const CUSTOM_PREFIX = 'c:';

export const emptyTags = (): ContextTags => ({ doing: [], with: [], where: [] });
