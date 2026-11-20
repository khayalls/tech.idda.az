"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ButtonLink } from "@/components/ui/Button";
import { ProgressiveBlur } from "@/components/ui/ProgressiveBlur";
import { localePath, localeLabels, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type Props = {
  locale: Locale;
  nav: Dictionary["nav"];
  a11y: Dictionary["a11y"];
};

const links = [
  { id: "why-azerbaijan", key: "whyAzerbaijan" },
  { id: "benefits", key: "benefits" },
  { id: "who-can-apply", key: "whoCanApply" },
  { id: "faq", key: "faq" },
] as const;

/**
 * Fixed header. Text turns white over sections marked `data-header="dark"`,
 * sits on a colourless progressive blur once the page scrolls, and reveals an "Apply now"
 * button once the hero's own CTA has left the screen.
 */
export function Header({ locale, nav, a11y }: Props) {
  const [onDark, setOnDark] = useState(true);
  // Width of the CTA, so the space it needs can open next to the language switcher.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaW, setCtaW] = useState(0);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCtaW(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [scrolled, setScrolled] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const y = window.scrollY;
      // Theme follows whichever section is visually on top under the header (sections can overlap).
      const under = document
        .elementsFromPoint(window.innerWidth / 2, 40)
        .find((el) => !el.closest("header") && el.closest("[data-header]"));
      setOnDark(under?.closest<HTMLElement>("[data-header]")?.dataset.header === "dark");
      setScrolled(y > 8);
      // Pages without a hero: show the CTA as soon as the page scrolls.
      if (!document.querySelector("[data-hero-cta]")) setShowCta(y > 8);
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    // The hero announces when its own CTA has handed over (dispatched from its scroll frame).
    const onHeroCta = (e: Event) => setShowCta((e as CustomEvent<{ gone: boolean }>).detail.gone);
    window.addEventListener("hero-cta", onHeroCta);
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("hero-cta", onHeroCta);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    // Cleanup also runs when the route is hidden/preserved after navigation.
    return () => {
      root.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const tone = onDark ? "text-on-dark" : "text-primary";

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-full bg-surface px-6 py-4 text-label-m text-primary focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {a11y.skipToContent}
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-400 ease-out ${tone}`}
      >
        {/* Colourless progressive blur behind the bar, fading out below it. */}
        <ProgressiveBlur
          className={`absolute inset-x-0 top-0 -z-10 h-[calc(100%+48px)] transition-opacity duration-400 ease-out ${
            scrolled && !menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div className="container-page flex h-20 items-center justify-between gap-8 xl:h-24">
          <Link href={localePath(locale)} aria-label={a11y.home} className="shrink-0">
            <Logo className="h-10 w-auto xl:h-14" />
          </Link>

          <nav aria-label={a11y.mainNav} className="hidden xl:block">
            <ul className="flex items-center gap-10">
              {links.map((l) => (
                <li key={l.id}>
                  <a href={`#${l.id}`} className="text-label-m opacity-100 transition-opacity duration-200 hover:opacity-64">
                    {nav[l.key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center">
            {/* The CTA sits whole at the right edge and only fades in; the room it needs opens as
                padding next to the language switcher, which slides left. Nothing is clipped. */}
            <div
              className="relative flex items-center transition-[padding] duration-500 ease-emphasized"
              // Show: room opens first, the button follows. Hide: the button fades, then room closes.
              style={{ paddingRight: showCta && !menuOpen ? ctaW : 0, transitionDelay: showCta && !menuOpen ? "0ms" : "180ms" }}
            >
              <LanguageSwitcher current={locale} label={a11y.language} className="hidden md:block" />
              <div
                ref={ctaRef}
                className={`absolute top-1/2 right-0 -translate-y-1/2 pl-4 transition-[opacity,transform] duration-500 ease-emphasized md:pl-8 ${
                  showCta && !menuOpen ? "scale-100 opacity-100 delay-[280ms]" : "pointer-events-none scale-95 opacity-0"
                }`}
                aria-hidden={!showCta || menuOpen}
              >
                <ButtonLink
                  href="#apply"
                  size="bar"
                  variant={onDark ? "light" : "ink"}
                  tabIndex={showCta && !menuOpen ? undefined : -1}
                >
                  {nav.apply}
                </ButtonLink>
              </div>
            </div>
            <button
              type="button"
              className="-mr-2 flex size-12 items-center justify-center rounded-full xl:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? a11y.closeMenu : a11y.openMenu}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="relative block h-3 w-6" aria-hidden="true">
                <span className={`absolute inset-x-0 top-0 h-0.5 rounded-full bg-current transition-transform duration-400 ease-out ${menuOpen ? "translate-y-[5px] rotate-45" : ""}`} />
                <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-current transition-transform duration-400 ease-out ${menuOpen ? "-translate-y-[5px] -rotate-45" : ""}`} />
              </span>
            </button>
          </div>
        </div>
      </header>

      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="fixed inset-0 z-40 overflow-y-auto bg-night text-on-dark xl:hidden"
        style={{ backgroundImage: "var(--gradient-night)" }}
      >
        <div className="container-page flex min-h-full flex-col pt-28 pb-12">
          <nav aria-label={a11y.mainNav}>
            <ul className="flex flex-col gap-2">
              {links.map((l, i) => (
                <li key={l.id} className="animate-reveal" style={{ animationDelay: `${80 + i * 60}ms` }}>
                  <a href={`#${l.id}`} onClick={() => setMenuOpen(false)} className="block py-2 text-heading-m">
                    {nav[l.key]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-auto flex gap-2 pt-12">
            {locales.map((l) => (
              <Link
                key={l}
                href={localePath(l)}
                hrefLang={l}
                aria-current={l === locale ? "true" : undefined}
                onClick={() => setMenuOpen(false)}
                className="rounded-full px-4 py-2 text-label-m ring-1 ring-line-on-dark aria-[current]:bg-white aria-[current]:text-primary"
              >
                {localeLabels[l]}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
