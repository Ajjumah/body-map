import type { RegionId } from '../types';

export type View = 'front' | 'back';

export type Region = {
  id: RegionId;
  label: string;
  view: View | 'none';
  d: string;
  /** Anchor point for the emoji badge (viewBox units). */
  at: [number, number];
  fillRule?: 'evenodd';
};

// Heart shape, reused as a hole in "Chest (left)" so the two never overlap.
const HEART = 'M114 132 C97 121 101 104 114 112 C127 104 131 121 114 132 Z';

// Front view: the person's left is on the viewer's right.
export const FRONT_REGIONS: Region[] = [
  { id: 'front.throat', label: 'Throat', view: 'front', d: 'M89 66.7 Q100 73.3 111 66.7 L113 92 L87 92 Z', at: [100, 81] },
  { id: 'front.head', label: 'Head (top)', view: 'front', d: 'M77.4 30 A24 30 0 0 1 122.6 30 Z', at: [100, 20] },
  { id: 'front.forehead-eyes', label: 'Forehead / eyes', view: 'front', d: 'M77.4 30 L122.6 30 A24 30 0 0 1 123.1 48 L76.9 48 A24 30 0 0 1 77.4 30 Z', at: [100, 39] },
  { id: 'front.jaw-mouth', label: 'Jaw / mouth', view: 'front', d: 'M76.9 48 L123.1 48 A24 30 0 0 1 76.9 48 Z', at: [100, 58] },
  { id: 'front.shoulder.right', label: 'Shoulder (right)', view: 'front', d: 'M87 88 L87 92 L72 92 L70 114 L52 114 Q52 98 64 92 Q74 88 87 88 Z', at: [64, 102] },
  { id: 'front.shoulder.left', label: 'Shoulder (left)', view: 'front', d: 'M113 88 L113 92 L128 92 L130 114 L148 114 Q148 98 136 92 Q126 88 113 88 Z', at: [136, 102] },
  { id: 'front.chest.right', label: 'Chest (right)', view: 'front', d: 'M72 92 L100 92 L100 140 L72 140 L70 114 Z', at: [86, 116] },
  { id: 'front.chest.left', label: 'Chest (left)', view: 'front', d: `M100 92 L128 92 L130 114 L128 140 L100 140 Z ${HEART}`, fillRule: 'evenodd', at: [114, 99] },
  { id: 'front.heart', label: 'Heart area', view: 'front', d: HEART, at: [114, 120] },
  { id: 'front.stomach', label: 'Stomach (upper)', view: 'front', d: 'M72 140 L128 140 L126 170 L74 170 Z', at: [100, 155] },
  { id: 'front.gut', label: 'Gut / lower abdomen', view: 'front', d: 'M74 170 L126 170 L124 200 L76 200 Z', at: [100, 185] },
  { id: 'front.hips', label: 'Hips / pelvis', view: 'front', d: 'M76 200 L124 200 L130 228 L100 240 L70 228 Z', at: [100, 218] },
  { id: 'front.upper-arm.right', label: 'Upper arm (right)', view: 'front', d: 'M52 114 L70 114 L66 170 L48 170 Z', at: [59, 142] },
  { id: 'front.upper-arm.left', label: 'Upper arm (left)', view: 'front', d: 'M148 114 L130 114 L134 170 L152 170 Z', at: [141, 142] },
  { id: 'front.forearm.right', label: 'Forearm (right)', view: 'front', d: 'M48 170 L66 170 L60 225 L44 225 Z', at: [54, 197] },
  { id: 'front.forearm.left', label: 'Forearm (left)', view: 'front', d: 'M152 170 L134 170 L140 225 L156 225 Z', at: [146, 197] },
  { id: 'front.hand.right', label: 'Hand (right)', view: 'front', d: 'M44 225 L60 225 Q64 246 57 258 Q51 263 45 258 Q37 246 44 225 Z', at: [51, 242] },
  { id: 'front.hand.left', label: 'Hand (left)', view: 'front', d: 'M156 225 L140 225 Q136 246 143 258 Q149 263 155 258 Q163 246 156 225 Z', at: [149, 242] },
  { id: 'front.thigh.right', label: 'Thigh (right)', view: 'front', d: 'M70 228 L99 239 L96 300 L74 300 Q68 262 70 228 Z', at: [85, 268] },
  { id: 'front.thigh.left', label: 'Thigh (left)', view: 'front', d: 'M130 228 L101 239 L104 300 L126 300 Q132 262 130 228 Z', at: [115, 268] },
  { id: 'front.knee.right', label: 'Knee (right)', view: 'front', d: 'M74 300 L96 300 L95 326 L76 326 Z', at: [85, 313] },
  { id: 'front.knee.left', label: 'Knee (left)', view: 'front', d: 'M126 300 L104 300 L105 326 L124 326 Z', at: [115, 313] },
  { id: 'front.lower-leg.right', label: 'Lower leg (right)', view: 'front', d: 'M76 326 L95 326 L92 404 L80 404 Q72 362 76 326 Z', at: [85, 362] },
  { id: 'front.lower-leg.left', label: 'Lower leg (left)', view: 'front', d: 'M124 326 L105 326 L108 404 L120 404 Q128 362 124 326 Z', at: [115, 362] },
  { id: 'front.foot.right', label: 'Foot (right)', view: 'front', d: 'M80 404 L92 404 L95 418 Q95 428 86 428 L68 428 Q61 425 68 418 Z', at: [82, 418] },
  { id: 'front.foot.left', label: 'Foot (left)', view: 'front', d: 'M120 404 L108 404 L105 418 Q105 428 114 428 L132 428 Q139 425 132 418 Z', at: [118, 418] },
];

export const BACK_REGIONS: Region[] = [
  { id: 'back.neck', label: 'Neck (back)', view: 'back', d: 'M89 66.7 Q100 73.3 111 66.7 L113 88 L87 88 Z', at: [100, 79] },
  { id: 'back.head', label: 'Back of head', view: 'back', d: 'M100 10 A24 30 0 1 1 99.9 10 Z', at: [100, 40] },
  { id: 'back.upper-back', label: 'Upper back / shoulder blades', view: 'back', d: 'M87 88 L113 88 Q126 88 136 92 Q148 98 148 114 L130 114 L128 140 L72 140 L70 114 L52 114 Q52 98 64 92 Q74 88 87 88 Z', at: [100, 115] },
  { id: 'back.mid-back', label: 'Mid back', view: 'back', d: 'M72 140 L128 140 L126 174 L74 174 Z', at: [100, 157] },
  { id: 'back.lower-back', label: 'Lower back', view: 'back', d: 'M74 174 L126 174 L124 204 L76 204 Z', at: [100, 189] },
  { id: 'back.thighs', label: 'Back of thighs', view: 'back', d: 'M71 250 Q74 258 84 258 Q96 258 99 251 L96 322 L75 322 Q69 290 71 250 Z M129 250 Q126 258 116 258 Q104 258 101 251 L104 322 L125 322 Q131 290 129 250 Z', at: [100, 292] },
  { id: 'back.hips', label: 'Buttocks / hips', view: 'back', d: 'M76 204 L124 204 L130 230 Q132 256 116 258 Q104 258 100 248 Q96 258 84 258 Q68 256 70 230 Z', at: [100, 228] },
  { id: 'back.calves', label: 'Calves', view: 'back', d: 'M75 322 L96 322 L92 404 L80 404 Q70 362 75 322 Z M125 322 L104 322 L108 404 L120 404 Q130 362 125 322 Z', at: [100, 360] },
];

/** Non-interactive silhouette parts for the back view (arms, hands, feet). */
export const BACK_DECOR = [
  'M52 114 L70 114 L66 170 L60 225 Q64 246 57 258 Q51 263 45 258 Q37 246 44 225 L48 170 Z',
  'M148 114 L130 114 L134 170 L140 225 Q136 246 143 258 Q149 263 155 258 Q163 246 156 225 L152 170 Z',
  'M80 404 L92 404 L95 418 Q95 428 86 428 L68 428 Q61 425 68 418 Z',
  'M120 404 L108 404 L105 418 Q105 428 114 428 L132 428 Q139 425 132 418 Z',
];

export const WHOLE_BODY: Region = { id: 'whole.body', label: 'Whole body / everywhere', view: 'none', d: '', at: [0, 0] };

export const ALL_REGIONS: Region[] = [...FRONT_REGIONS, ...BACK_REGIONS, WHOLE_BODY];
const byId = new Map(ALL_REGIONS.map((r) => [r.id, r]));

export function regionLabel(id: RegionId): string {
  return byId.get(id)?.label ?? id;
}
export function regionView(id: RegionId): View | 'none' {
  return byId.get(id)?.view ?? 'none';
}

/** Order used for keyboard tabbing and the list view: top to bottom. */
export function orderedRegions(view: View): Region[] {
  const list = view === 'front' ? FRONT_REGIONS : BACK_REGIONS;
  return [...list].sort((a, b) => a.at[1] - b.at[1] || a.at[0] - b.at[0]);
}
