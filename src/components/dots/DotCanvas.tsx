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
  /**
   * Bubble mode (with `interactive`): dots near the pointer are pushed aside on springs and turn
   * into glassy bubbles; moving the pointer sheds small bubbles that float up and pop.
   */
  bubbles?: boolean;
  /**
   * 3D tilt: the whole art turns a few degrees after the pointer anywhere on screen. Each layer
   * sits at a depth (see `depth`), so near and far parts move against each other.
   */
  tilt?: boolean;
  /** Per-layer depth (design units) for `tilt`: a number, or a function of the dot's y. */
  depth?: (number | "ground")[];
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
  // Bubble springs: per-dot offset and velocity (design units).
  sx: Float32Array;
  sy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
};

type Particle = { x: number; y: number; vx: number; vy: number; r: number; life: number; age: number; seed: number };

const PUSH = 16; // design units, max bubble displacement
const PERSPECTIVE = 1500; // design units
const MAX_TILT = { yaw: 0.12, pitch: 0.07 }; // radians

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
  bubbles = false,
  tilt = false,
  depth,
  pointerRadius = 90,
  controlRef,
  className,
  label,
}: DotCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(sources);
  const vbKey = viewBox?.join(",") ?? "";
  const revealKey = reveal ? JSON.stringify(reveal) : "off";
  const depthKey = depth?.join(",") ?? "";

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
    let lastPX = -1e4, lastPY = -1e4;
    const particles: Particle[] = [];
    let springsActive = false;
    // Tilt (radians), smoothed towards a target from the pointer's screen position.
    const rot = { yaw: 0, pitch: 0, tyaw: 0, tpitch: 0 };
    const depths = depthKey ? depthKey.split(",").map((v) => (v === "ground" ? "ground" : Number(v))) : [];
    let pid = 0;

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
      const t = now / 1000;

      // 3D: rotate around the centre of the art's design space, then project with perspective.
      const space = layers[0]?.space ?? [1, 1];
      const cx0 = space[0] * 0.62, cy0 = space[1] * 0.8;
      const cyw = Math.cos(rot.yaw), syw = Math.sin(rot.yaw);
      const cpt = Math.cos(rot.pitch), spt = Math.sin(rot.pitch);
      const useTilt = tilt && (Math.abs(rot.yaw) > 1e-4 || Math.abs(rot.pitch) > 1e-4);
      let projX = 0, projY = 0, projK = 1;
      const project = (X: number, Y: number, Z: number) => {
        if (!useTilt) {
          projX = offX + X * scale;
          projY = offY + Y * scale;
          projK = 1;
          return;
        }
        const x = X - cx0, y = Y - cy0;
        const x1 = x * cyw + Z * syw;
        const z1 = -x * syw + Z * cyw;
        const y2 = y * cpt - z1 * spt;
        const z2 = y * spt + z1 * cpt;
        const k = PERSPECTIVE / (PERSPECTIVE - z2);
        projX = offX + (cx0 + x1 * k) * scale;
        projY = offY + (cy0 + y2 * k) * scale;
        projK = k;
      };

      const bubbleQueue: { x: number; y: number; r: number; a: number }[] = [];
      let moving = false;

      layers.forEach((l, li) => {
        ctx.fillStyle = l.color;
        const { d, a, count, revealDelay, ox, oy, sx, sy, vx, vy } = l;
        const x = l.x, y = l.y;
        const dep = depths[li] ?? 0;
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
          const hx = x[i] + ox, hy = y[i] + oy;
          let f = 0;
          if (ps > 0.001) {
            const dx = hx - pointer.x;
            const dy = hy - pointer.y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < R2) {
              const dist = Math.sqrt(dist2);
              f = (1 - dist / R) ** 2 * ps;
              if (bubbles && dist > 0.001) {
                // Spring towards a pushed-out position.
                vx[i] += ((dx / dist) * PUSH * f - sx[i]) * 0.16;
                vy[i] += ((dy / dist) * PUSH * f - sy[i]) * 0.16;
              }
            }
          }
          if (bubbles && (f === 0 ? sx[i] !== 0 || sy[i] !== 0 || vx[i] !== 0 || vy[i] !== 0 : true)) {
            if (f === 0) {
              vx[i] += -sx[i] * 0.16;
              vy[i] += -sy[i] * 0.16;
            }
            vx[i] *= 0.72;
            vy[i] *= 0.72;
            sx[i] += vx[i];
            sy[i] += vy[i];
            if (Math.abs(sx[i]) + Math.abs(sy[i]) + Math.abs(vx[i]) + Math.abs(vy[i]) < 0.02) {
              sx[i] = sy[i] = vx[i] = vy[i] = 0;
            } else moving = true;
          }
          const Z = dep === "ground" ? (hy - 800) * 1.6 : dep;
          project(hx + (bubbles ? sx[i] : 0), hy + (bubbles ? sy[i] : 0), Z);
          if (bubbles && f > 0.06) {
            const wob = 1 + 0.07 * Math.sin(t * 5 + i * 1.7);
            bubbleQueue.push({ x: projX, y: projY, r: r * (1 + 1.5 * f) * wob * scale * projK, a: Math.min(1, 0.35 + f) });
            continue;
          }
          if (f > 0) {
            r *= 1 + 0.55 * f;
            alpha = Math.min(1, alpha + 0.45 * f);
          }
          const pr = r * scale * projK;
          if (pr < 0.15) continue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(projX, projY, pr, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      springsActive = moving;

      // Free bubbles: rise with a wobble, swell a little, pop (ring) at the end of their life.
      for (let k = particles.length - 1; k >= 0; k--) {
        const b = particles[k];
        b.age += 1 / 60;
        if (b.age >= b.life) {
          particles.splice(k, 1);
          continue;
        }
        b.vy -= 0.012;
        b.x += b.vx + Math.sin(b.age * 6 + b.seed) * 0.25;
        b.y += b.vy;
        const u = b.age / b.life;
        project(b.x, b.y, 0);
        const rr = b.r * (1 + 0.4 * u) * scale * projK;
        if (u > 0.88) {
          // Pop: a thin ring that opens and fades.
          const q = (u - 0.88) / 0.12;
          ctx.globalAlpha = 0.6 * (1 - q);
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.arc(projX, projY, rr * (1 + q * 0.8), 0, Math.PI * 2);
          ctx.stroke();
        } else bubbleQueue.push({ x: projX, y: projY, r: rr, a: Math.min(1, u * 6) * 0.9 });
      }

      // Bubbles: translucent body, bright rim, a small specular highlight.
      for (const b of bubbleQueue) {
        if (b.r < 0.4) continue;
        ctx.globalAlpha = 0.16 * b.a;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85 * b.a;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(0.6, b.r * 0.14);
        ctx.stroke();
        ctx.globalAlpha = 0.95 * b.a;
        ctx.beginPath();
        ctx.arc(b.x - b.r * 0.38, b.y - b.r * 0.38, Math.max(0.5, b.r * 0.22), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    // Moving the pointer sheds a few bubbles from the dots it passes.
    const shed = () => {
      if (!bubbles || pointer.strength < 0.3) return;
      const speed = Math.hypot(pointer.x - lastPX, pointer.y - lastPY);
      lastPX = pointer.x;
      lastPY = pointer.y;
      if (speed < 0.6 || particles.length > 70) return;
      const n = Math.min(3, Math.floor(speed / 6) + (Math.random() < 0.35 ? 1 : 0));
      for (let k = 0; k < n; k++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * pointerRadius * 0.6;
        pid++;
        particles.push({
          x: pointer.x + Math.cos(ang) * rad,
          y: pointer.y + Math.sin(ang) * rad,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.3 - Math.random() * 0.5,
          r: 1.6 + Math.random() * 3.4,
          life: 1.1 + Math.random() * 1.3,
          age: 0,
          seed: pid * 1.37,
        });
      }
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed) return;
      if (!revealDone && now - start >= revealEnd) revealDone = true;
      pointer.x += (pointer.tx - pointer.x) * 0.18;
      pointer.y += (pointer.ty - pointer.y) * 0.18;
      pointer.strength += (pointer.target - pointer.strength) * 0.12;
      rot.yaw += (rot.tyaw - rot.yaw) * 0.06;
      rot.pitch += (rot.tpitch - rot.pitch) * 0.06;
      shed();
      draw(now);
      const pointerSettled =
        Math.abs(pointer.target - pointer.strength) < 0.002 && Math.abs(pointer.tx - pointer.x) < 0.5;
      const tiltSettled = Math.abs(rot.tyaw - rot.yaw) < 1e-4 && Math.abs(rot.tpitch - rot.pitch) < 1e-4;
      const busy = !pointerSettled || !tiltSettled || springsActive || particles.length > 0 || (bubbles && pointer.strength > 0.05);
      if (visible && (!revealDone || busy)) raf = requestAnimationFrame(tick);
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
    // Tracked on the window: content layered above the canvas (headlines) must not block it.
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const m = pointerRadius * scale;
      if (e.clientX < rect.left - m || e.clientX > rect.right + m || e.clientY < rect.top - m || e.clientY > rect.bottom + m) {
        if (pointer.target !== 0) onLeave();
        return;
      }
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
    const onTilt = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      rot.tyaw = nx * 2 * MAX_TILT.yaw;
      rot.tpitch = -ny * 2 * MAX_TILT.pitch;
      kick();
    };
    const onTiltLeave = () => {
      rot.tyaw = 0;
      rot.tpitch = 0;
      kick();
    };

    const files = srcs.flatMap((s) => (s.morphTo ? [s.src, s.morphTo] : [s.src]));
    Promise.all(files.map(loadDots))
      .then((loaded) => {
        if (disposed) return;
        const byIndex = new Map(files.map((f, i) => [f, loaded[i]] as const));
        layers = srcs.map((s) => {
          const base = byIndex.get(s.src) as DotLayer;
          const color = s.color ?? "#fff";
          if (!s.morphTo) {
            const c = base.count;
            const l: Layer = { color, count: c, space: base.space, x: base.x, y: base.y, d: base.d, a: base.a, revealDelay: new Float32Array(0), ox: 0, oy: 0, sx: new Float32Array(c), sy: new Float32Array(c), vx: new Float32Array(c), vy: new Float32Array(c) };
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
            sx: new Float32Array(n),
            sy: new Float32Array(n),
            vx: new Float32Array(n),
            vy: new Float32Array(n),
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
          window.addEventListener("pointermove", onMove, { passive: true });
          document.documentElement.addEventListener("pointerleave", onLeave);
        }
        if (tilt && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
          window.addEventListener("pointermove", onTilt, { passive: true });
          document.documentElement.addEventListener("pointerleave", onTiltLeave);
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
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointermove", onTilt);
      document.documentElement.removeEventListener("pointerleave", onTiltLeave);
      if (controlRef) controlRef.current = null;
    };
    // Primitive keys stand in for the array/object props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, vbKey, fit, align[0], align[1], revealKey, interactive, bubbles, tilt, depthKey, pointerRadius, controlRef]);

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
