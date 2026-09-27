import { orderedRegions, WHOLE_BODY, type View } from '../data/regions';
import type { RegionId } from '../types';
import type { RegionFill } from './BodyFigure';

type Props = {
  view: View;
  fills?: Map<RegionId, RegionFill>;
  onSelect: (id: RegionId) => void;
};

export default function RegionList({ view, fills, onSelect }: Props) {
  const regions = [...orderedRegions(view), WHOLE_BODY];
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label={`Body regions, ${view} view`}>
      {regions.map((r) => {
        const f = fills?.get(r.id);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className="btn w-full justify-between rounded-2xl px-4 py-2 text-left"
            >
              <span className="flex items-center gap-2">
                {f && <span aria-hidden="true" className="inline-block size-4 rounded-full border-2 border-outline" style={{ background: f.color }} />}
                {r.label}
              </span>
              {f && (
                <span className="text-sm text-muted">
                  {f.imageUrl ? <img src={f.imageUrl} alt="" className="inline size-5 rounded-full object-cover" /> : <span aria-hidden="true">{f.emoji}</span>}
                  {f.description && <span className="sr-only">{f.description}</span>}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
