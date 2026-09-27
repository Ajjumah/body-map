import { useEffect, useState } from 'react';
import type { Emotion, Entry } from '../types';

export type GroundingKind = 'breathing' | 'senses' | 'rest' | 'savour';

export function pickGrounding(entries: Entry[], emotionById: Map<string, Emotion>): GroundingKind | null {
  if (!entries.length) return null;
  const top = entries.reduce((a, b) => (b.intensity > a.intensity ? b : a));
  const groups = top.emotionIds.map((id) => emotionById.get(id)?.group);
  const labels = top.emotionIds.map((id) => emotionById.get(id)?.label);
  if (labels.includes('Panicky') || labels.includes('Numb') || labels.includes('Empty')) return 'senses';
  if (groups.includes('Anxious') || groups.includes('Hurt / angry')) return 'breathing';
  if (groups.includes('Low') || groups.includes('Unsure')) return 'senses';
  if (groups.includes('Tired')) return 'rest';
  if (groups.includes('Okay / good')) return 'savour';
  return 'breathing';
}

const PHASES = [
  { label: 'Breathe in', secs: 4 },
  { label: 'Hold', secs: 7 },
  { label: 'Breathe out', secs: 8 },
];

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
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const finished = t >= CYCLE * ROUNDS;
  useEffect(() => {
    if (finished) setRunning(false);
  }, [finished]);
  const { phase, left } = phaseAt(t);
  const cycles = Math.floor(t / CYCLE);

  const scale = !running ? 0.7 : phase === 0 ? 1 : phase === 1 ? 1 : 0.6;
  const dur = !running ? 0 : PHASES[phase].secs;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex size-40 items-center justify-center">
        <div
          aria-hidden="true"
          className="size-36 rounded-full bg-accent-soft ring-4 ring-accent/30"
          style={{ transform: `scale(${scale})`, transition: `transform ${dur}s ease-in-out` }}
        />
      </div>
      <p className="h-6 text-lg text-ink">
        <span aria-live="polite">{running ? PHASES[phase].label : finished ? 'Nicely done.' : 'Four slow rounds, just over a minute.'}</span>
        {running && <span aria-hidden="true"> · {left}</span>}
      </p>
      {running && <p className="-mt-2 text-xs text-muted">Round {cycles + 1} of {ROUNDS}</p>}
      <button
        type="button"
        onClick={() => {
          if (!running && finished) setT(0);
          setRunning((r) => !r);
        }}
        className="min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-ink"
      >
        {running ? 'Pause' : t > 0 && !finished ? 'Resume' : 'Start breathing'}
      </button>
    </div>
  );
}

const SENSES = [
  [5, 'things you can see'],
  [4, 'things you can touch'],
  [3, 'things you can hear'],
  [2, 'things you can smell'],
  [1, 'thing you can taste'],
] as const;

function Senses() {
  const [step, setStep] = useState(0);
  const done = step >= SENSES.length;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p aria-live="polite" className="min-h-16 text-lg text-ink">
        {done ? 'You’re here, right now. That’s enough.' : (
          <>
            Notice <span className="text-3xl font-semibold text-accent">{SENSES[step][0]}</span> {SENSES[step][1]}.
          </>
        )}
      </p>
      <button type="button" onClick={() => setStep((s) => (done ? 0 : s + 1))} className="min-h-11 rounded-full bg-accent px-5 font-semibold text-accent-ink">
        {done ? 'Start again' : step === 0 ? 'I’ve noticed them' : 'Next'}
      </button>
    </div>
  );
}

const COPY: Record<GroundingKind, { title: string; intro: string }> = {
  breathing: { title: '4-7-8 breathing', intro: 'A slow breath can tell your body it’s safe to soften a little.' },
  senses: { title: '5-4-3-2-1 senses', intro: 'Gently bring your attention to what’s around you, one sense at a time.' },
  rest: { title: 'A small rest', intro: 'Tiredness is information too. If you can, sip some water, drop your shoulders, and let your eyes rest for a minute.' },
  savour: { title: 'Stay with it', intro: 'Something here feels okay. If you like, take three slow breaths and notice where that ease sits in your body.' },
};

export default function Grounding({ kind, onDismiss }: { kind: GroundingKind; onDismiss: () => void }) {
  return (
    <section aria-labelledby="grounding-title" className="relative rounded-3xl bg-accent-soft/60 p-5">
      <button type="button" onClick={onDismiss} aria-label="Dismiss suggestion" className="absolute top-2 right-2 size-11 rounded-full text-xl text-muted hover:bg-surface/60">
        ×
      </button>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">If it helps</p>
      <h3 id="grounding-title" className="mb-1 text-lg font-semibold text-ink">{COPY[kind].title}</h3>
      <p className="mb-4 pr-6 text-ink">{COPY[kind].intro}</p>
      {kind === 'breathing' && <Breathing />}
      {kind === 'senses' && <Senses />}
    </section>
  );
}
