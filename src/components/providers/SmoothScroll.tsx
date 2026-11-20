"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInQuad = (t: number) => t * t;

/** Peak strength of the warp. */
const BLUR = 14; // px, backdrop blur
const STRETCH = 0.05; // extra vertical scale of the page
const RAMP = 260; // ms: speed up
const SETTLE = 760; // ms: land on the section

/**
 * Inertial smooth scroll on top of native scroll (sticky, anchors and a11y keep working).
 * Lenis disables smoothing itself when the user prefers reduced motion.
 *
 * In-page links (#section) "warp" instead of scrolling through every pinned story on the way:
 *  1. ramp — the page starts moving towards the target while a vertical motion blur builds up
 *     (backdrop blur + a slight vertical stretch of the content, the header stays sharp),
 *  2. jump — at peak blur the distance in between is skipped; we land just short of the target,
 *  3. settle — the last stretch is a real, decelerating scroll while the blur clears.
 * Short hops (under ~1.2 screens) simply scroll. Reduced motion jumps straight there.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.07,
      wheelMultiplier: 1,
      anchors: false, // handled below (warp)
      autoRaf: true,
      autoToggle: true, // pauses while <html> has overflow:hidden (mobile menu)
      stopInertiaOnNavigate: true,
    });
    // Exposed for in-page controls that scroll to a position (e.g. More than tax rows).
    (window as unknown as { lenis?: Lenis }).lenis = lenis;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Blur layer between the content and the fixed header.
    const veil = document.createElement("div");
    veil.setAttribute("aria-hidden", "true");
    veil.style.cssText =
      "position:fixed;inset:0;z-index:45;pointer-events:none;opacity:0;" +
      "backdrop-filter:blur(0px);-webkit-backdrop-filter:blur(0px);";
    document.body.appendChild(veil);

    let warping = false;
    let raf = 0;

    const setWarp = (k: number) => {
      const blur = (BLUR * k).toFixed(2);
      veil.style.opacity = k > 0.001 ? "1" : "0";
      veil.style.backdropFilter = `blur(${blur}px)`;
      veil.style.setProperty("-webkit-backdrop-filter", `blur(${blur}px)`);
      // Stretch around the middle of the screen, as if smeared along the travel direction.
      const origin = `50% ${window.scrollY + window.innerHeight / 2}px`;
      document.querySelectorAll<HTMLElement>("[data-warp]").forEach((el) => {
        const on = k > 0.001;
        el.style.transformOrigin = on ? origin : "";
        el.style.transform = on ? `scaleY(${(1 + STRETCH * k).toFixed(4)})` : "";
      });
    };

    const targetY = (el: HTMLElement) => {
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      return el.getBoundingClientRect().top + window.scrollY - margin;
    };

    const warpTo = (el: HTMLElement) => {
      const to = Math.max(0, Math.min(targetY(el), document.documentElement.scrollHeight - window.innerHeight));
      const from = window.scrollY;
      const vh = window.innerHeight;
      const dist = to - from;
      if (reduce) {
        lenis.scrollTo(to, { immediate: true, force: true });
        return;
      }
      if (Math.abs(dist) < vh * 1.2) {
        lenis.scrollTo(to, { duration: 0.9, easing: easeOutCubic, force: true });
        return;
      }
      if (warping) return;
      warping = true;
      const dir = Math.sign(dist);

      // 1. Ramp: start moving and build the blur.
      lenis.scrollTo(from + dir * vh * 0.45, { duration: RAMP / 1000, easing: easeInQuad, force: true, lock: true });
      const t0 = performance.now();
      const ramp = (now: number) => {
        const t = clamp01((now - t0) / RAMP);
        setWarp(easeInQuad(t));
        if (t < 1) {
          raf = requestAnimationFrame(ramp);
          return;
        }
        // 2. Jump past everything in between, landing just short of the target.
        lenis.scrollTo(to - dir * vh * 0.7, { immediate: true, force: true });
        // 3. Settle: a real decelerating scroll while the blur clears.
        lenis.scrollTo(to, {
          duration: SETTLE / 1000,
          easing: easeOutCubic,
          force: true,
          lock: true,
          onComplete: () => {
            warping = false;
          },
        });
        const t1 = performance.now();
        const settle = (n: number) => {
          const u = clamp01((n - t1) / (SETTLE * 0.85));
          setWarp(1 - easeOutCubic(u));
          if (u < 1) raf = requestAnimationFrame(settle);
          else {
            setWarp(0);
            warping = false;
          }
        };
        raf = requestAnimationFrame(settle);
      };
      raf = requestAnimationFrame(ramp);
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute("href")!.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      e.preventDefault();
      // Let a closing mobile menu release the scroll lock first.
      requestAnimationFrame(() => warpTo(el));
      history.replaceState(null, "", `#${id}`);
    };
    document.addEventListener("click", onClick);

    return () => {
      document.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
      veil.remove();
      setWarp(0);
      delete (window as unknown as { lenis?: Lenis }).lenis;
      lenis.destroy();
    };
  }, []);
  return null;
}
