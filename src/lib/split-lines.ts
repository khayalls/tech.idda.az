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
