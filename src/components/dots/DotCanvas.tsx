"use client";

import { useEffect, useRef, type RefObject } from "react";
import { loadDots, type DotLayer } from "./dot-data";
import { buildMorph, type MorphPair } from "./morph";

export type DotSource = {
  src: string;
  /** Solid colour for this layer. Defaults to white. */
  color?: string;
  /** Morph this layer into another dot file; progress comes from `controlRef.setMorph`. */
  morphTo?: string;
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

export type DotCanvasControl = {
  /** 0 = source shape, 1 = `morphTo` shape. */
  setMorph: (progress: number) => void;
  /** Shift one layer (index into `sources`) in design units, e.g. for parallax inside the art. */
  setLayerOffset: (index: number, dx: number, dy: number) => void;
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
  /** Imperative handle for scroll-driven effects (no React re-render per frame). */
  controlRef?: RefObject<DotCanvasControl | null>;
  className?: string;
  /** Accessible description. Omit for decorative art (aria-hidden). */
  label?: string;
};

type Layer = {
  color: string;
  count: number;
  space: [number, number];
  // Current geometry (rewritten every frame for morph layers).
  x: Float32Array;
  y: Float32Array;
  d: Float32Array;
  a: Float32Array;
  revealDelay: Float32Array;
  morph?: MorphPair;
  ox: number;
  oy: number;
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Deterministic pseudo-random in [0, 1) per index (stable between renders).
const hash = (i: number) => {
  const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Share of the morph timeline used to stagger dots; the rest is each dot's own travel. */
const MORPH_STAGGER = 0.45;

function applyMorph(l: Layer, p: number) {
  const m = l.morph!;
  const span = 1 - MORPH_STAGGER;
  for (let i = 0; i < m.count; i++) {
    let t = (p - m.delay[i] * MORPH_STAGGER) / span;
    t = t <= 0 ? 0 : t >= 1 ? 1 : easeInOut(t);
    const arc = Math.sin(Math.PI * t);
    l.x[i] = m.ax[i] + (m.bx[i] - m.ax[i]) * t + m.drift[i] * arc;
    l.y[i] = m.ay[i] + (m.by[i] - m.ay[i]) * t - 12 * arc;
    // Dots shrink a little mid-flight so the cloud reads as particles, not a smear.
    l.d[i] = (m.ad[i] + (m.bd[i] - m.ad[i]) * t) * (1 - 0.35 * arc);
    l.a[i] = m.aa[i] + (m.ba[i] - m.aa[i]) * t;
  }
}

export function DotCanvas({
  sources,
  viewBox,
  fit = "contain",
  align = [0.5, 0.5],
  reveal = { from: "bottom", sweep: 1400, duration: 700, jitter: 400 },
  interactive = false,
  pointerRadius = 90,
  controlRef,
  className,
  label,
}: DotCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(sources);
  const vbKey = viewBox?.join(",") ?? "";
  const revealKey = reveal ? JSON.stringify(reveal) : "off";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const srcs = JSON.parse(key) as DotSource[];
    const rv = revealKey === "off" ? null : (JSON.parse(revealKey) as RevealOptions);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let layers: Layer[] = [];
    let raf = 0;
    let disposed = false;
    let visible = true;
    let start = 0;
    let revealDone = !rv || reduceMotion;
    let revealEnd = 0;
    let morphP = 0;
    let morphDirty = true;
    const pendingOffsets: Record<number, [number, number]> = {};

    // Layout state (CSS pixels).
    let cssW = 0;
    let cssH = 0;
    let scale = 1;
    let offX = 0;
    let offY = 0;

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
      const space = layers[0]?.space ?? [1, 1];
      const vb = vbKey ? (vbKey.split(",").map(Number) as [number, number, number, number]) : [0, 0, space[0], space[1]];
      const sx = cssW / vb[2];
      const sy = cssH / vb[3];
      scale = fit === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);
      offX = (cssW - vb[2] * scale) * align[0] - vb[0] * scale;
      offY = (cssH - vb[3] * scale) * align[1] - vb[1] * scale;
    };

    const revealDelays = (l: Layer) => {
      const delays = new Float32Array(l.count);
      if (!rv) return delays;
      const { from = "bottom", sweep = 1400, jitter = 400, delay = 0 } = rv;
      const [sw, sh] = l.space;
      for (let i = 0; i < l.count; i++) {
        const t =
          from === "bottom" ? 1 - l.y[i] / sh
          : from === "top" ? l.y[i] / sh
          : from === "left" ? l.x[i] / sw
          : 1 - l.x[i] / sw;
        delays[i] = delay + t * sweep + hash(i) * jitter;
      }
      return delays;
    };

    const draw = (now: number) => {
      if (morphDirty) {
        for (const l of layers) if (l.morph) applyMorph(l, morphP);
        morphDirty = false;
      }
      ctx.clearRect(0, 0, cssW, cssH);
      const elapsed = now - start;
      const dur = rv?.duration ?? 700;
      const R = pointerRadius;
      const R2 = R * R;
      const ps = pointer.strength;

      for (const l of layers) {
        ctx.fillStyle = l.color;
        const { d, a, count, revealDelay, ox, oy } = l;
        const x = l.x, y = l.y;
        for (let i = 0; i < count; i++) {
          let k = 1;
          if (!revealDone) {
            const p = (elapsed - revealDelay[i]) / dur;
            if (p <= 0) continue;
            k = p >= 1 ? 1 : easeOut(p);
          }
          let r = d[i] * 0.5 * k;
          let alpha = a[i] * k;
          if (alpha < 0.01) continue;
          if (ps > 0.001) {
            const dx = x[i] + ox - pointer.x;
            const dy = y[i] + oy - pointer.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < R2) {
              const f = (1 - Math.sqrt(dist2) / R) ** 2 * ps;
              r *= 1 + 0.55 * f;
              alpha = Math.min(1, alpha + 0.45 * f);
            }
          }
          const pr = r * scale;
          if (pr < 0.15) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(offX + (x[i] + ox) * scale, offY + (y[i] + oy) * scale, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (!revealDone && now - start >= revealEnd) revealDone = true;
      pointer.x += (pointer.tx - pointer.x) * 0.18;
      pointer.y += (pointer.ty - pointer.y) * 0.18;
      pointer.strength += (pointer.target - pointer.strength) * 0.12;
      draw(now);
      const pointerSettled =
        Math.abs(pointer.target - pointer.strength) < 0.002 && Math.abs(pointer.tx - pointer.x) < 0.5;
      if (visible && (!revealDone || !pointerSettled)) raf = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (!raf && visible && !disposed && layers.length) raf = requestAnimationFrame(tick);
    };

    if (controlRef) {
      controlRef.current = {
        setMorph: (p: number) => {
          const v = Math.min(1, Math.max(0, p));
          if (Math.abs(v - morphP) < 1e-4) return;
          morphP = v;
          morphDirty = true;
          kick();
        },
        setLayerOffset: (index, dx, dy) => {
          pendingOffsets[index] = [dx, dy];
          const l = layers[index];
          if (!l || (l.ox === dx && l.oy === dy)) return;
          l.ox = dx;
          l.oy = dy;
          morphDirty = true;
          kick();
        },
      };
    }

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
    const pointerTarget = canvas.parentElement ?? canvas;

    const files = srcs.flatMap((s) => (s.morphTo ? [s.src, s.morphTo] : [s.src]));
    Promise.all(files.map(loadDots))
      .then((loaded) => {
        if (disposed) return;
        const byIndex = new Map(files.map((f, i) => [f, loaded[i]] as const));
        layers = srcs.map((s) => {
          const base = byIndex.get(s.src) as DotLayer;
          const color = s.color ?? "#fff";
          if (!s.morphTo) {
            const l: Layer = { color, count: base.count, space: base.space, x: base.x, y: base.y, d: base.d, a: base.a, revealDelay: new Float32Array(0), ox: 0, oy: 0 };
            l.revealDelay = revealDelays(l);
            return l;
          }
          const morph = buildMorph(base, byIndex.get(s.morphTo) as DotLayer);
          const n = morph.count;
          const l: Layer = {
            color, count: n, space: base.space, morph,
            x: new Float32Array(n), y: new Float32Array(n), d: new Float32Array(n), a: new Float32Array(n),
            revealDelay: new Float32Array(0),
            ox: 0,
            oy: 0,
          };
          applyMorph(l, morphP);
          l.revealDelay = revealDelays(l);
          return l;
        });
        for (const [i, [dx, dy]] of Object.entries(pendingOffsets)) {
          const l = layers[Number(i)];
          if (l) {
            l.ox = dx;
            l.oy = dy;
          }
        }
        let last = 0;
        for (const l of layers) for (const v of l.revealDelay) if (v > last) last = v;
        revealEnd = last + (rv?.duration ?? 700);
        layout();
        start = performance.now();
        ro.observe(canvas);
        io.observe(canvas);
        if (interactive && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
          // Listen on the parent so content layered above the canvas still drives the effect.
          pointerTarget.addEventListener("pointermove", onMove);
          pointerTarget.addEventListener("pointerleave", onLeave);
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
      pointerTarget.removeEventListener("pointermove", onMove);
      pointerTarget.removeEventListener("pointerleave", onLeave);
      if (controlRef) controlRef.current = null;
    };
    // Primitive keys stand in for the array/object props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, vbKey, fit, align[0], align[1], revealKey, interactive, pointerRadius, controlRef]);

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
