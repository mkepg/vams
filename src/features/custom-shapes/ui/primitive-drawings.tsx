import type { PrimitiveType } from '@/core/types/scene';

/** Small line drawings of what each primitive produces, in the current text colour. */
const PATHS: Record<PrimitiveType, { d: string; fill?: boolean; dots?: [number, number][] }> = {
  POINTS: { d: '', dots: [[7, 21], [15, 8], [25, 17], [34, 7]] },
  LINES: { d: 'M4 22 L16 6 M22 22 L36 10', dots: [[4, 22], [16, 6], [22, 22], [36, 10]] },
  LINE_STRIP: { d: 'M4 22 L14 7 L24 20 L36 6' },
  LINE_LOOP: { d: 'M6 22 L13 6 L31 8 L35 22 Z' },
  TRIANGLES: { d: 'M3 24 L11 6 L19 24 Z M21 24 L29 6 L37 24 Z', fill: true },
  TRIANGLE_STRIP: { d: 'M4 24 L10 6 L16 24 L22 6 L28 24 L34 6 M10 6 H34 M4 24 H28', fill: false },
  TRIANGLE_FAN: { d: 'M20 25 L4 14 L10 5 L20 3 L30 5 L36 14 Z M20 25 L10 5 M20 25 L20 3 M20 25 L30 5' },
  QUADS: { d: 'M3 8 H17 V22 H3 Z M23 8 H37 V22 H23 Z', fill: true },
  QUAD_STRIP: { d: 'M4 6 H36 M4 24 H36 M4 6 V24 M14 6 V24 M25 6 V24 M36 6 V24' },
  POLYGON: { d: 'M20 3 L36 13 L30 25 L10 25 L4 13 Z', fill: true },
};

export function PrimitiveDrawing({ type }: { type: PrimitiveType }) {
  const { d, fill, dots } = PATHS[type];
  return (
    <svg className="primitive-drawing" viewBox="0 0 40 28" width="40" height="28" aria-hidden="true">
      {d && (
        <path
          d={d}
          fill={fill ? 'currentColor' : 'none'}
          fillOpacity={fill ? 0.14 : undefined}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {dots?.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2" fill="currentColor" />)}
    </svg>
  );
}
