import { useState } from 'react';
import { exerciseById } from '../data/exercises';
import { useT } from '../i18n';
import ExercisePlayer from './ExercisePlayer';
import Icon from './Icon';

/** The exercise suggested after a check-in, with a way to try another or open the calm corner. */
export default function Grounding({ options, onDismiss }: { options: string[]; onDismiss: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const exercise = exerciseById(options[i % options.length]);
  if (!exercise) return null;
  return (
    <section aria-labelledby="grounding-title" className="card relative bg-accent-soft p-5">
      <button type="button" onClick={onDismiss} aria-label={t('ground.dismiss')} className="btn btn-icon absolute top-3 right-3">
        <Icon name="close" size={16} stroke={2.8} />
      </button>
      <p className="eyebrow">{t('ground.eyebrow')}</p>
      <h3 id="grounding-title" className="mb-1 pr-12 text-2xl text-ink">{t(exercise.title)}</h3>
      <p className="mb-2 pr-6 text-ink">{t(exercise.intro)}</p>
      <ExercisePlayer key={exercise.id} exercise={exercise} />
      <div className="mt-4 flex flex-wrap justify-center gap-2 border-t-3 border-dashed border-line pt-3">
        {options.length > 1 && (
          <button type="button" onClick={() => setI((x) => x + 1)} className="btn">
            <Icon name="restore" size={18} /> {t('calm.tryAnother')}
          </button>
        )}
        <a href="#/calm" className="btn">
          <Icon name="wind" size={18} /> {t('calm.more')}
        </a>
      </div>
    </section>
  );
}
