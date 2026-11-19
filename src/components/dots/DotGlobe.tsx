"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Dot globe with one continuous dot system.
 *
 * Dots sit on a latitude/longitude lattice anchored to the sphere, so they travel with the map
 * (no shimmer). The lattice has levels: each level halves the spacing of the previous one and
 * contains it. While zooming, the current level's dots stay put and the next level's dots grow
 * in between them; when the zoom has doubled, that next level becomes the current one. On screen
 * the dot pitch therefore stays within one octave — like map tiles, but for halftone dots.
 *
 * Land / Azerbaijan come from public/globe/mask.png (R = land, G = Azerbaijan).
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
  /** 0–1: Azerbaijan turns brand blue and grows a little. */
  highlight: number;
  /** Land ink strength for the rest of the world (1 = full). */
  ink?: number;
};

export type DotGlobeControl = {
  setView: (v: GlobeView) => void;
  size: () => { w: number; h: number };
};

type Props = {
  controlRef: RefObject<DotGlobeControl | null>;
  className?: string;
};

const D2R = Math.PI / 180;
const MASK_SRC = "/globe/mask.png";
const S0 = (2 * Math.PI) / 256; // level-0 lattice spacing (rad)
const COS_REF = Math.cos(40 * D2R);

const INK = [18, 18, 18]; // neutral-950
const BLUE = [36, 87, 176]; // blue-700

export function DotGlobe({ controlRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let mask: Uint8Array | null = null;
    let MW = 0;
    let MH = 0;
    let cssW = 0;
    let cssH = 0;
    let raf = 0;
    let disposed = false;
    let view: GlobeView = { lon: 20, lat: 15, radius: 300, cx: 400, cy: 400, highlight: 0 };
    // Target on-screen pitch (px) at the start of a level; it grows to 2× before the next level fills in.
    let P = 10;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      P = cssW < 768 ? 7 : 10;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    // Bilinear land / Azerbaijan coverage at lon/lat (radians).
    const sample = (lon: number, lat: number) => {
      const m = mask!;
      const u = (lon / Math.PI + 1) * 0.5 * MW - 0.5;
      const v = (0.5 - lat / Math.PI) * MH - 0.5;
      const x0 = Math.floor(u);
      const y0 = Math.max(0, Math.min(MH - 2, Math.floor(v)));
      const fx = u - x0, fy = v - y0;
      const xa = ((x0 % MW) + MW) % MW, xb = (xa + 1) % MW;
      const a = m[y0 * MW + xa], b = m[y0 * MW + xb], c = m[(y0 + 1) * MW + xa], d = m[(y0 + 1) * MW + xb];
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      landOut = (a ? w00 : 0) + (b ? w10 : 0) + (c ? w01 : 0) + (d ? w11 : 0);
      azOut = (a === 2 ? w00 : 0) + (b === 2 ? w10 : 0) + (c === 2 ? w01 : 0) + (d === 2 ? w11 : 0);
    };
    let landOut = 0;
    let azOut = 0;

    const BUCKETS = 8;

    const draw = () => {
      raf = 0;
      if (!mask || disposed) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const { radius: R, cx, cy, highlight: h } = view;
      const ink = view.ink ?? 1;
      const lam0 = view.lon * D2R, phi0 = view.lat * D2R;
      const sl = Math.sin(lam0), cl = Math.cos(lam0), sp = Math.sin(phi0), cp = Math.cos(phi0);

      // Soft disc behind the dots.
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(18,18,18,${(0.03 * ink).toFixed(3)})`;
      ctx.fill();

      // Level selection: pitch of level L on screen = S0·R / 2^L, kept within [P, 2P).
      const octaves = Math.max(0, Math.log2((S0 * R) / P));
      const L = Math.floor(octaves);
      const t = octaves - L; // 0 → 1: next level's dots grow in
      const grow = t * t * (3 - 2 * t);
      const sFine = S0 / 2 ** (L + 1); // lattice we iterate (current level + the one filling in)
      const rDot = P * 0.38;

      // Visible angular radius around the view centre (whole hemisphere when zoomed out).
      const reach = Math.hypot(Math.max(cx, cssW - cx), Math.max(cy, cssH - cy)) / R;
      const ang = reach >= 1 ? Math.PI / 2 : Math.asin(reach) + 0.02;

      const ink8 = Array.from({ length: BUCKETS }, () => new Path2D());
      const az8 = Array.from({ length: BUCKETS }, () => new Path2D());

      const latMin = Math.max(-Math.PI / 2, phi0 - ang);
      const latMax = Math.min(Math.PI / 2, phi0 + ang);
      const i0 = Math.ceil(latMin / sFine);
      const i1 = Math.floor(latMax / sFine);

      for (let i = i0; i <= i1; i++) {
        const lat = i * sFine;
        const cosLat = Math.cos(lat);
        if (cosLat < 1e-3) continue;
        // Longitude spacing is evened out for mid-latitudes (Azerbaijan ≈ 40°) and widens by powers
        // of two towards the poles — powers of two keep rows nested across levels.
        const k = Math.min(16, 2 ** Math.max(0, Math.round(Math.log2(COS_REF / cosLat))));
        const dLon = (sFine * k) / COS_REF;
        const lonReach = Math.min(Math.PI, ang / Math.max(cosLat, 0.05) + dLon);
        const j0 = Math.ceil((lam0 - lonReach) / dLon);
        const j1 = Math.floor((lam0 + lonReach) / dLon);
        const rowIsCoarse = (i & 1) === 0;
        const sinLat = Math.sin(lat);
        for (let j = j0; j <= j1; j++) {
          // Belongs to the current level only if both indices are even; otherwise it is growing in.
          const isNew = !(rowIsCoarse && (j & 1) === 0);
          if (isNew && grow <= 0.01) continue;
          const lon = j * dLon;
          const xw = cosLat * Math.sin(lon);
          const zw = cosLat * Math.cos(lon);
          const x1 = xw * cl - zw * sl;
          const z1 = xw * sl + zw * cl;
          const y2 = sinLat * cp - z1 * sp;
          const z = sinLat * sp + z1 * cp;
          if (z <= 0) continue;
          const sx = cx + x1 * R;
          const sy = cy - y2 * R;
          if (sx < -8 || sy < -8 || sx > cssW + 8 || sy > cssH + 8) continue;
          let wrapped = lon;
          wrapped = ((((wrapped + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
          sample(wrapped, lat);
          if (landOut < 0.05) continue;
          const isAz = azOut > 0.25 && h > 0;
          let r = rDot * Math.sqrt(landOut) * (0.55 + 0.45 * z) * (isNew ? grow : 1);
          if (isAz) r *= 1 + 0.25 * h;
          if (r < 0.25) continue;
          const b = Math.min(BUCKETS - 1, Math.floor(z * BUCKETS));
          const path = isAz ? az8[b] : ink8[b];
          path.moveTo(sx + r, sy);
          path.arc(sx, sy, r, 0, Math.PI * 2);
        }
      }

      const azColor = INK.map((v, i) => Math.round(v + (BLUE[i] - v) * h));
      for (let b = 0; b < BUCKETS; b++) {
        const depth = (b + 0.5) / BUCKETS;
        ctx.fillStyle = `rgba(${INK[0]},${INK[1]},${INK[2]},${((0.12 + 0.58 * depth) * ink).toFixed(3)})`;
        ctx.fill(ink8[b]);
        const azAlpha = Math.min(1, (0.12 + 0.58 * depth) * (ink + (1 - ink) * h) + 0.4 * h);
        ctx.fillStyle = `rgba(${azColor[0]},${azColor[1]},${azColor[2]},${azAlpha.toFixed(3)})`;
        ctx.fill(az8[b]);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    controlRef.current = {
      setView: (v) => {
        view = v;
        schedule();
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
  }, [controlRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
