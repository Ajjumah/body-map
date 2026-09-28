import { useEffect, useRef } from 'react';
import { useT } from '../i18n';

/** Numeric PIN entry: a real input (for keyboards/screen readers) plus a large on-screen keypad. */
export default function PinPad({ value, onChange, onSubmit, label, disabled }: { value: string; onChange: (v: string) => void; onSubmit: () => void; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const { t } = useT();
  useEffect(() => ref.current?.focus(), []);
  const press = (d: string) => value.length < 6 && onChange(value + d);
  const key = 'btn size-16 p-0 font-display text-3xl';
  return (
    <form
      className="flex flex-col items-center gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="flex flex-col items-center gap-2 text-ink">
        <span>{label}</span>
        <input
          ref={ref}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d*"
          maxLength={6}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="field w-48 text-center text-2xl tracking-[0.5em]"
        />
      </label>
      <div className="grid grid-cols-3 gap-3" aria-hidden="true">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" tabIndex={-1} disabled={disabled} className={key} onClick={() => press(d)}>{d}</button>
        ))}
        <button type="button" tabIndex={-1} disabled={disabled} className={`${key} text-xl`} onClick={() => onChange(value.slice(0, -1))}>⌫</button>
        <button type="button" tabIndex={-1} disabled={disabled} className={key} onClick={() => press('0')}>0</button>
        <button type="submit" tabIndex={-1} disabled={disabled || value.length < 4} className={`${key} btn-primary`}>✓</button>
      </div>
      <button type="submit" disabled={disabled || value.length < 4} className="sr-only">{t('pin.submit')}</button>
    </form>
  );
}
