import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** If set, the user must type this word to enable the confirm button. */
  typeToConfirm?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({ title, children, confirmLabel, typeToConfirm, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const cancelFn = useRef(onCancel);
  cancelFn.current = onCancel;
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && cancelFn.current();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const ok = !typeToConfirm || typed.trim().toUpperCase() === typeToConfirm.toUpperCase();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-body" className="relative w-full max-w-sm rounded-3xl bg-surface p-5 shadow-xl">
        <h2 id="cd-title" className="mb-2 text-lg font-semibold text-ink">{title}</h2>
        <div id="cd-body" className="mb-4 text-ink">{children}</div>
        {typeToConfirm && (
          <label className="mb-4 block text-sm text-muted">
            Type <strong className="text-ink">{typeToConfirm}</strong> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink" />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="min-h-11 rounded-full px-4 text-ink hover:bg-surface-2">
            Cancel
          </button>
          <button type="button" disabled={!ok} onClick={onConfirm} className="min-h-11 rounded-full bg-warn px-4 font-semibold text-white disabled:opacity-40 dark:text-black">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
