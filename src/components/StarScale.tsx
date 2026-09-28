import { useT } from '../i18n';
import { sparklePath } from './Icon';

/** 1–10 picker drawn as stars over a real (invisible) range input, so keyboard and screen readers work as usual. */
export default function StarScale({ id, value, onChange, low, high }: { id: string; value: number; onChange: (n: number) => void; low: string; high: string }) {
  const { t } = useT();
  return (
    <div>
      <div className="relative flex h-11 items-center justify-between rounded-2xl px-0.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring-inner)]">
        {Array.from({ length: 10 }, (_, i) => (
          <svg key={i} width="26" height="26" viewBox="0 0 24 24" aria-hidden="true" className={i < value ? 'pop' : undefined}>
            <path d={sparklePath(12, 12, 10.5)} fill={i < value ? 'var(--sparkle)' : 'var(--surface-2)'} stroke="var(--outline)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        ))}
        <input
          id={id}
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-valuetext={t('common.outOf10', { n: value })}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function ScaleValue({ value }: { value: number }) {
  return (
    <span aria-hidden="true" className="flex h-9 min-w-11 items-center justify-center rounded-xl border-3 border-outline bg-accent-2 font-display text-2xl text-ink">
      {value}
    </span>
  );
}
