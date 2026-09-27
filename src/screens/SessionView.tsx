import EntryList from '../components/EntryList';
import Icon from '../components/Icon';
import MiniBody from '../components/MiniBody';
import { fmtDate, fmtTime } from '../lib/format';
import { useStore } from '../store';

export default function SessionView({ sessionId }: { sessionId: string }) {
  const { sessions, entries } = useStore();
  const s = sessions.find((x) => x.id === sessionId);
  const list = entries.filter((e) => e.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <section aria-labelledby="sv-title" className="flex flex-col gap-4">
      <a href="#/history" className="inline-flex min-h-11 w-fit items-center rounded-full px-2 text-accent">
        <Icon name="back" size={18} /> Back to memories
      </a>
      {!s ? (
        <p className="text-muted">This check-in couldn’t be found.</p>
      ) : (
        <>
          <div>
            <h2 id="sv-title" className="text-3xl text-ink">{fmtDate(s.startedAt)}</h2>
            <p className="text-muted">
              {fmtTime(s.startedAt)}
              {s.finishedAt ? ` – ${fmtTime(s.finishedAt)}` : ' · in progress'} · {list.length} {list.length === 1 ? 'entry' : 'entries'}
              {s.overallMood !== undefined && ` · overall mood ${s.overallMood}/10`}
            </p>
          </div>
          <div className="card p-4">
            <MiniBody entries={list} className="h-64" />
          </div>
          {s.reflection && (
            <div className="card p-4">
              <h3 className="mb-1 text-xl text-ink">Reflection</h3>
              <p className="whitespace-pre-wrap text-ink">{s.reflection}</p>
            </div>
          )}
          <EntryList entries={list} />
        </>
      )}
    </section>
  );
}
