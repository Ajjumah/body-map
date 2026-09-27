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
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={`Body regions, ${view} view`}>
      {regions.map((r) => {
        const f = fills?.get(r.id);
        return (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onSelect(r.id)}
              className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-left text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="flex items-center gap-2">
                {f && <span aria-hidden="true" className="inline-block size-3 rounded-full" style={{ background: f.color }} />}
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
