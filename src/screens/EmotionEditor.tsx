import { useRef, useState } from 'react';
import EmotionIcon from '../components/EmotionIcon';
import Icon from '../components/Icon';
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

const SWATCHES = ['#ffc93c', '#ffaa5c', '#ff8577', '#f79ac0', '#c99af0', '#b28cf0', '#6e9cff', '#5ec2f2', '#7fddbe', '#8fd86a', '#d6cdb8', '#9a97af'];

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
  const input = 'field mt-1';

  return (
    <Sheet
      title={emotion ? `Edit “${emotion.label}”` : 'New feeling'}
      onClose={cancel}
      footer={
        <button type="button" onClick={save} disabled={!valid || busy} className="btn btn-primary btn-big w-full">
          Save feeling
        </button>
      }
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-16 items-center justify-center rounded-2xl border-3 border-outline" style={{ background: color }}>
          {(kind === 'emoji' && emoji) || (kind === 'image' && imageId && imageUrl(imageId)) ? <EmotionIcon emotion={preview} size={40} /> : <span className="text-muted">?</span>}
        </span>
        <span className="font-display text-2xl text-ink">{label || 'Preview'}</span>
      </div>

      <label className="mb-3 block font-bold text-ink">
        Name
        <input value={label} onChange={(e) => setLabel(e.target.value)} className={input} maxLength={40} />
      </label>

      <label className="mb-3 block font-bold text-ink">
        Group
        <select value={group} onChange={(e) => setGroup(e.target.value)} className={input}>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          <option value="__new">New group…</option>
        </select>
      </label>
      {group === '__new' && (
        <label className="mb-3 block font-bold text-ink">
          New group name
          <input value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className={input} maxLength={30} />
        </label>
      )}

      <fieldset className="mb-3">
        <legend className="mb-1 font-bold text-ink">Symbol</legend>
        <div role="radiogroup" aria-label="Symbol type" className="card mb-2 inline-flex gap-0.5 rounded-full p-1">
          {(['emoji', 'image'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full border-3 px-4 font-bold text-ink ${kind === k ? 'border-outline bg-accent-2' : 'border-transparent'}`}>
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
            <button type="button" onClick={() => cam.current?.click()} className="btn"><Icon name="camera" size={18} /> Take a photo</button>
            <button type="button" onClick={() => gal.current?.click()} className="btn"><Icon name="image" size={18} /> Choose a picture</button>
            <input ref={cam} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={gal} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Choose a picture file" data-testid="emotion-image-input" onChange={(e) => onFile(e.target.files?.[0])} />
            {busy && <p className="w-full text-sm text-muted">Resizing…</p>}
            {error && <p role="alert" className="w-full text-sm text-warn">{error}</p>}
            <p className="w-full text-xs text-muted">Pictures are shrunk to 256px and stay on this device.</p>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-1 font-bold text-ink">Colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c} className={`size-11 rounded-full border-3 ${color === c ? 'border-outline shadow-[0_3px_0_var(--shadow)]' : 'border-transparent'}`} style={{ background: c }} />
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
