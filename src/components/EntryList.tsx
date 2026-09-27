import { regionLabel } from '../data/regions';
import { fmtTime } from '../lib/format';
import { useStore } from '../store';
import type { Entry } from '../types';
import EmotionIcon from './EmotionIcon';

export default function EntryList({ entries, onRemove }: { entries: Entry[]; onRemove?: (id: string) => void }) {
  const { emotionById } = useStore();
  if (!entries.length) return <p className="text-muted">No entries.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((en) => (
        <li key={en.id} className="rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-ink">{regionLabel(en.regionId)}</p>
              <p className="text-xs text-muted">{fmtTime(en.createdAt)} · intensity {en.intensity}/10</p>
            </div>
            {onRemove && (
              <button type="button" onClick={() => onRemove(en.id)} className="min-h-11 rounded-full px-3 text-sm text-muted hover:bg-surface-2">
                Remove<span className="sr-only"> entry for {regionLabel(en.regionId)}</span>
              </button>
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Feelings">
            {en.emotionIds.map((id) => {
              const e = emotionById.get(id);
              return (
                <li key={id} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-ink" style={{ background: `${e?.color ?? '#b3aca3'}33` }}>
                  <EmotionIcon emotion={e} size={18} />
                  {e?.label ?? 'Unknown feeling'}
                </li>
              );
            })}
          </ul>
          {en.sensations.length > 0 && <p className="mt-2 text-sm text-muted">Felt: {en.sensations.join(', ').toLowerCase()}</p>}
          {en.note && <p className="mt-1 text-sm whitespace-pre-wrap text-ink">“{en.note}”</p>}
        </li>
      ))}
    </ul>
  );
}
