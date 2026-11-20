"use client";

import { useEffect, useRef, useState } from "react";

const YEARS = 20;
const FIRST = 2027;

// Brand dot gradient (cyan-400 → blue-700 → blue-950) along the track.
const C = [
  [102, 173, 201],
  [36, 87, 176],
  [10, 26, 77],
];
const colorAt = (t: number) => {
  const [a, b, k] = t < 0.5 ? [C[0], C[1], t * 2] : [C[1], C[2], (t - 0.5) * 2];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
};

/**
 * "for 20 years" as a track of twenty dots, one per year (2027 → 2046), under the 0%. The years
 * light up one by one as the tax list scrolls past, so the duration is something you see fill,
 * not a caption. The words stay as a quiet label between the two end years.
 */
export function YearsTrack({ label, sectionId }: { label: string; sectionId: string }) {
  const [lit, setLit] = useState(0);
  const litRef = useRef(0);

  useEffect(() => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = section.getBoundingClientRect();
      const vh = window.innerHeight;
      // From the list arriving (section top at mid-screen) to its end leaving.
      const q = Math.min(1, Math.max(0, (vh * 0.5 - r.top) / Math.max(1, r.height - vh * 0.9)));
      const n = reduce ? YEARS : Math.max(1, Math.round(q * YEARS));
      if (n !== litRef.current) {
        litRef.current = n;
        setLit(n);
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sectionId]);

  const current = FIRST + Math.max(0, lit - 1);

  return (
    <div className="w-full" aria-hidden="true">
      <div className="flex items-center justify-between">
        {Array.from({ length: YEARS }, (_, i) => {
          const on = i < lit;
          const head = i === lit - 1 && lit < YEARS;
          return (
            <span
              key={i}
              className="relative block size-2 rounded-full transition-[background-color,transform] duration-500 ease-emphasized md:size-2.5"
              style={{
                backgroundColor: on ? colorAt(i / (YEARS - 1)) : "rgb(18 18 18 / 0.08)",
                transform: on ? "scale(1)" : "scale(0.7)",
              }}
            >
              {/* The newest year breathes softly while the track is still filling. */}
              {head && (
                <span
                  className="absolute inset-0 animate-ping rounded-full opacity-40"
                  style={{ backgroundColor: colorAt(i / (YEARS - 1)) }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div className="mt-3 flex items-baseline justify-between text-caption text-tertiary tabular-nums md:mt-4 md:text-body-s">
        <span>{FIRST}</span>
        <span className="text-primary">
          {label}
          {/* The year being counted; hidden once the track is full (the end label says it). */}
          <span
            className={`ml-2 inline-block min-w-[4ch] text-tertiary transition-opacity duration-300 ${
              lit < YEARS ? "opacity-100" : "opacity-0"
            }`}
          >
            · {current}
          </span>
        </span>
        <span>{FIRST + YEARS - 1}</span>
      </div>
    </div>
  );
}
