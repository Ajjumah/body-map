import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import Icon, { sparklePath } from './Icon';
import type { Emotion, Entry } from '../types';

export type GroundingKind = 'breathing' | 'senses' | 'rest' | 'savour';

export function pickGrounding(entries: Entry[], emotionById: Map<string, Emotion>): GroundingKind | null {
  if (!entries.length) return null;
  const top = entries.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const groups = top.emotionIds.map((id) => emotionById.get(id)?.group);
  if (top.emotionIds.some((id) => ['default.panicky', 'default.numb', 'default.empty'].includes(id))) return 'senses';
  if (groups.includes('Anxious') || groups.includes('Hurt / angry')) return 'breathing';
  if (groups.includes('Low') || groups.includes('Unsure')) return 'senses';
  if (groups.includes('Tired')) return 'rest';
  if (groups.includes('Okay / good')) return 'savour';
  return 'breathing';
}

const PHASES = [
  { label: 'ground.in', secs: 4 },
  { label: 'ground.hold', secs: 7 },
  { label: 'ground.out', secs: 8 },
] as const;

const CYCLE = PHASES.reduce((a, p) => a + p.secs, 0);
const ROUNDS = 4;

function phaseAt(t: number) {
  let r = t % CYCLE;
  for (let i = 0; i < PHASES.length; i++) {
    if (r < PHASES[i].secs) return { phase: i, left: PHASES[i].secs - r };
    r -= PHASES[i].secs;
  }
  return { phase: 0, left: PHASES[0].secs };
}

function Breathing() {
  const { t } = useT();
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const finished = sec >= CYCLE * ROUNDS;
  useEffect(() => {
    if (finished) setRunning(false);
  }, [finished]);
  const { phase, left } = phaseAt(sec);
  const cycles = Math.floor(sec / CYCLE);

  const scale = !running ? 0.7 : phase === 0 ? 1 : phase === 1 ? 1 : 0.6;
  const dur = !running ? 0 : PHASES[phase].secs;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-48 items-end justify-center">
        <svg width="130" height="180" viewBox="0 0 130 180" aria-hidden="true" style={{ transform: `scale(${scale})`, transformOrigin: '50% 70%', transition: `transform ${dur}s ease-in-out` }}>
          <path d="M65 124 Q60 146 70 156 Q78 164 66 176" fill="none" stroke="var(--outline)" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="65" cy="66" rx="48" ry="56" fill="var(--accent)" stroke="var(--outline)" strokeWidth="3" />
          <path d="M58 120 L72 120 L65 130 Z" fill="var(--accent)" stroke="var(--outline)" strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="46" cy="44" rx="9" ry="15" fill="#fff" fillOpacity="0.55" transform="rotate(-20 46 44)" />
          <path d={sparklePath(112, 22, 8)} fill="var(--sparkle)" stroke="var(--outline)" strokeWidth="1.5" />
          <path d={sparklePath(16, 104, 6)} fill="var(--sparkle)" stroke="var(--outline)" strokeWidth="1.5" />
        </svg>
      </div>
      <p className="min-h-8 text-center font-display text-2xl text-ink">
        <span aria-live="polite">{t(running ? PHASES[phase].label : finished ? 'ground.finished' : 'ground.ready')}</span>
        {running && <span aria-hidden="true"> · {left}</span>}
      </p>
      {running && <p className="-mt-2 text-xs text-muted">{t('ground.round', { n: cycles + 1, total: ROUNDS })}</p>}
      <button
        type="button"
        onClick={() => {
          if (!running && finished) setSec(0);
          setRunning((r) => !r);
        }}
        className="btn btn-primary"
      >
        {t(running ? 'ground.pause' : sec > 0 && !finished ? 'ground.keepGoing' : 'ground.start')}
      </button>
    </div>
  );
}

const SENSES = [
  [5, 'ground.see'],
  [4, 'ground.touch'],
  [3, 'ground.hear'],
  [2, 'ground.smell'],
  [1, 'ground.taste'],
] as const;

function Senses() {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const done = step >= SENSES.length;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p aria-live="polite" className="min-h-16 text-lg text-ink">
        {done ? t('ground.treasure') : (
          <>
            {t('ground.find')} <span className="mx-1 inline-flex size-11 items-center justify-center rounded-full border-3 border-outline bg-accent-2 font-display text-3xl">{SENSES[step][0]}</span> {t(SENSES[step][1])}
          </>
        )}
      </p>
      <button type="button" onClick={() => setStep((s) => (done ? 0 : s + 1))} className="btn btn-primary">
        {t(done ? 'ground.playAgain' : step === 0 ? 'ground.foundThem' : 'ground.next')}
      </button>
    </div>
  );
}

export default function Grounding({ kind, onDismiss }: { kind: GroundingKind; onDismiss: () => void }) {
  const { t } = useT();
  return (
    <section aria-labelledby="grounding-title" className="card relative bg-accent-soft p-5">
      <button type="button" onClick={onDismiss} aria-label={t('ground.dismiss')} className="btn btn-icon absolute top-3 right-3">
        <Icon name="close" size={16} stroke={2.8} />
      </button>
      <p className="eyebrow">{t('ground.eyebrow')}</p>
      <h3 id="grounding-title" className="mb-1 pr-12 text-2xl text-ink">{t(`ground.${kind}.title`)}</h3>
      <p className="mb-2 pr-6 text-ink">{t(`ground.${kind}.intro`)}</p>
      {kind === 'breathing' && <Breathing />}
      {kind === 'senses' && <Senses />}
    </section>
  );
}
