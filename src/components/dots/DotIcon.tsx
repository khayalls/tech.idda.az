/**
 * Dot-matrix icons: hand-drawn 11×11 bitmaps, one dot per cell, every dot the same size —
 * crisp one-dot strokes, the same language as the LED countdown. Static SVG, brand dot gradient.
 */

export const ICONS = {
  // Hire globally — globe
  globe: [
    "...#####...",
    ".##..#..##.",
    ".#..#.#..#.",
    "#..#...#..#",
    "#..#...#..#",
    "###########",
    "#..#...#..#",
    "#..#...#..#",
    ".#..#.#..#.",
    ".##..#..##.",
    "...#####...",
  ],
  // Lighter social insurance — shield with a check
  shield: [
    ".....#.....",
    "...##.##...",
    ".##.....##.",
    ".#.....#.#.",
    ".#....#..#.",
    ".#.#.#...#.",
    ".#..#....#.",
    ".#.......#.",
    "..#.....#..",
    "...#...#...",
    "....###....",
  ],
  // Government as a first customer — classical building
  building: [
    ".....#.....",
    "...##.##...",
    ".##.....##.",
    "###########",
    "...........",
    ".#..#.#..#.",
    ".#..#.#..#.",
    ".#..#.#..#.",
    ".#..#.#..#.",
    "...........",
    "###########",
  ],
  // Cheaper cloud and software — cloud
  cloud: [
    "...........",
    "...........",
    ".....###...",
    "....#...#..",
    ".###.....#.",
    "#........##",
    "#.........#",
    "#.........#",
    ".#########.",
    "...........",
    "...........",
  ],
  // Export support — arrow leaving a box
  export: [
    "......#####",
    ".........##",
    "####....#.#",
    "#......#..#",
    "#.....#...#",
    "#....#.....",
    "#...#......",
    "#.......#..",
    "#.......#..",
    "#.......#..",
    "#########..",
  ],
  // Regulatory sandbox — cube
  sandbox: [
    ".....#.....",
    "...##.##...",
    ".##.....##.",
    "#.##...##.#",
    "#...###...#",
    "#....#....#",
    "#....#....#",
    "#....#....#",
    ".##..#..##.",
    "...#####...",
    ".....#.....",
  ],
} as const;

export type IconName = keyof typeof ICONS;

const N = 11;
const PITCH = 48 / N;
const R = PITCH * 0.36;

type Props = { name: IconName; className?: string; id: string };

/** 48×48 dot icon. Dots carry `--d` (distance from centre) for staggered reveal animations. */
export function DotIcon({ name, className, id }: Props) {
  const rows = ICONS[name];
  const grad = `dot-grad-${id}`;
  const dots: { cx: number; cy: number; d: number }[] = [];
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch === "#") dots.push({ cx: (i + 0.5) * PITCH, cy: (j + 0.5) * PITCH, d: Math.hypot(i - 5, j - 5) });
    }),
  );
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0" stopColor="var(--color-cyan-400)" />
          <stop offset="0.5" stopColor="var(--color-blue-700)" />
          <stop offset="1" stopColor="var(--color-blue-950)" />
        </linearGradient>
      </defs>
      <g fill={`url(#${grad})`}>
        {dots.map((p, k) => (
          <circle
            key={k}
            cx={p.cx.toFixed(2)}
            cy={p.cy.toFixed(2)}
            r={R.toFixed(2)}
            style={{ ["--d" as string]: p.d.toFixed(2) }}
          />
        ))}
      </g>
    </svg>
  );
}
