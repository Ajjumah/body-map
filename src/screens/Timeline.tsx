import EmotionIcon from '../components/EmotionIcon';
import { fmtDate, fmtTime } from '../lib/format';
import { useStore } from '../store';
import type { Entry, Session } from '../types';

export default function Timeline({ sessions, entries }: { sessions: Session[]; entries: Entry[] }) {
  const { emotionById } = useStore();
  const bySession = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!bySession.has(e.sessionId)) bySession.set(e.sessionId, []);
    bySession.get(e.sessionId)!.push(e);
  }
  const list = sessions.filter((s) => bySession.has(s.id)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  if (!list.length) return <p className="py-8 text-center text-muted">Nothing here yet. Check-ins you finish will show up here.</p>;

  const days = new Map<string, Session[]>();
  for (const s of list) {
    const d = fmtDate(s.startedAt);
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
                  <a href={`#/history/session/${s.id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-accent">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">
                        {fmtTime(s.startedAt)}
                        {!s.finishedAt && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-normal">in progress</span>}
                      </p>
                      <p className="text-sm text-muted">
                        {es.length} {es.length === 1 ? 'entry' : 'entries'} · strongest {maxI}/10
                        {s.overallMood !== undefined && ` · mood ${s.overallMood}/10`}
                      </p>
                      <p className="truncate text-sm text-muted">{emoIds.map((id) => emotionById.get(id)?.label ?? 'Unknown').join(', ')}</p>
                    </div>
                    <div className="flex shrink-0 -space-x-1" aria-hidden="true">
                      {emoIds.slice(0, 4).map((id) => (
                        <span key={id} className="flex size-8 items-center justify-center rounded-full border-2 bg-surface" style={{ borderColor: emotionById.get(id)?.color }}>
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
