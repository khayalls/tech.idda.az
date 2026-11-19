"use client";

import { useEffect, useState, type RefObject } from "react";
import { DotCanvas, type DotCanvasControl } from "@/components/dots/DotCanvas";

// Regions of the 1440×900 hero design space.
const DESKTOP_VIEW: [number, number, number, number] = [300, 300, 1140, 610]; // towers + full hill
const MOBILE_VIEW: [number, number, number, number] = [660, 300, 780, 610]; // towers + right of hill

const SOURCES = [
  { src: "/dots/hill.json", color: "#ffffff" },
  // Flame Towers morph into the Maiden Tower as the hero scrolls.
  { src: "/dots/flame-towers.json", morphTo: "/dots/maiden-tower.json", color: "#ffffff" },
];

type Props = {
  className?: string;
  controlRef?: RefObject<DotCanvasControl | null>;
};

/** Flame Towers ↔ Maiden Tower as halftone dots on a dotted hill. */
export function HeroArt({ className = "", controlRef }: Props) {
  const [wide, setWide] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const view = wide ? DESKTOP_VIEW : MOBILE_VIEW;

  return (
    <div className={className} style={{ aspectRatio: `${view[2]} / ${view[3]}` }}>
      {wide !== null && (
        <DotCanvas
          sources={SOURCES}
          viewBox={view}
          fit="contain"
          align={[1, 1]}
          interactive
          pointerRadius={80}
          controlRef={controlRef}
          reveal={{ from: "bottom", sweep: 1600, duration: 900, jitter: 500, delay: 200 }}
          className="block size-full"
        />
      )}
    </div>
  );
}
