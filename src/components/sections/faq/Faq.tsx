"use client";

import { useId, useState } from "react";
import { ScrollLines } from "@/components/motion/ScrollLines";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * 08 — FAQ (Figma 185:28232). Accordion on the light sheet that slides over "Who can apply".
 * All answers start collapsed; one open at a time. Answers open by animating the row's grid
 * track (0fr → 1fr) so the height follows the content; the plus folds into a minus.
 */
export function Faq({ t, email }: { t: Dictionary["faq"]; email: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const base = useId();

  return (
    <section id="faq" className="text-primary">
      <div className="container-page section-y flex flex-col items-center gap-10 md:gap-12">
        <ScrollLines as="h2" className="text-center text-heading-xl md:text-display-l">
          {t.title}
        </ScrollLines>

        <div className="w-full max-w-[720px]">
          <ul className="border-b border-[rgb(18_18_18/0.12)]">
            {t.items.map((item, i) => {
              const on = open === i;
              const qId = `${base}-q${i}`;
              const aId = `${base}-a${i}`;
              return (
                <li key={item.question} className="border-t border-[rgb(18_18_18/0.12)]">
                  <h3>
                    <button
                      id={qId}
                      type="button"
                      aria-expanded={on}
                      aria-controls={aId}
                      onClick={() => setOpen(on ? null : i)}
                      className="group flex w-full cursor-pointer items-center gap-6 py-6 text-left text-body-l md:gap-12 md:py-7 md:text-heading-s"
                    >
                      <span className="flex-1 transition-colors duration-200 group-hover:text-accent">
                        {item.question}
                      </span>
                      {/* Plus → minus: the vertical bar folds flat. */}
                      <span aria-hidden="true" className="relative size-4 shrink-0 text-accent">
                        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current" />
                        <span
                          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current transition-transform duration-300 ease-emphasized ${
                            on ? "scale-y-0" : "scale-y-100"
                          }`}
                        />
                      </span>
                    </button>
                  </h3>
                  <div
                    id={aId}
                    role="region"
                    aria-labelledby={qId}
                    inert={!on}
                    className={`grid transition-[grid-template-rows] duration-500 ease-emphasized ${
                      on ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p
                        className={`max-w-[560px] pb-7 text-body-m whitespace-pre-line text-primary/60 transition-[opacity,translate] duration-500 ease-out ${
                          on ? "translate-y-0 opacity-100 delay-100" : "-translate-y-2 opacity-0"
                        }`}
                      >
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="mt-10 max-w-[560px] text-body-m text-tertiary">
            {t.contactPrefix}{" "}
            <a href={`mailto:${email}`} className="text-accent underline-offset-4 hover:underline">
              {email}
            </a>{" "}
            {t.contactSuffix}
          </p>
        </div>
      </div>
    </section>
  );
}
