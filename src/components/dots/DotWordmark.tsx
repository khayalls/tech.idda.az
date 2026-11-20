"use client";

import { useEffect, useRef } from "react";

/**
 * A word set as a large dot-matrix figure on an unlit LED grid (footer "tech.idda.az", the
 * "0%" in Benefits).
 *
 *  · Lens: dots near the pointer are pushed outward on springs and swell, and the unlit grid
 *    lights up around it — like dragging a magnifier over an LED board.
 *  · Ripple: a click/tap sends a ring through the dots.
 *  · Idle: a soft glint sweeps across the letters every few seconds.
 * The letters are rasterised from the site font and halftoned (dot size follows coverage).
 */

const LENS = 130; // px radius of the pointer influence
const PUSH = 22; // px max displacement

// Brand dot gradient (cyan-400 → blue-700 → blue-950) left → right.
const C0 = [102, 173, 201];
const C1 = [36, 87, 176];
const C2 = [10, 26, 77];
const grad = (t: number) => {
  const [a, b, k] = t < 0.5 ? [C0, C1, t * 2] : [C1, C2, (t - 0.5) * 2];
  return a.map((v, i) => Math.round(v + (b[i] - v) * k));
};

type Props = {
  text: string;
  /** Dot pitch in CSS px. */
  pitch?: number;
  /** Horizontal placement of the word inside the canvas (0 left … 1 right). */
  align?: number;
  /** CSS custom property holding a side inset for the word (the grid still fills the canvas). */
  insetVar?: string;
  className?: string;
};

export function DotWordmark({ text, pitch = 9, align = 0.5, insetVar, className }: Props) {
  const PITCH = pitch;
  const TEXT = text;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0, H = 0, cols = 0, rows = 0, ox = 0, oy = 0;
    // Per dot: home, offset, velocity, coverage.
    let hx = new Float32Array(0), hy = hx, dx = hx, dy = hx, vx = hx, vy = hx, cov = hx;
    let n = 0;
    const B = 12;
    const colors = Array.from({ length: B }, (_, b) => grad((b + 0.5) / B));

    const pointer = { x: -1e4, y: -1e4, on: 0, target: 0 };
    const ripples: { x: number; y: number; t0: number }[] = [];
    let raf = 0;
    let visible = false;
    const t0 = performance.now();

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cols = Math.floor(W / PITCH);
      rows = Math.floor(H / PITCH);
      ox = (W - (cols - 1) * PITCH) / 2;
      oy = (H - (rows - 1) * PITCH) / 2;
      n = cols * rows;

      // Rasterise the wordmark to fill the width, centred.
      const S = 2;
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.round(W * S));
      off.height = Math.max(1, Math.round(H * S));
      const o = off.getContext("2d", { willReadFrequently: true })!;
      const family = getComputedStyle(document.body).fontFamily;
      let size = H * S;
      o.font = `500 ${size}px ${family}`;
      const m = o.measureText(TEXT);
      const inset = insetVar ? parseFloat(getComputedStyle(canvas).getPropertyValue(insetVar)) || 0 : 0;
      const fitW = Math.max(1, W - inset * 2);
      size *= Math.min((fitW * S * 0.98) / m.width, (H * S * 0.9) / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent));
      o.font = `500 ${size}px ${family}`;
      const mm = o.measureText(TEXT);
      const th = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
      o.fillStyle = "#000";
      o.fillText(TEXT, inset * S + (fitW * S - mm.width) * align, (off.height - th) / 2 + mm.actualBoundingBoxAscent);
      const px = o.getImageData(0, 0, off.width, off.height).data;

      hx = new Float32Array(n);
      hy = new Float32Array(n);
      dx = new Float32Array(n);
      dy = new Float32Array(n);
      vx = new Float32Array(n);
      vy = new Float32Array(n);
      cov = new Float32Array(n);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const x = ox + c * PITCH;
          const y = oy + r * PITCH;
          hx[i] = x;
          hy[i] = y;
          let sum = 0, k = 0;
          for (let yy = (y - PITCH / 2) * S; yy < (y + PITCH / 2) * S; yy += 2) {
            for (let xx = (x - PITCH / 2) * S; xx < (x + PITCH / 2) * S; xx += 2) {
              const X = Math.floor(xx), Y = Math.floor(yy);
              if (X < 0 || Y < 0 || X >= off.width || Y >= off.height) continue;
              sum += px[(Y * off.width + X) * 4 + 3];
              k++;
            }
          }
          cov[i] = k ? Math.min(1, (sum / k / 255) * 1.3) : 0;
        }
      }
    };

    const tick = (now: number) => {
      raf = 0;
      const t = (now - t0) / 1000;
      pointer.on += (pointer.target - pointer.on) * 0.12;
      for (let k = ripples.length - 1; k >= 0; k--) if (now - ripples[k].t0 > 1800) ripples.splice(k, 1);

      ctx.clearRect(0, 0, W, H);
      const offPath = new Path2D();
      const litPath = new Path2D();
      const onPaths = Array.from({ length: B }, () => new Path2D());
      // Idle glint: a slanted band sweeping left → right every 7 s.
      const glintX = ((t % 7) / 7) * (W + 400) - 200;

      for (let i = 0; i < n; i++) {
        const x0 = hx[i], y0 = hy[i];
        // Pointer lens.
        let fx = 0, fy = 0, lens = 0;
        if (pointer.on > 0.01) {
          const ex = x0 - pointer.x, ey = y0 - pointer.y;
          const d = Math.hypot(ex, ey);
          if (d < LENS) {
            const k = 1 - d / LENS;
            lens = k * k * pointer.on;
            const inv = d > 0.001 ? 1 / d : 0;
            fx += ex * inv * PUSH * lens;
            fy += ey * inv * PUSH * lens;
          }
        }
        // Ripples: a ring that pushes outward as it passes.
        let ring = 0;
        for (const rp of ripples) {
          const age = now - rp.t0;
          const radius = age * 0.75;
          const ex = x0 - rp.x, ey = y0 - rp.y;
          const d = Math.hypot(ex, ey);
          const band = 1 - Math.abs(d - radius) / 46;
          if (band > 0) {
            const fade = 1 - age / 1800;
            const k = band * band * fade;
            ring = Math.max(ring, k);
            const inv = d > 0.001 ? 1 / d : 0;
            fx += ex * inv * 14 * k;
            fy += ey * inv * 14 * k;
          }
        }
        if (reduce) {
          dx[i] = 0;
          dy[i] = 0;
        } else {
          // Spring towards (target offset), a little bouncy.
          vx[i] += (fx - dx[i]) * 0.14;
          vy[i] += (fy - dy[i]) * 0.14;
          vx[i] *= 0.74;
          vy[i] *= 0.74;
          dx[i] += vx[i];
          dy[i] += vy[i];
        }
        const x = x0 + dx[i], y = y0 + dy[i];
        const c = cov[i];
        const glint = reduce ? 0 : Math.max(0, 1 - Math.abs(x0 + (y0 - H / 2) * 0.6 - glintX) / 90) * 0.35;
        const boost = 1 + 0.9 * lens + 0.6 * ring + glint;
        if (c > 0.08) {
          const r = PITCH * 0.42 * Math.sqrt(c) * boost;
          const b = Math.min(B - 1, Math.floor((x0 / W) * B));
          onPaths[b].moveTo(x + r, y);
          onPaths[b].arc(x, y, r, 0, Math.PI * 2);
        } else if (lens + ring > 0.05) {
          const r = 1.1 + 1.6 * (lens + ring);
          litPath.moveTo(x + r, y);
          litPath.arc(x, y, r, 0, Math.PI * 2);
        } else {
          offPath.moveTo(x + 1.1, y);
          offPath.arc(x, y, 1.1, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = "rgba(18,18,18,0.08)";
      ctx.fill(offPath);
      ctx.fillStyle = "rgba(36,87,176,0.35)";
      ctx.fill(litPath);
      for (let b = 0; b < B; b++) {
        const [r, g, bl] = colors[b];
        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fill(onPaths[b]);
      }
      if (visible && !reduce) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
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
    };
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      ripples.push({ ...p, t0: performance.now() });
      if (ripples.length > 4) ripples.shift();
      kick();
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerenter", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    const ro = new ResizeObserver(() => {
      build();
      kick();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    build();
    document.fonts?.ready.then(() => {
      build();
      kick();
    });
    kick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerenter", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
    };
  }, [PITCH, TEXT, align, insetVar]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
