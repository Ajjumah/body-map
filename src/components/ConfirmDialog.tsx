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
      <div className="absolute inset-0 bg-[#150f33]/45" onClick={onCancel} aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="cd-title" aria-describedby="cd-body" className="card sheet-in relative w-full max-w-sm p-5">
        <h2 id="cd-title" className="mb-2 text-2xl text-ink">{title}</h2>
        <div id="cd-body" className="mb-4 text-ink">{children}</div>
        {typeToConfirm && (
          <label className="mb-4 block text-sm text-muted">
            Type <strong className="text-ink">{typeToConfirm}</strong> to confirm
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className="field mt-1" />
          </label>
        )}
        <div className="flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className="btn">
            Cancel
          </button>
          <button type="button" disabled={!ok} onClick={onConfirm} className="btn btn-danger">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
