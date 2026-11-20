"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { IconName } from "./DotIcon";

/**
 * The "More than tax" visual: each benefit's icon drawn as a vector shape and halftoned on a fine
 * dot lattice (same language as the footer wordmark), on an unlit LED grid.
 *  · Scroll: the icon transforms into the next one; every dot eases to its new size on its own
 *    clock, from the centre outwards.
 *  · Pointer: a lens pushes dots aside on springs and lets them swell.
 */

export type IconMorphControl = {
  /** Continuous position: 0 = first icon, 1 = second, … (fractions are mid-transform). */
  setPosition: (pos: number) => void;
};

const CELLS = 52; // lattice cells across
const LINE = 5; // stroke width in the 100-unit icon space
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Brand dot gradient (cyan-400 → blue-700 → blue-950), top-left → bottom-right.
const C0 = [102, 173, 201];
const C1 = [36, 87, 176];
const C2 = [10, 26, 77];
const grad = (t: number) => {
  const [a, b, k] = t < 0.5 ? [C0, C1, t * 2] : [C1, C2, (t - 0.5) * 2];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(",")})`;
};

/** Icon artwork in a 100 × 100 space, stroked (and, for the cloud, cut out of a filled union). */
const DRAW: Record<IconName, (c: CanvasRenderingContext2D) => void> = {
  globe: (c) => {
    c.beginPath();
    c.arc(50, 50, 40, 0, Math.PI * 2);
    c.moveTo(10, 50);
    c.lineTo(90, 50);
    c.moveTo(69, 50);
    c.ellipse(50, 50, 19, 40, 0, 0, Math.PI * 2);
    c.stroke();
  },
  shield: (c) => {
    c.beginPath();
    c.moveTo(50, 8);
    c.lineTo(84, 20);
    c.lineTo(84, 47);
    c.bezierCurveTo(84, 69, 69, 84, 50, 92);
    c.bezierCurveTo(31, 84, 16, 69, 16, 47);
    c.lineTo(16, 20);
    c.closePath();
    c.moveTo(34, 50);
    c.lineTo(46, 62);
    c.lineTo(67, 38);
    c.stroke();
  },
  building: (c) => {
    c.beginPath();
    c.moveTo(10, 32);
    c.lineTo(50, 10);
    c.lineTo(90, 32);
    c.closePath();
    c.moveTo(16, 40);
    c.lineTo(84, 40);
    for (const x of [24, 41, 59, 76]) {
      c.moveTo(x, 48);
      c.lineTo(x, 78);
    }
    c.moveTo(12, 86);
    c.lineTo(88, 86);
    c.stroke();
  },
  cloud: (c) => {
    const parts = (g: number) => {
      c.beginPath();
      c.arc(30, 62, 17 - g, 0, Math.PI * 2);
      c.arc(52, 46, 24 - g, 0, Math.PI * 2);
      c.arc(73, 60, 16 - g, 0, Math.PI * 2);
      c.rect(30, 50 + g, 43, 26 - g * 2);
      c.fill();
    };
    // Outline of the union: fill it, then cut the same union shrunk by the line width.
    parts(0);
    c.save();
    c.globalCompositeOperation = "destination-out";
    parts(LINE);
    c.restore();
  },
  export: (c) => {
    c.beginPath();
    c.moveTo(58, 20);
    c.lineTo(20, 20);
    c.lineTo(20, 80);
    c.lineTo(80, 80);
    c.lineTo(80, 42);
    c.moveTo(44, 56);
    c.lineTo(84, 16);
    c.moveTo(62, 16);
    c.lineTo(84, 16);
    c.lineTo(84, 38);
    c.stroke();
  },
  sandbox: (c) => {
    c.beginPath();
    c.moveTo(50, 10);
    c.lineTo(85, 30);
    c.lineTo(85, 70);
    c.lineTo(50, 90);
    c.lineTo(15, 70);
    c.lineTo(15, 30);
    c.closePath();
    c.moveTo(15, 30);
    c.lineTo(50, 50);
    c.lineTo(85, 30);
    c.moveTo(50, 50);
    c.lineTo(50, 90);
    c.stroke();
  },
};

type Props = {
  names: IconName[];
  controlRef: RefObject<IconMorphControl | null>;
  className?: string;
};

export function IconMorph({ names, controlRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const key = names.join(",");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const list = key.split(",") as IconName[];
    const n = CELLS * CELLS;

    // Coverage (0–1) of each icon per lattice cell, independent of the canvas size.
    const covers = list.map((name) => {
      const R = 4; // raster samples per cell
      const off = document.createElement("canvas");
      off.width = off.height = CELLS * R;
      const o = off.getContext("2d", { willReadFrequently: true })!;
      const k = (CELLS * R) / 100;
      o.setTransform(k * 0.9, 0, 0, k * 0.9, CELLS * R * 0.05, CELLS * R * 0.05);
      o.strokeStyle = o.fillStyle = "#000";
      o.lineWidth = LINE;
      o.lineCap = "round";
      o.lineJoin = "round";
      DRAW[name](o);
      const px = o.getImageData(0, 0, off.width, off.height).data;
      const cov = new Float32Array(n);
      for (let j = 0; j < CELLS; j++) {
        for (let i = 0; i < CELLS; i++) {
          let sum = 0;
          for (let y = 0; y < R; y++) for (let x = 0; x < R; x++) sum += px[((j * R + y) * off.width + i * R + x) * 4 + 3];
          cov[j * CELLS + i] = Math.min(1, (sum / (R * R) / 255) * 1.15);
        }
      }
      return cov;
    });

    const delay = new Float32Array(n);
    const half = (CELLS - 1) / 2;
    for (let j = 0; j < CELLS; j++)
      for (let i = 0; i < CELLS; i++) delay[j * CELLS + i] = Math.hypot(i - half, j - half) / Math.hypot(half, half);
    const B = 10;
    const colors = Array.from({ length: B }, (_, b) => grad((b + 0.5) / B));

    // Lens springs.
    const sx = new Float32Array(n), sy = new Float32Array(n), vx = new Float32Array(n), vy = new Float32Array(n);
    const pointer = { x: -1e4, y: -1e4, on: 0, target: 0 };

    let size = 0;
    let pos = 0;
    let raf = 0;
    let visible = false;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      size = r.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      raf = 0;
      ctx.clearRect(0, 0, size, size);
      const P = size / CELLS;
      const rOn = P * 0.44;
      const rOff = P * 0.11;
      const lensR = size * 0.24;
      const push = size * 0.045;
      const last = covers.length - 1;
      const p = Math.min(last, Math.max(0, pos));
      const k = Math.max(0, Math.min(last - 1, Math.floor(p)));
      const t = last === 0 ? 0 : p - k;
      const a = covers[k], b = covers[Math.min(last, k + 1)];
      pointer.on += (pointer.target - pointer.on) * 0.12;

      const offPath = new Path2D();
      const onPaths = Array.from({ length: B }, () => new Path2D());
      let moving = Math.abs(pointer.target - pointer.on) > 0.01;

      for (let j = 0; j < CELLS; j++) {
        for (let i = 0; i < CELLS; i++) {
          const c = j * CELLS + i;
          const x0 = (i + 0.5) * P, y0 = (j + 0.5) * P;
          // Lens.
          let f = 0, tx = 0, ty = 0;
          if (pointer.on > 0.01) {
            const ex = x0 - pointer.x, ey = y0 - pointer.y;
            const d = Math.hypot(ex, ey);
            if (d < lensR) {
              f = (1 - d / lensR) ** 2 * pointer.on;
              if (d > 0.001) {
                tx = (ex / d) * push * f;
                ty = (ey / d) * push * f;
              }
            }
          }
          if (!reduce && (tx || ty || sx[c] || sy[c] || vx[c] || vy[c])) {
            vx[c] = (vx[c] + (tx - sx[c]) * 0.15) * 0.74;
            vy[c] = (vy[c] + (ty - sy[c]) * 0.15) * 0.74;
            sx[c] += vx[c];
            sy[c] += vy[c];
            if (Math.abs(sx[c]) + Math.abs(sy[c]) + Math.abs(vx[c]) + Math.abs(vy[c]) < 0.02) sx[c] = sy[c] = vx[c] = vy[c] = 0;
            else moving = true;
          }
          // Transform between icons.
          const e = easeInOut(clamp01((t - delay[c] * 0.45) / 0.55));
          let v = a[c] + (b[c] - a[c]) * e;
          const x = x0 + sx[c], y = y0 + sy[c];
          if (v < 0.06) {
            const r = rOff * (1 + 1.4 * f);
            offPath.moveTo(x + r, y);
            offPath.arc(x, y, r, 0, Math.PI * 2);
            continue;
          }
          v *= 1 + 0.7 * f;
          const r = Math.max(rOff, rOn * Math.sqrt(v));
          const bucket = Math.min(B - 1, Math.floor(((i + j) / (2 * CELLS - 2)) * B));
          onPaths[bucket].moveTo(x + r, y);
          onPaths[bucket].arc(x, y, r, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = "rgba(18,18,18,0.08)";
      ctx.fill(offPath);
      for (let q = 0; q < B; q++) {
        ctx.fillStyle = colors[q];
        ctx.fill(onPaths[q]);
      }
      if (visible && moving) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    controlRef.current = {
      setPosition: (v) => {
        if (Math.abs(v - pos) < 1e-4) return;
        pos = v;
        kick();
      },
    };

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.target = 1;
      kick();
    };
    const onLeave = () => {
      pointer.target = 0;
      kick();
    };
    if (!reduce) {
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerenter", onMove);
      canvas.addEventListener("pointerleave", onLeave);
    }

    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    resize();
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerenter", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      controlRef.current = null;
    };
  }, [key, controlRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
