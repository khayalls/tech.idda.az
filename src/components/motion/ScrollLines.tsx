"use client";

import { useEffect, useRef, type ElementType } from "react";
import { watchLines, type SplitLines } from "@/lib/split-lines";

type Props = {
  as?: ElementType;
  children: string;
  className?: string;
  /** Viewport fraction (0 = top, 1 = bottom) where a line has fully arrived. */
  enterAt?: number;
  /** Viewport fraction where a line starts to dissolve on its way out. */
  leaveAt?: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * The site's text motion for body copy, driven by scroll position.
 * Arriving: words come into focus one after another along each line (blur → sharp, fade in,
 * a small rise) — no hard mask edges. Leaving: the line dissolves (fade + blur) near the top.
 * Plain text without JavaScript or with reduced motion.
 */
export function ScrollLines({ as: Tag = "p", children, className, enterAt = 0.68, leaveAt = 0.26 }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lines: SplitLines | null = null;
    let words: HTMLElement[][] = [];
    let raf = 0;
    let visible = false;

    const update = () => {
      raf = 0;
      if (!lines) return;
      const vh = window.innerHeight;
      for (let i = 0; i < lines.masks.length; i++) {
        const top = lines.masks[i].getBoundingClientRect().top;
        const enter = clamp01((vh - top) / (vh * (1 - enterAt))); // 0 at the bottom edge → 1 at enterAt
        const leave = ss(vh * leaveAt, vh * (leaveAt - 0.2), top);
        const row = words[i];
        const n = row.length;
        for (let w = 0; w < n; w++) {
          // Each word gets a 45% window of the line's progress, staggered left → right.
          const start = n > 1 ? (w / (n - 1)) * 0.55 : 0;
          const k = ss(start, start + 0.45, enter);
          const s = row[w].style;
          if (k >= 1) {
            s.opacity = "";
            s.filter = "";
            s.transform = "";
          } else {
            s.opacity = k.toFixed(3);
            s.filter = `blur(${((1 - k) * 10).toFixed(2)}px)`;
            s.transform = `translate3d(0, ${((1 - k) * 0.35).toFixed(3)}em, 0)`;
          }
        }
        const m = lines.moves[i];
        m.style.opacity = leave > 0 ? (1 - leave).toFixed(3) : "";
        m.style.filter = leave > 0 ? `blur(${(leave * 6).toFixed(2)}px)` : "";
      }
    };
    const onScroll = () => {
      if (visible && !raf) raf = requestAnimationFrame(update);
    };

    const stop = watchLines(el, (s) => {
      lines = s;
      // No clipping: words are soft, not cut by a mask edge.
      for (const m of s.masks) m.style.overflow = "visible";
      words = s.inners.map((inner) => {
        const text = inner.textContent ?? "";
        inner.textContent = "";
        return text.split(" ").map((w, i, arr) => {
          const span = document.createElement("span");
          span.textContent = w;
          span.style.display = "inline-block";
          span.style.willChange = "opacity, filter, transform";
          inner.appendChild(span);
          if (i < arr.length - 1) inner.appendChild(document.createTextNode(" "));
          return span;
        });
      });
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
