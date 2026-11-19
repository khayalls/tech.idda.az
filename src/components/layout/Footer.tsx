import { Logo } from "@/components/brand/Logo";
import type { Dictionary } from "@/i18n/dictionaries";

export function Footer({ t }: { t: Dictionary["footer"] }) {
  const tel = t.phone.replace(/\s/g, "");
  return (
    <footer className="bg-page text-primary">
      <div className="container-page flex flex-col gap-10 py-12">
        <div className="flex flex-col gap-8 border-t border-line pt-10 md:flex-row md:items-center md:justify-between">
          <Logo className="h-12 w-auto text-primary xl:h-14" />
          <ul className="flex flex-col gap-2 text-body-s md:flex-row md:gap-10">
            <li>
              <a href={`mailto:${t.email}`} className="transition-colors duration-200 hover:text-accent">
                {t.email}
              </a>
            </li>
            <li>
              <a href={`tel:${tel},3158`} className="transition-colors duration-200 hover:text-accent">
                {t.phone} ({t.phoneExt})
              </a>
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 text-caption text-tertiary md:flex-row md:justify-between">
          <p>{t.copyright}</p>
          <p>{t.ministry}</p>
        </div>
      </div>
    </footer>
  );
}
