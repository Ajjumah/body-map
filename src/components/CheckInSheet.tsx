import { useState } from 'react';
import { groupEmotions, SENSATIONS } from '../data/emotions';
import { regionLabel } from '../data/regions';
import { useStore, type EntryDraft } from '../store';
import type { RegionId } from '../types';
import EmotionIcon from './EmotionIcon';
import Sheet from './Sheet';

type Props = { regionId: RegionId; onSave: (d: EntryDraft) => void; onClose: () => void };

export default function CheckInSheet({ regionId, onSave, onClose }: Props) {
  const { emotions } = useStore();
  const [emotionIds, setEmotionIds] = useState<string[]>([]);
  const [sensations, setSensations] = useState<string[]>([]);
  const [intensity, setIntensity] = useState(5);
  const [note, setNote] = useState('');

  const toggle = (set: (fn: (list: string[]) => string[]) => void, v: string) => set((list) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]));
  const active = emotions.filter((e) => !e.archived);
  const canSave = emotionIds.length > 0;

  const save = () => {
    if (!canSave) return;
    onSave({ regionId, emotionIds, sensations, intensity, note: note.trim() || undefined });
  };

  return (
    <Sheet
      title={regionLabel(regionId)}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={save}
          disabled={!canSave}
          className="min-h-12 w-full rounded-full bg-accent font-semibold text-accent-ink disabled:opacity-40"
        >
          {canSave ? 'Save' : 'Pick a feeling to save'}
        </button>
      }
    >
      <fieldset className="mb-5">
        <legend className="mb-2 font-semibold text-ink">What are you feeling here?</legend>
        <p className="mb-3 text-sm text-muted">Pick as many as fit. Not knowing is okay too.</p>
        {groupEmotions(active).map(([group, list]) => (
          <div key={group} className="mb-3">
            <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{group}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {list.map((e) => {
                const on = emotionIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(setEmotionIds, e.id)}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-1 py-2 text-center text-xs leading-tight text-ink ${on ? 'font-semibold' : 'border-transparent bg-surface-2'}`}
                    style={on ? { borderColor: e.color, background: `${e.color}33` } : undefined}
                  >
                    <EmotionIcon emotion={e} size={26} />
                    <span>{e.label}</span>
                    {on && <span className="sr-only">(selected)</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="mb-5">
        <legend className="mb-2 font-semibold text-ink">
          How does it feel? <span className="font-normal text-muted">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {SENSATIONS.map((s) => {
            const on = sensations.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(setSensations, s)}
                className={`min-h-11 rounded-full border px-4 text-sm ${on ? 'border-accent bg-accent-soft font-semibold text-ink' : 'border-line text-ink'}`}
              >
                {on && <span aria-hidden="true">✓ </span>}
                {s}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-5">
        <label htmlFor="intensity" className="mb-2 flex items-baseline justify-between font-semibold text-ink">
          How strong is it?
          <span className="text-2xl font-semibold text-accent" aria-hidden="true">{intensity}</span>
        </label>
        <input
          id="intensity"
          type="range"
          min={1}
          max={10}
          step={1}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          aria-valuetext={`${intensity} of 10`}
          className="h-11 w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-xs text-muted" aria-hidden="true">
          <span>Barely there</span>
          <span>Overwhelming</span>
        </div>
      </div>

      <div className="mb-2">
        <label htmlFor="note" className="mb-2 block font-semibold text-ink">
          Note <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. after the call with…"
          className="w-full rounded-xl border border-line bg-bg p-3 text-ink placeholder:text-muted"
        />
      </div>
    </Sheet>
  );
}
