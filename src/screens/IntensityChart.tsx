import { useEffect, useRef, useState } from 'react';
import { dailyIntensity } from '../lib/insights';
import type { Entry } from '../types';

type Point = { key: string; label: string; avg: number; n: number };

function weekKey(day: string) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}
const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export function intensitySeries(entries: Entry[]): { points: Point[]; weekly: boolean } {
  const daily = dailyIntensity(entries);
  if (daily.length <= 45) return { points: daily.map((d) => ({ key: d.day, label: short(d.day), avg: d.avg, n: d.n })), weekly: false };
  const m = new Map<string, { sum: number; n: number }>();
  for (const d of daily) {
    const k = weekKey(d.day);
    const cur = m.get(k) ?? { sum: 0, n: 0 };
    cur.sum += d.avg * d.n;
    cur.n += d.n;
    m.set(k, cur);
  }
  return { points: [...m].map(([k, v]) => ({ key: k, label: `wk of ${short(k)}`, avg: v.sum / v.n, n: v.n })), weekly: true };
}

/** Single-series bar chart of average intensity (1–10). */
export default function IntensityChart({ entries }: { entries: Entry[] }) {
  const { points, weekly } = intensitySeries(entries);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(320);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [points.length > 0]);
  if (points.length === 0) return <p className="text-muted">No entries in this period.</p>;

  const H = 180, padL = 26, padB = 22, padT = 10;
  const plotW = W - padL - 4, plotH = H - padB - padT;
  const step = plotW / points.length;
  const barW = Math.max(2, Math.min(24, step - 2));
  const y = (v: number) => padT + plotH - (v / 10) * plotH;
  const labelEvery = Math.ceil(points.length / Math.max(3, Math.floor(W / 70)));
  const h = hover !== null ? points[hover] : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-1 text-sm text-muted">Average intensity per {weekly ? 'week' : 'day'} (1–10)</figcaption>
      <div className="relative" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block w-full" role="img" aria-label={`Bar chart of average intensity per ${weekly ? 'week' : 'day'}. ${points.length} bars. Table view below.`} onMouseLeave={() => setHover(null)}>
          {[0, 5, 10].map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - 4} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1 : 0.5} />
              <text x={padL - 4} y={y(v)} fontSize={11} fill="var(--muted)" textAnchor="end" dominantBaseline="central">{v}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = padL + step * i + step / 2;
            const top = y(p.avg), base = y(0);
            const r = Math.min(4, barW / 2, base - top);
            return (
              <g key={p.key}>
                <path
                  d={`M${cx - barW / 2} ${base} V${top + r} Q${cx - barW / 2} ${top} ${cx - barW / 2 + r} ${top} H${cx + barW / 2 - r} Q${cx + barW / 2} ${top} ${cx + barW / 2} ${top + r} V${base} Z`}
                  fill="var(--accent)"
                  opacity={hover === null || hover === i ? 1 : 0.45}
                />
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 6} fontSize={11} fill="var(--muted)" textAnchor="middle">{p.label}</text>
                )}
                {/* Hit target: the full column. */}
                <rect x={padL + step * i} y={padT} width={step} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink shadow"
            style={{ left: `${((padL + step * hover + step / 2) / W) * 100}%`, transform: `translateX(${hover > points.length / 2 ? '-100%' : '0'})` }}
          >
            <strong>{h.label}</strong>: avg {h.avg.toFixed(1)} · {h.n} {h.n === 1 ? 'entry' : 'entries'}
          </div>
        )}
      </div>
      <details className="mt-1">
        <summary className="min-h-11 cursor-pointer text-sm text-muted">Show as table</summary>
        <table className="w-full text-left text-sm text-ink">
          <thead>
            <tr className="text-muted"><th className="py-1 font-normal">{weekly ? 'Week' : 'Day'}</th><th className="font-normal">Avg intensity</th><th className="font-normal">Entries</th></tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.key} className="border-t border-line"><td className="py-1">{p.label}</td><td>{p.avg.toFixed(1)}</td><td>{p.n}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
