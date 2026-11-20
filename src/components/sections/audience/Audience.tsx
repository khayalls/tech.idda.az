"use client";

import { useEffect, useRef } from "react";
import { IconMorph, type IconMorphControl } from "@/components/dots/IconMorph";
import type { Dictionary } from "@/i18n/dictionaries";
import { CheckDots } from "./CheckDots";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Film grain over the gradient, as in the hero.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * 07 — Who can apply. A back layer: the "More than tax" sheet slides up off it, and the FAQ sheet
 * slides over it at the end.
 *  · Left: a pinned halftone visual (pointer lens) that transforms into the scene of whichever
 *    applicant block is in the middle of the screen — towers, laptop, globe.
 *  · Right: the three applicant types, each with its conditions as a list with dot checks.
 *  · While the sheet above uncovers it the content waits in place and comes forward from depth;
 *    while the next sheet covers it, it recedes again.
 */
export function Audience({ t }: { t: Dictionary["audience"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<IconMorphControl | null>(null);
  const blocksRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const rect = section.getBoundingClientRect();
      const s = -rect.top / vh; // viewports scrolled into the section
      // Uncover: content holds still (counter-scroll) and comes forward from depth.
      const reveal = ss(0, 1, s);
      // Cover: the next sheet's top enters when the section bottom is two screens from the top.
      const cover = ss(0, 1, (2 * vh - rect.bottom) / vh);
      const depth = Math.max(1 - reveal, cover);
      const content = contentRef.current;
      if (content) {
        // The content's own place is one screen down (after the pinned background); while the
        // sheet above uncovers it, it is lifted to the top so it seems to wait underneath. Once
        // uncovered no transform remains, so the pinned visual inside behaves normally.
        const lift = reveal < 1 ? (Math.min(1, Math.max(0, s)) - 1) * vh : 0;
        // At the end the content sticks with its bottom on the screen's bottom edge (negative
        // sticky top), so the next sheet slides over it instead of both scrolling away together.
        content.style.top = `${Math.min(0, vh - content.offsetHeight)}px`;
        const scale = 1 - 0.08 * depth;
        content.style.transform = depth > 0.001 ? `translate3d(0, ${lift.toFixed(1)}px, 0) scale(${scale.toFixed(4)})` : "";
        content.style.filter = !reduce && depth > 0.001 ? `blur(${(depth * 8).toFixed(2)}px)` : "";
      }
      if (dimRef.current) dimRef.current.style.opacity = String(depth * 0.55);

      // Visual: whole when a block's centre is mid-screen, transforming half-way between blocks.
      const centers = blocksRef.current.map((b) => {
        if (!b) return 0;
        const r = b.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      const mid = vh / 2;
      let pos = 0;
      if (centers.length) {
        if (mid >= centers[centers.length - 1]) pos = centers.length - 1;
        else
          for (let i = 0; i < centers.length - 1; i++) {
            if (mid >= centers[i] && mid < centers[i + 1]) {
              pos = i + ss(0.3, 0.7, (mid - centers[i]) / (centers[i + 1] - centers[i]));
              break;
            }
          }
      }
      visualRef.current?.setPosition(pos);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const first = requestAnimationFrame(update);
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
    >
      {/* Pinned background (Figma "Gradient"): cyan glow top left, brand blue top right. */}
      <div aria-hidden="true" className="sticky top-0 h-svh overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(48% 62% at 0% 0%, color-mix(in oklab, var(--color-cyan-400) 85%, transparent), transparent 72%)," +
              "radial-gradient(60% 55% at 100% 0%, color-mix(in oklab, var(--color-blue-700) 90%, transparent), transparent 75%)," +
              "linear-gradient(180deg, #16336f 0%, #0e2556 45%, #0b1e4a 75%, var(--color-blue-950) 100%)",
          }}
        />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      </div>

      <div
        ref={contentRef}
        className="sticky"
        style={{ transformOrigin: "50% 50%" }}
      >
        <div className="container-page pt-28 pb-24 md:pt-32">
          <h2 className="text-center text-heading-xl md:text-display-l">{t.title}</h2>

          <div className="grid-page mt-12 md:mt-16">
            <div className="hidden md:col-span-4 md:block xl:col-span-5">
              <div className="sticky top-[max(112px,calc(50svh-220px))]">
                <IconMorph
                  names={t.items.map((item) => item.art)}
                  tone="dark"
                  controlRef={visualRef}
                  className="block aspect-square w-full max-w-[min(440px,56svh)]"
                />
              </div>
            </div>

            <div className="col-span-full flex flex-col gap-24 md:col-span-4 md:gap-40 xl:col-span-6 xl:col-start-7">
              {t.items.map((item, i) => (
                <div
                  key={item.title}
                  ref={(el) => {
                    blocksRef.current[i] = el;
                  }}
                  className="flex flex-col gap-3"
                >
                  <h3 className="text-heading-m">{item.title}</h3>
                  <p className="text-body-s text-white/60">{item.body}</p>
                  <ul className="mt-5 flex flex-col gap-4">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-body-s text-white/90">
                        <CheckDots className="mt-0.5 size-5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Room for the next sheet to slide over the pinned content. */}
      <div aria-hidden="true" className="h-svh" />

      <div
        ref={dimRef}
        aria-hidden="true"
        className="pointer-events-none sticky bottom-0 -mt-[100svh] h-svh bg-blue-975 opacity-0"
      />
    </section>
  );
}
