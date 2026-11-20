import { ZeroArt } from "@/components/dots/ZeroArt";
import { ScrollLines } from "@/components/motion/ScrollLines";
import { StickyFade } from "@/components/motion/StickyFade";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * 03 — 0% for 20 years. The figure stays pinned and follows the pointer; the five taxes scroll
 * past line by line (same motion as the hero). On phones the figure pins as a compact panel
 * under the header and the list slides beneath it.
 *
 * It overlaps the end of the Mission pin (no own background, above it): while the map wipes away
 * upwards, this content is already rising in from below, so no empty sheet sits in between.
 * The anchor lands after the overlap.
 */
export function Taxes({ t }: { t: Dictionary["taxes"] }) {
  return (
    <section
      id="benefits"
      data-header="light"
      className="relative z-20 -mt-[50svh] -scroll-mt-[50svh] text-primary"
    >
      <div className="container-page section-y grid-page gap-y-16 md:gap-y-24">
        {/* Phones: one tall column so the panel can pin. md+: `contents` → two grid columns. */}
        <div className="col-span-full md:contents">
          <div className="contents md:block md:col-span-4 xl:col-span-5">
            <StickyFade className="sticky top-20 z-10 -mx-(--page-margin) bg-page px-(--page-margin) pt-4 pb-6 md:top-[max(128px,calc(50svh-200px))] md:mx-0 md:bg-transparent md:p-0">
              <h2 className="sr-only">{t.label}</h2>
              <ZeroArt className="block aspect-[520/290] w-[64%] max-w-[520px] md:w-full" />
              <p
                aria-hidden="true"
                className="mt-4 text-heading-l text-accent md:mt-6 md:text-heading-xl"
              >
                {t.sub}
              </p>
              {/* Soft edge so the list dissolves under the pinned panel on phones. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-full h-12 bg-linear-to-b from-page to-transparent md:hidden"
              />
            </StickyFade>
          </div>

          <ul className="mt-16 flex flex-col gap-24 md:col-span-4 md:mt-0 md:gap-32 xl:col-span-6 xl:col-start-7">
            {t.items.map((item) => (
              <li key={item.title} className="flex flex-col gap-4">
                <ScrollLines as="h3" className="text-display-l">
                  {item.title}
                </ScrollLines>
                <ScrollLines className="text-heading-m text-secondary">
                  {item.body}
                </ScrollLines>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
