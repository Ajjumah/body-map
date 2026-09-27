import { useRef, useState, type ReactNode } from 'react';
import Buddy from '../components/Buddy';
import ConfirmDialog from '../components/ConfirmDialog';
import EmotionIcon from '../components/EmotionIcon';
import Icon from '../components/Icon';
import { groupEmotions } from '../data/emotions';
import { download, entriesCsv } from '../lib/backup';
import { WORLDS, type ThemeSetting, type World } from '../lib/world';
import { useStore } from '../store';
import type { Emotion } from '../types';
import EmotionEditor from './EmotionEditor';
import PinSettings from './PinSettings';

export function Card({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="card p-4">
      <h3 id={id} className="mb-3 text-2xl text-ink">{title}</h3>
      {children}
    </section>
  );
}

const btn = 'btn';

export default function SettingsScreen() {
  const { settings, updateSettings } = useStore();
  const [supportName, setSupportName] = useState(settings.supportName ?? '');
  const [supportContact, setSupportContact] = useState(settings.supportContact ?? '');
  const [savedMsg, setSavedMsg] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-3xl text-ink">Settings</h2>

      <Card title="Choose your world" id="set-theme">
        <WorldPicker />
      </Card>

      <EmotionManager />


      <Card title="Support contact" id="set-support">
        <p className="mb-3 text-sm text-muted">Someone you trust, shown on the Help screen so they’re easy to reach.</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            await updateSettings({ supportName: supportName.trim() || undefined, supportContact: supportContact.trim() || undefined });
            setSavedMsg('Saved.');
            setTimeout(() => setSavedMsg(''), 2000);
          }}
        >
          <label className="font-bold text-ink">
            Name
            <input value={supportName} onChange={(e) => setSupportName(e.target.value)} className="field mt-1" placeholder="e.g. My sister, Dr Naidoo" />
          </label>
          <label className="font-bold text-ink">
            Phone number or other contact
            <input value={supportContact} onChange={(e) => setSupportContact(e.target.value)} className="field mt-1" inputMode="tel" placeholder="e.g. 082 000 0000" />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary">Save contact</button>
            <span aria-live="polite" className="text-sm text-muted">{savedMsg}</span>
          </div>
        </form>
      </Card>

      <PinSettings />

      <DataCard />

      <p className="pb-4 text-center text-xs text-muted">Everything you enter stays on this device. Nothing is sent anywhere.</p>
    </div>
  );
}

function EmotionManager() {
  const { emotions, reorderEmotion, removeEmotion, saveEmotion } = useStore();
  const [editing, setEditing] = useState<Emotion | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState<Emotion | null>(null);
  const [msg, setMsg] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const list = emotions.filter((e) => showArchived || !e.archived);

  const iconBtn = 'btn btn-ghost btn-icon text-ink disabled:opacity-30';
  return (
    <Card title="Feelings" id="set-emotions">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setEditing('new')} className="btn btn-primary"><Icon name="sparkle" size={18} /> Add a feeling</button>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-5" />
          Show archived
        </label>
      </div>
      <p aria-live="polite" className="text-sm text-muted">{msg}</p>
      {groupEmotions(list).map(([group, items]) => (
        <div key={group} className="mb-3">
          <h4 className="eyebrow mb-1">{group}</h4>
          <ul className="flex flex-col">
            {items.map((e, i) => (
              <li key={e.id} className={`flex flex-wrap items-center gap-x-1 border-b-2 border-dashed border-line py-1 last:border-0 ${e.archived ? 'opacity-60' : ''}`}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-outline" style={{ background: e.color }}>
                  <EmotionIcon emotion={e} size={20} />
                </span>
                <span className="min-w-[8.5rem] flex-1 text-ink">
                  {e.label}
                  {e.archived && <span className="ml-1 text-xs text-muted">(archived)</span>}
                </span>
                <span className="ml-auto flex">
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => reorderEmotion(e.id, -1)} aria-label={`Move ${e.label} up`}><Icon name="up" size={18} /></button>
                <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => reorderEmotion(e.id, 1)} aria-label={`Move ${e.label} down`}><Icon name="down" size={18} /></button>
                <button type="button" className={iconBtn} onClick={() => setEditing(e)} aria-label={`Edit ${e.label}`}><Icon name="pencil" size={18} /></button>
                {e.archived ? (
                  <button type="button" className={iconBtn} onClick={() => saveEmotion({ ...e, archived: false })} aria-label={`Restore ${e.label}`}><Icon name="restore" size={18} /></button>
                ) : (
                  <button type="button" className={iconBtn} onClick={() => saveEmotion({ ...e, archived: true })} aria-label={`Archive ${e.label}`} title="Archive (hide from picker)"><Icon name="archive" size={18} /></button>
                )}
                <button type="button" className={iconBtn} onClick={() => setConfirmDel(e)} aria-label={`Delete ${e.label}`}><Icon name="trash" size={18} /></button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {editing && <EmotionEditor emotion={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {confirmDel && (
        <ConfirmDialog
          title={`Delete “${confirmDel.label}”?`}
          confirmLabel="Delete"
          onCancel={() => setConfirmDel(null)}
          onConfirm={async () => {
            const r = await removeEmotion(confirmDel.id);
            setMsg(r === 'archived' ? `“${confirmDel.label}” is used in your history, so it was archived instead. It won’t appear in the picker.` : `Deleted “${confirmDel.label}”.`);
            setConfirmDel(null);
          }}
        >
          If this feeling is already used in your history it will be archived instead, so past entries stay intact.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function DataCard() {
  const { exportBackup, importBackup, deleteAll, entries, sessions, emotionById } = useStore();
  const [msg, setMsg] = useState('');
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const stamp = () => new Date().toISOString().slice(0, 10);

  return (
    <Card title="Your data" id="set-data">
      <p className="mb-3 text-sm text-muted">
        {sessions.length} check-ins · {entries.length} entries. Export to keep a backup or to share with a therapist.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          onClick={async () => {
            download(`body-map-backup-${stamp()}.json`, JSON.stringify(await exportBackup(), null, 2), 'application/json');
            setMsg('Backup saved.');
          }}
        >
          <Icon name="download" size={18} /> Export all (JSON)
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            download(`body-map-entries-${stamp()}.csv`, entriesCsv(entries, sessions, emotionById), 'text/csv');
            setMsg('Entries saved as CSV.');
          }}
        >
          <Icon name="download" size={18} /> Export entries (CSV)
        </button>
        <button type="button" className={btn} onClick={() => file.current?.click()}><Icon name="upload" size={18} /> Import backup</button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Backup file"
          data-testid="import-input"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) setPendingImport(await f.text());
          }}
        />
      </div>
      <p aria-live="polite" role="status" className="mt-2 min-h-5 text-sm text-muted">{msg}</p>

      <div className="mt-4 border-t border-line pt-4">
        <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger">
          Delete all data…
        </button>
      </div>

      {pendingImport !== null && (
        <ConfirmDialog
          title="Replace your data with this backup?"
          confirmLabel="Import"
          onCancel={() => setPendingImport(null)}
          onConfirm={async () => {
            try {
              const r = await importBackup(pendingImport);
              setMsg(`Imported ${r.sessions} check-ins and ${r.entries} entries.`);
            } catch (err) {
              setMsg(err instanceof Error ? err.message : 'Import failed.');
            }
            setPendingImport(null);
          }}
        >
          Everything currently on this device will be replaced by the contents of the file. Your app lock PIN stays the same.
        </ConfirmDialog>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete all data?"
          confirmLabel="Delete everything"
          typeToConfirm="DELETE"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await deleteAll();
            setConfirmDelete(false);
            setMsg('All data deleted.');
          }}
        >
          This permanently removes every check-in, entry, custom feeling, picture and setting (including the app lock) from this device. It can’t be undone. Consider exporting a backup first.
        </ConfirmDialog>
      )}
    </Card>
  );
}

function WorldPicker() {
  const { settings, updateSettings } = useStore();
  const options: [ThemeSetting, string, string][] = [
    ...(Object.keys(WORLDS) as World[]).map((w) => [w, WORLDS[w].name, `${WORLDS[w].blurb} With ${WORLDS[w].buddy}.`] as [ThemeSetting, string, string]),
    ['auto', 'Match my device', 'Sticker Book by day, Starlight Pocket when your device is in dark mode.'],
  ];
  return (
    <div role="radiogroup" aria-label="World" className="grid gap-3 sm:grid-cols-2">
      {options.map(([id, name, blurb]) => {
        const on = settings.theme === id;
        const preview: World = id === 'auto' ? 'starlight' : id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => updateSettings({ theme: id })}
            className={`on-surface flex items-center gap-3 rounded-[20px] border-3 p-3 text-left text-ink ${on ? 'border-outline bg-accent-2 shadow-[0_4px_0_var(--shadow)]' : 'border-line bg-surface'}`}
          >
            <span data-world={preview} className="flex size-16 shrink-0 items-center justify-center rounded-2xl border-3 border-outline" style={{ background: WORLDS[preview].themeColor }}>
              {id === 'auto' ? (
                <span className="flex -space-x-3">
                  <Buddy world="sticker" size={34} />
                  <Buddy world="starlight" size={34} />
                </span>
              ) : (
                <Buddy world={id} size={46} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-display text-xl">
                {name}
                {on && <Icon name="check" size={18} stroke={3} />}
              </span>
              <span className={`block text-sm leading-snug ${on ? "text-ink" : "text-muted"}`}>{blurb}</span>
              {id !== 'auto' && (
                <span className="mt-1.5 flex gap-1" aria-hidden="true">
                  {WORLDS[id].swatches.map((c) => <span key={c} className="size-4 rounded-full border-2 border-outline" style={{ background: c }} />)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
