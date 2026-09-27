import type { KeyboardEvent } from 'react';
import { BACK_DECOR, orderedRegions, type View } from '../data/regions';
import type { RegionId } from '../types';

export type RegionFill = {
  color: string;
  /** 0–1 fill opacity */
  opacity?: number;
  emoji?: string;
  imageUrl?: string;
  /** Number of distinct emotions; shown as a count badge when > 1. */
  count?: number;
  /** Short text badge (e.g. a count), used instead of an emoji. */
  text?: string;
  /** Extra text for screen readers, e.g. "2 entries: Anxious, Sad". */
  description?: string;
};

type Props = {
  view: View;
  fills?: Map<RegionId, RegionFill>;
  onSelect?: (id: RegionId) => void;
  readOnly?: boolean;
  /** Hide badges (e.g. heatmap). */
  showBadges?: boolean;
  className?: string;
  label?: string;
  selected?: RegionId | null;
};

export default function BodyFigure({ view, fills, onSelect, readOnly, showBadges = true, className, label, selected }: Props) {
  const regions = orderedRegions(view);
  const interactive = !!onSelect;

  const onKey = (e: KeyboardEvent, id: RegionId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(id);
    }
  };

  return (
    <svg
      viewBox="30 4 140 430"
      className={className}
      role="group"
      aria-label={label ?? `Body, ${view} view`}
    >
      {view === 'back' &&
        BACK_DECOR.map((d, i) => (
          <path key={i} d={d} fill="var(--body-fill)" stroke="var(--body-stroke)" strokeWidth={1.2} strokeDasharray="3 3" aria-hidden="true" />
        ))}
      {regions.map((r) => {
        const f = fills?.get(r.id);
        return (
          <path
            key={r.id}
            id={r.id}
            data-region={r.id}
            d={r.d}
            fillRule={r.fillRule}
            className={`region${readOnly || !interactive ? ' readonly' : ''}${selected === r.id ? ' selected' : ''}`}
            aria-pressed={interactive && selected !== undefined ? selected === r.id : undefined}
            fill={f ? f.color : 'var(--body-fill)'}
            fillOpacity={f ? (f.opacity ?? 0.55) : 1}
            {...(interactive
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': f?.description ? `${r.label}. ${f.description}` : r.label,
                  onClick: () => onSelect!(r.id),
                  onKeyDown: (e: KeyboardEvent) => onKey(e, r.id),
                }
              : { 'aria-hidden': true })}
          >
            <title>{r.label}</title>
          </path>
        );
      })}
      {showBadges &&
        regions.map((r) => {
          const f = fills?.get(r.id);
          if (!f || (!f.emoji && !f.imageUrl && !f.text)) return null;
          const [x, y] = r.at;
          return (
            <g key={`b-${r.id}`} pointerEvents="none" aria-hidden="true">
              <circle cx={x} cy={y} r={7.5} fill="var(--surface)" stroke={f.color} strokeWidth={1.5} />
              {f.text ? (
                <text x={x} y={y + 0.3} fontSize={7} fontWeight={700} fill="var(--ink)" textAnchor="middle" dominantBaseline="central">
                  {f.text}
                </text>
              ) : f.imageUrl ? (
                <image href={f.imageUrl} x={x - 6} y={y - 6} width={12} height={12} clipPath="circle(6px)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text x={x} y={y + 0.5} fontSize={9} textAnchor="middle" dominantBaseline="central">
                  {f.emoji}
                </text>
              )}
              {f.count && f.count > 1 ? (
                <g>
                  <circle cx={x + 7} cy={y - 6} r={4.2} fill="var(--accent)" />
                  <text x={x + 7} y={y - 5.7} fontSize={5.5} fontWeight={700} fill="var(--accent-ink)" textAnchor="middle" dominantBaseline="central">
                    {f.count}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
    </svg>
  );
}
