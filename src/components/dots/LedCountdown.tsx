"use client";

import { useEffect, useRef } from "react";

/**
 * LED countdown (Figma 09 "Countdown — LED", 795 × 105): DD:HH:MM:SS on a fine dot matrix.
 *
 *  · Readable: the digits are rasterised from the site font (tabular figures) and sampled on a
 *    20-row grid; each dot's size follows how much of its cell the glyph covers, so the figures
 *    keep their real shapes instead of a coarse 5 × 7 font.
 *  · Alive: when a digit changes, every dot springs to its new size on its own slightly
 *    different spring, so figures re-form like an LED board settling; colons breathe each second.
 *  · Unlit LEDs stay visible as a faint grid.
 */

const W = 795;
const H = 105;
const ROWS = 20;
const P = H / ROWS; // pitch
const COLS = Math.floor(W / P);
const OX = (W - COLS * P) / 2;
const R_ON = P * 0.43;
const R_OFF = P * 0.16;
const S = 3; // raster supersampling

// Figma layout: four 165-wide groups with 45-wide colons between them.
const GROUPS = [0, 210, 420, 630];
const COLONS = [165, 375, 585];
const GW = 165;
const CW = 45;

// Brand dot gradient (tokens cyan-400 → blue-700 → blue-950), left to right.
const STOPS: [number, number[]][] = [
  [0, [102, 173, 201]],
  [0.5, [36, 87, 176]],
  [1, [10, 26, 77]],
];
const colorAt = (t: number) => {
  const i = t < 0.5 ? 0 : 1;
  const [a, ca] = STOPS[i];
  const [b, cb] = STOPS[i + 1];
  const k = (t - a) / (b - a);
  return ca.map((v, j) => Math.round(v + (cb[j] - v) * k));
};
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Remaining time to `target` as two-digit strings (days capped at 99). */
function parts(target: number, now: number) {
  let s = Math.max(0, Math.floor((target - now) / 1000));
  const d = Math.min(99, Math.floor(s / 86400));
  s -= Math.floor(s / 86400) * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return [d, h, m, s].map((v) => String(v).padStart(2, "0"));
}

type Props = { target: number; className?: string };

export function LedCountdown({ target, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const N = COLS * ROWS;
    const tgt = new Float32Array(N);
    const cur = new Float32Array(N);
    const vel = new Float32Array(N);
    const stiff = new Float32Array(N);
    const isColon = new Uint8Array(N);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) stiff[r * COLS + c] = 0.08 + 0.1 * hash(c, r);

    const off = document.createElement("canvas");
    off.width = W * S;
    off.height = H * S;
    const o = off.getContext("2d", { willReadFrequently: true })!;
    let font = "";
    let baseline = 0;

    const setupFont = () => {
      const family = getComputedStyle(document.body).fontFamily;
      // Size the figures so a digit is ~84% of the board height.
      let size = H * S;
      o.font = `500 ${size}px ${family}`;
      const m = o.measureText("0");
      const digitH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
      size *= (H * S * 0.84) / digitH;
      font = `500 ${size}px ${family}`;
      o.font = font;
      const mm = o.measureText("0");
      baseline = (H * S + mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2;
    };

    let shown = "";
    const raster = (text: string[]) => {
      o.clearRect(0, 0, off.width, off.height);
      o.fillStyle = "#000";
      o.font = font;
      o.textBaseline = "alphabetic";
      // Each pair of digits: two equal cells inside its group, so figures never shift.
      text.forEach((pair, g) => {
        for (let k = 0; k < 2; k++) {
          const ch = pair[k];
          const w = o.measureText(ch).width;
          const cx = (GROUPS[g] + GW * (0.27 + 0.46 * k)) * S;
          o.fillText(ch, cx - w / 2, baseline);
        }
      });
      // Colons: two round dots, a little above the optical centre.
      for (const x of COLONS) {
        for (const y of [0.33, 0.7]) {
          o.beginPath();
          o.arc((x + CW / 2) * S, H * y * S, P * 0.9 * S, 0, Math.PI * 2);
          o.fill();
        }
      }
      const px = o.getImageData(0, 0, off.width, off.height).data;
      const cell = P * S;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const x0 = Math.floor((OX + c * P) * S);
          const y0 = Math.floor(r * P * S);
          let sum = 0;
          let n = 0;
          for (let y = y0; y < y0 + cell; y += 2) {
            for (let x = x0; x < x0 + cell; x += 2) {
              sum += px[(Math.floor(y) * off.width + Math.floor(x)) * 4 + 3];
              n++;
            }
          }
          const i = r * COLS + c;
          tgt[i] = Math.min(1, (sum / n / 255) * 1.35);
          const xc = OX + (c + 0.5) * P;
          isColon[i] = COLONS.some((cx) => xc > cx && xc < cx + CW) ? 1 : 0;
        }
      }
    };

    let cssW = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      const k = (rect.width / W) * dpr;
      ctx.setTransform(k, 0, 0, k, 0, 0);
    };

    const B = 12;
    const colors = Array.from({ length: B }, (_, b) => colorAt((b + 0.5) / B));
    let raf = 0;
    let visible = false;
    let last = performance.now();

    const tick = (now: number) => {
      raf = 0;
      const dt = Math.min(3, (now - last) / 16.67);
      last = now;
      const p = parts(target, Date.now());
      const key = p.join("");
      if (key !== shown) {
        shown = key;
        raster(p);
        if (reduce) cur.set(tgt);
      }
      // Colons breathe with the seconds.
      const ms = Date.now() % 1000;
      const breathe = reduce ? 1 : 0.45 + 0.55 * Math.pow(1 - ms / 1000, 2);

      ctx.clearRect(0, 0, W, H);
      const offPath = new Path2D();
      const onPaths = Array.from({ length: B }, () => new Path2D());
      for (let r = 0; r < ROWS; r++) {
        const y = (r + 0.5) * P;
        for (let c = 0; c < COLS; c++) {
          const i = r * COLS + c;
          const x = OX + (c + 0.5) * P;
          if (!reduce) {
            // Under-damped spring: dots overshoot a touch, then settle.
            vel[i] += (tgt[i] - cur[i]) * stiff[i] * dt;
            vel[i] *= Math.pow(0.72, dt);
            cur[i] += vel[i] * dt;
          }
          let v = Math.max(0, cur[i]);
          if (isColon[i]) v *= breathe;
          if (v < 0.06) {
            offPath.moveTo(x + R_OFF, y);
            offPath.arc(x, y, R_OFF, 0, Math.PI * 2);
            continue;
          }
          const rad = Math.max(R_OFF, R_ON * Math.sqrt(Math.min(1.25, v)));
          const b = Math.min(B - 1, Math.floor((x / W) * B));
          onPaths[b].moveTo(x + rad, y);
          onPaths[b].arc(x, y, rad, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = "rgba(18,18,18,0.07)";
      ctx.fill(offPath);
      for (let b = 0; b < B; b++) {
        const [r, g, bl] = colors[b];
        ctx.fillStyle = `rgb(${r},${g},${bl})`;
        ctx.fill(onPaths[b]);
      }
      if (visible) raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!raf && cssW > 0) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start();
    });
    io.observe(canvas);
    resize();
    setupFont();
    document.fonts?.ready.then(() => {
      setupFont();
      shown = "";
      start();
    });
    start();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [target]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
