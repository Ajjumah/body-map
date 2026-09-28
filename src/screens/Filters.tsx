import { groupEmotions } from '../data/emotions';
import { ALL_REGIONS } from '../data/regions';
import { useT } from '../i18n';
import type { Filters as F, Range } from '../lib/insights';
import { useStore } from '../store';
import { Segmented } from './BodyMapScreen';

const selectCls = 'field mt-1';

export default function Filters({ value, onChange }: { value: F; onChange: (f: F) => void }) {
  const { emotions } = useStore();
  const tr = useT();
  const { t } = tr;
  const set = (patch: Partial<F>) => onChange({ ...value, ...patch });
  const active = value.emotionId || value.regionId || value.range !== 'all';
  return (
    <div className="card flex flex-col gap-2 p-3" role="group" aria-label={t('filters.label')}>
      <Segmented<Range>
        value={value.range}
        onChange={(range) => set({ range })}
        label={t('filters.range')}
        options={[['7', t('filters.7')], ['30', t('filters.30')], ['all', t('filters.all')], ['custom', t('filters.custom')]]}
      />
      {value.range === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm text-muted">
            {t('filters.from')}
            <input type="date" value={value.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined })} className={selectCls} />
          </label>
          <label className="text-sm text-muted">
            {t('filters.to')}
            <input type="date" value={value.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined })} className={selectCls} />
          </label>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-sm text-muted">
          {t('filters.feeling')}
          <select value={value.emotionId ?? ''} onChange={(e) => set({ emotionId: e.target.value || undefined })} className={selectCls}>
            <option value="">{t('filters.allFeelings')}</option>
            {groupEmotions(emotions).map(([g, list]) => (
              <optgroup key={g} label={tr.group(g)}>
                {list.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.emoji ? `${e.emoji} ` : ''}
                    {tr.emotion(e)}
                    {e.archived ? ` ${t('filters.archived')}` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          {t('filters.area')}
          <select value={value.regionId ?? ''} onChange={(e) => set({ regionId: e.target.value || undefined })} className={selectCls}>
            <option value="">{t('filters.allAreas')}</option>
            {(['front', 'back', 'none'] as const).map((v) => (
              <optgroup key={v} label={t(v === 'none' ? 'filters.other' : v === 'front' ? 'common.front' : 'common.back')}>
                {ALL_REGIONS.filter((r) => r.view === v).map((r) => (
                  <option key={r.id} value={r.id}>{tr.region(r.id)}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      {active && (
        <button type="button" onClick={() => onChange({ range: 'all' })} className="min-h-11 self-start rounded-full px-3 text-sm font-bold text-ink underline">
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
}
