import { useState } from 'react';
import { CONTEXT_GROUPS, CUSTOM_PREFIX, DEFAULT_TAGS, emptyTags, type ContextGroup, type ContextTags } from '../data/context';
import { useT, type T } from '../i18n';
import { useStore } from '../store';
import Icon from './Icon';

const VISIBLE = 6;

export function tagLabel(tr: T, group: ContextGroup, id: string) {
  return id.startsWith(CUSTOM_PREFIX) ? id.slice(CUSTOM_PREFIX.length) : tr.dyn(`ctx.${group}.${id}`, id);
}

/** Optional "what / who / where" tags for a check-in. */
export default function ContextPicker({ value, onChange }: { value: ContextTags; onChange: (update: (prev: ContextTags) => ContextTags) => void }) {
  const tr = useT();
  const { t } = tr;
  return (
    <div className="card p-4">
      <h3 className="text-xl text-ink">{t('ctx.title')}</h3>
      <p className="mb-3 text-sm text-muted">{t('ctx.intro')}</p>
      <div className="flex flex-col gap-4">
        {CONTEXT_GROUPS.map((g) => (
          <Group
            key={g}
            group={g}
            selected={value[g]}
            onToggle={(id) => onChange((prev) => ({ ...prev, [g]: prev[g].includes(id) ? prev[g].filter((x) => x !== id) : [...prev[g], id] }))}
            onSelect={(id) => onChange((prev) => (prev[g].includes(id) ? prev : { ...prev, [g]: [...prev[g], id] }))}
          />
        ))}
      </div>
    </div>
  );
}

function Group({ group, selected, onToggle, onSelect }: { group: ContextGroup; selected: string[]; onToggle: (id: string) => void; onSelect: (id: string) => void }) {
  const tr = useT();
  const { t } = tr;
  const { settings, updateSettings } = useStore();
  const custom = (settings.customTags ?? emptyTags())[group].map((c) => CUSTOM_PREFIX + c);
  const all = [...DEFAULT_TAGS[group], ...custom];
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  // Always show selected tags, even when collapsed.
  const shown = expanded ? all : all.filter((id, i) => i < VISIBLE || selected.includes(id));
  const headingId = `ctx-${group}`;
  const title = t(`ctx.${group}`);

  const add = async () => {
    const clean = text.trim().slice(0, 30);
    setText('');
    setAdding(false);
    if (!clean) return;
    const tags = settings.customTags ?? emptyTags();
    if (!tags[group].includes(clean)) await updateSettings({ customTags: { ...tags, [group]: [...tags[group], clean] } });
    onSelect(CUSTOM_PREFIX + clean);
  };

  return (
    <fieldset aria-labelledby={headingId}>
      <legend id={headingId} className="mb-2 font-bold text-ink">{title}</legend>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} aria-label={t('ctx.add')} className="chip w-11 justify-center px-0">
          <Icon name="plus" size={18} stroke={2.8} />
        </button>
        {shown.map((id) => {
          const on = selected.includes(id);
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => onToggle(id)} className="chip">
              {on && <Icon name="check" size={16} stroke={3} />}
              {tagLabel(tr, group, id)}
            </button>
          );
        })}
        {all.length > VISIBLE && (
          <button type="button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded} className="btn btn-ghost min-h-11 px-3 text-sm text-muted">
            {t(expanded ? 'ctx.less' : 'ctx.more')}
            <Icon name={expanded ? 'up' : 'down'} size={16} />
          </button>
        )}
      </div>
      {adding && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="sr-only" htmlFor={`add-${group}`}>{t('ctx.addLabel', { group: title })}</label>
          <input id={`add-${group}`} autoFocus value={text} onChange={(e) => setText(e.target.value)} maxLength={30} className="field flex-1" placeholder={t('ctx.add')} />
          <button type="submit" className="btn btn-primary">{t('ctx.addButton')}</button>
        </form>
      )}
    </fieldset>
  );
}
