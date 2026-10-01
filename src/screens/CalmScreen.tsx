import { useWorld } from '../lib/useWorld';
import Buddy from '../components/Buddy';
import ExercisePlayer, { CategoryIcon } from '../components/ExercisePlayer';
import Icon from '../components/Icon';
import { CATEGORIES, EXERCISES, exerciseById } from '../data/exercises';
import { useT } from '../i18n';
import { SpeechBubble } from './BodyMapScreen';

/** The calm corner: every breathing and regulation exercise, available any time. */
export default function CalmScreen({ route }: { route: string[] }) {
  const { t } = useT();
  const world = useWorld();
  if (route[1]) return <ExerciseView id={route[1]} />;
  return (
    <section aria-labelledby="calm-title" className="flex flex-col gap-4">
      <h2 id="calm-title" className="text-3xl text-ink">{t('calm.title')}</h2>
      <div className="flex items-center gap-3">
        <Buddy world={world} size={56} className="bob shrink-0" />
        <SpeechBubble>{t('calm.intro')}</SpeechBubble>
      </div>
      {CATEGORIES.map((cat) => (
        <section key={cat} aria-labelledby={`cat-${cat}`}>
          <h3 id={`cat-${cat}`} className="mb-2 flex items-center gap-2 text-2xl text-ink">
            <CategoryIcon cat={cat} /> {t(`calm.cat.${cat}`)}
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {EXERCISES.filter((e) => e.cat === cat).map((e) => (
              <li key={e.id}>
                <a href={`#/calm/${e.id}`} className="card flex min-h-20 flex-col gap-1 p-4 transition-transform hover:-translate-y-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-display text-xl text-ink">{t(e.title)}</span>
                    <span className="shrink-0 text-xs text-muted">{t('calm.minutes', { n: e.minutes })}</span>
                  </span>
                  <span className="line-clamp-2 text-sm text-muted">{t(e.intro)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}

function ExerciseView({ id }: { id: string }) {
  const { t } = useT();
  const e = exerciseById(id);
  return (
    <section aria-labelledby="ex-title" className="flex flex-col gap-4">
      <a href="#/calm" className="btn w-fit">
        <Icon name="back" size={18} /> {t('calm.back')}
      </a>
      {!e ? (
        <p className="text-muted">{t('calm.notFound')}</p>
      ) : (
        <div className="card bg-accent-soft p-5">
          <p className="eyebrow flex items-center gap-1.5">
            <CategoryIcon cat={e.cat} size={16} /> {t(`calm.cat.${e.cat}`)}
          </p>
          <h2 id="ex-title" className="mb-1 text-3xl text-ink">{t(e.title)}</h2>
          <p className="mb-3 text-ink">{t(e.intro)}</p>
          <ExercisePlayer exercise={e} />
        </div>
      )}
    </section>
  );
}
