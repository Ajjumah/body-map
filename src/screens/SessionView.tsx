import { tagLabel } from '../components/ContextPicker';
import EntryList from '../components/EntryList';
import Icon from '../components/Icon';
import MiniBody from '../components/MiniBody';
import { splitReflection } from '../components/SessionSummary';
import { CONTEXT_GROUPS } from '../data/context';
import { useT } from '../i18n';
import { useStore } from '../store';

export default function SessionView({ sessionId }: { sessionId: string }) {
  const { sessions, entries } = useStore();
  const tr = useT();
  const { t } = tr;
  const s = sessions.find((x) => x.id === sessionId);
  const list = entries.filter((e) => e.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [cause, help] = splitReflection(s?.reflection);
  const hasContext = !!s?.context && CONTEXT_GROUPS.some((g) => s.context![g].length);
  return (
    <section aria-labelledby="sv-title" className="flex flex-col gap-4">
      <a href="#/history" className="btn w-fit">
        <Icon name="back" size={18} /> {t('history.back')}
      </a>
      {!s ? (
        <p className="text-muted">{t('history.notFound')}</p>
      ) : (
        <>
          <div>
            <h2 id="sv-title" className="text-3xl text-ink">{tr.date(s.startedAt)}</h2>
            <p className="text-muted">
              {tr.time(s.startedAt)}
              {s.finishedAt ? ` – ${tr.time(s.finishedAt)}` : ` · ${t('history.inProgress')}`} · {tr.tn('history.entries', list.length)}
              {s.overallMood !== undefined && ` · ${t('history.overallMood', { n: s.overallMood })}`}
            </p>
          </div>
          <div className="card p-4">
            <MiniBody entries={list} className="h-64" />
          </div>
          {hasContext && (
            <div className="card p-4">
              <h3 className="mb-2 text-xl text-ink">{t('history.context')}</h3>
              <dl className="flex flex-col gap-2">
                {CONTEXT_GROUPS.filter((g) => s.context![g].length).map((g) => (
                  <div key={g}>
                    <dt className="text-sm text-muted">{t(`ctx.${g}`)}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {s.context![g].map((id) => (
                        <span key={id} className="chip min-h-0 py-1 text-sm">{tagLabel(tr, g, id)}</span>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {s.reflection && (
            <div className="card p-4">
              <h3 className="mb-1 text-xl text-ink">{t('history.reflection')}</h3>
              {cause && (
                <>
                  <p className="mt-2 text-sm font-bold text-muted">{t('summary.promptCause')}</p>
                  <p className="whitespace-pre-wrap text-ink">{cause}</p>
                </>
              )}
              {help && (
                <>
                  <p className="mt-2 text-sm font-bold text-muted">{t('summary.promptHelp')}</p>
                  <p className="whitespace-pre-wrap text-ink">{help}</p>
                </>
              )}
            </div>
          )}
          <EntryList entries={list} />
        </>
      )}
    </section>
  );
}
