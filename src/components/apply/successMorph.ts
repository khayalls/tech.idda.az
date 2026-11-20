/**
 * Success transition for the application form: the fields dissolve into dots, and part of
 * those dots fly up to form a dot badge with a check (the check is the gap in the badge) —
 * the site's dot language for "received". The rest shrink away where they stood.
 *
 * Sources: a dot lattice inside every element marked [data-morph-src] (fields, button).
 * Targets: a filled dot disc at the top centre, with a check path left unlit.
 */

const PITCH_SRC = 8;
const PITCH_DST = 6.6;
const BADGE_R = 54;
const CHECK = [
  [-25, 0],
  [-8, 17],
  [26, -18],
] as const;

// Brand dot gradient (cyan-400 → blue-700 → blue-950), top-left → bottom-right of the badge.
const C0 = [102, 173, 201];
const C1 = [36, 87, 176];
const C2 = [10, 26, 77];
const grad = (t: number) => {
  const [a, b, k] = t < 0.5 ? [C0, C1, t * 2] : [C1, C2, (t - 0.5) * 2];
  return a.map((v, i) => v + (b[i] - v) * k);
};
const GREY = [18, 18, 18];

const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax, vy = by - ay;
  const t = clamp01(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy));
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

type Dot = {
  x0: number; y0: number;
  x1: number; y1: number;
  r1: number;
  col: number[];
  delay: number;
  dur: number;
  travels: boolean;
};

/** Badge centre relative to the container (top centre). */
export const BADGE = { top: 70, r: BADGE_R };

export function playSuccessMorph(container: HTMLElement, canvas: HTMLCanvasElement, reduce: boolean) {
  const box = container.getBoundingClientRect();
  const W = box.width;
  const H = box.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Sources: lattice inside each field / the button (rounded rectangles).
  const sources: { x: number; y: number }[] = [];
  container.querySelectorAll<HTMLElement>("[data-morph-src]").forEach((el) => {
    const target = el.firstElementChild instanceof HTMLElement && el.tagName !== "BUTTON" ? el.firstElementChild : el;
    const r = target.getBoundingClientRect();
    const x0 = r.left - box.left, y0 = r.top - box.top;
    const rad = Math.min(16, r.height / 2);
    for (let y = y0 + PITCH_SRC / 2; y < y0 + r.height; y += PITCH_SRC) {
      for (let x = x0 + PITCH_SRC / 2; x < x0 + r.width; x += PITCH_SRC) {
        // Skip the rounded corners.
        const cx = Math.min(Math.max(x, x0 + rad), x0 + r.width - rad);
        const cy = Math.min(Math.max(y, y0 + rad), y0 + r.height - rad);
        if (Math.hypot(x - cx, y - cy) > rad) continue;
        sources.push({ x, y });
      }
    }
  });

  // Targets: a dot disc with the check path left empty.
  const cx = W / 2, cy = BADGE.top;
  const targets: { x: number; y: number; t: number }[] = [];
  const n = Math.ceil(BADGE_R / PITCH_DST);
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const x = i * PITCH_DST + (j % 2 ? PITCH_DST / 2 : 0);
      const y = j * PITCH_DST * 0.87;
      const d = Math.hypot(x, y);
      if (d > BADGE_R) continue;
      const dc = Math.min(
        distToSeg(x, y, CHECK[0][0], CHECK[0][1], CHECK[1][0], CHECK[1][1]),
        distToSeg(x, y, CHECK[1][0], CHECK[1][1], CHECK[2][0], CHECK[2][1]),
      );
      if (dc < 7.5) continue;
      targets.push({ x: cx + x, y: cy + y, t: clamp01((x + y) / (BADGE_R * 2.4) + 0.5) });
    }
  }

  // Pair each target with a source, nearest-ish but shuffled so paths cross a little.
  const pool = sources.map((s, k) => ({ ...s, k, h: hash(s.x, s.y) }));
  pool.sort((a, b) => a.h - b.h);
  const dots: Dot[] = [];
  const used = new Set<number>();
  targets.forEach((t, k) => {
    const s = pool[k % pool.length];
    used.add(s.k);
    dots.push({
      x0: s.x, y0: s.y, x1: t.x, y1: t.y,
      r1: PITCH_DST * 0.36,
      col: grad(t.t),
      delay: 260 + hash(t.x, t.y) * 380 + (1 - (t.y - (cy - BADGE_R)) / (BADGE_R * 2)) * 120,
      dur: 760 + hash(t.y, t.x) * 260,
      travels: true,
    });
  });
  for (let k = 0; k < sources.length; k++) {
    if (used.has(k)) continue;
    const s = sources[k];
    dots.push({
      x0: s.x, y0: s.y, x1: s.x, y1: s.y, r1: 0, col: GREY,
      delay: 160 + hash(s.x, s.y) * 520,
      dur: 420,
      travels: false,
    });
  }

  const R0 = 1.9; // dot size while it still traces a field
  const total = Math.max(...dots.map((d) => d.delay + d.dur)) + 40;

  const draw = (ms: number) => {
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      // Phase 1: the dot appears where the field was.
      const appear = easeOut(clamp01(ms / 260));
      const t = clamp01((ms - d.delay) / d.dur);
      let x: number, y: number, r: number, col: number[], a: number;
      if (d.travels) {
        const e = easeInOut(t);
        // A gentle arc: travellers lift before they settle.
        const lift = Math.sin(e * Math.PI) * 26;
        x = d.x0 + (d.x1 - d.x0) * e;
        y = d.y0 + (d.y1 - d.y0) * e - lift;
        r = R0 * appear + (d.r1 - R0) * e;
        col = GREY.map((v, i) => v + (d.col[i] - v) * clamp01(e * 1.4));
        a = 0.28 + 0.72 * clamp01(e * 1.2);
      } else {
        const e = easeOut(t);
        x = d.x0;
        y = d.y0 - e * 6;
        r = R0 * appear * (1 - e);
        col = GREY;
        a = 0.28 * (1 - e);
      }
      if (r <= 0.05 || a <= 0.01) continue;
      ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  return new Promise<void>((resolve) => {
    if (reduce) {
      draw(total);
      resolve();
      return;
    }
    const t0 = performance.now();
    const frame = (now: number) => {
      const ms = now - t0;
      draw(ms);
      if (ms < total) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}
