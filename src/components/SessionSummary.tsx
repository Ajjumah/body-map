import { useState } from 'react';
import { fmtDate, fmtTime } from '../lib/format';
import { useStore } from '../store';
import EntryList from './EntryList';
import Grounding, { pickGrounding } from './Grounding';
import MiniBody from './MiniBody';

export const PROMPT_CAUSE = 'What might have brought this on?';
export const PROMPT_HELP = 'What might help right now?';

export function splitReflection(r?: string): [string, string] {
  if (!r) return ['', ''];
  const m = r.match(new RegExp(`^${esc(PROMPT_CAUSE)}\\n([\\s\\S]*?)(?:\\n\\n${esc(PROMPT_HELP)}\\n([\\s\\S]*))?$`));
  if (m) return [m[1] ?? '', m[2] ?? ''];
  const h = r.match(new RegExp(`^${esc(PROMPT_HELP)}\\n([\\s\\S]*)$`));
  if (h) return ['', h[1]];
  return [r, ''];
}
function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function joinReflection(cause: string, help: string): string | undefined {
  const parts: string[] = [];
  if (cause.trim()) parts.push(`${PROMPT_CAUSE}\n${cause.trim()}`);
  if (help.trim()) parts.push(`${PROMPT_HELP}\n${help.trim()}`);
  return parts.length ? parts.join('\n\n') : undefined;
}

export default function SessionSummary({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const { sessions, entries, emotionById, updateSession } = useStore();
  const session = sessions.find((s) => s.id === sessionId);
  const list = entries.filter((e) => e.sessionId === sessionId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const [mood, setMood] = useState<number | undefined>(session?.overallMood);
  const [initCause, initHelp] = splitReflection(session?.reflection);
  const [cause, setCause] = useState(initCause);
  const [help, setHelp] = useState(initHelp);
  const [showGrounding, setShowGrounding] = useState(true);
  const grounding = pickGrounding(list, emotionById);

  if (!session) return null;

  const done = async () => {
    await updateSession(session.id, { overallMood: mood, reflection: joinReflection(cause, help) });
    onDone();
  };

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-5">
      <div>
        <h2 id="summary-title" className="text-xl font-semibold text-ink">Thanks for checking in</h2>
        <p className="text-muted">
          {fmtDate(session.startedAt)}, {fmtTime(session.startedAt)} · {list.length} {list.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {showGrounding && grounding && <Grounding kind={grounding} onDismiss={() => setShowGrounding(false)} />}

      <div className="rounded-3xl border border-line bg-surface p-4">
        <MiniBody entries={list} />
      </div>

      <EntryList entries={list} />

      <div className="rounded-3xl border border-line bg-surface p-4">
        <div className="mb-4">
          {mood === undefined ? (
            <button type="button" onClick={() => setMood(5)} className="min-h-11 rounded-full border border-line px-4 text-ink">
              + Add an overall mood <span className="text-muted">(optional)</span>
            </button>
          ) : (
            <>
              <label htmlFor="mood" className="mb-1 flex items-baseline justify-between font-semibold text-ink">
                Overall, how are you right now?
                <span className="text-2xl text-accent" aria-hidden="true">{mood}</span>
              </label>
              <input id="mood" type="range" min={1} max={10} value={mood} onChange={(e) => setMood(Number(e.target.value))} aria-valuetext={`${mood} of 10`} className="h-11 w-full accent-[var(--accent)]" />
              <div className="flex justify-between text-xs text-muted" aria-hidden="true">
                <span>Really low</span>
                <span>Really good</span>
              </div>
              <button type="button" onClick={() => setMood(undefined)} className="mt-1 min-h-11 text-sm text-muted underline">
                Clear mood
              </button>
            </>
          )}
        </div>
        <label htmlFor="cause" className="mb-1 block font-semibold text-ink">{PROMPT_CAUSE} <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="cause" rows={2} value={cause} onChange={(e) => setCause(e.target.value)} className="mb-3 w-full rounded-xl border border-line bg-bg p-3 text-ink" />
        <label htmlFor="help" className="mb-1 block font-semibold text-ink">{PROMPT_HELP} <span className="font-normal text-muted">(optional)</span></label>
        <textarea id="help" rows={2} value={help} onChange={(e) => setHelp(e.target.value)} className="w-full rounded-xl border border-line bg-bg p-3 text-ink" />
      </div>

      <button type="button" onClick={done} className="min-h-12 rounded-full bg-accent font-semibold text-accent-ink">
        Done
      </button>
    </section>
  );
}
