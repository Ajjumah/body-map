import { groupEmotions } from '../data/emotions';
import { ALL_REGIONS } from '../data/regions';
import type { Filters as F, Range } from '../lib/insights';
import { useStore } from '../store';
import { Segmented } from './BodyMapScreen';

const selectCls = 'min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink';

export default function Filters({ value, onChange }: { value: F; onChange: (f: F) => void }) {
  const { emotions } = useStore();
  const set = (patch: Partial<F>) => onChange({ ...value, ...patch });
  const active = value.emotionId || value.regionId || value.range !== 'all';
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-3" role="group" aria-label="Filters">
      <Segmented<Range>
        value={value.range}
        onChange={(range) => set({ range })}
        label="Date range"
        options={[['7', '7 days'], ['30', '30 days'], ['all', 'All time'], ['custom', 'Custom']]}
      />
      {value.range === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-muted">
            From
            <input type="date" value={value.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} className={selectCls} />
          </label>
          <label className="text-sm text-muted">
            To
            <input type="date" value={value.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} className={selectCls} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Feeling
          <select value={value.emotionId ?? ''} onChange={(e) => set({ emotionId: e.target.value || undefined })} className={selectCls}>
            <option value="">All feelings</option>
            {groupEmotions(emotions).map(([g, list]) => (
              <optgroup key={g} label={g}>
                {list.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emoji ? `${e.emoji} ` : ''}
                    {e.label}
                    {e.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          Body area
          <select value={value.regionId ?? ''} onChange={(e) => set({ regionId: e.target.value || undefined })} className={selectCls}>
            <option value="">All areas</option>
            {(['front', 'back', 'none'] as const).map((v) => (
              <optgroup key={v} label={v === 'none' ? 'Other' : v === 'front' ? 'Front' : 'Back'}>
                {ALL_REGIONS.filter((r) => r.view === v).map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {active && (
        <button type="button" onClick={() => onChange({ range: 'all' })} className="min-h-11 self-start rounded-full px-3 text-sm text-accent underline">
          Clear filters
        </button>
      )}
    </div>
  );
}
