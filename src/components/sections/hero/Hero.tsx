"use client";

import { useEffect, useRef } from "react";
import { ButtonLink } from "@/components/ui/Button";
import type { DotCanvasControl } from "@/components/dots/DotCanvas";
import type { Dictionary } from "@/i18n/dictionaries";
import { HeroArt } from "./HeroArt";

// Film grain over the gradient (Figma: texture layer at 20%).
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Smoothstep between edges a and b. */
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Pinned hero (Figma 01 — Hero, 1440×1506 background).
 * While the section scrolls past, the stage stays fixed and:
 *  · the tall background travels up faster than the page and darkens towards the next section,
 *  · headline 1 (+ CTAs) hands over to headline 2,
 *  · the Flame Towers morph into the Maiden Tower and drift slowly upwards.
 */
export function Hero({ t }: { t: Dictionary["hero"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<DotCanvasControl | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    let last = -1;

    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const travel = Math.max(1, rect.height - vh);
      const p = clamp01(-rect.top / travel);
      if (Math.abs(p - last) < 0.0005) return;
      last = p;

      const bg = bgRef.current;
      if (bg) bg.style.transform = `translate3d(0, ${-p * (bg.offsetHeight - vh)}px, 0)`;

      const out = ss(0.16, 0.4, p);
      const inn = ss(0.46, 0.7, p);
      const first = firstRef.current;
      if (first) {
        first.style.opacity = String(1 - out);
        first.style.transform = `translate3d(0, ${-out * 48}px, 0)`;
        first.style.visibility = out > 0.99 ? "hidden" : "visible";
      }
      const second = secondRef.current;
      if (second) {
        second.style.opacity = String(inn);
        second.style.transform = `translate3d(0, ${(1 - inn) * 48}px, 0)`;
        second.style.visibility = inn < 0.01 ? "hidden" : "visible";
      }

      const art = artRef.current;
      // Slow upward drift; smaller on narrow screens where the art sits right under the text.
      const drift = window.innerWidth >= 1280 ? 0.12 : 0.03;
      if (art) art.style.transform = `translate3d(0, ${-p * drift * art.offsetHeight}px, 0)`;
      dotsRef.current?.setMorph(ss(0.22, 0.82, p));
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    // The dot canvas registers its control asynchronously; sync once it is ready.
    const sync = window.setInterval(() => {
      if (dotsRef.current) {
        last = -1;
        update();
        window.clearInterval(sync);
      }
    }, 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(sync);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={sectionRef} id="top" data-header="dark" className="relative h-[250svh] bg-blue-975 text-on-dark">
      <div className="sticky top-0 isolate flex h-svh min-h-[560px] flex-col overflow-hidden">
        {/* Tall background (1506/900 of the viewport) — parallax layer. */}
        <div
          ref={bgRef}
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[168%] will-change-transform"
          style={{
            background:
              "radial-gradient(60% 34% at 0% 30%, color-mix(in oklab, var(--color-blue-700) 85%, transparent), transparent 70%)," +
              "linear-gradient(180deg, var(--color-blue-600) 0%, var(--color-blue-700) 30%, var(--color-blue-900) 62%, var(--color-blue-950) 82%, var(--color-blue-975) 100%)",
          }}
        >
          <div
            className="absolute top-[-14%] right-[-15%] h-[64%] w-[80%] animate-drift rounded-full opacity-80 blur-[120px]"
            style={{ background: "radial-gradient(closest-side, var(--color-cyan-400), transparent)" }}
          />
          <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        </div>

        <div className="container-page relative z-10 grid flex-1 content-start pt-28 md:pt-40 xl:content-center xl:pt-24 xl:pb-32">
          <div ref={firstRef} className="col-start-1 row-start-1 will-change-transform">
            <h1 className="max-w-[15ch] animate-reveal text-display-l text-balance">{t.title}</h1>
            <div className="mt-10 flex animate-reveal flex-wrap gap-3 [animation-delay:150ms]">
              <ButtonLink href="#apply" variant="light">
                {t.apply}
              </ButtonLink>
              <ButtonLink href="#benefits" variant="glass">
                {t.explore}
              </ButtonLink>
            </div>
          </div>
          <div ref={secondRef} className="invisible col-start-1 row-start-1 opacity-0 will-change-transform">
            <p className="max-w-[15ch] text-display-l text-balance">{t.support}</p>
          </div>
        </div>

        <div
          ref={artRef}
          className="relative mt-auto w-full shrink-0 will-change-transform xl:absolute xl:right-0 xl:bottom-0 xl:w-[79.2%] xl:max-w-[1140px]"
        >
          <HeroArt className="w-full" controlRef={dotsRef} />
        </div>
      </div>
    </section>
  );
}
