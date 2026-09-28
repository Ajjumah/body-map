import { useState } from 'react';
import { groupEmotions, SENSATIONS } from '../data/emotions';
import { useT } from '../i18n';
import { useStore, type EntryDraft } from '../store';
import type { RegionId } from '../types';
import EmotionIcon from './EmotionIcon';
import Icon from './Icon';
import StarScale, { ScaleValue } from './StarScale';
import Sheet from './Sheet';

const TILTS = [-3, 2, -1.5, 3, -2, 1.5, -2.5, 2.5];

type Props = { regionId: RegionId; onSave: (d: EntryDraft) => void; onClose: () => void };

export default function CheckInSheet({ regionId, onSave, onClose }: Props) {
  const { emotions } = useStore();
  const tr = useT();
  const { t } = tr;
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
      title={tr.region(regionId)}
      onClose={onClose}
      footer={
        <button type="button" onClick={save} disabled={!canSave} className="btn btn-primary btn-big w-full">
          <Icon name="sparkle" size={20} />
          {t(canSave ? 'checkin.save' : 'checkin.pickFirst')}
        </button>
      }
    >
      <fieldset className="mb-6">
        <legend className="mb-1 text-center text-lg font-bold text-ink">{t('checkin.whatFeelings')}</legend>
        <p className="mb-3 text-center text-sm text-muted">{t('checkin.pickAny')}</p>
        {groupEmotions(active).map(([group, list]) => (
          <div key={group} className="mb-4">
            <h3 className="eyebrow mb-2 font-sans">{tr.group(group)}</h3>
            <div className="grid grid-cols-3 gap-x-2.5 gap-y-3 px-1 sm:grid-cols-4">
              {list.map((e, i) => {
                const on = emotionIds.includes(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(setEmotionIds, e.id)}
                    className="sticker"
                    style={{
                      transform: `rotate(${TILTS[i % TILTS.length]}deg)`,
                      border: `3px solid ${on ? 'var(--outline)' : e.color}`,
                      boxShadow: `0 ${on ? 4 : 3}px 0 ${on ? 'var(--shadow)' : e.color}`,
                      background: on ? e.color : '#fff',
                    }}
                  >
                    {on && (
                      <span aria-hidden="true" className="pop absolute -top-2.5 -right-2 flex size-6 items-center justify-center rounded-full border-[2.5px] border-outline bg-accent-2 text-ink">
                        <Icon name="sparkle" size={13} stroke={2.4} />
                      </span>
                    )}
                    <EmotionIcon emotion={e} size={32} />
                    <span>{tr.emotion(e)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-2 text-lg font-bold text-ink">
          {t('checkin.howFeel')} <span className="text-base font-semibold text-muted">{t('common.optional')}</span>
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
                className="chip"
              >
                {on && <Icon name="check" size={16} stroke={3} />}
                {tr.sensation(s)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="intensity" className="text-lg font-bold text-ink">{t('checkin.howBig')}</label>
          <ScaleValue value={intensity} />
        </div>
        <StarScale id="intensity" value={intensity} onChange={setIntensity} low={t('checkin.barely')} high={t('checkin.overwhelming')} />
      </div>

      <div className="mb-2">
        <label htmlFor="note" className="mb-2 flex items-center gap-2 text-lg font-bold text-ink">
          <Icon name="pencil" size={18} /> {t('checkin.note')} <span className="text-base font-semibold text-muted">{t('common.optional')}</span>
        </label>
        <textarea
          id="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('checkin.notePlaceholder')}
          className="field"
        />
      </div>
    </Sheet>
  );
}
