"use client";

import { useEffect, useRef, useState } from "react";
import type { IconName } from "@/components/dots/DotIcon";
import { IconMorph, type IconMorphControl } from "@/components/dots/IconMorph";
import type { Dictionary } from "@/i18n/dictionaries";

const STEP_SVH = 65; // scroll length per benefit (long enough to read each description)

/**
 * 05 — More than tax. Pinned: scrolling walks through six benefits. On the right, a large LED
 * icon transforms from one benefit's icon to the next with the scroll (mid-way exactly when the
 * step changes), and the description below it swaps word by word (blur → focus). On the left the
 * active row only changes colour and shifts 8px. Rows are buttons that scroll to their step. At the end the sheet slides up
 * off the next section, which waits pinned underneath.
 */
export function MoreTax({ t }: { t: Dictionary["moreTax"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Fast mode: when steps change in quick succession (fast scrolling), the description swaps as
  // a whole instead of word by word, so it never lags behind the list or gets skipped half-shown.
  const [fast, setFast] = useState(false);
  const lastChange = useRef(0);
  const activeRef = useRef(0);
  const n = t.items.length;
  const iconRef = useRef<IconMorphControl | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const q = Math.min(0.9999, Math.max(0, -rect.top / travel));
      const next = Math.floor(q * n);
      // Icon: whole at the middle of each step, half-way through its transform at the boundary.
      const p = q * n - 0.5;
      const k = Math.floor(p);
      const u = p - k;
      const s3 = Math.min(1, Math.max(0, (u - 0.3) / 0.4));
      iconRef.current?.setPosition(Math.min(n - 1, Math.max(0, k + s3)));
      if (next !== activeRef.current) {
        const now = performance.now();
        setFast(now - lastChange.current < 700);
        lastChange.current = now;
        activeRef.current = next;
        setActive(next);
      }
      // Leaving: the sheet slides up off "Who can apply" (pinned behind it); its bottom corners
      // round off and it casts a soft shadow onto the layer it uncovers.
      const stage = stageRef.current;
      if (stage) {
        const k = Math.min(1, Math.max(0, (window.innerHeight - rect.bottom) / (window.innerHeight * 0.25)));
        const r = Math.round(32 * k);
        stage.style.borderRadius = r ? `0 0 ${r}px ${r}px` : "";
        stage.style.boxShadow = k ? `0 40px 60px -20px rgb(3 10 38 / ${(0.4 * k).toFixed(3)})` : "";
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [n]);

  const go = (i: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const travel = section.offsetHeight - window.innerHeight;
    const y = top + ((i + 0.5) / n) * travel;
    const lenis = (window as unknown as { lenis?: { scrollTo: (y: number, o?: object) => void } }).lenis;
    if (lenis) lenis.scrollTo(y, { duration: 1 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      data-header="light"
      className="relative z-10 text-primary"
      style={{ height: `${100 + n * STEP_SVH}svh` }}
    >
      <div ref={stageRef} className="sticky top-0 flex h-svh items-center bg-page">
        <div className="container-page grid-page items-start gap-y-10 pt-16 md:gap-y-12 md:pt-0">
          <h2 className="sr-only">{t.title}</h2>

          <ol className="col-span-full flex flex-col gap-2 md:col-span-5 md:gap-4 xl:col-span-7">
            {t.items.map((item, i) => {
              const on = i === active;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={on ? "step" : undefined}
                    className={`group cursor-pointer text-left text-heading-s transition-[color,transform] duration-500 ease-emphasized md:text-heading-l xl:whitespace-nowrap ${
                      on ? "translate-x-2 text-primary" : "translate-x-0 text-muted hover:text-tertiary"
                    }`}
                  >
                    {item.title}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="col-span-full flex items-start gap-6 md:col-span-3 md:col-start-6 md:flex-col md:gap-10 xl:col-span-4 xl:col-start-9">
            <IconMorph
              names={t.items.map((item) => item.icon as IconName)}
              controlRef={iconRef}
              className="block size-24 shrink-0 md:size-[clamp(160px,16vw,240px)]"
            />
            <div className="grid flex-1" aria-live="polite" data-fast={fast || undefined}>
              {t.items.map((item, i) => (
                <p
                  key={item.title}
                  data-active={i === active}
                  aria-hidden={i !== active}
                  className="word-swap col-start-1 row-start-1 text-body-l text-primary md:text-heading-m"
                >
                  {item.body.split(" ").map((w, k, arr) => (
                    <span key={k}>
                      <span className="swap-word" style={{ ["--i" as string]: k }}>
                        {w}
                      </span>
                      {k < arr.length - 1 ? " " : ""}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
