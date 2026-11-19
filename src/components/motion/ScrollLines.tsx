"use client";

import { useEffect, useRef, type ElementType } from "react";
import { watchLines, type SplitLines } from "@/lib/split-lines";

type Props = {
  as?: ElementType;
  children: string;
  className?: string;
  /** Viewport fractions (0 = top, 1 = bottom) where a line finishes arriving / starts leaving. */
  enterAt?: number;
  leaveAt?: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The site's text motion, driven by scroll position (same language as the hero headlines):
 * each line rises out of its mask as it comes up from the bottom of the viewport, and
 * dissolves (fade + blur) as it approaches the top. Plain text without JavaScript.
 */
export function ScrollLines({ as: Tag = "p", children, className, enterAt = 0.72, leaveAt = 0.26 }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lines: SplitLines | null = null;
    let raf = 0;
    let visible = false;

    const update = () => {
      raf = 0;
      if (!lines) return;
      const vh = window.innerHeight;
      for (let i = 0; i < lines.masks.length; i++) {
        const top = lines.masks[i].getBoundingClientRect().top;
        const enter = ss(vh, vh * enterAt, top);
        const leave = ss(vh * leaveAt, vh * (leaveAt - 0.2), top);
        const m = lines.moves[i];
        m.style.transform = enter < 1 ? `translate3d(0, ${((1 - enter) * 100).toFixed(2)}%, 0)` : "";
        const o = enter * (1 - leave);
        m.style.opacity = o < 1 ? o.toFixed(3) : "";
        m.style.filter = leave > 0 ? `blur(${(leave * 6).toFixed(2)}px)` : "";
      }
    };
    const onScroll = () => {
      if (visible && !raf) raf = requestAnimationFrame(update);
    };

    const stop = watchLines(el, (s) => {
      lines = s;
      update();
    });
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) onScroll();
    });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      stop();
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enterAt, leaveAt]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
