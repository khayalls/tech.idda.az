"use client";

import { useEffect, useRef, type ElementType } from "react";
import { watchLines, type SplitLines } from "@/lib/split-lines";

type Props = {
  as?: ElementType;
  children: string;
  className?: string;
  /** Extra delay before the first line (ms). */
  delay?: number;
  /** Lines lift away one by one as the text scrolls out the top of the viewport. */
  exit?: boolean;
  /** Reveal immediately on mount instead of on entering the viewport. */
  immediate?: boolean;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Text that arrives line by line (rising out of a mask) and, optionally, leaves line by line
 * on scroll. Server-rendered as plain text, so it reads fine without JavaScript.
 */
export function RevealText({ as: Tag = "p", children, className, delay = 0, exit = false, immediate = false }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lines: SplitLines | null = null;
    let revealed = false;
    let raf = 0;

    el.style.setProperty("--reveal-delay", `${delay}ms`);
    const stop = watchLines(el, (s) => {
      lines = s;
      if (!revealed) el.dataset.reveal = reduce ? "in" : "out";
      update();
    });

    const reveal = () => {
      revealed = true;
      // Two frames so the "out" state is painted before transitioning.
      requestAnimationFrame(() => requestAnimationFrame(() => (el.dataset.reveal = "in")));
    };

    let io: IntersectionObserver | null = null;
    if (immediate || reduce) reveal();
    else {
      io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting) {
            reveal();
            io?.disconnect();
          }
        },
        { rootMargin: "0px 0px -12% 0px" },
      );
      io.observe(el);
    }

    // Scroll-linked exit: each line fades and lifts as it passes the top 15% of the viewport.
    function update() {
      raf = 0;
      if (!exit || reduce || !lines) return;
      const vh = window.innerHeight;
      const start = vh * 0.15;
      const span = vh * 0.2;
      for (let i = 0; i < lines.masks.length; i++) {
        const top = lines.masks[i].getBoundingClientRect().top;
        const k = clamp01((start - top) / span);
        const move = lines.moves[i];
        move.style.transform = k ? `translate3d(0, ${-k * 40}%, 0)` : "";
        move.style.opacity = k ? String(1 - k) : "";
        move.style.filter = k ? `blur(${(k * 6).toFixed(2)}px)` : "";
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    if (exit) window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      stop();
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [delay, exit, immediate]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
