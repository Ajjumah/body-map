import { useMemo, useState } from 'react';
import BodyFigure, { type RegionFill } from '../components/BodyFigure';
import EmotionIcon from '../components/EmotionIcon';
import { regionLabel, regionView, type View } from '../data/regions';
import { avg, regionCounts, topEmotions, topSensations } from '../lib/insights';
import { useStore } from '../store';
import type { Entry, RegionId } from '../types';
import { Segmented } from './BodyMapScreen';
import IntensityChart from './IntensityChart';

export default function Heatmap({ entries }: { entries: Entry[] }) {
  const { emotionById } = useStore();
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
        description: `logged ${n} ${n === 1 ? 'time' : 'times'}`,
      });
    }
    return m;
  }, [counts, max]);

  const selectedEntries = selected ? entries.filter((e) => e.regionId === selected) : [];
  const ranked = [...counts].slice(0, 8);
  const top3 = topEmotions(entries);
  const whole = counts.get('whole.body') ?? 0;

  const select = (id: RegionId) => {
    setSelected((cur) => (cur === id ? null : id));
    const v = regionView(id);
    if (v !== 'none') setView(v);
  };

  if (!entries.length) return <p className="py-8 text-center text-muted">No entries match these filters yet.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-line bg-surface p-4">
          <div className="flex w-full items-center justify-between">
            <h3 className="font-semibold text-ink">Where feelings show up</h3>
            <Segmented value={view} onChange={setView} options={[['front', 'Front'], ['back', 'Back']]} label="Body side" />
          </div>
          <BodyFigure view={view} fills={fills} onSelect={select} selected={selected} className="h-80 w-auto md:h-[28rem]" label={`Heatmap, ${view} view`} />
          <button
            type="button"
            onClick={() => select('whole.body')}
            aria-pressed={selected === 'whole.body'}
            className={`min-h-11 rounded-full border px-4 text-sm text-ink ${selected === 'whole.body' ? 'border-ink' : 'border-line'}`}
          >
            🌐 Whole body · {whole}
          </button>
          <div className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
            <span>Less often</span>
            <span className="h-2.5 w-24 rounded-full" style={{ background: 'linear-gradient(to right, color-mix(in srgb, var(--accent) 15%, transparent), var(--accent))' }} />
            <span>More often</span>
          </div>
          <p className="text-xs text-muted">Numbers show how many times each area was logged.</p>
        </div>

        <div className="flex flex-col gap-4">
          {selected ? (
            <RegionDetail regionId={selected} entries={selectedEntries} onClose={() => setSelected(null)} />
          ) : (
            <div className="rounded-3xl border border-line bg-surface p-4">
              <h3 className="mb-2 font-semibold text-ink">Most logged areas</h3>
              <ol className="flex flex-col gap-1">
                {ranked.map(([id, n]) => (
                  <li key={id}>
                    <button type="button" onClick={() => select(id)} className="flex min-h-11 w-full items-center justify-between rounded-xl px-2 text-left text-ink hover:bg-surface-2">
                      <span>{regionLabel(id)}</span>
                      <span className="text-sm text-muted">{n}×</span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="rounded-3xl border border-line bg-surface p-4">
            <h3 className="mb-2 font-semibold text-ink">Top feelings</h3>
            <ol className="flex flex-col gap-2">
              {top3.map(([id, n], i) => {
                const e = emotionById.get(id);
                return (
                  <li key={id} className="flex items-center gap-3">
                    <span className="w-4 text-sm text-muted">{i + 1}.</span>
                    <span className="flex size-9 items-center justify-center rounded-full border-2" style={{ borderColor: e?.color }}>
                      <EmotionIcon emotion={e} size={20} />
                    </span>
                    <span className="flex-1 text-ink">{e?.label ?? 'Unknown feeling'}</span>
                    <span className="text-sm text-muted">{n}×</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-surface p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-semibold text-ink">Intensity over time</h3>
          <span className="text-sm text-muted">overall avg {avg(entries.map((e) => e.intensity)).toFixed(1)}</span>
        </div>
        <IntensityChart entries={entries} />
      </div>
    </div>
  );
}

function RegionDetail({ regionId, entries, onClose }: { regionId: RegionId; entries: Entry[]; onClose: () => void }) {
  const { emotionById } = useStore();
  const emos = topEmotions(entries, 5);
  const sens = topSensations(entries, 5);
  return (
    <div className="rounded-3xl border border-line bg-surface p-4" aria-live="polite">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-ink">{regionLabel(regionId)}</h3>
          <p className="text-sm text-muted">
            {entries.length ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · avg intensity ${avg(entries.map((e) => e.intensity)).toFixed(1)}` : 'Not logged in this period.'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="size-11 rounded-full text-xl text-muted hover:bg-surface-2" aria-label="Close area details">×</button>
      </div>
      {emos.length > 0 && (
        <>
          <h4 className="mt-3 mb-1 text-sm font-semibold text-muted">Most common feelings</h4>
          <ul className="flex flex-wrap gap-1.5">
            {emos.map(([id, n]) => {
              const e = emotionById.get(id);
              return (
                <li key={id} className="flex items-center gap-1 rounded-full px-2.5 py-1 text-sm text-ink" style={{ background: `${e?.color ?? '#b3aca3'}33` }}>
                  <EmotionIcon emotion={e} size={16} /> {e?.label ?? 'Unknown'} · {n}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <h4 className="mt-3 mb-1 text-sm font-semibold text-muted">Most common sensations</h4>
      {sens.length ? (
        <p className="text-ink">{sens.map(([s, n]) => `${s} (${n})`).join(', ')}</p>
      ) : (
        <p className="text-muted">None noted.</p>
      )}
    </div>
  );
}
