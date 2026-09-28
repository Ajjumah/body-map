import EmotionIcon from '../components/EmotionIcon';
import { useT } from '../i18n';
import { useStore } from '../store';
import type { Entry, Session } from '../types';

export default function Timeline({ sessions, entries }: { sessions: Session[]; entries: Entry[] }) {
  const { emotionById } = useStore();
  const tr = useT();
  const { t } = tr;
  const bySession = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
    bySession.get(e.sessionId)!.push(e);
  }
  const list = sessions.filter((s) => bySession.has(s.id)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (!list.length) return <p className="py-8 text-center text-muted">{t('history.empty')}</p>;

  const days = new Map<string, Session[]>();
  for (const s of list) {
    const d = tr.date(s.startedAt);
    if (!days.has(d)) days.set(d, []);
    days.get(d)!.push(s);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...days].map(([day, ss]) => (
        <section key={day} aria-label={day}>
          <h3 className="mb-2 text-sm font-semibold text-muted">{day}</h3>
          <ul className="flex flex-col gap-2">
            {ss.map((s) => {
              const es = bySession.get(s.id)!;
              const emoIds = [...new Set(es.flatMap((e) => e.emotionIds))];
              const maxI = Math.max(...es.map((e) => e.intensity));
              return (
                <li key={s.id}>
                  <a href={`#/history/session/${s.id}`} className="flex min-h-16 items-center justify-between gap-3 card block p-3 transition-transform hover:-translate-y-0.5">
                    <div className="min-w-0">
                      <p className="font-display text-xl text-ink">
                        {tr.time(s.startedAt)}
                        {!s.finishedAt && <span className="ml-2 rounded-full border-2 border-outline bg-accent-2 px-2 py-0.5 font-sans text-xs">{t('history.inProgress')}</span>}
                      </p>
                      <p className="text-sm text-muted">
                        {tr.tn('history.entries', es.length)} · {t('history.strongest', { n: maxI })}
                        {s.overallMood !== undefined && ` · ${t('history.mood', { n: s.overallMood })}`}
                      </p>
                      <p className="truncate text-sm text-muted">{emoIds.map((id) => tr.emotion(emotionById.get(id))).join(', ')}</p>
                    </div>
                    <div className="flex shrink-0 -space-x-1" aria-hidden="true">
                      {emoIds.slice(0, 4).map((id) => (
                        <span key={id} className="flex size-8 items-center justify-center rounded-full border-2 border-outline" style={{ background: emotionById.get(id)?.color }}>
                          <EmotionIcon emotion={emotionById.get(id)} size={18} />
                        </span>
                      ))}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
