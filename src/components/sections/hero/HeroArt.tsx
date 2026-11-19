"use client";

import { useEffect, useState } from "react";
import { DotCanvas } from "@/components/dots/DotCanvas";

// Regions of the 1440×900 hero design space.
const DESKTOP_VIEW: [number, number, number, number] = [300, 300, 1140, 610]; // towers + full hill
const MOBILE_VIEW: [number, number, number, number] = [660, 300, 780, 610]; // towers + right of hill

const SOURCES = [
  { src: "/dots/hill.json", color: "#ffffff" },
  { src: "/dots/flame-towers.json", color: "#ffffff" },
];

/** Flame Towers + hill as halftone dots. Reveals bottom-up, reacts softly to the pointer. */
export function HeroArt({ className = "" }: { className?: string }) {
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
          reveal={{ from: "bottom", sweep: 1600, duration: 900, jitter: 500, delay: 200 }}
          className="block size-full"
        />
      )}
    </div>
  );
}
