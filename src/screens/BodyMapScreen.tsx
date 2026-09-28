import { useMemo, useState, type ReactNode } from 'react';
import BodyFigure from '../components/BodyFigure';
import Buddy from '../components/Buddy';
import CheckInSheet from '../components/CheckInSheet';
import EntryList from '../components/EntryList';
import Icon from '../components/Icon';
import RegionList from '../components/RegionList';
import SessionSummary from '../components/SessionSummary';
import { regionView, type View } from '../data/regions';
import { useT } from '../i18n';
import { regionFills } from '../lib/fills';
import { useWorld } from '../lib/useWorld';
import { useStore, type EntryDraft } from '../store';
import type { RegionId } from '../types';

export default function BodyMapScreen() {
  const { currentEntries, emotionById, addEntry, removeEntry, finishSession, imageUrl } = useStore();
  const [summaryId, setSummaryId] = useState<string | null>(null);
  const [view, setView] = useState<View>('front');
  const [listMode, setListMode] = useState(false);
  const [open, setOpen] = useState<RegionId | null>(null);
  const [toast, setToast] = useState('');
  const world = useWorld();
  const tr = useT();
  const { t } = tr;

  const fills = useMemo(() => regionFills(currentEntries, emotionById, imageUrl, tr), [currentEntries, emotionById, imageUrl, tr]);
  const wholeBody = currentEntries.filter((e) => e.regionId === 'whole.body');
  const otherSide = currentEntries.filter((e) => regionView(e.regionId) === (view === 'front' ? 'back' : 'front')).length;

  const save = async (d: EntryDraft) => {
    await addEntry(d);
    setOpen(null);
    setToast(t('map.keptSafe', { region: tr.region(d.regionId) }));
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
    <section aria-label={t('map.label')} className="flex flex-col items-center gap-3">
      <div className="flex w-full items-center gap-3">
        <Buddy world={world} size={64} className="bob shrink-0" />
        <SpeechBubble>
          {t(currentEntries.length ? 'map.greetingMore' : 'map.greeting')}
        </SpeechBubble>
      </div>
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <Segmented value={view} onChange={setView} options={[['front', t('common.front')], ['back', t('common.back')]]} label={t('common.bodySide')} />
        <button type="button" onClick={() => setListMode((v) => !v)} aria-pressed={listMode} className="btn">
          <Icon name={listMode ? 'figure' : 'list'} size={18} />
          {t(listMode ? 'map.figure' : 'map.list')}
        </button>
      </div>
      {otherSide > 0 && (
        <p className="text-sm text-muted">
          {tr.tn('map.otherSide', otherSide, { side: t(view === 'front' ? 'map.sideBack' : 'map.sideFront') })}
        </p>
      )}
      {listMode ? (
        <div className="w-full"><RegionList view={view} fills={fills} onSelect={setOpen} /></div>
      ) : (
        <>
          <BodyFigure
            view={view}
            fills={fills}
            onSelect={setOpen}
            decorate
            className={`w-auto max-w-full ${currentEntries.length ? 'h-[calc(100dvh-29.5rem)] min-h-[250px]' : 'h-[calc(100dvh-24rem)] min-h-[300px]'} max-h-[620px]`}
          />
          <button type="button" onClick={() => setOpen('whole.body')} className="btn">
            <Icon name="sparkle" size={18} />
            {t('map.allOver')}
            {wholeBody.length > 0 && (
              <span className="rounded-full border-2 border-outline bg-accent-2 px-2 text-sm">
                <span aria-hidden="true">{wholeBody.length}</span>
                <span className="sr-only">{tr.tn('map.feelings', wholeBody.length)}</span>
              </span>
            )}
          </button>
        </>
      )}
      <div aria-live="polite" className="min-h-5 text-sm font-bold text-muted">{toast}</div>
      {currentEntries.length > 0 && (
        <div className="z-20 w-full max-w-sm [@media(min-height:640px)]:sticky [@media(min-height:640px)]:bottom-28">
          <button type="button" onClick={finish} className="btn btn-primary btn-big w-full">
            {t('map.done', { n: currentEntries.length })}
          </button>
        </div>
      )}
      {currentEntries.length > 0 && (
        <details className="w-full">
          <summary className="flex min-h-11 cursor-pointer items-center font-bold text-muted">{t('map.sharedSoFar')}</summary>
          <EntryList entries={currentEntries} onRemove={removeEntry} />
        </details>
      )}
      {open && <CheckInSheet regionId={open} onSave={save} onClose={() => setOpen(null)} />}
    </section>
  );
}

export function SpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div className="card on-surface relative flex-1 px-4 py-2.5 text-[1.05rem] leading-snug">
      <span aria-hidden="true" className="absolute top-1/2 -left-[11px] size-4 -translate-y-1/2 rotate-45 border-b-3 border-l-3 border-outline bg-surface" />
      <span className="relative">{children}</span>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="card on-surface inline-flex flex-wrap gap-0.5 rounded-full p-1 shadow-[0_4px_0_var(--shadow)]">
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 min-w-16 rounded-full border-3 px-3.5 text-[0.95rem] font-bold text-ink ${value === v ? 'border-outline bg-accent-2' : 'border-transparent'}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
