"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Dot illustrations for "Who can apply" (Figma 07, art box 395 × 252).
 *
 * Two lattices, as in the design:
 *  · an unlit LED grid over the whole box (16 × 10, pitch 26.04 × 27.49, Ø 4.3),
 *  · the figure on a lattice three times as fine and aligned with it, so every third figure dot
 *    sits on an LED. Each figure is a small signed-distance scene; a dot's size follows how much of its
 *    cell the shape covers (halftone), so strokes stay smooth at this low resolution.
 * Colour runs left → right from pale to bright blue (Figma dot gradient).
 *
 *  tech      — three towers on a street, windows switching on and off, data pulses on the wires
 *              between their roofs (a team, connected).
 *  freelance — a laptop typing code with a blinking cursor, a mug steaming beside it (solo work).
 *  nomad     — a shaded globe with a pin pulsing on it (live here), a plane orbiting with a trail
 *              (earn from abroad).
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
const F = 3; // figure lattice: three figure dots per LED pitch (every third one sits on an LED)
const PX = GX / F;
const PY = GY / F;
const R_LED = 2.17;
const R_DOT = 3.45; // full-coverage figure dot radius
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
const stroke = (d: number, w = 2.4) => clamp01(1 - Math.max(0, Math.abs(d) - w / 2) / (PX * 0.6));
/** Lattice coordinates → design units, so straight edges sit exactly on a row or column. */
const lx = (i: number) => R_LED + i * PX;
const ly = (j: number) => R_LED + j * PY;

/** Sampled curve with arc-length parameter, for wires and paths. */
type Curve = { x: number[]; y: number[]; s: number[]; len: number };
const quad = (ax: number, ay: number, cx: number, cy: number, bx: number, by: number, n = 48): Curve => {
  const x: number[] = [], y: number[] = [], sArr: number[] = [];
  let len = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const px = u * u * ax + 2 * u * t * cx + t * t * bx;
    const py = u * u * ay + 2 * u * t * cy + t * t * by;
    if (i) len += Math.hypot(px - x[i - 1], py - y[i - 1]);
    x.push(px);
    y.push(py);
    sArr.push(len);
  }
  return { x, y, s: sArr.map((v) => v / len), len };
};
/** Distance to a sampled curve and the curve parameter (0–1) of the nearest sample. */
const nearest = (c: Curve, px: number, py: number) => {
  let best = Infinity, u = 0;
  for (let i = 0; i < c.x.length; i++) {
    const d = (c.x[i] - px) ** 2 + (c.y[i] - py) ** 2;
    if (d < best) {
      best = d;
      u = c.s[i];
    }
  }
  return { d: Math.sqrt(best), u };
};
/** Bright pulse running along a curve (position p 0–1), with a short fading tail. */
const pulse = (u: number, p: number, tail = 0.16) => {
  const behind = p - u;
  if (behind < -0.025 || behind > tail) return 0;
  return behind < 0 ? 1 + behind / 0.025 : 1 - behind / tail;
};

/** A scene returns the coverage (0–1) of the figure at a lattice point. */
type Scene = (x: number, y: number, col: number, row: number, t: number) => number;

// ——— Tech companies: three towers wired together, windows switching on and off ———
const TOWERS = [
  { c0: 10, c1: 16, top: 10 },
  { c0: 19, c1: 25, top: 4 },
  { c0: 28, c1: 34, top: 13 },
];
const GROUND_ROW = 24;
// Data wires between the roofs: tower A → antenna → tower C.
const WIRES = [
  quad(lx(13), ly(10), lx(16.5), ly(4), lx(22), ly(2)),
  quad(lx(22), ly(2), lx(28), ly(5), lx(31), ly(13)),
];
const tech: Scene = (x, y, col, row, t) => {
  // Street: a solid row and a fainter kerb.
  if (row === GROUND_ROW && col >= 7 && col <= 38) return 1;
  if (row === GROUND_ROW + 1 && col >= 9 && col <= 36) return 0.28;
  // Antenna with a blinking beacon.
  if (col === 22 && row >= 2 && row < 4) return row === 2 ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 3.2)) : 0.8;
  let v = 0;
  for (let i = 0; i < TOWERS.length; i++) {
    const b = TOWERS[i];
    if (col < b.c0 - 1 || col > b.c1 + 1 || row < b.top - 1 || row > GROUND_ROW) continue;
    const edge = col === b.c0 || col === b.c1 || row === b.top;
    const inside = col > b.c0 && col < b.c1 && row > b.top && row < GROUND_ROW;
    if (edge && col >= b.c0 && col <= b.c1 && row >= b.top) v = Math.max(v, 1);
    else if (inside) {
      // Windows on every other dot; each switches on its own slow rhythm.
      const isWin = (col - b.c0) % 2 === 0 && (row - b.top) % 2 === 0 && row < GROUND_ROW - 1;
      if (isWin) {
        const h = hash(col, row + i * 31);
        const on = 0.5 + 0.5 * Math.sin(t * (0.3 + h * 0.5) + h * 40);
        v = Math.max(v, 0.18 + 0.82 * ss(0.4, 0.75, on));
      } else v = Math.max(v, 0.05);
    }
  }
  if (v > 0) return v;
  // Wires: faint, with data pulses running roof to roof.
  for (let k = 0; k < WIRES.length; k++) {
    const { d, u } = nearest(WIRES[k], x, y);
    if (d > PX) continue;
    const on = stroke(d, 1.6);
    const p = ((t * 0.32 + k * 0.5) % 1.25) - 0.1; // pause between pulses
    v = Math.max(v, on * (0.22 + 0.78 * pulse(u, p)));
  }
  return v;
};

// ——— Freelancers: a laptop typing code, a mug steaming beside it ———
// Screen: columns 5–29, rows 3–18; deck on row 21, its foot on row 22. Mug: columns 35–40.
const SCR = { c0: 5, c1: 29, r0: 3, r1: 18 };
const SCR_BOX = {
  cx: (lx(SCR.c0) + lx(SCR.c1)) / 2,
  cy: (ly(SCR.r0) + ly(SCR.r1)) / 2,
  hw: (lx(SCR.c1) - lx(SCR.c0)) / 2,
  hh: (ly(SCR.r1) - ly(SCR.r0)) / 2,
};
// Code lines (indent in steps of 2 cells) with word gaps.
const CODE = [
  { indent: 0, words: [3, 4] },
  { indent: 1, words: [4, 2, 5] },
  { indent: 2, words: [6, 3] },
  { indent: 2, words: [2, 4, 3] },
  { indent: 1, words: [5] },
];
const LINES = CODE.map((l) => {
  const cells: number[] = []; // 1 = keyword, 0.6 = text, 0 = gap
  l.words.forEach((w, i) => {
    for (let k = 0; k < w; k++) cells.push(i === 0 ? 1 : 0.6);
    if (i < l.words.length - 1) cells.push(0);
  });
  return { start: SCR.c0 + 3 + l.indent * 2, cells };
});
const CODE_TOTAL = LINES.reduce((s, l) => s + l.cells.length, 0);
const MUG = { c0: 35, c1: 39, r0: 16, r1: 21 };
const freelance: Scene = (x, y, col, row, t) => {
  // Screen frame with softened corners.
  const frame = stroke(sdBox(x, y, SCR_BOX.cx, SCR_BOX.cy, SCR_BOX.hw, SCR_BOX.hh, PX * 1.6), 2.2);
  if (frame > 0.05) return frame;
  // Deck wider than the screen, trackpad notch, a short foot.
  if (row === 21 && col >= 2 && col <= 32) return col >= 15 && col <= 19 ? 0.35 : 1;
  if (row === 22 && col >= 5 && col <= 29) return 0.38;
  // Mug: body outline, handle, and steam curling up.
  if (row >= MUG.r0 && row <= MUG.r1 && col >= MUG.c0 && col <= MUG.c1) {
    const rim = row === MUG.r0 || row === MUG.r1 || col === MUG.c0 || col === MUG.c1;
    return rim ? 0.95 : row === MUG.r0 + 1 ? 0.45 : 0.12; // coffee surface just under the rim
  }
  if (col === MUG.c1 + 1 && (row === MUG.r0 + 1 || row === MUG.r0 + 3)) return 0.8;
  if (col === MUG.c1 + 2 && row === MUG.r0 + 2) return 0.8;
  if (row >= MUG.r0 - 7 && row < MUG.r0 - 1) {
    const h = (MUG.r0 - 1 - row) / 6; // 0 at the mug, 1 at the top
    let v = 0;
    for (let s2 = 0; s2 < 2; s2++) {
      const base = lx(MUG.c0 + 1.3 + s2 * 1.6);
      const sx = base + Math.sin(y * 0.22 + t * 2.4 + s2 * 2) * PX * (0.5 + h);
      const near = clamp01(1 - Math.abs(x - sx) / (PX * 0.7));
      const flick = 0.55 + 0.45 * Math.sin(y * 0.5 - t * 4 + s2);
      v = Math.max(v, near * flick * (1 - h) * 0.85);
    }
    if (v > 0.05) return v;
  }
  // Code: lines on rows 6, 8, …, 14 type in, hold, then clear and restart.
  if (row < 6 || row > 14 || row % 2 === 1) return 0;
  const li = (row - 6) / 2;
  const line = LINES[li];
  const k = col - line.start;
  const cycle = (t % 9) / 9;
  const typed = Math.floor(ss(0.03, 0.7, cycle) * CODE_TOTAL);
  const fade = 1 - ss(0.9, 1, cycle);
  let curLine = LINES.length - 1;
  let curK = LINES[curLine].cells.length;
  for (let i = 0, rest = typed; i < LINES.length; i++) {
    if (rest < LINES[i].cells.length) {
      curLine = i;
      curK = rest;
      break;
    }
    rest -= LINES[i].cells.length;
  }
  if ((li < curLine || (li === curLine && k < curK)) && k >= 0 && k < line.cells.length) return line.cells[k] * fade;
  if (li === curLine && k === curK && Math.sin(t * 7) > -0.1) return 0.95 * fade;
  return 0;
};

// ——— Digital nomads: a shaded globe, a pin pulsing on it, a plane orbiting ———
const G = { cx: lx(22.5), cy: ly(15), r: 76 };
const LIGHT = [-0.5, -0.55, 0.67]; // from the top left, towards the viewer (screen y down)
const ORBIT = { a: 136, b: 60, tilt: (-24 * Math.PI) / 180 };
const COS_T = Math.cos(ORBIT.tilt), SIN_T = Math.sin(ORBIT.tilt);
const PIN = { x: G.cx + 20, y: G.cy - 16 }; // "live here": a point on the near side
const nomad: Scene = (x, y, _c, row, t) => {
  const dx = x - G.cx, dy = y - G.cy;
  const rr = Math.hypot(dx, dy);
  let v = 0;
  const inDisc = rr < G.r;
  if (inDisc) {
    // Halftone shading: big dots on the lit side, small towards the terminator.
    const nx = dx / G.r, ny = dy / G.r, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    v = 0.16 + 0.84 * lit;
    // Graticule as grooves: equator and two parallels on rows, two turning meridians.
    if (row === 15 || row === 10 || row === 20) v *= 0.2;
    for (let k = 0; k < 2; k++) {
      const ph = t * 0.45 + k * Math.PI * 0.5;
      if (Math.cos(ph) <= 0) continue;
      const mx = Math.sin(ph) * G.r * Math.sqrt(Math.max(0, 1 - ny * ny));
      if (Math.abs(dx - mx) < PX * 0.5) v *= 0.2 + 0.8 * (1 - Math.cos(ph));
    }
    v = Math.max(v, 0.5 * stroke(rr - G.r + 1.2, 1.8));
    // Pin: a solid dot with a ring pulsing out of it.
    const dp = Math.hypot(x - PIN.x, y - PIN.y);
    if (dp < PX * 0.9) return 1;
    const ringR = ((t % 1.8) / 1.8) * 20 + 5;
    const ring = stroke(dp - ringR, 1.8) * (1 - (t % 1.8) / 1.8);
    if (ring > 0.05) v = Math.max(v * 0.4, ring);
  } else {
    v = Math.max(v, 0.5 * stroke(rr - G.r + 1.2, 1.8));
  }
  // Orbit: a tilted ellipse; only the trail behind the plane is drawn, the far side hides.
  const u = dx * COS_T + dy * SIN_T;
  const w = -dx * SIN_T + dy * COS_T;
  const f = (u / ORBIT.a) ** 2 + (w / ORBIT.b) ** 2 - 1;
  const g = 2 * Math.hypot(u / ORBIT.a ** 2, w / ORBIT.b ** 2);
  const d = f / Math.max(g, 1e-3);
  const phi = Math.atan2(w / ORBIT.b, u / ORBIT.a);
  const hidden = Math.sin(phi) <= 0 && inDisc;
  const head = (t * 0.8) % (Math.PI * 2);
  if (!hidden) {
    const on = stroke(d, 2);
    if (on > 0.05) {
      let behind = head - (phi < 0 ? phi + Math.PI * 2 : phi);
      if (behind < 0) behind += Math.PI * 2;
      const trail = behind < 2.6 ? 1 - behind / 2.6 : 0;
      if (trail > 0) v = Math.max(v, on * (0.12 + 0.88 * trail * trail));
    }
  }
  // The plane: a bright head of a few dots.
  {
    const hx = ORBIT.a * Math.cos(head), hw = ORBIT.b * Math.sin(head);
    const sx = G.cx + hx * COS_T - hw * SIN_T, sy = G.cy + hx * SIN_T + hw * COS_T;
    const behindGlobe = Math.sin(head) < 0 && Math.hypot(sx - G.cx, sy - G.cy) < G.r;
    if (!behindGlobe) v = Math.max(v, clamp01(1.5 - Math.hypot(x - sx, y - sy) / (PX * 1.1)));
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
