import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '../i18n';
import { useWorld } from '../lib/useWorld';
import Buddy from './Buddy';
import Icon from './Icon';

/** Bottom sheet on mobile, side panel on desktop. */
export default function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const world = useWorld();
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, select, [tabindex="0"]');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center md:justify-end md:p-4">
      <div className="absolute inset-0 bg-[#150f33]/45" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="card sheet-in relative mx-2 mt-10 flex max-h-[86dvh] w-full flex-col rounded-b-none border-b-0 outline-none md:mx-0 md:mt-0 md:max-h-[94dvh] md:w-[460px] md:rounded-b-[var(--radius)] md:border-b-3"
      >
        <div className="pointer-events-none absolute -top-6 left-1/2 flex max-w-[80%] -translate-x-1/2 items-center gap-2 rounded-full border-3 border-outline bg-accent-2 py-1 pr-5 pl-1.5 shadow-[0_4px_0_var(--shadow)]">
          <Buddy world={world} size={34} />
          <h2 className="truncate text-xl text-ink">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className="btn btn-icon absolute top-2.5 right-2.5 z-10" aria-label={t('common.close')}>
          <Icon name="close" size={18} stroke={2.8} />
        </button>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-9 pb-4">{children}</div>
        {footer && <div className="border-t-3 border-dashed border-line px-4 py-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}
