import { useMemo, useState } from 'react';
import BodyFigure from '../components/BodyFigure';
import CheckInSheet from '../components/CheckInSheet';
import EntryList from '../components/EntryList';
import RegionList from '../components/RegionList';
import SessionSummary from '../components/SessionSummary';
import { regionLabel, regionView, type View } from '../data/regions';
import { regionFills } from '../lib/fills';
import { useStore, type EntryDraft } from '../store';
import type { RegionId } from '../types';

export default function BodyMapScreen() {
  const { currentEntries, emotionById, addEntry, removeEntry, finishSession, imageUrl } = useStore();
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [view, setView] = useState<View>('front');
  const [listMode, setListMode] = useState(false);
  const [open, setOpen] = useState<RegionId | null>(null);
  const [toast, setToast] = useState('');

  const fills = useMemo(() => regionFills(currentEntries, emotionById, imageUrl), [currentEntries, emotionById, imageUrl]);
  const wholeBody = currentEntries.filter((e) => e.regionId === 'whole.body');
  const otherSide = currentEntries.filter((e) => regionView(e.regionId) === (view === 'front' ? 'back' : 'front')).length;

  const save = async (d: EntryDraft) => {
    await addEntry(d);
    setOpen(null);
    setToast(`Saved: ${regionLabel(d.regionId)}`);
    setTimeout(() => setToast(''), 2500);
  };

  const finish = async () => {
    const s = await finishSession();
    if (s) {
      setSummaryId(s.id);
      window.scrollTo(0, 0);
    }
  };

  if (summaryId) return <SessionSummary sessionId={summaryId} onDone={() => setSummaryId(null)} />;

  return (
    <section aria-label="Body map" className="flex flex-col items-center gap-3">
      <p className="w-full text-muted">Tap where you notice something.</p>
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Segmented value={view} onChange={setView} options={[['front', 'Front'], ['back', `Back`]]} label="Body side" />
        <button type="button" onClick={() => setListMode((v) => !v)} aria-pressed={listMode} className="min-h-11 rounded-full border border-line px-4 text-sm text-ink">
          {listMode ? 'Show figure' : 'List view'}
        </button>
      </div>
      {otherSide > 0 && (
        <p className="text-sm text-muted">
          {otherSide} {otherSide === 1 ? 'entry' : 'entries'} on the {view === 'front' ? 'back' : 'front'}
        </p>
      )}
      {listMode ? (
        <div className="w-full"><RegionList view={view} fills={fills} onSelect={setOpen} /></div>
      ) : (
        <>
          <button type="button" onClick={() => setOpen('whole.body')} className="min-h-11 rounded-full border border-line bg-surface px-5 text-ink">
            🌐 Whole body / everywhere
            {wholeBody.length > 0 && (
              <span className="ml-2 rounded-full bg-accent-soft px-2 text-sm">
                {wholeBody.length}
                <span className="sr-only"> {wholeBody.length === 1 ? 'entry' : 'entries'}</span>
              </span>
            )}
          </button>
          <BodyFigure
            view={view}
            fills={fills}
            onSelect={setOpen}
            className={`w-auto max-w-full ${currentEntries.length ? 'h-[calc(100dvh-22rem)]' : 'h-[calc(100dvh-18rem)]'} min-h-[340px] max-h-[640px]`}
          />
        </>
      )}
      <div aria-live="polite" className="min-h-5 text-sm text-muted">{toast}</div>
      {currentEntries.length > 0 && (
        <div className="sticky bottom-20 z-20 w-full max-w-sm">
          <button type="button" onClick={finish} className="min-h-12 w-full rounded-full bg-accent font-semibold text-accent-ink shadow-lg">
            Finish check-in ({currentEntries.length})
          </button>
        </div>
      )}
      {currentEntries.length > 0 && (
        <details className="w-full">
          <summary className="flex min-h-11 cursor-pointer items-center text-muted">This check-in so far</summary>
          <EntryList entries={currentEntries} onRemove={removeEntry} />
        </details>
      )}
      {open && <CheckInSheet regionId={open} onSave={save} onClose={() => setOpen(null)} />}
    </section>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-surface-2 p-1">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 min-w-16 rounded-full px-4 text-sm ${value === v ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
