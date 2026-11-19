"use client";

import { useEffect, useRef } from "react";
import { DotGlobe, type DotGlobeControl } from "@/components/dots/DotGlobe";
import type { Dictionary } from "@/i18n/dictionaries";
import { watchLines, type SplitLines } from "@/lib/split-lines";

const AZ = { lon: 47.7, lat: 40.25 };
const START = { lon: 18, lat: 14 }; // Europe / Africa facing, as in the Figma globe
/** Azerbaijan's apparent width on the sphere (rad) — used to size the final close-up. */
const AZ_WIDTH = 0.075;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Shortest signed angle from a to b (degrees). */
const angleTo = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

/**
 * 02 — Mission. A light sheet that slides over the pinned hero. Pinned inside:
 *  1. the headline drifts up and dissolves line by line,
 *  2. the dot globe rises, turns and zooms towards Azerbaijan,
 *  3. the rest of the map softens while Azerbaijan turns brand blue and grows slightly.
 */
export function Mission({ t }: { t: Dictionary["mission"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const globeRef = useRef<DotGlobeControl | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    if (!section || !title) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lines: SplitLines | null = null;
    let raf = 0;
    let visible = false;
    let spin = 0;
    let lastT = performance.now();

    const frame = (now: number) => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const q = clamp01(-rect.top / Math.max(1, rect.height - vh));

      // Idle spin while the globe is small; it hands over to scroll-driven rotation.
      const dt = Math.min(64, now - lastT);
      lastT = now;
      const idle = 1 - ss(0, 0.25, q);
      if (!reduce) spin += (dt / 1000) * 5 * idle;

      // Rounded top corners flatten as the sheet lands.
      const radiusPx = Math.round(32 * clamp01(rect.top / (vh * 0.25)));
      if (stageRef.current) stageRef.current.style.borderRadius = `${radiusPx}px ${radiusPx}px 0 0`;

      // Headline: drifts up and dissolves line by line (opacity + blur), before the globe arrives.
      title.style.transform = `translate3d(0, ${-ss(0, 0.3, q) * vh * 0.18}px, 0)`;
      if (lines) {
        lines.moves.forEach((m, i) => {
          const k = ss(0.03 + i * 0.045, 0.2 + i * 0.045, q);
          m.style.opacity = k ? String(1 - k) : "";
          m.style.filter = k ? `blur(${(k * 8).toFixed(2)}px)` : "";
        });
      }

      const g = globeRef.current;
      if (g) {
        const { w, h } = g.size();
        const mobile = w < 768;
        const turn = ss(0.1, 0.55, q);
        const zoom = ss(0.18, 0.86, q);
        const startLon = START.lon + spin;
        const R0 = Math.min(w * (mobile ? 0.46 : 0.36), h * 0.38);
        // Close-up: Azerbaijan about a quarter of the width (half on phones), map still around it.
        const R1 = (w * (mobile ? 0.5 : 0.24)) / AZ_WIDTH;
        g.setView({
          lon: startLon + angleTo(startLon, AZ.lon) * turn,
          lat: lerp(START.lat, AZ.lat, turn),
          radius: R0 * Math.pow(R1 / R0, zoom),
          cx: w / 2,
          cy: lerp(h * (mobile ? 0.74 : 0.76), h * 0.52, ss(0.12, 0.5, q)),
          highlight: ss(0.5, 0.8, q),
          ink: lerp(1, 0.45, ss(0.4, 0.85, q)),
        });
      }

      if (visible && !reduce && idle > 0.001) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const stop = watchLines(title, (s) => {
      lines = s;
      if (title.dataset.reveal !== "in") title.dataset.reveal = reduce ? "in" : "out";
      kick();
    });
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) {
          if (title.dataset.reveal !== "in")
            requestAnimationFrame(() => requestAnimationFrame(() => (title.dataset.reveal = "in")));
          lastT = performance.now();
          kick();
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(section);
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      stop();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="why-azerbaijan"
      data-header="light"
      className="relative z-10 -mt-[100svh] h-[300svh] text-primary"
    >
      <div
        ref={stageRef}
        className="sticky top-0 h-svh overflow-hidden rounded-t-lg bg-page shadow-[0_-40px_60px_-20px_rgb(3_10_38/0.4)]"
      >
        <DotGlobe controlRef={globeRef} className="absolute inset-0 size-full" />
        <div className="container-page relative flex flex-col items-center pt-28 md:pt-36 xl:pt-40">
          <h2 ref={titleRef} className="max-w-[22ch] text-center text-heading-xl will-change-transform">
            {t.title}
          </h2>
        </div>
      </div>
    </section>
  );
}
