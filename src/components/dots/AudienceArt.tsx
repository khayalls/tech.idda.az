"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Dot illustrations for "Who can apply" (Figma 07, art box 395 × 252).
 *
 * Two lattices, as in the design:
 *  · an unlit LED grid over the whole box (16 × 10, pitch 26.04 × 27.49, Ø 4.3),
 *  · the figure on a lattice twice as fine and aligned with it, so every other figure dot sits on
 *    an LED. Each figure is a small signed-distance scene; a dot's size follows how much of its
 *    cell the shape covers (halftone), so strokes stay smooth at this low resolution.
 * Colour runs left → right from pale to bright blue (Figma dot gradient).
 *
 *  tech     — three office towers on a street; windows switch on and off.
 *  freelance — a laptop; a line of code types itself, the cursor blinks.
 *  nomad    — a turning globe; a plane flies an arc over it, leaving a dotted trail.
 */

export type AudienceArtName = "tech" | "freelance" | "nomad";

export type AudienceArtControl = {
  /** 0–1: dots grow in with a left → right sweep. */
  setAppear: (v: number) => void;
};

type Props = {
  name: AudienceArtName;
  controlRef?: RefObject<AudienceArtControl | null>;
  className?: string;
};

const W = 395;
const H = 252;
const GX = 26.04; // LED grid pitch (Figma "grid")
const GY = 27.49;
const PX = GX / 2; // figure lattice
const PY = GY / 2;
const R_LED = 2.17;
const R_DOT = 5.1; // full-coverage figure dot radius
const FROM = [204, 223, 255]; // Figma dot gradient: pale blue …
const TO = [66, 135, 245]; // … to bright blue

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

// ——— Signed distances (design units) ———
const sdBox = (x: number, y: number, cx: number, cy: number, hw: number, hh: number, r = 0) => {
  const qx = Math.abs(x - cx) - hw + r;
  const qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
/** Coverage of a stroke: full within half the line width, then tapering over about half a cell. */
const stroke = (d: number, w = 3) => clamp01(1 - Math.max(0, Math.abs(d) - w / 2) / (PX * 0.6));
/** Lattice coordinates → design units, so straight edges sit exactly on a row or column. */
const lx = (i: number) => R_LED + i * PX;
const ly = (j: number) => R_LED + j * PY;

/** A scene returns the coverage (0–1) of the figure at a lattice point. */
type Scene = (x: number, y: number, col: number, row: number, t: number) => number;

// ——— Tech companies: three towers ———
const TOWERS = [
  { x0: lx(7), x1: lx(11), top: ly(7) },
  { x0: lx(13), x1: lx(17), top: ly(3) },
  { x0: lx(19), x1: lx(23), top: ly(9) },
];
const GROUND = ly(16);
const tech: Scene = (x, y, col, row, t) => {
  // Street: one solid row, a fainter kerb below.
  if (Math.abs(y - GROUND) < 1 && x > lx(5) - 1 && x < lx(25) + 1) return 1;
  // Antenna on the tall tower, with a beacon.
  if (Math.abs(x - lx(15)) < 1 && y >= ly(1) - 1 && y < ly(3)) {
    if (y < ly(1) + 1) return 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.2));
    return 0.8;
  }
  let v = 0;
  for (let i = 0; i < TOWERS.length; i++) {
    const b = TOWERS[i];
    const cx = (b.x0 + b.x1) / 2, hw = (b.x1 - b.x0) / 2;
    const cy = (b.top + GROUND) / 2, hh = (GROUND - b.top) / 2;
    const d = sdBox(x, y, cx, cy, hw, hh);
    if (d > PX) continue;
    const edge = stroke(d, 3);
    if (d < -PX * 0.6) {
      // Interior: windows on every other lattice point; each one has its own slow switch.
      const isWin = (col & 1) === 0 && (row & 1) === 0 && y < GROUND - PY;
      if (isWin) {
        const h = hash(col, row + i * 31);
        const on = 0.5 + 0.5 * Math.sin(t * (0.35 + h * 0.5) + h * 40);
        v = Math.max(v, 0.32 + 0.68 * ss(0.35, 0.75, on));
      } else v = Math.max(v, 0.12);
    } else v = Math.max(v, edge);
  }
  return v;
};

// ——— Freelancers: laptop with code typing itself ———
// Screen: columns 7–23, rows 2–12; deck on row 14, its foot on row 15.
const SCR = { cx: lx(15), cy: (ly(2) + ly(12)) / 2, hw: lx(15) - lx(7), hh: (ly(12) - ly(2)) / 2 };
const CODE = [
  { indent: 0, len: 6 },
  { indent: 1, len: 9 },
  { indent: 2, len: 5 },
  { indent: 1, len: 3 },
];
const CODE_TOTAL = CODE.reduce((s, l) => s + l.len, 0);
const freelance: Scene = (x, y, col, row, t) => {
  // Screen frame and a slim hinge.
  // Screen frame with softened corners (the corner dot is dropped, the ones beside it shrink).
  const frame = stroke(sdBox(x, y, SCR.cx, SCR.cy, SCR.hw, SCR.hh, PX * 1.2), 2.6);
  if (frame > 0.05) return frame;
  // Deck: a full row wider than the screen, with a trackpad notch; a short foot below it.
  if (Math.abs(y - ly(14)) < 1 && col >= 4 && col <= 26) return col >= 13 && col <= 17 ? 0.38 : 1;
  if (Math.abs(y - ly(15)) < 1 && col >= 6 && col <= 24) return 0.42;
  // Code on the screen: lines on rows 4, 6, 8, 10; they type in, hold, then clear and restart.
  if (row < 4 || row > 10 || row % 2 === 1) return 0;
  const lineIdx = (row - 4) / 2;
  const cell = col - 9;
  const line = CODE[lineIdx];
  const k = cell - line.indent * 2;
  const cycle = (t % 8) / 8; // 0–1 every 8 s
  const typed = Math.floor(ss(0.04, 0.68, cycle) * CODE_TOTAL);
  const fade = 1 - ss(0.9, 1, cycle);
  // Where the cursor is: the line being typed and the cell after its last character.
  let curLine = CODE.length - 1;
  let curK = CODE[curLine].len;
  for (let i = 0, rest = typed; i < CODE.length; i++) {
    if (rest < CODE[i].len) {
      curLine = i;
      curK = rest;
      break;
    }
    rest -= CODE[i].len;
  }
  if (lineIdx < curLine || (lineIdx === curLine && k < curK)) {
    // Typed characters; the first token of each line is brighter (keyword).
    if (k >= 0 && k < line.len) return (k < 2 ? 1 : 0.62) * fade;
  }
  if (lineIdx === curLine && k === curK && Math.sin(t * 7) > -0.1) return 0.9 * fade;
  return 0;
};

// ——— Digital nomads: a shaded globe with a plane orbiting it ———
const G = { cx: lx(15), cy: ly(9), r: 74 };
const LIGHT = [-0.5, -0.55, 0.67]; // from the top left, towards the viewer (screen y down)
const ORBIT = { a: 132, b: 58, tilt: (-24 * Math.PI) / 180 };
const COS_T = Math.cos(ORBIT.tilt), SIN_T = Math.sin(ORBIT.tilt);
const nomad: Scene = (x, y, _c, row, t) => {
  const dx = x - G.cx, dy = y - G.cy;
  const rr = Math.hypot(dx, dy);
  let v = 0;
  const inDisc = rr < G.r;
  if (inDisc) {
    // Halftone shading: big dots on the lit side, small towards the terminator.
    const nx = dx / G.r, ny = dy / G.r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    v = 0.24 + 0.76 * lit;
    // Graticule as grooves: equator and two parallels (rows), and two turning meridians.
    if (row === 9 || row === 6 || row === 12) v *= 0.25;
    for (let k = 0; k < 2; k++) {
      const ph = t * 0.5 + k * Math.PI * 0.5;
      if (Math.cos(ph) <= 0) continue;
      const mx = Math.sin(ph) * G.r * Math.sqrt(Math.max(0, 1 - ny * ny));
      if (Math.abs(dx - mx) < PX * 0.5) v *= 0.25 + 0.75 * (1 - Math.cos(ph));
    }
    // A thin rim keeps the silhouette round.
    v = Math.max(v, 0.55 * stroke(rr - G.r + 1.5, 2));
  } else {
    v = Math.max(v, 0.55 * stroke(rr - G.r + 1.5, 2));
  }
  // Orbit: a tilted ellipse around the globe; the far half passes behind it.
  const u = dx * COS_T + dy * SIN_T; // into the orbit's frame
  const w = -dx * SIN_T + dy * COS_T;
  const f = (u / ORBIT.a) ** 2 + (w / ORBIT.b) ** 2 - 1;
  const g = 2 * Math.hypot(u / ORBIT.a ** 2, w / ORBIT.b ** 2);
  const d = f / Math.max(g, 1e-3);
  const phi = Math.atan2(w / ORBIT.b, u / ORBIT.a); // 0…π is the near (lower) half
  const near = Math.sin(phi) > 0;
  const hidden = !near && inDisc;
  const head = (t * 0.9) % (Math.PI * 2);
  if (!hidden) {
    const on = stroke(d, 3);
    if (on > 0.05) {
      // Trail: brightest right behind the plane, fading over a third of the orbit.
      let behind = head - (phi < 0 ? phi + Math.PI * 2 : phi);
      if (behind < 0) behind += Math.PI * 2;
      // Only the trail is drawn (no full ring), so it reads as a flight, not a planet's ring.
      const trail = behind < 2.8 ? 1 - behind / 2.8 : 0;
      if (trail > 0) v = Math.max(v, on * (0.15 + 0.85 * trail * trail));
    }
  }
  // The plane itself.
  {
    const hx = ORBIT.a * Math.cos(head), hw = ORBIT.b * Math.sin(head);
    const sx = G.cx + hx * COS_T - hw * SIN_T, sy = G.cy + hx * SIN_T + hw * COS_T;
    const behindGlobe = Math.sin(head) < 0 && Math.hypot(sx - G.cx, sy - G.cy) < G.r;
    if (!behindGlobe) v = Math.max(v, clamp01(1.45 - Math.hypot(x - sx, y - sy) / (PX * 1.05)));
  }
  return v;
};

const SCENES: Record<AudienceArtName, Scene> = { tech, freelance, nomad };

export function AudienceArt({ name, controlRef, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = SCENES[name];
    let raf = 0;
    let visible = false;
    let appear = controlRef ? 0 : 1;
    let scale = 1;
    const t0 = performance.now();
    // Freeze reduced-motion scenes on a representative frame.
    const STILL = { tech: 3, freelance: 4.6, nomad: 2.4 }[name];

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      scale = r.width / W;
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    };

    const draw = (now: number) => {
      raf = 0;
      const t = reduce ? STILL : (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // Unlit LED grid.
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.beginPath();
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 16; c++) {
          const x = R_LED + c * GX, y = R_LED + r * GY;
          ctx.moveTo(x + R_LED, y);
          ctx.arc(x, y, R_LED, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // Figure: colour buckets by x for a handful of fills per frame.
      const B = 8;
      const paths = Array.from({ length: B }, () => new Path2D());
      const cols = Math.round((W - 2 * R_LED) / PX);
      const rows = Math.round((H - 2 * R_LED) / PY);
      for (let row = 0; row <= rows; row++) {
        const y = R_LED + row * PY;
        for (let col = 0; col <= cols; col++) {
          const x = R_LED + col * PX;
          let v = scene(x, y, col, row, t);
          if (v <= 0.03) continue;
          // Appear: a soft sweep from the left, each dot growing in.
          if (appear < 1) {
            const k = ss(0, 1, appear * 1.5 - (x / W) * 0.5 - hash(col, row) * 0.12);
            v *= k;
            if (v <= 0.03) continue;
          }
          const rad = R_DOT * Math.sqrt(v);
          const b = Math.min(B - 1, Math.floor((x / W) * B));
          paths[b].moveTo(x + rad, y);
          paths[b].arc(x, y, rad, 0, Math.PI * 2);
        }
      }
      for (let b = 0; b < B; b++) {
        const k = (b + 0.5) / B;
        const c = FROM.map((f, i) => Math.round(f + (TO[i] - f) * k));
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
        ctx.fill(paths[b]);
      }

      if (visible && !reduce) raf = requestAnimationFrame(draw);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(draw);
    };

    if (controlRef) {
      controlRef.current = {
        setAppear: (v) => {
          if (Math.abs(v - appear) < 0.001) return;
          appear = v;
          kick();
        },
      };
    }

    const ro = new ResizeObserver(() => {
      resize();
      kick();
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    resize();
    kick();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      if (controlRef) controlRef.current = null;
    };
  }, [name, controlRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
