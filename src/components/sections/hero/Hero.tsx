"use client";

import { useEffect, useRef } from "react";
import { ButtonLink } from "@/components/ui/Button";
import type { DotCanvasControl } from "@/components/dots/DotCanvas";
import type { Dictionary } from "@/i18n/dictionaries";
import { watchLines, type SplitLines } from "@/lib/split-lines";
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

/** Viewports the next section takes to slide over the pinned hero (see Mission: -mt-[100svh]). */
const COVER = 1;

/**
 * Pinned hero (Figma 01 — Hero, 1440×1506 background). While it scrolls:
 *  1. the tall background travels up faster than the page and darkens,
 *  2. headline 1 leaves line by line, headline 2 arrives line by line,
 *  3. the Flame Towers morph into the Maiden Tower and drift slowly upwards,
 *  4. the next section slides over it; the stage recedes (scale, blur, dim).
 */
export function Hero({ t }: { t: Dictionary["hero"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLParagraphElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<DotCanvasControl | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    const support = supportRef.current;
    if (!section || !title || !support) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let titleLines: SplitLines | null = null;
    let supportLines: SplitLines | null = null;

    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const cover = vh * COVER;
      const travel = Math.max(1, rect.height - vh - cover);
      const scrolled = -rect.top;
      const p = clamp01(scrolled / travel);
      const c = clamp01((scrolled - travel) / cover);

      const bg = bgRef.current;
      if (bg) bg.style.transform = `translate3d(0, ${-p * (bg.offsetHeight - vh)}px, 0)`;

      // Headline 1 lifts out of its masks, line by line.
      if (titleLines) {
        const n = titleLines.moves.length;
        titleLines.moves.forEach((m, i) => {
          const k = ss(0.12 + i * 0.035, 0.28 + i * 0.035, p);
          m.style.transform = k ? `translate3d(0, ${-k * 110}%, 0)` : "";
          m.style.opacity = k ? String(1 - k) : "";
        });
        const cta = ctaRef.current;
        if (cta) {
          const k = ss(0.12 + n * 0.035, 0.3 + n * 0.035, p);
          cta.style.transform = `translate3d(0, ${-k * 24}px, 0)`;
          cta.style.opacity = String(1 - k);
          cta.style.visibility = k > 0.99 ? "hidden" : "visible";
        }
      }
      // Headline 2 rises in, line by line.
      if (supportLines) {
        supportLines.moves.forEach((m, i) => {
          const k = ss(0.42 + i * 0.04, 0.6 + i * 0.04, p);
          m.style.transform = `translate3d(0, ${(1 - k) * 110}%, 0)`;
          m.style.opacity = String(k);
        });
      }

      const drift = window.innerWidth >= 1280 ? 0.12 : 0.03;
      const art = artRef.current;
      if (art) art.style.transform = `translate3d(0, ${-p * drift * art.offsetHeight}px, 0)`;
      dotsRef.current?.setMorph(ss(0.2, 0.8, p));

      // Next section slides over: the stage recedes.
      const stage = stageRef.current;
      if (stage) {
        stage.style.transform = c ? `translate3d(0, ${-c * 4}vh, 0) scale(${1 - 0.07 * c})` : "";
        stage.style.filter = c && !reduce ? `blur(${(c * 10).toFixed(2)}px)` : "";
        stage.style.borderRadius = c ? `${Math.round(c * 32)}px` : "";
      }
      if (dimRef.current) dimRef.current.style.opacity = String(c * 0.55);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const stopTitle = watchLines(title, (s) => {
      titleLines = s;
      title.dataset.reveal = reduce ? "in" : "out";
      requestAnimationFrame(() => requestAnimationFrame(() => (title.dataset.reveal = "in")));
      update();
    });
    const stopSupport = watchLines(support, (s) => {
      supportLines = s;
      support.style.visibility = "visible";
      update();
    });

    // The dot canvas registers its control asynchronously; sync once it is ready.
    const sync = window.setInterval(() => {
      if (dotsRef.current) {
        update();
        window.clearInterval(sync);
      }
    }, 100);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      stopTitle();
      stopSupport();
      if (raf) cancelAnimationFrame(raf);
      window.clearInterval(sync);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section ref={sectionRef} id="top" data-header="dark" className="relative h-[350svh] bg-blue-975 text-on-dark">
      <div className="sticky top-0 h-svh min-h-[560px] overflow-hidden">
        <div
          ref={stageRef}
          className="relative isolate flex h-full flex-col overflow-hidden will-change-transform"
          style={{ transformOrigin: "50% 100%" }}
        >
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
            <div className="col-start-1 row-start-1">
              <h1 ref={titleRef} className="max-w-[15ch] text-display-l">
                {t.title}
              </h1>
              <div
                ref={ctaRef}
                className="mt-10 flex animate-reveal flex-wrap gap-3 will-change-transform [animation-delay:450ms]"
              >
                <ButtonLink href="#apply" variant="light">
                  {t.apply}
                </ButtonLink>
                <ButtonLink href="#benefits" variant="glass">
                  {t.explore}
                </ButtonLink>
              </div>
            </div>
            <p ref={supportRef} className="invisible col-start-1 row-start-1 max-w-[15ch] text-display-l">
              {t.support}
            </p>
          </div>

          <div
            ref={artRef}
            className="relative mt-auto w-full shrink-0 will-change-transform xl:absolute xl:right-0 xl:bottom-0 xl:w-[79.2%] xl:max-w-[1140px]"
          >
            <HeroArt className="w-full" controlRef={dotsRef} />
          </div>

          <div ref={dimRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 bg-blue-975 opacity-0" />
        </div>
      </div>
    </section>
  );
}
