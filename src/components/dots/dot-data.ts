/**
 * Dot art data format (exported from Figma, see scripts/README in design/):
 *   { v: 1, space: [w, h], scale: 10, count, dots: [cx, cy, d, a%, cx, cy, d, a%, …] }
 * cx/cy/d are multiplied by `scale`, alpha is 0–100. Coordinates share one design space
 * (e.g. the 1440×900 hero frame) so several layers can be drawn in the same canvas.
 */
export type DotFile = {
  v: 1;
  space: [number, number];
  scale: number;
  count: number;
  dots: number[];
};

export type DotLayer = {
  /** Centre x/y and diameter in design-space units. */
  x: Float32Array;
  y: Float32Array;
  d: Float32Array;
  /** Base alpha 0–1. */
  a: Float32Array;
  count: number;
  space: [number, number];
};

export function decodeDots(file: DotFile): DotLayer {
  const n = file.count;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const d = new Float32Array(n);
  const a = new Float32Array(n);
  const s = file.scale;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    x[i] = file.dots[j] / s;
    y[i] = file.dots[j + 1] / s;
    d[i] = file.dots[j + 2] / s;
    a[i] = file.dots[j + 3] / 100;
  }
  return { x, y, d, a, count: n, space: file.space };
}

const cache = new Map<string, Promise<DotLayer>>();

export function loadDots(src: string): Promise<DotLayer> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load dots: ${src}`);
        return r.json() as Promise<DotFile>;
      })
      .then(decodeDots);
    cache.set(src, p);
  }
  return p;
}
