"use client";

import { useEffect, useRef } from "react";
import { AudienceArt, type AudienceArtControl, type AudienceArtName } from "@/components/dots/AudienceArt";
import type { Dictionary } from "@/i18n/dictionaries";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Film grain over the gradient, as in the hero.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Section height in viewports: reveal (1) + hold + cover by the next sheet (1). */
const LENGTH = 3.4;

/**
 * 07 — Who can apply. A back layer like the hero: it sits pinned underneath, the white "More than
 * tax" sheet slides up off it (-mt-[100svh] overlap), and the next sheet slides over it at the end.
 *  · reveal: the content comes forward from depth (scale up, unblur, undim),
 *  · the three illustrations grow in one after another, then keep living (lights, typing, flight),
 *  · cover: the content recedes again (scale down, blur, dim) under the next sheet.
 */
export function Audience({ t }: { t: Dictionary["audience"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const art0 = useRef<AudienceArtControl | null>(null);
  const art1 = useRef<AudienceArtControl | null>(null);
  const art2 = useRef<AudienceArtControl | null>(null);
  const arts = [art0, art1, art2];

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const controls = [art0, art1, art2];
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const s = -section.getBoundingClientRect().top / vh; // viewports scrolled into the section
      const reveal = ss(0, 1, s);
      const cover = ss(LENGTH - 2, LENGTH - 1, s);
      // From depth → in place → back into depth.
      const depth = Math.max(1 - reveal, cover);
      const content = contentRef.current;
      if (content) {
        content.style.transform = depth ? `translate3d(0, ${((1 - reveal) * 4).toFixed(2)}vh, 0) scale(${1 - 0.1 * depth})` : "";
        content.style.filter = depth && !reduce ? `blur(${(depth * 8).toFixed(2)}px)` : "";
      }
      if (dimRef.current) dimRef.current.style.opacity = String(depth * 0.55);
      controls.forEach((c, i) => c.current?.setAppear(reduce ? 1 : ss(0.45 + i * 0.12, 1.15 + i * 0.12, s)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // Illustrations register their controls after mount.
    const first = requestAnimationFrame(update);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(first);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="who-can-apply"
      data-header="dark"
      className="relative z-0 -mt-[100svh] bg-blue-975 text-on-dark"
      style={{ height: `${LENGTH * 100}svh` }}
    >
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* Figma "Gradient": cyan glow top left, brand blue top right, night blue below. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-0"
          style={{
            background:
              "radial-gradient(48% 62% at 0% 0%, color-mix(in oklab, var(--color-cyan-400) 85%, transparent), transparent 72%)," +
              "radial-gradient(60% 55% at 100% 0%, color-mix(in oklab, var(--color-blue-700) 90%, transparent), transparent 75%)," +
              "linear-gradient(180deg, #16336f 0%, #0e2556 45%, #0b1e4a 75%, var(--color-blue-950) 100%)",
          }}
        >
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        </div>

        <div
          ref={contentRef}
          className="relative flex h-full flex-col justify-start pt-24 will-change-transform md:justify-center md:pt-0"
          style={{ transformOrigin: "50% 45%" }}
        >
          <div className="container-page flex flex-col gap-6 md:gap-16">
            <h2 className="text-center text-heading-xl md:text-display-l">{t.title}</h2>
            <ul className="grid gap-5 md:grid-cols-3 md:gap-6 xl:gap-12">
              {t.items.map((item, i) => (
                <li key={item.title} className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-8">
                  <AudienceArt
                    name={item.art as AudienceArtName}
                    controlRef={arts[i]}
                    className="aspect-[395/252] w-[34%] shrink-0 md:w-full"
                  />
                  <div className="flex flex-col gap-1 md:gap-2 md:px-1">
                    <h3 className="text-heading-s md:text-heading-m">{item.title}</h3>
                    <p className="text-body-s text-white/70 md:text-body-l">{item.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div ref={dimRef} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-blue-975 opacity-0" />
      </div>
    </section>
  );
}
