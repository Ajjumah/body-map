import { useMemo, useState } from 'react';
import BodyFigure, { type RegionFill } from '../components/BodyFigure';
import EmotionIcon from '../components/EmotionIcon';
import Icon from '../components/Icon';
import { regionView, type View } from '../data/regions';
import { useT } from '../i18n';
import { avg, regionCounts, topEmotions, topSensations } from '../lib/insights';
import { useStore } from '../store';
import type { Entry, RegionId } from '../types';
import { Segmented } from './BodyMapScreen';
import IntensityChart from './IntensityChart';

export default function Heatmap({ entries }: { entries: Entry[] }) {
  const { emotionById } = useStore();
  const tr = useT();
  const { t } = tr;
  const [view, setView] = useState<View>('front');
  const [selected, setSelected] = useState<RegionId | null>(null);
  const counts = useMemo(() => regionCounts(entries), [entries]);
  const max = Math.max(1, ...counts.values());

  const fills = useMemo(() => {
    const m = new Map<RegionId, RegionFill>();
    for (const [id, n] of counts) {
      m.set(id, {
        color: 'var(--accent)',
        opacity: 0.15 + 0.7 * (n / max),
        text: String(n),
        description: tr.tn('heat.logged', n),
      });
    }
    return m;
  }, [counts, max, tr]);

  const selectedEntries = selected ? entries.filter((e) => e.regionId === selected) : [];
  const ranked = [...counts].slice(0, 8);
  const top3 = topEmotions(entries);
  const whole = counts.get('whole.body') ?? 0;

  const select = (id: RegionId) => {
    setSelected((cur) => (cur === id ? null : id));
    const v = regionView(id);
    if (v !== 'none') setView(v);
  };

  if (!entries.length) return <p className="py-8 text-center text-muted">{t('heat.empty')}</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col items-center gap-2 card p-4">
          <div className="flex w-full items-center justify-between">
            <h3 className="text-xl text-ink">{t('heat.where')}</h3>
            <Segmented value={view} onChange={setView} options={[['front', t('common.front')], ['back', t('common.back')]]} label={t('common.bodySide')} />
          </div>
          <BodyFigure view={view} fills={fills} onSelect={select} selected={selected} className="h-80 w-auto md:h-[28rem]" label={t('heat.label', { side: t(view === 'front' ? 'map.sideFront' : 'map.sideBack') })} />
          <button
            type="button"
            onClick={() => select('whole.body')}
            aria-pressed={selected === 'whole.body'}
            className={`btn ${selected === 'whole.body' ? 'btn-fun' : ''}`}
          >
            <Icon name="sparkle" size={16} /> {t('heat.allOver', { n: whole })}
          </button>
          <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
            <span>{t('heat.less')}</span>
            <span className="h-2.5 w-24 rounded-full" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--accent) 15%, transparent), var(--accent))' }} />
            <span>{t('heat.more')}</span>
          </div>
          <p className="text-xs text-muted">{t('heat.numbers')}</p>
        </div>

        <div className="flex flex-col gap-4">
          {selected ? (
            <RegionDetail regionId={selected} entries={selectedEntries} onClose={() => setSelected(null)} />
          ) : (
            <div className="card p-4">
              <h3 className="mb-2 text-xl text-ink">{t('heat.mostVisited')}</h3>
              <ol className="flex flex-col gap-1">
                {ranked.map(([id, n]) => (
                  <li key={id}>
                    <button type="button" onClick={() => select(id)} className="flex min-h-11 w-full items-center justify-between rounded-xl px-2 text-left text-ink hover:bg-surface-2">
                      <span>{tr.region(id)}</span>
                      <span className="text-sm text-muted">{t('common.times', { n })}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="card p-4">
            <h3 className="mb-2 text-xl text-ink">{t('heat.topFeelings')}</h3>
            <ol className="flex flex-col gap-2">
              {top3.map(([id, n], i) => {
                const e = emotionById.get(id);
                return (
                  <li key={id} className="flex items-center gap-3">
                    <span className="w-4 text-sm text-muted">{i + 1}.</span>
                    <span className="flex size-9 items-center justify-center rounded-full border-2 border-outline" style={{ background: e?.color }}>
                      <EmotionIcon emotion={e} size={20} />
                    </span>
                    <span className="flex-1 text-ink">{tr.emotion(e)}</span>
                    <span className="text-sm text-muted">{t('common.times', { n })}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xl text-ink">{t('heat.overTime')}</h3>
          <span className="text-sm text-muted">{t('heat.overallAvg', { n: avg(entries.map((e) => e.intensity)).toFixed(1) })}</span>
        </div>
        <IntensityChart entries={entries} />
      </div>
    </div>
  );
}

function RegionDetail({ regionId, entries, onClose }: { regionId: RegionId; entries: Entry[]; onClose: () => void }) {
  const { emotionById } = useStore();
  const tr = useT();
  const { t } = tr;
  const emos = topEmotions(entries, 5);
  const sens = topSensations(entries, 5);
  return (
    <div className="card p-4" aria-live="polite">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl text-ink">{tr.region(regionId)}</h3>
          <p className="text-sm text-muted">
            {entries.length ? tr.tn('heat.detail', entries.length, { avg: avg(entries.map((e) => e.intensity)).toFixed(1) }) : t('heat.notLogged')}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn btn-icon" aria-label={t('heat.closeDetail')}><Icon name="close" size={16} stroke={2.8} /></button>
      </div>
      {emos.length > 0 && (
        <>
          <h4 className="mt-3 mb-1 text-sm font-bold text-muted">{t('heat.commonFeelings')}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {emos.map(([id, n]) => {
              const e = emotionById.get(id);
              return (
                <li key={id} className="flex items-center gap-1 rounded-full border-[2.5px] border-outline py-0.5 pr-3 pl-1.5 text-sm font-bold text-[var(--c-ink)]" style={{ background: e?.color ?? '#d9d3e6' }}>
                  <EmotionIcon emotion={e} size={16} /> {tr.emotion(e)} · {n}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <h4 className="mt-3 mb-1 text-sm font-bold text-muted">{t('heat.commonSensations')}</h4>
      {sens.length ? (
        <p className="text-ink">{sens.map(([s, n]) => `${tr.sensation(s)} (${n})`).join(', ')}</p>
      ) : (
        <p className="text-muted">{t('heat.none')}</p>
      )}
    </div>
  );
}
