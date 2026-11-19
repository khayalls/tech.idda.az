"use client";

import { useEffect, useRef } from "react";
import { DotGlobe, type DotGlobeControl } from "@/components/dots/DotGlobe";
import type { Dictionary } from "@/i18n/dictionaries";
import { watchLines, type SplitLines } from "@/lib/split-lines";

const AZ = { lon: 47.6, lat: 40.3 };
const START = { lon: 18, lat: 14 }; // Europe / Africa facing, as in the Figma globe

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Shortest signed angle from a to b (degrees). */
const angleTo = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

/**
 * 02 — Mission. A light sheet that slides over the pinned hero (negative top margin = the
 * hero's cover distance). Pinned inside, the dot globe turns and zooms towards Azerbaijan,
 * rises over the headline, and lights the country up in brand blue.
 */
export function Mission({ t }: { t: Dictionary["mission"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
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
    let q = 0;

    const frame = (now: number) => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      q = clamp01(-rect.top / Math.max(1, rect.height - vh));

      // Idle spin while the globe is small; it hands over to scroll-driven rotation.
      const dt = Math.min(64, now - lastT);
      lastT = now;
      const idle = 1 - ss(0, 0.3, q);
      if (!reduce) spin += (dt / 1000) * 5 * idle;

      // Rounded top corners flatten as the sheet lands.
      const radiusPx = Math.round(32 * clamp01(rect.top / (vh * 0.25)));
      if (stageRef.current) stageRef.current.style.borderRadius = `${radiusPx}px ${radiusPx}px 0 0`;

      const g = globeRef.current;
      if (g) {
        const { w, h } = g.size();
        const turn = ss(0.04, 0.62, q);
        const zoom = ss(0.14, 0.78, q);
        const startLon = START.lon + spin;
        const lon = startLon + angleTo(startLon, AZ.lon) * turn;
        const lat = lerp(START.lat, AZ.lat, turn);
        const mobile = w < 768;
        const R0 = Math.min(w * (mobile ? 0.46 : 0.36), h * 0.38);
        const R1 = Math.max(w, h) * (mobile ? 2.4 : 1.6);
        const radius = R0 * Math.pow(R1 / R0, zoom);
        const cy = lerp(h * (mobile ? 0.74 : 0.76), h * 0.52, ss(0.08, 0.5, q));
        g.setView({ lon, lat, radius, cx: w / 2, cy, highlight: ss(0.55, 0.8, q), ink: lerp(1, 0.5, zoom) });
      }

      // Headline lifts away line by line as the globe rises over it.
      if (lines) {
        lines.moves.forEach((m, i) => {
          const k = ss(0.14 + i * 0.04, 0.32 + i * 0.04, q);
          m.style.transform = k ? `translate3d(0, ${-k * 110}%, 0)` : "";
          m.style.opacity = k ? String(1 - k) : "";
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
          if (title.dataset.reveal !== "in") requestAnimationFrame(() => requestAnimationFrame(() => (title.dataset.reveal = "in")));
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

  // Keep the country label pinned to Azerbaijan after every globe draw.
  const onDraw = () => {
    const g = globeRef.current;
    const label = labelRef.current;
    const section = sectionRef.current;
    if (!g || !label || !section) return;
    const rect = section.getBoundingClientRect();
    const q = clamp01(-rect.top / Math.max(1, rect.height - window.innerHeight));
    const p = g.project(AZ.lon, AZ.lat);
    const o = ss(0.68, 0.84, q);
    if (!p || o <= 0) {
      label.style.opacity = "0";
      return;
    }
    label.style.opacity = String(o);
    label.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, calc(-100% - 24px)) translateY(${(1 - o) * 8}px)`;
  };

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
        <DotGlobe controlRef={globeRef} onDraw={onDraw} className="absolute inset-0 size-full" />
        <div className="container-page relative flex flex-col items-center pt-28 md:pt-36 xl:pt-40">
          <h2 ref={titleRef} className="max-w-[22ch] text-center text-heading-xl">
            {t.title}
          </h2>
        </div>
        <div
          ref={labelRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-label-m text-primary opacity-0 shadow-[0_8px_32px_rgb(10_26_77/0.16)]"
        >
          <span className="size-2 rounded-full bg-accent shadow-[0_0_0_4px_var(--color-blue-100)]" />
          {t.country}
        </div>
      </div>
    </section>
  );
}
