/**
 * Splits an element's text into its rendered lines:
 *   <span class="line-mask"><span class="line-move"><span class="line-inner">words…</span></span></span>
 * `line-mask` clips (for slide-up reveals), `line-move` is free for scroll-driven transforms,
 * `line-inner` is free for time-based intro animations. Call again after resize to re-flow.
 */
export type SplitLines = { masks: HTMLElement[]; moves: HTMLElement[]; inners: HTMLElement[] };

export function splitLines(el: HTMLElement): SplitLines {
  const text = el.dataset.splitText ?? el.textContent?.replace(/\s+/g, " ").trim() ?? "";
  el.dataset.splitText = text;

  // 1. Lay out word by word to read the browser's line breaks.
  el.textContent = "";
  const words = text.split(" ").map((w, i, arr) => {
    const s = document.createElement("span");
    s.textContent = w;
    s.style.display = "inline-block";
    el.appendChild(s);
    if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
    return s;
  });
  const lines: string[][] = [];
  let top = Number.NaN;
  for (const w of words) {
    if (w.offsetTop !== top) {
      lines.push([]);
      top = w.offsetTop;
    }
    lines[lines.length - 1].push(w.textContent ?? "");
  }

  // 2. Rebuild as masked lines.
  el.textContent = "";
  const out: SplitLines = { masks: [], moves: [], inners: [] };
  lines.forEach((line, i) => {
    const mask = document.createElement("span");
    mask.className = "line-mask";
    mask.style.setProperty("--line", String(i));
    const move = document.createElement("span");
    move.className = "line-move";
    const inner = document.createElement("span");
    inner.className = "line-inner";
    inner.textContent = line.join(" ");
    move.appendChild(inner);
    mask.appendChild(move);
    el.appendChild(mask);
    out.masks.push(mask);
    out.moves.push(move);
    out.inners.push(inner);
  });
  return out;
}

/** Offset of an element from the document origin, ignoring CSS transforms. */
function layoutOffset(el: HTMLElement) {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

/**
 * Gives each piece (line or word) of a `.text-gradient` element its slice of one shared gradient
 * sized to the whole element, so the split text reads as a single gradient.
 */
export function paintGradient(root: HTMLElement, pieces: HTMLElement[]) {
  if (!root.classList.contains("text-gradient")) return;
  const o = layoutOffset(root);
  const w = `${root.offsetWidth}px`;
  const h = `${root.offsetHeight}px`;
  for (const p of pieces) {
    const po = layoutOffset(p);
    p.classList.add("grad-piece");
    p.style.setProperty("--gw", w);
    p.style.setProperty("--gh", h);
    p.style.setProperty("--gx", `${o.x - po.x}px`);
    p.style.setProperty("--gy", `${o.y - po.y}px`);
  }
}

/** Re-split on width changes (fonts loading, resize). Returns a disposer. */
export function watchLines(el: HTMLElement, onSplit: (s: SplitLines) => void) {
  let width = -1;
  let raf = 0;
  const run = () => {
    raf = 0;
    const w = el.getBoundingClientRect().width;
    if (Math.abs(w - width) < 1) return;
    width = w;
    onSplit(splitLines(el));
  };
  const ro = new ResizeObserver(() => {
    if (!raf) raf = requestAnimationFrame(run);
  });
  ro.observe(el);
  document.fonts?.ready.then(() => {
    width = -1;
    run();
  });
  run();
  return () => {
    ro.disconnect();
    if (raf) cancelAnimationFrame(raf);
  };
}
