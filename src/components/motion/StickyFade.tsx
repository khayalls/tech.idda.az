"use client";

import { useEffect, useRef, type ReactNode } from "react";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A sticky block that dissolves (fade + blur) once its section ends and it starts moving
 * up past its pinned position — so it never slides under the header at full strength.
 */
export function StickyFade({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const pinned = parseFloat(getComputedStyle(el).top) || 0;
      const top = el.getBoundingClientRect().top;
      const k = clamp01((pinned - 1 - top) / 160);
      el.style.opacity = k ? String(1 - k) : "";
      el.style.filter = k ? `blur(${(k * 8).toFixed(2)}px)` : "";
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
