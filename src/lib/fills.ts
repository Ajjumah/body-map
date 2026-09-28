import type { RegionFill } from '../components/BodyFigure';
import type { T } from '../i18n';
import type { Emotion, Entry, RegionId } from '../types';

/**
 * Colour each region by its strongest entry's first emotion, with a count
 * badge when more than one distinct emotion was logged there.
 */
export function regionFills(entries: Entry[], emotionById: Map<string, Emotion>, imageUrl: (id?: string) => string | undefined, tr: T): Map<RegionId, RegionFill> {
  const byRegion = new Map<RegionId, Entry[]>();
  for (const e of entries) {
    if (!byRegion.has(e.regionId)) byRegion.set(e.regionId, []);
    byRegion.get(e.regionId)!.push(e);
  }
  const fills = new Map<RegionId, RegionFill>();
  for (const [regionId, list] of byRegion) {
    const strongest = list.reduce((a, b) => (b.intensity >= a.intensity ? b : a));
    const top = emotionById.get(strongest.emotionIds[0]);
    const distinct = [...new Set(list.flatMap((e) => e.emotionIds))];
    const names = distinct.map((id) => tr.emotion(emotionById.get(id)));
    fills.set(regionId, {
      color: top?.color ?? '#b3aca3',
      opacity: 0.55 + strongest.intensity * 0.04,
      emoji: top?.emoji ?? (top ? undefined : '❔'),
      imageUrl: top?.imageId ? imageUrl(top.imageId) : undefined,
      count: distinct.length,
      description: tr.tn('figure.entries', list.length, { names: names.join(', '), max: strongest.intensity }),
    });
  }
  return fills;
}
