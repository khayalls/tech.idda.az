"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Dot globe with dots anchored to the sphere (they move and scale with it, so zooming is smooth —
 * no shimmering from re-sampling a moving map onto a fixed screen grid).
 *
 * Two point sets, both built at runtime from public/globe/mask.png (R = land, G = Azerbaijan):
 *  · world  — Fibonacci sphere, land only (even spacing everywhere);
 *  · country — a fine, evenly spaced grid inside Azerbaijan, used for the close-up.
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
  /** 0–1: Azerbaijan turns brand blue. */
  highlight: number;
  /** 0–1 opacity of every other country. */
  world: number;
  /** 0–1: hand-over from the world dots to the fine country dots. */
  detail: number;
  /** Extra size factor for the country dots at the end. */
  grow?: number;
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
const WORLD_POINTS = 60000; // ≈ 0.83° spacing
const COUNTRY_STEP = 0.0016; // rad (≈ 10 km) between country dots
const AZ_BOX = { lat0: 38.2, lat1: 42.0, lon0: 44.6, lon1: 50.6 };

const INK = [18, 18, 18]; // neutral-950
const BLUE = [36, 87, 176]; // blue-700

type Points = { x: Float32Array; y: Float32Array; z: Float32Array; cover: Float32Array; az: Uint8Array; n: number };

export function DotGlobe({ controlRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let world: Points | null = null;
    let country: Points | null = null;
    let cssW = 0;
    let cssH = 0;
    let raf = 0;
    let disposed = false;
    let view: GlobeView = { lon: 20, lat: 15, radius: 300, cx: 400, cy: 400, highlight: 0, world: 1, detail: 0 };
    const worldStep = Math.sqrt((4 * Math.PI) / WORLD_POINTS);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      cssW = r.width;
      cssH = r.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(cssW * dpr));
      canvas.height = Math.max(1, Math.round(cssH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const toPoints = (list: number[][]): Points => {
      const n = list.length;
      const p: Points = { x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), cover: new Float32Array(n), az: new Uint8Array(n), n };
      list.forEach(([lon, lat, cover, az], i) => {
        // Unit vector: x east, y north, z towards lon 0 / lat 0.
        p.x[i] = Math.cos(lat) * Math.sin(lon);
        p.y[i] = Math.sin(lat);
        p.z[i] = Math.cos(lat) * Math.cos(lon);
        p.cover[i] = cover;
        p.az[i] = az;
      });
      return p;
    };

    const build = (mask: Uint8Array, MW: number, MH: number) => {
      // Bilinear coverage → smooth coastlines (dot size follows how much land a dot covers).
      const sample = (lon: number, lat: number) => {
        const u = (lon / Math.PI + 1) * 0.5 * MW - 0.5;
        const v = (0.5 - lat / Math.PI) * MH - 0.5;
        const x0 = Math.floor(u), y0 = Math.max(0, Math.min(MH - 2, Math.floor(v)));
        const fx = u - x0, fy = v - y0;
        const xa = ((x0 % MW) + MW) % MW, xb = (xa + 1) % MW;
        const a = mask[y0 * MW + xa], b = mask[y0 * MW + xb], c = mask[(y0 + 1) * MW + xa], d = mask[(y0 + 1) * MW + xb];
        const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
        const v4 = [a, b, c, d];
        let land = 0, az = 0;
        for (let k = 0; k < 4; k++) {
          if (v4[k]) land += w[k];
          if (v4[k] === 2) az += w[k];
        }
        return [land, az];
      };

      const golden = Math.PI * (3 - Math.sqrt(5));
      const wl: number[][] = [];
      for (let i = 0; i < WORLD_POINTS; i++) {
        const y = 1 - (2 * (i + 0.5)) / WORLD_POINTS;
        const lat = Math.asin(y);
        const lon = ((((i * golden) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        const [land, az] = sample(lon, lat);
        if (land > 0.15) wl.push([lon, lat, land, az > 0.5 ? 1 : 0]);
      }
      world = toPoints(wl);

      const cl: number[][] = [];
      for (let lat = AZ_BOX.lat0 * D2R; lat <= AZ_BOX.lat1 * D2R; lat += COUNTRY_STEP) {
        const dLon = COUNTRY_STEP / Math.cos(lat);
        for (let lon = AZ_BOX.lon0 * D2R; lon <= AZ_BOX.lon1 * D2R; lon += dLon) {
          const [, az] = sample(lon, lat);
          if (az > 0.2) cl.push([lon, lat, az, 1]);
        }
      }
      country = toPoints(cl);
    };

    const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

    const draw = () => {
      raf = 0;
      if (!world || !country || disposed) return;
      ctx.clearRect(0, 0, cssW, cssH);
      const { radius: R, cx, cy, highlight: h, world: wo, detail } = view;
      const grow = view.grow ?? 1;
      const lam0 = view.lon * D2R, phi0 = view.lat * D2R;
      const sl = Math.sin(lam0), cl = Math.cos(lam0), sp = Math.sin(phi0), cp = Math.cos(phi0);

      // Soft disc behind the dots (fades with the world).
      if (wo > 0.01) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(18,18,18,${(0.03 * wo).toFixed(3)})`;
        ctx.fill();
      }

      const BUCKETS = 8;
      const draws: { path: Path2D; alpha: number; color: number[] }[] = [];
      const bucketPaths = (n: number) => Array.from({ length: n }, () => new Path2D());

      const project = (P: Points, i: number) => {
        // World → camera: rotate by -longitude, then by latitude.
        const x1 = P.x[i] * cl - P.z[i] * sl;
        const z1 = P.x[i] * sl + P.z[i] * cl;
        const y2 = P.y[i] * cp - z1 * sp;
        const z2 = P.y[i] * sp + z1 * cp;
        return [cx + x1 * R, cy - y2 * R, z2] as const;
      };
      const inView = (sx: number, sy: number, r: number) => sx > -r && sy > -r && sx < cssW + r && sy < cssH + r;

      // World dots (other countries fade out; Azerbaijan's coarse dots hand over to the fine set).
      // Capped so world dots never balloon while zooming — they thin out and fade instead.
      const worldR = Math.min(worldStep * R * 0.38, 3.2);
      const ink = bucketPaths(BUCKETS);
      const azCoarse = bucketPaths(BUCKETS);
      const azCoarseFade = 1 - detail;
      if (wo > 0.01 || azCoarseFade > 0.01) {
        for (let i = 0; i < world.n; i++) {
          const isAz = world.az[i] === 1;
          if (!isAz && wo <= 0.01) continue;
          const [sx, sy, z] = project(world, i);
          if (z <= 0) continue;
          const r = worldR * Math.sqrt(world.cover[i]) * (0.55 + 0.45 * z) * (isAz ? 1 + 0.25 * h : 1);
          if (r < 0.2 || !inView(sx, sy, r)) continue;
          const b = Math.min(BUCKETS - 1, Math.floor(z * BUCKETS));
          const path = isAz && h > 0 ? azCoarse[b] : ink[b];
          path.moveTo(sx + r, sy);
          path.arc(sx, sy, r, 0, Math.PI * 2);
        }
      }
      const azColor = mix(INK, BLUE, h);
      for (let b = 0; b < BUCKETS; b++) {
        const depth = (b + 0.5) / BUCKETS;
        draws.push({ path: ink[b], alpha: (0.1 + 0.6 * depth) * wo, color: INK });
        draws.push({ path: azCoarse[b], alpha: Math.min(1, 0.35 + 0.65 * depth) * azCoarseFade, color: azColor });
      }

      // Fine country dots for the close-up.
      if (detail > 0.01) {
        const fine = new Path2D();
        const fr = COUNTRY_STEP * R * 0.36 * grow;
        for (let i = 0; i < country.n; i++) {
          const [sx, sy, z] = project(country, i);
          if (z <= 0) continue;
          const r = fr * Math.sqrt(country.cover[i]);
          if (r < 0.2 || !inView(sx, sy, r)) continue;
          fine.moveTo(sx + r, sy);
          fine.arc(sx, sy, r, 0, Math.PI * 2);
        }
        draws.push({ path: fine, alpha: detail, color: azColor });
      }

      for (const d of draws) {
        if (d.alpha <= 0.005) continue;
        ctx.fillStyle = `rgba(${d.color[0]},${d.color[1]},${d.color[2]},${Math.min(1, d.alpha).toFixed(3)})`;
        ctx.fill(d.path);
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
      const MW = (off.width = img.naturalWidth);
      const MH = (off.height = img.naturalHeight);
      const octx = off.getContext("2d", { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0);
      const px = octx.getImageData(0, 0, MW, MH).data;
      const mask = new Uint8Array(MW * MH);
      for (let i = 0, j = 0; i < mask.length; i++, j += 4) mask[i] = px[j] > 127 ? (px[j + 1] > 127 ? 2 : 1) : 0;
      build(mask, MW, MH);
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
