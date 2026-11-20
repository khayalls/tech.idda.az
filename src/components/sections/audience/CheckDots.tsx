"use client";

import { useEffect, useRef, useState } from "react";

// 7 × 7 dot check mark.
const CHECK = [
  ".......",
  "......#",
  ".....#.",
  "#...#..",
  ".#.#...",
  "..#....",
  ".......",
];
const DOTS = CHECK.flatMap((row, j) =>
  [...row].flatMap((ch, i) => (ch === "#" ? [{ cx: i * 3 + 1.5, cy: j * 3 + 1.5, d: i + j }] : [])),
);

/**
 * Dot-matrix check for the "Who can apply" lists. Unlit dots show the 7 × 7 board; the check's
 * dots light up along the stroke when the row scrolls into view (CSS .dot-reveal).
 */
export function CheckDots({ className }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -15% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 21 21" className={className} aria-hidden="true" data-active={on || undefined}>
      <g fill="rgb(255 255 255 / 0.14)">
        {Array.from({ length: 49 }, (_, k) => (
          <circle key={k} cx={(k % 7) * 3 + 1.5} cy={Math.floor(k / 7) * 3 + 1.5} r={0.45} />
        ))}
      </g>
      <g className="dot-reveal" fill="#8DB1EE">
        {DOTS.map((p, k) => (
          <circle key={k} cx={p.cx} cy={p.cy} r={1.2} style={{ ["--d" as string]: p.d }} />
        ))}
      </g>
    </svg>
  );
}
