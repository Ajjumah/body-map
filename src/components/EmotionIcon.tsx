import type { Emotion } from '../types';
import { useImageUrl } from '../store';

/** Renders an emotion's emoji or custom picture. */
export default function EmotionIcon({ emotion, size = 24 }: { emotion?: Emotion; size?: number }) {
  const url = useImageUrl(emotion?.imageId);
  if (!emotion) return <span aria-hidden="true">❔</span>;
  if (emotion.imageId && url) {
    return <img src={url} alt="" width={size} height={size} className="inline-block rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span aria-hidden="true" style={{ fontSize: size * 0.85, lineHeight: 1 }}>
      {emotion.emoji ?? '•'}
    </span>
  );
}
