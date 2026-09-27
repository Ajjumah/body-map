import { useRef, useState, type ReactNode } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import EmotionIcon from '../components/EmotionIcon';
import { groupEmotions } from '../data/emotions';
import { download, entriesCsv } from '../lib/backup';
import { useStore } from '../store';
import type { Emotion } from '../types';
import { Segmented } from './BodyMapScreen';
import EmotionEditor from './EmotionEditor';
import PinSettings from './PinSettings';

export function Card({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-line bg-surface p-4">
      <h3 id={id} className="mb-3 text-lg font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

const btn = 'min-h-11 rounded-full border border-line px-4 text-ink hover:border-accent';

export default function SettingsScreen() {
  const { settings, updateSettings } = useStore();
  const [supportName, setSupportName] = useState(settings.supportName ?? '');
  const [supportContact, setSupportContact] = useState(settings.supportContact ?? '');
  const [savedMsg, setSavedMsg] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-ink">Settings</h2>

      <EmotionManager />

      <Card title="Appearance" id="set-theme">
        <Segmented
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
          label="Theme"
          options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]}
        />
      </Card>

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
          <label className="text-sm font-semibold text-ink">
            Name
            <input value={supportName} onChange={(e) => setSupportName(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 font-normal" placeholder="e.g. My sister, Dr Naidoo" />
          </label>
          <label className="text-sm font-semibold text-ink">
            Phone number or other contact
            <input value={supportContact} onChange={(e) => setSupportContact(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 font-normal" inputMode="tel" placeholder="e.g. 082 000 0000" />
          </label>
          <div className="flex items-center gap-3">
            <button type="submit" className="min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-ink">Save contact</button>
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

  const iconBtn = 'size-11 rounded-full text-muted hover:bg-surface-2 disabled:opacity-30';
  return (
    <Card title="Feelings" id="set-emotions">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setEditing('new')} className="min-h-11 rounded-full bg-accent px-4 font-semibold text-accent-ink">+ Add a feeling</button>
        <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-5" />
          Show archived
        </label>
      </div>
      <p aria-live="polite" className="text-sm text-muted">{msg}</p>
      {groupEmotions(list).map(([group, items]) => (
        <div key={group} className="mb-3">
          <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{group}</h4>
          <ul className="flex flex-col">
            {items.map((e, i) => (
              <li key={e.id} className={`flex items-center gap-2 border-b border-line py-1 last:border-0 ${e.archived ? 'opacity-60' : ''}`}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: e.color }}>
                  <EmotionIcon emotion={e} size={20} />
                </span>
                <span className="min-w-0 flex-1 truncate text-ink">
                  {e.label}
                  {e.archived && <span className="ml-1 text-xs text-muted">(archived)</span>}
                </span>
                <button type="button" className={iconBtn} disabled={i === 0} onClick={() => reorderEmotion(e.id, -1)} aria-label={`Move ${e.label} up`}>↑</button>
                <button type="button" className={iconBtn} disabled={i === items.length - 1} onClick={() => reorderEmotion(e.id, 1)} aria-label={`Move ${e.label} down`}>↓</button>
                <button type="button" className={iconBtn} onClick={() => setEditing(e)} aria-label={`Edit ${e.label}`}>✎</button>
                {e.archived ? (
                  <button type="button" className={iconBtn} onClick={() => saveEmotion({ ...e, archived: false })} aria-label={`Restore ${e.label}`}>↺</button>
                ) : (
                  <button type="button" className={iconBtn} onClick={() => saveEmotion({ ...e, archived: true })} aria-label={`Archive ${e.label}`} title="Archive (hide from picker)">🗄</button>
                )}
                <button type="button" className={iconBtn} onClick={() => setConfirmDel(e)} aria-label={`Delete ${e.label}`}>🗑</button>
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
          ⬇ Export all (JSON)
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => {
            download(`body-map-entries-${stamp()}.csv`, entriesCsv(entries, sessions, emotionById), 'text/csv');
            setMsg('Entries saved as CSV.');
          }}
        >
          ⬇ Export entries (CSV)
        </button>
        <button type="button" className={btn} onClick={() => file.current?.click()}>⬆ Import backup</button>
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
        <button type="button" onClick={() => setConfirmDelete(true)} className="min-h-11 rounded-full border border-warn px-4 text-warn">
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
