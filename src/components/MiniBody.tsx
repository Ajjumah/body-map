import { useMemo } from 'react';
import { useT } from '../i18n';
import { regionFills } from '../lib/fills';
import { useStore } from '../store';
import type { Entry } from '../types';
import BodyFigure from './BodyFigure';

/** Front + back side by side, read-only. */
export default function MiniBody({ entries, className = 'h-56' }: { entries: Entry[]; className?: string }) {
  const { emotionById, imageUrl } = useStore();
  const tr = useT();
  const fills = useMemo(() => regionFills(entries, emotionById, imageUrl, tr), [entries, emotionById, imageUrl, tr]);
  const whole = fills.get('whole.body');
  return (
    <div>
      <div className="flex justify-center gap-4">
        <figure className="flex flex-col items-center">
          <BodyFigure view="front" fills={fills} readOnly className={`${className} w-auto`} label={tr.t('figure.frontReadonly')} />
          <figcaption className="text-xs text-muted">{tr.t('common.front')}</figcaption>
        </figure>
        <figure className="flex flex-col items-center">
          <BodyFigure view="back" fills={fills} readOnly className={`${className} w-auto`} label={tr.t('figure.backReadonly')} />
          <figcaption className="text-xs text-muted">{tr.t('common.back')}</figcaption>
        </figure>
      </div>
      {whole && (
        <p className="mt-2 text-center text-sm text-muted">
          <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: whole.color }} aria-hidden="true" />
          {tr.t('figure.wholeBody', { desc: whole.description ?? '' })}
        </p>
      )}
    </div>
  );
}
