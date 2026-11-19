"use client";

import { useEffect, useRef } from "react";
import { loadDots, type DotLayer } from "./dot-data";

export type DotSource = {
  src: string;
  /** Solid colour for this layer. Defaults to white. */
  color?: string;
};

export type RevealOptions = {
  /** Where the wave starts. */
  from?: "bottom" | "top" | "left" | "right";
  /** Time for the wave to cross the view box (ms). */
  sweep?: number;
  /** Fade/grow time of a single dot (ms). */
  duration?: number;
  /** Random per-dot offset (ms) so the wave feels organic. */
  jitter?: number;
  delay?: number;
};

export type DotCanvasProps = {
  sources: DotSource[];
  /** Region of the design space to show: [x, y, w, h]. Defaults to the full space. */
  viewBox?: [number, number, number, number];
  /** contain: whole view box visible · cover: fill the canvas, crop overflow. */
  fit?: "contain" | "cover";
  /** Alignment of the view box inside the canvas (0 = start, 0.5 = centre, 1 = end). */
  align?: [number, number];
  reveal?: RevealOptions | false;
  /** Dots near the pointer grow and brighten. */
  interactive?: boolean;
  /** Radius of pointer influence in design units. */
  pointerRadius?: number;
  className?: string;
  /** Accessible description. Omit for decorative art (aria-hidden). */
  label?: string;
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

// Deterministic pseudo-random in [0, 1) per index (stable between renders).
const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

export function DotCanvas({
  sources,
  viewBox,
  fit = "contain",
  align = [0.5, 0.5],
  reveal = { from: "bottom", sweep: 1400, duration: 700, jitter: 400 },
  interactive = false,
  pointerRadius = 90,
  className,
  label,
}: DotCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = sources.map((s) => `${s.src}|${s.color ?? ""}`).join(",");
  const vbKey = viewBox?.join(",") ?? "";
  const revealKey = reveal ? JSON.stringify(reveal) : "off";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const parsedSources: DotSource[] = key
      .split(",")
      .map((s) => s.split("|"))
      .map(([src, color]) => ({ src, color: color || undefined }));

    let layers: { layer: DotLayer; color: string; delays: Float32Array }[] = [];
    let raf = 0;
    let disposed = false;
    let visible = true;
    let start = 0;
    let revealDone = !reveal || reduceMotion;
    let revealEnd = 0;

    // Layout state (CSS pixels).
    let cssW = 0;
    let cssH = 0;
    let scale = 1;
    let offX = 0;
    let offY = 0;
    let vb: [number, number, number, number] = [0, 0, 1, 1];

    // Pointer in design units, smoothed.
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, strength: 0, target: 0 };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const space = layers[0]?.layer.space ?? [1, 1];
      vb = viewBox ? (vbKey.split(",").map(Number) as typeof vb) : [0, 0, space[0], space[1]];
      const sx = cssW / vb[2];
      const sy = cssH / vb[3];
      scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
      offX = (cssW - vb[2] * scale) * align[0] - vb[0] * scale;
      offY = (cssH - vb[3] * scale) * align[1] - vb[1] * scale;
    };

    const computeDelays = (layer: DotLayer) => {
      const delays = new Float32Array(layer.count);
      if (!reveal) return delays;
      const { from = "bottom", sweep = 1400, jitter = 400, delay = 0 } = reveal;
      const [sw, sh] = layer.space;
      for (let i = 0; i < layer.count; i++) {
        const t =
          from === "bottom" ? 1 - layer.y[i] / sh
          : from === "top" ? layer.y[i] / sh
          : from === "left" ? layer.x[i] / sw
          : 1 - layer.x[i] / sw;
        delays[i] = delay + t * sweep + hash(i) * jitter;
      }
      return delays;
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, cssW, cssH);
      const elapsed = now - start;
      const dur = reveal ? reveal.duration ?? 700 : 0;
      const R = pointerRadius;
      const R2 = R * R;
      const ps = pointer.strength;

      for (const { layer, color, delays } of layers) {
        ctx.fillStyle = color;
        const { x, y, d, a, count } = layer;
        for (let i = 0; i < count; i++) {
          let k = 1;
          if (!revealDone) {
            const p = (elapsed - delays[i]) / dur;
            if (p <= 0) continue;
            k = p >= 1 ? 1 : easeOut(p);
          }
          let r = d[i] * 0.5 * k;
          let alpha = a[i] * k;
          if (ps > 0.001) {
            const dx = x[i] - pointer.x;
            const dy = y[i] - pointer.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < R2) {
              const f = (1 - Math.sqrt(dist2) / R) ** 2 * ps;
              r *= 1 + 0.55 * f;
              alpha = Math.min(1, alpha + 0.45 * f);
            }
          }
          const px = offX + x[i] * scale;
          const py = offY + y[i] * scale;
          const pr = r * scale;
          if (pr < 0.15) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(px, py, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (!revealDone && now - start >= revealEnd) revealDone = true;
      // Ease pointer position and strength.
      pointer.x += (pointer.tx - pointer.x) * 0.18;
      pointer.y += (pointer.ty - pointer.y) * 0.18;
      pointer.strength += (pointer.target - pointer.strength) * 0.12;
      draw(now);
      const pointerSettled = Math.abs(pointer.target - pointer.strength) < 0.002 && Math.abs(pointer.tx - pointer.x) < 0.5;
      if (visible && (!revealDone || !pointerSettled)) raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!raf && visible && !disposed) raf = requestAnimationFrame(tick);
    };

    const ro = new ResizeObserver(() => {
      layout();
      if (layers.length) {
        draw(performance.now());
        kick();
      }
    });

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) kick();
    });

    const toDesign = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return [(e.clientX - rect.left - offX) / scale, (e.clientY - rect.top - offY) / scale] as const;
    };
    const onMove = (e: PointerEvent) => {
      const [dx, dy] = toDesign(e);
      if (pointer.target === 0) {
        pointer.x = dx;
        pointer.y = dy;
      }
      pointer.tx = dx;
      pointer.ty = dy;
      pointer.target = 1;
      kick();
    };
    const onLeave = () => {
      pointer.target = 0;
      kick();
    };

    Promise.all(parsedSources.map((s) => loadDots(s.src)))
      .then((loaded) => {
        if (disposed) return;
        layers = loaded.map((layer, i) => ({
          layer,
          color: parsedSources[i].color ?? "#fff",
          delays: computeDelays(layer),
        }));
        revealEnd = Math.max(0, ...layers.map((l) => Math.max(...l.delays))) + (reveal ? reveal.duration ?? 700 : 0);
        layout();
        start = performance.now();
        ro.observe(canvas);
        io.observe(canvas);
        if (interactive && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
          // Listen on the parent so content layered above the canvas still drives the effect.
          const target = canvas.parentElement ?? canvas;
          target.addEventListener("pointermove", onMove);
          target.addEventListener("pointerleave", onLeave);
        }
        if (revealDone) draw(start);
        else kick();
      })
      .catch((err) => console.error(err));

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      const target = canvas.parentElement ?? canvas;
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerleave", onLeave);
    };
    // Primitive keys stand in for the array/object props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, vbKey, fit, align[0], align[1], revealKey, interactive, pointerRadius]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
