import { regionLabel } from '../data/regions';
import { fmtTime } from '../lib/format';
import { useStore } from '../store';
import type { Entry } from '../types';
import EmotionIcon from './EmotionIcon';

export default function EntryList({ entries, onRemove }: { entries: Entry[]; onRemove?: (id: string) => void }) {
  const { emotionById } = useStore();
  if (!entries.length) return <p className="text-muted">Nothing here yet.</p>;
  return (
    <ul className="flex flex-col gap-3.5">
      {entries.map((en, i) => (
        <li key={en.id} className="card p-3.5" style={{ transform: `rotate(${[-0.8, 0.8, -0.4, 0.5][i % 4]}deg)` }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display text-xl text-ink">{regionLabel(en.regionId)}</p>
              <p className="flex items-center gap-2 text-sm text-muted">
                {fmtTime(en.createdAt)} · how big
                <span role="img" aria-label={`${en.intensity} of 10`} className="flex gap-0.5">
                  {Array.from({ length: 10 }, (_, n) => (
                    <span key={n} className="size-2 rounded-full border-[1.5px] border-outline" style={{ background: n < en.intensity ? 'var(--sparkle)' : 'var(--surface-2)' }} />
                  ))}
                </span>
              </p>
            </div>
            {onRemove && (
              <button type="button" onClick={() => onRemove(en.id)} className="btn btn-ghost min-h-11 px-3 text-sm text-muted">
                Remove<span className="sr-only"> entry for {regionLabel(en.regionId)}</span>
              </button>
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Feelings">
            {en.emotionIds.map((id) => {
              const e = emotionById.get(id);
              return (
                <li key={id} className="flex items-center gap-1 rounded-full border-[2.5px] border-outline py-0.5 pr-3 pl-1.5 text-sm font-bold text-[var(--c-ink)]" style={{ background: e?.color ?? '#d8ccf5' }}>
                  <EmotionIcon emotion={e} size={18} />
                  {e?.label ?? 'Unknown feeling'}
                </li>
              );
            })}
          </ul>
          {en.sensations.length > 0 && <p className="mt-2 text-sm text-muted">Felt {en.sensations.join(', ').toLowerCase()}</p>}
          {en.note && <p className="mt-1 text-sm whitespace-pre-wrap text-ink">“{en.note}”</p>}
        </li>
      ))}
    </ul>
  );
}
