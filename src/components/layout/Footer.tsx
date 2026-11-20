import { Logo } from "@/components/brand/Logo";
import { DotWordmark } from "@/components/dots/DotWordmark";
import { FooterReveal } from "@/components/motion/FooterReveal";
import type { Dictionary } from "@/i18n/dictionaries";

/**
 * 10 — Footer (Figma 185:28661). A back layer: the light sheet above slides up off it.
 * Stacked logo, contacts, legal line, and an interactive dot wordmark filling the bottom.
 */
export function Footer({ t }: { t: Dictionary["footer"] }) {
  const tel = t.phone.replace(/\s/g, "");
  return (
    <footer className="relative z-0 -mt-8 bg-page text-primary">
      <FooterReveal>
        <div className="container-page flex flex-col gap-12 pt-28 pb-10 md:pt-34">
          <div className="flex flex-col items-center gap-16 md:gap-24">
            <div className="flex flex-col items-center gap-3">
              <Logo emblemOnly className="h-14 w-auto text-primary" />
              <Logo wordmarkOnly className="h-[30px] w-auto text-primary" />
            </div>
            <ul className="flex flex-col items-center gap-3 text-body-s md:flex-row md:gap-10">
              <li>
                <a href={`mailto:${t.email}`} className="transition-colors duration-200 hover:text-accent">
                  {t.email}
                </a>
              </li>
              <li>
                <a href={`tel:${tel},3158`} className="transition-colors duration-200 hover:text-accent">
                  {t.phone}
                </a>
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-2 border-t border-[rgb(18_18_18/0.1)] pt-8 text-caption text-primary/50 md:flex-row md:justify-between">
            <p>{t.copyright}</p>
            <p>{t.ministry}</p>
          </div>
        </div>
        {/* Full bleed: the LED grid runs edge to edge and to the bottom; the word keeps the page margins. */}
        <DotWordmark
          text="tech.idda.az"
          insetVar="--page-margin"
          className="block h-[clamp(200px,28vw,400px)] w-full cursor-crosshair touch-pan-y"
        />
      </FooterReveal>
    </footer>
  );
}
