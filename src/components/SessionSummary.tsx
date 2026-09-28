import { useState } from 'react';
import { emptyTags, type ContextTags } from '../data/context';
import { useT } from '../i18n';
import { useWorld } from '../lib/useWorld';
import { useStore } from '../store';
import Buddy from './Buddy';
import ContextPicker from './ContextPicker';
import EntryList from './EntryList';
import Icon from './Icon';
import StarScale, { ScaleValue } from './StarScale';
import Grounding, { pickGrounding } from './Grounding';
import MiniBody from './MiniBody';

/** Stored markers inside Session.reflection. Kept in English so saved data is language-independent. */
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
  const [context, setContext] = useState<ContextTags>(session?.context ?? emptyTags());
  const tr = useT();
  const { t } = tr;
  const grounding = pickGrounding(list, emotionById);
  const world = useWorld();

  if (!session) return null;

  const done = async () => {
    const hasContext = context.doing.length + context.with.length + context.where.length > 0;
    await updateSession(session.id, { overallMood: mood, reflection: joinReflection(cause, help), context: hasContext ? context : undefined });
    onDone();
  };

  return (
    <section aria-labelledby="summary-title" className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Buddy world={world} size={72} className="bob shrink-0" />
        <div>
          <h2 id="summary-title" className="text-3xl text-ink">{t('summary.title')}</h2>
          <p className="text-muted">
            {tr.tn('summary.meta', list.length, { date: tr.date(session.startedAt), time: tr.time(session.startedAt) })}
          </p>
        </div>
      </div>

      {showGrounding && grounding && <Grounding kind={grounding} onDismiss={() => setShowGrounding(false)} />}

      <div className="card p-4">
        <h3 className="mb-2 text-center text-xl text-ink">{t('summary.bodyToday')}</h3>
        <MiniBody entries={list} />
      </div>

      <EntryList entries={list} />

      <ContextPicker value={context} onChange={setContext} />

      <div className="card p-4">
        <div className="mb-4">
          {mood === undefined ? (
            <button type="button" onClick={() => setMood(5)} className="btn">
              <Icon name="sparkle" size={18} /> {t('summary.moodButton')} <span className="font-semibold text-muted">{t('common.optional')}</span>
            </button>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="mood" className="text-lg font-bold text-ink">{t('summary.moodLabel')}</label>
                <ScaleValue value={mood} />
              </div>
              <StarScale id="mood" value={mood} onChange={setMood} low={t('summary.moodLow')} high={t('summary.moodHigh')} />
              <button type="button" onClick={() => setMood(undefined)} className="mt-1 min-h-11 text-sm text-muted underline">
                {t('summary.clearMood')}
              </button>
            </>
          )}
        </div>
        <label htmlFor="cause" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink"><Icon name="pencil" size={18} />{t('summary.promptCause')}</label>
        <textarea id="cause" rows={2} value={cause} onChange={(e) => setCause(e.target.value)} className="mb-3 field" />
        <label htmlFor="help" className="mb-1 flex items-center gap-2 text-lg font-bold text-ink"><Icon name="pencil" size={18} />{t('summary.promptHelp')}</label>
        <textarea id="help" rows={2} value={help} onChange={(e) => setHelp(e.target.value)} placeholder={t('summary.helpPlaceholder')} className="field" />
        <p className="mt-2 text-sm text-muted">{t('summary.bothOptional')}</p>
      </div>

      <button type="button" onClick={done} className="btn btn-primary btn-big">
        {t('summary.done')}
      </button>
    </section>
  );
}
