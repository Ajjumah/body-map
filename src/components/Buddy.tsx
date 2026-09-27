import type { World } from '../lib/world';

/** The companion for each world: Sunny (sticker), Sprout (island), Twinkle (starlight). Decorative. */
export default function Buddy({ world, size = 64, className }: { world: World; size?: number; className?: string }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true as const, className };
  if (world === 'island') {
    return (
      <svg {...common}>
        <path d="M32 20 C24 6 10 8 12 18 C14 26 26 24 32 20 Z" fill="#8FD86A" stroke="#3D3350" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M32 20 C40 4 56 8 53 18 C50 27 38 24 32 20 Z" fill="#B5EA8C" stroke="#3D3350" strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="32" cy="40" rx="20" ry="18" fill="#FFE9A8" stroke="#3D3350" strokeWidth="2.5" />
        <Face ink="#3D3350" blush="#FFA8B8" ex={[25, 39]} ey={38} by={45} bx={[20, 44]} mouth="M28 46 Q32 50 36 46" />
      </svg>
    );
  }
  if (world === 'starlight') {
    return (
      <svg {...common}>
        <path d="M32 4 L39.5 22.5 L59 23.5 L44 36 L49 55 L32 44.5 L15 55 L20 36 L5 23.5 L24.5 22.5 Z" fill="#FFE173" stroke="#2A1F57" strokeWidth="2.5" strokeLinejoin="round" />
        <Face ink="#2A1F57" blush="#FF9DCB" ex={[27, 37]} ey={31} by={37} bx={[22.5, 41.5]} mouth="M29 37.5 Q32 40.5 35 37.5" small />
      </svg>
    );
  }
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const r = (a * Math.PI) / 180;
    return <path key={a} d={`M${32 + 21 * Math.cos(r)} ${32 + 21 * Math.sin(r)} L${32 + 29 * Math.cos(r)} ${32 + 29 * Math.sin(r)}`} stroke="#FF9F43" strokeWidth="4" strokeLinecap="round" />;
  });
  return (
    <svg {...common}>
      {rays}
      <circle cx="32" cy="32" r="18" fill="#FFC93C" stroke="#2B2B3A" strokeWidth="2.5" />
      <path d="M24.5 30 Q26.5 27.5 28.5 30 M35.5 30 Q37.5 27.5 39.5 30" fill="none" stroke="#2B2B3A" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="22.5" cy="35.5" rx="3" ry="1.9" fill="#FF7A6B" fillOpacity="0.7" />
      <ellipse cx="41.5" cy="35.5" rx="3" ry="1.9" fill="#FF7A6B" fillOpacity="0.7" />
      <path d="M27 37 Q32 42 37 37" fill="none" stroke="#2B2B3A" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Face({ ink, blush, ex, ey, bx, by, mouth, small }: { ink: string; blush: string; ex: [number, number]; ey: number; bx: [number, number]; by: number; mouth: string; small?: boolean }) {
  const rx = small ? 2.4 : 2.6, ry = small ? 3.2 : 3.4;
  return (
    <>
      {ex.map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={ey} rx={rx} ry={ry} fill={ink} />
          <circle cx={x + 0.8} cy={ey - 1.2} r="0.9" fill="#fff" />
        </g>
      ))}
      {bx.map((x) => <ellipse key={x} cx={x} cy={by} rx={small ? 3 : 3.6} ry={small ? 1.8 : 2.2} fill={blush} />)}
      <path d={mouth} fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
    </>
  );
}
