import { ButtonLink } from "@/components/ui/Button";
import type { Dictionary } from "@/i18n/dictionaries";
import { HeroArt } from "./HeroArt";

// Film grain over the gradient (Figma: texture layer at 20%).
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function Hero({ t }: { t: Dictionary["hero"] }) {
  return (
    <section
      id="top"
      data-header="dark"
      className="relative isolate flex min-h-svh flex-col overflow-hidden bg-blue-700 text-on-dark xl:min-h-[max(100svh,720px)]"
    >
      {/* Background: brand gradient + drifting cyan glow + grain. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 80% at 0% 100%, color-mix(in oklab, var(--color-blue-700) 90%, transparent), transparent 70%)," +
              "radial-gradient(70% 70% at 100% 100%, color-mix(in oklab, var(--color-blue-975) 92%, transparent), transparent 72%)," +
              "linear-gradient(160deg, var(--color-blue-600) 0%, var(--color-blue-700) 45%, var(--color-blue-950) 100%)",
          }}
        />
        <div
          className="absolute -top-1/3 right-[-15%] h-[110%] w-[80%] animate-drift rounded-full opacity-80 blur-[120px]"
          style={{ background: "radial-gradient(closest-side, var(--color-cyan-400), transparent)" }}
        />
        <div className="absolute inset-0 opacity-20 mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
      </div>

      <div className="container-page relative z-10 flex flex-1 flex-col pt-28 md:pt-40 xl:justify-center xl:pt-24 xl:pb-32">
        <h1 className="max-w-[15ch] animate-reveal text-display-l text-balance">{t.title}</h1>
        <div className="mt-10 flex animate-reveal flex-wrap gap-3 [animation-delay:150ms]">
          <ButtonLink href="#apply" variant="light">
            {t.apply}
          </ButtonLink>
          <ButtonLink href="#benefits" variant="glass">
            {t.explore}
          </ButtonLink>
        </div>
      </div>

      <HeroArt className="relative mt-auto w-full shrink-0 xl:absolute xl:right-0 xl:bottom-0 xl:w-[79.2%] xl:max-w-[1140px]" />
    </section>
  );
}
