"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Inertial smooth scroll on top of native scroll (sticky, anchors and a11y keep working).
 * Lenis disables smoothing itself when the user prefers reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.07,
      wheelMultiplier: 1,
      anchors: { offset: 0 },
      autoRaf: true,
      autoToggle: true, // pauses while <html> has overflow:hidden (mobile menu)
      stopInertiaOnNavigate: true,
    });
    // Exposed for in-page controls that scroll to a position (e.g. More than tax rows).
    (window as unknown as { lenis?: Lenis }).lenis = lenis;
    return () => {
      delete (window as unknown as { lenis?: Lenis }).lenis;
      lenis.destroy();
    };
  }, []);
  return null;
}
