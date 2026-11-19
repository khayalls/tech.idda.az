"use client";

import { useEffect, useRef } from "react";

/**
 * "0%" as interactive 3D dot type.
 *  · Readable: the glyphs are rasterised from Geist and sampled on the display dot grid (pitch
 *    10.4); each dot's size follows how much of its cell the glyph covers — solid inside,
 *    tapering at the edges.
 *  · Depth: eight extrusion layers behind the face; the extrusion leans away from the pointer
 *    (and slowly orbits when idle), so the figure tilts towards you as you move.
 *  · Light: dots near the pointer swell, and the unlit LED grid behind brightens around it.
 */

const PITCH = 10.4; // design units — tokens: dot.pitchDisplay
const W = 520; // design space (Figma "Headline art": 519 × 286)
const H = 290;
const LAYERS = 8;
const DEPTH = 18; // max extrusion (design units)

// Brand gradient for the face (tokens: cyan-400 → blue-700 → blue-950) and extrusion colour.
const FACE = ["#66ADC9", "#2457B0", "#0A1A4D"];
const EXTRUDE = [10, 26, 77]; // blue-950

type Dot = { x: number; y: number; r: number };

export function ZeroArt({ text = "0%", className }: { text?: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let glyph: Dot[] = [];
    let grid: Dot[] = [];
    let cssW = 0;
    let cssH = 0;
    let scale = 1;
    let raf = 0;
    let visible = false;
    let disposed = false;
    const t0 = performance.now();
    const pointer = { x: W / 2, y: H / 2, tx: W / 2, ty: H / 2, on: 0, target: 0 };

    const build = () => {
      // Rasterise the glyphs at 4× and measure coverage per grid cell.
      const S = 4;
      const off = document.createElement("canvas");
      off.width = W * S;
      off.height = H * S;
      const o = off.getContext("2d", { willReadFrequently: true })!;
      const family = getComputedStyle(document.body).fontFamily;
      let size = H * S * 1.18;
      o.font = `700 ${size}px ${family}`;
      const m = o.measureText(text);
      size *= Math.min(1, (W * S * 0.98) / m.width);
      o.font = `700 ${size}px ${family}`;
      const mm = o.measureText(text);
      const capH = mm.actualBoundingBoxAscent + mm.actualBoundingBoxDescent;
      o.fillStyle = "#000";
      o.textBaseline = "alphabetic";
      o.fillText(text, (W * S - mm.width) / 2, (H * S - capH) / 2 + mm.actualBoundingBoxAscent);
      const px = o.getImageData(0, 0, off.width, off.height).data;

      glyph = [];
      grid = [];
      const cols = Math.floor(W / PITCH);
      const rows = Math.floor(H / PITCH);
      const ox = (W - cols * PITCH) / 2;
      const oy = (H - rows * PITCH) / 2;
      const cell = Math.round(PITCH * S);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = ox + (c + 0.5) * PITCH;
          const y = oy + (r + 0.5) * PITCH;
          grid.push({ x, y, r: PITCH * 0.12 });
          let sum = 0;
          const x0 = Math.round((ox + c * PITCH) * S);
          const y0 = Math.round((oy + r * PITCH) * S);
          for (let yy = 0; yy < cell; yy += 2)
            for (let xx = 0; xx < cell; xx += 2) sum += px[((y0 + yy) * off.width + x0 + xx) * 4 + 3];
          const cover = sum / (255 * Math.ceil(cell / 2) ** 2);
          if (cover > 0.06) glyph.push({ x, y, r: PITCH * 0.44 * Math.sqrt(Math.min(1, cover * 1.15)) });
        }
      }
    };

    const layout = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scale = cssW / W;
    };

    const draw = (now: number) => {
      raf = 0;
      if (disposed || !glyph.length) return;
      pointer.x += (pointer.tx - pointer.x) * 0.12;
      pointer.y += (pointer.ty - pointer.y) * 0.12;
      pointer.on += (pointer.target - pointer.on) * 0.08;

      // Extrusion direction: away from the pointer, or a slow idle orbit.
      const t = reduce ? 0.6 : (now - t0) / 1000;
      const idleX = Math.cos(t * 0.5) * 0.7;
      const idleY = 0.55 + Math.sin(t * 0.5) * 0.35;
      let px = (W / 2 - pointer.x) / (W / 2);
      let py = (H / 2 - pointer.y) / (H / 2);
      const len = Math.hypot(px, py) || 1;
      px = (px / Math.max(1, len)) * 0.9;
      py = (py / Math.max(1, len)) * 0.9;
      const ex = (idleX + (px - idleX) * pointer.on) * DEPTH;
      const ey = (idleY + (py - idleY) * pointer.on) * DEPTH;

      ctx.clearRect(0, 0, cssW, cssH);
      ctx.save();
      ctx.scale(scale, scale);

      // Unlit LED grid, brightening around the pointer.
      const R = 90;
      for (const d of grid) {
        const f = pointer.on * Math.max(0, 1 - Math.hypot(d.x - pointer.x, d.y - pointer.y) / R);
        ctx.fillStyle = `rgba(18,18,18,${(0.07 + 0.25 * f * f).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r * (1 + 1.4 * f), 0, Math.PI * 2);
        ctx.fill();
      }

      const swell = (d: Dot) => {
        const f = pointer.on * Math.max(0, 1 - Math.hypot(d.x - pointer.x, d.y - pointer.y) / 70);
        return 1 + 0.35 * f * f;
      };

      // Extrusion: back to front, each layer a little smaller and lighter.
      for (let k = LAYERS; k >= 1; k--) {
        const s = k / LAYERS;
        const path = new Path2D();
        for (const d of glyph) {
          const r = d.r * (1 - 0.25 * s) * swell(d);
          const x = d.x + ex * s;
          const y = d.y + ey * s;
          path.moveTo(x + r, y);
          path.arc(x, y, r, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(${EXTRUDE[0]},${EXTRUDE[1]},${EXTRUDE[2]},${(0.04 + 0.1 * (1 - s)).toFixed(3)})`;
        ctx.fill(path);
      }

      // Face.
      const face = new Path2D();
      for (const d of glyph) {
        const r = d.r * swell(d);
        face.moveTo(d.x + r, d.y);
        face.arc(d.x, d.y, r, 0, Math.PI * 2);
      }
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, FACE[0]);
      g.addColorStop(0.5, FACE[1]);
      g.addColorStop(1, FACE[2]);
      ctx.fillStyle = g;
      ctx.fill(face);
      ctx.restore();

      const settling = Math.abs(pointer.target - pointer.on) > 0.002 || Math.abs(pointer.tx - pointer.x) > 0.3;
      if (visible && (!reduce || settling)) raf = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (!raf && visible && !disposed) raf = requestAnimationFrame(draw);
    };

    const host = canvas.parentElement ?? canvas;
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.tx = ((e.clientX - rect.left) / rect.width) * W;
      pointer.ty = ((e.clientY - rect.top) / rect.height) * H;
      pointer.target = 1;
      kick();
    };
    const onLeave = () => {
      pointer.target = 0;
      kick();
    };
    // Listen on the window: the figure reacts to the pointer anywhere in the section.
    const section = canvas.closest("section") ?? host;
    section.addEventListener("pointermove", onMove);
    section.addEventListener("pointerleave", onLeave);

    const ro = new ResizeObserver(() => {
      layout();
      kick();
    });
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      kick();
    });

    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (disposed) return;
      build();
      layout();
      ro.observe(canvas);
      io.observe(canvas);
    });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  }, [text]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
