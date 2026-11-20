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
  const contentRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const supportRef = useRef<HTMLParagraphElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<DotCanvasControl | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    const support = supportRef.current;
    if (!section || !title || !support) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;
    let titleLines: SplitLines | null = null;
    let ctaGone = false;
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
      if (bg)
        bg.style.transform = `translate3d(0, ${-p * (bg.offsetHeight - vh)}px, 0)`;

      // Text track: headline 1 scrolls up and away (faster than the background → parallax).
      // Headline 2 is held in place (it cancels the track), so it never rises through the ground.
      const tp = clamp01(scrolled / (travel * 0.8));
      const offset = vh * (window.innerWidth >= 768 ? 0.9 : 0.8);
      if (trackRef.current)
        trackRef.current.style.transform = `translate3d(0, ${-offset * tp}px, 0)`;
      if (supportRef.current)
        supportRef.current.style.transform = `translate3d(0, ${offset * tp}px, 0)`;

      // Headline 1 dissolves line by line while it scrolls away and headline 2 arrives.
      if (titleLines) {
        const n = titleLines.moves.length;
        // A line also fades by position, so it is gone before it slides under the header.
        const near = (el: HTMLElement) => ss(vh * 0.3, 88, el.getBoundingClientRect().top);
        titleLines.moves.forEach((m, i) => {
          const k = Math.max(ss(0.1 + i * 0.05, 0.36 + i * 0.05, tp), near(titleLines!.masks[i]));
          m.style.opacity = k ? String(1 - k) : "";
          m.style.filter = k ? `blur(${(k * 6).toFixed(2)}px)` : "";
        });
        const cta = ctaRef.current;
        if (cta) {
          const k = Math.max(ss(0.1 + n * 0.05, 0.36 + n * 0.05, tp), near(cta));
          cta.style.opacity = String(1 - k);
          cta.style.visibility = k > 0.99 ? "hidden" : "visible";
          // Tell the header (same frame, no polling) when the hero CTA hands over.
          const gone = k > 0.5;
          if (gone !== ctaGone) {
            ctaGone = gone;
            window.dispatchEvent(
              new CustomEvent("hero-cta", { detail: { gone } }),
            );
          }
        }
      }
      // Headline 2 comes in from above once headline 1 has gone: each line settles down a little
      // into place while it comes into focus.
      if (supportLines) {
        supportLines.moves.forEach((m, i) => {
          const k = ss(0.45 + i * 0.07, 0.85 + i * 0.07, tp);
          m.style.transform = k < 1 ? `translate3d(0, ${(-(1 - k) * 0.5).toFixed(3)}em, 0)` : "";
          m.style.opacity = String(k);
          m.style.filter = k < 1 ? `blur(${((1 - k) * 12).toFixed(2)}px)` : "";
        });
      }

      // The whole illustration (ground + towers) drifts up together, in design units.
      // The ground data continues below the view, so no gap opens at the bottom.
      const drift = -p * (window.innerWidth >= 1280 ? 72 : 32);
      dotsRef.current?.setLayerOffset(0, 0, drift);
      dotsRef.current?.setLayerOffset(1, 0, drift);
      dotsRef.current?.setMorph(ss(0.2, 0.8, p));

      // Next section slides over: the blue stays full-bleed, only what sits on it recedes.
      const content = contentRef.current;
      if (content) {
        content.style.transform = c ? `scale(${1 - 0.1 * c})` : "";
        content.style.filter =
          c && !reduce ? `blur(${(c * 8).toFixed(2)}px)` : "";
      }
      if (dimRef.current) dimRef.current.style.opacity = String(c * 0.55);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const stopTitle = watchLines(title, (s) => {
      titleLines = s;
      title.dataset.reveal = reduce ? "in" : "out";
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (title.dataset.reveal = "in")),
      );
      update();
    });
    const stopSupport = watchLines(support, (s) => {
      supportLines = s;
      for (const m of s.masks) m.style.overflow = "visible";
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
    <section
      ref={sectionRef}
      id="top"
      data-header="dark"
      className="relative h-[350svh] bg-blue-975 text-on-dark"
    >
      <div className="sticky top-0 h-svh min-h-[560px] overflow-hidden">
        <div className="relative isolate h-full overflow-hidden">
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
              style={{
                background:
                  "radial-gradient(closest-side, var(--color-cyan-400), transparent)",
              }}
            />
            <div
              className="absolute inset-0 opacity-20 mix-blend-overlay"
              style={{ backgroundImage: GRAIN }}
            />
          </div>

          {/* Everything on the blue: scales and blurs as the next section covers the hero. */}
          <div
            ref={contentRef}
            className="absolute inset-0 flex flex-col"
            style={{ transformOrigin: "50% 45%" }}
          >
            <div className="container-page relative z-10 grid flex-1 content-start pt-28 md:pt-40 xl:content-center xl:pt-24 xl:pb-32">
              <div
                ref={trackRef}
                className="col-start-1 row-start-1 grid will-change-transform"
              >
                <div className="col-start-1 row-start-1">
                  <h1 ref={titleRef} className="max-w-[15ch] text-display-l">
                    {t.title}
                  </h1>
                  {/* Outer: scroll-driven fade. Inner: intro animation (its fill would override inline opacity). */}
                  <div ref={ctaRef} data-hero-cta className="mt-10">
                    <div className="flex animate-reveal flex-wrap gap-3 [animation-delay:450ms]">
                      <ButtonLink href="#apply" variant="light">
                        {t.apply}
                      </ButtonLink>
                    </div>
                  </div>
                </div>
                <p
                  ref={supportRef}
                  className="invisible col-start-1 row-start-1 max-w-[15ch] text-display-l"
                >
                  {t.support}
                </p>
              </div>
            </div>

            <div
              ref={artRef}
              className="relative mt-auto w-full shrink-0 xl:absolute xl:right-0 xl:bottom-0 xl:max-w-[1440px]"
            >
              <HeroArt className="w-full" controlRef={dotsRef} />
            </div>
          </div>

          <div
            ref={dimRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20 bg-blue-975 opacity-0"
          />
        </div>
      </div>
    </section>
  );
}
