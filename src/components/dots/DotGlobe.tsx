"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Halftone dot globe. Dots sit on a fixed screen grid (same pitch at every zoom, like the rest of
 * the dot art); each grid point is inverse-projected (orthographic) onto the sphere and sampled
 * from an equirectangular mask (R = land, G = Azerbaijan, public/globe/mask.png).
 * Coverage is sampled bilinearly so coastlines shrink/grow dots smoothly while the globe turns.
 */

export type GlobeView = {
  /** Centre longitude/latitude facing the viewer (degrees). */
  lon: number;
  lat: number;
  /** Sphere radius in CSS px. */
  radius: number;
  /** Sphere centre in CSS px. */
  cx: number;
  cy: number;
  /** 0–1 Azerbaijan highlight. */
  highlight: number;
  /** Land ink strength (1 = full). Lowered when zoomed so the country stands out. */
  ink?: number;
  /**
   * 0–1 exit: a halftone wipe sweeps up the screen and shrinks every dot to nothing, so the map
   * dissolves into the page background before the section unpins.
   */
  exit?: number;
};

export type DotGlobeControl = {
  setView: (v: GlobeView) => void;
  /** Screen position of a lon/lat for the current view (null when on the far side). */
  project: (lon: number, lat: number) => { x: number; y: number } | null;
  size: () => { w: number; h: number };
};

type Props = {
  controlRef: RefObject<DotGlobeControl | null>;
  /** Called after each draw; use it to sync overlays (labels). */
  onDraw?: () => void;
  className?: string;
  /** Grid pitch in CSS px. */
  pitch?: number;
};

const D2R = Math.PI / 180;
const MASK_SRC = "/globe/mask.png";

// Colours from tokens (canvas can't read CSS vars cheaply per frame).
const INK = [18, 18, 18]; // neutral-950
const BLUE = [36, 87, 176]; // blue-700

/** Stable 0–1 noise per grid cell (breaks up the exit wipe's edge). */
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export function DotGlobe({ controlRef, onDraw, className, pitch: pitchProp }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDrawRef = useRef(onDraw);
  useEffect(() => {
    onDrawRef.current = onDraw;
  }, [onDraw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let mask: Uint8Array | null = null; // 0 sea, 1 land, 2 Azerbaijan
    let MW = 0;
    let MH = 0;
    let cssW = 0;
    let cssH = 0;
    let raf = 0;
    let disposed = false;
    // 8px on desktop, 6px on phones (4px grid), unless overridden.
    const pitch = pitchProp ?? (window.innerWidth < 768 ? 6 : 8);
    let view: GlobeView = { lon: 20, lat: 15, radius: 300, cx: 400, cy: 400, highlight: 0 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Bilinear coverage of land (any) and of Azerbaijan at lon/lat (radians).
    const sample = (lon: number, lat: number) => {
      const u = ((lon / Math.PI + 1) * 0.5) * MW - 0.5;
      const v = (0.5 - lat / Math.PI) * MH - 0.5;
      const x0 = Math.floor(u);
      const y0 = Math.max(0, Math.min(MH - 2, Math.floor(v)));
      const fx = u - x0;
      const fy = v - y0;
      const xa = ((x0 % MW) + MW) % MW;
      const xb = (xa + 1) % MW;
      const m = mask!;
      const a = m[y0 * MW + xa], b = m[y0 * MW + xb], c = m[(y0 + 1) * MW + xa], d = m[(y0 + 1) * MW + xb];
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const land = (a ? w00 : 0) + (b ? w10 : 0) + (c ? w01 : 0) + (d ? w11 : 0);
      const az = (a === 2 ? w00 : 0) + (b === 2 ? w10 : 0) + (c === 2 ? w01 : 0) + (d === 2 ? w11 : 0);
      return [land, az] as const;
    };

    // Alpha buckets so each frame is a handful of fills instead of thousands.
    const BUCKETS = 10;
    const paths: Path2D[] = [];
    const azPaths: Path2D[] = [];

    const draw = () => {
      raf = 0;
      if (!mask || disposed) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const { radius: R, cx, cy, highlight: h } = view;
      const lam0 = view.lon * D2R;
      const phi0 = view.lat * D2R;
      const sp = Math.sin(phi0), cp = Math.cos(phi0), sl = Math.sin(lam0), cl = Math.cos(lam0);
      const rMax = pitch * 0.36;
      const exit = view.exit ?? 0;
      // Wipe edge travels from below the screen to above it; dots under the edge shrink away.
      const edge = cssH * (1.15 - 1.6 * exit);
      const band = 1 / (cssH * 0.4);
      for (let i = 0; i < BUCKETS; i++) {
        paths[i] = new Path2D();
        azPaths[i] = new Path2D();
      }

      // Faint sphere silhouette — only while the globe fits on screen; once it outgrows the
      // viewport it would just tint the whole page, so it fades out.
      const discK = Math.min(1, Math.max(0, 2 - R / (0.5 * Math.max(cssW, cssH))));
      if (discK > 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(18,18,18,${(0.025 * discK).toFixed(4)})`;
        ctx.fill();
      }

      const x0 = Math.max(0, Math.floor((cx - R) / pitch));
      const x1 = Math.min(Math.ceil(cssW / pitch), Math.ceil((cx + R) / pitch));
      const y0 = Math.max(0, Math.floor((cy - R) / pitch));
      const y1 = Math.min(Math.ceil(cssH / pitch), Math.ceil((cy + R) / pitch));
      const invR = 1 / R;

      for (let gy = y0; gy <= y1; gy++) {
        const sy = gy * pitch + pitch / 2;
        const ny = -(sy - cy) * invR;
        const dRow = (sy - edge) * band;
        if (exit > 0 && dRow > 1.2) break; // everything further down is gone
        for (let gx = x0; gx <= x1; gx++) {
          const sx = gx * pitch + pitch / 2;
          const nx = (sx - cx) * invR;
          const rho2 = nx * nx + ny * ny;
          if (rho2 >= 1) continue;
          let keep = 1;
          if (exit > 0) {
            const d = dRow + (hash(gx, gy) - 0.5) * 0.35;
            if (d >= 1) continue;
            if (d > 0) keep = 1 - d * d * (3 - 2 * d);
            if (keep < 0.04) continue;
          }
          const z = Math.sqrt(1 - rho2); // depth: 1 at centre, 0 at limb
          // Camera → world: rotate by latitude, then longitude.
          const y1w = ny * cp + z * sp;
          const z1w = -ny * sp + z * cp;
          const xw = nx * cl + z1w * sl;
          const zw = -nx * sl + z1w * cl;
          const lat = Math.asin(y1w);
          const lon = Math.atan2(xw, zw);
          const [land, az] = sample(lon, lat);
          const depth = 0.35 + 0.65 * z;
          if (land < 0.04) {
            // Ocean: tiny dots give the sphere its form.
            const b = Math.min(BUCKETS - 1, Math.floor(z * 3));
            const ro = pitch * 0.09 * keep;
            paths[b].moveTo(sx + ro, sy);
            paths[b].arc(sx, sy, ro, 0, Math.PI * 2);
            continue;
          }
          const isAz = az > 0.04 && h > 0;
          const r = rMax * Math.sqrt(land) * (0.55 + 0.45 * z) * (isAz ? 1 + 0.3 * h * az : 1) * keep;
          const b = Math.min(BUCKETS - 1, Math.floor(depth * BUCKETS));
          const target = isAz ? azPaths : paths;
          target[b].moveTo(sx + r, sy);
          target[b].arc(sx, sy, r, 0, Math.PI * 2);
        }
      }

      for (let b = 0; b < BUCKETS; b++) {
        const depth = (b + 0.5) / BUCKETS;
        ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${((0.08 + 0.62 * depth) * (view.ink ?? 1)).toFixed(3)})`;
        ctx.fill(paths[b]);
      }
      if (h > 0) {
        // Azerbaijan: ink → brand blue.
        const mix = (a: number[], c: number[], t: number) => a.map((v, i) => Math.round(v + (c[i] - v) * t));
        const [r, g, bl] = mix(INK, BLUE, h);
        for (let b = 0; b < BUCKETS; b++) {
          const depth = (b + 0.5) / BUCKETS;
          ctx.fillStyle = `rgba(${r},${g},${bl},${Math.min(1, 0.3 + 0.7 * depth + 0.3 * h).toFixed(3)})`;
          ctx.fill(azPaths[b]);
        }
      }
      onDrawRef.current?.();
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    controlRef.current = {
      setView: (v) => {
        view = v;
        schedule();
      },
      project: (lonDeg, latDeg) => {
        const lam = lonDeg * D2R, phi = latDeg * D2R;
        const lam0 = view.lon * D2R, phi0 = view.lat * D2R;
        // World → camera (inverse of draw's rotation).
        const xw = Math.cos(phi) * Math.sin(lam), yw = Math.sin(phi), zw = Math.cos(phi) * Math.cos(lam);
        const x1 = xw * Math.cos(lam0) - zw * Math.sin(lam0);
        const z1 = xw * Math.sin(lam0) + zw * Math.cos(lam0);
        const ny = yw * Math.cos(phi0) - z1 * Math.sin(phi0);
        const z = yw * Math.sin(phi0) + z1 * Math.cos(phi0);
        if (z <= 0) return null;
        return { x: view.cx + x1 * view.radius, y: view.cy - ny * view.radius };
      },
      size: () => ({ w: cssW, h: cssH }),
    };

    const ro = new ResizeObserver(() => {
      resize();
      schedule();
    });
    ro.observe(canvas);
    resize();

    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (disposed) return;
      const off = document.createElement("canvas");
      MW = off.width = img.naturalWidth;
      MH = off.height = img.naturalHeight;
      const octx = off.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0);
      const px = octx.getImageData(0, 0, MW, MH).data;
      mask = new Uint8Array(MW * MH);
      for (let i = 0, j = 0; i < mask.length; i++, j += 4) mask[i] = px[j] > 127 ? (px[j + 1] > 127 ? 2 : 1) : 0;
      schedule();
    };
    img.src = MASK_SRC;

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      controlRef.current = null;
    };
  }, [controlRef, pitchProp]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
