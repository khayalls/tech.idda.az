import type { DotLayer } from "./dot-data";

/** Hilbert curve index for (x, y) on an n×n grid (n power of two). Keeps spatial neighbours close. */
function hilbert(n: number, x: number, y: number) {
  let d = 0;
  for (let s = n >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      const t = x;
      x = y;
      y = t;
    }
  }
  return d;
}

function spatialOrder(layer: DotLayer) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < layer.count; i++) {
    minX = Math.min(minX, layer.x[i]);
    maxX = Math.max(maxX, layer.x[i]);
    minY = Math.min(minY, layer.y[i]);
    maxY = Math.max(maxY, layer.y[i]);
  }
  const N = 1024;
  const keys = new Float64Array(layer.count);
  for (let i = 0; i < layer.count; i++) {
    const gx = Math.min(N - 1, Math.floor(((layer.x[i] - minX) / (maxX - minX || 1)) * N));
    const gy = Math.min(N - 1, Math.floor(((layer.y[i] - minY) / (maxY - minY || 1)) * N));
    keys[i] = hilbert(N, gx, gy);
  }
  return Array.from({ length: layer.count }, (_, i) => i).sort((a, b) => keys[a] - keys[b]);
}

export type MorphPair = {
  count: number;
  ax: Float32Array; ay: Float32Array; ad: Float32Array; aa: Float32Array;
  bx: Float32Array; by: Float32Array; bd: Float32Array; ba: Float32Array;
  /** 0–1 normalised start offset for each dot (bottom-up wave + noise). */
  delay: Float32Array;
  /** Random sideways drift (design units) applied mid-flight. */
  drift: Float32Array;
};

const rand = (i: number) => {
  const s = Math.sin(i * 91.345 + 47.853) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Pairs every dot of `a` with a dot of `b` along a Hilbert curve. When one shape has fewer dots,
 * the surplus partners start/end at a neighbour with zero size, so they grow out of / melt into it.
 */
export function buildMorph(a: DotLayer, b: DotLayer): MorphPair {
  const oa = spatialOrder(a);
  const ob = spatialOrder(b);
  const n = Math.max(a.count, b.count);
  const m: MorphPair = {
    count: n,
    ax: new Float32Array(n), ay: new Float32Array(n), ad: new Float32Array(n), aa: new Float32Array(n),
    bx: new Float32Array(n), by: new Float32Array(n), bd: new Float32Array(n), ba: new Float32Array(n),
    delay: new Float32Array(n),
    drift: new Float32Array(n),
  };
  let prevA = -1;
  let prevB = -1;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const ka = Math.floor((i * a.count) / n);
    const kb = Math.floor((i * b.count) / n);
    const ia = oa[ka];
    const ib = ob[kb];
    m.ax[i] = a.x[ia]; m.ay[i] = a.y[ia];
    m.bx[i] = b.x[ib]; m.by[i] = b.y[ib];
    const ghostA = ka === prevA;
    const ghostB = kb === prevB;
    m.ad[i] = ghostA ? 0 : a.d[ia]; m.aa[i] = ghostA ? 0 : a.a[ia];
    m.bd[i] = ghostB ? 0 : b.d[ib]; m.ba[i] = ghostB ? 0 : b.a[ib];
    prevA = ka;
    prevB = kb;
    const y = (m.ay[i] + m.by[i]) / 2;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    m.drift[i] = (rand(i) - 0.5) * 48;
  }
  for (let i = 0; i < n; i++) {
    const y = (m.ay[i] + m.by[i]) / 2;
    const fromBottom = 1 - (y - minY) / (maxY - minY || 1);
    m.delay[i] = fromBottom * 0.6 + rand(i + 7) * 0.4;
  }
  return m;
}
