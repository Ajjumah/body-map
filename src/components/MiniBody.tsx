import { useMemo } from 'react';
import { regionFills } from '../lib/fills';
import { useStore } from '../store';
import type { Entry } from '../types';
import BodyFigure from './BodyFigure';

/** Front + back side by side, read-only. */
export default function MiniBody({ entries, className = 'h-56' }: { entries: Entry[]; className?: string }) {
  const { emotionById, imageUrl } = useStore();
  const fills = useMemo(() => regionFills(entries, emotionById, imageUrl), [entries, emotionById, imageUrl]);
  const whole = fills.get('whole.body');
  return (
    <div>
      <div className="flex justify-center gap-4">
        <figure className="flex flex-col items-center">
          <BodyFigure view="front" fills={fills} readOnly className={`${className} w-auto`} label="Front of body, read-only" />
          <figcaption className="text-xs text-muted">Front</figcaption>
        </figure>
        <figure className="flex flex-col items-center">
          <BodyFigure view="back" fills={fills} readOnly className={`${className} w-auto`} label="Back of body, read-only" />
          <figcaption className="text-xs text-muted">Back</figcaption>
        </figure>
      </div>
      {whole && (
        <p className="mt-2 text-center text-sm text-muted">
          <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: whole.color }} aria-hidden="true" />
          Whole body: {whole.description}
        </p>
      )}
    </div>
  );
}
