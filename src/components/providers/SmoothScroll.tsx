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
      lerp: 0.09,
      wheelMultiplier: 0.9,
      anchors: { offset: 0 },
      autoRaf: true,
      autoToggle: true, // pauses while <html> has overflow:hidden (mobile menu)
      stopInertiaOnNavigate: true,
    });
    return () => lenis.destroy();
  }, []);
  return null;
}
