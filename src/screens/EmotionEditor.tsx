import { useRef, useState } from 'react';
import EmotionIcon from '../components/EmotionIcon';
import Sheet from '../components/Sheet';
import { EMOTION_GROUPS } from '../data/emotions';
import { uid } from '../lib/id';
import { resizeImage } from '../lib/image';
import { useStore } from '../store';
import type { Emotion } from '../types';

function lastGrapheme(v: string) {
  const segs = [...new Intl.Segmenter().segment(v)];
  return segs.length ? segs[segs.length - 1].segment : '';
}

const SWATCHES = ['#d4a24c', '#d98f63', '#c4705f', '#c68e9c', '#9c88b6', '#7093b8', '#6f9cc2', '#7db3a5', '#84b36c', '#a2c07e', '#aea797', '#80838b'];

export default function EmotionEditor({ emotion, onClose }: { emotion?: Emotion; onClose: () => void }) {
  const { emotions, saveEmotion, addImage, removeImage, imageUrl } = useStore();
  const uploaded = useRef<string[]>([]);
  const groups = [...new Set([...EMOTION_GROUPS, ...emotions.map((e) => e.group)])];
  const [label, setLabel] = useState(emotion?.label ?? '');
  const [group, setGroup] = useState(emotion?.group ?? 'Unsure');
  const [newGroup, setNewGroup] = useState('');
  const [kind, setKind] = useState<'emoji' | 'image'>(emotion?.imageId ? 'image' : 'emoji');
  const [emoji, setEmoji] = useState(emotion?.emoji ?? '');
  const [imageId, setImageId] = useState(emotion?.imageId);
  const [color, setColor] = useState(emotion?.color ?? SWATCHES[7]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);

  const onFile = async (f?: File) => {
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      const blob = await resizeImage(f, 256);
      const id = await addImage(blob);
      uploaded.current.push(id);
      setImageId(id);
      setKind('image');
    } catch {
      setError('Sorry, that picture couldn’t be read. Try a different one.');
    } finally {
      setBusy(false);
    }
  };

  const finalGroup = group === '__new' ? newGroup.trim() : group;
  const valid = label.trim() && finalGroup && (kind === 'emoji' ? emoji.trim() : imageId);

  const save = async () => {
    if (!valid) return;
    const maxOrder = Math.max(0, ...emotions.map((e) => e.order));
    await saveEmotion({
      id: emotion?.id ?? `custom.${uid()}`,
      label: label.trim(),
      group: finalGroup,
      emoji: kind === 'emoji' ? emoji.trim() : undefined,
      imageId: kind === 'image' ? imageId : undefined,
      color,
      isDefault: emotion?.isDefault ?? false,
      archived: emotion?.archived ?? false,
      order: emotion?.order ?? maxOrder + 1,
    });
    // Drop pictures that were uploaded here but not kept.
    const keep = kind === 'image' ? imageId : undefined;
    for (const id of uploaded.current) if (id !== keep) await removeImage(id);
    if (emotion?.imageId && emotion.imageId !== keep) await removeImage(emotion.imageId);
    onClose();
  };

  const cancel = async () => {
    for (const id of uploaded.current) await removeImage(id);
    onClose();
  };

  const preview: Emotion = { id: 'preview', label, group: finalGroup, emoji: kind === 'emoji' ? emoji : undefined, imageId: kind === 'image' ? imageId : undefined, color, isDefault: false, archived: false, order: 0 };
  const input = 'mt-1 min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-ink';

  return (
    <Sheet
      title={emotion ? `Edit “${emotion.label}”` : 'New feeling'}
      onClose={cancel}
      footer={
        <button type="button" onClick={save} disabled={!valid || busy} className="min-h-12 w-full rounded-full bg-accent font-semibold text-accent-ink disabled:opacity-40">
          Save feeling
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-16 items-center justify-center rounded-2xl border-2" style={{ borderColor: color, background: `${color}33` }}>
          {(kind === 'emoji' && emoji) || (kind === 'image' && imageId && imageUrl(imageId)) ? <EmotionIcon emotion={preview} size={40} /> : <span className="text-muted">?</span>}
        </span>
        <span className="text-ink">{label || 'Preview'}</span>
      </div>

      <label className="mb-3 block text-sm font-semibold text-ink">
        Name
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={input} maxLength={40} />
      </label>

      <label className="mb-3 block text-sm font-semibold text-ink">
        Group
        <select value={group} onChange={(e) => setGroup(e.target.value)} className={input}>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          <option value="__new">New group…</option>
        </select>
      </label>
      {group === '__new' && (
        <label className="mb-3 block text-sm font-semibold text-ink">
          New group name
          <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className={input} maxLength={30} />
        </label>
      )}

      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-semibold text-ink">Symbol</legend>
        <div role="radiogroup" aria-label="Symbol type" className="mb-2 inline-flex rounded-full bg-surface-2 p-1">
          {(['emoji', 'image'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full px-4 text-sm ${kind === k ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted'}`}>
              {k === 'emoji' ? 'Emoji' : 'Picture'}
            </button>
          ))}
        </div>
        {kind === 'emoji' ? (
          <label className="block text-sm text-muted">
            Emoji
            <input value={emoji} onChange={(e) => setEmoji(lastGrapheme(e.target.value))} className={`${input} text-2xl`} placeholder="🙂" aria-describedby="emoji-hint" />
            <span id="emoji-hint" className="text-xs">Use your keyboard’s emoji picker.</span>
          </label>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => cam.current?.click()} className="min-h-11 rounded-full border border-line px-4 text-ink">📷 Take a photo</button>
            <button type="button" onClick={() => gal.current?.click()} className="min-h-11 rounded-full border border-line px-4 text-ink">🖼️ Choose a picture</button>
            <input ref={cam} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={gal} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Choose a picture file" data-testid="emotion-image-input" onChange={(e) => onFile(e.target.files?.[0])} />
            {busy && <p className="w-full text-sm text-muted">Resizing…</p>}
            {error && <p role="alert" className="w-full text-sm text-warn">{error}</p>}
            <p className="w-full text-xs text-muted">Pictures are shrunk to 256px and stay on this device.</p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-sm font-semibold text-ink">Colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c} className={`size-11 rounded-full border-4 ${color === c ? 'border-ink' : 'border-surface'}`} style={{ background: c }} />
          ))}
          <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
            Custom
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-11 cursor-pointer rounded-full border-0 bg-transparent" />
          </label>
        </div>
      </fieldset>
    </Sheet>
  );
}
