import type { KeyboardEvent } from 'react';
import { BACK_DECOR, orderedRegions, type View } from '../data/regions';
import type { RegionId } from '../types';
import { sparklePath } from './Icon';

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
  /** Sparkles around the figure. */
  decorate?: boolean;
};

export default function BodyFigure({ view, fills, onSelect, readOnly, showBadges = true, className, label, selected, decorate = false }: Props) {
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
      viewBox="25 2 150 436"
      className={className}
      role="group"
      aria-label={label ?? `Body, ${view} view`}
    >
      {view === 'back' &&
        BACK_DECOR.map((d, i) => (
          <path key={i} d={d} fill="var(--body-fill)" stroke="var(--body-stroke)" strokeWidth={2.2} strokeLinejoin="round" strokeOpacity={0.45} aria-hidden="true" />
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
            fill={f ? f.color : r.id === 'front.heart' ? 'var(--heart-fill)' : 'var(--body-fill)'}
            fillOpacity={f ? (f.opacity ?? 0.85) : 1}
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
      {view === 'front' && <Face />}
      {decorate && (
        <g aria-hidden="true" pointerEvents="none">
          {[[46, 60, 7], [156, 88, 5], [160, 300, 7], [40, 340, 5], [150, 20, 4]].map(([x, y, r]) => (
            <path key={`${x}-${y}`} d={sparklePath(x, y, r)} fill="var(--sparkle)" stroke="var(--body-stroke)" strokeWidth={1} strokeLinejoin="round" />
          ))}
        </g>
      )}
      {showBadges &&
        regions.map((r) => {
          const f = fills?.get(r.id);
          if (!f || (!f.emoji && !f.imageUrl && !f.text)) return null;
          const [x, y] = r.at;
          return (
            <g key={`b-${r.id}`} pointerEvents="none" aria-hidden="true">
              <circle cx={x} cy={y} r={8.5} fill="#fff" stroke="var(--body-stroke)" strokeWidth={1.6} />
              {f.text ? (
                <text x={x} y={y + 0.3} fontSize={7.5} fontWeight={800} fill="var(--c-ink)" textAnchor="middle" dominantBaseline="central">
                  {f.text}
                </text>
              ) : f.imageUrl ? (
                <image href={f.imageUrl} x={x - 7} y={y - 7} width={14} height={14} clipPath="circle(7px)" preserveAspectRatio="xMidYMid slice" />
              ) : (
                <text x={x} y={y + 0.6} fontSize={10} textAnchor="middle" dominantBaseline="central">
                  {f.emoji}
                </text>
              )}
              {f.count && f.count > 1 ? (
                <g>
                  <circle cx={x + 8} cy={y - 7} r={4.8} fill="var(--accent-2)" stroke="var(--body-stroke)" strokeWidth={1.2} />
                  <text x={x + 8} y={y - 6.6} fontSize={6} fontWeight={800} fill="var(--c-ink)" textAnchor="middle" dominantBaseline="central">
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

/** A gentle face on the front of the head. Decorative; clicks pass through to the regions. */
function Face() {
  const ink = 'var(--body-stroke)';
  return (
    <g aria-hidden="true" pointerEvents="none">
      <ellipse cx="91" cy="40" rx="2.3" ry="3" fill={ink} />
      <ellipse cx="109" cy="40" rx="2.3" ry="3" fill={ink} />
      <circle cx="91.7" cy="38.9" r="0.8" fill="#fff" />
      <circle cx="109.7" cy="38.9" r="0.8" fill="#fff" />
      <ellipse cx="84.5" cy="49" rx="3.4" ry="2" fill="#FF9DB0" fillOpacity="0.8" />
      <ellipse cx="115.5" cy="49" rx="3.4" ry="2" fill="#FF9DB0" fillOpacity="0.8" />
      <path d="M95.5 55 Q100 59 104.5 55" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    </g>
  );
}
