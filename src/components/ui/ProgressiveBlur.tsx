/**
 * Colourless progressive blur: strongest at the top edge, easing to nothing at the bottom.
 * N stacked backdrop-blur layers, each twice as strong as the one below and visible only in its
 * own overlapping band — the steps blend into one continuous ramp with no visible edge.
 */
const LAYERS = 6;
const BASE = 0.5; // px; layers go 0.5 · 1 · 2 · 4 · 8 · 16

export function ProgressiveBlur({ className = "" }: { className?: string }) {
  const step = 100 / (LAYERS + 1);
  return (
    <div aria-hidden="true" className={`pointer-events-none ${className}`} style={{ transform: "translateZ(0)" }}>
      {Array.from({ length: LAYERS }, (_, i) => {
        // Bands run bottom → top; the top band is fully covered by the strongest blur.
        const a = i * step;
        const b = (i + 1) * step;
        const c = Math.min(100, (i + 2) * step);
        const d = Math.min(100, (i + 3) * step);
        const mask = `linear-gradient(to top, transparent ${a}%, #000 ${b}%, #000 ${c}%, ${i >= LAYERS - 2 ? "#000" : "transparent"} ${d}%)`;
        const blur = `blur(${BASE * 2 ** i}px)`;
        return (
          <div
            key={i}
            className="absolute inset-0"
            style={{ backdropFilter: blur, WebkitBackdropFilter: blur, maskImage: mask, WebkitMaskImage: mask }}
          />
        );
      })}
    </div>
  );
}
