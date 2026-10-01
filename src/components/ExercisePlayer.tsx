import { useEffect, useState } from 'react';
import type { Exercise, Phase, Step, Visual } from '../data/exercises';
import { useT } from '../i18n';
import Icon, { sparklePath } from './Icon';

/** Runs any exercise from the registry. */
export default function ExercisePlayer({ exercise }: { exercise: Exercise }) {
  switch (exercise.kind) {
    case 'pace':
      return <Pacer key={exercise.id} visual={exercise.visual} phases={exercise.phases} rounds={exercise.rounds} />;
    case 'steps':
      return <Steps key={exercise.id} steps={exercise.steps} bodySafety={exercise.cat === 'body'} />;
    case 'butterfly':
      return <Butterfly key={exercise.id} secs={exercise.secs} />;
    case 'senses':
      return <Senses key={exercise.id} />;
    default:
      return null;
  }
}

/** One-second ticker that runs while `running` is true. */
function useTicker(running: boolean) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return [sec, setSec] as const;
}

// ---------------------------------------------------------------- breathing

function Pacer({ visual, phases, rounds }: { visual: Visual; phases: Phase[]; rounds: number }) {
  const { t } = useT();
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useTicker(running);
  const cycle = phases.reduce((a, p) => a + p.secs, 0);
  const finished = sec >= cycle * rounds;
  useEffect(() => {
    if (finished) setRunning(false);
  }, [finished]);

  let r = sec % cycle;
  let phase = 0;
  while (r >= phases[phase].secs) {
    r -= phases[phase].secs;
    phase++;
  }
  const left = phases[phase].secs - r;
  const round = Math.min(rounds - 1, Math.floor(sec / cycle));
  const p = phases[phase];
  const dur = running ? p.secs : 0.4;
  const scale = running ? p.scale : 0.75;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-48 items-center justify-center">
        <BreathVisual visual={visual} scale={scale} dur={dur} phase={running ? phase : -1} phases={phases.length} round={round} />
      </div>
      <p className="min-h-8 text-center font-display text-2xl text-ink">
        <span aria-live="polite">{running ? t(p.label) : finished ? t('ground.finished') : t(visual === 'balloon' ? 'ground.ready' : 'calm.ready')}</span>
        {running && <span aria-hidden="true"> · {left}</span>}
      </p>
      {running && (
        <p className="-mt-2 text-xs text-muted">
          {visual === 'hand' ? t('calm.finger', { n: round + 1 }) : t('ground.round', { n: round + 1, total: rounds })}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          if (!running && finished) setSec(0);
          setRunning((x) => !x);
        }}
        className="btn btn-primary"
      >
        {t(running ? 'ground.pause' : sec > 0 && !finished ? 'ground.keepGoing' : finished ? 'calm.restart' : 'ground.start')}
      </button>
      <p className="text-center text-xs text-muted">{t('calm.safety')}</p>
    </div>
  );
}

function BreathVisual({ visual, scale, dur, phase, phases, round }: { visual: Visual; scale: number; dur: number; phase: number; phases: number; round: number }) {
  const ease = `${dur}s ease-in-out`;
  if (visual === 'square') {
    // A dot travels one side of the square per phase.
    const corners = [[20, 140], [20, 20], [140, 20], [140, 140]];
    const target = phase < 0 ? corners[0] : corners[(phase + 1) % 4];
    return (
      <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
        <rect x="20" y="20" width="120" height="120" rx="14" fill="var(--accent-soft)" stroke="var(--outline)" strokeWidth="3" />
        {phases === 4 &&
          corners.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="var(--outline)" opacity={phase === i ? 1 : 0.35} />)}
        <circle r="13" cx="0" cy="0" fill="var(--sparkle)" stroke="var(--outline)" strokeWidth="3" style={{ transform: `translate(${target[0]}px, ${target[1]}px)`, transition: `transform ${ease}` }} />
      </svg>
    );
  }
  if (visual === 'wave') {
    const y = 40 + (1 - scale) * 150;
    return (
      <svg width="200" height="170" viewBox="0 0 200 170" aria-hidden="true">
        <path d="M0 120 Q25 105 50 120 T100 120 T150 120 T200 120 V170 H0 Z" fill="var(--accent)" stroke="var(--outline)" strokeWidth="3" />
        <path d="M0 140 Q25 128 50 140 T100 140 T150 140 T200 140 V170 H0 Z" fill="var(--accent-soft)" opacity="0.7" />
        <g style={{ transform: `translateY(${y}px)`, transition: `transform ${ease}` }}>
          <circle cx="100" cy="0" r="18" fill="#fff" stroke="var(--outline)" strokeWidth="3" />
          <circle cx="94" cy="-3" r="2" fill="var(--outline)" />
          <circle cx="106" cy="-3" r="2" fill="var(--outline)" />
          <path d="M95 5 Q100 9 105 5" fill="none" stroke="var(--outline)" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }
  if (visual === 'hand') {
    // Five fingers; the dot rides up the current finger on the in-breath and down on the out-breath.
    const fingers = [
      { x: 38, top: 78, h: 62 },
      { x: 66, top: 34, h: 106 },
      { x: 94, top: 22, h: 118 },
      { x: 122, top: 32, h: 108 },
      { x: 150, top: 52, h: 88 },
    ];
    const f = fingers[Math.min(4, round)];
    const dotY = phase < 0 ? 140 : scale >= 1 ? f.top + 10 : 140;
    return (
      <svg width="190" height="190" viewBox="0 0 190 190" aria-hidden="true">
        <rect x="30" y="120" width="136" height="62" rx="26" fill="var(--heart-fill)" stroke="var(--outline)" strokeWidth="3" />
        {fingers.map((g, i) => (
          <rect key={i} x={g.x - 12} y={g.top} width="24" height={g.h} rx="12" fill={phase >= 0 && i === Math.min(4, round) ? 'var(--accent-soft)' : 'var(--heart-fill)'} stroke="var(--outline)" strokeWidth="3" />
        ))}
        <circle r="9" cx={f.x} cy="0" fill="var(--sparkle)" stroke="var(--outline)" strokeWidth="2.5" style={{ transform: `translateY(${dotY}px)`, transition: `transform ${ease}` }} />
      </svg>
    );
  }
  if (visual === 'bubble') {
    return (
      <svg width="170" height="170" viewBox="0 0 170 170" aria-hidden="true" style={{ transform: `scale(${scale})`, transition: `transform ${ease}` }}>
        <circle cx="85" cy="85" r="70" fill="var(--accent)" stroke="var(--outline)" strokeWidth="3" />
        <ellipse cx="62" cy="58" rx="12" ry="18" fill="#fff" fillOpacity="0.5" transform="rotate(-25 62 58)" />
        <circle cx="70" cy="85" r="4" fill="var(--outline)" />
        <circle cx="100" cy="85" r="4" fill="var(--outline)" />
        <path d="M75 100 Q85 108 95 100" fill="none" stroke="var(--outline)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="130" height="180" viewBox="0 0 130 180" aria-hidden="true" style={{ transform: `scale(${scale})`, transformOrigin: '50% 70%', transition: `transform ${ease}` }}>
      <path d="M65 124 Q60 146 70 156 Q78 164 66 176" fill="none" stroke="var(--outline)" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="65" cy="66" rx="48" ry="56" fill="var(--accent)" stroke="var(--outline)" strokeWidth="3" />
      <path d="M58 120 L72 120 L65 130 Z" fill="var(--accent)" stroke="var(--outline)" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="46" cy="44" rx="9" ry="15" fill="#fff" fillOpacity="0.55" transform="rotate(-20 46 44)" />
      <path d={sparklePath(112, 22, 8)} fill="var(--sparkle)" stroke="var(--outline)" strokeWidth="1.5" />
      <path d={sparklePath(16, 104, 6)} fill="var(--sparkle)" stroke="var(--outline)" strokeWidth="1.5" />
    </svg>
  );
}

// ---------------------------------------------------------------- guided steps

function Steps({ steps, bodySafety }: { steps: Step[]; bodySafety: boolean }) {
  const { t } = useT();
  const [i, setI] = useState(-1);
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useTicker(running);
  const step = i >= 0 && i < steps.length ? steps[i] : null;
  const done = i >= steps.length;

  // Timed sub-phases (e.g. squeeze 5s, then let go 7s) run on their own.
  const timed = step?.timed ?? [];
  const total = timed.reduce((a, p) => a + p.secs, 0);
  let r = sec;
  let sub = 0;
  while (sub < timed.length && r >= timed[sub].secs) {
    r -= timed[sub].secs;
    sub++;
  }
  const timerDone = !timed.length || sec >= total;
  useEffect(() => {
    if (timerDone) setRunning(false);
  }, [timerDone]);

  const go = (n: number) => {
    setI(n);
    setSec(0);
    setRunning(n >= 0 && n < steps.length && !!steps[n].timed?.length);
  };

  if (i < 0)
    return (
      <div className="flex flex-col items-center gap-3">
        <button type="button" onClick={() => go(0)} className="btn btn-primary">{t('calm.start')}</button>
        {bodySafety && <p className="text-center text-xs text-muted">{t('calm.bodySafety')}</p>}
      </div>
    );

  if (done)
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p aria-live="polite" className="font-display text-2xl text-ink">{t('ground.finished')}</p>
        <button type="button" onClick={() => go(0)} className="btn">{t('calm.restart')}</button>
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-muted">{t('calm.step', { n: i + 1, total: steps.length })}</p>
      <p aria-live="polite" className="min-h-16 text-lg text-ink">{t(step!.text)}</p>
      {timed.length > 0 && (
        <p className="font-display text-2xl text-ink">
          <span aria-live="polite">{t(timed[Math.min(sub, timed.length - 1)].label)}</span>
          {!timerDone && <span aria-hidden="true"> · {timed[sub].secs - r}</span>}
        </p>
      )}
      <div className="flex gap-2">
        {i > 0 && <button type="button" onClick={() => go(i - 1)} className="btn">{t('calm.prev')}</button>}
        <button type="button" onClick={() => go(i + 1)} className="btn btn-primary">
          {t(i === steps.length - 1 ? 'calm.finish' : 'calm.next')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- butterfly hug

function Butterfly({ secs }: { secs: number }) {
  const { t } = useT();
  const [running, setRunning] = useState(false);
  const [sec, setSec] = useTicker(running);
  const finished = sec >= secs;
  useEffect(() => {
    if (finished) setRunning(false);
  }, [finished]);
  const left = running && sec % 2 === 0;
  const right = running && sec % 2 === 1;
  const wing = (on: boolean, flip: boolean) => (
    <svg width="80" height="90" viewBox="0 0 80 90" aria-hidden="true" style={{ transform: `${flip ? 'scaleX(-1) ' : ''}scale(${on ? 1.12 : 0.92})`, transition: 'transform 0.35s ease-out' }}>
      <path d="M78 45 C60 0 5 5 8 35 C10 55 40 55 78 45 Z" fill={on ? 'var(--accent-2)' : 'var(--accent-soft)'} stroke="var(--outline)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M78 47 C55 55 20 60 22 78 C24 92 60 85 78 47 Z" fill={on ? 'var(--accent)' : 'var(--accent-soft)'} stroke="var(--outline)" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-40 items-center justify-center">
        {wing(left, false)}
        <span aria-hidden="true" className="mx-0.5 h-20 w-2.5 rounded-full border-3 border-outline bg-ink" />
        {wing(right, true)}
      </div>
      <p className="min-h-8 text-center font-display text-2xl text-ink">
        {running ? (
          <>
            <span aria-hidden="true">{t(left ? 'calm.left' : 'calm.right')} · </span>
            <span>{t('calm.secondsLeft', { n: secs - sec })}</span>
          </>
        ) : (
          <span aria-live="polite">{finished ? t('ground.finished') : t('ex.butterfly.go')}</span>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          if (!running && finished) setSec(0);
          setRunning((x) => !x);
        }}
        className="btn btn-primary"
      >
        {t(running ? 'ground.pause' : sec > 0 && !finished ? 'ground.keepGoing' : finished ? 'calm.restart' : 'calm.start')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- 5-4-3-2-1

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
        {done ? (
          t('ground.treasure')
        ) : (
          <>
            {t('ground.find')}{' '}
            <span className="mx-1 inline-flex size-11 items-center justify-center rounded-full border-3 border-outline bg-accent-2 font-display text-3xl">{SENSES[step][0]}</span>{' '}
            {t(SENSES[step][1])}
          </>
        )}
      </p>
      <button type="button" onClick={() => setStep((s) => (done ? 0 : s + 1))} className="btn btn-primary">
        {t(done ? 'ground.playAgain' : step === 0 ? 'ground.foundThem' : 'ground.next')}
      </button>
    </div>
  );
}

export function CategoryIcon({ cat, size = 22 }: { cat: Exercise['cat']; size?: number }) {
  return <Icon name={cat === 'breathe' ? 'wind' : cat === 'body' ? 'hand' : cat === 'senses' ? 'eye' : 'help'} size={size} />;
}
