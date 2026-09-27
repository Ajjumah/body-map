import { useMemo } from 'react';
import type { World } from '../lib/world';
import { sparklePath } from './Icon';

/** Fixed, decorative scene behind the app. Sticker Book uses the dotted-paper body background instead. */
export default function Backdrop({ world }: { world: World }) {
  const stars = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 80 }, (_, i) => ({ x: rnd() * 100, y: rnd() * 100, r: [1, 1, 1.4, 2][Math.floor(rnd() * 4)], d: (i % 7) * 0.45 }));
  }, []);

  if (world === 'island') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <svg className="absolute inset-x-0 top-0 h-72 w-full" preserveAspectRatio="xMidYMin slice" viewBox="0 0 400 300">
          <g fill="#fff" fillOpacity="0.9">
            <ellipse cx="60" cy="120" rx="44" ry="15" /><ellipse cx="88" cy="108" rx="28" ry="18" />
            <ellipse cx="330" cy="200" rx="50" ry="16" /><ellipse cx="305" cy="189" rx="26" ry="16" />
            <ellipse cx="340" cy="60" rx="30" ry="10" />
          </g>
        </svg>
        <svg className="absolute inset-x-0 bottom-0 h-56 w-full" preserveAspectRatio="none" viewBox="0 0 400 200">
          <path d="M0 60 Q100 10 200 50 T400 35 V200 H0 Z" fill="#9BDD7C" />
          <path d="M0 100 Q140 55 260 90 T400 80 V200 H0 Z" fill="#7BCB5B" />
        </svg>
      </div>
    );
  }
  if (world === 'starlight') {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} fill="#fff" className={i % 3 === 0 ? 'twinkle' : undefined} style={{ animationDelay: `${s.d}s` }} opacity={i % 3 ? 0.55 : 0.9} />
          ))}
        </svg>
        <svg className="absolute top-40 right-3 h-14 w-14" viewBox="0 0 64 64">
          <circle cx="30" cy="32" r="24" fill="#FFE9A3" />
          <circle cx="42" cy="24" r="22" fill="#2E2461" />
        </svg>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
          {[[40, 150, 8], [360, 250, 6], [24, 520, 6], [372, 600, 9]].map(([x, y, r]) => (
            <path key={`${x}-${y}`} d={sparklePath(x, y, r)} fill="#FFE173" className="twinkle" />
          ))}
        </svg>
        <svg className="absolute inset-x-0 bottom-0 h-32 w-full" preserveAspectRatio="none" viewBox="0 0 400 100">
          <path d="M0 50 Q200 0 400 50 V100 H0 Z" fill="#3B2F7A" />
        </svg>
      </div>
    );
  }
  return null;
}
