"use client";

import { useEffect, useRef, type ReactNode } from "react";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Back-layer footer: the light sheet above slides up off it. While the footer comes into view,
 * its content is held back (counter-translated) so it seems to wait underneath, and comes
 * forward from depth (scales up) as the sheet uncovers it.
 */
export function FooterReveal({ children, className }: { children: ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = outer.getBoundingClientRect();
      const vh = window.innerHeight;
      const h = rect.height;
      const shown = Math.min(h, Math.max(0, vh - rect.top)); // px of footer inside the viewport
      const p = h ? clamp01(shown / Math.min(h, vh)) : 1;
      inner.style.transform = p < 1 ? `translate3d(0, ${((shown - Math.min(h, vh)) * 0.8).toFixed(1)}px, 0) scale(${(0.96 + 0.04 * p).toFixed(4)})` : "";
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
    <div ref={outerRef} className={`relative overflow-hidden ${className ?? ""}`}>
      <div ref={innerRef} className="origin-[50%_0%] will-change-transform">
        {children}
      </div>
    </div>
  );
}
