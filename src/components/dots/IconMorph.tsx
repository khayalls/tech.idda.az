"use client";

import { useEffect, useRef, type RefObject } from "react";
import { ICONS, type IconName } from "./DotIcon";

/**
 * A large LED dot icon that transforms between the "More than tax" icons as you scroll.
 * Same 11 × 11 bitmaps as DotIcon, drawn big on an unlit grid. Between two icons every dot eases
 * to its new state on its own clock (staggered from the centre outwards); dots that switch on
 * overshoot a little, so the board visibly re-forms rather than cross-fading.
 */

export type IconMorphControl = {
  /** Continuous position: 0 = first icon, 1 = second, … (fractions are mid-transform). */
  setPosition: (pos: number) => void;
};

const N = 11;
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

const bitmap = (name: IconName) => {
  const rows = ICONS[name];
  const out = new Float32Array(N * N);
  rows.forEach((row, j) => [...row].forEach((ch, i) => (out[j * N + i] = ch === "#" ? 1 : 0)));
  return out;
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
    const maps = key.split(",").map((n) => bitmap(n as IconName));
    // Stagger: centre first, edges last.
    const delay = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) delay[j * N + i] = Math.hypot(i - 5, j - 5) / Math.hypot(5, 5);
    const colors = Array.from({ length: 2 * N - 1 }, (_, k) => grad(k / (2 * N - 2)));

    let size = 0;
    let pos = 0;
    let raf = 0;

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
      const P = size / N;
      const rOn = P * 0.36;
      const rOff = P * 0.09;
      const last = maps.length - 1;
      const p = Math.min(last, Math.max(0, pos));
      const k = Math.min(last - 1, Math.floor(p));
      const t = last === 0 ? 0 : p - k;
      const a = maps[k], b = maps[Math.min(last, k + 1)];

      ctx.fillStyle = "rgba(18,18,18,0.07)";
      ctx.beginPath();
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = (i + 0.5) * P, y = (j + 0.5) * P;
          ctx.moveTo(x + rOff, y);
          ctx.arc(x, y, rOff, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const c = j * N + i;
          const e = easeInOut(clamp01((t - delay[c] * 0.45) / 0.55));
          let v = a[c] + (b[c] - a[c]) * e;
          // Dots switching on overshoot slightly; dots switching off dip before they go.
          if (a[c] !== b[c]) v *= 1 + 0.3 * Math.sin(Math.PI * e) * (b[c] > a[c] ? 1 : -0.4);
          if (v < 0.04) continue;
          const r = Math.max(rOff, rOn * Math.sqrt(v));
          ctx.fillStyle = colors[i + j];
          ctx.beginPath();
          ctx.arc((i + 0.5) * P, (j + 0.5) * P, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
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
    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);
    resize();
    kick();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      controlRef.current = null;
    };
  }, [key, controlRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
