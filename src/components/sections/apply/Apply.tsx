import { ApplyForm } from "@/components/apply/ApplyForm";
import { LedCountdown } from "@/components/dots/LedCountdown";
import { ScrollLines } from "@/components/motion/ScrollLines";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** Benefits start on 1 January 2027, 00:00 in Baku (UTC+4). */
const START = Date.UTC(2026, 11, 31, 20, 0, 0);

/** 09 — Apply (Figma 185:28257): LED countdown to the start date, headline, application form. */
export function Apply({ t, locale }: { t: Dictionary["apply"]; locale: Locale }) {
  const units = [t.units.days, t.units.hours, t.units.minutes, t.units.seconds];
  return (
    <section id="apply" className="text-primary">
      {/* Desktop: countdown and headline on the left, the form on the right, both centred in one
          screen. Phones: stacked. */}
      <div className="container-page flex py-24 md:py-32 xl:min-h-svh xl:items-center xl:py-28">
        <div className="mx-auto grid w-full max-w-[1080px] items-center gap-14 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-24">
          {/* Left: headline, then the countdown underneath, sharing one width. */}
          <div className="flex flex-col items-center gap-10 xl:items-start xl:gap-12">
            <ScrollLines as="h2" className="max-w-[14ch] text-center text-heading-xl md:text-display-l xl:text-left">
              {t.title}
            </ScrollLines>
            <div className="w-full max-w-[520px]">
              <p className="sr-only">{t.countdownLabel}</p>
              <LedCountdown target={START} className="block aspect-[795/105] w-full" />
              {/* Unit captions under each pair (Figma widths: 165 per pair, 45 per colon). */}
              <div aria-hidden="true" className="mt-3 flex text-caption text-tertiary">
                {units.map((u, i) => (
                  <span key={u} className="contents">
                    {i > 0 && <span style={{ width: `${(45 / 795) * 100}%` }} />}
                    <span className="text-center" style={{ width: `${(165 / 795) * 100}%` }}>
                      {u}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ApplyForm t={t} locale={locale} />
          </div>
        </div>
      </div>
    </section>
  );
}
