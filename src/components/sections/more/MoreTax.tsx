"use client";

import { useEffect, useRef, useState } from "react";
import { DotIcon, type IconName } from "@/components/dots/DotIcon";
import type { Dictionary } from "@/i18n/dictionaries";

const STEP_SVH = 45; // scroll length per benefit

/**
 * 05 — More than tax. Pinned: scrolling walks through six benefits. The active row turns ink and
 * shows its dot icon (dots grow out from the centre); the description on the right swaps word by
 * word (blur → focus). Rows are buttons that scroll to their step. At the end the sheet slides up
 * off the next section, which waits pinned underneath.
 */
export function MoreTax({ t }: { t: Dictionary["moreTax"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const n = t.items.length;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      const q = Math.min(0.9999, Math.max(0, -rect.top / travel));
      setActive(Math.floor(q * n));
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

          <ol className="col-span-full flex flex-col gap-3 md:col-span-5 md:gap-5 xl:col-span-8">
            {t.items.map((item, i) => {
              const on = i === active;
              return (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-current={on ? "step" : undefined}
                    data-active={on || undefined}
                    className="group flex cursor-pointer items-center text-left text-heading-s md:text-heading-xl xl:whitespace-nowrap"
                  >
                    <span
                      aria-hidden="true"
                      className={`dot-reveal block shrink-0 overflow-hidden transition-[width,margin] duration-500 ease-emphasized ${
                        on ? "mr-3 w-8 md:mr-6 md:w-12" : "mr-0 w-0"
                      }`}
                    >
                      <DotIcon name={item.icon as IconName} id={`more-${i}`} className="block size-8 md:size-12" />
                    </span>
                    <span
                      className={`transition-colors duration-500 ease-out ${
                        on ? "text-primary" : "text-muted group-hover:text-tertiary"
                      }`}
                    >
                      {item.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="col-span-full md:col-span-3 md:col-start-6 xl:col-span-4 xl:col-start-9">
            <div className="grid" aria-live="polite">
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
